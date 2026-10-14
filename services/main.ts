import app from '@adonisjs/core/services/app'
import type { ImageService } from '../src/image_service.js'

let image: ImageService

await app.booted(async () => {
  image = await app.container.make('image.manager')
})

export { image as default }
