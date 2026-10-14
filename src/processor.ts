import sharp, { type Sharp } from 'sharp';

import type { ImageConfig, ImageFormat, ProcessedImage, ThumbnailConfig } from './types.js';

const MIME: Record<ImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  tiff: 'image/tiff',
};

export class InvalidImageException extends Error {
  static code = 'E_INVALID_IMAGE';
}

function normalizeFormat(format: string | undefined): ImageFormat | undefined {
  if (format === 'jpg') return 'jpeg';
  if (format === 'tif') return 'tiff';
  if (format === 'heif') return 'avif';
  return format && format in MIME ? (format as ImageFormat) : undefined;
}

export function mimeTypeOf(format: ImageFormat) {
  return MIME[format];
}

export function extensionOf(format: ImageFormat) {
  return format === 'jpeg' ? 'jpg' : format;
}

async function encode(
  pipeline: Sharp,
  format: ImageFormat,
  quality: number | undefined,
): Promise<ProcessedImage> {
  const { data, info } = await pipeline
    .toFormat(format, quality ? { quality } : {})
    .toBuffer({ resolveWithObject: true });
  return {
    buffer: data,
    format,
    mimeType: MIME[format],
    extension: extensionOf(format),
    width: info.width,
    height: info.height,
    size: info.size,
  };
}

/**
 * Validates the input against the config and returns the processed original (converted, resized,
 * compressed).
 */
export async function processOriginal(input: Buffer, config: ImageConfig) {
  if (input.length > config.maxFileSize) {
    throw new InvalidImageException(`Image exceeds the max size of ${config.maxFileSize} bytes`);
  }

  let sourceFormat: ImageFormat | undefined;
  try {
    sourceFormat = normalizeFormat((await sharp(input).metadata()).format);
  } catch {
    throw new InvalidImageException('File is not a valid image');
  }
  if (!sourceFormat || !config.allowedFormats.includes(sourceFormat)) {
    throw new InvalidImageException(`Image format "${sourceFormat ?? 'unknown'}" is not allowed`);
  }

  const target = config.convertTo ?? sourceFormat;
  let pipeline = sharp(input, { animated: target === 'gif' || target === 'webp' });
  if (config.stripMetadata) pipeline = pipeline.rotate();
  else pipeline = pipeline.keepMetadata();
  if (config.maxWidth || config.maxHeight) {
    pipeline = pipeline.resize({
      width: config.maxWidth,
      height: config.maxHeight,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }
  return encode(pipeline, target, config.quality[target]);
}

export async function processThumbnail(
  input: Buffer,
  thumb: ThumbnailConfig,
  config: ImageConfig,
  fallbackFormat: ImageFormat,
) {
  const format = thumb.format ?? fallbackFormat;
  const pipeline = sharp(input)
    .rotate()
    .resize({
      width: thumb.width,
      height: thumb.height,
      fit: thumb.fit ?? 'cover',
      withoutEnlargement: true,
    });
  return encode(pipeline, format, thumb.quality ?? config.quality[format]);
}
