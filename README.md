# adonisjs-image

A complete AdonisJS image management package featuring seamless uploads, Drive storage and Lucid ORM integration.

## Features

- Drive integration (any `@adonisjs/drive` disk)
- Configurable allowed formats, format conversion, resizing and compression (powered by `sharp`)
- Named thumbnails with their own size/format/quality
- A single `images` table for originals and their named thumbnails
- `ImageService`: `upload`, `url` (signed for private images), `delete`

Thumbnail records are child rows in `images`, linked to the original by `parent_id` and identified
by `name`. Each row stores the actual Drive disk name used, including the configured default, so
changing the default disk later does not redirect existing images. To query originals only, filter
for a null `parentId`.
File visibility follows the selected Drive disk's configuration; `upload` can still override it
for an individual file. URL generation checks the file's current visibility directly from Drive.

## Image model and table

The generated `Image` model extends Lucid's generated `ImageSchema`. The `images` table stores
original images and thumbnails:

| Model property | Column       | Description                                                                                                                        |
| -------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `id`           | `id`         | Auto-incrementing primary key.                                                                                                     |
| `parentId`     | `parent_id`  | Nullable self-reference; null for an original, otherwise the original image's ID. Deleting an original cascades to its thumbnails. |
| `name`         | `name`       | Nullable thumbnail name, such as `small`; null for an original.                                                                    |
| `userId`       | `user_id`    | Nullable uploader ID referencing `users.id`; set to null if the user is deleted.                                                   |
| `preset`       | `preset`     | Name of the preset used to process this row.                                                                                       |
| `disk`         | `disk`       | Drive disk name used to store the file.                                                                                            |
| `path`         | `path`       | File key/path on the Drive disk.                                                                                                   |
| `format`       | `format`     | Output image format, such as `webp` or `jpeg`.                                                                                     |
| `size`         | `size`       | Output file size in bytes.                                                                                                         |
| `width`        | `width`      | Output width in pixels.                                                                                                            |
| `height`       | `height`     | Output height in pixels.                                                                                                           |
| `hash`         | `hash`       | SHA-256 hash of the stored image content.                                                                                          |
| `createdAt`    | `created_at` | Row creation timestamp.                                                                                                            |
| `updatedAt`    | `updated_at` | Row update timestamp.                                                                                                              |

`parent_id` and `name` are unique together. The generated model exposes a `thumbnails` relation
for the child rows. The configure command also adds `User.avatar`, a `belongsTo` relation using
`users.avatar_id`.

## Install

```sh
npm install --save adonisjs-image
node ace add adonisjs-image   # or: node ace configure adonisjs-image
node ace migration:run
```

Requires `@adonisjs/drive` and `@adonisjs/lucid`. Edit `config/image.ts` to adjust settings.
The generated image migration references `users.id`; the avatar migration adds `users.avatar_id`
and references `images.id`. Run the existing users migration first, then the generated migrations
in order. `node ace add` also creates `app/models/image.ts` and adds the `User.avatar` relationship
to `app/models/user.ts`. Running the generated migrations creates `database/schema.ts`; the app
model extends its generated `ImageSchema` for column types.

## Configuration

Configure `config/image.ts` with `defineConfig`. The top-level `default` selects the preset used
when an upload does not specify one; it defaults to `image`. All image processing options live
inside `presets.image`. Additional named presets inherit unspecified options from `image`, while
their `quality` values are merged by format.

### Preset properties

| Property                | Description                                                                       | Default                                                   |
| ----------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `disk`                  | Drive disk used to store files.                                                   | Drive's configured default disk                           |
| `directory`             | Key prefix inside the disk.                                                       | `images`                                                  |
| `maxFileSize`           | Maximum accepted input size, in bytes.                                            | `10 * 1024 * 1024`                                        |
| `allowedFormats`        | Input formats accepted by the processor.                                          | `jpeg`, `png`, `webp`, `avif`, `gif`                      |
| `convertTo`             | Output format for the original and default thumbnail format.                      | Input format                                              |
| `maxWidth`, `maxHeight` | Maximum dimensions for the processed original. Images are never enlarged.         | No resize limit                                           |
| `fit`                   | Resize mode for the original: `cover`, `contain`, `fill`, `inside`, or `outside`. | `inside`                                                  |
| `stripMetadata`         | Strip metadata and auto-rotate from EXIF orientation.                             | `true`                                                    |
| `quality`               | Compression quality from 1 to 100, keyed by format.                               | `jpeg: 80`, `webp: 80`, `avif: 50`, `png: 90`, `tiff: 80` |
| `thumbnails`            | Map of thumbnail names to thumbnail settings.                                     | `{}`                                                      |

`maxWidth`, `maxHeight`, and `fit` affect the original only when a resize limit is set. The
generated starter config sets its own example limits; these defaults describe `defineConfig`.

### Thumbnail properties

Each entry in `thumbnails` is an object with these optional properties:

| Property          | Description                                                      | Default                              |
| ----------------- | ---------------------------------------------------------------- | ------------------------------------ |
| `width`, `height` | Output dimensions in pixels.                                     | Unset                                |
| `fit`             | Resize mode: `cover`, `contain`, `fill`, `inside`, or `outside`. | `cover`                              |
| `format`          | Thumbnail output format.                                         | Processed original format            |
| `quality`         | Compression quality from 1 to 100.                               | Preset quality for the output format |

## Routes and controller

The configure command does not modify `start/routes.ts` or generate a controller. Add the
resource route and create `app/controllers/images_controller.ts` using the following examples:

```ts
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
import type { HttpContext } from '@adonisjs/core/http';
import image from 'adonisjs-image/services/main';

import { Image } from '#models/image';

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
