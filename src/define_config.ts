import type {
  ImageConfig,
  ImageConfigInput,
  ImageQuality,
  RasterImageFormat,
  ResolvedImageConfig,
} from './types.js';

const rasterFormats: RasterImageFormat[] = ['jpeg', 'png', 'webp', 'avif', 'gif', 'tiff'];
const defaultImagePreset: ResolvedImageConfig = {
  directory: 'images',
  keepMetadata: false,
  quality: { jpeg: 80, webp: 80, avif: 50, png: 90, tiff: 80 },
  thumbnails: {},
};

function mergeQuality(base: ImageQuality, override?: ImageQuality): ImageQuality {
  if (override === undefined) return base;
  if (typeof override === 'number') return override;

  const baseQuality =
    typeof base === 'number'
      ? Object.fromEntries(rasterFormats.map((format) => [format, base]))
      : base;
  return { ...baseQuality, ...override };
}

export function defineConfig(config: ImageConfigInput = {}): ImageConfig {
  const presets = config.presets ?? {};
  const imagePreset = presets.image ?? {};
  const image: ResolvedImageConfig = {
    ...defaultImagePreset,
    ...imagePreset,
    quality: mergeQuality(defaultImagePreset.quality, imagePreset.quality),
  };

  return {
    default: config.default ?? 'image',
    presets: { ...presets, image },
  };
}

export function resolveImagePreset(
  config: ImageConfig,
  name = config.default,
): ResolvedImageConfig {
  const preset = config.presets[name];
  if (!preset) throw new Error(`Image preset "${name}" is not configured`);
  const image = config.presets.image;

  return {
    ...image,
    ...preset,
    quality: mergeQuality(image.quality, preset.quality),
  };
}
