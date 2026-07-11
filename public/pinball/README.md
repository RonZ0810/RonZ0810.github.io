# FLIPSTRIKE V2

A ten-level roguelike pinball campaign built with Canvas, JavaScript, CSS, and a locally vendored Matter.js runtime.

## Campaign

- Ten ascending levels across the Calibration Array and Ember Foundry
- Multi-wave encounters, reinforcements, elite enemies, and evolving hazards
- Mid-boss on Level 5 and a four-phase final boss on Level 10
- Forty weighted upgrade cards across five rarity tiers
- Build paths for multiball, precision, ricochet, combo, impact, magnetism, and defense
- Enemy barrage turns with aimed, lane, spread, and ring projectile patterns
- Endless mode unlocked after the campaign
- Seeded encounter variation and one-use browser saves

## Run

Serve the repository through Vite or another static web server:

```powershell
npm install
npm run dev
```

Open `/pinball/index.html`. The game has no runtime network requirement. Matter.js and its license are stored in `vendor/`.

## Controls

- Left flipper / shield movement: `A` or Left Arrow
- Right flipper / shield movement: `D` or Right Arrow
- Plunger: hold Space to charge, then release to launch
- Nudge, after acquiring its card: Shift
- Pause: `P` or Escape
- Touch: lower left/right control zones and the Launch button

The V2 flippers sit inside the lower guide rails and rotate around fixed outer hinges. A strike impulse exists only during the opening swing, so a held flipper behaves as a physical surface instead of automatically launching every contact.

## Persistence

Runs can be saved from the pause or level-complete screen. A saved run is deleted when loaded. Lifetime best level, score, campaign wins, and endless record remain in `localStorage`.
