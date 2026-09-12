import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

async function expectNoSeriousAccessibilityViolations(page: import('@playwright/test').Page) {
  await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
  const results = await new AxeBuilder({ page })
    .exclude('.landing-motion')
    .exclude('iframe')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const violations = results.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
  expect(violations, violations.map((violation) => `${violation.id}: ${violation.help}`).join('\n')).toEqual([]);
}

test('passes automated accessibility audit on the landing page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Make HTML feel alive/i })).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
});

test('passes automated accessibility audit for visual, source, and controlled editor states', async ({ page }) => {
  await page.goto('/#/editor');
  await expect(page.getByTestId('visual-html-editor')).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);

  await page.frameLocator('iframe[title="Visual HTML canvas"]').locator('h1').click();
  await expect(page.locator('.vhe-inspector__title code')).toHaveText('h1');
  await expectNoSeriousAccessibilityViolations(page);

  await page.getByRole('button', { name: 'Source' }).click();
  await expect(page.getByLabel('HTML source')).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);

  await page.getByRole('button', { name: 'Visual' }).click();
  await page.getByLabel('Import HTML file').setInputFiles({
    name: 'accessible-import.html',
    mimeType: 'text/html',
    buffer: Buffer.from('<!doctype html><html><body><h1>Accessible import</h1></body></html>')
  });
  await expect(page.getByRole('dialog', { name: 'Import accessible-import.html' })).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

  await page.goto('/#/controlled');
  await expect(page.getByTestId('visual-html-editor')).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
});

