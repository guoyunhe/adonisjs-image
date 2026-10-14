# adonisjs-image

A complete AdonisJS image management package featuring seamless uploads, Drive storage and Lucid ORM integration.

## Features

- Drive integration (any `@adonisjs/drive` disk)
- Configurable allowed formats, format conversion, resizing and compression (powered by `sharp`)
- Named thumbnails with their own size/format/quality
- A single `images` table for originals and their named thumbnails
- `ImageService`: `upload`, `url` (signed for private images), `delete`

Thumbnail records are child rows in `images`, linked to the original by `parent_id` and identified
by `name`. To query originals only, filter for a null `parentId`.
File visibility follows the selected Drive disk's configuration; `upload` can still override it
for an individual file.

## Install

```sh
npm install --save adonisjs-image
node ace add adonisjs-image   # or: node ace configure adonisjs-image
node ace migration:run
```

Requires `@adonisjs/drive` and `@adonisjs/lucid`. Edit `config/image.ts` to adjust settings.
The generated migration references `users.id`; run the users table migration first.

## Usage

```ts
import image from 'adonisjs-image/services/main';

const file = request.file('image', { extnames: ['jpg', 'png', 'webp'] });
const img = await image.upload(file!, { userId: auth.user!.id });
const avatarImages = image.use('avatar');
const avatar = await avatarImages.upload(file!, { userId: auth.user!.id });
const photoImages = image.use('photo');
const photo = await photoImages.upload(file!, { userId: auth.user!.id });
const url = await image.url(img, 'small');
await image.delete(img);
```

The `image` preset is used by default. Configure named presets in `config/image.ts` to apply
different size, crop, format, quality, and thumbnail settings for avatars, photos, or other uses.

Invalid uploads throw `InvalidImageException`.
