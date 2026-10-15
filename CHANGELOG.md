# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

### Tests

- Check SVG appearance preservation across all SVG fixtures.

## 0.3.0 - 2026-10-15

### Changed

- Store images directly under the configured directory without date-based path segments.

## 0.2.0 - 2026-10-15

### Changed

- Rename the `stripMetadata` preset option to `keepMetadata`, defaulting to `false`; presets such as `photo` can opt in to preserving metadata.
- Allow compression quality to be configured as one value for all formats or as per-format values.
- Replace `convertTo` with `format`, supporting one output format for all uploads or per-input-format mappings.
- Rename original image resize limits from `maxWidth`/`maxHeight` to `width`/`height`.

### Fixed

- Preserve SVG appearance by retaining safe inline styles and local URL references during sanitization.

## 0.1.0 - 2026-10-15

### Added

- Add image upload, processing, thumbnail generation, and storage with AdonisJS Drive.
- Add Lucid image records and generated setup files for configuration, models, migrations, and transformers.
- Add named processing presets, format conversion, resizing, compression, metadata stripping, and sanitized SVG support.
- Add public and signed image URL handling.
- Add Vine validator examples for application-level upload size and extension rules.
- Add an image transformer that returns image and thumbnail URLs without exposing storage details.
