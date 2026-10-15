import sharp, { type Sharp } from 'sharp';

import { InvalidImageException } from './exceptions.js';
import { sanitizeSvg } from './svg_sanitizer.js';
import type {
  ImageFormat,
  ImageProcessingConfig,
  ProcessedImage,
  RasterImageFormat,
  ThumbnailConfig,
} from './types.js';

const FORMATS = new Set<string>(['jpeg', 'png', 'webp', 'avif', 'gif', 'tiff', 'svg']);
export { InvalidImageException } from './exceptions.js';

function normalizeFormat(format: string | undefined): ImageFormat | undefined {
  if (format === 'jpg') return 'jpeg';
  if (format === 'tif') return 'tiff';
  if (format === 'heif') return 'avif';
  return format && FORMATS.has(format) ? (format as ImageFormat) : undefined;
}

function rasterFormat(format: ImageFormat): RasterImageFormat {
  return format === 'svg' ? 'png' : format;
}

export function extensionOf(format: ImageFormat) {
  return format === 'jpeg' ? 'jpg' : format;
}

async function encode(
  pipeline: Sharp,
  format: RasterImageFormat,
  quality: number | undefined,
): Promise<ProcessedImage> {
  const { data, info } = await pipeline
    .toFormat(format, quality ? { quality } : {})
    .toBuffer({ resolveWithObject: true });
  return {
    buffer: data,
    format,
    extension: extensionOf(format),
    width: info.width,
    height: info.height,
    size: info.size,
  };
}

function qualityForFormat(
  quality: ImageProcessingConfig['quality'],
  format: RasterImageFormat,
): number | undefined {
  return typeof quality === 'number' ? quality : quality[format];
}

/** Validates the image data and returns the processed original (converted, resized, compressed). */
export async function processOriginal(
  input: Buffer,
  config: ImageProcessingConfig,
): Promise<ProcessedImage> {
  let sourceFormat: ImageFormat | undefined;
  try {
    sourceFormat = normalizeFormat((await sharp(input).metadata()).format);
  } catch {
    throw new InvalidImageException('File is not a valid image');
  }
  if (!sourceFormat) {
    throw new InvalidImageException('Image format is not supported');
  }

  const cleanInput = sourceFormat === 'svg' ? sanitizeSvg(input, config.keepMetadata) : input;
  const configuredFormat =
    typeof config.format === 'string' ? config.format : config.format?.[sourceFormat];
  if (sourceFormat === 'svg' && !configuredFormat) {
    const metadata = await sharp(cleanInput).metadata();
    if (!metadata.width || !metadata.height) {
      throw new InvalidImageException('SVG must have a defined width and height');
    }
    return {
      buffer: cleanInput,
      format: 'svg',
      extension: 'svg',
      width: metadata.width,
      height: metadata.height,
      size: cleanInput.length,
    };
  }

  const target = configuredFormat ?? rasterFormat(sourceFormat);
  let pipeline = sharp(cleanInput, { animated: target === 'gif' || target === 'webp' });
  if (config.keepMetadata) pipeline = pipeline.keepMetadata();
  else pipeline = pipeline.rotate();
  if (config.width || config.height) {
    pipeline = pipeline.resize({
      width: config.width,
      height: config.height,
      fit: config.fit ?? 'inside',
      withoutEnlargement: true,
    });
  }
  return encode(pipeline, target, qualityForFormat(config.quality, target));
}

export async function processThumbnail(
  input: Buffer,
  thumb: ThumbnailConfig,
  config: ImageProcessingConfig,
  fallbackFormat: ImageFormat,
) {
  let sourceFormat: ImageFormat | undefined;
  let sourceWidth: number | undefined;
  let sourceHeight: number | undefined;
  try {
    const metadata = await sharp(input).metadata();
    sourceFormat = normalizeFormat(metadata.format);
    sourceWidth = metadata.width;
    sourceHeight = metadata.height;
  } catch {
    throw new InvalidImageException('File is not a valid image');
  }
  if (
    (thumb.width !== undefined && sourceWidth !== undefined && sourceWidth < thumb.width) ||
    (thumb.height !== undefined && sourceHeight !== undefined && sourceHeight < thumb.height)
  ) {
    return undefined;
  }

  const cleanInput = sourceFormat === 'svg' ? sanitizeSvg(input, config.keepMetadata) : input;
  const format = thumb.format ?? rasterFormat(fallbackFormat);
  const pipeline = sharp(cleanInput)
    .rotate()
    .resize({
      width: thumb.width,
      height: thumb.height,
      fit: thumb.fit ?? 'inside',
      withoutEnlargement: true,
    });
  return encode(pipeline, format, thumb.quality ?? qualityForFormat(config.quality, format));
}
