import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import sharp from 'sharp';

import { InvalidImageException } from '../src/exceptions.js';
import { sanitizeSvg } from '../src/svg_sanitizer.js';

const svg = (content: string) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80" viewBox="0 0 100 80">${content}</svg>`,
  );

test('removes unsafe SVG content while retaining metadata when requested', () => {
  const input = svg(
    '<metadata>private metadata</metadata><script>alert(1)</script><path d="M0 0h100v80H0z" onload="alert(1)" fill="red"/><image href="https://example.com/tracker.png"/><use href="https://example.com/icon.svg#icon"/><path fill="url(https://example.com/filter.svg#filter)"/>',
  );
  const sanitized = sanitizeSvg(input, false).toString();
  const metadataPreserved = sanitizeSvg(input, true).toString();

  assert.match(sanitized, /<path/);
  assert.match(sanitized, /fill="red"/);
  assert.doesNotMatch(sanitized, /metadata|<script|onload|example\.com|<image/i);
  assert.match(metadataPreserved, /private metadata/);
});

test('rejects input without an SVG root', () => {
  assert.throws(() => sanitizeSvg(Buffer.from('<html>not an SVG</html>'), false), {
    constructor: InvalidImageException,
    message: 'SVG does not contain a valid SVG root',
  });
});

test('preserves SVG appearance when sanitizing', async () => {
  for (const file of ['keepassxc.svg', 'dev.eden_emu.eden.svg']) {
    const input = await readFile(new URL(`./images/${file}`, import.meta.url));
    const sanitized = sanitizeSvg(input, false);
    const originalPixels = await sharp(input)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const sanitizedPixels = await sharp(sanitized)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    assert.deepEqual(
      sanitizedPixels.info,
      originalPixels.info,
      `${file}: raster dimensions changed`,
    );
    assert.equal(
      Buffer.compare(sanitizedPixels.data, originalPixels.data),
      0,
      `${file}: raster appearance changed`,
    );
  }
});
