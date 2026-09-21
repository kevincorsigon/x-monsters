# Conventions

<!-- vibeflow:auto:start -->
## Language & locale
- All UI text, code comments, `console.log` messages, card names, and
  ability text are in **Portuguese (pt-br)**. Match this for any new
  user-facing string or comment. (via AGENTS.md / project locale)
- `<html lang="pt-br">` in every page (`game.html`, `index.html`,
  `pvp.html`, `pvp-lobby.html`).

## No build system
- No `package.json`, no bundler, no transpiler, no TypeScript. Plain ES6
  loaded via `<script src="...">` at the end of `<body>`, in this order:
  `src/js/game-state.js` → `game-engine.js` → `card-rules.js` →
  `card-abilities.js` → `deck_system.js` → `manual_abilities.js` →
  `game.js`. `pvp.html` appends the PvP layer after it:
  `pvp-protocol.js` → `pvp-state.js` → `pvp-session.js` → `pvp-game.js`.
  New runtime JS must be inserted in that list so dependents load after
  their dependencies (`game.html` keeps only markup + scripts).
- Engine files use a UMD IIFE (`module.exports` + `window.*`) so
  `tests/unit/run-tests.js` can `require()` the same sources.
- Run the web app through `py -3 -m http.server 8000`; direct `file://`
  loading cannot fetch the authoritative card database. For PvP online the
  same port is served by `py -3 server.py` (statics + `/api` + `/ws`) or by
  `docker compose up -d`.
- Tests: `node tests/unit/run-tests.js` (no extra packages) and
  `py -3 tests/pvp/smoke_match.py` for the network layer. Coverage CLI:
  `py -3 scripts/check_cards.py`. Deterministic decks:
  `node scripts/deck_factory.js --seed=123 --size=50`.

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

## PvP online (lockstep)
- Two entry layers: `game.html` is hotseat and never defines
  `window.PvpSession`; `pvp.html` is the online board and loads the PvP
  scripts after the runtime ones (`pvp-protocol.js` → `pvp-state.js` →
  `pvp-session.js` → `pvp-game.js`).
- Every playable action is a command: add it to `ALL_COMMANDS` /
  `REQUIRED_ARGS` (`src/js/pvp-protocol.js`), mirror it in `server.py`
  (`TURN_COMMANDS`, `validate_command`, `apply_to_turn_state`), guard the UI
  handler in `src/js/game.js` with `pvpGuard({ cmd, args, reveals })` and add
  the applier to `pvp-game.js#applyCommand`.
- The UI never mutates in PvP: `intercept` sends the command and the handler
  returns; the author applies its own play when the broadcast arrives.
- Sequencing is the server's job (`seq` monotônica por sala); the client
  applies by `seq`, ignores duplicates, asks for `COMMAND_LOG` on gap/hash
  divergence and never patches state silently.
- Randomness belongs to the server: dice via `DICE_RESULT`, deck via seed +
  `mulberry32`. Never `Math.random()` where both clients must agree.
- Opponent zones are placeholders (`definitionId: null`) and identity only
  travels inside a reveal (`.vibeflow/patterns/pvp-hidden-state.md`).
- New PvP CSS goes to `src/css/pvp.css` with `body[data-seat]` selectors;
  never edit `game.css` for perspective changes.
- Rules stay out of the server and out of the PvP layer: the engine
  (`game-engine.js` / `card-rules.js`) remains mode-agnostic.

## Python server (`server.py`)
- One process serves statics + `/api/*` + WebSocket `/ws` on the same port;
  any new route goes through `handle_http` / `handle_api`, any new message
  type through `handle_client_message`.
- Rooms live in memory (`Room` dataclass, TTL sweep); `matches/<roomId>.json`
  is an atomic audit mirror, gitignored and never a source of truth.
- Static resolution must stay inside `ROOT` and never serve `matches/`.
- Logs and error reasons in pt-BR with `[{time}]` prefix (`log()`), timestamps
  from `now_iso()`, blocking file work via `asyncio.to_thread`.
- Only external dependency: `websockets` (`py -3 -m pip install websockets`,
  or the Docker image / `docker compose up -d`).

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
- Do NOT mutate game state straight from a click handler in PvP — go
  through `PvpSession.intercept` and the ledger order.
- Do NOT send card identity for hidden zones; only reveals travel with the
  command that moves the card.
- Do NOT reimplement card rules, deck balancing or `stateHash` on the
  server (`server.py` validates order/seat/turn/phase only).
- Do NOT use `Math.random()` for dice or deck shuffle in PvP.
- Do NOT add PvP branches inside `card-rules.js` / `game-engine.js`.
- Do NOT serve `matches/` or anything outside `ROOT` from `server.py`.
- Do NOT commit `matches/<roomId>.json` (runtime mirror, gitignored).
<!-- vibeflow:auto:end -->
