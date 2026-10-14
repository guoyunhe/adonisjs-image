import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { resolveImagePreset } from './define_config.js';
import { extensionOf, processOriginal, processThumbnail } from './processor.js';
import type { ImageConfig, ImageModel, ImageRecord, UploadOptions } from './types.js';

/** Minimal subset of a Drive disk used by the service */
export interface ImageDisk {
  put(
    key: string,
    contents: Uint8Array,
    options?: { visibility?: 'public' | 'private'; contentType?: string },
  ): Promise<void>;
  delete(key: string): Promise<void>;
  getUrl(key: string): Promise<string>;
  getVisibility(key: string): Promise<'public' | 'private'>;
  getSignedUrl?(key: string, options?: Record<string, unknown>): Promise<string>;
}

export type DiskResolver = (name: string) => ImageDisk;

/** A multipart file (has `tmpPath`), a Buffer or a filesystem path */
export type UploadInput = Buffer | { tmpPath?: string } | string;

export class ImageService {
  constructor(
    readonly config: ImageConfig,
    private resolveDisk: DiskResolver,
    private imageModel: ImageModel,
    private defaultDisk: string,
  ) {}

  use(preset = this.config.default) {
    resolveImagePreset(this.config, preset);
    return new ImageService(
      { ...this.config, default: preset },
      this.resolveDisk,
      this.imageModel,
      this.defaultDisk,
    );
  }

  private async toBuffer(input: UploadInput) {
    if (Buffer.isBuffer(input)) return input;
    const path = typeof input === 'string' ? input : input.tmpPath;
    if (!path) throw new Error('Upload input has no readable content');
    return readFile(path);
  }

  /**
   * Validates, converts, resizes and compresses the image, stores it with its thumbnails on Drive
   * and records everything in the database.
   */
  async upload(input: UploadInput, options: UploadOptions = {}) {
    const preset = options.preset ?? this.config.default;
    const config = resolveImagePreset(this.config, preset);
    const raw = await this.toBuffer(input);
    const original = await processOriginal(raw, config);
    const diskName = config.disk ?? this.defaultDisk;
    const disk = this.resolveDisk(diskName);

    const id = randomUUID();
    const day = new Date().toISOString().slice(0, 7).replace('-', '/');
    const base = `${config.directory}/${day}/${id}`;
    const written: string[] = [];
    const put = async (key: string, data: Buffer, contentType: string) => {
      await disk.put(
        key,
        data,
        options.visibility ? { visibility: options.visibility, contentType } : { contentType },
      );
      written.push(key);
    };

    try {
      const path = `${base}.${original.extension}`;
      await put(path, original.buffer, original.mimeType);

      const thumbs: {
        name: string;
        path: string;
        result: Awaited<ReturnType<typeof processThumbnail>>;
      }[] = [];
      for (const [name, thumb] of Object.entries(config.thumbnails)) {
        const result = await processThumbnail(raw, thumb, config, original.format);
        const thumbPath = `${base}_${name}.${extensionOf(result.format)}`;
        await put(thumbPath, result.buffer, result.mimeType);
        thumbs.push({ name, path: thumbPath, result });
      }

      const image = await this.imageModel.create({
        parentId: null,
        name: null,
        userId: options.userId as number | null | undefined,
        disk: diskName,
        preset,
        path,
        format: original.format,
        mimeType: original.mimeType,
        size: original.size,
        width: original.width,
        height: original.height,
        hash: createHash('sha256').update(original.buffer).digest('hex'),
      });
      if (thumbs.length) {
        await this.imageModel.createMany(
          thumbs.map((t) => ({
            parentId: image.id,
            name: t.name,
            userId: image.userId,
            disk: image.disk,
            preset,
            path: t.path,
            format: t.result.format,
            mimeType: t.result.mimeType,
            size: t.result.size,
            width: t.result.width,
            height: t.result.height,
            hash: createHash('sha256').update(t.result.buffer).digest('hex'),
          })),
        );
      }
      await image.load('thumbnails');
      return image;
    } catch (error) {
      await Promise.allSettled(written.map((key) => disk.delete(key)));
      throw error;
    }
  }

  /** Public URL, or a signed URL for private images */
  async url(image: ImageRecord, thumbnail?: string) {
    let path = image.path;
    if (thumbnail) {
      if (!image.$preloaded.thumbnails) await image.load('thumbnails');
      const thumb = image.thumbnails.find((t) => t.name === thumbnail);
      if (!thumb) throw new Error(`Thumbnail "${thumbnail}" does not exist`);
      path = thumb.path;
    }

    const disk = this.resolveDisk(image.disk);
    if ((await disk.getVisibility(path)) === 'private' && disk.getSignedUrl) {
      return disk.getSignedUrl(path);
    }
    return disk.getUrl(path);
  }

  /** Removes the files from Drive and the rows from the database */
  async delete(image: ImageRecord) {
    await image.load('thumbnails');
    const disk = this.resolveDisk(image.disk);
    await Promise.all(
      [image.path, ...image.thumbnails.map((t) => t.path)].map((k) => disk.delete(k)),
    );
    await image.related('thumbnails').query().delete();
    await image.delete();
  }
}
