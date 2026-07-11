import { expect, test } from '@playwright/test';

test('pinball campaign loads, shows its map, and starts its first level', async ({ page }) => {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/pinball/');
  await expect(page.locator('#game')).toBeVisible();

  await page.getByRole('button', { name: 'Campaign map —' }).click();
  await expect(page.locator('.map-node')).toHaveCount(10);
  await expect(page.locator('.map-node.boss')).toHaveCount(2);
  await page.getByRole('button', { name: 'Back —' }).click();
  await page.getByRole('button', { name: 'New campaign —' }).click();

  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#level-kicker')).toHaveText('LEVEL 01');
  await expect(page.locator('#level-name')).toHaveText('FIRST CONTACT');
  await expect(page.locator('#difficulty')).toHaveText('CALM');
  await expect(page.locator('#wave')).toHaveText('WAVE 1 / 1');
  await expect(page.locator('#phase')).toHaveText('PLUNGER 18%');

  await page.keyboard.down('Space');
  await page.waitForTimeout(250);
  await page.keyboard.up('Space');
  await expect(page.locator('#phase')).toHaveText('ATTACK');

  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(150);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(150);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test('pinball touch controls fit a portrait phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/pinball/');
  await page.getByRole('button', { name: 'New campaign —' }).click();
  await expect(page.locator('#touch-left')).toBeVisible();
  await expect(page.locator('#touch-right')).toBeVisible();
  await expect(page.locator('#touch-plunge')).toBeVisible();
  const shell = await page.locator('#shell').boundingBox();
  expect(shell.width).toBeLessThanOrEqual(390);
  expect(shell.height).toBeLessThanOrEqual(844);
});
