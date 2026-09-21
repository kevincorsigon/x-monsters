---
tags: [testing, node, determinism, regression]
modules: [tests/unit/, tests/pvp/, src/js/]
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
Not loaded by `game.html` / `pvp.html`. Browser files under `tests/browser/`
are manual diagnostics only. `tests/pvp/smoke_match.py` is the network-level
suite (`py -3 tests/pvp/smoke_match.py`, needs `websockets`).

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

PvP layers are tested headless by injecting their collaborators — no socket,
no DOM:

```javascript
const PvpState = require('../../src/js/pvp-state.js');
const { PvpSession } = require('../../src/js/pvp-session.js');

test('pvp-session alimenta o dado com DICE_RESULT', () => {
    const recebidos = [];
    const session = new PvpSession({
        transportSend: () => {},
        gameState: state,
        seat: 'p1',
        applyCommand: entry => recebidos.push(entry)
    });
    session.handleMessage({ type: 'DICE_RESULT', seq: 1, actor: 'p1', value: 4 });
    assert.equal(recebidos[0].args.value, 4);
});
```

End-to-end (server + two real WebSocket clients) is a separate Python smoke
suite: `py -3 tests/pvp/smoke_match.py` starts `server.py` on port 8099 and
asserts the relay, the ledger mirror and the deck isolation.

## Rules
- New engine or card-rule behavior needs a `test('...', () => { ... })` in
  this file (or a dedicated helper in the same script). No Jest/Mocha.
- Use a deterministic `idFactory`; do not rely on `Date.now()`.
- Assert against `state` / engine getters, not the DOM.
- Do not add `<script src="tests/...">` to `game.html` / `pvp.html`.
- PvP code is tested by injecting collaborators (`transportSend`,
  `applyCommand`, `{ resolveDefinition }`), never by mocking the DOM or
  opening a socket inside the Node suite.
- Randomness in a test is always seeded (`mulberry32(42)`) — the suite never
  depends on `Math.random`.
- Assertions sobre arquivos-fonte (CSS/HTML/JS) leem via `readSourceText(...)`,
  que normaliza CRLF → LF: o repositório guarda LF, mas um checkout Windows
  com `core.autocrlf=true` entrega CRLF e regex ancorada em `\{\n` falha. Toda
  regex que dependa de fim de linha deve usar `\s*` ou o texto normalizado.

## Examples from this codebase
File: `tests/unit/run-tests.js`
Bootstrap requires, `test()` registry, instance-identity cases, combat and
ability fixtures, plus the PvP blocks (`pvp-state`, `pvp-session`,
`pvp-protocol` — 175 tests at last run).

File: `tests/pvp/smoke_match.py`
`WsClient` (background listener + `drain`) against a real `server.py`
subprocess.
<!-- vibeflow:auto:end -->

## Anti-patterns
- Console-only browser scripts (`tests/browser/*.js`) treated as the
  regression suite — they are not executed in CI and no longer ship in
  production HTML.
