import DOMPurify from 'isomorphic-dompurify';

import { InvalidImageException } from './exceptions.js';

const FORBIDDEN_SVG_TAGS = [
  'a',
  'animate',
  'animateMotion',
  'animateTransform',
  'audio',
  'embed',
  'feImage',
  'foreignObject',
  'iframe',
  'image',
  'object',
  'script',
  'set',
  'style',
  'video',
];

export function sanitizeSvg(input: Buffer, keepMetadata: boolean) {
  const blockExternalResources: Parameters<typeof DOMPurify.addHook>[1] = (_node, data) => {
    const name = data.attrName.toLowerCase();
    const value = data.attrValue.trim();
    if ((name === 'href' || name === 'xlink:href') && !/^#[\w.-]+$/.test(value)) {
      data.keepAttr = false;
    }
    for (const [, reference] of value.matchAll(/\burl\s*\(\s*(.*?)\s*\)/gi)) {
      const url = reference.trim().replace(/^(['"])(.*)\1$/, '$2');
      if (!/^#[\w.-]+$/.test(url)) {
        data.keepAttr = false;
        break;
      }
    }
  };
  DOMPurify.addHook('uponSanitizeAttribute', blockExternalResources);
  let sanitized: string;
  try {
    sanitized = DOMPurify.sanitize(input.toString('utf8'), {
      FORBID_CONTENTS: keepMetadata ? [] : ['metadata'],
      FORBID_TAGS: keepMetadata ? FORBIDDEN_SVG_TAGS : [...FORBIDDEN_SVG_TAGS, 'metadata'],
      USE_PROFILES: { svg: true, svgFilters: true },
    });
  } finally {
    DOMPurify.removeHook('uponSanitizeAttribute', blockExternalResources);
  }
  if (!/<svg(?:\s|>)/i.test(sanitized)) {
    throw new InvalidImageException('SVG does not contain a valid SVG root');
  }
  return Buffer.from(sanitized);
}
