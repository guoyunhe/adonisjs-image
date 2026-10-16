import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import type ConfigureCommand from '@adonisjs/core/commands/configure';

import { configure } from '../configure.js';
import { stubsRoot } from '../index.js';

test('resolves the source stubs directory', () => {
  assert.ok(existsSync(join(stubsRoot, 'config/image.stub')));
});

test('generates the image transformer with its descriptive filename', () => {
  const transformerStub = readFileSync(join(stubsRoot, 'transformers/image.stub'), 'utf8');

  assert.match(transformerStub, /app\/transformers\/image_transformer\.ts/);
  assert.match(
    transformerStub,
    /ImageTransformer\.transform\(this\.whenLoaded\(this\.resource\.thumbnails\)\)/,
  );
});

test('configures the package without checking Drive configuration', async () => {
  const generatedStubs: string[] = [];
  const providers: string[] = [];
  const command = {
    app: {
      generators: {
        createEntity: (name: string) => ({ name }),
      },
    },
    createCodemods: async () => ({
      makeUsingStub: async (_root: string, stubPath: string) => {
        generatedStubs.push(stubPath);
      },
      updateRcFile: async (callback: (rcFile: { addProvider(provider: string): void }) => void) => {
        callback({ addProvider: (provider) => providers.push(provider) });
      },
    }),
  } as unknown as ConfigureCommand;

  await configure(command);

  assert.deepEqual(generatedStubs, [
    'config/image.stub',
    'models/image.stub',
    'transformers/image.stub',
    'migrations/create_images_table.stub',
  ]);
  assert.deepEqual(providers, ['adonisjs-image/image_provider']);
});
