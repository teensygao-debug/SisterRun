We are now in Phase 2: Visual Freeze.

Your current task is to integrate the heroine's run cycle sprite into the game.

Important constraints:
- Do NOT add new gameplay features.
- Do NOT redesign controls.
- Do NOT change jump, attack, charge, collision, scoring, combo, Fearless trigger, life system, or pad count.
- Do NOT modify working gameplay logic.
- Only replace the player running placeholder visuals.

## Reference documents
Read and follow:
- docs/GAME_DESIGN.md
- docs/ART_BIBLE.md
- docs/ART_REFACTOR_V2.md
- docs/PIXI_RULES.md
- docs/AI_DEVELOPMENT_RULES.md

## Goal
Integrate the heroine's pixel-art run cycle as the permanent player visual identity.

## Player visual identity
The heroine must remain:
- bright red short flowing hair
- white sleeveless tank top
- green athletic shorts
- white sneakers
- athletic female body
- full human anatomy
- modern pixel art
- side-view endless runner character
- not chibi
- not oversized head

## Integration rules
1. Use the provided run cycle as the visual source of truth for the player run animation.
2. Slice the run cycle into 8 frames.
3. Keep frame order correct for a continuous running loop.
4. Align all frames to the same ground baseline.
5. Preserve the same hitbox logic as the current placeholder player.
6. Replace only the player rendering layer, not the gameplay layer.
7. If the current image has a baked checkerboard background, remove it before integration.
8. Keep all enemies, items, FX, UI, and background unchanged for now.
9. Make the player use AnimatedSprite (or the project's equivalent animation system) for the run loop.
10. If needed, create a temporary static fallback for jump/attack/charge states, but do not invent new art styles.

## Technical requirements
- Put the player run sprite asset under the player asset folder.
- Use AssetManager / centralized asset loading.
- Do not hardcode file paths inside gameplay classes.
- Keep renderer logic separate from gameplay logic.
- If necessary, create or update:
  - src/render/PlayerRenderer.ts
  - src/entities/Player.ts
  - src/managers/AssetManager.ts
  - assets/player/run/

## Expected deliverables
1. The run cycle is sliced and loaded correctly.
2. The heroine replaces the placeholder player during running.
3. The animation loops smoothly in-game.
4. No gameplay mechanics are changed.
5. The code remains ready for future jump / throw / charge sprite replacement.

Before coding:
- First summarize your plan.
- Then list the exact files you will modify.
- Wait for approval before making large structural changes.