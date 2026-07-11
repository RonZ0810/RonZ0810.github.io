(function () {
  "use strict";

  const VERSION = 3;
  const BIOMES = [
    { id: "foundry", name: "NEON FOUNDRY", range: [1, 20], accent: 0x57e7ff, accentCss: "#57e7ff", top: 0x071b29, bottom: 0x02070d, mechanic: "Charged bumpers", material: "chrome" },
    { id: "transit", name: "PRISM TRANSIT", range: [21, 40], accent: 0xb67cff, accentCss: "#b67cff", top: 0x17102c, bottom: 0x05040e, mechanic: "Shield lanes", material: "glass" },
    { id: "abyss", name: "MAGNETIC ABYSS", range: [41, 60], accent: 0x4fffc3, accentCss: "#4fffc3", top: 0x06231f, bottom: 0x020b0b, mechanic: "Gravity wells", material: "obsidian" },
    { id: "furnace", name: "RUPTURE FURNACE", range: [61, 80], accent: 0xff8b45, accentCss: "#ff8b45", top: 0x2b1009, bottom: 0x0c0302, mechanic: "Heat rhythms", material: "ceramic" },
    { id: "citadel", name: "CORE CITADEL", range: [81, 101], accent: 0xff4f75, accentCss: "#ff4f75", top: 0x270814, bottom: 0x090208, mechanic: "Table transformations", material: "crystal" },
  ];

  const DIFFICULTIES = [
    { id: "green", name: "VERY EASY", color: "#6ce6a6" },
    { id: "yellow", name: "MEDIUM", color: "#f7d16b" },
    { id: "orange", name: "HARD", color: "#ff9a59" },
    { id: "red", name: "VERY HARD", color: "#ff646f" },
    { id: "darkred", name: "EXTREME", color: "#bd3456" },
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
  const VARIANTS = ["I", "II", "III", "IV", "V", "VI", "VII", "OMEGA"];
  const ENEMIES = [];
  ROLE_DEFS.forEach((role, roleIndex) => VARIANTS.forEach((variant, tier) => {
    const id = `${role[0]}-${tier + 1}`;
    ENEMIES.push({
      id, role: role[0], spriteId: role[0], materialVariant: tier % BIOMES.length, name: `${role[1]} ${variant}`, pattern: role[2], tier: tier + 1,
      ...ROLE_SYSTEMS[role[0]], escalation: { speed: 1 + tier * .08, reverses: tier >= 2, altitude: tier >= 4, modifierSlots: tier >= 6 ? 2 : tier >= 3 ? 1 : 0 },
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
  function difficultyFor(level) { return DIFFICULTIES[Math.min(4, Math.floor((level - 1) / 20))]; }
  function encounterFor(level, encounter) {
    const count = Math.min(8, 2 + Math.floor(level / 14) + encounter);
    return Array.from({ length: count }, (_, i) => ENEMIES[(hash(level * 4099 + encounter * 97 + i * 13) % ENEMIES.length)].id);
  }
  const LEVELS = Array.from({ length: 101 }, (_, index) => {
    const level = index + 1, boss = BOSSES.find((item) => item.level === level), biome = biomeFor(level);
    const encounterCount = boss ? 1 : Math.min(3, 1 + Math.floor((level - 1) / 34));
    const quarter = Math.min(3, Math.floor((level - 1) / 25));
    const layoutPool = TABLE_MODULES.filter((layout) => layout.biome === biome.id), layout = layoutPool[(level - biome.range[0] + hash(biome.range[0] * 6151) % layoutPool.length) % layoutPool.length], elite = !boss && level % 5 === 0;
    return {
      id: `level-${String(level).padStart(3, "0")}`, level, seed: hash(0xf11f57 ^ level * 7919),
      name: boss ? boss.name : `${biome.name.split(" ")[0]} ${String(level).padStart(3, "0")}`,
      biome: biome.id, difficulty: difficultyFor(level).id, timer: Math.min(210, 82 + level * 1.15 + encounterCount * 12),
      balls: [5, 4, 4, 3][quarter], continuous: level % 10 === 0 && !boss,
      elite, eliteModifiers: elite ? Array.from({ length: Math.min(2, 1 + Math.floor(level / 55)) }, (_, i) => ELITE_MODIFIERS[hash(level * 97 + i * 31) % ELITE_MODIFIERS.length]) : [], boss: boss?.id || null,
      encounters: boss ? [[boss.id]] : Array.from({ length: encounterCount }, (_, i) => encounterFor(level, i)),
      layoutId: layout.id, layoutVariant: hash(level * 3571 + 19),
    };
  });

  const ACHIEVEMENTS = Array.from({ length: 32 }, (_, i) => ({ id: `achievement-${i + 1}`, name: ["FIRST LIGHT", "DEAD CENTER", "NO DRAIN", "CHAIN REACTION", "MASTER BUILDER", "BARRAGE DANCER", "CORE BREAKER", "ASCENDANT"][i % 8] + (i > 7 ? ` ${Math.floor(i / 8) + 1}` : ""), target: (i % 8 + 1) * (Math.floor(i / 8) + 1) }));
  const PATTERNS = ["aim", "lane", "spread", "ring", "cross", "spiral"];

  const content = { VERSION, WORLD: { width: 720, height: 1280, physicsHz: 120 }, BIOMES, DIFFICULTIES, RARITIES, ENEMIES, BOSSES, CARDS, LEVELS, ACHIEVEMENTS, PATTERNS, ACTOR_ASSETS, ROLE_SYSTEMS, TABLE_ELEMENT_TYPES, TABLE_MODULES, ELITE_MODIFIERS };
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
    if (ENEMIES.some((enemy) => !enemy.movement || !enemy.behavior || !enemy.defensePattern)) errors.push("Enemy behavior metadata is incomplete");
    if (TABLE_MODULES.some((layout) => layout.shotFamilies < 2 || layout.minPassage < 72 || layout.elements.some((element) => !TABLE_ELEMENT_TYPES.includes(element.type)))) errors.push("Invalid table layout constraints");
    if (Object.keys(ACTOR_ASSETS.roles).length !== 12 || Object.keys(ACTOR_ASSETS.bosses).length !== 5) errors.push("Actor asset manifest is incomplete");
    if (BOSSES.some((boss) => !boss.spriteId || !boss.projectileTheme || !boss.defensePresentation)) errors.push("Boss presentation metadata is incomplete");
    CARD_CATEGORIES.forEach(([category, , expected]) => { if (CARDS.filter((card) => card.category === category).length !== expected) errors.push(`Invalid ${category} card count`); });
    RARITY_BUCKETS.forEach(([rarity, expected]) => { if (CARDS.filter((card) => card.rarity === rarity).length !== expected) errors.push(`Invalid ${rarity} rarity count`); });
    if (new Set([...ENEMIES, ...BOSSES, ...CARDS, ...LEVELS].map((x) => x.id)).size !== ENEMIES.length + BOSSES.length + CARDS.length + LEVELS.length) errors.push("Content IDs must be unique");
    LEVELS.forEach((level) => level.encounters.flat().forEach((id) => { if (!content.enemyById[id]) errors.push(`Unknown enemy ${id}`); }));
    LEVELS.forEach((level) => { if (!content.tableById[level.layoutId]) errors.push(`Unknown table ${level.layoutId}`); if (level.eliteModifiers.length > 2) errors.push(`Too many elite modifiers at level ${level.level}`); });
    return errors;
  };
  window.FLIP_DATA = Object.freeze(content);
})();
