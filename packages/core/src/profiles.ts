import type { EditorProfile, EditorProfileOverrides, HtmlPolicy } from './types.js';

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function validateProfile(profile: EditorProfile): void {
  if (!profile.id.trim()) throw new Error('Editor profile id is required.');
  if (!profile.label.trim()) throw new Error('Editor profile label is required.');
  if (!profile.aspectRatios.length) throw new Error(`Editor profile ${profile.id} must define at least one viewport.`);
  const ids = profile.aspectRatios.map((option) => option.id);
  if (new Set(ids).size !== ids.length) throw new Error(`Editor profile ${profile.id} contains duplicate viewport ids.`);
  if (!profile.aspectRatios.some((option) => option.id === profile.defaultAspectRatioId)) {
    throw new Error(`Default viewport ${profile.defaultAspectRatioId} does not exist in editor profile ${profile.id}.`);
  }
  for (const option of profile.aspectRatios) {
    if (!option.id.trim() || option.width <= 0 || option.height <= 0) {
      throw new Error(`Editor profile ${profile.id} contains an invalid viewport.`);
    }
  }
}

export function defineEditorProfile(profile: EditorProfile): EditorProfile {
  const normalized: EditorProfile = {
    ...profile,
    html: {
      ...profile.html,
      allowedTags: unique(profile.html.allowedTags.map((value) => value.toLowerCase())),
      allowedAttributes: unique(profile.html.allowedAttributes.map((value) => value.toLowerCase())),
      allowedCssProperties: unique(profile.html.allowedCssProperties.map((value) => value.toLowerCase())),
      allowedProtocols: unique(profile.html.allowedProtocols.map((value) => value.toLowerCase()))
    },
    capabilities: { ...profile.capabilities },
    aspectRatios: profile.aspectRatios.map((option) => ({ ...option }))
  };
  validateProfile(normalized);
  return normalized;
}

export function extendEditorProfile(base: EditorProfile, overrides: EditorProfileOverrides): EditorProfile {
  return defineEditorProfile({
    ...base,
    ...overrides,
    html: { ...base.html, ...overrides.html },
    capabilities: { ...base.capabilities, ...overrides.capabilities },
    aspectRatios: overrides.aspectRatios ?? base.aspectRatios
  });
}

const commonTags = [
  'html', 'head', 'body', 'title', 'meta', 'link', 'style',
  'main', 'header', 'footer', 'section', 'article', 'aside', 'nav', 'div',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'strong', 'em',
  'b', 'i', 'u', 's', 'small', 'code', 'mark', 'blockquote', 'br', 'hr', 'ul', 'ol', 'li', 'a',
  'img', 'picture', 'source', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'colgroup', 'col'
] as const;

const commonAttributes = [
  'id', 'class', 'style', 'title', 'lang', 'role', 'href', 'target', 'rel', 'src',
  'srcset', 'sizes', 'alt', 'width', 'height', 'loading', 'decoding',
  'colspan', 'rowspan', 'align', 'valign', 'bgcolor', 'border', 'cellpadding',
  'cellspacing', 'charset', 'name', 'content', 'http-equiv', 'media', 'type'
] as const;

const commonCssProperties = [
  'display', 'position', 'top', 'right', 'bottom', 'left', 'z-index',
  'overflow', 'overflow-x', 'overflow-y', 'box-sizing',
  'width', 'min-width', 'max-width', 'height', 'min-height', 'max-height', 'aspect-ratio',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'gap', 'row-gap', 'column-gap', 'flex', 'flex-direction', 'flex-wrap',
  'align-items', 'align-content', 'align-self', 'justify-content',
  'justify-items', 'justify-self', 'grid-template-columns', 'grid-template-rows',
  'grid-column', 'grid-row', 'order', 'font-family', 'font-size', 'font-style',
  'font-weight', 'line-height', 'letter-spacing', 'text-align',
  'text-decoration', 'text-transform', 'white-space', 'color', 'background',
  'background-color', 'background-image', 'background-size',
  'background-position', 'border', 'border-width', 'border-style',
  'border-color', 'border-radius', 'border-top-left-radius',
  'border-top-right-radius', 'border-bottom-right-radius',
  'border-bottom-left-radius', 'box-shadow', 'opacity', 'object-fit',
  'object-position', 'transform', 'transform-origin'
] as const;

const baseHtmlPolicy: HtmlPolicy = {
  allowedTags: commonTags,
  allowedAttributes: commonAttributes,
  allowedCssProperties: commonCssProperties,
  allowedProtocols: ['http:', 'https:', 'mailto:', 'tel:', 'data:', 'blob:'],
  allowDataAttributes: true,
  allowAriaAttributes: true
};

const baseCapabilities = {
  editText: true,
  editStyles: true,
  insertImages: true,
  replaceImages: true,
  dragElements: true,
  resizeElements: true,
  duplicateElements: true,
  deleteElements: true,
  importHtml: true,
  editSource: true
};

export const webProfile: EditorProfile = defineEditorProfile({
  id: 'web',
  label: 'Responsive web',
  description: 'Responsive documents that preserve normal layout flow.',
  html: baseHtmlPolicy,
  capabilities: {
    ...baseCapabilities,
    dragElements: false
  },
  aspectRatios: [
    { id: 'desktop', label: 'Desktop', width: 1200, height: 760 },
    { id: 'tablet', label: 'Tablet', width: 768, height: 900 },
    { id: 'mobile', label: 'Mobile', width: 390, height: 844 }
  ],
  defaultAspectRatioId: 'desktop',
  fidelity: 'balanced'
});

export const slidesProfile: EditorProfile = defineEditorProfile({
  id: 'slides',
  label: 'HTML slides',
  description: 'Fixed-ratio canvases with direct manipulation.',
  html: {
    ...baseHtmlPolicy,
    allowedTags: [...commonTags, 'deck-stage']
  },
  capabilities: baseCapabilities,
  aspectRatios: [
    { id: '16-9', label: '16:9', width: 1600, height: 900 },
    { id: '4-3', label: '4:3', width: 1024, height: 768 },
    { id: 'square', label: '1:1', width: 1080, height: 1080 }
  ],
  defaultAspectRatioId: '16-9',
  fidelity: 'balanced'
});

export const emailProfile: EditorProfile = defineEditorProfile({
  id: 'email',
  label: 'HTML email',
  description: 'Table-preserving editing in realistic desktop and mobile inbox viewports.',
  html: {
    ...baseHtmlPolicy,
    allowedTags: [...commonTags, 'center'],
    allowedCssProperties: commonCssProperties.filter(
      (property) => !['position', 'top', 'right', 'bottom', 'left', 'z-index', 'transform'].includes(property)
    )
  },
  capabilities: {
    ...baseCapabilities,
    dragElements: false
  },
  aspectRatios: [
    { id: 'email-desktop', label: 'Desktop', width: 800, height: 900 },
    { id: 'email-mobile', label: 'Mobile', width: 390, height: 844 }
  ],
  defaultAspectRatioId: 'email-desktop',
  fidelity: 'preserve'
});

export const editorProfiles = {
  email: emailProfile,
  slides: slidesProfile,
  web: webProfile
};
