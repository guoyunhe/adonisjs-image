import DOMPurify from 'isomorphic-dompurify';
import sharp, { type Sharp } from 'sharp';

import type {
  ImageFormat,
  ImageProcessingConfig,
  ProcessedImage,
  RasterImageFormat,
  ThumbnailConfig,
} from './types.js';

const FORMATS = new Set<string>(['jpeg', 'png', 'webp', 'avif', 'gif', 'tiff', 'svg']);
const FORBIDDEN_SVG_TAGS = [
  'a',
  'animate',
  'animateMotion',
  'animateTransform',
  'audio',
  'embed',
  'feImage',
  'foreignObject',
  'iframe',
  'image',
  'object',
  'script',
  'set',
  'style',
  'video',
];

export class InvalidImageException extends Error {
  static code = 'E_INVALID_IMAGE';
}

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

function sanitizeSvg(input: Buffer, stripMetadata: boolean) {
  const blockExternalResources: Parameters<typeof DOMPurify.addHook>[1] = (_node, data) => {
    const name = data.attrName.toLowerCase();
    const value = data.attrValue.trim();
    if ((name === 'href' || name === 'xlink:href') && !/^#[\w.-]+$/.test(value)) {
      data.keepAttr = false;
    }
    if (/\burl\s*\(/i.test(value) && !/^url\(\s*#[\w.-]+\s*\)$/i.test(value)) {
      data.keepAttr = false;
    }
  };
  DOMPurify.addHook('uponSanitizeAttribute', blockExternalResources);
  let sanitized: string;
  try {
    sanitized = DOMPurify.sanitize(input.toString('utf8'), {
      FORBID_ATTR: ['style'],
      FORBID_CONTENTS: stripMetadata ? ['metadata'] : [],
      FORBID_TAGS: stripMetadata ? [...FORBIDDEN_SVG_TAGS, 'metadata'] : FORBIDDEN_SVG_TAGS,
      USE_PROFILES: { svg: true, svgFilters: true },
    });
  } finally {
    DOMPurify.removeHook('uponSanitizeAttribute', blockExternalResources);
  }
  if (!/<svg(?:\s|>)/i.test(sanitized)) {
    throw new InvalidImageException('SVG does not contain a valid SVG root');
  }
  return Buffer.from(sanitized);
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

  const cleanInput = sourceFormat === 'svg' ? sanitizeSvg(input, config.stripMetadata) : input;
  if (sourceFormat === 'svg' && !config.convertTo) {
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

  const target = config.convertTo ?? rasterFormat(sourceFormat);
  let pipeline = sharp(cleanInput, { animated: target === 'gif' || target === 'webp' });
  if (config.stripMetadata) pipeline = pipeline.rotate();
  else pipeline = pipeline.keepMetadata();
  if (config.maxWidth || config.maxHeight) {
    pipeline = pipeline.resize({
      width: config.maxWidth,
      height: config.maxHeight,
      fit: config.fit ?? 'inside',
      withoutEnlargement: true,
    });
  }
  return encode(pipeline, target, config.quality[target]);
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

  const cleanInput = sourceFormat === 'svg' ? sanitizeSvg(input, config.stripMetadata) : input;
  const format = thumb.format ?? rasterFormat(fallbackFormat);
  const pipeline = sharp(cleanInput)
    .rotate()
    .resize({
      width: thumb.width,
      height: thumb.height,
      fit: thumb.fit ?? 'cover',
      withoutEnlargement: true,
    });
  return encode(pipeline, format, thumb.quality ?? config.quality[format]);
}
