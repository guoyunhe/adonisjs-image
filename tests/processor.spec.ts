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
  const config = defineConfig({ presets: { image: { convertTo: 'webp', maxWidth: 100 } } });
  const out = await processOriginal(await png(), resolveImagePreset(config));
  assert.equal(out.format, 'webp');
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
  assert.equal(out.format, 'jpeg');
  assert.deepEqual([out.width, out.height], [40, 40]);
});

test('preserves a sanitized SVG original', async () => {
  const input = svg(
    '<metadata>private metadata</metadata><script>alert(1)</script><path d="M0 0h100v80H0z" onload="alert(1)" fill="red"/><image href="https://example.com/tracker.png"/><use href="https://example.com/icon.svg#icon"/><path fill="url(https://example.com/filter.svg#filter)"/>',
  );
  const out = await processOriginal(input, resolveImagePreset(defineConfig()));
  const metadataPreserved = await processOriginal(
    input,
    resolveImagePreset(defineConfig({ presets: { image: { stripMetadata: false } } })),
  );
  const output = out.buffer.toString();

  assert.equal(out.format, 'svg');
  assert.equal(out.extension, 'svg');
  assert.deepEqual([out.width, out.height], [100, 80]);
  assert.match(output, /<path/);
  assert.match(output, /fill="red"/);
  assert.doesNotMatch(output, /metadata|<script|onload|example\.com|<image/i);
  assert.match(metadataPreserved.buffer.toString(), /private metadata/);
});

test('rasterizes SVG thumbnails and converts SVG originals when configured', async () => {
  const input = svg('<circle cx="50" cy="40" r="30" fill="blue"/>');
  const config = resolveImagePreset(defineConfig());
  const thumbnail = await processThumbnail(input, { width: 20, height: 20 }, config, 'svg');
  const converted = await processOriginal(
    input,
    resolveImagePreset(defineConfig({ presets: { image: { convertTo: 'webp' } } })),
  );

  assert.equal(thumbnail.format, 'png');
  assert.deepEqual([thumbnail.width, thumbnail.height], [20, 20]);
  assert.equal(converted.format, 'webp');
});
