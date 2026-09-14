import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/#/editor');
  await expect(page.getByTestId('visual-html-editor')).toBeVisible();
});

test('pastes plain text without importing hostile clipboard HTML', async ({ page }) => {
  const heading = page.frameLocator('iframe[title="Visual HTML canvas"]').locator('h1');
  await heading.click();
  await heading.evaluate((element) => {
    const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', {
      value: {
        getData(type: string) {
          if (type === 'text/plain') return 'Safe pasted text';
          if (type === 'text/html') return '<img src=x onerror=alert(1)><script>alert(1)</script>';
          return '';
        }
      }
    });
    element.dispatchEvent(event);
  });
  await heading.press('Tab');

  await expect(heading).toContainText('Safe pasted text');
  await expect(page.frameLocator('iframe[title="Visual HTML canvas"]').locator('script, img[onerror]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Source' }).click();
  const source = await page.getByLabel('HTML source').inputValue();
  expect(source).not.toContain('<script');
  expect(source).not.toContain('onerror');
});

test('reports multiple hostile source constructs and blocks export', async ({ page }) => {
  await page.getByRole('button', { name: 'Source' }).click();
  await page.getByLabel('HTML source').fill(`<!doctype html><html><body>
    <script>alert(1)</script>
    <a href="javascript:alert(1)" onclick="alert(1)">Unsafe</a>
    <div style="background-image: url(javascript:alert(1))">Unsafe CSS</div>
  </body></html>`);
  await page.getByRole('button', { name: 'Apply' }).click();

  await expect(page.getByText(/validation issues$/)).toBeVisible();
  await page.getByRole('button', { name: 'Export HTML' }).click();
  await expect(page.locator('.vhe-notice')).toContainText(/Export blocked by \d+ policy issues/);
});

test('keeps the preview sandboxed after source replacement', async ({ page }) => {
  await page.getByRole('button', { name: 'Source' }).click();
  await page.getByLabel('HTML source').fill('<!doctype html><html><body><script>top.document.body.dataset.compromised="true"</script><a id="unsafe" href="javascript:alert(1)" onclick="alert(1)">Preview</a><iframe srcdoc="<script>alert(1)</script>"></iframe></body></html>');
  await page.getByRole('button', { name: 'Apply' }).click();

  await expect(page.getByTitle('Visual HTML canvas')).toHaveAttribute('sandbox', 'allow-same-origin allow-scripts');
  await expect(page.frameLocator('iframe[title="Visual HTML canvas"]').locator('script, iframe, object, embed')).toHaveCount(0);
  await expect(page.frameLocator('iframe[title="Visual HTML canvas"]').locator('#unsafe')).not.toHaveAttribute('href');
  await expect(page.frameLocator('iframe[title="Visual HTML canvas"]').locator('#unsafe')).not.toHaveAttribute('onclick');
  await expect(page.locator('body')).not.toHaveAttribute('data-compromised', 'true');
});
