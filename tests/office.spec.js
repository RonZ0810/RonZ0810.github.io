import { expect, test } from '@playwright/test';
import { sceneRoutes } from '../src/scene-routes.js';

async function ready(page, route = '/') {
  await page.goto(route);
  await expect(page.locator('body')).toHaveClass(/scene-ready/);
  await expect(page.locator('[data-study-scene]')).toHaveAttribute('data-assets', 'ready', { timeout: 45_000 });
}
const scene = page => page.locator('[data-study-scene]');
async function position(page) { return scene(page).evaluate(el => ({ x: Number(el.dataset.playerX), z: Number(el.dataset.playerZ), height: Number(el.dataset.eyeHeight) })); }
async function arrived(page, key) {
  const goal = sceneRoutes[key].position;
  // Match all fields of one rendered frame with Playwright's native auto-wait.
  await expect(page.locator(`[data-study-scene][data-player-x="${goal.x.toFixed(3)}"][data-player-z="${goal.z.toFixed(3)}"][data-eye-height="1.65"][data-walking="false"][data-zone="${goal.z > 2.5 ? 'hallway' : 'office'}"]`)).toBeAttached();
}
async function motionOff(page) { if (await page.locator('[data-office-motion]').getAttribute('aria-pressed') === 'true') await page.locator('[data-office-motion]').click(); }
const posterStyle = '#page-content,.office-caption,.office-controls,.hotspot-layer,.motion-control,.walk-stick{visibility:hidden!important}';

test('Home starts in the hallway and entering keeps the camera at standing height', async ({ page }) => {
  await ready(page);
  await arrived(page, 'home');
  await page.locator('[data-office-enter]').click(); await arrived(page, 'entry');
  await expect(page).toHaveURL(/\/$/); await expect(page.locator('.home-intro')).toBeHidden();
  await page.locator('.site-nav a[href="/"]').click(); await arrived(page, 'home');
  await expect(page.locator('.home-intro')).toBeVisible();
  await expect(page.locator('[data-office-enter]')).toBeEnabled();
});

test('capture the hallway entrance and static Home poster', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await ready(page);
  await page.screenshot({ path: testInfo.outputPath('first-person-home.png') });
  await scene(page).screenshot({ path: testInfo.outputPath('hallway-poster.png'), style: posterStyle });
});

test('looking turns in place and manual walking keeps standing height', async ({ page }) => {
  await ready(page, '/projects/'); await page.locator('[data-panel-close]').click();
  const start = await position(page), yaw = await scene(page).getAttribute('data-view-angle');
  await scene(page).press('ArrowLeft'); await expect(scene(page)).not.toHaveAttribute('data-view-angle', yaw);
  expect(await position(page)).toEqual(start);
  await page.keyboard.down('w');
  await expect.poll(async () => (await position(page)).z).toBeLessThan(start.z - 0.05);
  await page.keyboard.up('w');
  expect((await position(page)).height).toBe(1.65);
});

test('losing scene focus clears held walking input', async ({ page }) => {
  await ready(page, '/projects/'); await page.locator('[data-panel-close]').click();
  await page.keyboard.down('w'); await page.locator('[data-contact-open]').focus();
  const stopped = await position(page);
  await page.locator('[data-contact-open]').click(); await page.locator('dialog').press('Escape'); await page.keyboard.up('w');
  expect(await position(page)).toEqual(stopped);
});

test('every portfolio destination opens its panel at a valid standing viewpoint', async ({ page }) => {
  await ready(page); await motionOff(page);
  for (const key of ['about', 'projects', 'experience', 'education', 'hobbies']) {
    await page.locator(`#site-header a[href="/${key}/"]`).click();
    await expect(page.locator('body')).toHaveAttribute('data-route', key); await arrived(page, key);
    await expect(page.locator('main h1')).toBeFocused();
    await page.locator('[data-panel-close]').click(); await expect(page.locator('main')).toBeHidden();
  }
});

test('lamp, notebook, and held sculpture remain first person across routes', async ({ page }) => {
  await ready(page); await motionOff(page);
  await page.locator('[data-office-lamp]').click(); await expect(scene(page)).toHaveAttribute('data-lamp', 'off');
  await page.locator('[data-office-notebook]').click(); await expect(scene(page)).toHaveAttribute('data-notebook', 'open');
  await page.locator('[data-office-inspect]').click(); await expect(scene(page)).toHaveAttribute('data-inspection', 'sculpture');
  const before = await position(page), yaw = await scene(page).getAttribute('data-view-angle');
  await scene(page).press('ArrowRight'); await expect(scene(page)).toHaveAttribute('data-view-angle', yaw);
  expect(await position(page)).toEqual(before); await scene(page).press('Escape');
  await expect(scene(page)).toHaveAttribute('data-inspection', 'none'); expect(await position(page)).toEqual(before);
  await page.locator('#site-header a[href="/education/"]').click(); await arrived(page, 'education');
  await page.locator('[data-panel-close]').click();
  await expect(page.locator('[data-office-lamp]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-office-notebook]')).toHaveAttribute('aria-pressed', 'true');
});

test('manual movement cancels automatic travel', async ({ page }) => {
  await ready(page); await page.locator('[data-office-enter]').click();
  await scene(page).press('s'); await expect(scene(page)).toHaveAttribute('data-walking', 'false');
  expect((await position(page)).height).toBe(1.65);
});

test('newer destinations replace older walking paths', async ({ page }) => {
  await ready(page);
  await page.locator('#site-header a[href="/education/"]').click();
  await page.locator('#site-header a[href="/projects/"]').click();
  await expect(page).toHaveURL(/\/projects\/$/);
  await arrived(page, 'projects');
});

test('reading panels isolate walking input, preserve the URL, and reopen', async ({ page }) => {
  await ready(page, '/projects/'); const before = await position(page);
  await page.locator('main h1').press('w'); expect(await position(page)).toEqual(before);
  await page.locator('[data-panel-close]').click(); await expect(page.locator('main')).toBeHidden();
  await expect(page).toHaveURL(/\/projects\/$/); expect(await position(page)).toEqual(before);
  await page.locator('[data-office-read]').click(); await expect(page.locator('main')).toBeVisible();
  await page.locator('main h1').press('Escape'); await expect(page.locator('main')).toBeHidden();
});

test('failed decorative models retain navigation and the enclosed office', async ({ page }) => {
  await page.route('**/office/*.glb', route => route.abort()); await page.goto('/');
  await expect(page.locator('body')).toHaveClass(/scene-ready/);
  await expect(scene(page)).toHaveAttribute('data-assets', 'partial'); await motionOff(page);
  await page.locator('#site-header a[href="/hobbies/"]').click(); await arrived(page, 'hobbies');
  await expect(page.locator('main h1')).toBeVisible();
});

test('static first-person posters and route links work without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false }); const page = await context.newPage(); await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  for (const poster of ['hallway-poster.png', 'room-poster.png']) { const response = await page.request.get(`/office/${poster}`); expect(response.ok()).toBe(true); expect(response.headers()['content-type']).toContain('image/png'); }
  await page.locator('#site-header a[href="/projects/"]').click(); await expect(page.locator('main h1')).toBeVisible(); await context.close();
});

test('WebGL context loss returns to readable content and a static poster', async ({ page }) => {
  await ready(page, '/about/');
  await page.locator('canvas').evaluate(canvas => canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await expect(page.locator('body')).toHaveClass(/scene-unavailable/); await expect(page.locator('main h1')).toBeVisible();
  await expect(page.locator('canvas')).toBeHidden();
  await page.locator('#site-header a[href="/projects/"]').click(); await expect(page).toHaveURL(/\/projects\/$/);
});

test('capture the interior, window scenery, and ceiling at standing height', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await ready(page, '/projects/');
  await page.screenshot({ path: testInfo.outputPath('first-person-panel.png') });
  await page.locator('[data-panel-close]').click();
  await scene(page).screenshot({ path: testInfo.outputPath('room-poster.png'), style: posterStyle });
  await scene(page).press('ArrowLeft'); await scene(page).press('ArrowLeft');
  await page.screenshot({ path: testInfo.outputPath('first-person-window.png') });
  for (let i = 0; i < 8; i++) await scene(page).press('ArrowUp');
  await page.screenshot({ path: testInfo.outputPath('first-person-ceiling.png') });
  expect((await position(page)).height).toBe(1.65);
});

test('mobile thumbstick moves the player and the bottom sheet scrolls independently', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await context.newPage(); await ready(page);
  await page.screenshot({ path: testInfo.outputPath('first-person-mobile-home.png') });
  const stick = await page.locator('[data-walk-stick]').boundingBox();
  const touch = await context.newCDPSession(page), x = stick.x + stick.width / 2, y = stick.y + stick.height / 2;
  const before = await position(page);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 0, x, y }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 0, x, y: y - 25 }] });
  await expect.poll(async () => (await position(page)).z).toBeLessThan(before.z - 0.05);
  const yaw = await scene(page).getAttribute('data-view-angle');
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 0, x, y: y - 25 }, { id: 1, x: 280, y: 230 }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 0, x, y: y - 25 }, { id: 1, x: 235, y: 240 }] });
  await expect(scene(page)).not.toHaveAttribute('data-view-angle', yaw);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.locator('#site-header a[href="/hobbies/"]').tap(); await expect(page.locator('body')).toHaveClass(/panel-open/);
  await page.locator('.object-list').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect.poll(() => page.locator('main').evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath('first-person-mobile-panel.png') });
  await page.locator('[data-panel-close]').tap(); await expect(page.locator('main')).toBeHidden();
  await context.close();
});
