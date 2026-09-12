import { expect, test, type Page } from '@playwright/test';

async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const client = await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
  for (let step = 1; step <= 4; step += 1) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: from.x + (to.x - from.x) * step / 4, y: from.y + (to.y - from.y) * step / 4 }]
    });
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await client.detach();
}

test('supports touch-pointer drag and resize on slide content', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP touch injection is available only in Chromium; mouse/trackpad pointer paths run in all engines.');
  await page.goto('/#/editor');
  await page.getByTestId('profile-slides').click();
  const movable = page.frameLocator('iframe[title="Visual HTML canvas"]').getByText('Module 03 - Product thinking', { exact: true });
  const box = await movable.boundingBox();
  expect(box).not.toBeNull();
  await touchDrag(page, { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 }, { x: box!.x + box!.width / 2 + 44, y: box!.y + box!.height / 2 + 26 });
  await expect(movable).toHaveAttribute('style', /left:\s*\d+px/);
  await expect(movable).toHaveAttribute('style', /top:\s*\d+px/);

  const resize = page.getByRole('button', { name: 'Resize element' });
  const resizeBox = await resize.boundingBox();
  expect(resizeBox).not.toBeNull();
  await touchDrag(page, { x: resizeBox!.x + resizeBox!.width / 2, y: resizeBox!.y + resizeBox!.height / 2 }, { x: resizeBox!.x + 36, y: resizeBox!.y + 24 });
  await expect(movable).toHaveAttribute('style', /width:\s*\d+px/);
  await expect(movable).toHaveAttribute('style', /height:\s*\d+px/);
});
