export type CompatibilityProfile = 'email' | 'slides' | 'web';

export interface CompatibilityFixture {
  id: string;
  path: string;
  profile: CompatibilityProfile;
  expectedTokens: readonly string[];
  textEdit: {
    elementId: string;
    replacement: string;
  };
  richText?: {
    elementId: string;
    selectedText: string;
  };
}

export const compatibilityFixtures: readonly CompatibilityFixture[] = [
  {
    id: 'ai-welcome-email',
    path: 'email/ai-welcome-email.html',
    profile: 'email',
    expectedTokens: ['<!--[if mso]>', '{{first_name}}', '{{cta_url}}'],
    textEdit: { elementId: 'fixture-title', replacement: 'Your next learning chapter is ready' },
    richText: { elementId: 'mixed-copy', selectedText: 'durable skills' }
  },
  {
    id: 'ai-product-deck',
    path: 'slides/ai-product-deck.html',
    profile: 'slides',
    expectedTokens: ['<deck-stage', '{{deck_title}}', '{{module_number}}'],
    textEdit: { elementId: 'fixture-title', replacement: 'Make the complex feel obvious' },
    richText: { elementId: 'mixed-copy', selectedText: 'dense ideas into a sequence' }
  },
  {
    id: 'ai-responsive-report',
    path: 'web/ai-responsive-report.html',
    profile: 'web',
    expectedTokens: ['@media (max-width: 720px)', '{{growth_rate}}', '{{quarter}}'],
    textEdit: { elementId: 'fixture-title', replacement: 'A precise view of product momentum' },
    richText: { elementId: 'mixed-copy', selectedText: 'support volume stayed nearly flat' }
  },
  {
    id: 'ai-rich-snippet',
    path: 'fragments/ai-rich-snippet.html',
    profile: 'web',
    expectedTokens: ['{{release_url}}', '[[owner_name]]', '&lt;%= generated_at %&gt;'],
    textEdit: { elementId: 'fixture-title', replacement: 'Highlights from this week' },
    richText: { elementId: 'mixed-copy', selectedText: 'three improvements' }
  }
];
