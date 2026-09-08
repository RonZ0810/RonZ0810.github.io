import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

async function ready(page) {
  await page.goto('/');
  await expect(page.locator('body')).toHaveClass(/scene-ready/);
  await expect(page.locator('[data-study-scene]')).toHaveAttribute('data-assets', 'ready', { timeout: 45_000 });
}

test('office controls manipulate objects and persist across routes', async ({ page }) => {
  await ready(page);
  await page.locator('[data-office-lamp]').click();
  await page.locator('[data-office-notebook]').click();
  await expect(page.locator('[data-study-scene]')).toHaveAttribute('data-lamp', 'off');
  await expect(page.locator('[data-study-scene]')).toHaveAttribute('data-notebook', 'open');
  await page.locator('#site-header a[href="/projects/"]').click();
  await expect(page).toHaveURL(/\/projects\/$/);
  await expect(page.locator('[data-office-lamp]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-office-notebook]')).toHaveAttribute('aria-pressed', 'true');
  await page.goBack();
  await expect(page.locator('body')).toHaveAttribute('data-route', 'home');
  await expect(page.locator('[data-office-notebook]')).toHaveAttribute('aria-pressed', 'true');
});

test('dragging the office rotates it without navigating, and reset restores the view', async ({ page }, testInfo) => {
  await ready(page);
  const scene = page.locator('[data-study-scene]');
  const initial = Number(await scene.getAttribute('data-view-angle'));
  const bounds = await scene.boundingBox();
  const x = bounds.x + bounds.width * 0.5, y = bounds.y + bounds.height * 0.72;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + 260, y - 45, { steps: 4 }); await page.mouse.up();
  await expect.poll(async () => Math.abs(Number(await scene.getAttribute('data-view-angle')) - initial)).toBeGreaterThan(1.3);
  await expect(page).toHaveURL(/\/$/);
  await page.screenshot({ path: testInfo.outputPath('office-rotated.png') });
  await page.locator('[data-office-reset]').click();
  await expect.poll(async () => Math.abs(Number(await scene.getAttribute('data-view-angle')) - initial)).toBeLessThan(0.01);
});

test('sculpture inspection separates object rotation from the room and supports Escape', async ({ page }) => {
  await ready(page);
  await page.locator('[data-office-motion]').click();
  await page.locator('[data-office-inspect]').click();
  const scene = page.locator('[data-study-scene]');
  await expect(scene).toHaveAttribute('data-inspection', 'sculpture');
  await expect(page.locator('.home-intro')).toBeHidden();
  await expect(scene).toBeFocused();
  const angle = await scene.getAttribute('data-view-angle');
  await scene.press('ArrowRight');
  await expect(scene).toHaveAttribute('data-view-angle', angle);
  await expect(page.locator('[data-object-hint]')).toContainText('sculpture');
  await scene.press('Escape');
  await expect(scene).toHaveAttribute('data-inspection', 'none');
  await expect(page.locator('.home-intro')).toBeVisible();
  await expect(page.locator('[data-office-inspect]')).toBeFocused();
});

test('keyboard rotation, zoom, and reduced motion remain usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  const scene = page.locator('[data-study-scene]');
  const before = await scene.getAttribute('data-view-angle');
  await scene.focus(); await scene.press('ArrowLeft'); await scene.press('+');
  await expect(scene).not.toHaveAttribute('data-view-angle', before);
  await expect(page.locator('[data-office-motion]')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#site-header a[href="/about/"]').click();
  await expect(page.locator('main h1')).toBeFocused();
  await expect(page.locator('[data-skip-motion]')).not.toHaveClass(/is-visible/);
});

test('rapid destination changes cannot replace the latest page with stale content', async ({ page }) => {
  await ready(page);
  await page.route('**/about/', async route => {
    await new Promise(resolve => setTimeout(resolve, 350)); await route.continue().catch(() => {});
  });
  await page.locator('#site-header a[href="/about/"]').click();
  await page.locator('#site-header a[href="/education/"]').click();
  await expect(page).toHaveURL(/\/education\/$/);
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'education');
  await expect(page.locator('main h1')).toBeFocused();
});

test('failed decorative assets leave a functional office and content', async ({ page }) => {
  await page.route('**/office/*.glb', route => route.abort());
  await page.goto('/');
  await expect(page.locator('body')).toHaveClass(/scene-ready/);
  await expect(page.locator('[data-study-scene]')).toHaveAttribute('data-assets', 'partial');
  await page.locator('[data-office-lamp]').click();
  await expect(page.locator('[data-office-lamp]')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#site-header a[href="/hobbies/"]').click();
  await expect(page).toHaveURL(/\/hobbies\/$/);
});

test('static office poster and route links work without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage(); await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.locator('[data-study-scene]')).toHaveCSS('background-image', /room-poster\.png/);
  const poster = await page.request.get('/office/room-poster.png');
  expect(poster.ok()).toBe(true);
  expect(poster.headers()['content-type']).toContain('image/png');
  await page.locator('#site-header a[href="/projects/"]').click();
  await expect(page).toHaveURL(/\/projects\/$/);
  await expect(page.locator('main h1')).toBeVisible(); await context.close();
});

test('WebGL context loss exposes the poster and leaves route navigation available', async ({ page }) => {
  await ready(page);
  await page.locator('canvas.study-canvas').evaluate(canvas => {
    canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext();
  });
  await expect(page.locator('body')).toHaveClass(/scene-unavailable/);
  await expect(page.locator('[data-office-lamp]')).toBeDisabled();
  await page.locator('#site-header a[href="/about/"]').click();
  await expect(page).toHaveURL(/\/about\/$/);
  await expect(page.locator('main h1')).toBeVisible();
});

test('capture desktop room, poster, inner page, and frame timing', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await ready(page);
  await page.screenshot({ path: testInfo.outputPath('office-desktop.png') });
  await page.locator('[data-study-scene]').screenshot({ path: testInfo.outputPath('room-poster.png'), style: '.home-intro, .hotspot-layer { visibility: hidden !important; }' });
  await page.locator('[data-study-scene]').focus();
  await page.keyboard.press('ArrowRight');
  const samples = await page.evaluate(async () => {
    const values = []; let previous;
    for (let i = 0; i < 45; i++) {
      const time = await new Promise(requestAnimationFrame);
      if (previous) values.push(time - previous); previous = time;
    }
    const assets = performance.getEntriesByType('resource').filter(entry => entry.name.includes('/office/'));
    return { frameMedianMs: values.sort((a, b) => a - b)[Math.floor(values.length / 2)], officeTransferredBytes: assets.reduce((sum, entry) => sum + entry.transferSize, 0) };
  });
  await writeFile(testInfo.outputPath('performance.json'), JSON.stringify(samples, null, 2));
  await testInfo.attach('performance', { body: JSON.stringify(samples, null, 2), contentType: 'application/json' });
  await page.locator('#site-header a[href="/projects/"]').click();
  await expect(page.locator('[data-skip-motion]')).not.toHaveClass(/is-visible/);
  await page.screenshot({ path: testInfo.outputPath('office-projects.png') });
});

test('mobile room fits, controls work, and the document scrolls', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await context.newPage(); await ready(page);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('office-mobile.png'), fullPage: true });
  await page.locator('[data-office-lamp]').tap();
  await expect(page.locator('[data-office-lamp]')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('.directory-links a[href="/hobbies/"]').scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
  await expect(page.locator('#site-header')).toBeInViewport();
  await page.locator('.directory-links a[href="/hobbies/"]').tap();
  await expect(page).toHaveURL(/\/hobbies\/$/);
  await page.locator('.object-list').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-skip-motion]')).not.toHaveClass(/is-visible/);
  await page.screenshot({ path: testInfo.outputPath('office-mobile-hobbies.png'), fullPage: true });
  await context.close();
});
