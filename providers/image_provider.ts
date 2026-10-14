import type { ApplicationService } from '@adonisjs/core/types'
import { ImageService } from '../src/image_service.js'
import type { ImageConfig } from '../src/types.js'

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'image.manager': ImageService
  }
}

export default class ImageProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('image.manager', async (resolver) => {
      const config = this.app.config.get<ImageConfig>('image')
      const drive = (await resolver.make('drive.manager' as never)) as any
      return new ImageService(config, (name) => drive.use(name))
    })
  }
}
