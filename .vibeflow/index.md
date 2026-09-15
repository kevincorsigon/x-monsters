# Project: X Monsters
> Analyzed: 2026-09-15
> Stack: Vanilla HTML5/CSS3/JavaScript (ES6, no build step, no framework) game client; Node `node:assert` unit tests for the engine; standalone Python (OpenCV + pytesseract) scripts for offline card-asset/data tooling. Data: static JSON (`data/cards_database.json`) + local card image assets.
> Type: Single-page browser game (client-only, no backend) + auxiliary offline scripts
> Suggested budget: ≤ 4 files per task

## Structure
The root contains only the two HTML entry points, primary README,
requirements, and repository configuration. Runtime JavaScript lives in
`src/js/`, card and audio assets in `assets/`, data in `data/`, Python tools
in `scripts/`, browser diagnostics in `tests/browser/`, headless engine tests
in `tests/unit/`, and secondary guides in `docs/`. `game.html` is the full
game entry point (ordered script includes + inline UI); `index.html` is the
independent PV/energy counter.

## Structural Units
- **`game.html`** — UI, drag & drop, phases, rendering; delegates rules to
  `window.gameEngine` / `window.CardRules`.
- **`src/js/game-state.js`** — `GameStateModel`: zones, instance ids,
  canonical PV/energy, legacy aliases (`state.cards`).
- **`src/js/game-engine.js`** — `GameEngine`: actions, events, effects,
  modifiers, combat resolver, transactions.
- **`src/js/card-rules.js`** — registry of all card abilities (tables +
  `install()` handlers). Source of truth for rules.
- **`src/js/card-abilities.js`** — thin UI bridge (`attachEngine`,
  feedback toasts). No per-card logic.
- **`src/js/deck_system.js`** — `DeckBuilder`, `loadCardSystem`,
  `startNewMatch` / draw via `GameStateModel`.
- **`src/js/manual_abilities.js`** — panel for `ACTIVATED_RULES`.
- **`data/cards_database.json`** — 110-card catalog.
- **`index.html`** — standalone PV/Energy counter (no engine).
- **`tests/unit/run-tests.js`** — Node regression suite for engine/rules.
- **`tests/browser/`** — manual console diagnostics (not loaded in production).
- **`scripts/`** — OCR, print sheets, `check_cards.py` coverage scan.
- **`assets/cards/`** — 110 card images referenced by JSON `image`.

## Pattern Registry

<!-- vibeflow:patterns:start -->
patterns:
  - file: patterns/event-effect-engine.md
    tags: [game-engine, events, effects, combat, umd]
    modules: [src/js/game-engine.js, src/js/game-state.js]
  - file: patterns/card-rules-registry.md
    tags: [abilities, card-rules, registry, events, traits]
    modules: [src/js/card-rules.js]
  - file: patterns/game-state-management.md
    tags: [state-management, game-loop, phases, zones]
    modules: [src/js/game-state.js, game.html]
  - file: patterns/combat-system.md
    tags: [combat, damage-calculation, game-rules, engine]
    modules: [src/js/game-engine.js, src/js/card-rules.js, game.html]
  - file: patterns/card-ability-system.md
    tags: [abilities, ui-bridge, feedback, integration]
    modules: [src/js/card-abilities.js]
  - file: patterns/deck-loading-and-card-data.md
    tags: [data-loading, fallback, deck-building, json, card-schema]
    modules: [src/js/deck_system.js, data/cards_database.json]
  - file: patterns/card-dom-rendering.md
    tags: [dom-rendering, drag-and-drop, css-theming, ui-state]
    modules: [game.html]
  - file: patterns/automated-unit-tests.md
    tags: [testing, node, determinism, regression]
    modules: [tests/unit/]
  - file: patterns/python-card-asset-scripts.md
    tags: [python, ocr, image-processing, offline-tooling, cli]
    modules: [scripts/rename_card_images.py, scripts/smart_rename.py, scripts/rename_by_order.py, scripts/create_cards_front_back.py, scripts/create_cards_high_quality.py, scripts/create_card_back.py, scripts/card_printing_advanced.py, scripts/check_cards.py, scripts/final_check.py, scripts/analyze_json.py]
<!-- vibeflow:patterns:end -->

## Pattern Docs Available
- [patterns/event-effect-engine.md](patterns/event-effect-engine.md) — `GameEngine` actions/events/effects and UMD modules.
- [patterns/card-rules-registry.md](patterns/card-rules-registry.md) — how to add or change a card ability in `card-rules.js`.
- [patterns/game-state-management.md](patterns/game-state-management.md) — `GameStateModel`, zones, PV/energy, phase UI.
- [patterns/combat-system.md](patterns/combat-system.md) — `resolveCombat` + `CardRules.validateAttackTarget`.
- [patterns/card-ability-system.md](patterns/card-ability-system.md) — leftover UI bridge (Fase 7); do not extend with per-card logic.
- [patterns/deck-loading-and-card-data.md](patterns/deck-loading-and-card-data.md) — JSON schema, fetch+fallback, deck balancing.
- [patterns/card-dom-rendering.md](patterns/card-dom-rendering.md) — DOM cards, CSS-class state, native drag & drop.
- [patterns/automated-unit-tests.md](patterns/automated-unit-tests.md) — `node tests/unit/run-tests.js` without a test framework.
- [patterns/python-card-asset-scripts.md](patterns/python-card-asset-scripts.md) — OCR/print tools and coverage scan of `card-rules.js`.

## Key Files
- `game.html` — UI entry; summons/combat/turns call the engine (~3700 lines).
- `src/js/card-rules.js` — all card rules (~2700 lines).
- `src/js/game-engine.js` — deterministic resolver (~1550 lines).
- `src/js/game-state.js` — canonical state model.
- `src/js/card-abilities.js` — UI feedback bridge (~100 lines).
- `src/js/deck_system.js` — fetch JSON + balanced decks.
- `src/js/manual_abilities.js` — activated-ability panel.
- `data/cards_database.json` — 110-card catalog.
- `tests/unit/run-tests.js` — engine/rules regression tests.
- `scripts/check_cards.py` — catalog vs `card-rules.js` mention scan.
- `index.html` — legacy PV/Energy counter.
- `README.md` — how to run the local HTTP server.

## Dependencies (critical only)
- **Google Fonts (Cinzel)** — CDN `<link>` in both HTML files.
- **Node.js** — only for `tests/unit/run-tests.js` (`node:assert`).
- **OpenCV (`cv2`) + `pytesseract` + Tesseract** — offline Python tools only.
- No npm packages.

## Known Issues / Tech Debt
- `fetch('data/cards_database.json')` fails under `file://` and silently
  falls back to a 30-card sample; use the documented local HTTP server.
- No automated tests for the Python scripts; verification is manual/console-log
  based.
- card_038's trait-based search is implemented in the engine but currently
  inert pending a catalog trait tag (`aquatico`) — see `.vibeflow/decisions.md`.
- card_090 (Bilugação Astral) has no rule yet; blocked on product question
  #13 ("intransponível") in the ability-engine spec.
- `CardRules.isMigrated()` undercounts handler-only cards; coverage is the
  text scan in `scripts/check_cards.py`.
- `index.html` still uses DOM-as-truth for PV/energy; it does not share
  `GameStateModel`.
- `showAbilityFeedback` and `manual_abilities.js` still build UI with
  `style.cssText` instead of CSS classes.
