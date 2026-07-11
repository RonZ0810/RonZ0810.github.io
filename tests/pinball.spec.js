import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('flipstrike.v3.progress');
    localStorage.removeItem('flipstrike.v3.suspend');
    indexedDB.deleteDatabase('flipstrike.v3');
  });
});

test('full campaign content validates and level one starts cleanly', async ({ page }) => {
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/pinball/');
  await expect(page.locator('.brand')).toContainText('FLIP');
  const counts = await page.evaluate(() => ({ levels: FLIP_DATA.LEVELS.length, enemies: FLIP_DATA.ENEMIES.length, cards: FLIP_DATA.CARDS.length, bosses: FLIP_DATA.BOSSES.length, errors: FLIP_DATA.validate() }));
  expect(counts).toEqual({ levels: 101, enemies: 96, cards: 150, bosses: 5, errors: [] });

  await page.getByRole('button', { name: /Campaign/ }).click();
  await expect(page.locator('.level-node')).toHaveCount(101);
  await expect(page.locator('.level-node.boss')).toHaveCount(5);
  await page.locator('[data-level="1"]').click();
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#level-kicker')).toHaveText('LEVEL 001');
  await expect(page.locator('#difficulty')).toHaveText('VERY EASY');
  await expect(page.locator('#wave')).toHaveText('ENCOUNTER 1 / 1');
  await expect(page.locator('#phase')).toHaveText('PLUNGER 18%');
  const paddles = await page.evaluate(() => FLIPSTRIKE.flippers.map((body) => FLIPSTRIKE.bodyPolygon(body)));
  expect(paddles).toHaveLength(2);
  expect(paddles.every((polygon) => polygon.length === 8 && polygon.every(Number.isFinite))).toBe(true);
  const rails = await page.evaluate(() => FLIPSTRIKE.walls.map((body) => body.getUserData().line));
  expect(rails).toHaveLength(4);
  expect(rails.every((line) => line.length === 4 && line.every(Number.isFinite))).toBe(true);
  const lowerPlayfield = await page.evaluate(() => ({
    aprons: FLIPSTRIKE.aprons.map((body) => body.getUserData().points),
    pivots: FLIPSTRIKE.flippers.slice(0, 2).map((body) => body.getUserData().pivot),
    drainSensor: FLIPSTRIKE.drain.getFixtureList().isSensor(),
    drainRect: FLIPSTRIKE.drain.getUserData().rect,
  }));
  expect(lowerPlayfield.aprons).toHaveLength(2);
  expect(lowerPlayfield.drainSensor).toBe(true);
  expect(lowerPlayfield.drainRect).toEqual([158, 1138, 404, 24]);
  expect(lowerPlayfield.pivots[0]).toEqual({ x: 158 / 60, y: 1090 / 60 });
  expect(lowerPlayfield.pivots[1]).toEqual({ x: 562 / 60, y: 1090 / 60 });
  const flipperPhysics = await page.evaluate(() => {
    const body = FLIPSTRIKE.flippers[0], data = body.getUserData();
    body.setAngularVelocity(-12);
    const nearHinge = planck.Vec2(data.pivot.x + .2, data.pivot.y);
    const tip = body.getWorldPoint(planck.Vec2(data.halfLength * 2, 0));
    return { type: body.getType(), motor: data.joint.isMotorEnabled(), near: FLIPSTRIKE.flipperContactSpeed(body, nearHinge), tip: FLIPSTRIKE.flipperContactSpeed(body, tip) };
  });
  expect(flipperPhysics.type).toBe('dynamic');
  expect(flipperPhysics.motor).toBe(true);
  expect(flipperPhysics.tip).toBeGreaterThan(flipperPhysics.near * 8);
  await page.keyboard.down('Space');
  await page.waitForTimeout(180);
  await page.keyboard.up('Space');
  await expect(page.locator('#phase')).toHaveText('ATTACK');
  await page.waitForTimeout(400);
  expect(errors).toEqual([]);
});

test('portrait touch controls and production menu fit a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/pinball/');
  await page.getByRole('button', { name: /Campaign/ }).click();
  await page.locator('[data-level="1"]').click();
  await expect(page.locator('#touch-left')).toBeVisible();
  await expect(page.locator('#touch-right')).toBeVisible();
  await expect(page.locator('#touch-launch')).toBeVisible();
  const shell = await page.locator('#shell').boundingBox();
  expect(shell.width).toBeLessThanOrEqual(390);
  expect(shell.height).toBeLessThanOrEqual(844);
});

test('card library exposes all production definitions', async ({ page }) => {
  await page.goto('/pinball/');
  await page.getByRole('button', { name: /Card Library/ }).click();
  await expect(page.locator('.library-card')).toHaveCount(150);
  await expect(page.getByText('0 / 150')).toBeVisible();
});

test('draining the last active ball consumes one ball and starts defense', async ({ page }) => {
  await page.goto('/pinball/');
  await page.getByRole('button', { name: /Campaign/ }).click();
  await page.locator('[data-level="1"]').click();
  await page.evaluate(() => {
    for (const ball of FLIPSTRIKE.balls) {
      ball.getUserData().launched = true;
      ball.setGravityScale(1);
      ball.setTransform(planck.Vec2(6, 1120 / 60), 0);
      ball.setLinearVelocity(planck.Vec2(0, 8));
    }
  });
  await expect(page.locator('#phase')).toContainText('DODGE');
  await expect(page.locator('#balls')).toHaveText('BALLS 4');
});

test('central drain waits for every active multiball before defense', async ({ page }) => {
  await page.goto('/pinball/');
  await page.getByRole('button', { name: /Campaign/ }).click();
  await page.locator('[data-level="1"]').click();
  await page.evaluate(() => {
    const first = FLIPSTRIKE.balls[0];
    first.getUserData().launched = true; first.setGravityScale(1); first.setTransform(planck.Vec2(6, 1120 / 60), 0); first.setLinearVelocity(planck.Vec2(0, 8));
    const second = FLIPSTRIKE.spawnBall({ p: { x: 5, y: 10 }, v: { x: 0, y: 0 }, launched: true }); second.setGravityScale(1);
  });
  await expect.poll(() => page.evaluate(() => FLIPSTRIKE.balls.length)).toBe(1);
  expect(await page.evaluate(() => ({ phase: FLIPSTRIKE.phase, budget: FLIPSTRIKE.run.balls }))).toEqual({ phase: 'attack', budget: 5 });
  await page.evaluate(() => { const ball = FLIPSTRIKE.balls[0]; ball.setTransform(planck.Vec2(6, 1120 / 60), 0); ball.setLinearVelocity(planck.Vec2(0, 8)); });
  await expect(page.locator('#phase')).toContainText('DODGE');
  await expect(page.locator('#balls')).toHaveText('BALLS 4');
});

test('main timer runs only for launched balls and defense', async ({ page }) => {
  await page.goto('/pinball/');
  await page.getByRole('button', { name: /Campaign/ }).click();
  await page.locator('[data-level="1"]').click();
  const initial = await page.evaluate(() => FLIPSTRIKE.run.time);
  await page.waitForTimeout(350);
  expect(Math.abs(await page.evaluate(() => FLIPSTRIKE.run.time) - initial)).toBeLessThan(.03);

  await page.keyboard.down('Space'); await page.waitForTimeout(80); await page.keyboard.up('Space'); await page.waitForTimeout(350);
  expect(await page.evaluate(() => FLIPSTRIKE.run.time)).toBeLessThan(initial - .2);

  await page.evaluate(() => { const ball = FLIPSTRIKE.balls[0]; ball.setTransform(planck.Vec2(6, 1120 / 60), 0); ball.setLinearVelocity(planck.Vec2(0, 8)); });
  await expect(page.locator('#phase')).toContainText('DODGE');
  const defenseStart = await page.evaluate(() => FLIPSTRIKE.run.time);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => FLIPSTRIKE.run.time)).toBeLessThan(defenseStart - .15);

  const beforePenalty = await page.evaluate(() => { FLIPSTRIKE.projectiles = [{ x: FLIPSTRIKE.run.carriageX, y: 1080, vx: 0, vy: 0, age: 0, hit: false, penalty: 2, shape: 'aim' }]; FLIPSTRIKE.run.defenseInvulnerable = 0; return FLIPSTRIKE.run.time; });
  await page.waitForTimeout(80);
  expect(await page.evaluate(() => FLIPSTRIKE.run.time)).toBeLessThan(beforePenalty - 2);

  await page.evaluate(() => { FLIPSTRIKE.run.defenseTime = .01; FLIPSTRIKE.projectiles = []; });
  await expect(page.locator('#phase')).toContainText('PLUNGER');
  const relaunch = await page.evaluate(() => FLIPSTRIKE.run.time);
  await page.waitForTimeout(300);
  expect(Math.abs(await page.evaluate(() => FLIPSTRIKE.run.time) - relaunch)).toBeLessThan(.03);
});

test('XP threshold pauses play for a three-card draft', async ({ page }) => {
  await page.goto('/pinball/');
  await page.getByRole('button', { name: /Campaign/ }).click();
  await page.locator('[data-level="1"]').click();
  await page.evaluate(() => FLIPSTRIKE.addXp(110));
  await expect(page.locator('.upgrade-card')).toHaveCount(3);
  await page.locator('.upgrade-card').first().click();
  await expect(page.locator('#overlay')).toBeEmpty();
  expect(await page.evaluate(() => Object.values(FLIPSTRIKE.run.cards).reduce((a, b) => a + b, 0))).toBe(1);
});

test('pause creates and consumes a one-use suspend save', async ({ page }) => {
  await page.goto('/pinball/');
  await page.getByRole('button', { name: /Campaign/ }).click();
  await page.locator('[data-level="1"]').click();
  await page.getByRole('button', { name: 'Pause game' }).click();
  await page.getByRole('button', { name: /Save & Exit/ }).click();
  await expect(page.getByRole('button', { name: /Continue/ })).toBeEnabled();
  await page.getByRole('button', { name: /Continue/ }).click();
  await expect(page.locator('#hud')).toBeVisible();
  await page.getByRole('button', { name: 'Pause game' }).click();
  await page.getByRole('button', { name: /Main Menu/ }).click();
  await expect(page.getByRole('button', { name: /Continue/ })).toBeDisabled();
});
