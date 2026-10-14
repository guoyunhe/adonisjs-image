import type { ImageConfig } from './types.js'

export function defineConfig(config: Partial<ImageConfig> = {}): ImageConfig {
  return {
    directory: 'images',
    visibility: 'public',
    maxFileSize: 10 * 1024 * 1024,
    allowedFormats: ['jpeg', 'png', 'webp', 'avif', 'gif'],
    stripMetadata: true,
    quality: { jpeg: 80, webp: 80, avif: 50, png: 90, tiff: 80 },
    thumbnails: {},
    tableName: 'images',
    ...config,
  }
}
