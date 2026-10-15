export type RasterImageFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'gif' | 'tiff';
export type ImageFormat = RasterImageFormat | 'svg';
export type ImageOutputFormat = RasterImageFormat | Partial<Record<ImageFormat, RasterImageFormat>>;
export type ImageQuality = number | Partial<Record<RasterImageFormat, number>>;

export type FitMode = 'cover' | 'contain' | 'fill' | 'inside' | 'outside';

export interface ThumbnailConfig {
  width?: number;
  height?: number;
  /** Resize mode. Defaults to 'inside' */
  fit?: FitMode;
  /** Raster output format. Defaults to the format of the processed original, or PNG for SVG */
  format?: RasterImageFormat;
  /** Compression quality 1-100. Defaults to the format quality setting */
  quality?: number;
}

export interface ImageProcessingConfig {
  /** Convert every upload to one format, or map selected input formats to output formats */
  format?: ImageOutputFormat;
  /** Resize originals to fit within these dimensions */
  width?: number;
  height?: number;
  /** Resize mode for the original. Defaults to 'inside' */
  fit?: FitMode;
  /**
   * Preserve EXIF/metadata instead of auto-rotating and stripping it. May expose private
   * information; avoid for publicly accessible images. Defaults to false
   */
  keepMetadata: boolean;
  /** Compression quality (1-100) for all formats or per output format */
  quality: ImageQuality;
  /** Named thumbnails generated for every upload */
  thumbnails: Record<string, ThumbnailConfig>;
}

export interface ImagePresetConfig extends Partial<ImageProcessingConfig> {
  /** Drive disk used for storage. Defaults to the Drive default disk */
  disk?: string;
  /** Directory (key prefix) inside the disk */
  directory?: string;
}

export interface ResolvedImageConfig extends ImageProcessingConfig {
  /** Drive disk used for storage. Defaults to the Drive default disk */
  disk?: string;
  /** Directory (key prefix) inside the disk */
  directory: string;
}

export interface ImageConfig {
  /** Preset used when upload options do not specify one */
  default: string;
  /** Named image configurations. Other presets inherit unspecified options from `image` */
  presets: Record<string, ImagePresetConfig> & { image: ResolvedImageConfig };
}

export interface ImageConfigInput {
  default?: string;
  presets?: Record<string, ImagePresetConfig>;
}

export interface ImageAttributes {
  parentId: number | null;
  name: string | null;
  userId: number | null | undefined;
  disk: string;
  preset: string;
  path: string;
  format: ImageFormat;
  size: number;
  width: number;
  height: number;
  hash: string;
}

export interface ImageRecord extends ImageAttributes {
  id: number;
  userId: number | null;
  thumbnails: ImageRecord[];
  $preloaded: { thumbnails?: ImageRecord[] };
  load(relation: 'thumbnails'): Promise<unknown>;
  related(relation: 'thumbnails'): { query(): { delete(): Promise<unknown> } };
  delete(): Promise<unknown>;
}

export interface ImageModel {
  create(attributes: ImageAttributes): Promise<ImageRecord>;
  createMany(attributes: ImageAttributes[]): Promise<unknown>;
}

export interface ProcessedImage {
  buffer: Buffer;
  format: ImageFormat;
  extension: string;
  width: number;
  height: number;
  size: number;
}

export interface UploadOptions {
  userId?: number | string | null;
  visibility?: 'public' | 'private';
  /** Image preset to use. Defaults to the configured default */
  preset?: string;
}
