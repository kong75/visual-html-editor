import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/#/editor');
  await expect(page.getByTestId('visual-html-editor')).toBeVisible();
});

test('exposes named controls, landmarks, and unique ids', async ({ page }) => {
  await expect(page.getByRole('tablist', { name: 'Content profile' })).toBeVisible();
  await expect(page.getByRole('tree', { name: 'Document structure' })).toBeVisible();
  await expect(page.getByRole('toolbar', { name: 'Editing tools' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: /Viewport:/ })).toBeVisible();

  const audit = await page.getByTestId('visual-html-editor').evaluate((root) => {
    const visible = (element: HTMLElement) => {
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && element.getAttribute('aria-hidden') !== 'true';
    };
    const controls = [...root.querySelectorAll<HTMLElement>('button, input, textarea, select')]
      .filter((element) => visible(element) && !(element instanceof HTMLInputElement && ['hidden', 'file'].includes(element.type)));
    const unnamed = controls.filter((element) => {
      const labelledBy = element.getAttribute('aria-labelledby');
      const labelledText = labelledBy
        ? labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim()
        : '';
      return !(
        element.getAttribute('aria-label')?.trim() || labelledText || element.getAttribute('title')?.trim() ||
        element.textContent?.trim() || (element instanceof HTMLInputElement && element.placeholder.trim())
      );
    }).map((element) => element.outerHTML.slice(0, 160));
    const ids = [...root.querySelectorAll<HTMLElement>('[id]')].map((element) => element.id);
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
    return { unnamed, duplicateIds: [...new Set(duplicateIds)] };
  });

  expect(audit.unnamed).toEqual([]);
  expect(audit.duplicateIds).toEqual([]);
});

test('supports keyboard entry, visible focus, and Escape from inline editing', async ({ page }) => {
  await page.getByTestId('profile-email').focus();
  await page.keyboard.press('Tab');
  const slidesTab = page.getByTestId('profile-slides');
  await expect(slidesTab).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(slidesTab).toHaveAttribute('aria-selected', 'true');

  const focusStyle = await slidesTab.evaluate((element) => getComputedStyle(element).boxShadow);
  expect(focusStyle).not.toBe('none');

  const heading = page.frameLocator('iframe[title="Visual HTML canvas"]').locator('h1');
  await heading.click();
  await expect(heading).toHaveAttribute('contenteditable', 'true');
  await heading.press('Escape');
  await expect(heading).not.toHaveAttribute('contenteditable', 'true');
});

test('keeps control targets usable at narrow viewport size', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const controls = page.locator('.vhe-toolbar button:visible, .vhe-inspector__tools button:visible');
  const undersized = await controls.evaluateAll((elements) => elements.flatMap((element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width >= 28 && rect.height >= 28) return [];
    return [{
      name: element.getAttribute('aria-label') || element.textContent?.trim() || element.getAttribute('title') || element.tagName,
      width: rect.width,
      height: rect.height
    }];
  }));
  expect(undersized).toEqual([]);
});
