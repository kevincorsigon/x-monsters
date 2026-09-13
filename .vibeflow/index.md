# Project: X Monsters
> Analyzed: 2026-09-12
> Stack: Vanilla HTML5/CSS3/JavaScript (ES6, no build step, no framework) game client; standalone Python (OpenCV + pytesseract) scripts for offline card-asset/data tooling. Data: static JSON (`data/cards_database.json`) + local card image assets.
> Type: Single-page browser game (client-only, no backend) + auxiliary offline scripts
> Suggested budget: ≤ 4 files per task

## Structure
The root contains only the two HTML entry points, primary README,
requirements, and repository configuration. Runtime JavaScript lives in
`src/js/`, card and audio assets in `assets/`, data in `data/`, Python tools
in `scripts/`, browser diagnostics in `tests/browser/`, and secondary guides
in `docs/`. `game.html` remains the full game entry point with ordered script
includes and inline game logic; `index.html` is the independent PV/energy
counter.

## Structural Units
- **`game.html`** — main game: grid-based UI, `gameState`, phases
  (energy/invocation/combat), combat resolution, drag & drop, card
  rendering, initialization (`DOMContentLoaded` → `loadCardSystem` →
  `startNewMatch`).
- **`src/js/card-abilities.js`** — `CardAbilitiesSystem` class: switch-dispatched
  per-card ability triggers and effect bookkeeping (turn/permanent/one-shot).
- **`src/js/deck_system.js`** — `DeckBuilder` class, `loadCardSystem` (fetch +
  fallback), deck balancing, card drawing.
- **`data/cards_database.json`** — authoritative 110-card dataset.
- **`index.html`** — legacy standalone PV/Energy counter (no card system),
  simpler and independent of the files above.
- **Browser diagnostics loaded into `game.html`** — files under
  `tests/browser/`: `ability_guide.js`, `ability_audit.js`, `test_features.js`,
  `test_tobinha.js`, `test_all_protections.js`,
  `test_attack_calculation.js`, `test_mago_arcano.js`. Not automated tests
  (no test runner); console-driven manual scripts shipped in production.
- **`src/js/manual_abilities.js`** — runtime interface for manually activated
  card abilities.
- **Python asset/data scripts** — canonical copies under `scripts/`:
  `rename_card_images.py`,
  `smart_rename.py`, `rename_by_order.py`, `create_cards_front_back.py`,
  `create_cards_high_quality.py`, `create_card_back.py`,
  `card_printing_advanced.py`, `check_cards.py`, `final_check.py`,
  `analyze_json.py`. Independent, manually-run CLI-style tools.
- **`assets/cards/`** — 110 card image assets (`.png`) referenced by
  `data/cards_database.json`'s `image` field.

## Pattern Registry

<!-- vibeflow:patterns:start -->
patterns:
  - file: patterns/game-state-management.md
    tags: [state-management, game-loop, phases, dom-state]
    modules: [game.html]
  - file: patterns/combat-system.md
    tags: [combat, damage-calculation, game-rules, abilities-integration]
    modules: [game.html]
  - file: patterns/card-ability-system.md
    tags: [abilities, triggers, switch-dispatch, effects, card-game]
    modules: [src/js/card-abilities.js]
  - file: patterns/deck-loading-and-card-data.md
    tags: [data-loading, fallback, deck-building, json, card-schema]
    modules: [src/js/deck_system.js, data/cards_database.json]
  - file: patterns/card-dom-rendering.md
    tags: [dom-rendering, drag-and-drop, css-theming, ui-state]
    modules: [game.html]
  - file: patterns/python-card-asset-scripts.md
    tags: [python, ocr, image-processing, offline-tooling, cli]
    modules: [rename_card_images.py, smart_rename.py, rename_by_order.py, create_cards_front_back.py, create_cards_high_quality.py, create_card_back.py, card_printing_advanced.py, check_cards.py, final_check.py, analyze_json.py]
<!-- vibeflow:patterns:end -->

## Pattern Docs Available
- [patterns/game-state-management.md](patterns/game-state-management.md) — global `gameState` object, DOM-as-truth for PV/Energy, phase transitions.
- [patterns/combat-system.md](patterns/combat-system.md) — mutual damage calculation, destruction, penetrating damage, ability hook points.
- [patterns/card-ability-system.md](patterns/card-ability-system.md) — switch-dispatched per-card ability methods and effect bookkeeping (the most important pattern for adding new cards).
- [patterns/deck-loading-and-card-data.md](patterns/deck-loading-and-card-data.md) — card JSON schema, fetch+fallback loading, deck balancing algorithm.
- [patterns/card-dom-rendering.md](patterns/card-dom-rendering.md) — manual DOM card rendering, CSS-class-driven visual state, native drag & drop, `:root` theming.
- [patterns/python-card-asset-scripts.md](patterns/python-card-asset-scripts.md) — standalone OCR/image-processing/data-validation Python scripts.

## Key Files
- `game.html` — main game entry point; UI, state, phases, combat, rendering (~3900 lines).
- `src/js/card-abilities.js` — ability system for 110+ cards (~2400 lines).
- `src/js/deck_system.js` — deck building, card loading + fallback (~540 lines).
- `data/cards_database.json` — authoritative card data (110 cards).
- `index.html` — legacy standalone PV/Energy counter.
- `src/js/manual_abilities.js` — manual ability UI loaded by the game.
- `tests/browser/` — console-driven browser tests and diagnostics.
- `scripts/rename_card_images.py` / `scripts/smart_rename.py` — OCR-based card image renaming.
- `scripts/check_cards.py` / `scripts/final_check.py` — data/ability coverage cross-checks.
- `README.md` — project entry point; secondary guides live under `docs/`.

## Dependencies (critical only)
- **Google Fonts (Cinzel)** — loaded via CDN `<link>` in both HTML files; the app has an external network dependency for its font at runtime.
- **OpenCV (`cv2`) + `pytesseract` + Tesseract binary** — used only by the offline Python renaming scripts, not by the web app.
- No JS runtime dependencies (no npm packages) — everything is hand-written vanilla JS.

## Known Issues / Tech Debt
- `fetch('data/cards_database.json')` fails under `file://` and silently falls
  back to a 30-card sample; use the documented local HTTP server.
- Browser diagnostics under `tests/browser/` are still loaded directly by
  `game.html`; there is no automated browser test runner.
- `src/js/card-abilities.js` ability coverage can drift relative to
  `data/cards_database.json`; use the Python and browser audits after changes.
- No automated tests for either the JS game logic or the Python scripts; verification is manual/console-log based throughout.
