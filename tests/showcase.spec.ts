import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.beforeEach(async ({ page }) => {
  await page.goto('/#/editor');
  await page.locator('#editor').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('visual-html-editor')).toBeVisible();
});

test('separates the animated landing page from the editor workspace', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Make HTML feel alive/i })).toBeVisible();
  await expect(page.getByRole('img', { name: /Animated editing demonstration/ })).toBeVisible();
  await expect(page.getByTestId('visual-html-editor')).toHaveCount(0);
  await page.getByRole('link', { name: 'Open editor' }).click();
  await expect(page).toHaveURL(/#\/editor$/);
  await expect(page.getByTestId('visual-html-editor')).toBeVisible();
});

test('keeps both routes coherent on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Make HTML feel alive/i })).toBeVisible();
  await expect(page.locator('.landing-motion__window')).toBeVisible();
  await page.getByRole('link', { name: /Try your HTML/ }).first().click();
  await expect(page.getByRole('region', { name: 'Try your own HTML' })).toBeVisible();
  await expect(page.getByTestId('visual-html-editor')).toBeVisible();

  const stageBox = await page.locator('.vhe-stage').boundingBox();
  const sidebarBox = await page.locator('.vhe-inspector').boundingBox();
  expect(stageBox).not.toBeNull();
  expect(sidebarBox).not.toBeNull();
  expect(sidebarBox!.y).toBeGreaterThan(stageBox!.y);
});

test('loads the email profile with an isolated visual canvas', async ({ page }) => {
  await expect(page.getByTestId('profile-email')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.vhe-toolbar').getByRole('tablist', { name: 'Content profile' })).toBeVisible();
  await expect(page.locator('.vhe-inspector').getByRole('tablist', { name: 'Content profile' })).toHaveCount(0);
  await expect(page.locator('.vhe-brand__mark svg')).toBeVisible();
  await expect(page.locator('.vhe-viewport-select select')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Viewport: Desktop' })).toBeVisible();
  await expect(page.locator('.editor-page')).toHaveCSS('padding', '0px');
  await expect(page.getByTestId('visual-html-editor')).toHaveCSS('border-radius', '0px');
  await expect(page.getByTestId('visual-html-editor')).toHaveCSS('box-shadow', 'none');
  await expect(page.getByTitle('Visual HTML canvas')).toHaveAttribute('sandbox', 'allow-same-origin allow-scripts');
  const sidebarBox = await page.locator('.vhe-inspector').boundingBox();
  const stageBox = await page.locator('.vhe-stage').boundingBox();
  expect(sidebarBox).not.toBeNull();
  expect(stageBox).not.toBeNull();
  expect(sidebarBox!.x).toBeLessThan(stageBox!.x);
  const frame = page.frameLocator('iframe[title="Visual HTML canvas"]');
  await expect(frame.locator('h1')).toContainText('Build skills');
  expect(await frame.locator('html').evaluate((element) => ({
    width: element.ownerDocument.defaultView?.innerWidth,
    height: element.ownerDocument.defaultView?.innerHeight
  }))).toEqual({ width: 800, height: 900 });
  expect(await frame.locator('#email-content').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, left: rect.left, right: element.ownerDocument.defaultView!.innerWidth - rect.right };
  })).toEqual({ width: 600, left: 100, right: 100 });
  await page.getByRole('combobox', { name: 'Viewport: Desktop' }).click();
  await page.getByRole('option', { name: /^Mobile/ }).click();
  expect(await frame.locator('html').evaluate((element) => ({
    width: element.ownerDocument.defaultView?.innerWidth,
    height: element.ownerDocument.defaultView?.innerHeight
  }))).toEqual({ width: 390, height: 844 });
  expect(await frame.locator('#email-content').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, left: rect.left, right: element.ownerDocument.defaultView!.innerWidth - rect.right };
  })).toEqual({ width: 366, left: 12, right: 12 });
  await expect(page.getByText('0 validation issues')).toBeVisible();
});

test('uses the component selector to navigate the live document hierarchy', async ({ page }) => {
  const tree = page.getByRole('tree', { name: 'Document structure' });
  await expect(tree).toBeVisible();
  await page.frameLocator('iframe[title="Visual HTML canvas"]').locator('h1').click();
  const headingItem = tree.getByRole('treeitem', { name: /Heading: “Build skills that move/ });
  await expect(headingItem).toBeVisible();
  await expect(headingItem).toHaveAttribute('aria-selected', 'true');

  const paragraphItem = tree.getByRole('treeitem', { name: /Text: “Your new course is ready/ });
  await paragraphItem.getByRole('button', { name: /Select Text:/ }).click();
  await expect(paragraphItem).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.vhe-inspector__title code')).toHaveText('p');
  await expect(page.locator('.vhe-selection')).toBeVisible();
  await expect(page.frameLocator('iframe[title="Visual HTML canvas"]').getByText(/Your new course is ready/)).not.toHaveAttribute('contenteditable', 'true');

  await tree.getByRole('button', { name: /^Collapse / }).first().click();
  const firstExpand = tree.getByRole('button', { name: /^Expand / }).first();
  await expect(firstExpand).toBeVisible();
  await firstExpand.click();
  await expect(headingItem).toBeVisible();
});

test('selects and edits leaf text inline with undo and redo', async ({ page }) => {
  const frame = page.frameLocator('iframe[title="Visual HTML canvas"]');
  const heading = frame.locator('h1');
  await heading.click();
  await expect(page.locator('.vhe-inspector__title code')).toHaveText('h1');
  await expect(heading).toHaveAttribute('contenteditable', 'true');
  expect(await heading.evaluate((element) => {
    const selection = element.ownerDocument.getSelection();
    return Boolean(selection?.isCollapsed && selection.anchorNode && element.contains(selection.anchorNode));
  })).toBe(true);
  await heading.fill('A clearer path to mastery.');
  await heading.press('Tab');
  await expect(heading).toContainText('A clearer path to mastery.');

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(frame.locator('h1')).toContainText('Build skills that move with you.');
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(frame.locator('h1')).toContainText('A clearer path to mastery.');
});

test('applies inspector style changes as source-backed patches', async ({ page }) => {
  const frame = page.frameLocator('iframe[title="Visual HTML canvas"]');
  await frame.locator('h1').click();
  const fontSize = page.locator('[data-style-property="font-size"] input');
  await fontSize.fill('46px');
  await fontSize.press('Tab');
  await expect(frame.locator('h1')).toHaveCSS('font-size', '46px');

  const margin = page.locator('.vhe-disclosure[data-style-property="margin"] > .vhe-disclosure__summary input');
  await margin.fill('12px 18px');
  await margin.press('Tab');
  await expect(frame.locator('h1')).toHaveCSS('margin-top', '12px');
  await expect(frame.locator('h1')).toHaveCSS('margin-right', '18px');

  await page.getByRole('combobox', { name: 'Align: start' }).click();
  await expect(page.getByRole('listbox', { name: 'Align options' })).toBeVisible();
  await page.getByRole('option', { name: 'center' }).click();
  await expect(frame.locator('h1')).toHaveCSS('text-align', 'center');

  await page.getByRole('button', { name: 'Source' }).click();
  await expect(page.getByLabel('HTML source')).toContainText('font-size: 46px');
  await expect(page.getByLabel('HTML source')).toContainText('margin: 12px 18px');
  await expect(page.getByLabel('HTML source')).toContainText('text-align: center');
});

test('shows contextual inspector groups and expandable box controls', async ({ page }) => {
  await page.getByTestId('profile-web').click();
  const header = page.frameLocator('iframe[title="Visual HTML canvas"]').locator('header');
  await header.click({ position: { x: 500, y: 15 } });

  await expect(page.getByRole('heading', { name: 'Typography' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Size' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Layout' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Box' })).toBeVisible();
  await expect(page.locator('[data-style-property="gap"]')).toBeVisible();

  const padding = page.locator('.vhe-disclosure[data-style-property="padding"] .vhe-disclosure__toggle');
  await padding.click();
  await expect(padding).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('[data-style-property^="padding-"]')).toHaveCount(4);

  const radius = page.locator('.vhe-disclosure[data-style-property="border-radius"] .vhe-disclosure__toggle');
  await radius.click();
  await expect(page.locator('[data-style-property$="-radius"]')).toHaveCount(5);
});

test('duplicates and removes selected elements while preserving history', async ({ page }) => {
  const frame = page.frameLocator('iframe[title="Visual HTML canvas"]');
  await frame.locator('h1').click();
  await frame.locator('h1').press('Escape');
  const headingTreeItem = page.getByRole('treeitem', { name: /Heading: “Build skills that move/ });
  await headingTreeItem.getByRole('button', { name: /Select Heading:/ }).click();
  await expect(page.getByRole('button', { name: 'Duplicate' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
  await headingTreeItem.getByRole('button', { name: /Select Heading:/ }).dispatchEvent('keydown', {
    key: 'd',
    code: 'KeyD',
    ctrlKey: true,
    bubbles: true,
    cancelable: true
  });
  await expect(frame.locator('h1')).toHaveCount(2);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(frame.locator('h1')).toHaveCount(1);
  await headingTreeItem.getByRole('button', { name: /Select Heading:/ }).click();
  await headingTreeItem.getByRole('button', { name: /Select Heading:/ }).dispatchEvent('keydown', {
    key: 'Delete',
    code: 'Delete',
    bubbles: true,
    cancelable: true
  });
  await expect(frame.locator('h1')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(frame.locator('h1')).toHaveCount(1);
});

test('switches profile rules and aspect ratios', async ({ page }) => {
  await page.getByTestId('profile-slides').click();
  await expect(page.getByTestId('profile-slides')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.vhe-brand strong')).toHaveText('Product thinking');
  await expect(page.frameLocator('iframe[title="Visual HTML canvas"]').locator('h1')).toContainText('Make the complex');
  await expect(page.getByRole('button', { name: 'Move', exact: true })).toHaveCount(0);
  const slideHeading = page.frameLocator('iframe[title="Visual HTML canvas"]').locator('h1');
  await expect(slideHeading).toHaveCSS('cursor', 'text');
  await slideHeading.click();
  await expect(page.getByRole('button', { name: 'Move', exact: true })).toHaveCount(0);
  await expect(slideHeading).toHaveCSS('cursor', 'text');
  await expect(slideHeading).toHaveAttribute('contenteditable', 'true');
  await expect(page.locator('.vhe-inspector__title code')).toHaveText('h1');
  await page.getByRole('combobox', { name: /Viewport:/ }).click();
  await page.getByRole('option', { name: /4:3/ }).click();
  expect(await page.frameLocator('iframe[title="Visual HTML canvas"]').locator('html').evaluate((element) => ({
    width: element.ownerDocument.defaultView?.innerWidth,
    height: element.ownerDocument.defaultView?.innerHeight
  }))).toEqual({ width: 1024, height: 768 });

  await page.getByTestId('profile-web').click();
  await expect(page.locator('.vhe-brand strong')).toHaveText('Responsive web');
  await page.getByRole('combobox', { name: /Viewport:/ }).click();
  await page.getByRole('option', { name: /Mobile/ }).click();
  expect(await page.frameLocator('iframe[title="Visual HTML canvas"]').locator('html').evaluate((element) => ({
    width: element.ownerDocument.defaultView?.innerWidth,
    height: element.ownerDocument.defaultView?.innerHeight
  }))).toEqual({ width: 390, height: 844 });
});

test('keeps the editor shell mounted while changing document profiles', async ({ page }) => {
  const editor = page.getByTestId('visual-html-editor');
  await editor.evaluate((element) => element.setAttribute('data-shell-instance', 'stable'));

  await page.getByTestId('profile-slides').click();
  await expect(page.locator('.vhe-brand strong')).toHaveText('Product thinking');
  await expect(editor).toHaveAttribute('data-shell-instance', 'stable');

  await page.getByTestId('profile-web').click();
  await expect(page.locator('.vhe-brand strong')).toHaveText('Responsive web');
  await expect(editor).toHaveAttribute('data-shell-instance', 'stable');
});

test('manages and exports a multi-slide HTML deck', async ({ page }) => {
  await page.getByTestId('profile-slides').click();
  const slideList = page.getByRole('listbox', { name: 'Deck slides' });
  const slideOptions = slideList.getByRole('option');
  await expect(slideOptions).toHaveCount(3);
  await expect(page.locator('.vhe-deck-item__actions')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Undo deck change', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Redo deck change', exact: true })).toBeDisabled();

  await expect(page.locator('.vhe-navigation')).toHaveCSS('background-color', 'rgb(244, 242, 246)');
  await expect(slideOptions.first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(slideOptions.first().locator('.vhe-deck-item__preview')).toHaveCSS('border-color', 'rgb(118, 82, 186)');
  const previewIsContained = await slideOptions.first().evaluate((option) => {
    const card = option.getBoundingClientRect();
    const preview = option.querySelector<HTMLElement>('.vhe-deck-item__preview')?.getBoundingClientRect();
    return Boolean(preview && preview.left >= card.left && preview.right <= card.right + 0.5);
  });
  expect(previewIsContained).toBe(true);

  await slideList.getByRole('option', { name: /2\. Clarity happens in layers/ }).click();
  const frame = page.frameLocator('iframe[title="Visual HTML canvas"]');
  await expect(frame.locator('h1')).toContainText('Clarity happens in layers');

  await page.getByRole('button', { name: 'Slide actions for Clarity happens in layers' }).click();
  await expect(page.getByRole('menu', { name: 'Actions for Clarity happens in layers' })).toBeVisible();
  await page.getByRole('menuitem', { name: /Duplicate slide/ }).click();
  await expect(slideOptions).toHaveCount(4);
  await expect(frame.locator('h1')).toContainText('Clarity happens in layers');

  await page.getByRole('button', { name: 'Add slide' }).click();
  await expect(slideOptions).toHaveCount(5);
  await expect(frame.locator('h1')).toContainText('Untitled slide');

  await page.getByRole('button', { name: 'Slide actions for Slide 5' }).click();
  await page.getByRole('menuitem', { name: /Delete slide/ }).click();
  await expect(slideOptions).toHaveCount(4);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export HTML' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('visual-html-deck.html');
  const path = await download.path();
  expect(path).not.toBeNull();
  const exported = await readFile(path!, 'utf8');
  expect(exported).toContain('<deck-stage');
  expect(exported.match(/data-deck-active/g)).toHaveLength(4);
  expect(exported).toContain('id="speaker-notes"');
  await expect(page.getByText('Exported 4 slides as a standalone HTML deck.')).toBeVisible();
});

test('starts inline editing on the first click in draggable profiles', async ({ page }) => {
  await page.getByTestId('profile-slides').click();
  const heading = page.frameLocator('iframe[title="Visual HTML canvas"]').locator('h1');
  await heading.click();
  await expect(heading).toHaveAttribute('contenteditable', 'true');
  expect(await heading.evaluate((element) => {
    const selection = element.ownerDocument.getSelection();
    return Boolean(selection?.isCollapsed && selection.anchorNode && element.contains(selection.anchorNode));
  })).toBe(true);
  await heading.fill('Direct manipulation stays editable.');
  await heading.press('Tab');
  await expect(heading).toHaveText('Direct manipulation stays editable.');
});

test('toggles bold across mixed inline markup without rewriting surrounding HTML', async ({ page }) => {
  await page.getByRole('button', { name: 'Source' }).click();
  await page.getByLabel('HTML source').fill('<p id="mixed">Hello <em>beautiful</em> world &amp; friends.</p>');
  await page.getByRole('button', { name: 'Apply' }).click();

  const mixed = page.frameLocator('iframe[title="Visual HTML canvas"]').locator('#mixed');
  await mixed.click();
  await mixed.evaluate((element) => {
    const doc = element.ownerDocument;
    const walker = doc.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const points: Array<{ node: Node; start: number; end: number }> = [];
    let cursor = 0;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const length = node.textContent?.length ?? 0;
      points.push({ node, start: cursor, end: cursor + length });
      cursor += length;
    }
    const locate = (offset: number) => {
      const point = points.find((candidate) => offset <= candidate.end) ?? points.at(-1)!;
      return { node: point.node, offset: Math.max(0, offset - point.start) };
    };
    const start = locate(6);
    const end = locate(21);
    const range = doc.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    const selection = doc.defaultView?.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });

  const bold = page.getByRole('button', { name: 'Bold selected text' });
  await expect(bold).toBeEnabled();
  await bold.click();
  await expect(mixed.locator('strong')).toHaveCount(2);
  await expect(bold).toHaveAttribute('aria-pressed', 'true');
  await expect(mixed).toHaveText('Hello beautiful world & friends.');

  await bold.click();
  await expect(mixed.locator('strong')).toHaveCount(0);
  await expect(mixed.locator('em')).toHaveText('beautiful');

  await expect(bold).toBeEnabled();
  await mixed.dispatchEvent('keydown', {
    key: 'b',
    code: 'KeyB',
    ctrlKey: true,
    bubbles: true,
    cancelable: true
  });
  await expect(mixed.locator('strong')).toHaveCount(2);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(mixed.locator('strong')).toHaveCount(0);

  await page.getByRole('button', { name: 'Source' }).click();
  await expect(page.getByLabel('HTML source')).toHaveValue('<p id="mixed">Hello <em>beautiful</em> world &amp; friends.</p>');
});

test('styles a selected text range with typography, emphasis, and block alignment', async ({ page }) => {
  await page.getByRole('button', { name: 'Source' }).click();
  await page.getByLabel('HTML source').fill('<p id="range-style" class="lead" style="line-height: 1.25">Hello <em>beautiful</em> world &amp; friends.</p>');
  await page.getByRole('button', { name: 'Apply' }).click();

  const text = page.frameLocator('iframe[title="Visual HTML canvas"]').locator('#range-style');
  await text.click();
  await text.evaluate((element) => {
    const doc = element.ownerDocument;
    const walker = doc.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const points: Array<{ node: Node; start: number; end: number }> = [];
    let cursor = 0;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const length = node.textContent?.length ?? 0;
      points.push({ node, start: cursor, end: cursor + length });
      cursor += length;
    }
    const locate = (offset: number) => {
      const point = points.find((candidate) => offset <= candidate.end) ?? points.at(-1)!;
      return { node: point.node, offset: Math.max(0, offset - point.start) };
    };
    const start = locate(6);
    const end = locate(21);
    const range = doc.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    const selection = doc.defaultView?.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    doc.dispatchEvent(new Event('selectionchange'));
  });

  await expect(page.getByRole('region', { name: 'Selected text formatting' })).toBeVisible();
  await expect(page.locator('.vhe-stage').getByRole('region', { name: 'Selected text formatting' })).toBeVisible();
  await expect(page.locator('.vhe-inspector').getByRole('region', { name: 'Selected text formatting' })).toHaveCount(0);
  const size = page.getByRole('textbox', { name: 'Size for selected text' });
  await size.fill('24px');
  await size.press('Enter');
  await expect(text.locator('span')).toHaveCount(2);
  await expect(text.locator('em span')).toHaveCSS('font-size', '24px');
  await expect(text.locator(':scope > span')).toHaveCSS('font-size', '24px');

  await expect(page.getByRole('textbox', { name: 'Weight for selected text' })).toHaveCount(0);
  await page.getByRole('button', { name: 'More text options' }).click();
  const weight = page.getByRole('textbox', { name: 'Weight for selected text' });
  await expect(page.getByRole('textbox', { name: 'Line height for selected text' })).toHaveValue('1.25');
  await weight.fill('650');
  await weight.press('Enter');
  await expect(text.locator('em span')).toHaveCSS('font-weight', '650');

  await page.getByLabel('Color for selected text').fill('#2563eb');
  await expect(text.locator('em span')).toHaveCSS('color', 'rgb(37, 99, 235)');
  await page.getByRole('button', { name: 'Italicize selected text' }).click();
  await page.getByRole('button', { name: 'Underline selected text' }).click();
  await page.getByRole('button', { name: 'Strike selected text' }).click();
  await expect(page.getByRole('button', { name: 'Italicize selected text' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Underline selected text' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Strike selected text' })).toHaveAttribute('aria-pressed', 'true');

  await page.locator('[data-style-property="text-align"]').getByRole('combobox').click();
  await page.getByRole('option', { name: 'center', exact: true }).click();
  await expect(text).toHaveCSS('text-align', 'center');
  await page.getByRole('button', { name: 'Source' }).click();
  await expect(page.getByLabel('HTML source')).toHaveValue(/class="lead" style="line-height: 1.25; text-align: center"/);
  await expect(page.getByLabel('HTML source')).toHaveValue(/font-size: 24px; font-weight: 650; color: #2563eb/);
});

test('edits wording inside mixed inline markup while preserving its styles', async ({ page }) => {
  await page.getByRole('button', { name: 'Source' }).click();
  await page.getByLabel('HTML source').fill('<p id="mixed-wording">Hello <em>beautiful</em> world &amp; friends.</p>');
  await page.getByRole('button', { name: 'Apply' }).click();

  const frame = page.frameLocator('iframe[title="Visual HTML canvas"]');
  const mixed = frame.locator('#mixed-wording');
  await mixed.click();
  await expect(mixed).toHaveAttribute('contenteditable', 'true');
  await mixed.evaluate((element) => {
    const styled = element.querySelector('em')?.firstChild;
    if (!styled) throw new Error('Expected styled text.');
    const range = element.ownerDocument.createRange();
    range.selectNodeContents(styled);
    const selection = element.ownerDocument.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  await mixed.pressSequentially('wonderful');
  await mixed.press('Tab');

  await expect(mixed).toHaveText('Hello wonderful world & friends.');
  await expect(mixed.locator('em')).toHaveText('wonderful');
  await expect(page.locator('.vhe-notice')).toHaveCount(0);

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(mixed.locator('em')).toHaveText('beautiful');
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(mixed.locator('em')).toHaveText('wonderful');

  await mixed.click();
  await mixed.evaluate((element) => {
    const text = element.lastChild;
    if (!text) throw new Error('Expected trailing text.');
    const range = element.ownerDocument.createRange();
    range.setStart(text, text.textContent?.length ?? 0);
    range.collapse(true);
    const selection = element.ownerDocument.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', {
      value: {
        getData(type: string) {
          if (type === 'text/plain') return ' <trusted>';
          if (type === 'text/html') return '<script>alert(1)</script>';
          return '';
        }
      }
    });
    element.dispatchEvent(event);
  });
  await mixed.press('Tab');
  await expect(mixed).toHaveText('Hello wonderful world & friends. <trusted>');
  await expect(frame.locator('script')).toHaveCount(0);

  await page.getByRole('button', { name: 'Source' }).click();
  await expect(page.getByLabel('HTML source')).toHaveValue(
    '<p id="mixed-wording">Hello <em>wonderful</em> world &amp; friends. &lt;trusted&gt;</p>'
  );
});

test('uses distinct cursor and focus treatments for selection, editing, and controls', async ({ page }) => {
  await page.getByTestId('profile-slides').click();
  const frame = page.frameLocator('iframe[title="Visual HTML canvas"]');
  const heading = frame.locator('h1');
  const stage = frame.locator('main').first();

  await expect(heading).toHaveCSS('cursor', 'text');
  await expect(stage).toHaveCSS('cursor', 'default');

  await page.getByRole('button', { name: 'Select Component (main)' }).click();
  await expect(stage).toHaveAttribute('data-vhe-selected', 'true');
  await expect(stage).toHaveCSS('cursor', 'move');

  await heading.click();
  await expect(heading).toHaveAttribute('contenteditable', 'true');
  await expect(heading).toHaveCSS('outline-style', 'none');
  await expect(heading).toHaveCSS('caret-color', 'rgb(118, 82, 186)');
  const resizeHandleBox = await page.getByRole('button', { name: 'Resize element' }).boundingBox();
  expect(resizeHandleBox).not.toBeNull();
  expect(resizeHandleBox!.width).toBeGreaterThanOrEqual(9);
  expect(resizeHandleBox!.width).toBeLessThanOrEqual(11);

  await page.getByRole('button', { name: 'Image' }).focus();
  await page.keyboard.press('Tab');
  const sourceButton = page.getByRole('button', { name: 'Source' });
  await expect(sourceButton).toBeFocused();
  const focusAppearance = await sourceButton.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, boxShadow: style.boxShadow };
  });
  expect(focusAppearance.outlineStyle).toBe('none');
  expect(focusAppearance.boxShadow).toContain('rgb(163, 133, 200)');
});

test('commits slide drag gestures as atomic position changes', async ({ page }) => {
  await page.getByTestId('profile-slides').click();
  const frame = page.frameLocator('iframe[title="Visual HTML canvas"]');
  const movable = frame.getByText('Module 03 - Product thinking', { exact: true });
  const moveBox = await movable.boundingBox();
  expect(moveBox).not.toBeNull();
  await page.mouse.move(moveBox!.x + moveBox!.width / 2, moveBox!.y + moveBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(moveBox!.x + moveBox!.width / 2 + 48, moveBox!.y + moveBox!.height / 2 + 30, { steps: 4 });
  await expect(frame.locator('html')).toHaveAttribute('data-vhe-drag-active', 'true');
  await page.mouse.up();
  await expect(frame.locator('html')).not.toHaveAttribute('data-vhe-drag-active');
  await expect(movable).toHaveAttribute('style', /position:\s*relative/);
  await expect(movable).toHaveAttribute('style', /left:\s*\d+px/);
  await expect(movable).not.toHaveAttribute('contenteditable', 'true');
  await expect(page.locator('.vhe-inspector__title code')).toHaveText('p');
});

test('commits slide resize gestures as atomic size changes', async ({ page }) => {
  await page.getByTestId('profile-slides').click();
  const frame = page.frameLocator('iframe[title="Visual HTML canvas"]');
  const movable = frame.getByText('Module 03 - Product thinking', { exact: true });
  await movable.click();
  await movable.press('Escape');
  const resize = page.getByRole('button', { name: 'Resize element' });
  const resizeBox = await resize.boundingBox();
  expect(resizeBox).not.toBeNull();
  await resize.hover();
  await page.mouse.down();
  await expect(resize).toHaveAttribute('data-vhe-resizing', 'true');
  await page.mouse.move(resizeBox!.x + 42, resizeBox!.y + 28, { steps: 3 });
  await page.mouse.up();
  await expect(movable).toHaveAttribute('style', /width:\s*\d+px/);
  await expect(movable).toHaveAttribute('style', /height:\s*\d+px/);
});

test('selects through nested and overlapping layers and drags the selected rear element', async ({ page }) => {
  await page.getByTestId('profile-slides').click();
  await page.getByRole('button', { name: 'Source' }).click();
  await page.getByLabel('HTML source').fill(`<!doctype html>
<html>
<head><meta charset="utf-8"><title>Layer selection fixture</title></head>
<body style="margin: 0; overflow: hidden; background-color: #f4f0e8; font-family: Arial, sans-serif;">
  <main id="layer-stage" style="position: relative; width: 100%; height: 100%; min-height: 700px; overflow: hidden;">
    <div id="rear-card" style="position: absolute; left: 100px; top: 100px; width: 360px; height: 240px; background-color: #6555df;">
      <span id="nested-label" style="display: inline-block; margin: 24px; color: #ffffff; font-size: 24px;">Nested label</span>
    </div>
    <div id="front-card" style="position: absolute; left: 220px; top: 150px; width: 360px; height: 240px; background-color: #9bf0c7;">
      <p style="margin: 18px; color: #183128; font-size: 20px;">Front layer</p>
    </div>
  </main>
</body>
</html>`);
  await page.getByRole('button', { name: 'Apply' }).click();

  const frame = page.frameLocator('iframe[title="Visual HTML canvas"]');
  const nestedLabel = frame.locator('#nested-label');
  await nestedLabel.click();
  await expect(page.locator('.vhe-inspector__title code')).toHaveText('span');
  await nestedLabel.press('Escape');
  const nestedBox = await nestedLabel.boundingBox();
  expect(nestedBox).not.toBeNull();
  await page.keyboard.down('Alt');
  await page.mouse.click(nestedBox!.x + nestedBox!.width / 2, nestedBox!.y + nestedBox!.height / 2);
  await page.keyboard.up('Alt');
  const rearTreeItem = page.getByRole('treeitem', { name: 'Group: rear-card (div)' });
  await expect(rearTreeItem).toHaveAttribute('aria-selected', 'true');

  const front = frame.locator('#front-card');
  const frontBox = await front.boundingBox();
  const rear = frame.locator('#rear-card');
  const rearBox = await rear.boundingBox();
  expect(frontBox).not.toBeNull();
  expect(rearBox).not.toBeNull();
  const overlapLeft = Math.max(frontBox!.x, rearBox!.x);
  const overlapTop = Math.max(frontBox!.y, rearBox!.y);
  const overlapRight = Math.min(frontBox!.x + frontBox!.width, rearBox!.x + rearBox!.width);
  const overlapBottom = Math.min(frontBox!.y + frontBox!.height, rearBox!.y + rearBox!.height);
  const overlapX = (overlapLeft + overlapRight) / 2;
  const overlapY = overlapTop + (overlapBottom - overlapTop) * 0.72;

  const frontTreeItem = page.getByRole('treeitem', { name: 'Group: front-card (div)' });
  await frontTreeItem.getByRole('button', { name: 'Select Group: front-card (div)' }).click();
  await expect(frontTreeItem).toHaveAttribute('aria-selected', 'true');

  await page.keyboard.down('Alt');
  await page.mouse.click(overlapX, overlapY);
  await page.keyboard.up('Alt');
  await expect(rearTreeItem).toHaveAttribute('aria-selected', 'true');

  const rearLeftBefore = await rear.evaluate((element) => Number.parseFloat((element as HTMLElement).style.left));
  const rearTopBefore = await rear.evaluate((element) => Number.parseFloat((element as HTMLElement).style.top));
  const frontLeftBefore = await front.evaluate((element) => Number.parseFloat((element as HTMLElement).style.left));
  await page.mouse.move(overlapX, overlapY);
  await page.mouse.down();
  await page.mouse.move(overlapX + 48, overlapY + 32, { steps: 4 });
  await page.mouse.up();

  await expect.poll(() => rear.evaluate((element) => Number.parseFloat((element as HTMLElement).style.left))).toBeGreaterThan(rearLeftBefore);
  await expect.poll(() => rear.evaluate((element) => Number.parseFloat((element as HTMLElement).style.top))).toBeGreaterThan(rearTopBefore);
  expect(await front.evaluate((element) => Number.parseFloat((element as HTMLElement).style.left))).toBe(frontLeftBefore);
  await expect(rearTreeItem).toHaveAttribute('aria-selected', 'true');
});

test('imports an HTML document through a reviewed replacement flow', async ({ page }) => {
  await page.getByTestId('profile-web').click();
  const currentHeading = page.frameLocator('iframe[title="Visual HTML canvas"]').locator('h1').first();
  await currentHeading.click();
  await currentHeading.fill('Unsaved local report');
  await currentHeading.press('Tab');
  const importedFile = {
    name: 'generated-report.html',
    mimeType: 'text/html',
    buffer: Buffer.from('<!doctype html><html><head><title>Imported report</title></head><body><main><h1 id="imported-title">Imported AI report</h1><p>Editable source-backed content.</p></main></body></html>')
  };
  await page.getByLabel('Import HTML file').setInputFiles(importedFile);

  let dialog = page.getByRole('dialog', { name: 'Import generated-report.html' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Replace Responsive web with this HTML document.');
  await expect(dialog).toContainText('This replaces your current unsaved work.');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await page.getByLabel('Import HTML file').setInputFiles(importedFile);
  dialog = page.getByRole('dialog', { name: 'Import generated-report.html' });
  await dialog.getByRole('button', { name: 'Import HTML' }).click();

  await expect(page.frameLocator('iframe[title="Visual HTML canvas"]').locator('#imported-title')).toHaveText('Imported AI report');
  await expect(page.locator('.vhe-notice')).toHaveCount(0);
  const importToast = page.locator('.vhe-toast');
  await expect(importToast).toContainText('Imported generated-report.html.');
  await expect(importToast).toHaveCount(0, { timeout: 5_000 });
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.frameLocator('iframe[title="Visual HTML canvas"]').locator('#imported-title')).toHaveCount(0);
  await expect(page.frameLocator('iframe[title="Visual HTML canvas"]').locator('h1').first()).toHaveText('Unsaved local report');
});

test('shows real table descendants through browser-inserted wrappers after import', async ({ page }) => {
  const email = `<!doctype html><html><body>
    <table id="email-shell" role="presentation"><tr id="hero-row"><td id="hero-cell">
      <table id="content-table" role="presentation"><tr id="content-row"><td id="content-cell"><h1>Imported table heading</h1></td></tr></table>
    </td></tr></table>
  </body></html>`;
  await page.getByLabel('Import HTML file').setInputFiles({
    name: 'table-email.html',
    mimeType: 'text/html',
    buffer: Buffer.from(email)
  });
  await page.getByRole('dialog').getByRole('button', { name: 'Import HTML' }).click();

  const shell = page.getByRole('treeitem', { name: 'Table: email-shell (table)' });
  const heroRow = page.getByRole('treeitem', { name: 'Row: hero-row (tr)' });
  const heroCell = page.getByRole('treeitem', { name: 'Cell: hero-cell (td)' });
  const contentTable = page.getByRole('treeitem', { name: 'Table: content-table (table)' });
  const contentCell = page.getByRole('treeitem', { name: 'Cell: content-cell (td)' });
  const heading = page.getByRole('treeitem', { name: 'Heading: “Imported table heading” (h1)' });

  await expect(shell).toBeVisible();
  await expect(heroRow).toBeVisible();
  await expect(heroCell).toBeVisible();
  await expect(contentTable).toBeVisible();
  await expect(contentCell).toBeVisible();
  await expect(heading).toBeVisible();
  await expect(page.getByRole('treeitem', { name: /tbody/ })).toHaveCount(0);

  await heroCell.getByRole('button', { name: 'Select Cell: hero-cell (td)' }).click();
  await expect(heroCell).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.vhe-inspector__title code')).toHaveText('td');
});

test('changes the fill of an imported email CTA that uses background shorthand', async ({ page }) => {
  const email = `<!doctype html><html><body>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 10px 0 12px 0; color: #ad0101">
      <tr><td align="center">
        <a id="imported-cta" href="{{landing_page_link}}" style="display: inline-block; padding: 12px 22px; background: #007ee5; color: #fffafa; text-decoration: none; border-radius: 4px; font-weight: 600; font-size: 15px">View file</a>
      </td></tr>
    </table>
  </body></html>`;
  await page.getByLabel('Import HTML file').setInputFiles({
    name: 'email-cta.html',
    mimeType: 'text/html',
    buffer: Buffer.from(email)
  });
  await page.getByRole('dialog').getByRole('button', { name: 'Import HTML' }).click();

  const ctaTreeItem = page.getByRole('treeitem', { name: 'Link: imported-cta (a)' });
  const cta = page.frameLocator('iframe[title="Visual HTML canvas"]').locator('#imported-cta');
  await cta.click();
  await expect(ctaTreeItem).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.vhe-inspector__title')).toContainText('Link');
  await cta.press('Escape');
  await expect(page.locator('.vhe-inspector__title code')).toHaveText('a');
  await expect(page.locator('[data-style-property="background-color"] input[aria-label="Fill"]')).toHaveValue('#007ee5');

  const fill = page.locator('[data-style-property="background-color"] input[aria-label="Fill"]');
  await fill.fill('#d946ef');
  await fill.press('Enter');
  await expect(cta).toHaveCSS('background-color', 'rgb(217, 70, 239)');

  await page.getByRole('button', { name: 'Source' }).click();
  const source = await page.getByLabel('HTML source').inputValue();
  expect(source).toContain('background: #007ee5');
  expect(source).toContain('background-color: #d946ef');
});

test('imports a Claude-style multi-slide HTML deck', async ({ page }) => {
  await page.getByTestId('profile-slides').click();
  const deck = `<!doctype html><html><head><title>Imported workshop</title></head><body>
    <deck-stage width="1280" height="720">
      <section id="opening"><h1>Opening idea</h1></section>
      <section id="closing"><h1>Closing idea</h1></section>
    </deck-stage>
  </body></html>`;
  await page.getByLabel('Import HTML file').setInputFiles({
    name: 'workshop-deck.html',
    mimeType: 'text/html',
    buffer: Buffer.from(deck)
  });

  const dialog = page.getByRole('dialog', { name: 'Import Imported workshop' });
  await expect(dialog).toContainText('Replace the current deck with 2 slides');
  await dialog.getByRole('button', { name: 'Import HTML' }).click();

  await expect(page.locator('.vhe-deck-item')).toHaveCount(2);
  await expect(page.frameLocator('iframe[title="Visual HTML canvas"]').getByRole('heading', { name: 'Opening idea' })).toBeVisible();
  await page.getByRole('option', { name: '2. Closing idea' }).click();
  await expect(page.frameLocator('iframe[title="Visual HTML canvas"]').getByRole('heading', { name: 'Closing idea' })).toBeVisible();
  await expect(page.locator('.vhe-notice')).toHaveCount(0);
  await expect(page.locator('.vhe-toast')).toContainText('Imported 2 slides from workshop-deck.html.');
});

test('inserts an image file as a source-backed data URL', async ({ page }) => {
  await page.getByLabel('Choose image file').setInputFiles('tests/fixtures/test-image.svg');
  const image = page.frameLocator('iframe[title="Visual HTML canvas"]').locator('img[alt="test-image"]');
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute('src', /^data:image\/svg\+xml;base64,/);
  await expect(page.getByText('0 validation issues')).toBeVisible();
});

test('applies source edits and exports the exact source document', async ({ page }) => {
  await page.getByRole('button', { name: 'Source' }).click();
  const source = '<!doctype html><html><head><title>Edited</title></head><body><h1 style="color: #6558f5;">Source mode works</h1></body></html>';
  await page.getByLabel('HTML source').fill(source);
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.frameLocator('iframe[title="Visual HTML canvas"]').locator('h1')).toHaveText('Source mode works');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export HTML' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('visual-html-email.html');
  await expect(page.getByRole('status')).toContainText('Exported');
});

test('blocks export when source violates the configured HTML policy', async ({ page }) => {
  await page.getByRole('button', { name: 'Source' }).click();
  await page.getByLabel('HTML source').fill('<!doctype html><html><body><script>alert(1)</script><h1>Safe preview</h1></body></html>');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('1 validation issue')).toBeVisible();
  await page.getByRole('button', { name: 'Export HTML' }).click();
  await expect(page.locator('.vhe-notice')).toContainText('Export blocked by 1 policy issue');
});

test('supports the controlled HtmlEditor API without recreating its controller', async ({ page }) => {
  await page.goto('/#/controlled');
  await expect(page.getByTestId('visual-html-editor')).toBeVisible();
  const controllerId = await page.getByTestId('controlled-controller').textContent();
  expect(controllerId).toMatch(/^vhe-editor-/);

  const heading = page.frameLocator('iframe[title="Visual HTML canvas"]').locator('h1');
  await heading.click();
  await expect(page.getByTestId('controlled-selection')).toHaveText('h1');
  await heading.fill('The host receives one committed change.');
  await heading.press('Tab');
  await expect(page.getByTestId('controlled-changes')).toHaveText('1 changes');
  await expect(page.getByTestId('controlled-dirty')).toHaveText('dirty');
  await expect(heading).toHaveText('The host receives one committed change.');

  await page.getByRole('button', { name: 'Create checkpoint' }).click();
  await expect(page.getByTestId('controlled-dirty')).toHaveText('clean');
  await page.getByRole('button', { name: 'Replace externally' }).click();
  await expect(page.frameLocator('iframe[title="Visual HTML canvas"]').locator('h1')).toHaveText('External value replaced the document.');
  await expect(page.getByTestId('controlled-controller')).toHaveText(controllerId!);
  await expect(page.getByTestId('controlled-changes')).toHaveText('1 changes');
  await expect(page.getByTestId('controlled-dirty')).toHaveText('clean');

  await page.getByLabel('Import HTML file').setInputFiles({
    name: 'controlled-import.html',
    mimeType: 'text/html',
    buffer: Buffer.from('<!doctype html><html><body><h1>Imported through controlled React</h1></body></html>')
  });
  await page.getByRole('dialog').getByRole('button', { name: 'Import HTML' }).click();
  await expect(page.frameLocator('iframe[title="Visual HTML canvas"]').locator('h1')).toHaveText('Imported through controlled React');
  await expect(page.getByTestId('controlled-changes')).toHaveText('2 changes');
  await expect(page.getByTestId('controlled-controller')).toHaveText(controllerId!);
});



