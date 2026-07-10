import { expect, test } from '@playwright/test';

const staticRoutes = [
  ['/', 'home'],
  ['/about/', 'about'],
  ['/projects/', 'projects'],
  ['/projects/project-01/', 'project-detail'],
  ['/projects/project-02/', 'project-detail'],
  ['/projects/project-03/', 'project-detail'],
  ['/experience/', 'experience'],
  ['/education/', 'education'],
  ['/education/school-01/', 'education-detail'],
  ['/education/school-02/', 'education-detail'],
  ['/education/school-03/', 'education-detail'],
  ['/hobbies/', 'hobbies'],
];

test.describe('static portfolio routes', () => {
  for (const [route, scene] of staticRoutes) {
    test(`renders ${route} directly`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('main h1')).toBeVisible();
      await expect(page.locator('body')).toHaveAttribute('data-scene', scene);
      await expect(page.locator('#site-header')).toBeVisible();
    });
  }
});

test('enhanced navigation updates static content and browser history', async ({ page }) => {
  await page.goto('/');
  const aboutLink = page.locator('#site-header a[href="/about/"]');
  await expect(aboutLink).toHaveCount(1);
  await aboutLink.click();
  await expect(page).toHaveURL(/\/about\/$/);
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'about');
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'home');
});

test('about annotations and contact dialog are keyboard accessible', async ({ page }) => {
  await page.goto('/about/');
  const annotation = page.getByRole('button', { name: 'Background Open note', exact: true });
  await expect(annotation).toHaveCount(1);
  await annotation.click();
  await expect(annotation).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#about-background')).toBeVisible();

  const contactButton = page.locator('#site-header [data-contact-open]');
  await expect(contactButton).toHaveCount(1);
  await contactButton.click();
  const dialog = page.locator('#contact-dialog');
  await expect(dialog).toBeVisible();
  await dialog.press('Escape');
  await expect(dialog).toBeHidden();
});

test('reduced-motion visitors receive content without camera travel controls', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/projects/');
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.locator('[data-skip-motion]')).not.toHaveClass(/is-visible/);
});

test('the reading view remains usable without WebGL', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, value: () => null });
  });
  await page.goto('/education/');
  await expect(page.locator('body')).toHaveClass(/scene-unavailable/);
  await expect(page.locator('[data-scene-status]')).toHaveText('Static reading view');
  await expect(page.locator('main h1')).toBeVisible();
});
