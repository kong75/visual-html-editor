import { expect, test, type Page } from '@playwright/test';

const canvas = (page: Page) => page.frameLocator('iframe[title="Visual HTML canvas"]');

async function loadHtml(page: Page, html: string) {
  await page.goto('/#/editor');
  await expect(page.getByTestId('visual-html-editor')).toBeVisible();
  await page.getByRole('tab', { name: 'Web', exact: true }).click();
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  await page.getByLabel('HTML source').fill(html);
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
}

test('cleared text blocks can be clicked and typed into without changing exported layout styles', async ({ page }) => {
  await loadHtml(page, '<p id="empty">Clear me</p><p>Other text</p>');
  const paragraph = canvas(page).locator('#empty');
  await paragraph.click();
  await paragraph.press('Control+a');
  await paragraph.press('Backspace');
  await paragraph.press('Tab');
  await expect(paragraph).toBeEmpty();
  expect(await paragraph.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThan(10);
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  await expect(page.getByLabel('HTML source')).toHaveValue('<p id="empty"></p><p>Other text</p>');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await paragraph.click();
  await paragraph.pressSequentially('Recovered');
  await paragraph.press('Tab');
  await expect(paragraph).toHaveText('Recovered');
});

test('inspector keeps the authored value primary when important CSS overrides it', async ({ page }) => {
  await loadHtml(page, '<style>.fixed{font-size:28px!important}</style><p class="fixed">Important text</p>');
  const paragraph = canvas(page).locator('p');
  await paragraph.click();
  await paragraph.press('Escape');
  await page.getByRole('textbox', { name: 'Size', exact: true }).fill('44px');
  await page.getByRole('textbox', { name: 'Size', exact: true }).press('Tab');
  await expect(paragraph).toHaveCSS('font-size', '28px');
  await expect(page.getByRole('textbox', { name: 'Size', exact: true })).toHaveValue('44px');
  await expect(page.getByRole('status', { name: 'Rendered style values' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Size', exact: true })).toHaveValue('28px');
});

test('invalid inspector CSS is rejected while relative units and variables remain supported', async ({ page }) => {
  const html = '<p id="text" style="--brand-size: 24px">Valid styles</p>';
  await loadHtml(page, html);
  const paragraph = canvas(page).locator('#text');
  await paragraph.click();
  await paragraph.press('Escape');
  const size = page.getByRole('textbox', { name: 'Size', exact: true });
  await size.fill('banana');
  await size.press('Tab');
  await expect(page.getByRole('status')).toContainText('not valid for font-size');
  await expect(paragraph).toHaveAttribute('style', '--brand-size: 24px');
  await size.fill('2rem');
  await size.press('Tab');
  await expect(paragraph).toHaveCSS('font-size', '32px');
  await size.fill('var(--brand-size)');
  await size.press('Tab');
  await expect(paragraph).toHaveCSS('font-size', '24px');
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  await expect(page.getByLabel('HTML source')).not.toHaveValue(/banana/);
});

test('duplicating an identified element keeps IDs unique and supports undo', async ({ page }) => {
  await loadHtml(page, '<p id="duplicate">Duplicate target</p>');
  const layer = page.getByRole('button', { name: 'Select Text: “Duplicate target” (p)', exact: true });
  await layer.click();
  // WebKit pointer clicks need not focus a button; target the keyboard shortcut explicitly.
  await layer.press('Control+d');
  await expect(canvas(page).locator('#duplicate')).toHaveCount(1);
  await expect(canvas(page).locator('#duplicate-copy')).toHaveText('Duplicate target');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(canvas(page).locator('#duplicate-copy')).toHaveCount(0);
});

test('deck controls and keyboard undo restore deleted slides with their latest content', async ({ page }) => {
  await page.goto('/#/editor');
  await page.getByRole('tab', { name: 'Slides', exact: true }).click();
  await page.getByRole('button', { name: 'Add slide', exact: true }).click();
  const heading = canvas(page).getByRole('heading', { level: 1 });
  await expect(heading).toHaveText('Untitled slide');
  await heading.click();
  await heading.press('Control+a');
  await heading.pressSequentially('Unique recovery marker');
  await page.getByRole('button', { name: 'Slide actions for Slide 4', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Delete slide Del', exact: true }).click();
  await expect(page.getByRole('listbox', { name: 'Deck slides' }).getByRole('option')).toHaveCount(3);
  await page.keyboard.press('Control+z');
  await expect(heading).toHaveText('Unique recovery marker');
  await expect(page.getByRole('listbox', { name: 'Deck slides' }).getByRole('option')).toHaveCount(4);
  await page.getByRole('button', { name: 'Redo deck change', exact: true }).click();
  await expect(page.getByRole('listbox', { name: 'Deck slides' }).getByRole('option')).toHaveCount(3);
  await page.getByRole('button', { name: 'Undo deck change', exact: true }).click();
  await expect(heading).toHaveText('Unique recovery marker');
  // Slide text history still belongs to the active slide.
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(heading).toHaveText('Untitled slide');
  await expect(page.getByRole('listbox', { name: 'Deck slides' }).getByRole('option')).toHaveCount(4);
});

test('workspace save status includes structural changes and inactive slide edits', async ({ page }) => {
  await page.goto('/#/editor');
  await page.getByRole('tab', { name: 'Slides', exact: true }).click();
  const status = page.locator('.vhe-status__save');
  await expect(status).toHaveText('Saved checkpoint');
  await page.getByRole('button', { name: 'Add slide', exact: true }).click();
  await expect(status).toHaveText('Unsaved changes');
  await page.getByRole('button', { name: 'Undo deck change', exact: true }).click();
  await expect(status).toHaveText('Saved checkpoint');
  const heading = canvas(page).getByRole('heading', { level: 1 });
  await heading.click();
  await heading.press('End');
  await heading.pressSequentially(' edited');
  await page.getByRole('option', { name: '2. Clarity happens in layers', exact: true }).click();
  await expect(canvas(page).getByRole('heading', { level: 1 })).toHaveText('Clarity happens in layers.');
  await expect(status).toHaveText('Unsaved changes');
});

test('import confirmation traps focus and blocks background history until dismissed', async ({ page }) => {
  await loadHtml(page, '<p id="text">Original</p>');
  const paragraph = canvas(page).locator('#text');
  await paragraph.click();
  await paragraph.press('End');
  await paragraph.pressSequentially(' edited');
  const chooserEvent = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import HTML', exact: true }).click();
  await (await chooserEvent).setFiles({ name: 'replacement.html', mimeType: 'text/html', buffer: Buffer.from('<h1>Replacement</h1>') });
  const dialog = page.getByRole('dialog');
  const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true });
  const confirm = dialog.getByRole('button', { name: 'Import HTML', exact: true });
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Control+z');
  await expect(paragraph).toHaveText('Original edited');
  await page.keyboard.press('Shift+Tab');
  await expect(confirm).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Import HTML', exact: true })).toBeFocused();
  await page.keyboard.press('Control+z');
  await expect(paragraph).toHaveText('Original');
});

test('color pickers resolve named, variable, and inherited colors without rewriting source', async ({ page }) => {
  const html = '<main style="--brand: rebeccapurple; color: white"><p id="text" style="background-color: var(--brand); border: 1px solid currentColor">Color target</p></main>';
  await loadHtml(page, html);
  await canvas(page).locator('#text').click();
  await canvas(page).locator('#text').press('Escape');
  await expect(page.getByLabel('Choose Color', { exact: true })).toHaveValue('#ffffff');
  await expect(page.getByLabel('Choose Fill', { exact: true })).toHaveValue('#663399');
  await page.getByRole('button', { name: 'Expand Border', exact: true }).click();
  await expect(page.locator('[data-style-property="border-color"] input[type="color"]')).toHaveValue('#ffffff');
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  await expect(page.getByLabel('HTML source')).toHaveValue(html);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await canvas(page).locator('#text').click();
  await canvas(page).locator('#text').press('Escape');
  const color = page.locator('[data-style-property="color"] input:not([type="color"])');
  await color.fill('rebeccapurple');
  await color.press('Tab');
  await expect(page.locator('[data-style-property="color"] input[type="color"]')).toHaveValue('#663399');
});

test('deck import undo and redo restore the correct source even when slide IDs are reused', async ({ page }) => {
  await page.goto('/#/editor');
  await page.getByRole('tab', { name: 'Slides', exact: true }).click();
  const importDeck = async (title: string) => {
    const html = `<html><head><title>${title}</title></head><body><deck-stage width="1280" height="720"><section id="reused"><h1>${title}</h1></section></deck-stage></body></html>`;
    await page.getByLabel('Import HTML file').setInputFiles({ name: 'deck.html', mimeType: 'text/html', buffer: Buffer.from(html) });
    await page.getByRole('dialog').getByRole('button', { name: 'Import HTML', exact: true }).click();
    await expect(canvas(page).getByRole('heading', { level: 1 })).toHaveText(title);
  };
  await importDeck('First imported deck');
  await importDeck('Second imported deck');
  await page.getByRole('button', { name: 'Undo deck change', exact: true }).click();
  await expect(canvas(page).getByRole('heading', { level: 1 })).toHaveText('First imported deck');
  await page.getByRole('button', { name: 'Redo deck change', exact: true }).click();
  await expect(canvas(page).getByRole('heading', { level: 1 })).toHaveText('Second imported deck');
});
