import { expect, test } from '@playwright/test';

async function editSource(page: import('@playwright/test').Page, html: string) {
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  await page.getByLabel('HTML source').fill(html);
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/#/editor');
  await expect(page.getByTestId('visual-html-editor')).toBeVisible();
});

for (const [name, html] of [
  ['template URL', '<a href="javascript:alert(1)//{{ token }}">Link</a>'],
  ['body handler', '<body onload="alert(1)"><p>Text</p></body>'],
  ['meta refresh', '<meta http-equiv="refresh" content="0;url=https://example.com"><p>Text</p>'],
  ['stylesheet property', '<style>p { position: absolute }</style><p>Text</p>'],
  ['stylesheet import', '<style>@import "ftp://example.com/a.css";</style><p>Text</p>']
]) {
  test(`blocks export for ${name} after source replacement`, async ({ page }) => {
    const downloads: string[] = [];
    page.on('download', (download) => downloads.push(download.suggestedFilename()));
    await editSource(page, html);
    await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
    await expect(page.locator('.vhe-notice')).toContainText('Export blocked');
    expect(downloads).toEqual([]);
  });
}

test('reports incompatible slide styles instead of exporting a stale stylesheet', async ({ page }) => {
  await page.getByTestId('profile-slides').click();
  const deck = '<!doctype html><html><head><title>Style test</title><style>h1 { color: red }</style></head><body><deck-stage><section id="one"><h1>One</h1></section><section id="two"><h1>Two</h1></section></deck-stage></body></html>';
  await page.getByLabel('Import HTML file').setInputFiles({ name: 'styles.html', mimeType: 'text/html', buffer: Buffer.from(deck) });
  await page.getByRole('dialog').getByRole('button', { name: 'Import HTML', exact: true }).click();
  await expect(page.locator('.vhe-deck-item')).toHaveCount(2);
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  const source = await page.getByLabel('HTML source').inputValue();
  await page.getByLabel('HTML source').fill(source.replace('color: red', 'color: blue'));
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  const downloads: string[] = [];
  page.on('download', (download) => downloads.push(download.suggestedFilename()));
  await page.getByRole('button', { name: 'Export HTML', exact: true }).click();
  await expect(page.locator('.vhe-notice')).toContainText('different head stylesheets');
  expect(downloads).toEqual([]);
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  await expect(page.getByLabel('HTML source')).toHaveValue(source.replace('color: red', 'color: blue'));
});

test('edits colliding data-vhe attributes without confusing runtime state or changing authored metadata', async ({ page }) => {
  const html = '<p id="text" data-vhe-node="author" data-vhe-editing="true">First <strong data-vhe-1-node="child" data-vhe-selected="kept">bold</strong></p>';
  await editSource(page, html);
  const paragraph = page.frameLocator('iframe[title="Visual HTML canvas"]').locator('#text');
  await paragraph.locator('strong').click();
  await expect(paragraph).toHaveAttribute('contenteditable', 'true');
  await paragraph.locator('strong').evaluate((element) => {
    const doc = element.ownerDocument;
    const range = doc.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    doc.getSelection()!.removeAllRanges();
    doc.getSelection()!.addRange(range);
  });
  await paragraph.press('X');
  await paragraph.press('Tab');
  await expect(paragraph).toContainText('boldX');
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  await expect(page.getByLabel('HTML source')).toHaveValue(html.replace('bold', 'boldX'));
});

test('preserves Enter, Shift+Enter, and blank lines through commit, undo, and export', async ({ page }) => {
  await editSource(page, '<p id="text">First</p>');
  const paragraph = page.frameLocator('iframe[title="Visual HTML canvas"]').locator('#text');
  await paragraph.click();
  await paragraph.press('End');
  await paragraph.press('Enter');
  await paragraph.press('N');
  await paragraph.press('Shift+Enter');
  await paragraph.press('Enter');
  await paragraph.press('Z');
  await paragraph.press('Tab');
  await expect.poll(() => paragraph.innerText()).toBe('First\nN\n\nZ');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(paragraph).toHaveJSProperty('innerHTML', 'First');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect.poll(() => paragraph.innerText()).toBe('First\nN\n\nZ');
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  await expect(page.getByLabel('HTML source')).toHaveValue('<p id="text">First<br>N<br><br>Z</p>');
});

test('preserves clipboard line breaks inside formatted text without importing clipboard HTML', async ({ page }) => {
  await editSource(page, '<p id="text">First <strong>bold</strong></p>');
  const paragraph = page.frameLocator('iframe[title="Visual HTML canvas"]').locator('#text');
  await paragraph.click();
  await paragraph.evaluate((element) => {
    const doc = element.ownerDocument;
    const range = doc.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    doc.getSelection()!.removeAllRanges();
    doc.getSelection()!.addRange(range);
    const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', {
      value: { getData: (type: string) => type === 'text/plain' ? '\r\nSecond\n\n<Third>' : '<script>unsafe()</script>' }
    });
    element.dispatchEvent(event);
  });
  await paragraph.press('Tab');
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  await expect(page.getByLabel('HTML source')).toHaveValue('<p id="text">First <strong>bold</strong><br>Second<br><br>&lt;Third&gt;</p>');
});
