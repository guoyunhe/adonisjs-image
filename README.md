# adonisjs-image

A complete AdonisJS image management package featuring seamless uploads, Drive storage and Lucid ORM integration.

## Features

- Fast, reliable image processing powered by [Sharp](https://sharp.pixelplumbing.com/).
- Sanitized SVG originals with rasterized thumbnails.
- Purpose-specific presets for avatars, general images, high-resolution photos, and more.
- Automatic named thumbnails stored alongside their original images in one table.
- [Drive](https://docs.adonisjs.com/guides/digging-deeper/drive)-compatible storage across local and cloud disks, with private-file URL signing.

## Table of contents

- [Features](#features)
- [Install](#install)
- [Image model and table](#image-model-and-table)
- [Configuration](#configuration)
  - [Preset properties](#preset-properties)
  - [Thumbnail properties](#thumbnail-properties)
- [Routes and controller](#routes-and-controller)
- [User avatar](#user-avatar)
  - [Avatar Migration](#avatar-migration)
  - [Avatar Relationship](#avatar-relationship)
  - [Avatar Routes](#avatar-routes)

## Install

Requires [@adonisjs/drive](https://docs.adonisjs.com/guides/digging-deeper/drive), [@adonisjs/lucid](https://docs.adonisjs.com/guides/database/lucid), and an existing `users` table.

```sh
pnpm add adonisjs-image
node ace add adonisjs-image
node ace migration:run
```

The image migration references `users.id`, so create the `users` table first. `node ace add`
generates the image config, model, and migration. It does not modify your `User` model or create
routes/controller; see the optional avatar and route examples below. After migration, Lucid
generates `database/schema.ts`, which provides the `ImageSchema` extended by the generated model.

## Image model and table

The generated `Image` model extends Lucid's generated `ImageSchema`. The `images` table stores
original images and thumbnails:

| Property    | Description                          |
| ----------- | ------------------------------------ |
| `id`        | Primary key.                         |
| `parentId`  | Parent image ID; null for originals. |
| `name`      | Thumbnail name; null for originals.  |
| `userId`    | Uploader ID; null if deleted.        |
| `preset`    | Processing preset.                   |
| `disk`      | Drive disk.                          |
| `path`      | Storage path.                        |
| `format`    | Output format.                       |
| `size`      | File size in bytes.                  |
| `width`     | Width in pixels.                     |
| `height`    | Height in pixels.                    |
| `hash`      | SHA-256 hash.                        |
| `createdAt` | Creation time.                       |
| `updatedAt` | Update time.                         |

## Configuration

Edit `config/image.ts` to adjust settings. The top-level `default` selects the preset used
when an upload does not specify one; it defaults to `image`. All image processing options live
inside `presets.image`. Additional named presets inherit unspecified options from `image`, while
their `quality` values are merged by format.

### Preset properties

| Property                | Description                                                                       | Default                                                   |
| ----------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `disk`                  | Drive disk used to store files.                                                   | Drive's configured default disk                           |
| `directory`             | Key prefix inside the disk.                                                       | `images`                                                  |
| `maxFileSize`           | Maximum accepted input size, in bytes.                                            | `10 * 1024 * 1024`                                        |
| `allowedFormats`        | Input formats accepted by the processor.                                          | `jpeg`, `png`, `webp`, `avif`, `gif`, `svg`               |
| `convertTo`             | Raster output format for the original and default thumbnail format.               | Input format                                              |
| `maxWidth`, `maxHeight` | Maximum dimensions for the processed original. Images are never enlarged.         | No resize limit                                           |
| `fit`                   | Resize mode for the original: `cover`, `contain`, `fill`, `inside`, or `outside`. | `inside`                                                  |
| `stripMetadata`         | Strip metadata and auto-rotate from EXIF orientation.                             | `true`                                                    |
| `quality`               | Compression quality from 1 to 100, keyed by format.                               | `jpeg: 80`, `webp: 80`, `avif: 50`, `png: 90`, `tiff: 80` |
| `thumbnails`            | Map of thumbnail names to thumbnail settings.                                     | `{}`                                                      |

SVG originals are sanitized (scripts, event handlers, styles, and external resources are removed)
and kept as vector files unless `convertTo` is set. Their thumbnails are rasterized as PNG by
default. `maxWidth`, `maxHeight`, and `fit` affect raster originals only when a resize limit is set.
The generated starter config sets its own example limits; these defaults describe `defineConfig`.

### Thumbnail properties

Each entry in `thumbnails` is an object with these optional properties:

| Property          | Description                                                      | Default                                |
| ----------------- | ---------------------------------------------------------------- | -------------------------------------- |
| `width`, `height` | Output dimensions in pixels.                                     | Unset                                  |
| `fit`             | Resize mode: `cover`, `contain`, `fill`, `inside`, or `outside`. | `cover`                                |
| `format`          | Raster thumbnail output format.                                  | Processed original format; PNG for SVG |
| `quality`         | Compression quality from 1 to 100.                               | Preset quality for the output format   |

## Routes and controller

The configure command does not modify `start/routes.ts` or generate a controller. Add the
resource route and create `app/controllers/images_controller.ts` using the following examples:

```ts
// start/routes.ts
import router from '@adonisjs/core/services/router';

import { controllers } from '#generated/controllers';

router.resource('images', controllers.Images).only(['store', 'show', 'destroy']);
```

| Method   | Path          | Purpose                                                                   |
| -------- | ------------- | ------------------------------------------------------------------------- |
| `POST`   | `/images`     | Upload the multipart file in the `image` field.                           |
| `GET`    | `/images/:id` | Get the original image URL; add `?thumbnail=small` for a named thumbnail. |
| `DELETE` | `/images/:id` | Delete an image and its thumbnails.                                       |

Add the authentication and authorization middleware appropriate for your application.

```ts
// app/controllers/images_controller.ts
import type { HttpContext } from '@adonisjs/core/http';
import image from 'adonisjs-image/services/main';

import Image from '#models/image';

export default class ImagesController {
  async store({ request, response }: HttpContext) {
    const file = request.file('image');
    if (!file?.tmpPath) {
      return response.badRequest({ message: 'An image file is required' });
    }

    const uploaded = await image.upload(file.tmpPath);
    const thumbnails: { name: string; url: string }[] = [];
    for (const thumbnail of uploaded.thumbnails) {
      if (!thumbnail.name) continue;
      thumbnails.push({
        name: thumbnail.name,
        url: await image.url(uploaded, thumbnail.name),
      });
    }

    return response.created({
      id: uploaded.id,
      url: await image.url(uploaded),
      thumbnails,
    });
  }

  async show({ params, request }: HttpContext) {
    const record = await Image.findOrFail(params.id);
    const thumbnail = request.input('thumbnail');
    return {
      id: record.id,
      url: await image.url(record, typeof thumbnail === 'string' ? thumbnail : undefined),
    };
  }

  async destroy({ params, response }: HttpContext) {
    const record = await Image.findOrFail(params.id);
    await image.delete(record);
    return response.noContent();
  }
}
```

The service can also be used directly from application code:

```ts
import image from 'adonisjs-image/services/main';

const file = request.file('image', { extnames: ['jpg', 'png', 'webp'] });
const img = await image.upload(file!, { userId: auth.user!.id });
const avatarImages = image.use('avatar');
const avatar = await avatarImages.upload(file!, { userId: auth.user!.id });
const photoImages = image.use('photo');
const photo = await photoImages.upload(file!, { userId: auth.user!.id });
const url = await image.url(img);
const thumbnailUrl = await image.url(img, 'small');
await image.delete(img);
```

The `image` preset is used by default. Configure named presets in `config/image.ts` to apply
different size, crop, format, quality, and thumbnail settings for avatars, photos, or other uses.
Each uploaded image and its thumbnails record the preset name used, so generated files can be
regenerated later if preset settings change.

Invalid uploads throw `InvalidImageException`.

## User avatar

### Avatar Migration

To associate users with avatar images, add an `avatar_id` column after the `images` table has been
created. Generate a migration:

```sh
node ace make:migration add_avatar_to_users
```

Then add:

```ts
// database/migrations/<timestamp>_add_avatar_to_users.ts
import { BaseSchema } from '@adonisjs/lucid/schema';

export default class AddAvatarToUsers extends BaseSchema {
  protected tableName = 'users';

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('avatar_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('images')
        .onDelete('SET NULL');
      table.index('avatar_id');
    });
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['avatar_id']);
      table.dropIndex(['avatar_id']);
      table.dropColumn('avatar_id');
    });
  }
}
```

### Avatar Relationship

Then add this relation to your `User` model:

```ts
// app/models/user.ts
import { belongsTo } from '@adonisjs/lucid/orm';
import type { BelongsTo } from '@adonisjs/lucid/types/relations';

import Image from '#models/image';

export default class User extends compose(UserSchema, withAuthFinder(hash)) {
  @belongsTo(() => Image)
  declare avatar: BelongsTo<typeof Image>;
}
```

### Avatar Routes

Use the image endpoints described in [Routes and controller](#routes-and-controller) for uploading
and serving images. In the upload action, select the `avatar` preset with `image.use('avatar')`.
