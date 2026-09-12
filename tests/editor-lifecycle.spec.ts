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
