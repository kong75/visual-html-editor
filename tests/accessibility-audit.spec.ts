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

test('passes automated accessibility audit for the visual editor', async ({ page }) => {
  await page.goto('/#/editor');
  await expect(page.getByTestId('visual-html-editor')).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
});

test('passes automated accessibility audit for the selected-element inspector', async ({ page }) => {
  await page.goto('/#/editor');
  await page.frameLocator('iframe[title="Visual HTML canvas"]').locator('h1').click();
  await expect(page.locator('.vhe-inspector__title code')).toHaveText('h1');
  await expectNoSeriousAccessibilityViolations(page);
});

test('passes automated accessibility audit for selected-text formatting', async ({ page }) => {
  await page.goto('/#/editor');
  const heading = page.frameLocator('iframe[title="Visual HTML canvas"]').locator('h1');
  await heading.click();
  await heading.press('Home');
  for (let index = 0; index < 12; index += 1) await heading.press('Shift+ArrowRight');
  await page.getByRole('button', { name: 'More text options' }).click();
  await expect(page.getByLabel('More selected text options')).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
});

test('passes automated accessibility audit for source mode', async ({ page }) => {
  await page.goto('/#/editor');
  await page.getByRole('button', { name: 'Source' }).click();
  await expect(page.getByLabel('HTML source')).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
});

test('passes automated accessibility audit for import confirmation', async ({ page }) => {
  await page.goto('/#/editor');
  await page.getByLabel('Import HTML file').setInputFiles({
    name: 'accessible-import.html',
    mimeType: 'text/html',
    buffer: Buffer.from('<!doctype html><html><body><h1>Accessible import</h1></body></html>')
  });
  await expect(page.getByRole('dialog', { name: 'Import accessible-import.html' })).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('passes automated accessibility audit for the controlled editor', async ({ page }) => {
  await page.goto('/#/controlled');
  await expect(page.getByTestId('visual-html-editor')).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
});

