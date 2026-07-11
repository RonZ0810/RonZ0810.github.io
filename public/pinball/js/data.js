(function () {
  "use strict";

  const VERSION = 4;
  const BIOMES = [
    { id: "foundry", name: "NEON FOUNDRY", range: [1, 20], accent: 0x57e7ff, accentCss: "#57e7ff", top: 0x071b29, bottom: 0x02070d, mechanic: "Charged bumpers", material: "chrome" },
    { id: "transit", name: "PRISM TRANSIT", range: [21, 40], accent: 0xb67cff, accentCss: "#b67cff", top: 0x17102c, bottom: 0x05040e, mechanic: "Shield lanes", material: "glass" },
    { id: "abyss", name: "MAGNETIC ABYSS", range: [41, 60], accent: 0x4fffc3, accentCss: "#4fffc3", top: 0x06231f, bottom: 0x020b0b, mechanic: "Gravity wells", material: "obsidian" },
    { id: "furnace", name: "RUPTURE FURNACE", range: [61, 80], accent: 0xff8b45, accentCss: "#ff8b45", top: 0x2b1009, bottom: 0x0c0302, mechanic: "Heat rhythms", material: "ceramic" },
    { id: "citadel", name: "CORE CITADEL", range: [81, 101], accent: 0xff4f75, accentCss: "#ff4f75", top: 0x270814, bottom: 0x090208, mechanic: "Table transformations", material: "crystal" },
  ];

  const DIFFICULTIES = [
    { id: "tutorial", name: "TUTORIAL", color: "#83f0c0", range: [1, 5] }, { id: "easy", name: "EASY", color: "#6ce6a6", range: [6, 20] },
    { id: "medium", name: "MEDIUM", color: "#f7d16b", range: [21, 40] }, { id: "hard", name: "HARD", color: "#ff9a59", range: [41, 60] },
    { id: "very-hard", name: "VERY HARD", color: "#ff646f", range: [61, 80] }, { id: "extreme", name: "EXTREME", color: "#bd3456", range: [81, 101] },
  ];

  const ROLE_DEFS = [
    ["drifter", "DRIFTER", "aim", {}], ["patrol", "PATROL", "lane", {}],
    ["shield", "AEGIS", "spread", { shield: 2 }], ["armor", "BASTION", "lane", { armor: 2 }],
    ["sniper", "LANCER", "aim", { sniper: true }], ["artillery", "HOWITZER", "ring", { artillery: true }],
    ["healer", "MENDER", "spread", { healer: true }], ["support", "RELAY", "lane", { support: true }],
    ["summoner", "FORGEMIND", "ring", { summoner: true }], ["splitter", "SPLINTER", "spread", { splitter: true }],
    ["ghost", "PHANTOM", "aim", { ghost: true }], ["reflector", "MIRROR", "lane", { reflector: true }],
  ];
  const ROLE_SYSTEMS = {
    drifter: { movement: "rail", behavior: "drift", defensePattern: "aim" },
    patrol: { movement: "waypoints", behavior: "patrol", defensePattern: "lane" },
    shield: { movement: "rail", behavior: "directionalShield", defensePattern: "spread" },
    armor: { movement: "anchor", behavior: "armorWeakPoint", defensePattern: "lane" },
    sniper: { movement: "perches", behavior: "sniper", defensePattern: "aim" },
    artillery: { movement: "arc", behavior: "artillery", defensePattern: "ring" },
    healer: { movement: "orbitAlly", behavior: "healer", defensePattern: "spread" },
    support: { movement: "formation", behavior: "supportLink", defensePattern: "lane" },
    summoner: { movement: "anchorShift", behavior: "summoner", defensePattern: "ring" },
    splitter: { movement: "triangle", behavior: "splitter", defensePattern: "cross" },
    ghost: { movement: "teleport", behavior: "phaseWindow", defensePattern: "aim" },
    reflector: { movement: "orbit", behavior: "reflectorWindow", defensePattern: "spiral" },
  };
  const ACTOR_ASSETS = {
    roles: Object.fromEntries(ROLE_DEFS.map(([id]) => [id, `assets/actors/enemy-${id}.webp`])),
    bosses: {
      architect: "assets/actors/boss-architect.webp", "polar-core": "assets/actors/boss-polar-core.webp",
      "rupture-beast": "assets/actors/boss-rupture-beast.webp", ascendant: "assets/actors/boss-ascendant.webp",
      "final-core": "assets/actors/boss-final-core.webp",
    },
  };
  const DEFENSE_ASSETS = {
    ship: "assets/defense/player-ship.webp",
    backgrounds: Object.fromEntries(BIOMES.map((biome) => [biome.id, `assets/defense/stage-${biome.id}.webp`])),
    manifest: "assets/defense/manifest.json",
  };
  const VARIANTS = ["I", "II", "III", "IV", "V", "VI", "VII", "OMEGA"];
  const MOTION_PROFILES = [
    { id: "steady", speed: 1, width: .82, altitude: .55, period: 1, pause: 0, burst: 1, switchRate: 0, motionThreat: 1, defenseSequence: ["primary"] },
    { id: "reverse", speed: 1.08, width: .92, altitude: .62, period: .92, pause: 0, burst: 1, switchRate: .18, motionThreat: 1.08, defenseSequence: ["primary", "primary"] },
    { id: "weave", speed: 1.12, width: 1, altitude: .88, period: .86, pause: 0, burst: 1, switchRate: .25, motionThreat: 1.14, defenseSequence: ["primary", "paired"] },
    { id: "burst", speed: 1.18, width: 1.04, altitude: .78, period: .82, pause: .34, burst: 1.65, switchRate: .3, motionThreat: 1.23, defenseSequence: ["primary", "lanes"] },
    { id: "altitude", speed: 1.2, width: 1.08, altitude: 1.25, period: .78, pause: .12, burst: 1.25, switchRate: .38, motionThreat: 1.3, defenseSequence: ["primary", "wave"] },
    { id: "feint", speed: 1.24, width: 1.12, altitude: 1.05, period: .74, pause: .42, burst: 1.5, switchRate: .5, motionThreat: 1.38, defenseSequence: ["primary", "burst"] },
    { id: "alternating", speed: 1.3, width: 1.18, altitude: 1.25, period: .69, pause: .22, burst: 1.55, switchRate: .66, motionThreat: 1.48, defenseSequence: ["primary", "paired", "lanes"] },
    { id: "omega", speed: 1.38, width: 1.25, altitude: 1.42, period: .62, pause: .28, burst: 1.72, switchRate: .82, motionThreat: 1.62, defenseSequence: ["primary", "wave", "burst"] },
  ];
  const ENEMIES = [];
  ROLE_DEFS.forEach((role, roleIndex) => VARIANTS.forEach((variant, tier) => {
    const id = `${role[0]}-${tier + 1}`;
    ENEMIES.push({
      id, role: role[0], spriteId: role[0], materialVariant: tier % BIOMES.length, name: `${role[1]} ${variant}`, pattern: role[2], tier: tier + 1,
      ...ROLE_SYSTEMS[role[0]], motionProfile: MOTION_PROFILES[tier], defenseSequence: MOTION_PROFILES[tier].defenseSequence, motionThreat: MOTION_PROFILES[tier].motionThreat, escalation: { speed: 1 + tier * .08, reverses: tier >= 1, altitude: tier >= 2, modifierSlots: tier >= 6 ? 2 : tier >= 3 ? 1 : 0 },
      hp: Math.round(34 * (1 + tier * .36) * (1 + roleIndex * .035)),
      radius: 19 + (roleIndex % 4) * 2 + Math.floor(tier / 3),
      speed: 22 + (roleIndex % 3) * 9 + tier * 3,
      xp: 18 + tier * 7 + roleIndex * 2,
      color: BIOMES[Math.min(4, Math.floor(tier / 2))].accent,
      ...role[3],
    });
  }));

  const BOSSES = [
    { id: "architect", spriteId: "architect", name: "THE ARCHITECT", level: 25, hp: 1800, radius: 62, pattern: "walls", movement: "anchor", behavior: "boss", defensePattern: "spread", escalation: { speed: 1, altitude: false }, projectileTheme: "shard", defensePresentation: { scale: 292, aura: 146, telegraph: "grid" }, color: 0xf6d785 },
    { id: "polar-core", spriteId: "polar-core", name: "THE POLAR CORE", level: 50, hp: 3600, radius: 66, pattern: "magnets", movement: "rail", behavior: "boss", defensePattern: "ring", escalation: { speed: 1.1, altitude: true }, projectileTheme: "orb", defensePresentation: { scale: 304, aura: 152, telegraph: "polarity" }, color: 0x73e9ff },
    { id: "rupture-beast", spriteId: "rupture-beast", name: "THE RUPTURE BEAST", level: 75, hp: 5800, radius: 72, pattern: "vents", movement: "arc", behavior: "boss", defensePattern: "spread", escalation: { speed: 1.12, altitude: true }, projectileTheme: "firebolt", defensePresentation: { scale: 314, aura: 158, telegraph: "furnace" }, color: 0xff834f },
    { id: "ascendant", spriteId: "ascendant", name: "THE ASCENDANT MACHINE", level: 100, hp: 8800, radius: 77, pattern: "hybrid", movement: "orbit", behavior: "boss", defensePattern: "lane", escalation: { speed: 1.18, altitude: true }, projectileTheme: "beam", defensePresentation: { scale: 318, aura: 162, telegraph: "wings" }, color: 0xff5c83 },
    { id: "final-core", spriteId: "final-core", name: "THE FINAL CORE", level: 101, hp: 12000, radius: 84, pattern: "final", movement: "orbit", behavior: "boss", defensePattern: "spiral", escalation: { speed: 1.22, altitude: true }, projectileTheme: "prism", defensePresentation: { scale: 326, aura: 168, telegraph: "rings" }, color: 0xffffff, phases: 4 },
  ];

  const TABLE_ELEMENT_TYPES = ["bumper", "slingshot", "spinner", "gate", "rollover", "ramp", "kicker", "captive", "magnet", "vent", "crusher", "cover"];
  const OBSTACLE_TUTORIALS = {
    bumper: { name: "Bumper", description: "A high-rebound target that redirects the ball and builds XP.", tip: "Use repeated bumper routes to extend combos." },
    slingshot: { name: "Slingshot", description: "A reactive rail that kicks the ball away with extra speed.", tip: "Catch its rebound with a raised flipper." },
    spinner: { name: "Spinner", description: "A rotating blade that awards XP and charge as it turns.", tip: "Fast glancing shots produce the most rotation." },
    gate: { name: "One-Way Gate", description: "A directional rail that opens for upward shots and blocks the return path.", tip: "Use it to keep the ball in the upper playfield." },
    rollover: { name: "Rollover", description: "A lane sensor that rewards the first pass by each ball.", tip: "Route multiballs across different switches." },
    ramp: { name: "Ramp", description: "A guided corridor with a controlled exit and bonus XP.", tip: "Enter between the rails from the open end." },
    kicker: { name: "Vortex", description: "Captures the ball, telegraphs a randomized safe launch, then fires it upward.", tip: "Read the arrow: its direction and length show the next launch." },
    captive: { name: "Captive Ball", description: "A heavy target constrained to its own rail.", tip: "Strike it hard to transfer momentum and open routes." },
    magnet: { name: "Magnetic Field", description: "A bounded field alternately pulls and pushes active balls.", tip: "Watch the ring polarity before committing a shot." },
    vent: { name: "Thermal Vent", description: "A timed hazard that blasts balls while its chamber is active.", tip: "The warning glow gives at least half a second to react." },
    crusher: { name: "Crusher", description: "A moving solid hazard that sweeps a fixed, telegraphed route.", tip: "Shoot after it passes to use the open lane." },
    cover: { name: "Breakable Cover", description: "A durable barrier that loses integrity when struck.", tip: "Break it to reveal cleaner upper-table routes." },
  };
  const TABLE_MODULES = [
    { id: "foundry-classic", biome: "foundry", name: "CLASSIC FORGE", shotFamilies: 3, minPassage: 92, elements: [
      { type: "bumper", x: 220, y: 500, radius: 32 }, { type: "bumper", x: 360, y: 420, radius: 38 }, { type: "bumper", x: 500, y: 500, radius: 32 },
      { type: "slingshot", line: [118, 820, 235, 760] }, { type: "slingshot", line: [602, 820, 485, 760] },
    ] },
    { id: "foundry-railworks", biome: "foundry", name: "RAILWORKS", shotFamilies: 3, minPassage: 84, elements: [
      { type: "spinner", x: 360, y: 390, length: 92 }, { type: "gate", line: [170, 600, 285, 555] }, { type: "gate", line: [550, 600, 435, 555] },
      { type: "rollover", rect: [115, 315, 100, 22] }, { type: "rollover", rect: [505, 315, 100, 22] }, { type: "kicker", x: 360, y: 700, radius: 28, launch: [-3, -18] },
    ] },
    { id: "foundry-reactor", biome: "foundry", name: "CAPTIVE REACTOR", shotFamilies: 2, minPassage: 88, elements: [
      { type: "captive", x: 360, y: 455, radius: 20, rail: [275, 455, 445, 455] }, { type: "bumper", x: 190, y: 610, radius: 30 }, { type: "bumper", x: 530, y: 610, radius: 30 },
      { type: "slingshot", line: [250, 790, 330, 735] }, { type: "slingshot", line: [470, 790, 390, 735] },
    ] },
    { id: "transit-switchyard", biome: "transit", name: "PRISM SWITCHYARD", shotFamilies: 3, minPassage: 76, elements: [
      { type: "ramp", rails: [[115, 770, 115, 380], [190, 770, 190, 380]], exit: [152, 350, 4, -17] }, { type: "ramp", rails: [[530, 770, 530, 380], [605, 770, 605, 380]], exit: [568, 350, -4, -17] },
      { type: "rollover", rect: [115, 345, 75, 20] }, { type: "rollover", rect: [530, 345, 75, 20] }, { type: "spinner", x: 360, y: 540, length: 82 },
    ] },
    { id: "transit-prism-loop", biome: "transit", name: "PRISM LOOP", shotFamilies: 3, minPassage: 82, elements: [
      { type: "gate", line: [180, 720, 300, 650] }, { type: "gate", line: [540, 720, 420, 650] }, { type: "spinner", x: 360, y: 355, length: 105 },
      { type: "rollover", rect: [135, 475, 92, 20] }, { type: "rollover", rect: [493, 475, 92, 20] }, { type: "bumper", x: 360, y: 610, radius: 34 },
    ] },
    { id: "transit-overpass", biome: "transit", name: "SPLIT OVERPASS", shotFamilies: 2, minPassage: 74, elements: [
      { type: "ramp", rails: [[150, 800, 285, 470], [215, 825, 345, 500]], exit: [310, 455, 5, -15] }, { type: "ramp", rails: [[570, 800, 435, 470], [505, 825, 375, 500]], exit: [410, 455, -5, -15] },
      { type: "gate", line: [305, 635, 415, 635] }, { type: "kicker", x: 360, y: 780, radius: 26, launch: [0, -20] },
    ] },
    { id: "abyss-gravity-ring", biome: "abyss", name: "GRAVITY RING", shotFamilies: 3, minPassage: 84, elements: [
      { type: "magnet", x: 360, y: 470, radius: 150, strength: 8, period: 3.2 }, { type: "bumper", x: 245, y: 470, radius: 27 }, { type: "bumper", x: 475, y: 470, radius: 27 },
      { type: "kicker", x: 360, y: 690, radius: 27, launch: [0, -19] },
    ] },
    { id: "abyss-crescent", biome: "abyss", name: "CRESCENT POCKETS", shotFamilies: 2, minPassage: 78, elements: [
      { type: "slingshot", line: [125, 610, 255, 500] }, { type: "slingshot", line: [595, 610, 465, 500] }, { type: "magnet", x: 205, y: 365, radius: 105, strength: 6, period: 4 },
      { type: "magnet", x: 515, y: 365, radius: 105, strength: -6, period: 4 }, { type: "spinner", x: 360, y: 650, length: 88 },
    ] },
    { id: "abyss-singularity", biome: "abyss", name: "SINGULARITY LANES", shotFamilies: 3, minPassage: 80, elements: [
      { type: "magnet", x: 360, y: 400, radius: 125, strength: 10, period: 2.8 }, { type: "captive", x: 360, y: 400, radius: 18, rail: [295, 400, 425, 400] },
      { type: "gate", line: [135, 700, 260, 625] }, { type: "gate", line: [585, 700, 460, 625] }, { type: "rollover", rect: [315, 680, 90, 20] },
    ] },
    { id: "furnace-split", biome: "furnace", name: "SPLIT FURNACE", shotFamilies: 2, minPassage: 78, elements: [
      { type: "vent", rect: [210, 430, 72, 160], period: 3.2, active: .8 }, { type: "vent", rect: [438, 430, 72, 160], period: 3.2, active: .8, offset: 1.6 },
      { type: "slingshot", line: [120, 790, 250, 710] }, { type: "slingshot", line: [600, 790, 470, 710] }, { type: "spinner", x: 360, y: 360, length: 86 },
    ] },
    { id: "furnace-crusher", biome: "furnace", name: "CRUSHER WORKS", shotFamilies: 2, minPassage: 72, elements: [
      { type: "crusher", rect: [115, 480, 125, 34], axis: "x", travel: 65, period: 3.6 }, { type: "crusher", rect: [480, 600, 125, 34], axis: "x", travel: -65, period: 3.6, offset: 1.8 },
      { type: "kicker", x: 170, y: 720, radius: 26, launch: [5, -17] }, { type: "kicker", x: 550, y: 720, radius: 26, launch: [-5, -17] }, { type: "bumper", x: 360, y: 420, radius: 32 },
    ] },
    { id: "furnace-breakout", biome: "furnace", name: "BREAKOUT ROUTE", shotFamilies: 3, minPassage: 76, elements: [
      { type: "cover", rect: [235, 500, 85, 26], hp: 3 }, { type: "cover", rect: [400, 500, 85, 26], hp: 3 }, { type: "cover", rect: [318, 420, 84, 26], hp: 4 },
      { type: "spinner", x: 360, y: 650, length: 92 }, { type: "rollover", rect: [130, 355, 100, 20] }, { type: "rollover", rect: [490, 355, 100, 20] },
    ] },
    { id: "citadel-crown", biome: "citadel", name: "CROWN PLAYFIELD", shotFamilies: 3, minPassage: 72, elements: [
      { type: "ramp", rails: [[120, 780, 245, 430], [185, 800, 305, 455]], exit: [285, 415, 5, -16] }, { type: "gate", line: [300, 455, 420, 455] },
      { type: "kicker", x: 520, y: 650, radius: 27, launch: [-7, -18] }, { type: "bumper", x: 360, y: 325, radius: 34 }, { type: "rollover", rect: [315, 530, 90, 20] },
    ] },
    { id: "citadel-hybrid", biome: "citadel", name: "HYBRID ARRAY", shotFamilies: 3, minPassage: 76, elements: [
      { type: "magnet", x: 235, y: 430, radius: 100, strength: 6, period: 3.5 }, { type: "spinner", x: 485, y: 420, length: 82 }, { type: "gate", line: [270, 660, 450, 660] },
      { type: "bumper", x: 200, y: 680, radius: 28 }, { type: "bumper", x: 520, y: 680, radius: 28 }, { type: "kicker", x: 360, y: 790, radius: 25, launch: [0, -21] },
    ] },
    { id: "citadel-transform", biome: "citadel", name: "TRANSFORMATION CORE", shotFamilies: 2, minPassage: 74, transforms: true, elements: [
      { type: "crusher", rect: [115, 520, 140, 28], axis: "x", travel: 72, period: 4.2 }, { type: "crusher", rect: [465, 520, 140, 28], axis: "x", travel: -72, period: 4.2, offset: 2.1 },
      { type: "magnet", x: 360, y: 390, radius: 118, strength: 8, period: 4.2 }, { type: "cover", rect: [315, 650, 90, 25], hp: 5 }, { type: "spinner", x: 360, y: 750, length: 90 },
    ] },
  ];
  const ELITE_MODIFIERS = ["haste", "plated", "linked", "phase"];

  const CARD_CATEGORIES = [
    ["ball", "BALL MODIFICATION", 35], ["flipper", "FLIPPER MODIFICATION", 30],
    ["relic", "PASSIVE RELIC", 30], ["ability", "TIMED ABILITY", 25],
    ["table", "TABLE MODIFICATION", 15], ["companion", "COMPANION", 10],
    ["consumable", "CONSUMABLE", 5],
  ];
  const RARITY_BUCKETS = [["common", 60], ["rare", 40], ["superRare", 25], ["legendary", 15], ["ultra", 10]];
  const RARITIES = {
    common: { name: "COMMON", color: "#9eb8bd", weight: 58 },
    rare: { name: "RARE", color: "#56d6f0", weight: 27 },
    superRare: { name: "SUPER RARE", color: "#bd7cff", weight: 10 },
    legendary: { name: "LEGENDARY", color: "#ff7b57", weight: 4 },
    ultra: { name: "SUPER ULTRA LEGENDARY", color: "#ffe695", weight: 1 },
  };
  const CARD_ROOTS = ["KINETIC", "PRISM", "THUNDER", "MERCY", "GRAVITY", "NOVA", "PHASE", "VECTOR", "ECHO", "SOLAR", "VOID", "RELAY", "TEMPEST", "FOCUS", "ORBIT"];
  const CARD_FORMS = ["CORE", "CIRCUIT", "LANCE", "ARRAY", "ENGINE", "MATRIX", "COIL", "PROTOCOL", "DRIVE", "AURA"];
  const EFFECTS = {
    ball: ["damage", "size", "pierce", "multiball", "speed"], flipper: ["flipperPower", "flipperLength", "nudge", "catch", "thirdFlipper"],
    relic: ["xp", "comboHold", "timerGuard", "excellent", "critical"], ability: ["slowTime", "magnetPulse", "laser", "shield", "recall"],
    table: ["bumperDamage", "extraBumper", "gate", "launcher", "ramp"], companion: ["orbit", "mark", "drone", "chain", "purge"],
    consumable: ["ballSave", "timeRefill", "instantMultiball", "repair", "purge"],
  };
  const EFFECT_COPY = {
    damage: "Ball impact damage +18%.", size: "Ball size +8% without narrowing legal lanes.", pierce: "Ignore one armor layer.", multiball: "Every fourth launch adds a ball.", speed: "Excellent Shots add controlled speed.",
    flipperPower: "Flipper strike force +14%.", flipperLength: "Flippers extend 8%.", nudge: "Unlock a cooldown nudge.", catch: "Flipper hold friction improves catches.", thirdFlipper: "Install a validated upper flipper.",
    xp: "XP rewards +15%.", comboHold: "Combo decay slows 25%.", timerGuard: "First defense hit causes no time loss.", excellent: "Excellent Shots deal +40% damage.", critical: "Unlock a 12% critical-hit chance.",
    slowTime: "Q slows time for 4 seconds.", magnetPulse: "Q pulls enemies into a shot window.", laser: "Q fires a brief target laser.", shield: "Q blocks one projectile hit.", recall: "Q recalls the lowest active ball.",
    bumperDamage: "Charged bumpers damage nearby enemies.", extraBumper: "Add a table bumper at a safe anchor.", gate: "Add a one-way recovery gate.", launcher: "Add a controlled upper launcher.", ramp: "Add a temporary scoring ramp.",
    orbit: "An orbiting spark damages marked targets.", mark: "Mark alternating targets for bonus XP.", drone: "A utility drone gathers loose XP.", chain: "Hits chain to one nearby enemy.", purge: "Clear hostile status effects.",
    ballSave: "One use: save the next drain.", timeRefill: "One use: restore 20 seconds.", instantMultiball: "One use: create instant multiball.", repair: "One use: restore all cooldowns.",
  };
  const CARDS = [];
  let rarityCursor = 0, rarityUsed = 0;
  CARD_CATEGORIES.forEach(([category, label, count], categoryIndex) => {
    for (let i = 0; i < count; i++) {
      while (rarityUsed >= RARITY_BUCKETS[rarityCursor][1]) { rarityCursor++; rarityUsed = 0; }
      const rarity = RARITY_BUCKETS[rarityCursor][0]; rarityUsed++;
      const effect = EFFECTS[category][i % EFFECTS[category].length];
      const name = `${CARD_ROOTS[(i + categoryIndex * 3) % CARD_ROOTS.length]} ${CARD_FORMS[(i * 3 + categoryIndex) % CARD_FORMS.length]}`;
      CARDS.push({ id: `${category}-${String(i + 1).padStart(2, "0")}`, name, category, categoryLabel: label, rarity, description: EFFECT_COPY[effect], effect, amount: 1 + Math.floor(i / 10) * .1, max: category === "consumable" ? 1 : Math.max(1, 5 - rarityCursor), art: CARDS.length });
    }
  });

  function hash(seed) { let x = seed | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return x >>> 0; }
  function biomeFor(level) { return BIOMES.find((b) => level >= b.range[0] && level <= b.range[1]) || BIOMES[4]; }
  function difficultyFor(level) { return DIFFICULTIES.find((difficulty) => level >= difficulty.range[0] && level <= difficulty.range[1]) || DIFFICULTIES.at(-1); }
  const ROLE_UNLOCKS = { drifter: 1, patrol: 3, shield: 7, armor: 11, sniper: 21, artillery: 26, healer: 31, support: 36, splitter: 41, ghost: 46, summoner: 51, reflector: 56 };
  const OBSTACLE_UNLOCKS = { bumper: 1, slingshot: 4, spinner: 7, rollover: 10, gate: 13, captive: 16, ramp: 21, kicker: 31, magnet: 41, vent: 61, cover: 66, crusher: 71 };
  const ROLE_COSTS = { drifter: 1, patrol: 1.1, shield: 1.4, armor: 1.5, sniper: 1.6, artillery: 1.8, healer: 2, support: 1.8, splitter: 2, ghost: 2.2, summoner: 2.4, reflector: 2.4 };
  const OBSTACLE_COSTS = { bumper: 1, slingshot: 1, spinner: 1, rollover: .6, gate: .8, captive: 1.4, ramp: 1.5, kicker: 1.6, magnet: 2, cover: 1.4, vent: 2.2, crusher: 2.5 };
  const ELEMENT_BLUEPRINTS = Object.fromEntries(TABLE_ELEMENT_TYPES.map((type) => [type, TABLE_MODULES.flatMap((layout) => layout.elements).filter((element) => element.type === type)]));
  function blueprintCenter(element) { if (Number.isFinite(element.x) && Number.isFinite(element.y)) return [element.x, element.y]; if (element.rect) return [element.rect[0] + element.rect[2] / 2, element.rect[1] + element.rect[3] / 2]; if (element.line) return [(element.line[0] + element.line[2]) / 2, (element.line[1] + element.line[3]) / 2]; if (element.rail) return [(element.rail[0] + element.rail[2]) / 2, (element.rail[1] + element.rail[3]) / 2]; if (element.rails) { const points = element.rails.flatMap((line) => [[line[0], line[1]], [line[2], line[3]]]); return [points.reduce((sum, point) => sum + point[0], 0) / points.length, points.reduce((sum, point) => sum + point[1], 0) / points.length]; } return [360, 500]; }
  function obstacleCap(level) { return level <= 3 ? 1 : level <= 6 ? 2 : level <= 10 ? 3 : level <= 20 ? 4 : level <= 40 ? 5 : level <= 80 ? 6 : 7; }
  function challengeRng(seed) { let state = seed >>> 0 || 1; return () => { state = hash(state); return state / 4294967296; }; }
  function generateChallenge(level, attemptSeed) {
    const random = challengeRng(attemptSeed), boss = BOSSES.find((item) => item.level === level), maxTier = Math.min(8, 1 + Math.floor((level - 1) / 14)), encounterCount = boss ? 1 : level <= 20 ? 1 : level <= 60 ? 2 : 3, enemyCount = level === 1 ? 1 : Math.min(8, 1 + Math.floor((level - 1) / 12)), rolePool = Object.keys(ROLE_UNLOCKS).filter((role) => ROLE_UNLOCKS[role] <= level), encounters = [];
    for (let encounter = 0; encounter < encounterCount; encounter++) { const ids = []; for (let i = 0; i < enemyCount + Math.min(encounter, 1); i++) { const role = level === 1 ? "drifter" : rolePool[Math.floor(random() * rolePool.length)], tier = level === 1 ? 1 : 1 + Math.floor(random() * maxTier); ids.push(`${role}-${tier}`); } encounters.push(ids); }
    if (boss) encounters.splice(0, encounters.length, [boss.id]);
    const unlockedTypes = Object.keys(OBSTACLE_UNLOCKS).filter((type) => OBSTACLE_UNLOCKS[type] <= level), milestoneType = Object.keys(OBSTACLE_UNLOCKS).find((type) => OBSTACLE_UNLOCKS[type] === level), elementCount = boss ? 0 : level === 1 ? 1 : Math.min(obstacleCap(level), 1 + Math.floor((level - 1) / 4)), chosenTypes = [];
    if (level === 1) chosenTypes.push("bumper"); else { if (milestoneType) chosenTypes.push(milestoneType); let guard = 0; while (chosenTypes.length < elementCount && guard++ < 100) { const candidate = unlockedTypes[Math.floor(random() * unlockedTypes.length)], hazardCap = level >= 81 ? 3 : 2; if (["vent", "crusher"].includes(candidate) && chosenTypes.filter((type) => ["vent", "crusher"].includes(type)).length >= hazardCap) continue; chosenTypes.push(candidate); } }
    const blueprintOffsets = {}, blueprintUses = {}, centers = []; const elements = chosenTypes.map((type, index) => { const pool = ELEMENT_BLUEPRINTS[type]; blueprintOffsets[type] ??= Math.floor(random() * pool.length); const use = blueprintUses[type] || 0; let source = pool[(blueprintOffsets[type] + use) % pool.length]; for (let step = 0; step < pool.length; step++) { const candidate = pool[(blueprintOffsets[type] + use + step) % pool.length], center = blueprintCenter(candidate); if (centers.every((other) => Math.hypot(center[0] - other[0], center[1] - other[1]) >= 82)) { source = candidate; break; } } blueprintUses[type] = use + 1; centers.push(blueprintCenter(source)); return { ...structuredClone(source), key: `generated-${index}` }; });
    const enemyThreat = encounters.flat().reduce((sum, id) => { const enemy = ENEMIES.find((item) => item.id === id); return sum + ROLE_COSTS[enemy?.role || "drifter"] * (1 + ((enemy?.tier || 1) - 1) * .18) * (enemy?.motionThreat || 1); }, 0), obstacleThreat = elements.reduce((sum, element) => sum + OBSTACLE_COSTS[element.type], 0), elite = !boss && level >= 10 && level % 5 === 0, eliteModifiers = elite ? Array.from({ length: level >= 55 ? 2 : 1 }, (_, i) => ELITE_MODIFIERS[(Math.floor(random() * ELITE_MODIFIERS.length) + i) % ELITE_MODIFIERS.length]) : [], defenseDuration = Math.min(12, 5 + level * .07), defenseRate = Math.max(.38, .82 - level * .004), defenseThreat = defenseDuration / defenseRate * .08, roleAverage = rolePool.reduce((sum, role) => sum + ROLE_COSTS[role], 0) / rolePool.length, motionAverage = MOTION_PROFILES.slice(0, maxTier).reduce((sum, profile) => sum + profile.motionThreat, 0) / maxTier, obstacleAverage = unlockedTypes.reduce((sum, type) => sum + OBSTACLE_COSTS[type], 0) / unlockedTypes.length, slotCount = encounters.reduce((sum, encounter) => sum + encounter.length, 0), targetThreatBase = slotCount * roleAverage * (1 + (maxTier - 1) * .12) * motionAverage + elementCount * obstacleAverage + defenseThreat, targetThreat = targetThreatBase * (elite ? 1.15 : 1), desiredEnemyThreat = Math.max(.5, targetThreat / (elite ? 1.15 : 1) - obstacleThreat - defenseThreat), enemyHealthScale = boss ? 1 : desiredEnemyThreat / Math.max(.5, enemyThreat), actualThreat = (enemyThreat * enemyHealthScale + obstacleThreat + defenseThreat) * (elite ? 1.15 : 1);
    return { version: VERSION, attemptSeed, level, layoutId: `challenge-${attemptSeed}`, name: `${biomeFor(level).name.split(" ")[0]} CONFIG`, difficulty: difficultyFor(level).id, encounters, elements, maxTier, obstacleCap: obstacleCap(level), elite, eliteModifiers, defenseDuration, defenseRate, enemyHealthScale, targetThreat, actualThreat: boss ? targetThreat : actualThreat, threatRatio: boss ? 1 : actualThreat / targetThreat };
  }
  const LEVELS = Array.from({ length: 101 }, (_, index) => {
    const level = index + 1, boss = BOSSES.find((item) => item.level === level), biome = biomeFor(level);
    const encounterCount = boss ? 1 : level <= 20 ? 1 : level <= 60 ? 2 : 3;
    const quarter = Math.min(3, Math.floor((level - 1) / 25));
    const layoutPool = TABLE_MODULES.filter((layout) => layout.biome === biome.id), layout = layoutPool[(level - biome.range[0] + hash(biome.range[0] * 6151) % layoutPool.length) % layoutPool.length], elite = !boss && level % 5 === 0;
    return {
      id: `level-${String(level).padStart(3, "0")}`, level, seed: hash(0xf11f57 ^ level * 7919),
      name: boss ? boss.name : `${biome.name.split(" ")[0]} ${String(level).padStart(3, "0")}`,
      biome: biome.id, difficulty: difficultyFor(level).id, timer: Math.min(240, 70 + level * .8 + encounterCount * 18),
      balls: [5, 4, 4, 3][quarter], continuous: level % 10 === 0 && !boss,
      elite: !boss && level >= 10 && level % 5 === 0, eliteModifiers: [], boss: boss?.id || null,
      encounters: boss ? [[boss.id]] : [],
      layoutId: layout.id, layoutVariant: hash(level * 3571 + 19),
    };
  });

  const ACHIEVEMENTS = Array.from({ length: 32 }, (_, i) => ({ id: `achievement-${i + 1}`, name: ["FIRST LIGHT", "DEAD CENTER", "NO DRAIN", "CHAIN REACTION", "MASTER BUILDER", "BARRAGE DANCER", "CORE BREAKER", "ASCENDANT"][i % 8] + (i > 7 ? ` ${Math.floor(i / 8) + 1}` : ""), target: (i % 8 + 1) * (Math.floor(i / 8) + 1) }));
  const PATTERNS = ["aim", "lane", "spread", "ring", "cross", "spiral"];

  const content = { VERSION, WORLD: { width: 720, height: 1280, physicsHz: 120 }, BIOMES, DIFFICULTIES, RARITIES, ENEMIES, BOSSES, CARDS, LEVELS, ACHIEVEMENTS, PATTERNS, ACTOR_ASSETS, DEFENSE_ASSETS, ROLE_SYSTEMS, MOTION_PROFILES, ROLE_UNLOCKS, TABLE_ELEMENT_TYPES, OBSTACLE_TUTORIALS, OBSTACLE_UNLOCKS, ROLE_COSTS, OBSTACLE_COSTS, TABLE_MODULES, ELITE_MODIFIERS, generateChallenge };
  content.enemyById = Object.fromEntries([...ENEMIES, ...BOSSES].map((x) => [x.id, x]));
  content.cardById = Object.fromEntries(CARDS.map((x) => [x.id, x]));
  content.biomeById = Object.fromEntries(BIOMES.map((x) => [x.id, x]));
  content.difficultyById = Object.fromEntries(DIFFICULTIES.map((x) => [x.id, x]));
  content.tableById = Object.fromEntries(TABLE_MODULES.map((x) => [x.id, x]));
  content.validate = () => {
    const errors = [];
    if (LEVELS.length !== 101) errors.push("Campaign must contain 101 levels");
    if (ENEMIES.length !== 96) errors.push("Enemy library must contain 96 types");
    if (CARDS.length !== 150) errors.push("Card library must contain 150 cards");
    if (BOSSES.length !== 5) errors.push("Campaign must contain five major bosses");
    if (TABLE_MODULES.length !== 15 || BIOMES.some((biome) => TABLE_MODULES.filter((layout) => layout.biome === biome.id).length !== 3)) errors.push("Table library must contain three layouts per biome");
    if (new Set(TABLE_MODULES.map((layout) => layout.id)).size !== TABLE_MODULES.length) errors.push("Table IDs must be unique");
    if (ENEMIES.some((enemy) => !enemy.movement || !enemy.behavior || !enemy.defensePattern || !enemy.motionProfile || !enemy.defenseSequence?.length || !enemy.motionThreat)) errors.push("Enemy behavior metadata is incomplete");
    if (TABLE_MODULES.some((layout) => layout.shotFamilies < 2 || layout.minPassage < 72 || layout.elements.some((element) => !TABLE_ELEMENT_TYPES.includes(element.type)))) errors.push("Invalid table layout constraints");
    if (TABLE_ELEMENT_TYPES.some((type) => !OBSTACLE_TUTORIALS[type]?.name || !OBSTACLE_TUTORIALS[type]?.description || !OBSTACLE_TUTORIALS[type]?.tip)) errors.push("Obstacle tutorial metadata is incomplete");
    if (Object.keys(ACTOR_ASSETS.roles).length !== 12 || Object.keys(ACTOR_ASSETS.bosses).length !== 5) errors.push("Actor asset manifest is incomplete");
    if (!DEFENSE_ASSETS.ship || Object.keys(DEFENSE_ASSETS.backgrounds).length !== 5 || BIOMES.some((biome) => !DEFENSE_ASSETS.backgrounds[biome.id])) errors.push("Defense asset manifest is incomplete");
    if (BOSSES.some((boss) => !boss.spriteId || !boss.projectileTheme || !boss.defensePresentation)) errors.push("Boss presentation metadata is incomplete");
    CARD_CATEGORIES.forEach(([category, , expected]) => { if (CARDS.filter((card) => card.category === category).length !== expected) errors.push(`Invalid ${category} card count`); });
    RARITY_BUCKETS.forEach(([rarity, expected]) => { if (CARDS.filter((card) => card.rarity === rarity).length !== expected) errors.push(`Invalid ${rarity} rarity count`); });
    if (new Set([...ENEMIES, ...BOSSES, ...CARDS, ...LEVELS].map((x) => x.id)).size !== ENEMIES.length + BOSSES.length + CARDS.length + LEVELS.length) errors.push("Content IDs must be unique");
    LEVELS.forEach((level) => level.encounters.flat().forEach((id) => { if (!content.enemyById[id]) errors.push(`Unknown enemy ${id}`); }));
    LEVELS.forEach((level) => { if (!content.tableById[level.layoutId]) errors.push(`Unknown table ${level.layoutId}`); });
    [1, 4, 10, 21, 41, 61, 81, 101].forEach((level) => { const challenge = generateChallenge(level, hash(level * 997 + 7)); if (challenge.threatRatio < .95 || challenge.threatRatio > 1.05) errors.push(`Threat budget out of range at level ${level}`); });
    return errors;
  };
  window.FLIP_DATA = Object.freeze(content);
})();
