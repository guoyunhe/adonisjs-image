import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import type { DateTime } from 'luxon'
import { ImageThumbnail } from './image_thumbnail.js'

export class Image extends BaseModel {
  static table = 'images'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number | null

  @column()
  declare disk: string | null

  @column()
  declare originalName: string | null

  @column()
  declare path: string

  @column()
  declare format: string

  @column()
  declare mimeType: string

  @column()
  declare size: number

  @column()
  declare width: number

  @column()
  declare height: number

  @column()
  declare hash: string

  @column()
  declare alt: string | null

  @column()
  declare visibility: 'public' | 'private'

  @column({
    prepare: (value) => (value ? JSON.stringify(value) : null),
    consume: (value) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  declare metadata: Record<string, unknown> | null

  @hasMany(() => ImageThumbnail)
  declare thumbnails: HasMany<typeof ImageThumbnail>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
