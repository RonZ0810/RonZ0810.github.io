import { devices, expect, test } from '@playwright/test';

test.use({ ...devices['Pixel 5'] });

test('mobile layout keeps the reading view available', async ({ page }, testInfo) => {
  await page.goto('/hobbies/');
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.locator('#site-header')).toBeVisible();
  await testInfo.attach('hobbies-mobile', { body: await page.screenshot(), contentType: 'image/png' });
});
