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
  expect(rails).toHaveLength(5);
  expect(rails.every((line) => line.length === 4 && line.every(Number.isFinite))).toBe(true);
  expect(rails).toContainEqual([160, 76, 560, 76]);
  const lowerPlayfield = await page.evaluate(() => ({
    aprons: FLIPSTRIKE.aprons.map((body) => body.getUserData().points),
    pivots: FLIPSTRIKE.flippers.slice(0, 2).map((body) => body.getUserData().pivot),
    drainSensor: FLIPSTRIKE.drain.getFixtureList().isSensor(),
    drainRect: FLIPSTRIKE.drain.getUserData().rect,
  }));
  expect(lowerPlayfield.aprons).toHaveLength(2);
  expect(await page.evaluate(() => FLIPSTRIKE.mounts.length)).toBe(2);
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

test('keyboard and touch flippers swing fully, hold, and return to downward rest', async ({ page }) => {
  await page.goto('/pinball/');
  await page.getByRole('button', { name: /Campaign/ }).click();
  await page.locator('[data-level="1"]').click();
  const rest = await page.evaluate(() => FLIPSTRIKE.flippers.slice(0, 2).map((body) => body.getAngle() * 180 / Math.PI));
  expect(rest[0]).toBeGreaterThan(6); expect(rest[1]).toBeLessThan(-6);

  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(160);
  const fullLeft = Math.abs(await page.evaluate(() => FLIPSTRIKE.flippers[0].getUserData().joint.getJointAngle() * 180 / Math.PI));
  await page.keyboard.up('ArrowLeft'); await page.waitForTimeout(250);
  const returned = Math.abs(await page.evaluate(() => FLIPSTRIKE.flippers[0].getUserData().joint.getJointAngle() * 180 / Math.PI));
  expect(fullLeft).toBeGreaterThan(18); expect(fullLeft).toBeLessThan(21); expect(returned).toBeLessThan(.5);

  const right = await page.locator('#touch-right').boundingBox();
  await page.mouse.move(right.x + right.width / 2, right.y + right.height / 2); await page.mouse.down(); await page.waitForTimeout(160);
  const held = Math.abs(await page.evaluate(() => FLIPSTRIKE.flippers[1].getUserData().joint.getJointAngle() * 180 / Math.PI));
  await page.mouse.up(); await page.waitForTimeout(250);
  expect(held).toBeGreaterThan(18); expect(held).toBeLessThan(21);
  expect(Math.abs(await page.evaluate(() => FLIPSTRIKE.flippers[1].getUserData().joint.getJointAngle() * 180 / Math.PI))).toBeLessThan(.5);
});

test('actor assets map every enemy and drive boss defense presentation', async ({ page, request }) => {
  await page.goto('/pinball/');
  const assets = await page.evaluate(() => ({ roles: FLIP_DATA.ACTOR_ASSETS.roles, bosses: FLIP_DATA.ACTOR_ASSETS.bosses, mapped: FLIP_DATA.ENEMIES.every((enemy) => !!FLIP_DATA.ACTOR_ASSETS.roles[enemy.spriteId]), themes: FLIP_DATA.BOSSES.map((boss) => boss.projectileTheme), presentations: FLIP_DATA.BOSSES.every((boss) => !!boss.defensePresentation) }));
  expect(Object.keys(assets.roles)).toHaveLength(12); expect(Object.keys(assets.bosses)).toHaveLength(5); expect(assets.mapped).toBe(true); expect(new Set(assets.themes).size).toBe(5); expect(assets.presentations).toBe(true);
  for (const url of [...Object.values(assets.roles), ...Object.values(assets.bosses)]) expect((await request.get(`/pinball/${url}`)).ok()).toBe(true);
  await page.evaluate(() => FLIPSTRIKE.startNew(25));
  await expect.poll(() => page.evaluate(() => FLIPSTRIKE.actorSprites.size)).toBe(1);
  await page.evaluate(() => { const ball = FLIPSTRIKE.balls[0]; ball.getUserData().launched = true; ball.setGravityScale(1); ball.setTransform(planck.Vec2(6, 1120 / 60), 0); ball.setLinearVelocity(planck.Vec2(0, 8)); });
  await expect(page.locator('#phase')).toHaveText('BALL LEAKED');
  await page.evaluate(() => { FLIPSTRIKE.run.transition.remaining = .01; });
  await expect(page.locator('#phase')).toContainText('DODGE');
  const bossUi = await page.evaluate(() => { FLIPSTRIKE.spawnProjectile(); const boss = FLIPSTRIKE.currentBoss(), sprite = FLIPSTRIKE.actorSprites.get(boss); return { visible: sprite.visible, width: sprite.width, visual: FLIPSTRIKE.projectiles[0].visual }; });
  expect(bossUi.visible).toBe(true); expect(bossUi.width).toBeGreaterThan(250); expect(bossUi.visual).toBe('shard');
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
  await expect(page.locator('#phase-transition')).toBeVisible();
  await expect(page.locator('#transition-title')).toHaveText('BALL LEAKED');
  await expect(page.locator('#phase')).toHaveText('BALL LEAKED');
  await expect(page.locator('#balls')).toHaveText('BALLS 4');
  expect(await page.evaluate(() => ({ duration: FLIPSTRIKE.run.transition.duration, nextPhase: FLIPSTRIKE.run.transition.nextPhase, controlsLocked: document.querySelector('#touch-controls').classList.contains('locked') }))).toEqual({ duration: 2, nextPhase: 'defense', controlsLocked: true });
  await page.evaluate(() => { FLIPSTRIKE.run.transition.remaining = .01; });
  await expect(page.locator('#phase')).toContainText('DODGE');
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
  await expect(page.locator('#phase')).toHaveText('BALL LEAKED');
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
  await expect(page.locator('#phase')).toHaveText('BALL LEAKED');
  const transitionStart = await page.evaluate(() => FLIPSTRIKE.run.time);
  await page.waitForTimeout(250);
  expect(Math.abs(await page.evaluate(() => FLIPSTRIKE.run.time) - transitionStart)).toBeLessThan(.03);
  await page.evaluate(() => { FLIPSTRIKE.run.transition.remaining = .01; });
  await expect(page.locator('#phase')).toContainText('DODGE');
  const defenseStart = await page.evaluate(() => FLIPSTRIKE.run.time);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => FLIPSTRIKE.run.time)).toBeLessThan(defenseStart - .05);

  const beforePenalty = await page.evaluate(() => { FLIPSTRIKE.projectiles = [{ x: FLIPSTRIKE.run.carriageX, y: 1080, vx: 0, vy: 0, age: 0, hit: false, penalty: 2, shape: 'aim' }]; FLIPSTRIKE.run.defenseInvulnerable = 0; return FLIPSTRIKE.run.time; });
  await page.waitForTimeout(80);
  expect(await page.evaluate(() => FLIPSTRIKE.run.time)).toBeLessThan(beforePenalty - 2);

  await page.evaluate(() => { FLIPSTRIKE.run.defenseTime = .01; FLIPSTRIKE.projectiles = []; });
  await expect(page.locator('#phase')).toHaveText('WAVE SURVIVED');
  await expect(page.locator('#transition-title')).toHaveText('WAVE SURVIVED');
  const relaunch = await page.evaluate(() => FLIPSTRIKE.run.time);
  await page.waitForTimeout(300);
  expect(Math.abs(await page.evaluate(() => FLIPSTRIKE.run.time) - relaunch)).toBeLessThan(.03);
  await page.evaluate(() => { FLIPSTRIKE.run.transition.remaining = .01; });
  await expect(page.locator('#phase')).toContainText('PLUNGER');
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

test('one-use suspend preserves an active intermission', async ({ page }) => {
  await page.goto('/pinball/'); await page.getByRole('button', { name: /Campaign/ }).click(); await page.locator('[data-level="1"]').click();
  await page.evaluate(() => { const ball = FLIPSTRIKE.balls[0]; ball.getUserData().launched = true; ball.setGravityScale(1); ball.setTransform(planck.Vec2(6, 1120 / 60), 0); ball.setLinearVelocity(planck.Vec2(0, 8)); });
  await expect(page.locator('#phase')).toHaveText('BALL LEAKED');
  await page.getByRole('button', { name: 'Pause game' }).click(); await page.getByRole('button', { name: /Save & Exit/ }).click(); await page.getByRole('button', { name: /Continue/ }).click();
  await expect(page.locator('#phase')).toHaveText('BALL LEAKED'); await expect(page.locator('#phase-transition')).toBeVisible();
  const remaining = await page.evaluate(() => FLIPSTRIKE.run.transition.remaining); expect(remaining).toBeGreaterThan(0); expect(remaining).toBeLessThanOrEqual(2);
  await page.evaluate(() => { FLIPSTRIKE.run.transition.remaining = .01; }); await expect(page.locator('#phase')).toContainText('DODGE');
});
