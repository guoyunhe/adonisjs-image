import assert from 'node:assert/strict';
import { test } from 'node:test';

import sharp from 'sharp';

import { defineConfig } from '../src/define_config.js';
import { processOriginal, processThumbnail, InvalidImageException } from '../src/processor.js';

const png = (w = 400, h = 200) =>
  sharp({ create: { width: w, height: h, channels: 3, background: '#f00' } })
    .png()
    .toBuffer();

test('converts and resizes originals', async () => {
  const config = defineConfig({ convertTo: 'webp', maxWidth: 100 });
  const out = await processOriginal(await png(), config);
  assert.equal(out.format, 'webp');
  assert.equal(out.mimeType, 'image/webp');
  assert.equal(out.width, 100);
  assert.equal(out.height, 50);
  assert.equal(out.size, out.buffer.length);
});

test('does not enlarge', async () => {
  const out = await processOriginal(await png(50, 50), defineConfig({ maxWidth: 500 }));
  assert.equal(out.width, 50);
});

test('rejects disallowed formats, invalid files and big files', async () => {
  await assert.rejects(
    processOriginal(await png(), defineConfig({ allowedFormats: ['jpeg'] })),
    InvalidImageException,
  );
  await assert.rejects(processOriginal(Buffer.from('nope'), defineConfig()), InvalidImageException);
  await assert.rejects(
    processOriginal(await png(), defineConfig({ maxFileSize: 10 })),
    InvalidImageException,
  );
});

test('generates thumbnails', async () => {
  const config = defineConfig();
  const out = await processThumbnail(
    await png(),
    { width: 40, height: 40, format: 'jpeg' },
    config,
    'png',
  );
  assert.equal(out.format, 'jpeg');
  assert.deepEqual([out.width, out.height], [40, 40]);
});
