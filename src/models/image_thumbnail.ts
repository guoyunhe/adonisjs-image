import { BaseModel, column } from '@adonisjs/lucid/orm';
import type { DateTime } from 'luxon';

export class ImageThumbnail extends BaseModel {
  static table = 'images_thumbnails';

  @column({ isPrimary: true })
  declare id: number;

  @column()
  declare imageId: number;

  @column()
  declare name: string;

  @column()
  declare path: string;

  @column()
  declare format: string;

  @column()
  declare mimeType: string;

  @column()
  declare size: number;

  @column()
  declare width: number;

  @column()
  declare height: number;

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime;
}
