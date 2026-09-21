---
tags: [state-management, game-loop, phases, zones]
modules: [src/js/game-state.js, src/js/game.js]
applies_to: [models, handlers, controllers]
confidence: inferred
---
# Pattern: Game State & Turn/Phase Management

<!-- vibeflow:auto:start -->
## What
Canonical match state is a single object created by
`GameStateModel.createInitialGameState`. UI phase/turn fields
(`currentPlayer`, `currentPhase`, `turn`) still live on that object;
PV/energy live on `state.players[id]`, not in the DOM.

## Where
`src/js/game-state.js` (factory, zones, instance ids, player stats).
`src/js/game.js` holds the live `gameState` reference, calls
`gameEngine.resolveAction` for turn/phase, and mirrors stats to the DOM
through `changeStat` / `renderPlayerStat`. Re/mounting a match goes through
`resetMatchState`, which is how PvP installs opaque ids and hidden zones.

## The Pattern
```javascript
let gameState = window.GameStateModel.createInitialGameState(window.gameConfig);
window.gameState = gameState;

function changeStat(stat, player, amount) {
    const newValue = window.GameStateModel.changePlayerStat(
        gameState, stat, player, amount, { energyCap: MAX_ENERGY }
    );
    renderPlayerStat(stat, player);
    // sounds + victory check from newValue
}

function renderPlayerStat(stat, player) {
    const element = document.getElementById(`${stat}-${player}`);
    element.innerText = window.GameStateModel.getPlayerStat(gameState, stat, player);
}
```

Turn advance goes through the engine (events + `SET_TURN_STATE`), not a
bare field increment plus `cardAbilities.processTurnEffects()` (that
method is now a no-op; ticks are `TURN_STARTED` / `TURN_ENDED`).

`attachLegacyAliases` exposes `state.cards[player].field` as the same
array as `state.players[player].zones.field` so older UI loops keep working.

## Rules
- New match fields belong on this one `gameState` object (or on card
  instances / `state.effects`). Do not add a second model.
- Write PV/energy only via `GameStateModel.changePlayerStat` /
  `setPlayerStat`, then `renderPlayerStat`. Do not treat
  `parseInt(element.innerText)` as source of truth.
- Instance ids come from `createInstanceId` / `resetMatchState`, not
  `Date.now()`.
- Cross-file access: `window.gameState`, `window.gameEngine`,
  `window.GameStateModel`, guarded with optional chaining.

## Examples from this codebase
File: `src/js/game-state.js`
`createInitialGameState`, `attachLegacyAliases`, `resetMatchState`.

File: `src/js/game.js`
Boot of `gameState` / `gameEngine`, `changeStat`, `renderPlayerStat`
(top of the file, before any handler).

File: `src/js/game-state.js`
`resetMatchState(state, decks, { idFactory, initialPv, initialEnergy })` —
the supported way to (re)mount a match; PvP passes
`PvpState.createPvpIdFactory(seed)` and then `PvpState.installHiddenZones`
(pattern: `pvp-hidden-state.md`).
<!-- vibeflow:auto:end -->

## Anti-patterns
- Dual source of truth for PV/Energy (DOM text vs. a would-be `gameState`
  field) risks desync if a new feature reads/writes only one of the two —
  always go through `changeStat`/`editStatValue`, never set
  `element.innerText` directly elsewhere.
- Heavy `console.log` debugging is left throughout state-mutating functions
  in production code (no debug flag/log level).
