import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('flipstrike.test.migration')) return;
    localStorage.removeItem('flipstrike.v4.progress');
    localStorage.removeItem('flipstrike.v4.suspend');
    localStorage.setItem('flipstrike.v4.progress', JSON.stringify({ version: 4, seenObstacles: ['bumper', 'slingshot', 'spinner', 'gate', 'rollover', 'ramp', 'kicker', 'captive', 'magnet', 'vent', 'crusher', 'cover'] }));
    indexedDB.deleteDatabase('flipstrike.v4');
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
  await expect(page.locator('#difficulty')).toHaveText('TUTORIAL');
  await expect(page.locator('#wave')).toContainText('SINGLE PHASE');
  await expect(page.locator('#phase')).toHaveText('PLUNGER 18%');
  expect(await page.evaluate(() => ({ enemies: FLIPSTRIKE.enemies.map((body) => body.getUserData().id), elements: FLIPSTRIKE.tableElements.map((element) => element.def.type), ratio: FLIPSTRIKE.run.challenge.threatRatio }))).toEqual(expect.objectContaining({ enemies: ['drifter-1'], elements: ['bumper'] }));
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

  await page.keyboard.down('ArrowLeft'); await expect.poll(() => page.evaluate(() => Math.abs(FLIPSTRIKE.flippers[0].getUserData().joint.getJointAngle() * 180 / Math.PI)), { timeout: 2500 }).toBeGreaterThan(18);
  const fullLeft = Math.abs(await page.evaluate(() => FLIPSTRIKE.flippers[0].getUserData().joint.getJointAngle() * 180 / Math.PI)); await page.keyboard.up('ArrowLeft');
  await expect.poll(() => page.evaluate(() => Math.abs(FLIPSTRIKE.flippers[0].getUserData().joint.getJointAngle() * 180 / Math.PI)), { timeout: 2500 }).toBeLessThan(.5);
  expect(fullLeft).toBeLessThan(21);

  const right = await page.locator('#touch-right').boundingBox();
  await page.mouse.move(right.x + right.width / 2, right.y + right.height / 2); await page.mouse.down(); await expect.poll(() => page.evaluate(() => Math.abs(FLIPSTRIKE.flippers[1].getUserData().joint.getJointAngle() * 180 / Math.PI)), { timeout: 2500 }).toBeGreaterThan(18);
  const held = Math.abs(await page.evaluate(() => FLIPSTRIKE.flippers[1].getUserData().joint.getJointAngle() * 180 / Math.PI)); await page.mouse.up();
  expect(held).toBeLessThan(21); await expect.poll(() => page.evaluate(() => Math.abs(FLIPSTRIKE.flippers[1].getUserData().joint.getJointAngle() * 180 / Math.PI)), { timeout: 2500 }).toBeLessThan(.5);
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

test('all 96 enemy variants expose stable motion profiles, seeded parameters, and defense sequences', async ({ page }) => {
  await page.goto('/pinball/'); await page.waitForFunction(() => !!window.FLIPSTRIKE);
  const metadata = await page.evaluate(() => ({ valid: FLIP_DATA.ENEMIES.every((enemy) => enemy.motionProfile?.id && enemy.motionThreat >= 1 && enemy.defenseSequence?.length), signatures: FLIP_DATA.ENEMIES.map((enemy) => `${enemy.role}:${enemy.motionProfile.id}`), families: [...new Set(FLIP_DATA.ENEMIES.map((enemy) => enemy.motionProfile.id))] }));
  expect(metadata.valid).toBe(true); expect(new Set(metadata.signatures).size).toBe(96); expect(metadata.families).toEqual(['steady', 'reverse', 'weave', 'burst', 'altitude', 'feint', 'alternating', 'omega']);
  const seeded = await page.evaluate(() => { FLIPSTRIKE.startNew(81); const first = FLIPSTRIKE.motionStateFor(FLIP_DATA.enemyById['drifter-8'], 0); FLIPSTRIKE.startNew(81); const second = FLIPSTRIKE.motionStateFor(FLIP_DATA.enemyById['drifter-8'], 0); return { first, second }; });
  expect(seeded.first.motionSeed).not.toBe(seeded.second.motionSeed); expect(seeded.first.motionSpeed).toBeGreaterThanOrEqual(.92); expect(seeded.first.motionSpeed).toBeLessThanOrEqual(1.08);
});

test('next level destroys prior damage labels and stale encounter callbacks', async ({ page }) => {
  await page.goto('/pinball/'); await page.waitForFunction(() => !!window.FLIPSTRIKE); await page.evaluate(() => FLIPSTRIKE.startNew(1));
  await page.evaluate(() => { FLIPSTRIKE.pushFloater(360, 500, '999', 0xffffff, 22); window.__oldDamageLabel = FLIPSTRIKE.floaters[0].label; FLIPSTRIKE.levelComplete(); });
  await page.getByRole('button', { name: /Next Level/ }).click();
  const cleanup = await page.evaluate(() => ({ tracked: FLIPSTRIKE.floaters.length, destroyed: window.__oldDamageLabel.destroyed, parent: window.__oldDamageLabel.parent, level: FLIPSTRIKE.run.level }));
  expect(cleanup).toEqual({ tracked: 0, destroyed: true, parent: null, level: 2 });
  await page.evaluate(() => { FLIPSTRIKE.startNew(21); FLIPSTRIKE.encounterCleared(); FLIPSTRIKE.startNew(22); }); await page.waitForTimeout(650);
  expect(await page.evaluate(() => ({ level: FLIPSTRIKE.run.level, encounter: FLIPSTRIKE.run.encounter, actual: FLIPSTRIKE.enemies.map((enemy) => enemy.getUserData().id), expected: FLIPSTRIKE.run.challenge.encounters[0] }))).toEqual(expect.objectContaining({ level: 22, encounter: 0 }));
  expect(await page.evaluate(() => FLIPSTRIKE.enemies.map((enemy) => enemy.getUserData().id))).toEqual(await page.evaluate(() => FLIPSTRIKE.run.challenge.encounters[0]));
});

test('all 101 levels obey role, tier, obstacle, encounter, and threat gates across rerolls', async ({ page }) => {
  await page.goto('/pinball/');
  const audit = await page.evaluate(() => {
    const failures = [], roleUnlocks = FLIP_DATA.ROLE_UNLOCKS, obstacleUnlocks = FLIP_DATA.OBSTACLE_UNLOCKS;
    for (let level = 1; level <= 101; level++) for (let attempt = 1; attempt <= 5; attempt++) {
      const challenge = FLIP_DATA.generateChallenge(level, level * 1009 + attempt * 7919), boss = FLIP_DATA.BOSSES.some((item) => item.level === level);
      if (challenge.threatRatio < .95 || challenge.threatRatio > 1.05) failures.push(`threat:${level}`);
      if (challenge.elements.length > challenge.obstacleCap) failures.push(`cap:${level}`);
      if (challenge.elements.filter((element) => ['vent', 'crusher'].includes(element.type)).length > (level >= 81 ? 3 : 2)) failures.push(`hazards:${level}`);
      challenge.elements.forEach((element) => { if (obstacleUnlocks[element.type] > level) failures.push(`obstacle:${level}:${element.type}`); });
      challenge.encounters.flat().forEach((id) => { const enemy = FLIP_DATA.enemyById[id]; if (!boss && (roleUnlocks[enemy.role] > level || enemy.tier > challenge.maxTier)) failures.push(`enemy:${level}:${id}`); });
      const expectedEncounters = boss ? 1 : level <= 20 ? 1 : level <= 60 ? 2 : 3; if (challenge.encounters.length !== expectedEncounters) failures.push(`encounters:${level}`);
    }
    return failures;
  });
  expect(audit).toEqual([]);
});

test('retries reroll ordinary challenges while generated runs retain exact challenge state', async ({ page }) => {
  await page.goto('/pinball/'); await page.waitForFunction(() => !!window.FLIPSTRIKE);
  const attempts = await page.evaluate(() => { FLIPSTRIKE.startNew(36); const first = structuredClone(FLIPSTRIKE.run.challenge); FLIPSTRIKE.startNew(36); return { first, second: structuredClone(FLIPSTRIKE.run.challenge) }; });
  expect(attempts.first.attemptSeed).not.toBe(attempts.second.attemptSeed); expect(attempts.first.level).toBe(attempts.second.level); expect(attempts.first.threatRatio).toBeGreaterThanOrEqual(.95); expect(attempts.second.threatRatio).toBeLessThanOrEqual(1.05);
});

test('version four resets gameplay progression while preserving version three settings', async ({ page }) => {
  await page.goto('/pinball/'); await page.evaluate(() => { localStorage.setItem('flipstrike.test.migration', '1'); localStorage.removeItem('flipstrike.v4.progress'); localStorage.removeItem('flipstrike.v4.settings'); localStorage.setItem('flipstrike.v3.progress', JSON.stringify({ unlockedLevel: 88, discovered: ['ball-01'], achievements: ['achievement-1'] })); localStorage.setItem('flipstrike.v3.settings', JSON.stringify({ muted: true, effects: .25, reducedEffects: true, vibration: false })); }); await page.reload();
  const migrated = await page.evaluate(() => ({ progress: FlipStorage.progress, settings: FlipStorage.settings }));
  expect(migrated.progress.unlockedLevel).toBe(1); expect(migrated.progress.discovered).toEqual([]); expect(migrated.progress.achievements).toEqual([]); expect(migrated.settings).toEqual(expect.objectContaining({ muted: true, effects: .25, reducedEffects: true, vibration: false }));
});

test('new obstacle tutorials queue once, freeze play, and persist dismissal', async ({ page }) => {
  await page.goto('/pinball/'); await page.waitForFunction(() => !!window.FLIPSTRIKE);
  await page.evaluate(() => { FlipStorage.progress.seenObstacles = []; FlipStorage.saveProgress(); FLIPSTRIKE.startNew(1); });
  await expect(page.locator('#obstacle-tutorial')).toBeVisible(); await expect(page.locator('#obstacle-title')).toHaveText('Bumper');
  const frozen = await page.evaluate(() => ({ time: FLIPSTRIKE.run.time, phase: FLIPSTRIKE.phase, clock: FLIPSTRIKE.tableElements[0].clock, queue: FLIPSTRIKE.tutorial.queue.length }));
  expect(frozen.phase).toBe('obstacleTutorial'); expect(frozen.queue).toBe(0);
  await page.waitForTimeout(180);
  expect(await page.evaluate(() => ({ time: FLIPSTRIKE.run.time, clock: FLIPSTRIKE.tableElements[0].clock }))).toEqual({ time: frozen.time, clock: frozen.clock });
  await page.keyboard.press('Enter');
  await expect(page.locator('#obstacle-tutorial')).toBeHidden(); expect(await page.evaluate(() => ({ phase: FLIPSTRIKE.phase, running: FLIPSTRIKE.running, seen: FlipStorage.progress.seenObstacles }))).toEqual({ phase: 'attack', running: true, seen: ['bumper'] });
  await page.evaluate(() => FLIPSTRIKE.scanObstacleTutorials()); await expect(page.locator('#obstacle-tutorial')).toBeHidden();
});

test('vortex capture telegraphs a deterministic safe vector and restores it exactly', async ({ page }) => {
  await page.goto('/pinball/'); await page.waitForFunction(() => !!window.FLIPSTRIKE); await page.evaluate(() => FLIPSTRIKE.startNew(31));
  const result = await page.evaluate(() => {
    const vortex = FLIPSTRIKE.tableElements.find((element) => element.def.type === 'kicker'), vectors = Array.from({ length: 8 }, () => FLIPSTRIKE.randomVortexLaunch()), ball = FLIPSTRIKE.balls[0]; ball.getUserData().launched = true; ball.setGravityScale(1); ball.setTransform(planck.Vec2(vortex.def.x / 60, vortex.def.y / 60), 0); FLIPSTRIKE.onContact({ getFixtureA: () => ball.getFixtureList(), getFixtureB: () => vortex.bodies[0].getFixtureList() }); const capture = vortex.captures[0], serialized = FLIPSTRIKE.serializeTable().find((item) => item.id === vortex.id).captures[0]; return { vectors, capture: { remaining: capture.remaining, duration: capture.duration, vector: capture.launchVector }, serialized };
  });
  expect(new Set(result.vectors.map((vector) => vector.map((value) => value.toFixed(2)).join(','))).size).toBeGreaterThan(4);
  for (const vector of result.vectors) { const speed = Math.hypot(...vector); expect(vector[1]).toBeLessThanOrEqual(-12); expect(speed).toBeGreaterThanOrEqual(14); expect(speed).toBeLessThanOrEqual(24); }
  expect(result.capture.duration).toBe(.7); expect(result.serialized.launchVector).toEqual(result.capture.vector);
  const launched = await page.evaluate(() => { const vortex = FLIPSTRIKE.tableElements.find((element) => element.def.type === 'kicker'), capture = vortex.captures[0], expected = [...capture.launchVector]; FLIPSTRIKE.updateTable(.71); const velocity = FLIPSTRIKE.balls[0].getLinearVelocity(); return { expected, actual: [velocity.x, velocity.y], captures: vortex.captures.length }; });
  expect(launched.captures).toBe(0); expect(launched.actual[0]).toBeCloseTo(launched.expected[0], 5); expect(launched.actual[1]).toBeCloseTo(launched.expected[1], 5);
});

const FLIP_DATA_ELEMENT_TYPES = ['bumper', 'slingshot', 'spinner', 'gate', 'rollover', 'ramp', 'kicker', 'captive', 'magnet', 'vent', 'crusher', 'cover'];

test('all table modules pass bounds, lane, and runtime construction validation', async ({ page }) => {
  await page.goto('/pinball/'); await page.waitForFunction(() => !!window.FLIPSTRIKE); await page.evaluate(() => FLIPSTRIKE.startNew(1));
  const validation = await page.evaluate(() => FLIP_DATA.TABLE_MODULES.map((layout) => ({ id: layout.id, errors: FLIPSTRIKE.validateTableLayout(layout) })));
  expect(validation.every((result) => result.errors.length === 0)).toBe(true);
  for (const level of [1, 4, 7, 10, 13, 16, 21, 31, 41, 61, 66, 71, 81]) {
    const runtime = await page.evaluate((value) => { FLIPSTRIKE.startNew(value); return { layout: FLIPSTRIKE.run.layoutId, elements: FLIPSTRIKE.tableElements.map((element) => element.def.type), serialized: FLIPSTRIKE.serializeTable().length, rails: FLIPSTRIKE.walls.length, drain: FLIPSTRIKE.drain.getFixtureList().isSensor(), cap: FLIPSTRIKE.run.challenge.obstacleCap }; }, level);
    expect(runtime.layout).toContain('challenge-'); expect(runtime.serialized).toBe(runtime.elements.length); expect(runtime.elements.length).toBeLessThanOrEqual(runtime.cap); expect(runtime.rails).toBe(5); expect(runtime.drain).toBe(true);
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

test('actor and defense assets map every enemy, biome, and boss presentation', async ({ page, request }) => {
  await page.goto('/pinball/'); await page.waitForFunction(() => !!window.FLIPSTRIKE);
  const assets = await page.evaluate(() => ({ roles: FLIP_DATA.ACTOR_ASSETS.roles, bosses: FLIP_DATA.ACTOR_ASSETS.bosses, mapped: FLIP_DATA.ENEMIES.every((enemy) => !!FLIP_DATA.ACTOR_ASSETS.roles[enemy.spriteId]), themes: FLIP_DATA.BOSSES.map((boss) => boss.projectileTheme), presentations: FLIP_DATA.BOSSES.every((boss) => !!boss.defensePresentation) }));
  expect(Object.keys(assets.roles)).toHaveLength(12); expect(Object.keys(assets.bosses)).toHaveLength(5); expect(assets.mapped).toBe(true); expect(new Set(assets.themes).size).toBe(5); expect(assets.presentations).toBe(true);
  const defenseAssets = await page.evaluate(() => FLIP_DATA.DEFENSE_ASSETS);
  expect(Object.keys(defenseAssets.backgrounds)).toHaveLength(5);
  for (const url of [...Object.values(assets.roles), ...Object.values(assets.bosses), defenseAssets.ship, ...Object.values(defenseAssets.backgrounds)]) expect((await request.get(`/pinball/${url}`)).ok()).toBe(true);
  await page.evaluate(() => FLIPSTRIKE.startNew(25));
  await expect.poll(() => page.evaluate(() => FLIPSTRIKE.actorSprites.size)).toBe(1);
  await page.evaluate(() => { const ball = FLIPSTRIKE.balls[0]; ball.getUserData().launched = true; ball.setGravityScale(1); ball.setTransform(planck.Vec2(6, 1120 / 60), 0); ball.setLinearVelocity(planck.Vec2(0, 8)); });
  await expect(page.locator('#phase')).toHaveText('BALL LEAKED');
  await page.evaluate(() => { FLIPSTRIKE.run.transition.remaining = .01; });
  await expect(page.locator('#phase')).toContainText('DODGE');
  const bossUi = await page.evaluate(() => { FLIPSTRIKE.spawnProjectile(); FLIPSTRIKE.render(); const sprite = FLIPSTRIKE.defenseBossSprite; return { visible: sprite.visible, width: sprite.width, visual: FLIPSTRIKE.projectiles[0].visual, mix: FLIPSTRIKE.phaseVisualMix() }; });
  expect(bossUi.visible).toBe(true); expect(bossUi.width).toBeGreaterThan(250); expect(bossUi.visual).toBe('shard'); expect(bossUi.mix).toBe(1);
  const formation = await page.evaluate(() => { FLIPSTRIKE.startNew(1); FLIPSTRIKE.beginDefense(); FLIPSTRIKE.spawnProjectile(); FLIPSTRIKE.render(); return { count: FLIPSTRIKE.defenseFormationSprites.length, textured: FLIPSTRIKE.defenseFormationSprites.every((entry) => !!entry.sprite), boss: FLIPSTRIKE.defenseBossSprite, shooter: FLIPSTRIKE.run.defensePresenterIndex }; });
  expect(formation).toEqual({ count: 1, textured: true, boss: null, shooter: 0 });
});

test('defense expiry clears every projectile before survival and freezes only the normal timer', async ({ page }) => {
  await page.goto('/pinball/'); await page.waitForFunction(() => !!window.FLIPSTRIKE); await page.evaluate(() => FLIPSTRIKE.startNew(1));
  const start = await page.evaluate(() => {
    FLIPSTRIKE.beginDefense(); FLIPSTRIKE.run.time = 90; FLIPSTRIKE.run.defenseTime = .01; FLIPSTRIKE.run.shotSequence = 0;
    FLIPSTRIKE.projectiles = [{ x: 100, y: 500, vx: 0, vy: 80, age: 0, telegraph: 0, hit: false, penalty: 2, shape: 'aim', visual: 'shard' }];
    return FLIPSTRIKE.run.time;
  });
  await expect.poll(() => page.evaluate(() => FLIPSTRIKE.run.defenseState)).toBe('clearing');
  await page.waitForTimeout(220);
  const cleanup = await page.evaluate(() => ({ phase: FLIPSTRIKE.phase, count: FLIPSTRIKE.projectiles.length, y: FLIPSTRIKE.projectiles[0]?.y, time: FLIPSTRIKE.run.time, shots: FLIPSTRIKE.run.shotSequence, transition: FLIPSTRIKE.run.transition }));
  expect(cleanup.phase).toBe('defense'); expect(cleanup.count).toBe(1); expect(cleanup.y).toBeGreaterThan(500); expect(Math.abs(cleanup.time - start)).toBeLessThan(.03); expect(cleanup.shots).toBe(0); expect(cleanup.transition).toBeNull();
  await page.evaluate(() => { FLIPSTRIKE.projectiles[0].x = FLIPSTRIKE.run.carriageX; FLIPSTRIKE.projectiles[0].y = 1080; FLIPSTRIKE.projectiles[0].vy = 0; FLIPSTRIKE.run.defenseInvulnerable = 0; });
  await expect.poll(() => page.evaluate(() => FLIPSTRIKE.run.time)).toBeLessThan(start - 1.9);
  await expect(page.locator('#transition-title')).toHaveText('WAVE SURVIVED');
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
    const installed = effects.every((effect) => FLIPSTRIKE.tableElements.some((element) => element.id.endsWith(`card-${effect}`))), ramp = FLIPSTRIKE.tableElements.find((element) => element.id.endsWith('card-ramp')), rampIsGuidanceOnly = ramp.bodies.some((body) => body.getUserData().type === 'rampGuide') && ramp.fixtures.every(({ solid }) => solid === false) && !FLIPSTRIKE.walls.some((body) => body.getUserData().type === 'rampRail'); cards.forEach((card) => FLIPSTRIKE.sellCard(card.id));
    return { installed, rampIsGuidanceOnly, removed: effects.every((effect) => !FLIPSTRIKE.tableElements.some((element) => element.id.endsWith(`card-${effect}`))), finite: FLIPSTRIKE.tableElements.flatMap((element) => element.bodies).every((body) => Number.isFinite(body.getPosition().x)) };
  });
  expect(result).toEqual({ installed: true, rampIsGuidanceOnly: true, removed: true, finite: true });
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
  const morph = await page.evaluate(() => { FLIPSTRIKE.run.transition.remaining = 1; FLIPSTRIKE.render(); return FLIPSTRIKE.phaseVisualMix(); });
  expect(morph).toBeCloseTo(.5, 2);
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

  await page.keyboard.down('Space'); await page.waitForTimeout(80); await page.keyboard.up('Space');
  await expect.poll(() => page.evaluate(() => FLIPSTRIKE.run.time), { timeout: 2500 }).toBeLessThan(initial - .05);

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

test('final enemy XP threshold cannot replace the level clear screen', async ({ page }) => {
  await page.goto('/pinball/'); await page.waitForFunction(() => !!window.FLIPSTRIKE); await expect(page.locator('.brand')).toBeVisible(); await page.evaluate(() => FLIPSTRIKE.startNew(1));
  await page.evaluate(() => { FLIPSTRIKE.run.xp = FLIPSTRIKE.xpNeeded() - 1; FLIPSTRIKE.killEnemy(FLIPSTRIKE.enemies[0]); });
  await expect(page.getByRole('button', { name: /Next Level/ })).toBeVisible(); await page.waitForTimeout(250);
  await expect(page.locator('.upgrade-card')).toHaveCount(0); expect(await page.evaluate(() => ({ phase: FLIPSTRIKE.phase, pending: FLIPSTRIKE.run.pendingDraft, timer: FLIPSTRIKE.draftTimer }))).toEqual({ phase: 'clear', pending: false, timer: null });
});

test('boundary XP draft resolves before spawning the next encounter exactly once', async ({ page }) => {
  await page.goto('/pinball/'); await page.waitForFunction(() => !!window.FLIPSTRIKE); await expect(page.locator('.brand')).toBeVisible(); await page.evaluate(() => FLIPSTRIKE.startNew(21));
  await page.evaluate(() => { FLIPSTRIKE.enemies.forEach((enemy) => { FLIPSTRIKE.destroyActorSprite(enemy); FLIPSTRIKE.world.destroyBody(enemy); }); FLIPSTRIKE.enemies = []; const enemy = FLIPSTRIKE.spawnEnemyInstance({ id: 'drifter-1', p: { x: 6, y: 6 } }); FLIPSTRIKE.run.xp = FLIPSTRIKE.xpNeeded() - 1; FLIPSTRIKE.killEnemy(enemy); });
  await expect(page.locator('.upgrade-card')).toHaveCount(3); expect(await page.evaluate(() => ({ encounter: FLIPSTRIKE.run.encounter, enemies: FLIPSTRIKE.enemies.length, advance: FLIPSTRIKE.run.pendingEncounterAdvance }))).toEqual({ encounter: 0, enemies: 0, advance: true });
  const before = await page.evaluate(() => FLIPSTRIKE.run.time); await page.locator('.upgrade-card').first().click(); await expect(page.locator('#transition-title')).toHaveText('PHASE 2 / 2'); expect(await page.evaluate(() => ({ phase: FLIPSTRIKE.phase, timerActive: FLIPSTRIKE.isMainTimerActive(), encounter: FLIPSTRIKE.run.encounter }))).toEqual({ phase: 'encounterTransition', timerActive: false, encounter: 0 }); await page.waitForTimeout(250); expect(Math.abs(await page.evaluate(() => FLIPSTRIKE.run.time) - before)).toBeLessThan(.03); await expect.poll(() => page.evaluate(() => FLIPSTRIKE.enemies.length)).toBeGreaterThan(0); const expected = await page.evaluate(() => FLIPSTRIKE.run.challenge.encounters[1]); expect(await page.evaluate(() => FLIPSTRIKE.enemies.map((enemy) => enemy.getUserData().id))).toEqual(expected); expect(await page.evaluate(() => FLIPSTRIKE.run.time)).toBeGreaterThanOrEqual(before + 7.9); await page.waitForTimeout(650); expect(await page.evaluate(() => FLIPSTRIKE.enemies.map((enemy) => enemy.getUserData().id))).toEqual(expected);
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
  expect(restored.id).toBe(expected.id); expect(restored.enemy).toBe(expected.enemy); expect(Math.abs(restored.clock - expected.clock)).toBeLessThan(.08); expect(restored.hp).toBe(expected.hp); expect(Math.abs(restored.behaviorClock - expected.behaviorClock)).toBeLessThan(.08);
});
