export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'gif' | 'tiff'

export type FitMode = 'cover' | 'contain' | 'fill' | 'inside' | 'outside'

export interface ThumbnailConfig {
  width?: number
  height?: number
  fit?: FitMode
  /** Output format. Defaults to the format of the processed original */
  format?: ImageFormat
  /** Compression quality 1-100. Defaults to the format quality setting */
  quality?: number
}

export interface ImageConfig {
  /** Drive disk used for storage. Defaults to the Drive default disk */
  disk?: string
  /** Directory (key prefix) inside the disk */
  directory: string
  /** File visibility passed to Drive */
  visibility: 'public' | 'private'
  /** Max upload size in bytes */
  maxFileSize: number
  /** Accepted input formats */
  allowedFormats: ImageFormat[]
  /** Convert every upload to this format (e.g. 'webp') */
  convertTo?: ImageFormat
  /** Downscale originals larger than this (never enlarges) */
  maxWidth?: number
  maxHeight?: number
  /** Remove EXIF/metadata and auto-rotate by EXIF orientation */
  stripMetadata: boolean
  /** Compression quality (1-100) per output format */
  quality: Partial<Record<ImageFormat, number>>
  /** Named thumbnails generated for every upload */
  thumbnails: Record<string, ThumbnailConfig>
  /** Name of the images table (thumbnails use `<table>_thumbnails`) */
  tableName: string
}

export interface ProcessedImage {
  buffer: Buffer
  format: ImageFormat
  mimeType: string
  extension: string
  width: number
  height: number
  size: number
}

export interface UploadOptions {
  userId?: number | string | null
  originalName?: string
  alt?: string | null
  visibility?: 'public' | 'private'
  metadata?: Record<string, unknown>
}
