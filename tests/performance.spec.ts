import { expect, test } from '@playwright/test';

test('keeps a large generated document responsive within a browser budget', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/#/editor');
  await page.getByTestId('profile-web').click();
  const cards = Array.from({ length: 200 }, (_, index) => `
    <article id="card-${index}" style="padding:16px;border:1px solid #ddd">
      <h2>Generated section ${index}</h2><p>AI-generated detail ${index} with <strong>structured content</strong>.</p>
    </article>`).join('');
  const html = `<!doctype html><html><head><style>.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}</style></head><body><main class="grid">${cards}</main></body></html>`;

  await page.getByRole('button', { name: 'Source' }).click();
  await page.getByLabel('HTML source').fill(html);
  const loadStarted = Date.now();
  await page.getByRole('button', { name: 'Apply' }).click();
  const articles = page.frameLocator('iframe[title="Visual HTML canvas"]').locator('article');
  await expect(articles).toHaveCount(200, { timeout: 15_000 });
  expect(Date.now() - loadStarted).toBeLessThan(12_000);

  const selectionStarted = Date.now();
  await page.frameLocator('iframe[title="Visual HTML canvas"]').locator('#card-199 h2').click();
  await expect(page.locator('.vhe-inspector__title code')).toHaveText('h2');
  expect(Date.now() - selectionStarted).toBeLessThan(3_000);
});
