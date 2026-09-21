---
tags: [pvp, server, websocket, rooms, docker, runtime-mirror]
modules: [server.py, tests/pvp/, Dockerfile]
applies_to: [services, configs, commands]
confidence: inferred
---
# Pattern: PvP Online Server (HTTP + WebSocket on one port)

<!-- vibeflow:auto:start -->
## What
`server.py` replaces the static `http.server` for online play: one process
serves the game assets, the lobby API and the WebSocket relay. Rooms live in
memory with a `seq` ledger per match; the only randomness (dice, deck seed)
comes from the server, and every room is mirrored to `matches/<roomId>.json`
for auditing — never read back as a source of truth.

## Where
`server.py` (`Room`, `RoomRegistry`, `handle_http`, `handle_api`,
`process_request`, `handle_socket`, `handle_command`, `handle_dice_request`,
`generate_decks`), `pvp.html` / `pvp-lobby.html` (clients), `Dockerfile` +
`docker-compose.yml` (packaging), `tests/pvp/smoke_match.py` (end-to-end
check), `scripts/deck_factory.js` (deterministic deck CLI, called by the
server).

## The Pattern
A single HTTP entry point decides WebSocket vs static/API:

```python
async def process_request(connection, request):
    """Unico ponto de entrada HTTP: /ws vira WebSocket, o resto e estatico/API."""
    path_only = urlsplit(request.path).path
    if path_only == "/ws":
        return None  # deixa o websockets concluir o handshake
    return await handle_http(request.method, path_only, request.headers.get("Host"))
```

Static resolution is traversal-proof and never serves the runtime mirror:

```python
def resolve_static(path_only):
    relative = unquote(path_only).lstrip("/")
    parts = [p for p in relative.split("/") if p]
    if len(parts) >= 3 and parts[0] == "pvp" and ROOM_ID_RE.match(parts[1]):
        relative = "/".join(parts[2:])          # /pvp/<room>/src/css/... -> src/css/...
    candidate = (ROOT / relative).resolve()
    if candidate != ROOT and not str(candidate).startswith(str(ROOT) + os.sep):
        return None
    if candidate == MATCHES_DIR or str(candidate).startswith(str(MATCHES_DIR) + os.sep):
        return None                             # matches/ nunca e servido
    return candidate if candidate.is_file() else None
```

The lobby API creates and reports rooms; `POST /api/matches` returns the two
shareable links:

```python
room = REGISTRY.create()
await persist_room(room)
return json_response(
    {
        "roomId": room.room_id,
        "status": room.status,
        "seed": room.seed,
        "assentoInicial": room.current_player,
        "config": room.config,
        "links": links_for(room, host),
        "websocket": "/ws",
    },
    201, "Created",
)
```

Decks come from the Node CLI, and the server degrades gracefully without Node —
both clients then build the same deck from the same seed:

```python
def generate_decks(seed, size=DECK_SIZE):
    """Delega o embaralhamento ao `scripts/deck_factory.js`."""
    result = subprocess.run(
        ["node", str(script), f"--seed={seed}", f"--size={size}"],
        cwd=ROOT, capture_output=True, text=True, timeout=30, check=True, encoding="utf-8",
    )
    # OSError/SubprocessError -> log de aviso e None (o cliente gera pela seed)
```

`MATCH_START` is per-seat: the private deck of that seat plus the opponent's
count, never the opponent list:

```python
def match_start_payload(room, seat):
    """MATCH_START do assento: apenas o deck privado dele e a contagem do outro."""
    decks = room.decks or {}
    deck = decks.get(seat)
    opponent_size = len(decks.get(other_seat(seat)) or []) or DECK_SIZE
    return { "type": "MATCH_START", "roomId": room.room_id, "seat": seat, ... }
```

Sockets authenticate with `HELLO` (room + seat + optional reconnect token),
replay the ledger after a refresh, and tell the other side about disconnects:

```python
hello = await recv_json(connection, HELLO_TIMEOUT)
if not hello or hello.get("type") != "HELLO":
    await send_message(
        connection,
        {"type": "ERROR", "reason": "Handshake invalido: envie HELLO com sala e assento"},
    )
    await connection.close()
    return
rejection = room.claim(seat, token, connection)
# ...
if room.status == "playing" or room.started:
    await send_message(connection, match_start_payload(room, seat))
    await send_message(connection, command_log_payload(room, "reconexao"))
elif room.both_connected() and not room.started:
    await start_match(room)
```

The disk mirror is atomic and non-fatal:

```python
def write_ledger_sync(room_id, payload):
    """Escrita atomica (tmp + replace) para o JSON nunca ficar pela metade."""
    MATCHES_DIR.mkdir(parents=True, exist_ok=True)
    target = ledger_path(room_id)
    temp = target.with_name(f"{target.name}.tmp")
    temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temp.replace(target)
```

Rooms expire so memory does not grow forever, and the container persists only
the mirror in a named volume:

```python
ROOM_TTL_FINISHED = 30 * 60
ROOM_TTL_IDLE = 2 * 60 * 60
```

```yaml
# docker-compose.yml
volumes:
  - matches_data:/app/matches
```

## Rules
- The server never implements card rules: it validates seat, order, turn, phase
  and dice usage, and treats command content as declared by the clients
  (anti-cheat of content is out of scope and documented as such).
- Rooms are memory-only; `matches/<roomId>.json` is an audit mirror and is
  gitignored. Deleting it does not affect a live match.
- Any new HTTP route goes through `handle_http`/`handle_api`; any new WebSocket
  message type goes through `handle_client_message` (else the client gets a
  pt-BR `ERROR`).
- Static serving must always resolve inside `ROOT` and must never serve
  `matches/`; `ROOM_ID_RE` (`^[A-Za-z0-9_-]{4,32}$`) is the first barrier.
- Python code follows the repo style: pt-BR docstrings/logs with `[{time}]`
  prefix, `now_iso` instead of `datetime`, dataclasses for room state,
  `asyncio.to_thread` for blocking file work.
- Packaging: `Dockerfile` builds Node + Python 3 with only `websockets` as an
  external dependency and exposes 8000 with a `HEALTHCHECK`; the local path
  remains `py -3 -m pip install websockets` + `py -3 server.py`.

## Examples from this codebase
File: `server.py`
`Room.validate_command` / `apply_to_turn_state` (ledger as the order judge),
`handle_dice_request` (`random.randint(1, 6)` + ledger entry + broadcast),
`cleanup_loop` (TTL sweep every 5 min).

File: `tests/pvp/smoke_match.py`
Starts `server.py` on port 8099, opens two WebSocket clients, asserts
`ROOM_STATE`/`MATCH_START`, `END_TURN` replication, `DICE_RESULT` equality,
out-of-turn `REJECTED`, deck-identity isolation, `GAME_OVER` agreement and the
written `matches/<roomId>.json`. Run with `py -3 tests/pvp/smoke_match.py`.

File: `docker-compose.yml`
Service `x-monsters` with the `matches_data` volume and a healthcheck; the
README documents `docker compose up -d`, `logs -f`, `down -v` and running both
test suites inside the container.
<!-- vibeflow:auto:end -->

## Anti-patterns
- Reading `matches/<roomId>.json` as game state: it is a mirror for auditing.
  Live truth is the in-memory `Room`.
- Serving the project root without the path check (`ROOT` prefix + `matches/`
  exclusion) — a URL like `/../data/cards_database.json` must not resolve.
- Reimplementing deck balancing in Python "to avoid Node": that would create a
  second source of truth; the documented degradation is "client builds from the
  seed".
- Sending the opponent's deck list in `MATCH_START` — only the size travels.

