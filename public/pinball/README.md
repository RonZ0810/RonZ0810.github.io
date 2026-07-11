# FLIPSTRIKE

FLIPSTRIKE is a portrait-first pinball action roguelike implemented from the production game design baseline.

## Production content

- 101 deterministic campaign levels across five biomes
- Five major bosses, including the four-stage Final Core
- 96 regular enemy definitions across 12 combat roles
- 150 upgrade cards with the locked rarity and category distributions
- 32 cosmetic/skill achievement definitions
- Endless Mode beginning at Level 102
- Original production key art plus deterministic procedural card compositions

## Game systems

- PixiJS WebGL presentation and Planck.js fixed-step physics at 120 Hz
- Motorized revolute-joint flippers: contact speed scales with distance from the hinge, producing soft near-pivot taps and powerful tip shots
- Physics-driven flippers, charged launch, multiball, nudge upgrades, bumpers, and direct-impact combat
- Drain-triggered attack/defense rhythm: defense begins only after every active ball drains
- Three-card XP drafts, stack limits, rarity weights, abilities, consumables, rerolls, and level-local builds
- Keyboard, pointer-drag, and touch controls in a responsive 9:16 frame
- Versioned browser progress plus one-use IndexedDB suspend saves
- Howler-managed browser audio context and stored accessibility settings

## Controls

- Left/right flippers: `A` / `D` or Left / Right Arrow
- Launch: hold and release Space or the Launch touch zone
- Nudge: Shift after acquiring a nudge card
- Ability: `Q`
- Consumable: `E`
- Defense movement: `A` / `D`, arrows, or horizontal pointer drag
- Pause: `P` or Escape

## Development

```powershell
npm install
npm run dev
```

Open `/pinball/`. All game runtimes and assets are vendored, so the deployed game has no runtime network requirement.

Run validation with:

```powershell
npm test
```

## Generated art

`assets/flipstrike-tower.png` was generated with OpenAI's built-in image generation workflow for this project. Prompt intent: an original portrait neon pinball tower in a dark void, reflective geometric machinery, restrained cyan/amber/magenta bloom, no text, logo, watermark, brands, or copied game assets.

## Third-party runtimes

PixiJS, Planck.js, and Howler.js are distributed under the MIT License. See `vendor/THIRD-PARTY-LICENSES.txt`.
