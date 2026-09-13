---
tags: [state-management, game-loop, phases, dom-state]
modules: [game.html]
applies_to: [handlers, controllers]
confidence: inferred
---
# Pattern: Game State & Turn/Phase Management

<!-- vibeflow:auto:start -->
## What
A single global mutable `gameState` object tracks whose turn it is, the current
phase, and where cards live (hand/field/discard per player). Numeric PV and
Energy values are *not* stored in `gameState` — they live in the DOM
(`#pv-p1`, `#energy-p1` text content) and are read back with `parseInt`.

## Where
`game.html`, inline `<script>` block (state declared ~line 2014, mutated
throughout `changeStat`, `nextPhase`, `endTurn`, `setPhase`, `dropCard`,
`performAttack`, etc.).

## The Pattern
```javascript
let gameState = {
    currentPlayer: 'p1',
    currentPhase: 'energy', // energy, summon, combat
    turn: 1,
    diceUsed: { p1: false, p2: false },
    selectedCard: null,
    attackingCard: null,
    targetCard: null,
    attackedThisTurn: [], // IDs das cartas que já atacaram este turno
    maxEnergy: { p1: INITIAL_ENERGY, p2: INITIAL_ENERGY },
    cards: {
        p1: { hand: [], field: [], discard: [] },
        p2: { hand: [], field: [], discard: [] }
    }
};

function changeStat(stat, player, amount) {
    const element = document.getElementById(`${stat}-${player}`);
    let currentValue = parseInt(element.innerText);
    let newValue = currentValue + amount;
    if (newValue < 0) newValue = 0;
    if (stat === 'energy' && newValue > MAX_ENERGY) newValue = MAX_ENERGY;
    // ... sounds, visual feedback, victory check ...
    element.innerText = newValue;
}

function setPhase(phase) {
    if (gameState.currentPhase === 'combat') clearCombatHighlights();
    gameState.currentPhase = phase;
    updateUI();
    playSound('energySound');
}
```

## Rules
- All new game-wide state fields belong on `gameState` — do not create new
  top-level `let`/`var` globals for game data.
- Any phase or player change must be followed by `updateUI()` so the DOM
  reflects `gameState` (buttons, highlights, hand visibility).
- PV/Energy are read from the DOM (`parseInt(element.innerText)`), not from
  `gameState` — `gameState` only holds `maxEnergy` (the turn-based ceiling)
  and `diceUsed`. Don't add a duplicate PV/Energy field to `gameState`;
  follow the existing DOM-as-truth convention for those two stats.
- Cross-file integrations are guarded: `if (window.cardAbilities) { ... }`
  before calling into `card-abilities.js`, and vice versa
  (`window.gameState`, `window.findCardData`, `window.changeStat`,
  `window.updateUI` are read back from `card-abilities.js`).

## Examples from this codebase
File: [game.html](../../game.html#L2014)
```javascript
let gameState = {
    currentPlayer: 'p1',
    currentPhase: 'energy',
    turn: 1,
    ...
};
```

File: [game.html](../../game.html#L2179)
```javascript
function endTurn() {
    gameState.currentPlayer = gameState.currentPlayer === 'p1' ? 'p2' : 'p1';
    gameState.currentPhase = 'energy';
    gameState.turn++;
    if (window.cardAbilities) {
        window.cardAbilities.processTurnEffects();
    }
    gameState.attackedThisTurn = [];
    updateAttackedCardsVisual();
    ...
}
```
<!-- vibeflow:auto:end -->

## Anti-patterns
- Dual source of truth for PV/Energy (DOM text vs. a would-be `gameState`
  field) risks desync if a new feature reads/writes only one of the two —
  always go through `changeStat`/`editStatValue`, never set
  `element.innerText` directly elsewhere.
- Heavy `console.log` debugging is left throughout state-mutating functions
  in production code (no debug flag/log level).
