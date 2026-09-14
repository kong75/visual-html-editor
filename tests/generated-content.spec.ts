import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { compatibilityFixtures } from './fixtures/compatibility/manifest';

for (const fixture of compatibilityFixtures) {
  test(`renders and edits generated ${fixture.profile} fixture: ${fixture.id}`, async ({ page }) => {
    const html = await readFile(path.join(process.cwd(), 'tests', 'fixtures', 'compatibility', fixture.path), 'utf8');
    await page.goto('/#/editor');
    await page.getByTestId(`profile-${fixture.profile}`).click();
    await page.getByRole('button', { name: 'Source' }).click();
    await page.getByLabel('HTML source').fill(html);
    await page.getByRole('button', { name: 'Apply' }).click();

    const frame = page.frameLocator('iframe[title="Visual HTML canvas"]');
    const target = frame.locator(`#${fixture.textEdit.elementId}`);
    await expect(target).toBeVisible();
    await target.click();
    await expect(target).toHaveAttribute('contenteditable', 'true');
    await target.fill(fixture.textEdit.replacement);
    await target.press('Tab');
    await expect(target).toHaveText(fixture.textEdit.replacement);

    await page.getByRole('button', { name: 'Source' }).click();
    const source = await page.getByLabel('HTML source').inputValue();
    expect(source).toContain(fixture.textEdit.replacement);
    for (const token of fixture.expectedTokens) expect(source).toContain(token);
    expect(source).not.toContain('data-vhe-node');
  });
}
