import { pathToFileURL } from 'node:url';

import { configProvider } from '@adonisjs/core';
import type { ApplicationService } from '@adonisjs/core/types';

import { ImageService } from '../src/image_service.js';
import type { ImageConfig } from '../src/types.js';

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    'image.manager': ImageService;
  }
}

export default class ImageProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('image.manager', async (resolver) => {
      const config = this.app.config.get<ImageConfig>('image');
      const driveConfig = await configProvider.resolve<{ config: { default: string } }>(
        this.app,
        this.app.config.get('drive'),
      );
      if (!driveConfig?.config.default) {
        throw new Error('Unable to resolve the default Drive disk');
      }
      const drive = (await resolver.make('drive.manager' as never)) as any;
      const imageModulePath = pathToFileURL(this.app.makePath('app/models/image.js')).href;
      const { Image } = await import(imageModulePath);
      return new ImageService(config, (name) => drive.use(name), Image, driveConfig.config.default);
    });
  }
}
