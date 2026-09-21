---
tags: [pvp, protocol, determinism, command-ledger, validation, state-hash]
modules: [src/js/, server.py]
applies_to: [handlers, services, models]
confidence: inferred
---
# Pattern: PvP Lockstep Command Protocol

<!-- vibeflow:auto:start -->
## What
Online matches are lockstep: the UI never mutates state from local input.
Every play becomes a validated command that the server appends to a per-room
ledger with a monotonic `seq` and rebroadcasts to both sockets; each client
applies the same commands in the same order on top of the same
`GameStateModel`, and a FNV-1a hash of the public state projection detects
divergence.

## Where
`src/js/pvp-protocol.js` (command contract, reveals, `stateHash`),
`src/js/pvp-session.js` (send / order / dedupe / resync), `server.py`
(`Room.validate_command`, `Room.add_command`, relay + `COMMAND_LOG`).
Covered by `tests/unit/run-tests.js` (session/protocol cases) and
`tests/pvp/smoke_match.py` (two real WebSocket clients).

## The Pattern
The command set and its required args are one contract, mirrored on the server:

```javascript
// src/js/pvp-protocol.js
const TURN_COMMANDS = [
    'DRAW', 'SUMMON', 'EQUIP', 'ATTACK', 'DIRECT_ATTACK',
    'ABILITY', 'SET_PHASE', 'END_TURN', 'ROLL_DICE'
];
const ALL_COMMANDS = TURN_COMMANDS.concat(['CHOICE', 'DESTROY', 'SET_NAME']);

const REQUIRED_ARGS = {
    DRAW: [], ROLL_DICE: [], END_TURN: [],
    SUMMON: ['handSlot'], EQUIP: ['cardId', 'creatureId'],
    ATTACK: ['attackerId', 'targetId'], DIRECT_ATTACK: ['attackerId'],
    ABILITY: ['cardId'], CHOICE: ['choiceId', 'selection'],
    SET_PHASE: ['phase'], DESTROY: ['cardId'], SET_NAME: ['name']
};
```

`normalizeCommand` validates cmd → actor → args → reveals and throws a pt-BR
`Error` (surfaced to the UI as `REJECTED`/`INVALID`). The handler that owns the
action only asks the session to send it:

```javascript
// src/js/pvp-session.js
sendCommand(cmd, args = {}, options = {}) {
    const actor = options.actor || this.seat || this.state?.currentPlayer || 'p1';
    const command = {
        type: 'COMMAND', cmd, args,
        reveals: options.reveals || [], actor
    };
    this.transportSend(command);
    return command;
}
```

Remote commands apply strictly by `seq`: duplicates are ignored, gaps ask for
the whole log. The author also applies its own play through the broadcast — it
never applies locally on its own.

```javascript
handleRemoteCommand(entry) {
    const seq = Number(entry?.seq);
    if (!Number.isFinite(seq)) {
        this.onEvent({ type: 'INVALID', reason: 'COMMAND sem seq', cmd: entry?.cmd });
        return;
    }
    if (seq < this.nextSeq) return;                 // duplicada/antiga
    if (seq > this.nextSeq) {
        this.requestCommandLog(`gap: esperado ${this.nextSeq}, veio ${seq}`);
        return;
    }
    this.applyEntry(entry);
}

applyEntry(entry) {
    // ... normalizeCommand (revalida no cliente)
    this.applying = true;
    try {
        this.applyCommand(ordered);                 // injetado (headless)
    } finally {
        this.applying = false;
    }
    this.commandLog.push(ordered);
    this.lastSeq = Math.max(this.lastSeq, Number(ordered.seq));
    return true;
}
```

The server owns order and randomness; it validates seat/turn/phase declared in
the ledger and never reimplements card rules — except the hand count, which both
screens display:

```python
# server.py
HAND_DELTAS = {"DRAW": 1, "SUMMON": -1, "EQUIP": -1}   # o que o servidor sabe

entry["hand"] = self.apply_hand_size(actor, cmd)       # contagem apos o comando
```

```javascript
// src/js/pvp-session.js — o dono publica o que so o motor sabe
publicarContagemDeMao() {
    const hand = this.localHandSize();
    if (!Number.isFinite(hand) || hand === this.ultimaContagemPublicada) return false;
    this.ultimaContagemPublicada = hand;
    this.transportSend({ type: 'HAND_SIZE', hand });
    return true;
}
```

```javascript
// src/js/game.js — o contador exibido prefere o valor do websocket
const doServidor = pvpContagemDoServidor(player);
const local = gameState.cards[player]?.hand?.length ?? 0;
const count = Number.isFinite(doServidor) ? doServidor : local;
titleElement.setAttribute('data-count', String(count));
```

Validation of the declared order stays on the server:

```python
# server.py
def validate_command(self, seat, cmd, args):
    """Valida ordem/assento/fase declarados. Devolve motivo ou None."""
    if self.status == "finished":
        return "A partida ja terminou"
    if cmd not in ALL_COMMANDS:
        return f"Comando desconhecido: {cmd}"
    if self.pending_choice and cmd not in ("CHOICE", "DESTROY"):
        return "Existe uma escolha pendente: resolva a escolha antes de agir"
    if cmd in TURN_COMMANDS and seat != self.current_player:
        return "Nao e o seu turno"
    if cmd == "ROLL_DICE" and any(
        entry["actor"] == seat and entry["cmd"] == "ROLL_DICE" for entry in self.commands
    ):
        return "O dado da sorte ja foi usado nesta partida"
    return None
```

```python
entry = room.add_command(seat, cmd, args, reveals)   # seq = ++last_seq
await persist_room(room)
# `handSizes` viaja em todo comando aceito: o contador exibido nos dois clientes
# vem daqui, nao de uma recontagem local.
await broadcast(room, {"type": "COMMAND", **entry, "handSizes": dict(room.hand_sizes)})
```

Divergence detection hashes a fixed projection (no key-iteration dependence):

```javascript
function stateHash(state) {
    const parts = [];
    parts.push('t=' + (state.turn || 0));
    parts.push('p=' + (state.currentPlayer || '-'));
    parts.push('ph=' + (state.currentPhase || '-'));
    PLAYER_IDS.forEach(playerId => {
        const player = state.players && state.players[playerId];
        const zones = player && player.zones ? player.zones : {};
        parts.push(playerId + '=pv:' + (player?.pv || 0) + '|en:' + (player?.energy || 0) +
            '|mx:' + (player?.maxEnergy || 0) + '|deck:' + (zones.deck || []).length +
            '|hand:' + (zones.hand || []).length + '|field:' + (zones.field || []).length +
            '|eq:' + (zones.equipment || []).length + '|discard:' + (zones.discard || []).length);
    });
    parts.push('ci=' + Object.keys(state.cardInstances || {}).length);
    return fnv1a(parts.join('|'));
}
```

## Rules
- Adding a playable action means four edits: `ALL_COMMANDS`/`REQUIRED_ARGS` in
  `pvp-protocol.js`, the mirrored set in `server.py` (`TURN_COMMANDS` /
  `ALL_COMMANDS`, `validate_command`, `apply_to_turn_state`), the UI guard in
  `src/js/game.js`, and the applier in `src/js/pvp-game.js#applyCommand`.
- `seq` is always server-assigned. Clients never invent sequence numbers.
- Validation is intentionally duplicated: the client validates shape
  (`normalizeCommand`), the server validates order/seat/turn/phase. Never trust
  the client, and never move card rules into `server.py`.
- Messages and error reasons are in pt-BR, like every other user-facing string.
- `DICE_RESULT` carries the ledger `seq` so the dice enters the same ordering as
  any other command; the client never rolls locally in PvP.
- The hand count displayed by the UI is also a websocket value, not a local
  recount: the server keeps `hand_sizes` (its own deltas for `DRAW`/`SUMMON`/
  `EQUIP`, plus whatever the owner publishes with `HAND_SIZE`) and ships it as
  `handSizes` on every accepted `COMMAND`, on `COMMAND_LOG`, on `HAND_SIZES`
  and as `state.maos` on `MATCH_START`/`ROOM_STATE`. `game.js
  updateHandCounter` prefers `handSizeOf(player)`; the local recount is only the
  non-PvP fallback. Never infer the opponent count from the DOM.
- Hash mismatch requests a replay (`COMMAND_LOG_REQUEST`) instead of patching
  state silently; the session emits `SYNCED`, `REJECTED`, `DIVERGENCE` and
  `APPLY_ERROR` events for the UI.

## Examples from this codebase
File: `src/js/pvp-protocol.js`
`normalizeCommand` (cmd → actor → args → reveals → `requireReveal` →
`assertRevealsMatchPlaceholders`) and `stateHash` projection.

File: `src/js/pvp-session.js`
`handleCommandLog` — sorts by `seq`, skips what is already applied, then emits
`{ type: 'SYNCED', lastSeq }`.

File: `server.py`
`handle_command` (reject → `add_command` → `persist_room` → `broadcast`) and
`handle_dice_request` (`random.randint(1, 6)` recorded in the ledger).

File: `server.py`
`handle_hand_size` — the owner's own count (`HAND_SIZE`) is stored in
`Room.hand_sizes` and rebroadcast as `HAND_SIZES`; `apply_hand_size` covers the
commands the server can count alone (`DRAW`/`SUMMON`/`EQUIP`).
<!-- vibeflow:auto:end -->

## Anti-patterns
- Applying a local action before the broadcast, or calling the engine directly
  from a click handler in PvP — the author's own play must arrive through the
  ledger, otherwise the two clients drift.
- Reusing `Math.random()` for anything both clients must agree on (deck
  shuffle, dice). Randomness is a server concern (seed + `DICE_RESULT`).
- Reimplementing `stateHash` elsewhere (in `server.py` or a second JS module) —
  one projection, one hash, one owner.
