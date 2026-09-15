---
tags: [game-engine, events, effects, combat, umd]
modules: [src/js/game-engine.js, src/js/game-state.js]
applies_to: [services, models]
confidence: inferred
---
# Pattern: Event/Effect Game Engine

<!-- vibeflow:auto:start -->
## What
Canonical match simulation lives in `GameStateModel` + `GameEngine`: every
legal change is an action that emits frozen events, which handlers convert
into typed effects applied inside a rollback transaction.

## Where
`src/js/game-state.js` (zones, instances, PV/energy), `src/js/game-engine.js`
(`createEngine`, `resolveAction`, `resolveCombat`). Loaded first in
`game.html`; required as CommonJS from `tests/unit/run-tests.js`.

## The Pattern
Engine modules are UMD IIFEs so the same file runs in the browser and in Node:

```javascript
(function(root, factory) {
    const gameStateModel = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = gameStateModel;
    }
    root.GameStateModel = gameStateModel;
})(typeof window !== 'undefined' ? window : globalThis, function() {
    // ...
});
```

`game.html` wires one shared state into the engine:

```javascript
let gameState = window.GameStateModel.createInitialGameState(window.gameConfig);
window.gameState = gameState;
window.gameEngine = window.GameEngine.createEngine(gameState);
window.cardAbilities.attachEngine(window.gameEngine);
```

UI never mutates combat math locally. It asks the engine:

```javascript
const result = window.gameEngine.resolveAction({
    type: 'SUMMON_CARD',
    actorId: targetPlayer,
    sourceId: cardId,
    costs: [{ kind: 'PLAYER_STAT', stat: 'energy', playerId: targetPlayer, amount: summonCost }],
    effects: [{
        kind: window.GameEngine.EFFECT_KINDS.MOVE_CARD,
        instanceId: cardId,
        destinationZone: 'field',
        destinationPlayerId: targetPlayer
    }],
    events: [
        { type: window.GameEngine.EVENT_TYPES.CARD_PLAYED, payload: { cardId, playerId: targetPlayer } },
        { type: window.GameEngine.EVENT_TYPES.CREATURE_SUMMONED, payload: { cardId, playerId: targetPlayer } }
    ]
});
```

Combat is `resolveCombat`, not DOM defense subtraction. Events fire in order
`ATTACK_DECLARED` → `BECAME_ATTACK_TARGET` → `BEFORE_DAMAGE` (then damage /
death). CardRules registers handlers via `engine.registerEventHandler`.

## Rules
- Add game logic as `EFFECT_KINDS` / `EVENT_TYPES` consumed by
  `resolveAction`/`resolveCombat`, not as ad-hoc mutations in `game.html`.
- Instance identity is `instanceId` (`card_012_p1_1`), distinct from catalog
  `definitionId` (`card_012`). Lookups use `state.cardInstances[instanceId]`.
- Zones are `players[id].zones.{deck,hand,field,equipment,discard}`. Legacy
  aliases (`state.cards`, `state.decks`, `state.maxEnergy`) point at the
  same arrays — do not create a second copy.
- PV and energy live on `state.players[id]`. The DOM is a view via
  `changeStat` → `GameStateModel.changePlayerStat` → `renderPlayerStat`.
- New engine files must keep the UMD wrapper; unit tests `require()` them.
- Durations, modifiers, and ability uses are engine concerns
  (`DURATION_KINDS`, `ADD_MODIFIER`, `RECORD_ABILITY_USE`).

## Examples from this codebase
File: `src/js/game-state.js`
`createInitialGameState`, `createCardInstance`, `moveCard`, `changePlayerStat`.

File: `src/js/game-engine.js`
`EVENT_TYPES` / `EFFECT_KINDS` frozen enums, `resolveAction`, `resolveCombat`.

File: `game.html`
Boot sequence and `SUMMON_CARD` / `resolveCombat` call sites.
<!-- vibeflow:auto:end -->

## Anti-patterns
- Reading ATK/DEF from the DOM (`.attack` span) for rules — effective stats
  come from `gameEngine.getEffectiveStat` / `getRemainingDefense`.
- Treating `cardAbilities.permanentEffects` as the combat protection store
  (removed in Fase 7; protections are `state.effects` + `CardRules.validateAttackTarget`).
