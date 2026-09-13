# Conventions

<!-- vibeflow:auto:start -->
## Language & locale
- All UI text, code comments, `console.log` messages, card names, and
  ability text are in **Portuguese (pt-br)**. Match this for any new
  user-facing string or comment.
- `<html lang="pt-br">` in both `game.html` and `index.html`.

## No build system
- No `package.json`, no bundler, no transpiler, no TypeScript. Plain ES6
  loaded via `<script src="...">` tags at the end of `<body>`, in a fixed
  order (`src/js/card-abilities.js` → `src/js/deck_system.js` → debug/test scripts →
  inline game script). New JS files must be added the same way, in an order
  that respects their dependencies (a script using `window.cardAbilities`
  must load after `src/js/card-abilities.js`).
- Run the web app through `py -3 -m http.server 8000`; direct `file://`
  loading cannot fetch the authoritative card database.

## Naming
- JS: `camelCase` for functions/variables, `PascalCase` for classes
  (`DeckBuilder`, `CardAbilitiesSystem`).
- Card ids: `card_0NN` (zero-padded 3 digits); multi-copy cards suffix with
  `_1`/`_2`/`_3` (e.g. `card_010_1`).
- Ability methods: `<camelCaseCardName>_<effectDescription>` (e.g.
  `natalino_healAllies`, `espadaMagica_boost`) — see
  [patterns/card-ability-system.md](patterns/card-ability-system.md).
- Card image files: lowercase, spaces replaced with underscores, accented
  Portuguese characters preserved (e.g. `assets/cards/espada_mágica.png`,
  `assets/cards/paladino_crepuscular.png`).
- Python scripts/functions: `snake_case`, one script per standalone tool
  (see [patterns/python-card-asset-scripts.md](patterns/python-card-asset-scripts.md)).

## Global state & cross-file coupling
- One global mutable `gameState` object is the game model (see
  [patterns/game-state-management.md](patterns/game-state-management.md)).
  Don't introduce a second global state object.
- Cross-file APIs are exposed on `window` (`window.gameState`,
  `window.cardAbilities`, `window.findCardData`, `window.changeStat`,
  `window.updateUI`, `window.deckBuilder`, `window.cardsDatabase`) and
  always accessed through an existence guard: `if (window.X) { window.X.y() }`.

## Data
- `data/cards_database.json` is the single authoritative card dataset (110
  cards). Card schema:
  `{ name, type: 'criatura'|'suporte'|'evolução', cost, attack, defense, hability, id, image }`.
  See [patterns/deck-loading-and-card-data.md](patterns/deck-loading-and-card-data.md).

## UI/CSS
- Theming via `:root` CSS custom properties (`--primary-color`,
  `--energy-color`, `--pv-color`, `--border-radius`, ...). Card visual state
  is expressed as CSS classes toggled via `classList`, not inline styles.
  See [patterns/card-dom-rendering.md](patterns/card-dom-rendering.md).

## Don'ts
- Do NOT add a new global variable for game data — extend `gameState`
  instead (see game-state-management pattern).
- Do NOT duplicate `data/cards_database.json` into another hardcoded JS
  dataset. The only fallback is `getFallbackCardData()` in
  `src/js/deck_system.js`; fix or consolidate it instead of adding a copy.
- Do NOT wire a new debug/manual-test script into `game.html`'s `<script>`
  list — it already loads six dev/debug files
  (`tests/browser/test_features.js`, `tests/browser/test_tobinha.js`,
  `tests/browser/test_all_protections.js`,
  `test_attack_calculation.js`, `ability_audit.js`, `test_mago_arcano.js`,
  `ability_guide.js`) directly in the production
  page; this is legacy, not a pattern to extend.
- Do NOT add inline `style.cssText` blocks for new persistent UI state —
  use a CSS class and the existing `:root` variables.
- Do NOT bypass `modifyCardStats`/`showAbilityFeedback` in
  `src/js/card-abilities.js` when writing a new ability — direct DOM/state
  mutation from an ability method breaks the visual-feedback convention.
<!-- vibeflow:auto:end -->
