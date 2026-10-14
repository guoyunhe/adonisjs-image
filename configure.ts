import type ConfigureCommand from '@adonisjs/core/commands/configure';

import { stubsRoot } from './index.js';

function addImport(
  sourceFile: {
    getImportDeclarations(): {
      getModuleSpecifierValue(): string;
      isTypeOnly(): boolean;
      getNamedImports(): { getName(): string }[];
      addNamedImport(name: string): unknown;
    }[];
    addImportDeclaration(options: {
      moduleSpecifier: string;
      namedImports: string[];
      isTypeOnly?: boolean;
    }): unknown;
  },
  moduleSpecifier: string,
  name: string,
  isTypeOnly = false,
) {
  const declaration = sourceFile
    .getImportDeclarations()
    .find(
      (item) =>
        item.getModuleSpecifierValue() === moduleSpecifier && item.isTypeOnly() === isTypeOnly,
    );

  if (declaration) {
    if (!declaration.getNamedImports().some((item) => item.getName() === name)) {
      declaration.addNamedImport(name);
    }
    return;
  }

  sourceFile.addImportDeclaration({ moduleSpecifier, namedImports: [name], isTypeOnly });
}

async function addUserAvatarRelation(
  command: ConfigureCommand,
  codemods: Awaited<ReturnType<ConfigureCommand['createCodemods']>>,
) {
  const project = await codemods.getTsMorphProject();
  if (!project) {
    throw new Error('Generating the User.avatar relation requires @adonisjs/assembler');
  }

  const userFile = project.addSourceFileAtPathIfExists(command.app.makePath('app/models/user.ts'));
  const userModel = userFile?.getClass('User');
  if (!userFile || !userModel) {
    throw new Error(
      'Cannot add User.avatar relation: app/models/user.ts with a User class was not found',
    );
  }

  const avatarProperty = userModel.getProperty('avatar');
  if (avatarProperty) {
    const type = avatarProperty.getTypeNode()?.getText();
    if (avatarProperty.getDecorator('belongsTo') && type === 'BelongsTo<typeof Image>') return;
    throw new Error('Cannot add User.avatar relation: app/models/user.ts already defines avatar');
  }

  addImport(userFile, '@adonisjs/lucid/orm', 'belongsTo');
  addImport(userFile, '@adonisjs/lucid/types/relations', 'BelongsTo', true);
  addImport(userFile, '#models/image', 'Image');
  userModel.addProperty({
    name: 'avatar',
    type: 'BelongsTo<typeof Image>',
    decorators: [{ name: 'belongsTo', arguments: ['() => Image'] }],
  });
  await userFile.save();
}

export async function configure(command: ConfigureCommand) {
  if (!command.app.config.get('drive')) {
    command.logger.warning(
      'The Drive package is not configured. Configure @adonisjs/drive before setting up adonisjs-image.',
    );
    return;
  }

  const codemods = await command.createCodemods();
  await addUserAvatarRelation(command, codemods);
  await codemods.makeUsingStub(stubsRoot, 'config/image.stub', {});
  await codemods.makeUsingStub(stubsRoot, 'models/image.stub', {});
  const migrationTimestamp = new Date().getTime();
  await codemods.makeUsingStub(stubsRoot, 'migrations/create_images_table.stub', {
    entity: command.app.generators.createEntity('images'),
    migration: {
      folder: 'database/migrations',
      fileName: `${migrationTimestamp}_create_images_table.ts`,
    },
  });
  await codemods.makeUsingStub(stubsRoot, 'migrations/add_avatar_to_users.stub', {
    entity: command.app.generators.createEntity('add_avatar_to_users'),
    migration: {
      folder: 'database/migrations',
      fileName: `${migrationTimestamp + 1}_add_avatar_to_users.ts`,
    },
  });
  await codemods.updateRcFile((rcFile: { addProvider(p: string): unknown }) => {
    rcFile.addProvider('adonisjs-image/image_provider');
  });
}
