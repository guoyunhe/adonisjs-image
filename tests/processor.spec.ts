import assert from 'node:assert/strict';
import { test } from 'node:test';

import sharp from 'sharp';

import { defineConfig, resolveImagePreset } from '../src/define_config.js';
import { processOriginal, processThumbnail, InvalidImageException } from '../src/processor.js';

const png = (w = 400, h = 200) =>
  sharp({ create: { width: w, height: h, channels: 3, background: '#f00' } })
    .png()
    .toBuffer();

const svg = (content: string) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80" viewBox="0 0 100 80">${content}</svg>`,
  );

test('converts and resizes originals', async () => {
  const config = defineConfig({ presets: { image: { format: 'webp', width: 100 } } });
  const out = await processOriginal(await png(), resolveImagePreset(config));
  assert.equal(out.format, 'webp');
  assert.equal(out.width, 100);
  assert.equal(out.height, 50);
  assert.equal(out.size, out.buffer.length);
});

test('does not enlarge', async () => {
  const config = defineConfig({ presets: { image: { width: 500 } } });
  const out = await processOriginal(await png(50, 50), resolveImagePreset(config));
  assert.equal(out.width, 50);
});

test('does not enlarge images in cover mode', async () => {
  const config = defineConfig({
    presets: { image: { width: 128, height: 128, fit: 'cover' } },
  });
  const out = await processOriginal(await png(50, 50), resolveImagePreset(config));
  assert.deepEqual([out.width, out.height], [50, 50]);
});

test('resolves image presets and crops avatars to a square', async () => {
  const config = defineConfig({
    presets: {
      image: {
        width: 2560,
        height: 2560,
        quality: { jpeg: 80, webp: 75 },
      },
      avatar: {
        width: 128,
        height: 128,
        fit: 'cover',
        format: 'webp',
        quality: { webp: 95 },
      },
    },
  });
  const imagePreset = resolveImagePreset(config);
  const avatarPreset = resolveImagePreset(config, 'avatar');
  const avatar = await processOriginal(await png(), avatarPreset);

  assert.equal(config.default, 'image');
  assert.equal(imagePreset.width, 2560);
  assert.equal(avatarPreset.quality.jpeg, 80);
  assert.equal(avatarPreset.quality.webp, 95);
  assert.equal(avatar.format, 'webp');
  assert.deepEqual([avatar.width, avatar.height], [128, 128]);
  assert.throws(() => resolveImagePreset(config, 'missing'), /not configured/);
});

test('converts all input formats with a string and only mapped formats with an object', async () => {
  const source = await png();
  const tiff = await sharp({ create: { width: 40, height: 20, channels: 3, background: '#f00' } })
    .tiff()
    .toBuffer();
  const jpeg = await sharp({ create: { width: 40, height: 20, channels: 3, background: '#f00' } })
    .jpeg()
    .toBuffer();
  const inputSvg = svg('<circle cx="50" cy="40" r="30" fill="blue"/>');

  const mapped = resolveImagePreset(
    defineConfig({ presets: { image: { format: { png: 'webp', tiff: 'webp', svg: 'webp' } } } }),
  );
  assert.equal((await processOriginal(source, mapped)).format, 'webp');
  assert.equal((await processOriginal(tiff, mapped)).format, 'webp');
  assert.equal((await processOriginal(inputSvg, mapped)).format, 'webp');
  assert.equal((await processOriginal(jpeg, mapped)).format, 'jpeg');

  const allFormats = resolveImagePreset(defineConfig({ presets: { image: { format: 'webp' } } }));
  assert.equal((await processOriginal(jpeg, allFormats)).format, 'webp');
});

test('supports one quality value for all formats and merges per-format overrides', async () => {
  const config = defineConfig({
    presets: {
      image: { quality: 72 },
      avatar: { quality: { webp: 90 } },
    },
  });
  const imagePreset = resolveImagePreset(config);
  const avatarPreset = resolveImagePreset(config, 'avatar');

  assert.equal(imagePreset.quality, 72);
  assert.deepEqual(avatarPreset.quality, {
    jpeg: 72,
    png: 72,
    webp: 90,
    avif: 72,
    gif: 72,
    tiff: 72,
  });
  const out = await processOriginal(await png(), imagePreset);
  assert.equal(out.format, 'png');
});

test('rejects invalid files', async () => {
  await assert.rejects(
    processOriginal(Buffer.from('nope'), resolveImagePreset(defineConfig())),
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
  assert.ok(out);
  assert.equal(out.format, 'jpeg');
  assert.deepEqual([out.width, out.height], [40, 20]);
});

test('defaults thumbnail fit to inside', async () => {
  const config = resolveImagePreset(defineConfig());
  const source = await png(100, 50);
  const inside = await processThumbnail(source, { width: 40, height: 40 }, config, 'png');
  const cover = await processThumbnail(
    source,
    { width: 40, height: 40, fit: 'cover' },
    config,
    'png',
  );

  assert.ok(inside);
  assert.deepEqual([inside.width, inside.height], [40, 20]);
  assert.ok(cover);
  assert.deepEqual([cover.width, cover.height], [40, 40]);
});

test('skips thumbnails larger than the source in a requested dimension', async () => {
  const config = resolveImagePreset(defineConfig());
  const out = await processThumbnail(await png(40, 100), { width: 50, height: 100 }, config, 'png');
  assert.equal(out, undefined);
});

test('enlarges SVG thumbnails to the requested dimensions', async () => {
  const config = resolveImagePreset(defineConfig());
  const thumbnail = await processThumbnail(
    svg('<circle cx="50" cy="40" r="30" fill="blue"/>'),
    { width: 200, height: 200 },
    config,
    'svg',
  );

  assert.ok(thumbnail);
  assert.deepEqual([thumbnail.width, thumbnail.height], [200, 160]);
});

test('rasterizes SVG thumbnails and converts SVG originals when configured', async () => {
  const input = svg('<circle cx="50" cy="40" r="30" fill="blue"/>');
  const config = resolveImagePreset(defineConfig());
  const thumbnail = await processThumbnail(input, { width: 20, height: 20 }, config, 'svg');
  const converted = await processOriginal(
    input,
    resolveImagePreset(defineConfig({ presets: { image: { format: 'webp' } } })),
  );

  assert.equal(thumbnail.format, 'png');
  assert.deepEqual([thumbnail.width, thumbnail.height], [20, 16]);
  assert.equal(converted.format, 'webp');
});
