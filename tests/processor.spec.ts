import assert from 'node:assert/strict';
import { test } from 'node:test';

import sharp from 'sharp';

import { defineConfig, resolveImagePreset } from '../src/define_config.js';
import { processOriginal, processThumbnail, InvalidImageException } from '../src/processor.js';

const png = (w = 400, h = 200) =>
  sharp({ create: { width: w, height: h, channels: 3, background: '#f00' } })
    .png()
    .toBuffer();

test('converts and resizes originals', async () => {
  const config = defineConfig({ presets: { image: { convertTo: 'webp', maxWidth: 100 } } });
  const out = await processOriginal(await png(), resolveImagePreset(config));
  assert.equal(out.format, 'webp');
  assert.equal(out.mimeType, 'image/webp');
  assert.equal(out.width, 100);
  assert.equal(out.height, 50);
  assert.equal(out.size, out.buffer.length);
});

test('does not enlarge', async () => {
  const config = defineConfig({ presets: { image: { maxWidth: 500 } } });
  const out = await processOriginal(await png(50, 50), resolveImagePreset(config));
  assert.equal(out.width, 50);
});

test('does not enlarge images in cover mode', async () => {
  const config = defineConfig({
    presets: { image: { maxWidth: 128, maxHeight: 128, fit: 'cover' } },
  });
  const out = await processOriginal(await png(50, 50), resolveImagePreset(config));
  assert.deepEqual([out.width, out.height], [50, 50]);
});

test('resolves image presets and crops avatars to a square', async () => {
  const config = defineConfig({
    presets: {
      image: {
        maxWidth: 2560,
        maxHeight: 2560,
        quality: { jpeg: 80, webp: 75 },
      },
      avatar: {
        maxWidth: 128,
        maxHeight: 128,
        fit: 'cover',
        convertTo: 'webp',
        quality: { webp: 95 },
      },
    },
  });
  const imagePreset = resolveImagePreset(config);
  const avatarPreset = resolveImagePreset(config, 'avatar');
  const avatar = await processOriginal(await png(), avatarPreset);

  assert.equal(config.default, 'image');
  assert.equal(imagePreset.maxWidth, 2560);
  assert.equal(avatarPreset.quality.jpeg, 80);
  assert.equal(avatarPreset.quality.webp, 95);
  assert.equal(avatar.format, 'webp');
  assert.deepEqual([avatar.width, avatar.height], [128, 128]);
  assert.throws(() => resolveImagePreset(config, 'missing'), /not configured/);
});

test('rejects disallowed formats, invalid files and big files', async () => {
  const disallowedConfig = defineConfig({
    presets: { image: { allowedFormats: ['jpeg'] } },
  });
  const fileSizeConfig = defineConfig({
    presets: { image: { maxFileSize: 10 } },
  });
  await assert.rejects(
    processOriginal(await png(), resolveImagePreset(disallowedConfig)),
    InvalidImageException,
  );
  await assert.rejects(
    processOriginal(Buffer.from('nope'), resolveImagePreset(defineConfig())),
    InvalidImageException,
  );
  await assert.rejects(
    processOriginal(await png(), resolveImagePreset(fileSizeConfig)),
    InvalidImageException,
  );
});

test('generates thumbnails', async () => {
  const config = resolveImagePreset(defineConfig());
  const out = await processThumbnail(
    await png(),
    { width: 40, height: 40, format: 'jpeg' },
    config,
    'png',
  );
  assert.equal(out.format, 'jpeg');
  assert.deepEqual([out.width, out.height], [40, 40]);
});
