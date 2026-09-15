---
tags: [testing, node, determinism, regression]
modules: [tests/unit/]
applies_to: [tests]
confidence: inferred
---
# Pattern: Headless Unit Tests

<!-- vibeflow:auto:start -->
## What
Engine and card-rule behavior is verified by a single Node script with
`node:assert/strict` and no test framework. Tests construct a state, run
engine actions, and assert zone occupancy, stats, and combat results.

## Where
`tests/unit/run-tests.js`. Run from repo root: `node tests/unit/run-tests.js`.
Not loaded by `game.html`. Browser files under `tests/browser/` are manual
diagnostics only.

## The Pattern
```javascript
const assert = require('node:assert/strict');
const GameStateModel = require('../../src/js/game-state.js');
const GameEngine = require('../../src/js/game-engine.js');
const CardRules = require('../../src/js/card-rules.js');

const tests = [];
function test(name, callback) {
    tests.push({ name, callback });
}

function createIdFactory() {
    let sequence = 0;
    return (definition, ownerId) => `${definition.id}_${ownerId}_test_${++sequence}`;
}

test('cria instâncias distintas para definições repetidas', () => {
    const state = GameStateModel.createInitialGameState();
    GameStateModel.resetMatchState(state, {
        p1: [repeatedDefinition, repeatedDefinition],
        p2: [repeatedDefinition]
    }, { idFactory: createIdFactory() });
    assert.equal(Object.keys(state.cardInstances).length, 3);
});
```

Ability scenarios typically `CardRules.install(engine)` then
`engine.resolveAction` / `resolveCombat`.

## Rules
- New engine or card-rule behavior needs a `test('...', () => { ... })` in
  this file (or a dedicated helper in the same script). No Jest/Mocha.
- Use a deterministic `idFactory`; do not rely on `Date.now()`.
- Assert against `state` / engine getters, not the DOM.
- Do not add `<script src="tests/...">` to `game.html`.

## Examples from this codebase
File: `tests/unit/run-tests.js`
Bootstrap requires, `test()` registry, instance-identity cases, combat and
ability fixtures (141 assertions at last recorded run).
<!-- vibeflow:auto:end -->

## Anti-patterns
- Console-only browser scripts (`tests/browser/*.js`) treated as the
  regression suite — they are not executed in CI and no longer ship in
  production HTML.
