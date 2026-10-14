# adonisjs-image
A complete AdonisJS image management package featuring seamless uploads, Drive storage and Lucid ORM integration.

## Features

- Drive integration (any `@adonisjs/drive` disk)
- Configurable allowed formats, format conversion, resizing and compression (powered by `sharp`)
- Named thumbnails with their own size/format/quality
- Migrations for `images` and `images_thumbnails` (format, size, width, height, path, hash, user, visibility, metadata…)
- `ImageService`: `upload`, `url` (signed for private images), `delete`

## Install

```sh
npm i adonisjs-image
node ace add adonisjs-image   # or: node ace configure adonisjs-image
node ace migration:run
```

Requires `@adonisjs/drive` and `@adonisjs/lucid`. Edit `config/image.ts` to adjust settings.

## Usage

```ts
import image from 'adonisjs-image/services/main'

const file = request.file('image', { extnames: ['jpg', 'png', 'webp'] })
const img = await image.upload(file!, { userId: auth.user!.id })
const url = await image.url(img, 'small')
await image.delete(img)
```

Invalid uploads throw `InvalidImageException`.
