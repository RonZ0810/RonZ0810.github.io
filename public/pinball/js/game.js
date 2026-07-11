(async function () {
  "use strict";
  const D = window.FLIP_DATA, S = window.FlipStorage, P = window.planck, X = window.PIXI;
  const $ = (selector) => document.querySelector(selector), $$ = (selector) => [...document.querySelectorAll(selector)];
  const canvas = $("#game"), overlay = $("#overlay"), hud = $("#hud"), controls = $("#touch-controls"), abilities = $("#abilities"), pauseButton = $("#pause-btn"), transitionScreen = $("#phase-transition");
  const W = D.WORLD.width, H = D.WORLD.height, SCALE = 60, STEP = 1 / D.WORLD.physicsHz;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const formatTime = (seconds) => `${String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, "0")}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, "0")}`;
  const app = new X.Application();
  await app.init({ canvas, width: W, height: H, antialias: true, autoDensity: false, background: 0x02060b, preference: "webgl" });
  const scene = new X.Container(), backdrop = new X.Sprite(await X.Assets.load("assets/flipstrike-tower.png")), art = new X.Graphics(), actorLayer = new X.Container();
  const actorTextures = {};
  await Promise.all([...Object.entries(D.ACTOR_ASSETS.roles).map(([id, url]) => [`role:${id}`, url]), ...Object.entries(D.ACTOR_ASSETS.bosses).map(([id, url]) => [`boss:${id}`, url])].map(async ([id, url]) => { try { actorTextures[id] = await X.Assets.load(url); } catch { actorTextures[id] = null; } }));
  backdrop.width = W; backdrop.height = H; backdrop.alpha = .2; scene.addChild(backdrop, art, actorLayer); app.stage.addChild(scene);

  class Rng {
    constructor(seed) { this.state = seed >>> 0 || 1; }
    next() { let x = this.state; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.state = x >>> 0; return this.state / 4294967296; }
    int(max) { return Math.floor(this.next() * max); }
  }

  class AudioSystem {
    constructor() { this.ready = false; window.Howler.mute(S.settings.muted); window.Howler.volume(S.settings.effects); }
    unlock() { if (this.ready || S.settings.muted) return; this.ready = true; window.Howler.ctx?.resume?.(); }
    tone(frequency = 240, duration = .07, gain = .035) {
      if (!this.ready || S.settings.muted || !window.Howler.ctx) return;
      const ctx = window.Howler.ctx, oscillator = ctx.createOscillator(), volume = ctx.createGain(), now = ctx.currentTime;
      oscillator.type = "triangle"; oscillator.frequency.setValueAtTime(frequency, now); volume.gain.setValueAtTime(gain * S.settings.effects, now); volume.gain.exponentialRampToValueAtTime(.0001, now + duration);
      oscillator.connect(volume).connect(ctx.destination); oscillator.start(now); oscillator.stop(now + duration);
    }
  }

  class SaveSnapshot {
    static from(game) {
      const balls = game.balls.map((body) => ({ p: vecOut(body.getPosition()), v: vecOut(body.getLinearVelocity()), angle: body.getAngle(), launched: !!body.getUserData().launched }));
      const enemies = game.enemies.map((body) => ({ id: body.getUserData().id, hp: body.getUserData().hp, maxHp: body.getUserData().maxHp, p: vecOut(body.getPosition()), v: vecOut(body.getLinearVelocity()), phase: body.getUserData().phase || 1 }));
      return { version: D.VERSION, savedAt: Date.now(), run: structuredClone(game.run), phase: game.phase, rng: game.rng.state, balls, enemies, projectiles: structuredClone(game.projectiles) };
    }
  }
  const vecOut = (v) => ({ x: v.x, y: v.y });

  class GameDirector {
    constructor() {
      this.audio = new AudioSystem(); this.saveService = new S.SaveService(); this.phase = "menu"; this.running = false; this.world = null; this.run = null;
      this.balls = []; this.enemies = []; this.flippers = []; this.bumpers = []; this.walls = []; this.aprons = []; this.mounts = []; this.drain = null; this.projectiles = []; this.particles = []; this.floaters = []; this.actorSprites = new Map();
      this.keys = { left: false, right: false }; this.touch = { left: false, right: false }; this.dragX = null; this.accumulator = 0; this.last = performance.now(); this.hitCooldown = new Map();
      this.bindInput(); this.menu(); app.ticker.add((ticker) => this.frame(ticker.deltaMS / 1000));
    }
    button(label, action, kind = "") { return `<button class="button ${kind}" data-action="${action}"><span>${label}</span><span>›</span></button>`; }
    setOverlay(html) { overlay.innerHTML = html; $$('[data-action]').forEach((node) => node.addEventListener("click", () => this.action(node.dataset.action))); }
    async menu() {
      this.running = false; this.phase = "menu"; this.hideTransition(); this.clearActorSprites(); hud.classList.add("hidden"); controls.classList.add("hidden"); abilities.classList.add("hidden"); pauseButton.classList.add("hidden"); backdrop.alpha = .58;
      const canContinue = await this.saveService.hasSuspend();
      this.setOverlay(`<div class="panel menu-panel"><p class="eyebrow">PHYSICS-DRIVEN PINBALL ROGUELIKE</p><h1 class="brand">FLIP<span>STRIKE</span></h1><p class="lead">Master a living neon tower. Strike moving enemies, build a temporary machine, and dodge the return fire after every drain.</p><div class="menu">${this.button("Continue", "continue", canContinue ? "primary" : "disabled")}${this.button("Campaign", "campaign", canContinue ? "" : "primary")}${S.progress.endlessUnlocked ? this.button("Endless Mode", "endless") : ""}${this.button("Card Library", "library")}${this.button("How to Play", "help")}${this.button("Settings", "settings")}</div><div class="menu-meta"><span>LEVEL ${S.progress.unlockedLevel} / 101</span><span>${S.progress.discovered.length} / 150 CARDS</span><span>${S.progress.achievements.length} / 32 BADGES</span></div></div>`);
      if (!canContinue) $('[data-action="continue"]').disabled = true;
    }
    campaign() {
      const nodes = D.LEVELS.map((level) => { const difficulty = D.difficultyById[level.difficulty], locked = level.level > S.progress.unlockedLevel, boss = !!level.boss; return `<button class="level-node ${boss ? "boss" : ""}" ${locked ? "disabled" : ""} data-level="${level.level}" style="--accent:${difficulty.color}"><b>${String(level.level).padStart(3, "0")}</b><span>${escapeHtml(level.name)}</span><em>${boss ? "BOSS · " : ""}${difficulty.name}</em></button>`; }).join("");
      this.setOverlay(`<div class="panel wide"><div class="panel-head"><div><p class="eyebrow">CAMPAIGN ASCENT</p><h2>101 LEVELS</h2></div><span>ENDLESS AT 102</span></div><div class="campaign-map">${nodes}</div><div class="menu compact">${this.button("Back", "menu")}</div></div>`);
      $$("[data-level]").forEach((node) => node.onclick = () => this.startNew(Number(node.dataset.level), false));
    }
    library() {
      const discovered = new Set(S.progress.discovered), cards = D.CARDS.map((card) => `<article class="library-card ${discovered.has(card.id) ? "" : "unknown"}" style="--rarity:${D.RARITIES[card.rarity].color}"><div class="card-art" style="--art:${card.art}"><i></i></div><small>${D.RARITIES[card.rarity].name}</small><strong>${discovered.has(card.id) ? escapeHtml(card.name) : "UNDISCOVERED"}</strong><span>${escapeHtml(card.categoryLabel)}</span></article>`).join("");
      this.setOverlay(`<div class="panel wide"><div class="panel-head"><div><p class="eyebrow">ARCHIVE</p><h2>CARD LIBRARY</h2></div><span>${discovered.size} / 150</span></div><div class="library-grid">${cards}</div><div class="menu compact">${this.button("Back", "menu")}</div></div>`);
    }
    help() { this.setOverlay(`<div class="panel"><p class="eyebrow">FLIGHT MANUAL</p><h2>MASTER THE RHYTHM</h2><div class="help-grid"><article><b>01 · ATTACK</b><p>Hold Space or Launch, release, then time A/D or the lower touch zones to strike every enemy.</p></article><article><b>02 · DRAIN</b><p>The attack continues through multiball. Only after every active ball drains is one ball consumed.</p></article><article><b>03 · DODGE</b><p>Drag or use A/D to slide the flipper carriage. Hits break combo, slow movement, and remove time.</p></article><article><b>04 · BUILD</b><p>XP pauses play for a three-card draft. Every build resets when the level ends or restarts.</p></article></div><div class="menu">${this.button("Play Level 1", "level1", "primary")}${this.button("Back", "menu")}</div></div>`); }
    settings() {
      this.setOverlay(`<div class="panel"><p class="eyebrow">SYSTEM</p><h2>SETTINGS</h2><div class="settings-list"><button data-setting="muted"><span>SOUND</span><b>${S.settings.muted ? "OFF" : "ON"}</b></button><button data-setting="reducedEffects"><span>REDUCED EFFECTS</span><b>${S.settings.reducedEffects ? "ON" : "OFF"}</b></button><button data-setting="vibration"><span>VIBRATION</span><b>${S.settings.vibration ? "ON" : "OFF"}</b></button></div><div class="menu">${this.button("Back", "menu", "primary")}</div></div>`);
      $$('[data-setting]').forEach((node) => node.onclick = () => { const key = node.dataset.setting; S.settings[key] = !S.settings[key]; S.saveSettings(); window.Howler.mute(S.settings.muted); this.settings(); });
    }
    async startNew(level = 1, endless = false) {
      const index = endless ? 100 : clamp(level - 1, 0, 100), spec = D.LEVELS[index], seed = endless ? (Date.now() >>> 0) : spec.seed;
      this.run = { version: D.VERSION, level: spec.level, displayLevel: endless ? Math.max(102, S.progress.endlessBest + 1) : spec.level, endless, seed, encounter: 0, time: spec.timer, balls: spec.balls, xp: 0, draftCount: 0, cards: {}, consumables: [], rerolls: 1, score: 0, combo: 1, comboClock: 0, hits: 0, kills: 0, excellent: 0, damage: 0, bossPhase: 1, defenseHitGuard: false, transition: null, started: Date.now() };
      this.rng = new Rng(seed); this.startEncounter();
    }
    startEncounter(snapshot = null) {
      const spec = this.levelSpec(); this.phase = snapshot?.phase || "attack"; this.running = true; this.projectiles = snapshot?.projectiles || []; this.particles = []; this.floaters = []; this.createWorld(); this.spawnEncounter(snapshot?.enemies); if (snapshot?.balls?.length) snapshot.balls.forEach((ball) => this.spawnBall(ball)); else this.prepareBall();
      overlay.innerHTML = ""; backdrop.alpha = .11; hud.classList.remove("hidden"); controls.classList.remove("hidden"); abilities.classList.remove("hidden"); pauseButton.classList.remove("hidden"); if (this.run.transition) this.showTransition(); else this.hideTransition(); this.updateHud();
    }
    levelSpec() { return D.LEVELS[Math.min(100, this.run.level - 1)]; }
    createWorld() {
      this.clearActorSprites(); this.world = new P.World({ gravity: P.Vec2(0, 20) }); this.balls = []; this.enemies = []; this.flippers = []; this.flipperJoints = []; this.bumpers = []; this.walls = []; this.aprons = []; this.mounts = []; this.drain = null; this.hitCooldown.clear(); this.flipperGround = this.world.createBody();
      const edge = (x1, y1, x2, y2, tag = "wall") => { const body = this.world.createBody(); body.setUserData({ type: tag, line: [x1, y1, x2, y2] }); body.createFixture(P.Edge(P.Vec2(x1 / SCALE, y1 / SCALE), P.Vec2(x2 / SCALE, y2 / SCALE)), { friction: .05, restitution: .62 }); this.walls.push(body); return body; };
      const apron = (points, side) => { const body = this.world.createBody(); body.setUserData({ type: "apron", points, side }); body.createFixture(P.Polygon(points.map(([x, y]) => P.Vec2(x / SCALE, y / SCALE))), { friction: .18, restitution: .25 }); this.aprons.push(body); return body; };
      edge(42, 142, 42, 1165); edge(678, 142, 678, 1165); edge(42, 142, 160, 76); edge(160, 76, 560, 76); edge(678, 142, 560, 76);
      apron([[42, 1018], [140, 1058], [140, 1126], [42, 1165]], "left"); apron([[678, 1018], [678, 1165], [580, 1126], [580, 1058]], "right");
      [[158, 1090], [562, 1090]].forEach(([x, y]) => { const mount = this.world.createBody({ position: P.Vec2(x / SCALE, y / SCALE) }); mount.setUserData({ type: "flipperMount", x, y, radius: 18 }); mount.createFixture(P.Circle(18 / SCALE), { friction: .25, restitution: .18 }); this.mounts.push(mount); });
      this.drain = this.world.createBody({ position: P.Vec2(360 / SCALE, 1148 / SCALE) }); this.drain.setUserData({ type: "drain", rect: [158, 1138, 404, 24] }); this.drain.createFixture(P.Box(202 / SCALE, 12 / SCALE), { isSensor: true });
      [[180, 520, 34], [360, 445, 38], [540, 520, 34]].forEach(([x, y, radius], i) => { const body = this.world.createBody({ position: P.Vec2(x / SCALE, y / SCALE) }); body.setUserData({ type: "bumper", index: i, pulse: 0 }); body.createFixture(P.Circle(radius / SCALE), { restitution: 1.4 }); this.bumpers.push(body); });
      this.flippers = [this.makeFlipper(158, 1090, false), this.makeFlipper(562, 1090, true)];
      if (this.run.cards["flipper-05"]) this.flippers.push(this.makeFlipper(620, 770, true, .7));
      this.world.on("begin-contact", (contact) => this.onContact(contact));
    }
    makeFlipper(x, y, right, scale = 1) {
      const totalLength = 172 * scale * this.flipperLength(), bearingClearance = 21, bladeLength = totalLength - bearingClearance, halfLength = bladeLength / 2 / SCALE, halfHeight = 13 / SCALE, rest = (right ? -1 : 1) * Math.PI / 22.5, travel = 20 * Math.PI / 180;
      const body = this.world.createDynamicBody({ position: P.Vec2(x / SCALE, y / SCALE), angle: rest, angularDamping: 3, allowSleep: false });
      body.setUserData({ type: "flipper", right, pivot: { x: x / SCALE, y: y / SCALE }, halfLength, totalLength: totalLength / SCALE, rest, travel });
      body.createFixture(P.Box(halfLength, halfHeight, P.Vec2((right ? -1 : 1) * (bearingClearance / SCALE + halfLength), 0), 0), { density: 4, friction: .9, restitution: .18 });
      const joint = this.world.createJoint(P.RevoluteJoint({ enableMotor: true, motorSpeed: 0, maxMotorTorque: 1500 * this.flipperPower(), enableLimit: true, lowerAngle: right ? 0 : -travel, upperAngle: right ? travel : 0 }, this.flipperGround, body, P.Vec2(x / SCALE, y / SCALE)));
      body.getUserData().joint = joint; this.flipperJoints.push(joint); return body;
    }
    flipperLength() { return 1 + this.effectCount("flipperLength") * .08; }
    flipperPower() { return 1 + this.effectCount("flipperPower") * .14; }
    flipperTargetAngle(active, travel) { return active ? travel : 0; }
    clearActorSprites() { for (const sprite of this.actorSprites?.values?.() || []) sprite.destroy(); this.actorSprites?.clear?.(); }
    createActorSprite(body, def) { const texture = actorTextures[def.level ? `boss:${def.spriteId}` : `role:${def.spriteId}`]; if (!texture) return null; const sprite = new X.Sprite(texture); sprite.anchor.set(.5); sprite.eventMode = "none"; actorLayer.addChild(sprite); this.actorSprites.set(body, sprite); return sprite; }
    destroyActorSprite(body) { const sprite = this.actorSprites.get(body); if (sprite) sprite.destroy(); this.actorSprites.delete(body); }
    currentBoss() { return this.enemies.find((body) => D.enemyById[body.getUserData().id]?.level) || null; }
    setControlLock(locked) { controls.classList.toggle("locked", locked); abilities.classList.toggle("locked", locked); if (locked) { this.keys.left = this.keys.right = this.touch.left = this.touch.right = false; } }
    beginTransition(kind, nextPhase) { this.phase = kind === "leaked" ? "attackToDefense" : "defenseToAttack"; this.run.transition = { kind, remaining: 2, duration: 2, nextPhase }; this.projectiles = []; this.setControlLock(true); this.showTransition(); this.audio.tone(kind === "leaked" ? 88 : 420, .28, .06); }
    showTransition() { const transition = this.run?.transition; if (!transition) return this.hideTransition(); const survived = transition.kind === "survived"; transitionScreen.classList.toggle("green", survived); transitionScreen.classList.remove("hidden"); $("#transition-kicker").textContent = survived ? "DEFENSE COMPLETE" : "DRAIN DETECTED"; $("#transition-title").textContent = survived ? "WAVE SURVIVED" : "BALL LEAKED"; this.updateTransitionPresentation(); }
    updateTransitionPresentation() { const transition = this.run?.transition; if (!transition) return; transitionScreen.style.setProperty("--phase-progress", clamp(transition.remaining / transition.duration, 0, 1)); }
    hideTransition() { transitionScreen.classList.add("hidden"); transitionScreen.classList.remove("green"); transitionScreen.style.removeProperty("--phase-progress"); }
    updateTransition(dt) { if (!this.run.transition) return; this.run.transition.remaining -= dt; this.updateTransitionPresentation(); if (this.run.transition.remaining > 0) return; const next = this.run.transition.nextPhase; this.run.transition = null; this.hideTransition(); this.setControlLock(false); if (next === "defense") this.beginDefense(); else { this.phase = "attack"; this.prepareBall(); this.toast("RELAUNCH"); } }
    spawnEncounter(saved = null) {
      const spec = this.levelSpec(), ids = spec.encounters[this.run.encounter] || spec.encounters[0];
      (saved || ids.map((id, i) => ({ id, hp: null, maxHp: null, p: { x: (160 + (i % 4) * 135) / SCALE, y: (260 + Math.floor(i / 4) * 125) / SCALE }, phase: 1 }))).forEach((item, index) => {
        const def = D.enemyById[item.id], scale = this.run.endless ? 1 + (this.run.displayLevel - 101) * .025 : 1 + Math.max(0, this.run.level - 1) * .012;
        const maxHp = item.maxHp || Math.round(def.hp * scale), body = this.world.createKinematicBody({ position: P.Vec2(item.p.x, item.p.y) });
        body.setUserData({ type: "enemy", id: item.id, hp: item.hp ?? maxHp, maxHp, phase: item.phase || 1, t: index * .7, flash: 0, invulnerable: false });
        body.createFixture(P.Circle((def.radius || 58) / SCALE), { density: 3, restitution: .82, friction: .05 }); this.enemies.push(body); this.createActorSprite(body, def);
      });
    }
    prepareBall() { if (!this.running || this.phase !== "attack") return; this.spawnBall({ p: { x: 646 / SCALE, y: 970 / SCALE }, v: { x: 0, y: 0 }, launched: false }); this.run.plunger = 18; }
    spawnBall(saved = null) {
      const radius = 14 * (1 + this.effectCount("size") * .08), body = this.world.createDynamicBody({ position: P.Vec2(saved?.p.x || 646 / SCALE, saved?.p.y || 970 / SCALE), bullet: true, linearDamping: .025, gravityScale: saved?.launched ? 1 : 0 });
      body.setUserData({ type: "ball", launched: !!saved?.launched, lastHit: null, saved: false, trail: [] }); body.createFixture(P.Circle(radius / SCALE), { density: 1.2, restitution: .55, friction: .04 }); if (saved?.v) body.setLinearVelocity(P.Vec2(saved.v.x, saved.v.y)); this.balls.push(body); return body;
    }
    releasePlunger() {
      if (this.phase !== "attack") return; const ball = this.balls.find((item) => !item.getUserData().launched); if (!ball) return;
      ball.getUserData().launched = true; ball.setGravityScale(1); ball.setLinearVelocity(P.Vec2(-3.1 - this.rng.next() * .25, -18 - (this.run.plunger || 18) * .12)); this.run.plungerHeld = false; this.run.plunger = 18; this.audio.tone(130, .16, .06);
      if (this.effectCount("multiball") && this.run.hits % 4 === 0) { const extra = this.spawnBall({ p: vecOut(ball.getPosition()), v: { x: 3, y: -19 }, launched: true }); extra.setGravityScale(1); }
    }
    onContact(contact) {
      const a = contact.getFixtureA().getBody(), b = contact.getFixtureB().getBody(), ua = a.getUserData() || {}, ub = b.getUserData() || {};
      const ball = ua.type === "ball" ? a : ub.type === "ball" ? b : null, other = ball === a ? b : a, data = other?.getUserData?.() || {};
      if (!ball || !ball.getUserData().launched) return;
      if (data.type === "drain") { ball.getUserData().drained = true; return; }
      if (data.type === "enemy") this.hitEnemy(ball, other);
      if (data.type === "bumper") { data.pulse = 1; this.audio.tone(340, .05); this.addXp(2 + this.effectCount("bumperDamage") * 2); if (this.effectCount("bumperDamage")) this.enemies.forEach((enemy) => this.damageEnemy(enemy, 2 * this.effectCount("bumperDamage"), false)); }
      if (data.type === "flipper") this.audio.tone(180, .035, .025);
    }
    hitEnemy(ball, enemy) {
      const key = `${this.balls.indexOf(ball)}:${this.enemies.indexOf(enemy)}`, now = performance.now(); if (now - (this.hitCooldown.get(key) || 0) < 120) return; this.hitCooldown.set(key, now);
      const speed = ball.getLinearVelocity().length(), excellent = speed >= Math.max(12, 18 - this.effectCount("excellent") * 1.5), base = 10 * (1 + this.effectCount("damage") * .18), critical = this.effectCount("critical") && this.rng.next() < .12;
      let damage = clamp(base * clamp(speed / 8, .65, 2.3) * (excellent ? 1.4 : 1) * (critical ? 2 : 1), 4, 90); this.damageEnemy(enemy, damage, excellent, critical); this.run.hits++; this.run.combo = clamp(this.run.combo + .12, 1, 9.9); this.run.comboClock = 2.5 + this.effectCount("comboHold") * .6;
      if (excellent) { this.run.excellent++; this.award("achievement-2"); this.float("EXCELLENT SHOT", enemy, 0xffe590, 23); this.audio.tone(520, .12, .06); if (!S.settings.reducedEffects) app.ticker.speed = .25, setTimeout(() => app.ticker.speed = 1, 110); }
      if (this.effectCount("chain")) { const target = this.enemies.find((item) => item !== enemy); if (target) this.damageEnemy(target, damage * .28, false); }
    }
    damageEnemy(enemy, amount, excellent, critical = false) {
      const data = enemy.getUserData(), def = D.enemyById[data.id]; if (!data || data.invulnerable) return;
      const armor = def.armor || def.shield || 0, pierce = this.effectCount("pierce"); amount = Math.max(1, amount - Math.max(0, armor - pierce) * 4); data.hp -= amount; data.flash = .12; this.run.damage += amount;
      this.float(`${critical ? "CRIT " : ""}${Math.round(amount)}`, enemy, critical ? 0xffe38a : 0xffffff, critical ? 22 : 16); this.addXp(amount * .26 * (1 + this.effectCount("xp") * .15));
      const boss = D.BOSSES.find((item) => item.id === data.id); if (boss) this.checkBossPhase(enemy);
      if (data.hp <= 0) this.killEnemy(enemy);
    }
    checkBossPhase(enemy) {
      const data = enemy.getUserData(), ratio = data.hp / data.maxHp, target = ratio <= .25 ? 4 : ratio <= .5 ? 3 : ratio <= .75 ? 2 : 1; if (target <= this.run.bossPhase) return;
      this.run.bossPhase = target; data.phase = target; this.projectiles = []; this.run.time += 12; this.run.balls = Math.min(7, this.run.balls + 1); this.float(`PHASE ${target}`, enemy, 0xff7699, 30); this.audio.tone(95, .4, .08);
    }
    killEnemy(enemy) {
      if (!this.enemies.includes(enemy)) return; const def = D.enemyById[enemy.getUserData().id]; this.run.kills++; this.award("achievement-1"); this.run.score += Math.round((def.xp || 300) * 100 * this.run.combo); this.addXp((def.xp || 300) * (1 + this.effectCount("xp") * .15)); this.destroyActorSprite(enemy); this.world.destroyBody(enemy); this.enemies = this.enemies.filter((item) => item !== enemy); this.audio.tone(620, .12, .055);
      if (!this.enemies.length) this.encounterCleared();
    }
    encounterCleared() {
      const spec = this.levelSpec(); if (this.run.encounter + 1 < spec.encounters.length) { this.run.encounter++; this.run.time += spec.continuous ? 5 : 10; setTimeout(() => { this.spawnEncounter(); this.toast(spec.continuous ? "ZONE ASCENDING" : "ENCOUNTER OPEN"); }, 500); } else this.levelComplete();
    }
    addXp(amount) {
      if (!this.run || this.phase !== "attack") return; this.run.xp += amount * this.run.combo; const needed = this.xpNeeded(); if (this.run.xp >= needed && !this.run.pendingDraft) { this.run.xp -= needed; this.run.pendingDraft = true; setTimeout(() => this.showDraft(), 120); }
    }
    xpNeeded() { const n = this.run.draftCount; return 100 + 45 * n + 15 * n * n; }
    effectCount(effect) { return Object.entries(this.run?.cards || {}).reduce((sum, [id, count]) => sum + (D.cardById[id]?.effect === effect ? count : 0), 0); }
    drawCards() {
      const eligible = D.CARDS.filter((card) => (this.run.cards[card.id] || 0) < card.max && !(card.category === "consumable" && this.run.consumables.length >= 5));
      const picks = [], pool = [...eligible]; while (picks.length < 3 && pool.length) { const quarter = Math.floor(Math.min(100, this.run.level - 1) / 25), total = pool.reduce((sum, card) => sum + D.RARITIES[card.rarity].weight * (1 + quarter * (["rare", "superRare", "legendary"].includes(card.rarity) ? .16 : 0)), 0); let roll = this.rng.next() * total, index = 0; for (; index < pool.length; index++) { roll -= D.RARITIES[pool[index].rarity].weight; if (roll <= 0) break; } picks.push(pool.splice(Math.min(index, pool.length - 1), 1)[0]); } return picks;
    }
    showDraft() {
      this.running = false; this.phase = "draft"; const cards = this.drawCards();
      const html = cards.map((card) => `<button class="upgrade-card" data-card="${card.id}" style="--rarity:${D.RARITIES[card.rarity].color}"><div class="card-art" style="--art:${card.art}"><i></i></div><small>${D.RARITIES[card.rarity].name} · ${card.categoryLabel}</small><h3>${escapeHtml(card.name)}</h3><p>${escapeHtml(card.description)}</p><b>STACK ${this.run.cards[card.id] || 0} / ${card.max}</b></button>`).join("");
      this.setOverlay(`<div class="panel wide"><div class="panel-head"><div><p class="eyebrow">XP THRESHOLD REACHED</p><h2>CHOOSE ONE</h2></div><span>LEVEL BUILD · ${Object.values(this.run.cards).reduce((a, b) => a + b, 0)} / 50</span></div><div class="card-grid">${html}</div><div class="draft-tools"><button data-action="reroll" ${this.run.rerolls ? "" : "disabled"}>REROLL · ${this.run.rerolls}</button></div></div>`);
      $$('[data-card]').forEach((node) => node.onclick = () => this.chooseCard(node.dataset.card));
    }
    chooseCard(id) {
      const card = D.cardById[id]; if (!card || Object.values(this.run.cards).reduce((a, b) => a + b, 0) >= 50) return;
      this.run.cards[id] = (this.run.cards[id] || 0) + 1; if (card.category === "consumable") this.run.consumables.push(id); if (!S.progress.discovered.includes(id)) { S.progress.discovered.push(id); S.saveProgress(); }
      if (card.effect === "timeRefill") this.run.time += 20; this.run.draftCount++; this.run.pendingDraft = false; this.phase = "attack"; overlay.innerHTML = ""; this.running = true; this.toast(card.name);
    }
    reroll() { if (!this.run.rerolls) return; this.run.rerolls--; this.showDraft(); }
    isMainTimerActive() { return this.phase === "defense" || (this.phase === "attack" && this.balls.some((body) => body.getUserData().launched && !body.getUserData().drained)); }
    update(dt) {
      if (!this.running || !this.run) return; if (this.isMainTimerActive()) this.run.time -= dt; if (this.run.time <= 0) return this.fail("TIME EXPIRED");
      if (this.phase === "attack") this.updateAttack(dt); else if (this.phase === "defense") this.updateDefense(dt); else if (this.phase === "attackToDefense" || this.phase === "defenseToAttack") this.updateTransition(dt);
      if (this.run.time <= 0) return this.fail("TIME EXPIRED");
      this.run.abilityCooldown = Math.max(0, (this.run.abilityCooldown || 0) - dt);
      this.particles.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }); this.particles = this.particles.filter((p) => p.life > 0);
      this.floaters.forEach((p) => { p.y -= 38 * dt; p.life -= dt; p.label.x = p.x; p.label.y = p.y; p.label.alpha = clamp(p.life, 0, 1); if (p.life <= 0) p.label.destroy(); }); this.floaters = this.floaters.filter((p) => p.life > 0); this.updateHud();
    }
    updateAttack(dt) {
      const left = this.keys.left || this.touch.left, right = this.keys.right || this.touch.right;
      this.flippers.forEach((body) => { const data = body.getUserData(), active = data.right ? right : left, target = (data.right ? 1 : -1) * this.flipperTargetAngle(active, data.travel), error = target - data.joint.getJointAngle(), maxSpeed = active ? 42 : 28, motorSpeed = clamp(error * 72, -maxSpeed, maxSpeed); data.joint.setMotorSpeed(motorSpeed); data.joint.setMaxMotorTorque((active ? 4000 : 2600) * this.flipperPower()); });
      if (this.run.plungerHeld) this.run.plunger = clamp((this.run.plunger || 18) + dt * 70, 18, 100);
      this.enemies.forEach((body, i) => { const data = body.getUserData(), def = D.enemyById[data.id], pos = body.getPosition(); data.t += dt; data.flash = Math.max(0, data.flash - dt); const anchorX = (160 + (i % 4) * 135) / SCALE, targetX = anchorX + Math.sin(data.t * (def.speed || 25) / 22) * (38 + def.tier * 2) / SCALE; body.setLinearVelocity(P.Vec2((targetX - pos.x) * 2.2, Math.cos(data.t * .8) * .12)); });
      this.world.step(STEP); this.balls.forEach((body) => { const velocity = body.getLinearVelocity(), speed = velocity.length(), data = body.getUserData(), p = body.getPosition(); if (speed > 29) body.setLinearVelocity(velocity.mul(29 / speed)); if (data.launched) { data.trail.push({ x: p.x * SCALE, y: p.y * SCALE }); if (data.trail.length > 16) data.trail.shift(); } });
      const drained = this.balls.filter((body) => body.getUserData().drained || body.getPosition().y * SCALE > H + 40); drained.forEach((body) => this.removeBall(body));
      if (!this.balls.length && this.enemies.length) this.allBallsDrained();
      this.run.comboClock -= dt; if (this.run.comboClock <= 0) this.run.combo = Math.max(1, this.run.combo - dt * .45);
    }
    removeBall(body) { if (!this.balls.includes(body)) return; this.world.destroyBody(body); this.balls = this.balls.filter((item) => item !== body); }
    allBallsDrained() {
      if (this.effectCount("ballSave") && !this.run.ballSaveUsed) { this.run.ballSaveUsed = true; return this.prepareBall(); }
      this.run.balls--; this.run.combo = Math.max(1, this.run.combo * .7); if (this.run.balls <= 0) return this.fail("NO BALLS REMAIN"); this.beginTransition("leaked", "defense");
    }
    beginDefense() { this.phase = "defense"; this.run.defenseTime = clamp(5 + this.run.level * .07, 5, 12); this.run.shotClock = .5; this.run.carriageX = W / 2; this.run.defenseInvulnerable = 0; this.run.defenseSlow = 0; this.projectiles = []; this.setControlLock(false); this.toast("ENEMY PROJECTILE TURN"); }
    updateDefense(dt) {
      this.run.defenseTime -= dt; this.run.shotClock -= dt; this.run.defenseInvulnerable -= dt; this.run.defenseSlow -= dt;
      const direction = (this.keys.left || this.touch.left ? -1 : 0) + (this.keys.right || this.touch.right ? 1 : 0), speed = this.run.defenseSlow > 0 ? 190 : 360; if (this.dragX !== null) this.run.carriageX += (this.dragX - this.run.carriageX) * Math.min(1, dt * 12); else this.run.carriageX = clamp(this.run.carriageX + direction * speed * dt, 90, W - 90);
      if (this.run.shotClock <= 0) { this.spawnProjectile(); this.run.shotClock = clamp(.82 - this.run.level * .004, .38, .82); }
      this.projectiles.forEach((p) => { p.age += dt; p.telegraph = Math.max(0, (p.telegraph || 0) - dt); if (p.telegraph > 0) return; p.x += p.vx * dt; p.y += p.vy * dt; if (!p.hit && p.y > 1060 && p.y < 1115 && Math.abs(p.x - this.run.carriageX) < 70 && this.run.defenseInvulnerable <= 0) { p.hit = true; this.run.combo = 1; this.run.time -= p.penalty; this.run.defenseSlow = .7; this.run.defenseInvulnerable = .65; this.pushFloater(p.x, p.y, `-${p.penalty}s`, 0xff6d79, 24); this.audio.tone(75, .15, .07); if (navigator.vibrate && S.settings.vibration) navigator.vibrate(45); } }); this.projectiles = this.projectiles.filter((p) => !p.hit && p.y < H + 40);
      if (this.run.defenseTime <= 0) this.beginTransition("survived", "attack");
    }
    spawnProjectile() {
      const pattern = D.PATTERNS[(this.run.level + this.run.bossPhase + Math.floor(this.run.defenseTime)) % D.PATTERNS.length], boss = this.currentBoss(), theme = boss ? D.enemyById[boss.getUserData().id].projectileTheme : ({ aim: "shard", lane: "beam", spread: "orb", ring: "ring", cross: "cross", spiral: "prism" }[pattern]), sourceX = 110 + this.rng.next() * 500, targetX = this.run.carriageX + (this.rng.next() - .5) * 80, speed = 260 + this.run.level * 1.2, dx = targetX - sourceX, dy = 900, length = Math.hypot(dx, dy), penalty = 1 + Math.min(2, Math.floor(this.run.level / 35));
      const add = (x, vx, vy, visual = theme) => this.projectiles.push({ x, y: boss ? 330 : 190, vx, vy, age: 0, telegraph: .28, hit: false, penalty, shape: pattern, visual });
      add(sourceX, dx / length * speed, dy / length * speed); if (["spread", "cross", "ring", "spiral"].includes(pattern)) { add(sourceX - 24, dx / length * speed - 65, dy / length * speed); add(sourceX + 24, dx / length * speed + 65, dy / length * speed); }
    }
    useAbility() { if (!["attack", "defense"].includes(this.phase)) return; const effect = ["slowTime", "magnetPulse", "laser", "shield", "recall"].find((name) => this.effectCount(name)); if (!effect || this.run.abilityCooldown > 0) return this.toast("NO ABILITY READY"); this.run.abilityCooldown = 12; if (effect === "slowTime") this.run.time += 4; if (effect === "magnetPulse") this.enemies.forEach((e) => e.setTransform(P.Vec2((e.getPosition().x + W / 2 / SCALE) / 2, e.getPosition().y), 0)); if (effect === "laser") this.enemies.slice(0, 3).forEach((e) => this.damageEnemy(e, 40, false)); if (effect === "shield") this.run.defenseInvulnerable = 3; if (effect === "recall" && this.balls[0]) this.balls[0].setTransform(P.Vec2(W / 2 / SCALE, 700 / SCALE), 0); this.toast(effect.toUpperCase()); }
    useConsumable() { if (!["attack", "defense"].includes(this.phase)) return; const id = this.run.consumables.shift(); if (!id) return this.toast("NO CONSUMABLE"); const effect = D.cardById[id].effect; if (effect === "timeRefill") this.run.time += 20; if (effect === "instantMultiball" && this.balls[0]) { for (let i = 0; i < 2; i++) { const b = this.spawnBall({ p: vecOut(this.balls[0].getPosition()), v: { x: i ? 5 : -5, y: -17 }, launched: true }); b.setGravityScale(1); } } if (effect === "ballSave") this.run.ballSaveUsed = false; if (effect === "purge") this.run.defenseSlow = 0; this.toast(D.cardById[id].name); }
    levelComplete() {
      this.running = false; this.phase = "clear"; this.run.transition = null; this.hideTransition(); const display = this.run.displayLevel; if (!this.run.endless) { S.progress.unlockedLevel = Math.max(S.progress.unlockedLevel, Math.min(101, this.run.level + 1)); if (this.run.level === 101) S.progress.endlessUnlocked = true; } else S.progress.endlessBest = Math.max(S.progress.endlessBest, display); S.progress.best[this.run.level] = Math.max(S.progress.best[this.run.level] || 0, this.run.score); S.saveProgress();
      if (this.run.balls === this.levelSpec().balls) this.award("achievement-3"); if (this.run.level === 101) this.award("achievement-8");
      this.setOverlay(`<div class="panel result"><p class="eyebrow">${this.run.level === 101 ? "CAMPAIGN COMPLETE" : "LEVEL CLEARED"}</p><h2>${this.run.level === 101 ? "THE CORE IS SILENT" : escapeHtml(this.levelSpec().name)}</h2><div class="results"><div><span>SCORE</span><b>${Math.round(this.run.score).toLocaleString()}</b></div><div><span>BALLS</span><b>${this.run.balls}</b></div><div><span>EXCELLENT</span><b>${this.run.excellent}</b></div><div><span>HIGHEST COMBO</span><b>x${this.run.combo.toFixed(1)}</b></div></div><p class="result-note">The level-local build has been discharged.</p><div class="menu">${this.run.level === 101 ? this.button("Enter Endless", "endless", "primary") : this.button("Next Level", "next", "primary")}${this.button("Campaign Map", "campaign")}${this.button("Main Menu", "menu")}</div></div>`);
    }
    nextLevel() { this.startNew(this.run.level + 1, false); }
    fail(reason) { if (!this.run || !this.running) return; this.running = false; this.phase = "fail"; this.run.transition = null; this.hideTransition(); this.setOverlay(`<div class="panel result"><p class="eyebrow">MACHINE INTERRUPTED</p><h2>${escapeHtml(reason)}</h2><p class="lead">The current level restarts from its opening seed. Cards, XP, combo, and temporary effects are discharged.</p><div class="menu">${this.button("Retry Level", "retry", "primary")}${this.button("Campaign Map", "campaign")}${this.button("Main Menu", "menu")}</div></div>`); }
    pause() { if (!this.running) return; this.running = false; this.phaseBeforePause = this.phase; this.phase = "pause"; this.setOverlay(`<div class="panel"><p class="eyebrow">SYSTEM PAUSED</p><h2>LEVEL ${String(this.run.displayLevel).padStart(3, "0")}</h2><p class="lead">Save & exit creates a one-use exact suspend point. Loading deletes it immediately.</p><div class="menu">${this.button("Resume", "resume", "primary")}${this.button("Save & Exit", "save")}${this.button("Current Build", "build")}${this.button("Restart Level", "restart", "danger")}${this.button("Main Menu", "menu")}</div></div>`); }
    buildView() {
      const cards = Object.entries(this.run.cards).map(([id, count]) => { const card = D.cardById[id], canTransform = this.run.level >= 26 && count >= 2 && card.rarity !== "ultra"; return `<div class="inventory-item"><span><strong>${escapeHtml(card.name)}</strong><em>${D.RARITIES[card.rarity].name} · STACK ${count}</em></span><span class="inventory-actions"><button data-sell="${id}">SELL</button>${canTransform ? `<button data-transform="${id}">TRANSFORM</button>` : ""}</span></div>`; }).join("");
      this.setOverlay(`<div class="panel"><p class="eyebrow">CURRENT MACHINE</p><h2>${Object.values(this.run.cards).reduce((a, b) => a + b, 0)} / 50 CARDS</h2><p class="inventory-note">Sell for 35% of the next XP threshold. From Level 26, transform two duplicate cards into one card of the next rarity.</p><div class="inventory">${cards || "<div><strong>BASE MACHINE</strong><span>NO UPGRADES</span></div>"}</div><div class="menu">${this.button("Back", "pause-return", "primary")}</div></div>`);
      $$('[data-sell]').forEach((node) => node.onclick = () => this.sellCard(node.dataset.sell)); $$('[data-transform]').forEach((node) => node.onclick = () => this.transformCard(node.dataset.transform));
    }
    sellCard(id) { if (!this.run.cards[id]) return; this.run.cards[id]--; if (!this.run.cards[id]) delete this.run.cards[id]; const consumable = this.run.consumables.indexOf(id); if (consumable >= 0) this.run.consumables.splice(consumable, 1); this.run.xp = Math.min(this.xpNeeded() - 1, this.run.xp + this.xpNeeded() * .35); this.toast("CARD SOLD"); this.buildView(); }
    transformCard(id) { const card = D.cardById[id], tiers = ["common", "rare", "superRare", "legendary", "ultra"], next = tiers[tiers.indexOf(card.rarity) + 1]; if (this.run.level < 26 || (this.run.cards[id] || 0) < 2 || !next) return; this.run.cards[id] -= 2; if (!this.run.cards[id]) delete this.run.cards[id]; const pool = D.CARDS.filter((item) => item.rarity === next && (this.run.cards[item.id] || 0) < item.max), result = pool[this.rng.int(pool.length)]; if (result) { this.run.cards[result.id] = (this.run.cards[result.id] || 0) + 1; if (!S.progress.discovered.includes(result.id)) S.progress.discovered.push(result.id); S.saveProgress(); this.toast(`TRANSFORMED · ${result.name}`); } this.buildView(); }
    resume() { overlay.innerHTML = ""; this.phase = this.phaseBeforePause || "attack"; this.running = true; this.setControlLock(this.phase === "attackToDefense" || this.phase === "defenseToAttack"); if (this.run.transition) this.showTransition(); this.last = performance.now(); }
    async saveExit() { this.phase = this.phaseBeforePause || "attack"; await this.saveService.putSuspend(SaveSnapshot.from(this)); this.toast("ONE-USE SUSPEND SAVED"); await this.menu(); }
    async continueRun() { const snapshot = await this.saveService.consumeSuspend(); if (!snapshot || snapshot.version !== D.VERSION) return this.menu(); this.run = snapshot.run; this.rng = new Rng(snapshot.rng); this.startEncounter(snapshot); }
    frame(dt) { dt = Math.min(.05, dt); if (this.running) { this.accumulator += dt; let steps = 0; while (this.accumulator >= STEP && steps++ < 8) { this.update(STEP); this.accumulator -= STEP; } } this.render(); }
    render() {
      art.clear(); const biome = this.run ? D.biomeById[this.levelSpec().biome] : D.BIOMES[0];
      art.rect(0, 0, W, H).fill({ color: biome.bottom, alpha: .72 });
      for (let y = 160; y < H; y += 72) art.moveTo(38, y).lineTo(W - 38, y).stroke({ width: 1, color: biome.accent, alpha: .08 });
      if (!this.run) return;
      this.walls.forEach((body) => { const [x1, y1, x2, y2] = body.getUserData().line; art.moveTo(x1, y1).lineTo(x2, y2).stroke({ width: 5, color: biome.accent, alpha: .52 }); });
      this.aprons.forEach((body) => { const points = body.getUserData().points.flat(); art.poly(points).fill({ color: 0x071219, alpha: .98 }).stroke({ width: 4, color: biome.accent, alpha: .62 }); });
      if (this.drain) { const [x, y, width, height] = this.drain.getUserData().rect; art.roundRect(x, y, width, height, 10).fill({ color: 0x000206, alpha: 1 }).stroke({ width: 2, color: 0xff536b, alpha: .42 }); }
      if (this.phase === "defense" || this.phase === "defenseToAttack" || (this.phase === "pause" && ["defense", "defenseToAttack"].includes(this.phaseBeforePause))) this.renderDefense(biome); else this.renderAttack(biome);
      this.particles.forEach((p) => art.circle(p.x, p.y, p.size).fill({ color: p.color, alpha: clamp(p.life, 0, 1) }));
    }
    renderAttack(biome) {
      for (const sprite of this.actorSprites.values()) sprite.visible = false;
      this.bumpers.forEach((body) => { const p = body.getPosition(), data = body.getUserData(), radius = 34 + data.pulse * 10; art.circle(p.x * SCALE, p.y * SCALE, radius).fill({ color: biome.accent, alpha: .12 }).stroke({ width: 3, color: biome.accent, alpha: .7 }); art.circle(p.x * SCALE, p.y * SCALE, 14).fill({ color: 0xeaffff, alpha: .7 }); data.pulse *= .88; });
      this.mounts.forEach((body) => { const data = body.getUserData(); art.circle(data.x, data.y, data.radius).fill({ color: 0x071219, alpha: 1 }).stroke({ width: 4, color: biome.accent, alpha: .85 }); art.circle(data.x, data.y, 7).fill({ color: biome.accent, alpha: .45 }); });
      this.flippers.forEach((body) => this.drawBody(body, 0xe9ffff, biome.accent));
      this.enemies.forEach((body) => { const data = body.getUserData(), def = D.enemyById[data.id], p = body.getPosition(), x = p.x * SCALE, y = p.y * SCALE, radius = def.radius || 62, hp = clamp(data.hp / data.maxHp, 0, 1), sprite = this.actorSprites.get(body); art.circle(x, y, radius + 7 + (data.flash ? 6 : 0)).fill({ color: def.color, alpha: data.flash ? .32 : .12 }).stroke({ width: def.level ? 5 : 2, color: def.color, alpha: .72 }); if (sprite) { const size = radius * (def.level ? 3 : 2.75); sprite.visible = true; sprite.x = x; sprite.y = y; sprite.width = size; sprite.height = size; sprite.alpha = data.flash ? 1 : .94; sprite.rotation = Math.sin(data.t * .7) * .035; } else { art.poly([x, y - radius, x + radius * .82, y + radius * .55, x - radius * .82, y + radius * .55]).fill({ color: 0x07151c, alpha: .96 }).stroke({ width: 3, color: def.color }); } if (!def.level && def.tier > 2) { const start = -.7, ring = radius + 11; art.moveTo(x + Math.cos(start) * ring, y + Math.sin(start) * ring).arc(x, y, ring, start, start + Math.PI * 2 * Math.min(1, def.tier / 8)).stroke({ width: 3, color: D.BIOMES[def.materialVariant].accent, alpha: .6 }); } art.rect(x - radius, y - radius - 20, radius * 2, 6).fill({ color: 0xffffff, alpha: .12 }); art.rect(x - radius, y - radius - 20, radius * 2 * hp, 6).fill({ color: def.color, alpha: data.flash ? 1 : .7 }); });
      this.balls.forEach((body) => { const p = body.getPosition(), data = body.getUserData(), radius = body.getFixtureList().getShape().getRadius() * SCALE, x = p.x * SCALE, y = p.y * SCALE; data.trail.forEach((point, index) => { if (index === 0) return; const previous = data.trail[index - 1]; art.moveTo(previous.x, previous.y).lineTo(point.x, point.y).stroke({ width: 2 + index / 8, color: biome.accent, alpha: index / data.trail.length * .26 }); }); art.circle(x, y, radius + 9).fill({ color: biome.accent, alpha: .14 }); art.circle(x, y, radius).fill({ color: 0x9eb8c2, alpha: 1 }).stroke({ width: 2, color: 0xf3ffff, alpha: 1 }); art.circle(x - radius * .28, y - radius * .32, radius * .42).fill({ color: 0xffffff, alpha: .92 }); art.circle(x, y, radius * .43).fill({ color: biome.accent, alpha: .88 }); const start = performance.now() * .004, ring = radius + 4; art.moveTo(x + Math.cos(start) * ring, y + Math.sin(start) * ring).arc(x, y, ring, start, start + Math.PI * 1.25).stroke({ width: 2, color: 0xffffff, alpha: .65 }); });
    }
    bodyPolygon(body) { const shape = body.getFixtureList()?.getShape(), vertices = shape?.m_vertices || []; return vertices.flatMap((vertex) => { const world = body.getWorldPoint(vertex); return [world.x * SCALE, world.y * SCALE]; }); }
    flipperContactSpeed(body, worldPoint) { const data = body.getUserData(), dx = worldPoint.x - data.pivot.x, dy = worldPoint.y - data.pivot.y; return Math.abs(body.getAngularVelocity()) * Math.hypot(dx, dy); }
    drawBody(body, fill, stroke) { const points = this.bodyPolygon(body); if (points.length < 6 || points.some((value) => !Number.isFinite(value))) return; art.poly(points).fill({ color: fill, alpha: .95 }).stroke({ width: 3, color: stroke, alpha: 1 }); }
    drawProjectile(p) {
      const color = p.visual === "orb" ? 0x6fdcff : p.visual === "firebolt" ? 0xff8b45 : p.visual === "prism" ? 0xd78aff : 0xff657b;
      if (p.telegraph > 0) {
        const pulse = 1 + Math.sin(p.age * 36) * .12, alpha = .28 + (1 - p.telegraph / .28) * .52;
        if (p.visual === "beam") art.moveTo(p.x, p.y - 72).lineTo(p.x, p.y + 72).stroke({ width: 3 * pulse, color, alpha });
        else if (p.visual === "cross") { art.rect(p.x - 20 * pulse, p.y - 4, 40 * pulse, 8).stroke({ width: 2, color, alpha }); art.rect(p.x - 4, p.y - 20 * pulse, 8, 40 * pulse).stroke({ width: 2, color, alpha }); }
        else if (p.visual === "ring" || p.visual === "orb") art.circle(p.x, p.y, 18 * pulse).stroke({ width: 3, color, alpha });
        else if (p.visual === "prism") art.poly([p.x, p.y - 20 * pulse, p.x + 17 * pulse, p.y + 14 * pulse, p.x - 17 * pulse, p.y + 14 * pulse]).stroke({ width: 3, color, alpha });
        else art.poly([p.x, p.y + 20 * pulse, p.x + 11 * pulse, p.y - 15 * pulse, p.x - 11 * pulse, p.y - 15 * pulse]).stroke({ width: 3, color, alpha });
        return;
      }
      if (p.visual === "beam") { art.moveTo(p.x, p.y - 34).lineTo(p.x, p.y + 20).stroke({ width: 6, color, alpha: .9 }); art.moveTo(p.x, p.y - 52).lineTo(p.x, p.y + 28).stroke({ width: 1, color: 0xffffff, alpha: .7 }); }
      else if (p.visual === "cross") { art.rect(p.x - 11, p.y - 3, 22, 6).fill({ color }); art.rect(p.x - 3, p.y - 11, 6, 22).fill({ color }); }
      else if (p.visual === "ring") art.circle(p.x, p.y, 11).stroke({ width: 4, color, alpha: .95 });
      else if (p.visual === "firebolt") { art.poly([p.x, p.y + 13, p.x + 8, p.y - 4, p.x, p.y - 17, p.x - 8, p.y - 4]).fill({ color }).stroke({ width: 2, color: 0xffe4ba }); art.moveTo(p.x, p.y - 18).lineTo(p.x - p.vx * .08, p.y - 44).stroke({ width: 4, color, alpha: .35 }); }
      else if (p.visual === "prism") art.poly([p.x, p.y - 12, p.x + 10, p.y + 8, p.x - 10, p.y + 8]).fill({ color }).stroke({ width: 2, color: 0xffffff });
      else if (p.visual === "shard") art.poly([p.x, p.y + 13, p.x + 7, p.y - 9, p.x - 7, p.y - 9]).fill({ color }).stroke({ width: 2, color: 0xffd8dd });
      else { art.circle(p.x, p.y, 9).fill({ color, alpha: .95 }).stroke({ width: 2, color: 0xffffff, alpha: .85 }); art.circle(p.x, p.y, 15 + Math.sin(p.age * 9) * 3).stroke({ width: 2, color, alpha: .35 }); }
    }
    renderDefense(biome) {
      for (const sprite of this.actorSprites.values()) sprite.visible = false;
      art.rect(0, 0, W, H).fill({ color: 0x25070e, alpha: .18 }); const boss = this.currentBoss();
      if (boss) {
        const data = boss.getUserData(), def = D.enemyById[data.id], sprite = this.actorSprites.get(boss), hp = clamp(data.hp / data.maxHp, 0, 1), presenter = def.defensePresentation, pulse = Math.sin(performance.now() * .004);
        art.roundRect(170, 138, 380, 326, 24).fill({ color: 0x05080e, alpha: .78 }).stroke({ width: 2, color: def.color, alpha: .4 });
        art.circle(360, 284, presenter.aura + pulse * 7).stroke({ width: 3, color: def.color, alpha: .32 }); art.circle(360, 284, presenter.aura - 18 - pulse * 4).stroke({ width: 1, color: 0xffffff, alpha: .16 });
        if (presenter.telegraph === "grid") for (let x = 230; x <= 490; x += 52) art.moveTo(x, 170).lineTo(x, 404).stroke({ width: 1, color: def.color, alpha: .1 });
        else if (presenter.telegraph === "polarity") { art.moveTo(310 + Math.cos(-1.2) * 92, 284 + Math.sin(-1.2) * 92).arc(310, 284, 92, -1.2, 1.2).stroke({ width: 5, color: def.color, alpha: .24 }); art.moveTo(410 + Math.cos(Math.PI - 1.2) * 92, 284 + Math.sin(Math.PI - 1.2) * 92).arc(410, 284, 92, Math.PI - 1.2, Math.PI + 1.2).stroke({ width: 5, color: def.color, alpha: .24 }); }
        else if (presenter.telegraph === "furnace") for (let x = 270; x <= 450; x += 45) art.moveTo(x, 410).lineTo(x + pulse * 8, 360).stroke({ width: 5, color: def.color, alpha: .18 });
        else if (presenter.telegraph === "wings") { art.moveTo(360, 284).lineTo(210, 210).stroke({ width: 4, color: def.color, alpha: .2 }); art.moveTo(360, 284).lineTo(510, 210).stroke({ width: 4, color: def.color, alpha: .2 }); }
        else { const start = performance.now() * .001; art.moveTo(360 + Math.cos(start) * 132, 284 + Math.sin(start) * 132).arc(360, 284, 132, start, start + Math.PI * 1.5).stroke({ width: 4, color: def.color, alpha: .28 }); }
        if (sprite) { sprite.visible = true; sprite.x = 360; sprite.y = 286; sprite.width = presenter.scale; sprite.height = presenter.scale; sprite.alpha = .96; sprite.rotation = Math.sin(performance.now() * .0012) * .025; }
        art.rect(230, 430, 260, 9).fill({ color: 0xffffff, alpha: .12 }); art.rect(230, 430, 260 * hp, 9).fill({ color: def.color, alpha: .9 });
        for (let i = 0; i < (def.phases || 4); i++) art.rect(270 + i * 48, 450, 34, 3).fill({ color: i < this.run.bossPhase ? def.color : 0xffffff, alpha: i < this.run.bossPhase ? .9 : .14 });
      } else { art.circle(W / 2, 245, 66).fill({ color: 0x260811, alpha: .7 }).stroke({ width: 3, color: 0xff657b, alpha: .5 }); art.poly([360, 205, 402, 268, 318, 268]).stroke({ width: 3, color: 0xff657b, alpha: .7 }); }
      this.projectiles.forEach((p) => this.drawProjectile(p)); art.roundRect(this.run.carriageX - 76, 1070, 152, 22, 9).fill({ color: 0xeaffff, alpha: .94 }).stroke({ width: 3, color: biome.accent, alpha: 1 }); art.circle(this.run.carriageX, 1081, 8).fill({ color: biome.accent, alpha: .85 });
    }
    pushFloater(x, y, text, color, size) { const label = new X.Text({ text, style: { fontFamily: "Arial", fontSize: size, fontWeight: "800", fill: color, stroke: { color: 0x02060b, width: 4 } } }); label.anchor.set(.5); label.x = x; label.y = y; label.eventMode = "none"; scene.addChild(label); this.floaters.push({ x, y, label, life: .9 }); }
    float(text, body, color, size) { const p = body.getPosition(); this.pushFloater(p.x * SCALE, p.y * SCALE - 20, text, color, size); }
    toast(text) { const node = $("#toast"); node.textContent = text; node.classList.add("show"); clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => node.classList.remove("show"), 1500); }
    award(id) { if (S.progress.achievements.includes(id)) return; S.progress.achievements.push(id); S.saveProgress(); const achievement = D.ACHIEVEMENTS.find((item) => item.id === id); if (achievement) this.toast(`BADGE · ${achievement.name}`); }
    updateHud() { if (!this.run) return; const spec = this.levelSpec(), difficulty = D.difficultyById[spec.difficulty], needed = this.xpNeeded(), transition = this.phase === "attackToDefense" || this.phase === "defenseToAttack"; $("#level-kicker").textContent = `LEVEL ${String(this.run.displayLevel).padStart(3, "0")}`; $("#level-name").textContent = spec.name; $("#difficulty").textContent = difficulty.name; $("#difficulty").style.color = difficulty.color; $("#timer").textContent = formatTime(this.run.time); $("#xp-fill").style.transform = `scaleX(${clamp(this.run.xp / needed, 0, 1)})`; $("#xp-text").textContent = `${Math.floor(this.run.xp)} / ${needed}`; $("#balls").textContent = `BALLS ${this.run.balls}`; $("#wave").textContent = `ENCOUNTER ${this.run.encounter + 1} / ${spec.encounters.length}`; $("#combo").textContent = `COMBO x${this.run.combo.toFixed(1)}`; $("#phase").textContent = transition ? (this.phase === "attackToDefense" ? "BALL LEAKED" : "WAVE SURVIVED") : this.phase === "defense" ? `DODGE ${Math.max(0, this.run.defenseTime).toFixed(1)}s` : this.balls.some((b) => !b.getUserData().launched) ? `PLUNGER ${Math.round(this.run.plunger || 18)}%` : spec.boss ? `BOSS P${this.run.bossPhase}` : "ATTACK"; $("#touch-launch span").textContent = transition ? "LOCKED" : this.phase === "defense" ? "DRAG" : this.balls.some((b) => !b.getUserData().launched) ? `POWER ${Math.round(this.run.plunger || 18)}%` : "ACTIVE"; }
    bindInput() {
      const key = (event, down) => { if (["ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault(); this.audio.unlock(); if (["ArrowLeft", "KeyA"].includes(event.code)) this.keys.left = down; if (["ArrowRight", "KeyD"].includes(event.code)) this.keys.right = down; if (event.code === "Space" && this.running && this.phase === "attack") { if (down && this.balls.some((b) => !b.getUserData().launched)) this.run.plungerHeld = true; if (!down && this.run?.plungerHeld) this.releasePlunger(); } if (down && ["Escape", "KeyP"].includes(event.code) && this.running) this.pause(); if (down && event.code === "KeyQ") this.useAbility(); if (down && event.code === "KeyE") this.useConsumable(); if (down && event.code.startsWith("Shift") && this.effectCount("nudge") && this.phase === "attack") this.balls.forEach((b) => b.applyLinearImpulse(P.Vec2((this.keys.right ? 1 : this.keys.left ? -1 : 0) * .35, -.8), b.getWorldCenter(), true)); };
      addEventListener("keydown", (event) => key(event, true)); addEventListener("keyup", (event) => key(event, false)); addEventListener("blur", () => { this.keys.left = this.keys.right = this.touch.left = this.touch.right = false; if (this.running) this.pause(); }); document.addEventListener("visibilitychange", () => { if (document.hidden && this.running) this.pause(); });
      const bind = (selector, side) => { const node = $(selector), set = (value) => { this.audio.unlock(); this.touch[side] = value; node.classList.toggle("active", value); }; node.addEventListener("pointerdown", (event) => { event.preventDefault(); node.setPointerCapture(event.pointerId); set(true); }); ["pointerup", "pointercancel", "lostpointercapture"].forEach((name) => node.addEventListener(name, () => set(false))); };
      bind("#touch-left", "left"); bind("#touch-right", "right"); const launch = $("#touch-launch"); launch.addEventListener("pointerdown", (event) => { event.preventDefault(); this.audio.unlock(); if (this.phase === "attack" && this.balls.some((b) => !b.getUserData().launched)) { launch.setPointerCapture(event.pointerId); this.run.plungerHeld = true; } }); ["pointerup", "pointercancel", "lostpointercapture"].forEach((name) => launch.addEventListener(name, () => { if (this.run?.plungerHeld) this.releasePlunger(); }));
      canvas.addEventListener("pointerdown", (event) => { if (this.phase === "defense") { canvas.setPointerCapture(event.pointerId); this.dragX = event.offsetX * W / canvas.clientWidth; } }); canvas.addEventListener("pointermove", (event) => { if (this.dragX !== null) this.dragX = event.offsetX * W / canvas.clientWidth; }); ["pointerup", "pointercancel", "lostpointercapture"].forEach((name) => canvas.addEventListener(name, () => this.dragX = null));
      pauseButton.onclick = () => this.pause(); $("#ability-q").onclick = () => this.useAbility(); $("#ability-e").onclick = () => this.useConsumable();
    }
    action(action) { this.audio.unlock(); ({ menu: () => this.menu(), campaign: () => this.campaign(), library: () => this.library(), help: () => this.help(), settings: () => this.settings(), level1: () => this.startNew(1), endless: () => this.startNew(101, true), continue: () => this.continueRun(), next: () => this.nextLevel(), retry: () => this.startNew(this.run.level, this.run.endless), restart: () => this.startNew(this.run.level, this.run.endless), resume: () => this.resume(), "pause-return": () => { this.running = true; this.phase = this.phaseBeforePause || "attack"; this.pause(); }, save: () => this.saveExit(), build: () => this.buildView(), reroll: () => this.reroll() }[action] || (() => {}))(); }
  }

  const errors = D.validate(); if (errors.length) throw new Error(`FLIPSTRIKE content validation failed: ${errors.join("; ")}`);
  window.FLIPSTRIKE = new GameDirector();
})();
