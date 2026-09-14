import { expect, test } from '@playwright/test';

test('selection and inspector feedback preserve the live canvas document', async ({ page }) => {
  await page.goto('/#/editor');
  const heading = page.frameLocator('iframe[title="Visual HTML canvas"]').locator('h1');
  await expect(heading).toBeVisible();
  const originalHeading = await heading.elementHandle();
  expect(originalHeading).not.toBeNull();

  await heading.click();
  await heading.press('Escape');
  await expect(page.locator('.vhe-inspector__title code')).toHaveText('h1');
  expect(await originalHeading!.evaluate((element) => element.isConnected)).toBe(true);

  const size = page.getByRole('textbox', { name: 'Size', exact: true });
  await size.fill('invalid-size');
  await size.press('Tab');
  await expect(page.locator('.vhe-notice[role="status"]')).toContainText('not valid for font-size');
  await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
  expect(await originalHeading!.evaluate((element) => element.isConnected)).toBe(true);
  await expect(heading).not.toHaveAttribute('style', /invalid-size/);
  await originalHeading!.dispose();
});

test('flush commits active typing and read-only mode preserves focused inspection', async ({ page }) => {
  await page.goto('/#/controlled');
  const heading = page.frameLocator('iframe[title="Visual HTML canvas"]').locator('h1');
  await heading.click();
  await expect(heading).toHaveAttribute('contenteditable', 'true');
  await expect(page.frameLocator('iframe[title="Visual HTML canvas"]').locator('base')).toHaveAttribute('href', 'http://127.0.0.1:4173/fixtures/');
  await heading.fill('Flushed inline value');
  await page.getByRole('button', { name: 'Flush changes' }).click();
  await expect(page.getByTestId('controlled-flush')).toHaveText('latest clean value');
  await expect(page.getByTestId('controlled-changes')).toHaveText('1 changes');

  await page.getByRole('button', { name: 'Enable read-only' }).click();
  await heading.click();
  await expect(heading).not.toHaveAttribute('contenteditable', 'true');
  await expect(page.locator('.vhe-inspector__title code')).toHaveText('h1');
  await expect(page.getByRole('region', { name: 'Element compatibility' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
});

test('React text-selection API reports ranges and formats through the editor handle', async ({ page }) => {
  await page.goto('/#/controlled');
  const heading = page.frameLocator('iframe[title="Visual HTML canvas"]').locator('h1');
  await heading.click();
  await heading.press('Home');
  for (let index = 0; index < 9; index += 1) await heading.press('Shift+ArrowRight');
  await expect(page.getByTestId('controlled-text-selection')).toHaveText('0-9');
  await page.getByRole('button', { name: 'Style selection through API' }).click();
  await expect(heading.locator('span')).toHaveText('Generated');
  await expect(heading.locator('span')).toHaveCSS('color', 'rgb(124, 58, 237)');
  await expect(page.getByTestId('controlled-text-api')).toHaveText('0-9');
  await expect(page.getByTestId('controlled-text-selection')).toHaveText('0-9');
});
