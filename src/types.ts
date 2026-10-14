export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'gif' | 'tiff';

export type FitMode = 'cover' | 'contain' | 'fill' | 'inside' | 'outside';

export interface ThumbnailConfig {
  width?: number;
  height?: number;
  fit?: FitMode;
  /** Output format. Defaults to the format of the processed original */
  format?: ImageFormat;
  /** Compression quality 1-100. Defaults to the format quality setting */
  quality?: number;
}

export interface ImageProcessingConfig {
  /** Max upload size in bytes */
  maxFileSize: number;
  /** Accepted input formats */
  allowedFormats: ImageFormat[];
  /** Convert every upload to this format (e.g. 'webp') */
  convertTo?: ImageFormat;
  /** Resize originals to fit within these dimensions */
  maxWidth?: number;
  maxHeight?: number;
  /** Resize mode for the original. Defaults to 'inside' */
  fit?: FitMode;
  /** Remove EXIF/metadata and auto-rotate by EXIF orientation */
  stripMetadata: boolean;
  /** Compression quality (1-100) per output format */
  quality: Partial<Record<ImageFormat, number>>;
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
