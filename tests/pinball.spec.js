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
  const counts = await page.evaluate(() => ({ levels: FLIP_DATA.LEVELS.length, enemies: FLIP_DATA.ENEMIES.length, cards: FLIP_DATA.CARDS.length, bosses: FLIP_DATA.BOSSES.length, tables: FLIP_DATA.TABLE_MODULES.length, errors: FLIP_DATA.validate() }));
  expect(counts).toEqual({ levels: 101, enemies: 96, cards: 150, bosses: 5, tables: 15, errors: [] });

  await page.getByRole('button', { name: /Campaign/ }).click();
  await expect(page.locator('.level-node')).toHaveCount(101);
  await expect(page.locator('.level-node.boss')).toHaveCount(5);
  await page.locator('[data-level="1"]').click();
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#level-kicker')).toHaveText('LEVEL 001');
  await expect(page.locator('#difficulty')).toHaveText('VERY EASY');
  await expect(page.locator('#wave')).toContainText('ENCOUNTER 1 / 1');
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

test('all enemy roles and biome tables expose deterministic variety metadata', async ({ page }) => {
  await page.goto('/pinball/');
  const content = await page.evaluate(() => ({
    roles: [...new Set(FLIP_DATA.ENEMIES.map((enemy) => enemy.role))],
    movements: [...new Set(FLIP_DATA.ENEMIES.map((enemy) => enemy.movement))],
    validEnemies: FLIP_DATA.ENEMIES.every((enemy) => enemy.movement && enemy.behavior && enemy.defensePattern && enemy.escalation),
    biomeCounts: Object.fromEntries(FLIP_DATA.BIOMES.map((biome) => [biome.id, FLIP_DATA.TABLE_MODULES.filter((layout) => layout.biome === biome.id).length])),
    elementTypes: [...new Set(FLIP_DATA.TABLE_MODULES.flatMap((layout) => layout.elements.map((element) => element.type)))],
    assigned: [...new Set(FLIP_DATA.LEVELS.map((level) => level.layoutId))],
  }));
  expect(content.roles).toHaveLength(12); expect(content.movements.length).toBeGreaterThanOrEqual(9); expect(content.validEnemies).toBe(true);
  expect(Object.values(content.biomeCounts)).toEqual([3, 3, 3, 3, 3]); expect(content.elementTypes.sort()).toEqual([...FLIP_DATA_ELEMENT_TYPES].sort());
  expect(content.assigned).toHaveLength(15);
});

const FLIP_DATA_ELEMENT_TYPES = ['bumper', 'slingshot', 'spinner', 'gate', 'rollover', 'ramp', 'kicker', 'captive', 'magnet', 'vent', 'crusher', 'cover'];

test('all table modules pass bounds, lane, and runtime construction validation', async ({ page }) => {
  await page.goto('/pinball/'); await page.waitForFunction(() => !!window.FLIPSTRIKE); await page.evaluate(() => FLIPSTRIKE.startNew(1));
  const validation = await page.evaluate(() => FLIP_DATA.TABLE_MODULES.map((layout) => ({ id: layout.id, errors: FLIPSTRIKE.validateTableLayout(layout), level: FLIP_DATA.LEVELS.find((candidate) => candidate.layoutId === layout.id)?.level })));
  expect(validation.every((result) => result.errors.length === 0 && result.level)).toBe(true);
  for (const result of validation) {
    const runtime = await page.evaluate((level) => { FLIPSTRIKE.startNew(level); return { layout: FLIPSTRIKE.run.layoutId, elements: FLIPSTRIKE.tableElements.map((element) => element.def.type), serialized: FLIPSTRIKE.serializeTable().length, rails: FLIPSTRIKE.walls.length, drain: FLIPSTRIKE.drain.getFixtureList().isSensor() }; }, result.level);
    expect(runtime.layout).toBe(result.id); expect(runtime.serialized).toBe(runtime.elements.length); expect(runtime.elements.length).toBeGreaterThanOrEqual(4); expect(runtime.rails).toBe(5); expect(runtime.drain).toBe(true);
  }
});

test('role controllers move distinctly, remain bounded, and select survivor defense patterns', async ({ page }) => {
  await page.goto('/pinball/'); await page.waitForFunction(() => !!window.FLIPSTRIKE); await page.evaluate(() => FLIPSTRIKE.startNew(1));
  const result = await page.evaluate(() => {
    FLIPSTRIKE.enemies.forEach((enemy) => { FLIPSTRIKE.destroyActorSprite(enemy); FLIPSTRIKE.world.destroyBody(enemy); }); FLIPSTRIKE.enemies = [];
    const roles = [...new Set(FLIP_DATA.ENEMIES.map((enemy) => enemy.role))]; roles.forEach((role, index) => FLIPSTRIKE.spawnEnemyInstance({ id: `${role}-4`, p: { x: (135 + index % 4 * 150) / 60, y: (280 + Math.floor(index / 4) * 180) / 60 } }, index));
    const before = FLIPSTRIKE.enemies.map((enemy) => ({ ...enemy.getPosition() })); for (let i = 0; i < 180; i++) { FLIPSTRIKE.updateEnemies(1 / 120); FLIPSTRIKE.world.step(1 / 120); }
    const after = FLIPSTRIKE.enemies.map((enemy) => ({ ...enemy.getPosition() })), bounded = after.every((p) => p.x >= 1.5 && p.x <= 10.5 && p.y >= 3 && p.y <= 14.5), moved = after.map((p, i) => Math.hypot(p.x - before[i].x, p.y - before[i].y));
    FLIPSTRIKE.phase = 'defense'; FLIPSTRIKE.run.carriageX = 360; FLIPSTRIKE.run.defenseTime = 5; FLIPSTRIKE.projectiles = []; FLIPSTRIKE.run.shotSequence = 0; FLIPSTRIKE.spawnProjectile();
    return { bounded, distinct: new Set(moved.map((value) => value.toFixed(2))).size, pattern: FLIPSTRIKE.projectiles[0].shape, expected: FLIP_DATA.enemyById[FLIPSTRIKE.enemies[0].getUserData().id].defensePattern };
  });
  expect(result.bounded).toBe(true); expect(result.distinct).toBeGreaterThanOrEqual(6); expect(result.pattern).toBe(result.expected);
});

test('healing, summoning, splitting, phasing, and directional defenses execute their role rules', async ({ page }) => {
  await page.goto('/pinball/'); await page.waitForFunction(() => !!window.FLIPSTRIKE); await page.evaluate(() => FLIPSTRIKE.startNew(61));
  const result = await page.evaluate(() => {
    FLIPSTRIKE.enemies.forEach((enemy) => { FLIPSTRIKE.destroyActorSprite(enemy); FLIPSTRIKE.world.destroyBody(enemy); }); FLIPSTRIKE.enemies = [];
    const ally = FLIPSTRIKE.spawnEnemyInstance({ id: 'patrol-4', p: { x: 4, y: 6 } }), healer = FLIPSTRIKE.spawnEnemyInstance({ id: 'healer-4', p: { x: 5, y: 6 } }); ally.getUserData().hp *= .5; healer.getUserData().actionClock = 0; const hpBefore = ally.getUserData().hp; FLIPSTRIKE.updateEnemies(.02); const healed = ally.getUserData().hp > hpBefore;
    const summoner = FLIPSTRIKE.spawnEnemyInstance({ id: 'summoner-4', p: { x: 7, y: 6 } }); summoner.getUserData().actionClock = 0; FLIPSTRIKE.run.replacementBudget = 1; const countBeforeSummon = FLIPSTRIKE.enemies.length; FLIPSTRIKE.updateEnemies(.02); const summoned = FLIPSTRIKE.enemies.length === countBeforeSummon + 1 && FLIPSTRIKE.run.replacementBudget === 0;
    const ghost = FLIPSTRIKE.spawnEnemyInstance({ id: 'ghost-4', p: { x: 8, y: 7 } }); ghost.getUserData().behaviorClock = 2.7; FLIPSTRIKE.updateEnemies(.02); const phased = ghost.getUserData().invulnerable && ghost.getFixtureList().isSensor();
    const splitter = FLIPSTRIKE.spawnEnemyInstance({ id: 'splitter-4', p: { x: 6, y: 8 } }), beforeSplit = FLIPSTRIKE.enemies.length; FLIPSTRIKE.killEnemy(splitter); const split = FLIPSTRIKE.enemies.length === beforeSplit + 1;
    const blocked = FLIPSTRIKE.spawnEnemyInstance({ id: 'shield-4', p: { x: 3, y: 8 } }), exposed = FLIPSTRIKE.spawnEnemyInstance({ id: 'shield-4', p: { x: 9, y: 8 } }); blocked.getUserData().hp = blocked.getUserData().maxHp = 500; exposed.getUserData().hp = exposed.getUserData().maxHp = 500; blocked.getUserData().weakHit = false; exposed.getUserData().weakHit = true; FLIPSTRIKE.damageEnemy(blocked, 30, false); FLIPSTRIKE.damageEnemy(exposed, 30, false); const directional = (500 - exposed.getUserData().hp) > (500 - blocked.getUserData().hp) * 2;
    return { healed, summoned, phased, split, directional };
  });
  expect(result).toEqual({ healed: true, summoned: true, phased: true, split: true, directional: true });
});

test('boss thresholds activate shared table hazards with visible warning windows', async ({ page }) => {
  await page.goto('/pinball/'); await page.waitForFunction(() => !!window.FLIPSTRIKE); await page.evaluate(() => FLIPSTRIKE.startNew(101));
  const result = await page.evaluate(() => {
    const boss = FLIPSTRIKE.currentBoss(), phased = FLIPSTRIKE.tableElements.filter((element) => element.def.minPhase), inactiveBefore = phased.filter((element) => !element.active).length;
    boss.getUserData().hp = boss.getUserData().maxHp * .2; FLIPSTRIKE.checkBossPhase(boss);
    const activeAfter = phased.every((element) => element.active && element.fixtures.every(({ fixture, solid }) => !solid || !fixture.isSensor()));
    const vent = phased.find((element) => element.def.type === 'vent'); vent.clock = vent.def.period - .3; FLIPSTRIKE.updateTable(.01); const warned = vent.warning && !vent.hazardOn; vent.clock = 0; FLIPSTRIKE.updateTable(.01);
    return { phase: FLIPSTRIKE.run.bossPhase, mode: FLIPSTRIKE.run.tableMode, inactiveBefore, activeAfter, warned, ventActive: vent.hazardOn };
  });
  expect(result.inactiveBefore).toBeGreaterThan(0); expect(result.phase).toBe(4); expect(result.mode).toBe(4); expect(result.activeAfter).toBe(true); expect(result.warned).toBe(true); expect(result.ventActive).toBe(true);
});

test('table and enemy systems remain stable at the target entity budget', async ({ page }) => {
  await page.goto('/pinball/'); await page.waitForFunction(() => !!window.FLIPSTRIKE); await page.evaluate(() => FLIPSTRIKE.startNew(81));
  const result = await page.evaluate(() => {
    while (FLIPSTRIKE.enemies.length < 30) { const index = FLIPSTRIKE.enemies.length, role = Object.keys(FLIP_DATA.ROLE_SYSTEMS)[index % 12]; FLIPSTRIKE.spawnEnemyInstance({ id: `${role}-5`, p: { x: (110 + index % 6 * 98) / 60, y: (250 + Math.floor(index / 6) * 120) / 60 } }, index); }
    for (let i = 0; i < 2; i++) { const ball = FLIPSTRIKE.spawnBall({ p: { x: (300 + i * 80) / 60, y: 800 / 60 }, v: { x: i ? 5 : -5, y: -15 }, launched: true }); ball.setGravityScale(1); }
    const started = performance.now(); for (let i = 0; i < 120; i++) { FLIPSTRIKE.updateEnemies(1 / 120); FLIPSTRIKE.updateTable(1 / 120); FLIPSTRIKE.world.step(1 / 120); } const elapsed = performance.now() - started;
    return { elapsed, enemies: FLIPSTRIKE.enemies.length, balls: FLIPSTRIKE.balls.length, finite: [...FLIPSTRIKE.enemies, ...FLIPSTRIKE.balls].every((body) => Number.isFinite(body.getPosition().x) && Number.isFinite(body.getPosition().y)) };
  });
  expect(result.enemies).toBeGreaterThanOrEqual(30); expect(result.balls).toBeGreaterThanOrEqual(3); expect(result.finite).toBe(true); expect(result.elapsed).toBeLessThan(2500);
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

test('table upgrade cards install and remove shared physics elements safely', async ({ page }) => {
  await page.goto('/pinball/'); await page.waitForFunction(() => !!window.FLIPSTRIKE); await expect(page.locator('.brand')).toBeVisible(); await page.evaluate(() => FLIPSTRIKE.startNew(1));
  const result = await page.evaluate(() => {
    const effects = ['extraBumper', 'gate', 'launcher', 'ramp'], cards = effects.map((effect) => FLIP_DATA.CARDS.find((card) => card.category === 'table' && card.effect === effect)); cards.forEach((card) => FLIPSTRIKE.chooseCard(card.id));
    const installed = effects.every((effect) => FLIPSTRIKE.tableElements.some((element) => element.id.endsWith(`card-${effect}`))); cards.forEach((card) => FLIPSTRIKE.sellCard(card.id));
    return { installed, removed: effects.every((effect) => !FLIPSTRIKE.tableElements.some((element) => element.id.endsWith(`card-${effect}`))), finite: FLIPSTRIKE.tableElements.flatMap((element) => element.bodies).every((body) => Number.isFinite(body.getPosition().x)) };
  });
  expect(result).toEqual({ installed: true, removed: true, finite: true });
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
  const transitionStart = await page.evaluate(() => ({ time: FLIPSTRIKE.run.time, tableClock: FLIPSTRIKE.tableElements[0].clock }));
  await page.waitForTimeout(250);
  const transitionAfter = await page.evaluate(() => ({ time: FLIPSTRIKE.run.time, tableClock: FLIPSTRIKE.tableElements[0].clock }));
  expect(Math.abs(transitionAfter.time - transitionStart.time)).toBeLessThan(.03); expect(Math.abs(transitionAfter.tableClock - transitionStart.tableClock)).toBeLessThan(.001);
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
  const frozenTable = await page.evaluate(() => FLIPSTRIKE.tableElements[0].clock); await page.waitForTimeout(180); expect(Math.abs(await page.evaluate(() => FLIPSTRIKE.tableElements[0].clock) - frozenTable)).toBeLessThan(.001);
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

test('suspend restores table hazard clocks and enemy behavior state', async ({ page }) => {
  await page.goto('/pinball/'); await page.waitForFunction(() => !!window.FLIPSTRIKE); await expect(page.locator('.brand')).toBeVisible();
  const level = await page.evaluate(() => FLIP_DATA.LEVELS.find((candidate) => candidate.layoutId === 'furnace-breakout').level);
  await page.evaluate((targetLevel) => FLIPSTRIKE.startNew(targetLevel), level);
  await page.evaluate(() => { FLIPSTRIKE.tableElements[0].clock = 1.234; FLIPSTRIKE.tableElements[0].hp = 2; FLIPSTRIKE.enemies[0].getUserData().behaviorClock = 4.321; });
  await page.getByRole('button', { name: 'Pause game' }).click(); const expected = await page.evaluate(() => ({ id: FLIPSTRIKE.tableElements[0].id, clock: FLIPSTRIKE.tableElements[0].clock, hp: FLIPSTRIKE.tableElements[0].hp, enemy: FLIPSTRIKE.enemies[0].getUserData().id, behaviorClock: FLIPSTRIKE.enemies[0].getUserData().behaviorClock })); await page.getByRole('button', { name: /Save & Exit/ }).click(); await page.getByRole('button', { name: /Continue/ }).click();
  const restored = await page.evaluate(() => ({ id: FLIPSTRIKE.tableElements[0].id, clock: FLIPSTRIKE.tableElements[0].clock, hp: FLIPSTRIKE.tableElements[0].hp, enemy: FLIPSTRIKE.enemies[0].getUserData().id, behaviorClock: FLIPSTRIKE.enemies[0].getUserData().behaviorClock }));
  expect(restored.id).toBe(expected.id); expect(restored.enemy).toBe(expected.enemy); expect(restored.clock).toBeCloseTo(expected.clock, 1); expect(restored.hp).toBe(expected.hp); expect(restored.behaviorClock).toBeCloseTo(expected.behaviorClock, 1);
});
