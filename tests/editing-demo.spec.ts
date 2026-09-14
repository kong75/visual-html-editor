import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

async function openClockDrivenDemo(page: import('@playwright/test').Page) {
  const start = new Date('2026-01-01T00:00:00Z');
  await page.clock.install({ time: start });
  // Freeze automatic wall-clock advancement before the application starts. Slow
  // browser actions must not move the playhead past the frame under assertion.
  await page.clock.pauseAt(new Date(start.getTime() + 1000));
  await page.goto('/');
  // Native CSS transitions do not share the synthetic requestAnimationFrame clock.
  // Keep the JavaScript playhead and all intermediate-state assertions active.
  await page.addStyleTag({ content: '.editing-demo *, .editing-demo *::before, .editing-demo *::after { transition: none !important; }' });
}

test('plays synchronized edits, pauses, resumes, and finishes without looping', async ({ page }) => {
  test.setTimeout(60_000); // Full demo sequences include multiple chapters and pauses.
  await openClockDrivenDemo(page);
  const demo = page.locator('.editing-demo');
  await expect(demo).toHaveAttribute('data-playing', 'false');
  await page.clock.runFor(2000);
  await expect(page.locator('.demo-time')).toContainText('00');
  await page.locator('.edit-stage').scrollIntoViewIfNeeded();
  await expect(demo).toHaveAttribute('data-playing', 'true');
  await page.clock.runFor(4700);
  await expect(page.locator('.edit-heading h3')).toContainText('creative space.');
  await page.getByRole('button', { name: 'Pause editing demo', exact: true }).click();
  const paused = await page.locator('.demo-time').textContent();
  const position = await page.locator('.edit-cursor').getAttribute('style');
  await page.clock.runFor(2000);
  await expect(page.locator('.demo-time')).toHaveText(paused!);
  await expect(page.locator('.edit-cursor')).toHaveAttribute('style', position!);
  await page.getByRole('button', { name: 'Play editing demo', exact: true }).click();
  await page.clock.runFor(9000);
  await expect(page.locator('.edit-document')).toHaveAttribute('data-serif', 'true');
  await expect(page.locator('[data-cursor="size"] strong')).toContainText('56');
  await expect(page.locator('.edit-heading h3')).toHaveCSS('color', 'rgb(120, 81, 169)');
  await page.clock.runFor(4000);
  await expect(page.locator('[data-cursor="padding"] strong')).toContainText('38');
  await page.clock.runFor(3500);
  await expect(page.locator('.edit-code-panel')).toHaveCSS('opacity', '1');
  await expect(page.locator('.edit-code-lines')).toContainText('creative space.');
  await expect(page.locator('.edit-code-lines')).toContainText('56px');
  await page.clock.runFor(9000);
  await expect(page.getByRole('button', { name: 'Replay editing demo', exact: true })).toBeVisible();
  await expect(demo).toHaveAttribute('data-playing', 'false');
  await expect(page.locator('.demo-time')).toHaveText('27/ 27s');
  await page.getByRole('button', { name: 'Replay editing demo', exact: true }).click();
  await expect(page.locator('.edit-heading h3')).toContainText('HTML editor.');
});

test('suspends playback offscreen and when the tab is hidden', async ({ page }) => {
  await openClockDrivenDemo(page);
  await page.locator('.edit-stage').scrollIntoViewIfNeeded();
  const demo = page.locator('.editing-demo');
  await expect(demo).toHaveAttribute('data-playing', 'true');
  await page.clock.runFor(2000);
  await page.locator('.landing-nav').scrollIntoViewIfNeeded();
  await expect(demo).toHaveAttribute('data-playing', 'false');
  const paused = await page.locator('.demo-time').textContent();
  await page.clock.runFor(4000);
  await expect(page.locator('.demo-time')).toHaveText(paused!);
  await page.locator('.edit-stage').scrollIntoViewIfNeeded();
  await expect(demo).toHaveAttribute('data-playing', 'true');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(demo).toHaveAttribute('data-playing', 'false');
  const hiddenTime = await page.locator('.demo-time').textContent();
  await page.clock.runFor(3000);
  await expect(page.locator('.demo-time')).toHaveText(hiddenTime!);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(demo).toHaveAttribute('data-playing', 'true');
});

test('reduced-motion chapters and format changes render consistent canvas and HTML', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('.editing-demo').scrollIntoViewIfNeeded();
  await expect(page.locator('.editing-demo')).toHaveAttribute('data-playing', 'false');
  await expect(page.locator('.edit-cursor')).toBeHidden();
  for (const [format, text, file, kind, sourceCheck] of [
    ['Learning slides', 'Make it visual.', 'visual-editing-deck.html', 'slides', 'width: 470px'],
    ['Web content', 'Open the playground', 'editor-workspace.html', 'web', '@media (max-width: 600px)'],
    ['Email templates', 'creative space.', 'welcome-email.html', 'email', '38px']
  ]) {
    await page.getByRole('button', { name: new RegExp(format) }).click();
    await expect(page.locator('.editing-demo')).toHaveAttribute('data-format', kind);
    await expect(page.locator('.demo-brand small')).toHaveText(file);
    await expect(page.locator('.edit-document')).toContainText(text);
    await page.getByRole('button', { name: '04 HTML', exact: true }).click();
    await expect(page.locator('.edit-code-lines')).toContainText(text);
    await expect(page.locator('.edit-code-lines')).toContainText(sourceCheck);
    await page.getByRole('button', { name: kind === 'web' ? '01 CTA' : '01 Rewrite', exact: true }).click();
    await expect(page.locator('.editing-demo')).toHaveAttribute('data-playing', 'false');
  }
});

test('numeric drafts commit on Enter and color gestures follow the picker handles', async ({ page }) => {
  test.setTimeout(60_000); // Full demo sequences include multiple chapters and pauses.
  await openClockDrivenDemo(page);
  await page.locator('.edit-stage').scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: '02 Restyle', exact: true }).click();
  await page.clock.runFor(3800);
  await expect(page.locator('[data-cursor="size"] .edit-number-caret')).toBeAttached();
  await expect(page.locator('.edit-heading h3')).toHaveCSS('font-size', '36px');
  await page.clock.runFor(1100);
  await expect(page.locator('[data-cursor="size"] .edit-input-hint')).toContainText('Applied');
  await expect(page.locator('.edit-heading h3')).toHaveCSS('font-size', '56px');
  await page.getByRole('button', { name: '03 Refine', exact: true }).click();
  await page.clock.runFor(1850);
  await expect(page.locator('[data-cursor="padding"] .edit-number-caret')).toBeAttached();
  await expect(page.locator('.edit-document-content')).toHaveCSS('padding-top', '22px');
  await page.clock.runFor(1000);
  await expect(page.locator('.edit-document-content')).toHaveCSS('padding-top', '38px');
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole('button', { name: '02 Restyle', exact: true }).click();
    await page.clock.runFor(7550);
    await page.getByRole('button', { name: 'Pause editing demo', exact: true }).click();
    await expect(page.locator('.edit-color-picker')).toHaveCSS('opacity', '1');
    const handle = await page.locator('.edit-picker-spectrum > i').boundingBox();
    const cursor = await page.locator('.edit-cursor').boundingBox();
    expect(Math.abs(cursor!.x - handle!.x - handle!.width / 2)).toBeLessThan(3);
    expect(Math.abs(cursor!.y - handle!.y - handle!.height / 2)).toBeLessThan(3);
    const hex = await page.locator('.edit-picker-hex b').textContent();
    const rgb = [1, 3, 5].map((offset) => parseInt(hex!.slice(offset, offset + 2), 16));
    await expect(page.locator('.edit-picker-rgb b')).toHaveText(rgb.map(String));
    await expect(page.locator('.edit-heading h3')).toHaveCSS('color', `rgb(${rgb.join(', ')})`);
    const picker = await page.locator('.edit-color-picker').boundingBox();
    expect(picker!.x).toBeGreaterThanOrEqual(0);
    expect(picker!.x + picker!.width).toBeLessThanOrEqual(width);
  }
});

test('slides move and resize objects while web edits a button and reflows its page', async ({ page }) => {
  test.setTimeout(60_000); // Full demo sequences include multiple chapters and pauses.
  await openClockDrivenDemo(page);
  await page.locator('.edit-stage').scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: /Learning slides/ }).click();
  await page.getByRole('button', { name: '02 Move', exact: true }).click();
  const original = await page.locator('.demo-slide-heading').boundingBox();
  await page.clock.runFor(4200);
  const moved = await page.locator('.demo-slide-heading').boundingBox();
  expect(moved!.x).toBeGreaterThan(original!.x + 5);
  expect(moved!.y).toBeGreaterThan(original!.y + 5);
  await expect(page.locator('.demo-slide-inspector')).toContainText('144');
  await expect(page.locator('.demo-slide-inspector')).toContainText('205');
  await page.getByRole('button', { name: '03 Resize', exact: true }).click();
  const small = await page.locator('.demo-slide-card').boundingBox();
  await page.clock.runFor(3100);
  const large = await page.locator('.demo-slide-card').boundingBox();
  expect(large!.width).toBeGreaterThan(small!.width + 20);
  expect(large!.height).toBeGreaterThan(small!.height + 10);
  await expect(page.locator('.demo-slide-inspector')).toContainText('470');
  await expect(page.locator('.demo-slide-inspector')).toContainText('290');
  await page.getByRole('button', { name: '04 HTML', exact: true }).click();
  await page.clock.runFor(1000);
  await expect(page.locator('.edit-code-lines')).toContainText('left: 144px');
  await expect(page.locator('.edit-code-lines')).toContainText('width: 470px');

  await page.getByRole('button', { name: /Web content/ }).click();
  await page.locator('.edit-stage').scrollIntoViewIfNeeded();
  await expect(page.locator('.editing-demo')).toHaveAttribute('data-playing', 'true');
  await page.clock.runFor(4700);
  await expect(page.locator('.demo-web-cta')).toContainText('Open the playground');
  await page.getByRole('button', { name: '02 Style', exact: true }).click();
  await page.clock.runFor(8200);
  await expect(page.locator('.demo-web-cta')).toHaveCSS('border-radius', '12px');
  await expect(page.locator('.demo-web-cta')).toHaveCSS('background-color', 'rgb(36, 82, 59)');
  await page.getByRole('button', { name: '03 Reflow', exact: true }).click();
  const wide = await page.locator('.demo-web').boundingBox();
  await page.clock.runFor(2100);
  const narrow = await page.locator('.demo-web').boundingBox();
  expect(narrow!.width).toBeLessThan(wide!.width - 100);
  const card = await page.locator('.demo-web-card').boundingBox();
  const copy = await page.locator('.demo-web-copy').boundingBox();
  expect(card!.y).toBeGreaterThan(copy!.y + copy!.height);
  await expect(page.locator('.demo-web-viewports')).toContainText('390 px');
});

for (const width of [390, 1440]) {
  test(`cursor lands on the font control at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await openClockDrivenDemo(page);
    await page.locator('.edit-stage').scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: '02 Restyle', exact: true }).click();
    await page.clock.runFor(790);
    await page.getByRole('button', { name: 'Pause editing demo', exact: true }).click();
    const target = await page.locator('[data-cursor="font"]').boundingBox();
    const cursor = await page.locator('.edit-cursor').boundingBox();
    expect(target).not.toBeNull(); expect(cursor).not.toBeNull();
    expect(cursor!.x).toBeGreaterThanOrEqual(target!.x);
    expect(cursor!.x).toBeLessThanOrEqual(target!.x + target!.width);
    expect(cursor!.y).toBeGreaterThanOrEqual(target!.y);
    expect(cursor!.y).toBeLessThanOrEqual(target!.y + target!.height);
  });
}

test('demo controls remain accessible and fit narrow screens', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 390, 768, 1024, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await page.locator('.editing-demo').scrollIntoViewIfNeeded();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow).toBe(false);
    const outside = await page.locator('.demo-player button, .demo-player a').evaluateAll((elements) => elements.filter((element) => { const box = element.getBoundingClientRect(); return box.x < 0 || box.right > innerWidth; }).length);
    expect(outside).toBe(0);
    for (const format of ['Learning slides', 'Web content', 'Email templates']) {
      await page.getByRole('button', { name: new RegExp(format) }).click();
      const documentBox = await page.locator('.edit-document').boundingBox();
      const canvasBox = await page.locator('.edit-canvas').boundingBox();
      expect(documentBox!.y + documentBox!.height).toBeLessThanOrEqual(canvasBox!.y + canvasBox!.height + 1);
      expect(documentBox!.width).toBeLessThanOrEqual(canvasBox!.width);
      if (format === 'Email templates') {
        const artworkBox = await page.locator('.edit-artwork').boundingBox();
        expect(artworkBox!.y + artworkBox!.height).toBeLessThanOrEqual(documentBox!.y + documentBox!.height + 1);
      }
    }
  }
  const audit = await new AxeBuilder({ page }).include('.editing-demo').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(audit.violations).toEqual([]);
  const first = page.getByRole('button', { name: '01 Rewrite', exact: true });
  await first.focus(); await page.keyboard.press('Enter');
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '02 Restyle', exact: true })).toBeFocused();
});
