# Rendering Layer

This folder is for Visual Freeze rendering infrastructure.

The current playable prototype in `../index.html` must remain playable while this layer is prepared.

## Rule

Do not move gameplay logic here.

This layer may only own:

- asset manifest loading
- texture lookup
- sprite metadata
- art tokens
- rendering adapter code

Gameplay state, input, scoring, collision, combo, and Fearless Mode logic remain frozen.

