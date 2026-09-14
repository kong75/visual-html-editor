import { expect, test } from '@playwright/test';

const LARGE_DOCUMENT_LOAD_BUDGET_MS = 4_000;
// This end-to-end measurement includes Playwright protocol and shared CI runner
// scheduling time in addition to the editor update itself. Keep a meaningful
// regression ceiling without treating normal cross-browser CI variance as a
// product performance failure.
const SELECTION_RESPONSE_BUDGET_MS = 3_000;

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
  const apply = page.getByRole('button', { name: 'Apply' });
  await apply.evaluate((button) => {
    button.addEventListener('click', () => performance.mark('vhe-large-document-load-start'), { capture: true, once: true });
  });
  await apply.click();
  const articles = page.frameLocator('iframe[title="Visual HTML canvas"]').locator('article');
  await expect(articles).toHaveCount(200, { timeout: 5_000 });
  const loadDuration = await page.evaluate(() => performance.now() - performance.getEntriesByName('vhe-large-document-load-start').at(-1)!.startTime);
  expect(loadDuration, 'large-document load duration').toBeLessThan(LARGE_DOCUMENT_LOAD_BUDGET_MS);

  const heading = page.frameLocator('iframe[title="Visual HTML canvas"]').locator('#card-199 h2');
  await heading.evaluate((element) => {
    element.addEventListener('click', () => performance.mark('vhe-selection-start'), { capture: true, once: true });
  });
  await heading.click();
  await expect(page.locator('.vhe-inspector__title code')).toHaveText('h2', { timeout: 1_000 });
  const selectionDuration = await heading.evaluate(() => performance.now() - performance.getEntriesByName('vhe-selection-start').at(-1)!.startTime);
  expect(selectionDuration, 'selection response duration').toBeLessThan(SELECTION_RESPONSE_BUDGET_MS);
});
