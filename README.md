# adonisjs-image

A complete AdonisJS image management package featuring seamless uploads, Drive storage and Lucid ORM integration.

## Features

- Fast, reliable image processing powered by [Sharp](https://sharp.pixelplumbing.com/).
- Purpose-specific presets for avatars, general images, high-resolution photos, and more.
- Automatic named thumbnails stored alongside their original images in one table.
- [Drive](https://docs.adonisjs.com/guides/drive)-compatible storage across local and cloud disks, with private-file URL signing.

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
