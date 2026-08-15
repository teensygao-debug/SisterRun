# Visual Freeze Plan

Version 1.0

This document records the approved Visual Freeze execution plan.

## Source Of Truth

The only source of truth for this phase is:

- `GAME_DESIGN.md`
- `ART_BIBLE.md`
- `ART_REFACTOR.md` (`ART_REFACTOR_V2.md`, Version 2.0)
- `PIXI_RULES.md`
- `AI_DEVELOPMENT_RULES.md`

## Frozen Gameplay Boundary

Do not change:

- Jump
- Attack
- Charge
- Collision rules
- Spawn rules
- Score rules
- Combo rules
- Fearless Mode trigger and duration
- Lives
- Pad count
- Input mapping
- Game over and restart flow

All work in this phase must be visual replacement only.

## Visual Acceptance Checklist

Every Visual Freeze change must pass this checklist:

- Uses one shared palette from `src/rendering/artTokens.js`.
- Uses one consistent 1 px dark outline.
- Uses top-left 45 degree lighting.
- Keeps player and obstacle feet aligned to a shared baseline.
- Keeps player anatomy complete: head, shoulders, arms, hands, chest, waist, hips, thighs, calves, feet.
- Keeps the heroine recognizable: red short hair, white sleeveless tank, green athletic shorts, white sneakers.
- Keeps all obstacles humorous and non-realistic.
- Uses no random downloaded assets.
- Uses no mixed asset packs.
- Uses no placeholder art in final assets.
- Keeps HUD arcade-style and pixel-readable.
- Keeps Guangzhou readable through required landmarks and street details.
- Does not change gameplay logic.

## Approved Milestones

### Milestone 0: Freeze Boundary

Confirm the current playable entry point and record which systems are frozen.

### Milestone 1: Rendering And Asset Pipeline

Create the PixiJS-ready visual asset pipeline without breaking the current playable prototype.

Required deliverables:

- `assets/assets.json`
- `assets/README.md`
- `src/rendering/AssetManager.js`
- `src/rendering/README.md`

### Milestone 2: Art Bible Tokens

Create a code-readable visual token file based on `ART_BIBLE.md`.

Required deliverables:

- `src/rendering/artTokens.js`

### Milestone 3: Player Sprite Freeze

Prepare the player sprite manifest and replacement path for:

- Idle: 2 frames
- Run: 8 frames
- Jump: 2 frames
- Fall: 2 frames
- Throw: 4 frames
- Charge: 4 frames
- Dash: 4 frames
- Fearless Run: 8 frames
- Hurt: 2 frames
- Victory: 4 frames

### Milestone 4: Obstacle And Prop Sprite Freeze

Prepare sprite manifests for:

- Smoke
- Harasser
- Drunk Man
- Pad pickup
- Pad projectile
- Comic impact props

### Milestone 5: Guangzhou Background Freeze

Prepare parallax layers:

- Sky
- Far skyline
- Canton Tower
- CBD mid buildings
- Lingnan arcade buildings
- Bus stops
- Neon billboards
- Metro entrances
- Zebra crossing
- Road
- Foreground effects

### Milestone 6: UI And Comic FX Freeze

Prepare UI and FX assets:

- HUD hearts
- Courage bar
- Pad counter
- Fearless timer
- Start and restart buttons
- Comic speech bubble
- Comic popup frames
- BOOM / BANG / POW / KO effects
- Dust
- Stars
- Speed lines

### Milestone 7: Visual QA Gate

Browser QA must confirm:

- No gameplay regression.
- Desktop HUD is readable.
- Mobile HUD is readable.
- Player silhouette is readable over city background.
- Obstacles are readable while moving.
- Comic popups do not block core controls.
- All visible assets follow one visual language.
