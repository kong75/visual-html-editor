import { expect, test } from '@playwright/test';

async function stabilizeVisuals(page: import('@playwright/test').Page) {
  await page.addStyleTag({ content: `
    *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
  ` });
}

test('landing identity and hero artwork remain visually coherent', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.hero-art img')).toHaveJSProperty('naturalWidth', 1536);
  await stabilizeVisuals(page);
  await expect(page.locator('.landing-hero')).toHaveScreenshot('landing-hero.png', {
    animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.02
  });
});

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Visual baselines are maintained in the CI Chromium project; interaction behavior remains cross-browser.');
});

test('landing illustration visual structure remains stable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await stabilizeVisuals(page);
  await expect(page.locator('.landing-motion__window')).toHaveScreenshot('landing-illustration.png', {
    animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.04
  });
});

test('landing slide demo keeps its presentation layout', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: /Learning slides/ }).click();
  await page.getByRole('button', { name: '03 Resize', exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.landing-motion__window')).toHaveScreenshot('landing-slide-demo.png', { maxDiffPixelRatio: 0.02 });
});

test('landing web demo keeps its split hero and card layout', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: /Web content/ }).click();
  await page.getByRole('button', { name: '02 Style', exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.landing-motion__window')).toHaveScreenshot('landing-web-demo.png', { maxDiffPixelRatio: 0.02 });
});

test('editor toolbar visual structure remains stable', async ({ page }) => {
  await page.goto('/#/editor');
  await stabilizeVisuals(page);
  await expect(page.locator('.vhe-toolbar')).toHaveScreenshot('editor-toolbar.png', {
    animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.04
  });
});

test('editor workspace keeps navigation and properties on opposite sides', async ({ page }) => {
  await page.goto('/#/editor');
  await page.frameLocator('iframe[title="Visual HTML canvas"]').locator('h1').click();
  const navigator = await page.locator('.vhe-navigator').boundingBox();
  const stage = await page.locator('.vhe-stage').boundingBox();
  const inspector = await page.locator('.vhe-inspector').boundingBox();
  expect(navigator).not.toBeNull();
  expect(stage).not.toBeNull();
  expect(inspector).not.toBeNull();
  expect(navigator!.x + navigator!.width).toBeLessThanOrEqual(stage!.x + 1);
  expect(stage!.x + stage!.width).toBeLessThanOrEqual(inspector!.x + 1);
  await stabilizeVisuals(page);
  await expect(page.locator('.vhe-layout')).toHaveScreenshot('editor-split-workspace.png', {
    animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.04
  });
});

test('selected element inspector visual structure remains stable', async ({ page }) => {
  await page.goto('/#/editor');
  await page.frameLocator('iframe[title="Visual HTML canvas"]').locator('h1').click();
  await expect(page.locator('.vhe-inspector__title code')).toHaveText('h1');
  await stabilizeVisuals(page);
  await expect(page.locator('.vhe-inspector')).toHaveScreenshot('selected-text-inspector.png', {
    animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.04
  });
});

test('inline selected-text toolbar remains visually coherent', async ({ page }) => {
  await page.goto('/#/editor');
  const heading = page.frameLocator('iframe[title="Visual HTML canvas"]').locator('h1');
  await heading.click();
  await heading.press('Home');
  for (let index = 0; index < 12; index += 1) await heading.press('Shift+ArrowRight');
  const toolbar = page.getByRole('region', { name: 'Selected text formatting' });
  await expect(toolbar).toBeVisible();
  await page.getByRole('button', { name: 'More text options' }).click();
  await stabilizeVisuals(page);
  await expect(toolbar).toHaveScreenshot('inline-selected-text-toolbar.png', {
    animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.04
  });
  await expect(page.getByLabel('More selected text options')).toHaveScreenshot('inline-selected-text-more.png', {
    animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.04
  });
});

test('HTML import confirmation remains visually coherent', async ({ page }) => {
  await page.goto('/#/editor');
  await page.getByLabel('Import HTML file').setInputFiles({
    name: 'generated-email.html',
    mimeType: 'text/html',
    buffer: Buffer.from('<!doctype html><html><body><h1>Generated email</h1></body></html>')
  });
  const dialog = page.getByRole('dialog', { name: 'Import generated-email.html' });
  await expect(dialog).toBeVisible();
  await stabilizeVisuals(page);
  await expect(dialog.locator('.vhe-import-dialog')).toHaveScreenshot('html-import-dialog.png', {
    animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.04
  });
});
