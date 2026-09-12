import { expect, test, type Page } from '@playwright/test';

async function loadHtml(page: Page, html: string, slides = false) {
  await page.goto('/#/editor');
  await expect(page.getByTestId('visual-html-editor')).toBeVisible();
  if (slides) await page.getByRole('tab', { name: 'Slides', exact: true }).click();
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  await page.getByLabel('HTML source').fill(html);
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
}

const canvas = (page: Page) => page.frameLocator('iframe[title="Visual HTML canvas"]');

test('a history shortcut with nothing to undo keeps subsequent typing tracked', async ({ page }) => {
  await page.goto('/#/editor');
  await expect(page.getByTestId('visual-html-editor')).toBeVisible();
  const heading = canvas(page).locator('h1');
  const original = await heading.innerText();
  await heading.click();
  await heading.press('Control+End');
  await heading.press('Control+z');
  await heading.pressSequentially('XYZ');
  await heading.press('Tab');
  await expect(heading).toHaveText(`${original}XYZ`);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(heading).toHaveText(original);
});

test('instrumentation and new styles preserve a slash in an unquoted attribute', async ({ page }) => {
  const html = '<p id="text" title=folder/>Text</p>';
  await loadHtml(page, html);
  const element = canvas(page).locator('#text');
  await expect(element).toHaveAttribute('title', 'folder/');
  await element.click();
  await element.press('Escape');
  await page.getByRole('textbox', { name: 'Color', exact: true }).fill('#ff0000');
  await page.getByRole('textbox', { name: 'Color', exact: true }).press('Tab');
  await expect(element).toHaveCSS('color', 'rgb(255, 0, 0)');
  await expect(element).toHaveAttribute('title', 'folder/');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  await expect(page.getByLabel('HTML source')).toHaveValue(html);
});

test('removes bold from a standalone mark and preserves selection through undo and redo', async ({ page }) => {
  await loadHtml(page, '<strong id="text">Bold text</strong>');
  const element = canvas(page).locator('#text');
  await element.click();
  await element.press('Home');
  await element.press('Shift+End');
  await expect(page.getByRole('button', { name: 'Bold selected text' })).toHaveAttribute('aria-pressed', 'true');
  await element.press('Control+b');
  await expect(element).toHaveCSS('font-weight', '400');
  await expect(element).toHaveAttribute('contenteditable', 'true');
  await expect(page.getByRole('button', { name: 'Bold selected text' })).toHaveAttribute('aria-pressed', 'false');
  await element.press('Control+z');
  await expect(element).toHaveCSS('font-weight', '700');
  await expect(element).toHaveAttribute('contenteditable', 'true');
  await element.press('Control+Shift+z');
  await expect(element).toHaveCSS('font-weight', '400');
});

for (const tag of ['div', 'section', 'figcaption', 'span']) {
  test(`edits the surrounding text of a mixed ${tag}`, async ({ page }) => {
    const html = `<${tag} id="edit">Before <strong>bold</strong> after</${tag}>`;
    await loadHtml(page, html);
    const element = canvas(page).locator('#edit');
    await element.locator('strong').click();
    await expect(element).toHaveAttribute('contenteditable', 'true');
    await element.press('Home');
    await element.press('X');
    await element.press('End');
    await element.press('Y');
    await element.press('Tab');
    await page.getByRole('button', { name: 'Source', exact: true }).click();
    await expect(page.getByLabel('HTML source')).toHaveValue(html.replace('Before', 'XBefore').replace('after', 'afterY'));
  });
}

test('edits around inline images and formats selections beginning inside links', async ({ page }) => {
  await loadHtml(page, '<p id="edit"><a href="#">Link</a> after <img alt="dot" width="20" height="20" src="/assets/chrome-ribbon.png"> end</p>');
  const element = canvas(page).locator('#edit');
  // Select the text region, not the independently selectable inline image/link.
  await element.click({ position: { x: 130, y: 10 } });
  await expect(element).toHaveAttribute('contenteditable', 'true');
  await element.press('End');
  await element.press('X');
  await element.press('Home');
  await element.press('Shift+End');
  await element.press('Control+b');
  await expect(element.locator('a strong')).toHaveText('Link');
  await expect(element.locator('img')).toHaveCount(1);
  await expect(element).toContainText('endX');
});

test('undo and redo typing, deletion, line breaks and paste without leaving text', async ({ page }) => {
  await loadHtml(page, '<p id="text">Hello <strong>world</strong></p>');
  const text = canvas(page).locator('#text');
  await text.click();
  await text.press('End');
  await text.pressSequentially('XYZ');
  await text.press('Control+z');
  await expect(text).toHaveText('Hello world');
  await text.press('Control+Shift+z');
  await expect(text).toHaveText('Hello worldXYZ');
  await text.press('Backspace');
  await expect(text).toHaveText('Hello worldXY');
  await text.press('Control+z');
  await expect(text).toHaveText('Hello worldXYZ');
  await text.press('Enter');
  await text.press('X');
  await text.press('Control+z');
  await text.press('Control+z');
  await expect(text.locator('br')).toHaveCount(0);
  await text.evaluate((element) => {
    const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: { getData: () => '\nPasted\nlines' } });
    element.dispatchEvent(event);
  });
  await expect(text).toContainText('Pasted');
  await text.press('Control+z');
  await expect(text).toHaveText('Hello worldXYZ');
  await text.press('Control+y');
  await expect(text).toContainText('Pasted');
  await text.press('Tab');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(text).toHaveText('Hello world');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(text).toContainText('Pasted');
});

test('text history preserves a caret after a line break and drops redo on a new edit', async ({ page }) => {
  await loadHtml(page, '<p id="text">First<br>Second</p>');
  const text = canvas(page).locator('#text');
  await text.click();
  await text.press('Control+End');
  await text.press('X');
  await text.press('Control+z');
  await text.press('Y');
  await text.press('Control+Shift+z');
  await expect.poll(() => text.innerText()).toBe('First\nSecondY');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(() => text.innerText()).toBe('First\nSecond');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect.poll(() => text.innerText()).toBe('First\nSecondY');
});

test('keyboard history crosses a formatting transaction while retaining editable focus', async ({ page }) => {
  await loadHtml(page, '<p id="text">Hello</p>');
  const text = canvas(page).locator('#text');
  await text.click();
  await text.press('Home');
  await text.press('Shift+End');
  await text.press('Control+b');
  await expect(text.locator('strong')).toHaveText('Hello');
  await expect(text).toHaveAttribute('contenteditable', 'true');
  await text.press('Control+z');
  await expect(text.locator('strong')).toHaveCount(0);
  await expect(text).toHaveAttribute('contenteditable', 'true');
  await text.press('Control+Shift+z');
  await expect(text.locator('strong')).toHaveText('Hello');
});

for (const picture of [false, true]) {
  test(`image Source replacement changes currentSrc and undoes atomically: picture=${picture}`, async ({ page }) => {
    const image = '<img id="pic" alt="test" width="200" src="/assets/chrome-ribbon.png" srcset="/assets/chrome-ribbon.webp 1x">';
    await loadHtml(page, picture ? `<picture><source srcset="/assets/chrome-ribbon.webp">${image}</picture>` : image);
    const pic = canvas(page).locator('#pic');
    await pic.click();
    await page.getByRole('textbox', { name: 'Source', exact: true }).fill('/assets/chrome-ribbon.png?replacement');
    await page.getByRole('textbox', { name: 'Source', exact: true }).press('Tab');
    await expect.poll(() => pic.evaluate((el: HTMLImageElement) => el.currentSrc)).toContain('chrome-ribbon.png?replacement');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect.poll(() => pic.evaluate((el: HTMLImageElement) => el.currentSrc)).toContain('chrome-ribbon.webp');
  });
}

for (const html of ['<tr><td id="edit">Cell</td></tr>', '<td id="edit">Cell</td>', '<tbody><tr><td id="edit">Cell</td></tr></tbody>']) {
  test(`preserves editable table fragment nodes: ${html}`, async ({ page }) => {
    await loadHtml(page, html);
    const cell = canvas(page).locator('td#edit');
    await expect(cell).toBeVisible();
    await cell.click();
    await cell.press('End');
    await cell.press('X');
    await cell.press('Tab');
    await page.getByRole('button', { name: 'Source', exact: true }).click();
    await expect(page.getByLabel('HTML source')).toHaveValue(html.replace('Cell', 'CellX'));
  });
}

for (const html of ['<ul><li id="edit">One<li>Two</ul>', '<table><tr><td id="edit">One<td>Two</table>', '<p id="edit">One<p>Two']) {
  test(`edits an optional closing tag: ${html}`, async ({ page }) => {
    await loadHtml(page, html);
    const element = canvas(page).locator('#edit');
    await element.click();
    await expect(element).toHaveAttribute('contenteditable', 'true');
    await element.press('End');
    await element.press('X');
    await element.press('Tab');
    await page.getByRole('button', { name: 'Source', exact: true }).click();
    await expect(page.getByLabel('HTML source')).toHaveValue(html.replace('One', 'OneX'));
  });
}

for (const variant of ['left-top', 'right-bottom', 'percentage', 'scaled'] as const) {
  test(`drag preserves stylesheet offsets through commit: ${variant}`, async ({ page }) => {
    const offsets = variant === 'right-bottom' ? 'right:-100px;bottom:-60px' : variant === 'percentage' ? 'left:10%;top:20%' : 'left:100px;top:60px';
    await loadHtml(page, `<style>#box{position:relative;${offsets};width:150px;height:100px;background:pink}</style><div style="width:600px;height:400px;${variant === 'scaled' ? 'transform:scale(1.5);transform-origin:0 0' : ''}"><div id="box"></div></div>`, true);
    const box = canvas(page).locator('#box');
    const before = (await box.boundingBox())!;
    const x = before.x + before.width / 2, y = before.y + before.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 20, y, { steps: 5 });
    const preview = (await box.boundingBox())!;
    await page.mouse.up();
    await expect.poll(async () => (await box.boundingBox())?.x).toBeCloseTo(preview.x, 0);
    await expect.poll(async () => ((await box.boundingBox())?.x ?? NaN) - before.x).toBeCloseTo(20, 0);
    await expect.poll(async () => (await box.boundingBox())?.y).toBeCloseTo(before.y, 0);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect.poll(async () => (await box.boundingBox())?.x).toBeCloseTo(before.x, 0);
  });
}

for (const variant of ['content-box', 'border-box', 'scaled'] as const) {
  test(`resize preserves the untouched axis and pointer distance: ${variant}`, async ({ page }) => {
    await loadHtml(page, `<div style="${variant === 'scaled' ? 'transform:scale(1.5);transform-origin:0 0' : ''}"><div id="box" style="box-sizing:${variant === 'border-box' ? 'border-box' : 'content-box'};width:150px;height:100px;padding:20px;border:10px solid black;background:pink">Box</div></div>`, variant === 'scaled');
    const box = canvas(page).locator('#box');
    await box.click();
    await box.press('Escape');
    const before = (await box.boundingBox())!;
    const handle = (await page.getByRole('button', { name: 'Resize element' }).boundingBox())!;
    const x = handle.x + handle.width / 2, y = handle.y + handle.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 20, y, { steps: 5 });
    await page.mouse.up();
    await expect.poll(async () => ((await box.boundingBox())?.width ?? NaN) - before.width).toBeCloseTo(20, 0);
    await expect.poll(async () => (await box.boundingBox())?.height).toBeCloseTo(before.height, 0);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect.poll(async () => (await box.boundingBox())?.width).toBeCloseTo(before.width, 0);
  });
}
