import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { Image } from './models/image.js';
import { ImageThumbnail } from './models/image_thumbnail.js';
import { extensionOf, processOriginal, processThumbnail } from './processor.js';
import type { ImageConfig, UploadOptions } from './types.js';

/** Minimal subset of a Drive disk used by the service */
export interface ImageDisk {
  put(
    key: string,
    contents: Uint8Array,
    options?: { visibility?: string; contentType?: string },
  ): Promise<void>;
  delete(key: string): Promise<void>;
  getUrl(key: string): Promise<string>;
  getSignedUrl?(key: string, options?: Record<string, unknown>): Promise<string>;
}

export type DiskResolver = (name?: string) => ImageDisk;

/** A multipart file (has `tmpPath`), a Buffer or a filesystem path */
export type UploadInput = Buffer | { tmpPath?: string; clientName?: string } | string;

export class ImageService {
  constructor(
    readonly config: ImageConfig,
    private resolveDisk: DiskResolver,
  ) {}

  private disk() {
    return this.resolveDisk(this.config.disk);
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
    const raw = await this.toBuffer(input);
    const original = await processOriginal(raw, this.config);
    const visibility = options.visibility ?? this.config.visibility;
    const disk = this.disk();

    const id = randomUUID();
    const day = new Date().toISOString().slice(0, 7).replace('-', '/');
    const base = `${this.config.directory}/${day}/${id}`;
    const written: string[] = [];
    const put = async (key: string, data: Buffer, contentType: string) => {
      await disk.put(key, data, { visibility, contentType });
      written.push(key);
    };

    const originalName =
      options.originalName ??
      (typeof input === 'object' && !Buffer.isBuffer(input) ? input.clientName : undefined);

    try {
      const path = `${base}.${original.extension}`;
      await put(path, original.buffer, original.mimeType);

      const thumbs: {
        name: string;
        path: string;
        result: Awaited<ReturnType<typeof processThumbnail>>;
      }[] = [];
      for (const [name, thumb] of Object.entries(this.config.thumbnails)) {
        const result = await processThumbnail(raw, thumb, this.config, original.format);
        const thumbPath = `${base}_${name}.${extensionOf(result.format)}`;
        await put(thumbPath, result.buffer, result.mimeType);
        thumbs.push({ name, path: thumbPath, result });
      }

      const image = await Image.create({
        userId: options.userId as number | null | undefined,
        disk: this.config.disk ?? null,
        originalName: originalName ?? null,
        path,
        format: original.format,
        mimeType: original.mimeType,
        size: original.size,
        width: original.width,
        height: original.height,
        hash: createHash('sha256').update(original.buffer).digest('hex'),
        alt: options.alt ?? null,
        visibility,
        metadata: options.metadata ?? null,
      });
      if (thumbs.length) {
        await ImageThumbnail.createMany(
          thumbs.map((t) => ({
            imageId: image.id,
            name: t.name,
            path: t.path,
            format: t.result.format,
            mimeType: t.result.mimeType,
            size: t.result.size,
            width: t.result.width,
            height: t.result.height,
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
  async url(image: Image, thumbnail?: string) {
    let path = image.path;
    if (thumbnail) {
      if (!image.$preloaded.thumbnails) await image.load('thumbnails');
      const thumb = image.thumbnails.find((t) => t.name === thumbnail);
      if (!thumb) throw new Error(`Thumbnail "${thumbnail}" does not exist`);
      path = thumb.path;
    }
    const disk = this.resolveDisk(image.disk ?? undefined);
    if (image.visibility === 'private' && disk.getSignedUrl) return disk.getSignedUrl(path);
    return disk.getUrl(path);
  }

  /** Removes the files from Drive and the rows from the database */
  async delete(image: Image) {
    await image.load('thumbnails');
    const disk = this.resolveDisk(image.disk ?? undefined);
    await Promise.all(
      [image.path, ...image.thumbnails.map((t) => t.path)].map((k) => disk.delete(k)),
    );
    await image.related('thumbnails').query().delete();
    await image.delete();
  }
}
