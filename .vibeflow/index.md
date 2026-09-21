# Project: X Monsters
> Analyzed: 2026-09-20
> Stack: Vanilla HTML5/CSS3/JavaScript (ES6, no build step, no framework) game client (hotseat + online PvP); `server.py` (Python 3 + `websockets`, rest stdlib) as hybrid static server + lobby API + WebSocket relay; Node `node:assert` unit tests; Node CLI for deterministic decks; standalone Python (OpenCV + pytesseract) scripts for offline card-asset/data tooling; Docker/Docker Compose packaging for the PvP server. Data: static JSON (`data/cards_database.json`) + local card image assets.
> Type: Browser game (hotseat, client-only) + PvP online mode with a thin Python relay (no card rules on the server) + auxiliary offline scripts
> Suggested budget: ≤ 4 files per task

## Structure
The root holds the HTML entry points (`game.html`, `index.html`, `pvp.html`,
`pvp-lobby.html`), the PvP server (`server.py`), Docker files, README,
requirements, and repository configuration. Runtime JavaScript lives in
`src/js/`, CSS in `src/css/`, card and audio assets in `assets/`, data in
`data/`, Python tools plus `deck_factory.js` in `scripts/`, browser
diagnostics in `tests/browser/`, the Node suite in `tests/unit/`, the PvP
smoke suite in `tests/pvp/`, and secondary guides in `docs/`. `game.html`
is now a shell (markup + scripts): the inline UI was extracted to
`src/js/game.js`. `pvp.html` (`/pvp/<roomId>/<seat>`) is the online board
and `pvp-lobby.html` (`/pvp`) creates rooms via `POST /api/matches`.
`matches/` is runtime-only (gitignored mirror of the rooms).

## Structural Units
- **`game.html`** — shell only: markup + ordered `<script>` tags (the hotseat
  UI was extracted to `src/js/game.js`); `pvp.html` is its online sibling.
- **`src/js/game.js`** — hotseat UI/rules glue: rendering from state, drag &
  drop, phases, combat calls, PvP guards (`pvpGuard`/`pvpAplicando`).
- **`src/js/game-state.js`** — `GameStateModel`: zones, instance ids,
  `resetMatchState`, canonical PV/energy, legacy aliases (`state.cards`).
- **`src/js/game-engine.js`** — `GameEngine`: actions, events, effects,
  modifiers, combat resolver, transactions.
- **`src/js/card-rules.js`** — registry of all card abilities (tables +
  `install()` handlers). Source of truth for rules.
- **`src/js/card-abilities.js`** — thin UI bridge (`attachEngine`,
  feedback toasts). No per-card logic.
- **`src/js/deck_system.js`** — `DeckBuilder` (injectable `rng`),
  `createMatchDecks`, `loadCardSystem`, `startNewMatch`.
- **`src/js/manual_abilities.js`** — panel for `ACTIVATED_RULES`; also the
  single applier of the PvP `ABILITY` command.
- **`src/js/pvp-protocol.js`** — command contract (`normalizeCommand`,
  `REQUIRED_ARGS`, reveals) + `stateHash` (FNV-1a).
- **`src/js/pvp-state.js`** — hidden zones (placeholders), reveals, opaque
  instance ids.
- **`src/js/pvp-session.js`** — headless lockstep session: seq order, dedupe,
  resync, dice feed, publisher of the hand count (`handSizeOf`,
  `publicarContagemDeMao`).
- **`src/js/pvp-game.js`** — PvP bootstrap: socket + seat, `MATCH_START`,
  command appliers, control blocking, end-of-match overlay.
- **`pvp.html` / `pvp-lobby.html`** — online board and lobby (o lobby traz o
  botão + modal "Regras do Jogo", conteúdo igual ao do `index.html`);
  **`src/css/pvp.css`** — PvP-only styles (`body[data-seat]`).
- **`server.py`** — statics + lobby API + WebSocket relay, per-room ledger,
  server-side RNG, `matches/<roomId>.json` mirror.
- **`data/cards_database.json`** — 110-card catalog.
- **`index.html`** — standalone PV/Energy counter (no engine).
- **`tests/unit/run-tests.js`** — Node regression suite (engine, rules, PvP
  protocol/session, PvP draw bridge).
- **`tests/pvp/smoke_match.py`** — network smoke test (server + 2 WS clients).
- **`tests/browser/`** — manual console diagnostics (not loaded in production);
  `run-browser-tests.js` drives them via CDP (`test_pvp_draw.js` cobre a regra
  "só o DRAW do ledger muda a mão", `test_field_card_size.js` trava o tamanho
  das cartas em campo, `test_pvp_game_over.js` o overlay de fim de partida e
  `test_pvp_lobby_rules.js` o modal de regras do lobby).
- **`scripts/`** — OCR, print sheets, `check_cards.py` coverage scan,
  `deck_factory.js` (seeded decks for PvP).
- **`assets/cards/`** — 110 card images referenced by JSON `image`.

## Pattern Registry

<!-- vibeflow:patterns:start -->
patterns:
  - file: patterns/automated-unit-tests.md
    tags: [testing, node, determinism, regression]
    modules: [tests/unit/, tests/pvp/, src/js/]
  - file: patterns/card-ability-system.md
    tags: [abilities, ui-bridge, feedback, integration]
    modules: [src/js/card-abilities.js]
  - file: patterns/card-dom-rendering.md
    tags: [dom-rendering, drag-and-drop, css-theming, ui-state]
    modules: [src/js/game.js, src/css/]
  - file: patterns/card-rules-registry.md
    tags: [abilities, card-rules, registry, events, traits]
    modules: [src/js/card-rules.js]
  - file: patterns/combat-system.md
    tags: [combat, damage-calculation, game-rules, engine]
    modules: [src/js/game-engine.js, src/js/card-rules.js, src/js/game.js]
  - file: patterns/deck-loading-and-card-data.md
    tags: [data-loading, fallback, deck-building, json, card-schema]
    modules: [src/js/deck_system.js, scripts/deck_factory.js, data/cards_database.json]
  - file: patterns/event-effect-engine.md
    tags: [game-engine, events, effects, combat, umd]
    modules: [src/js/game-engine.js, src/js/game-state.js]
  - file: patterns/game-state-management.md
    tags: [state-management, game-loop, phases, zones]
    modules: [src/js/game-state.js, src/js/game.js]
  - file: patterns/pvp-hidden-state.md
    tags: [pvp, hidden-state, placeholders, reveals, instance-ids, fog-of-war]
    modules: [src/js/pvp-state.js, src/js/game-state.js]
  - file: patterns/pvp-lockstep-protocol.md
    tags: [pvp, protocol, determinism, command-ledger, validation, state-hash]
    modules: [src/js/, server.py]
  - file: patterns/pvp-online-server.md
    tags: [pvp, server, websocket, rooms, docker, runtime-mirror]
    modules: [server.py, tests/pvp/, Dockerfile]
  - file: patterns/pvp-ui-command-bridge.md
    tags: [pvp, ui-hooks, guards, lockstep, seat-mirroring, command-bridge]
    modules: [src/js/game.js, src/js/pvp-game.js, src/css/]
  - file: patterns/python-card-asset-scripts.md
    tags: [python, ocr, image-processing, offline-tooling, cli]
    modules: [scripts/rename_card_images.py, scripts/smart_rename.py, scripts/rename_by_order.py, scripts/create_cards_front_back.py, scripts/create_cards_high_quality.py, scripts/create_card_back.py, scripts/card_printing_advanced.py, scripts/check_cards.py, scripts/final_check.py, scripts/analyze_json.py]
<!-- vibeflow:patterns:end -->

## Pattern Docs Available
- [patterns/event-effect-engine.md](patterns/event-effect-engine.md) — `GameEngine` actions/events/effects and UMD modules.
- [patterns/card-rules-registry.md](patterns/card-rules-registry.md) — how to add or change a card ability in `card-rules.js`.
- [patterns/game-state-management.md](patterns/game-state-management.md) — `GameStateModel`, zones, PV/energy, match mounting, phase UI.
- [patterns/combat-system.md](patterns/combat-system.md) — `resolveCombat` + `CardRules.validateAttackTarget` + UI handlers.
- [patterns/card-ability-system.md](patterns/card-ability-system.md) — leftover UI bridge (Fase 7); do not extend with per-card logic.
- [patterns/deck-loading-and-card-data.md](patterns/deck-loading-and-card-data.md) — JSON schema, fetch+fallback, seeded deck balancing.
- [patterns/card-dom-rendering.md](patterns/card-dom-rendering.md) — DOM cards, CSS-class state, native drag & drop, card backs.
- [patterns/pvp-lockstep-protocol.md](patterns/pvp-lockstep-protocol.md) — command contract, `seq` ledger, resync and `stateHash`.
- [patterns/pvp-hidden-state.md](patterns/pvp-hidden-state.md) — placeholders, reveals and opaque instance ids.
- [patterns/pvp-ui-command-bridge.md](patterns/pvp-ui-command-bridge.md) — `pvpGuard` hooks + command appliers + seat mirroring.
- [patterns/pvp-online-server.md](patterns/pvp-online-server.md) — `server.py` (HTTP + WS), rooms, ledger mirror, Docker.
- [patterns/automated-unit-tests.md](patterns/automated-unit-tests.md) — `node tests/unit/run-tests.js` + `py -3 tests/pvp/smoke_match.py`.
- [patterns/python-card-asset-scripts.md](patterns/python-card-asset-scripts.md) — OCR/print tools and coverage scan of `card-rules.js`.

## Key Files
- `src/js/game.js` — hotseat UI (rendering, DnD, phases, PvP guards) (~2400 lines).
- `src/js/card-rules.js` — all card rules (~2900 lines).
- `src/js/game-engine.js` — deterministic resolver (~1700 lines).
- `src/js/game-state.js` — canonical state model + `resetMatchState`.
- `src/js/pvp-session.js` / `pvp-state.js` / `pvp-protocol.js` — online core.
- `src/js/pvp-game.js` — PvP bootstrap and command appliers (~600 lines).
- `server.py` — HTTP + WebSocket server, rooms, ledger mirror (~875 lines).
- `src/js/deck_system.js` — fetch JSON + seeded balanced decks.
- `src/js/manual_abilities.js` — activated-ability panel (+ PvP ABILITY).
- `data/cards_database.json` — 110-card catalog. Toda criatura/evolução tem `traits`
  (única fonte de verdade; `elite` quando ATK > 50 e `humanoide` = bípede de corpo humano
  que empunha arma, 31 cartas — nunca junto de `dragao`/`robotico`/`aquatico`/`planta`/
  `fantasma`).
- `tests/unit/run-tests.js` — engine/rules/PvP regression tests (212 tests).
- `tests/pvp/smoke_match.py` — server + 2 WS clients smoke test (ledger só com
  as compras esperadas; F5 não soma comando).
- `tests/browser/test_pvp_draw.js` — regra da compra em PvP no DOM real +
  contador de mão vindo do websocket.
- `tests/browser/test_deck_count.js` — área de saque mostra as cartas restantes
  (rótulo dentro da caixa do deck, zero com alerta visual).
- `tests/browser/test_dice_roll.js` — pílula de energia com o dado na linha de
  baixo (centralizado sob `Energia: N`) e resultado sem quebrar o layout (face
  pelo ícone `assets/dice/dice-N.svg`, "já jogado" pelo `:disabled` do CSS, "+N"
  absoluto, reset do dado).
- `tests/browser/test_tlantidu_death.js` — morte do Tlantidu pelo combate real:
  a aquática do deck aparece na mão renderizada e o disclaimer nomeia a carta
  (ou avisa que não havia aquática no deck).
- `tests/browser/test_pvp_deck_count.js` — o mesmo contador em PvP: deck privado
  do dono e deck oculto do oponente encolhendo com o ledger.
- `tests/browser/test_field_card_size.js` — carta invocada entra no campo no
  tamanho do slot (regressão do `.card.selected` com `scale`).
- `tests/browser/test_pvp_game_over.js` — overlay de fim de partida visível,
  com o vencedor e o botão de volta ao lobby.
- `tests/browser/test_pvp_dice_state.js` — o dado da sorte é igual nas duas telas:
  "já usado" é `diceUsed` (repaint do bloqueio por turno não reabilita, clique
  inerte, replay idempotente, remount limpando o dado antes do ledger).
- `tests/browser/test_pvp_lobby_rules.js` — botão "Regras do Jogo" no lobby abre
  o modal (mesmas 5 seções do `index.html`), fecha no ×/fundo/Esc e o conteúdo
  cabe na viewport com rolagem interna (`LOBBY_CONSOLE_SCRIPTS` no runner).
- `scripts/deck_factory.js` — seeded deck CLI used by the server.
- `scripts/check_cards.py` — catalog vs `card-rules.js` mention scan.
- `game.html` / `pvp.html` / `pvp-lobby.html` — board shell, online board, lobby.
- `README.md` — how to run the HTTP server or the PvP server/Docker.

## Dependencies (critical only)
- **Google Fonts (Cinzel)** — CDN `<link>` in the HTML pages.
- **Node.js** — `tests/unit/run-tests.js` (`node:assert`), `scripts/deck_factory.js`
  and the Docker image base.
- **Python `websockets`** — the only external dependency of `server.py`
  (`py -3 -m pip install websockets`, or the image/`docker compose`).
- **Docker / Docker Compose (optional)** — packaging for the PvP server;
  `matches_data` volume persists `matches/`.
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
- `pvp.html` duplicates the board markup of `game.html`; they must be kept in
  sync by hand (no templating/build step).
- The PvP server validates seat/order/turn/phase only: command content
  (what a card does) is declared by the clients — anti-cheat is out of scope
  and the README warns against exposing it to the internet.
- Rooms are memory-only: restarting `server.py` (or the container) drops live
  matches; `matches/<roomId>.json` is an audit mirror, gitignored.
- `mulberry32` is implemented twice (`scripts/deck_factory.js` and the
  fallback inside `src/js/pvp-game.js`); a third copy would be a smell — the
  browser path should prefer `window.DeckFactory.mulberry32`.
- Leftovers in the working tree: `src/js/pvp-protocol.js_rollback`,
  `temp-test.js`, `fix_card.js`, `scripts/_p2a_tmp.py` … `_p2d_tmp.py` —
  candidates for removal in a dedicated cleanup task.
- The engine reports the winner as "Jogador 1"/"Jogador 2" while the protocol
  requires `p1`/`p2`; `sendGameOver` normalizes before sending, and any new
  `GAME_OVER` path must do the same.
