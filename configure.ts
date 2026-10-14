import type ConfigureCommand from '@adonisjs/core/commands/configure';

import { stubsRoot } from './index.js';

export async function configure(command: ConfigureCommand) {
  const codemods = await command.createCodemods();
  await codemods.makeUsingStub(stubsRoot, 'config/image.stub', {});
  await codemods.makeUsingStub(stubsRoot, 'models/image.stub', {});
  await codemods.makeUsingStub(stubsRoot, 'migrations/create_images_table.stub', {
    entity: command.app.generators.createEntity('images'),
    migration: {
      folder: 'database/migrations',
      fileName: `${new Date().getTime()}_create_images_table.ts`,
    },
  });
  await codemods.updateRcFile((rcFile: { addProvider(p: string): unknown }) => {
    rcFile.addProvider('adonisjs-image/image_provider');
  });
}
