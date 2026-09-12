import { expect, test } from '@playwright/test';

test('runs the packed React package in a clean consumer browser app', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('visual-html-editor')).toBeVisible();
  const heading = page.frameLocator('iframe[title="Visual HTML canvas"]').locator('h1');
  await expect(heading).toHaveText('Generated slide');
  await heading.click();
  await heading.fill('Packed package edits real HTML.');
  await heading.press('Tab');
  await page.getByRole('button', { name: 'Source' }).click();
  await expect(page.getByLabel('HTML source')).toContainText('Packed package edits real HTML.');
});
