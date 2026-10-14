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
| `mimeType`     | `mime_type`  | Output MIME type.                                                                                                                  |
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

## Usage

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
