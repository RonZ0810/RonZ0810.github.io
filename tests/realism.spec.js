import { expect, test } from '@playwright/test';

const scene = page => page.locator('[data-study-scene]');
async function ready(page, route='/') {
  await page.goto(route); await expect(page.locator('body')).toHaveClass(/scene-ready/);
  await expect(scene(page)).toHaveAttribute('data-assets','ready',{timeout:45000});
}
async function object(page, name) {
  if(await page.locator('[data-panel-close]').isVisible()) await page.locator('[data-panel-close]').click();
  await page.locator('[data-room-list]').click();
  await page.locator(`#room-objects [data-object-action=${name}]`).click();
}
test('ceiling controls persist across navigation and reduced motion freezes the fan', async ({page})=> {
  await ready(page); await page.locator('[data-office-motion]').click();
  await object(page,'ceiling'); await expect(scene(page)).toHaveAttribute('data-ceiling-light','off');
  await object(page,'fan'); await expect(scene(page)).toHaveAttribute('data-fan','off');
  await page.locator('[data-room-list]').click(); await page.locator('#room-objects a[href="/projects/"]').click();
  await expect(page.locator('main h1')).toBeVisible(); await expect(scene(page)).toHaveAttribute('data-ceiling-light','off');
  await object(page,'fan'); await expect(scene(page)).toHaveAttribute('data-fan','on');
  await page.locator('[data-room-list]').click(); await page.locator('#room-objects a[href="/projects/"]').click();
  await page.locator('[data-panel-close]').click();
  for(let i=0;i<12;i++) await scene(page).press('ArrowUp');
  const angle=await scene(page).getAttribute('data-fan-angle');
  await scene(page).press('ArrowLeft'); await expect(scene(page)).toHaveAttribute('data-fan-angle',angle);
  await page.locator('[data-office-motion]').click(); await expect(scene(page)).not.toHaveAttribute('data-fan-angle',angle);
});
test('walking eases, bobs only while moving, settles, and loses velocity on focus loss', async ({page})=> {
  await ready(page); await scene(page).focus(); const start=Number(await scene(page).getAttribute('data-player-z'));
  await page.keyboard.down('w');
  await expect.poll(async()=>Number(await scene(page).getAttribute('data-player-z'))).toBeLessThan(start-.05);
  const height=Number(await scene(page).getAttribute('data-camera-height'));
  expect(height).toBeGreaterThanOrEqual(1.638); expect(height).toBeLessThanOrEqual(1.662);
  await expect(scene(page)).not.toHaveAttribute('data-camera-height','1.65000');
  await page.keyboard.up('w'); await expect.poll(async()=>Number(await scene(page).getAttribute('data-speed'))).toBeLessThan(.003);
  await expect(scene(page)).toHaveAttribute('data-camera-height','1.65000');
  await page.keyboard.down('s'); await page.locator('[data-office-motion]').focus(); await page.keyboard.up('s');
  await expect(scene(page)).toHaveAttribute('data-speed','0.0000');
  await page.locator('[data-office-motion]').click(); await scene(page).focus(); await page.keyboard.down('s');
  await expect.poll(async()=>Number(await scene(page).getAttribute('data-speed'))).toBeGreaterThan(.1);
  await expect(scene(page)).toHaveAttribute('data-camera-height','1.65000'); await page.keyboard.up('s');
});
test('room fills viewport, panel X restores focus, and the business card opens Contact', async ({page})=> {
  await ready(page,'/projects/'); await expect(page.locator('#site-header')).toBeHidden();
  expect((await scene(page).boundingBox()).y).toBe(0);
  await expect(page.locator('[data-panel-close]')).toHaveText('×');
  await page.locator('[data-panel-close]').click(); await expect(scene(page)).toBeFocused(); await expect(page).toHaveURL(/\/projects\/$/);
  await page.locator('[data-office-motion]').click(); await object(page,'contact');
  await expect(page.locator('#contact-dialog')).toBeVisible(); await page.locator('#contact-dialog').press('Escape');
  await expect(scene(page)).toBeFocused();
});
test('dragging across an object does not navigate', async ({page})=> {
  await ready(page,'/projects/');await page.locator('[data-panel-close]').click();
  const canvas=await scene(page).boundingBox();const x=canvas.x+canvas.width*.45,y=canvas.y+canvas.height*.4;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+100,y+30,{steps:8});await page.mouse.up();
  await expect(page.locator('main')).toBeHidden();await expect(page).toHaveURL(/\/projects\/$/);
});
