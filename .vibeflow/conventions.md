# Conventions

<!-- vibeflow:auto:start -->
## Language & locale
- All UI text, code comments, `console.log` messages, card names, and
  ability text are in **Portuguese (pt-br)**. Match this for any new
  user-facing string or comment. (via AGENTS.md / project locale)
- `<html lang="pt-br">` in both `game.html` and `index.html`.

## No build system
- No `package.json`, no bundler, no transpiler, no TypeScript. Plain ES6
  loaded via `<script src="...">` at the end of `<body>`, in this order:
  `src/js/game-state.js` → `game-engine.js` → `card-rules.js` →
  `card-abilities.js` → `deck_system.js` → `manual_abilities.js` → inline
  `game.html` script. New runtime JS must be inserted in that list so
  dependents load after their dependencies.
- Engine files use a UMD IIFE (`module.exports` + `window.*`) so
  `tests/unit/run-tests.js` can `require()` the same sources.
- Run the web app through `py -3 -m http.server 8000`; direct `file://`
  loading cannot fetch the authoritative card database.
- Tests: `node tests/unit/run-tests.js` (no extra packages). Coverage
  CLI: `py -3 scripts/check_cards.py`.

## Naming
- JS: `camelCase` for functions/variables, `PascalCase` for classes and
  exported namespaces (`DeckBuilder`, `CardAbilitiesSystem`,
  `GameStateModel`, `GameEngine`, `CardRules`).
- Card definition ids: `card_0NN` (zero-padded 3 digits); multi-copy
  cards suffix with `_1`/`_2`/`_3` (e.g. `card_010_1`).
- Instance ids: `${definitionId}_${ownerId}_${sequence}` from
  `GameStateModel.createInstanceId` — never `Date.now()`.
- Activated abilities: `abilityId` snake/camel in `ACTIVATED_RULES`
  (e.g. `sabotar_copo`), keyed by `definitionId`.
- Card image files: lowercase, spaces replaced with underscores, accented
  Portuguese characters preserved (e.g. `assets/cards/espada_mágica.png`).
- Python: `snake_case`, one script per tool under `scripts/`.

## Global state & cross-file coupling
- One mutable `gameState` from `GameStateModel.createInitialGameState`.
  Do not introduce a second game model. (via game-state-management)
- PV/energy canonical store is `state.players[id]`; DOM is rendered by
  `changeStat` / `renderPlayerStat`.
- Cross-file APIs on `window` (`gameState`, `gameEngine`, `GameStateModel`,
  `GameEngine`, `CardRules`, `cardAbilities`, `findCardData`, `changeStat`,
  `updateUI`, `deckBuilder`, `cardsDatabase`) accessed with existence
  guards (`window.X?.y()`).

## Data
- `data/cards_database.json` is the single authoritative card dataset
  (110 cards). Schema:
  `{ name, type: 'criatura'|'suporte'|'evolução', cost, attack, defense,
  hability, id, image: 'assets/cards/...' }`.
- Traits used by rules live in `CardRules.TRAITS_BY_DEFINITION`, not in
  the JSON (the catalog has no `traits` field today).

## UI/CSS
- Theming via `:root` CSS custom properties. Card visual state is CSS
  classes via `classList`, not inline styles. (via card-dom-rendering)
- Production `game.html` must not load `tests/browser/*.js`.

## Don'ts
- Do NOT add per-card methods or `switch (cardData.id)` in
  `card-abilities.js` — extend `src/js/card-rules.js` instead.
- Do NOT add a new global variable for game data — extend `gameState`.
- Do NOT duplicate `data/cards_database.json` into another hardcoded JS
  dataset. The only fallback is `getFallbackCardData()` in
  `src/js/deck_system.js`.
- Do NOT wire debug/manual-test scripts back into `game.html`.
- Do NOT mutate PV/energy by writing `element.innerText` without
  `GameStateModel.changePlayerStat`.
- Do NOT subtract `card.data.defense` in the UI for combat — use
  `gameEngine.resolveCombat` / `getRemainingDefense`.
- Do NOT use `CardRules.isMigrated()` as the coverage gate; scan
  `card-rules.js` text (as `scripts/check_cards.py` does).
- Do NOT add npm dependencies for tests; keep `node:assert`.
<!-- vibeflow:auto:end -->
