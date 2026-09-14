import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/#/editor');
  await expect(page.getByTestId('visual-html-editor')).toBeVisible();
});

test('rejects non-image and oversized files without changing source', async ({ page }) => {
  const input = page.getByLabel('Choose image file');

  await input.setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
  await expect(page.locator('.vhe-notice')).toContainText('Please choose an image file.');
  await page.getByRole('button', { name: 'Dismiss' }).click();

  await input.setInputFiles({
    name: 'oversized.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1)
  });
  await expect(page.locator('.vhe-notice')).toContainText('Images must be 10 MB or smaller.');
  await page.getByRole('button', { name: 'Source' }).click();
  const source = await page.getByLabel('HTML source').inputValue();
  expect(source).not.toContain('notes.txt');
  expect(source).not.toContain('oversized.png');
});

test('surfaces host asset-adapter failures without inserting an image', async ({ page }) => {
  await page.goto('/#/controlled');
  // The previous route may remain mounted but hidden while this lazy route loads.
  await expect(page.getByTestId('controlled-controller')).toHaveText(/^vhe-editor-/);
  const input = page.getByLabel('Choose image file');
  await input.setInputFiles({ name: 'upload-fail.png', mimeType: 'image/png', buffer: Buffer.from('png') });
  await expect(page.locator('.vhe-notice')).toContainText('Upload service unavailable.');
  await expect(page.frameLocator('iframe[title="Visual HTML canvas"]').locator('img')).toHaveCount(0);
});

test('rejects invalid, oversized, and incompatible HTML imports', async ({ page }) => {
  const input = page.getByLabel('Import HTML file');
  await input.setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('<p>Not HTML</p>') });
  await expect(page.locator('.vhe-notice')).toContainText('Choose an .html or .htm file.');
  await page.getByRole('button', { name: 'Dismiss' }).click();

  await input.setInputFiles({
    name: 'oversized.html',
    mimeType: 'text/html',
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1)
  });
  await expect(page.locator('.vhe-notice')).toContainText('HTML files must be 5.0 MB or smaller.');

  await page.getByTestId('profile-slides').click();
  await page.getByLabel('Import HTML file').setInputFiles({
    name: 'not-a-deck.html',
    mimeType: 'text/html',
    buffer: Buffer.from('<!doctype html><html><body><h1>Standalone page</h1></body></html>')
  });
  await expect(page.locator('.vhe-notice')).toContainText('No <deck-stage> element was found.');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

async function makeControlledDocumentDirty(page: import('@playwright/test').Page) {
  await page.goto('/#/controlled');
  const heading = page.frameLocator('iframe[title="Visual HTML canvas"]').locator('h1');
  await heading.click();
  await heading.fill('Unsaved host-controlled value.');
  await heading.press('Tab');
  await expect(page.getByTestId('controlled-dirty')).toHaveText('dirty');
  return heading;
}

test('rejects an external replacement when controlled content is dirty', async ({ page }) => {
  const heading = await makeControlledDocumentDirty(page);
  await page.getByRole('button', { name: 'Reject external while dirty' }).click();
  await expect(page.getByTestId('controlled-external-result')).toHaveText('dirty-source-replacement');
  await expect(heading).toHaveText('Unsaved host-controlled value.');
  await expect(page.getByTestId('controlled-dirty')).toHaveText('dirty');
});

test('ignores an external replacement under replace-when-clean policy', async ({ page }) => {
  const heading = await makeControlledDocumentDirty(page);
  await page.getByRole('button', { name: 'Ignore external while dirty' }).click();
  await expect(page.getByTestId('controlled-external-result')).toHaveText('dirty');
  await expect(heading).toHaveText('Unsaved host-controlled value.');
  await expect(page.getByTestId('controlled-dirty')).toHaveText('dirty');
});
