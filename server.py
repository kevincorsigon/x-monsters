"""Servidor PvP Online do X Monsters (spec: pvp-online-websocket-part-1).

Papel deste processo:
- servir os arquivos estaticos do jogo (mesma porta do WebSocket);
- criar e gerenciar salas de partida com dois assentos (p1/p2);
- ordenar os comandos das jogadas em tempo real, com um ledger por sala
  (seq monotonica) que e a unica fonte de ordem entre os dois navegadores;
- ser a autoridade de aleatoriedade (dado da sorte; o seed dos decks e
  consumido pelas partes 2/3);
- espelhar cada sala em matches/<roomId>.json (auditoria, nao fonte de verdade).

O servidor NAO conhece as regras das 110 cartas: ele nao reimplementa
card-rules.js. Por isso valida assento, ordem, turno e fase declarados no
ledger, e nao o conteudo da acao - anti-cheat de conteudo esta fora do escopo.

Uso:
    py -3 server.py [--host 127.0.0.1] [--port 8000]
"""

import argparse
import asyncio
import json
import mimetypes
import os
import random
import re
import secrets
import time
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import unquote, urlsplit

from websockets.asyncio.server import serve
from websockets.http11 import Headers, Response

ROOT = Path(__file__).resolve().parent
MATCHES_DIR = ROOT / "matches"

# O roomId sempre nasce em token_hex(4); a regex e a barreira contra path
# traversal vindo da URL antes de resolver qualquer arquivo.
ROOM_ID_RE = re.compile(r"^[A-Za-z0-9_-]{4,32}$")

SEATS = ("p1", "p2")
PHASES = ("energy", "invocation", "combat")

# Comandos que exigem ser o turno do assento. CHOICE e DESTROY herdam o turno
# de quem abriu a acao, por isso ficam de fora desta lista.
TURN_COMMANDS = {
    "DRAW",
    "SUMMON",
    "EQUIP",
    "ATTACK",
    "DIRECT_ATTACK",
    "ABILITY",
    "SET_PHASE",
    "END_TURN",
    "ROLL_DICE",
}
ALL_COMMANDS = TURN_COMMANDS | {"CHOICE", "DESTROY", "SET_NAME"}

# TTLs de limpeza de sala (spec parte 5 item 6): partida finalizada ou sala
# abandonada nao podem crescer em memoria para sempre.
ROOM_TTL_FINISHED = 30 * 60
ROOM_TTL_IDLE = 2 * 60 * 60

DEFAULT_CONFIG = {"initialPv": 200, "initialEnergy": 6}

HELLO_TIMEOUT = 15.0

JSON_CONTENT_TYPE = "application/json; charset=utf-8"


def log(message):
    """Log em pt-BR, com horario, no estilo dos demais scripts do projeto."""
    print(f"[{time.strftime('%H:%M:%S')}] {message}", flush=True)


def now_iso(timestamp=None):
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(timestamp or time.time()))


def other_seat(seat):
    return "p2" if seat == "p1" else "p1"


def http_response(status, reason, body=b"", content_type="text/plain; charset=utf-8"):
    """Resposta HTTP para rotas nao-WebSocket, servidas na mesma porta."""
    headers = Headers(
        [
            ("Content-Type", content_type),
            ("Content-Length", str(len(body))),
            ("Cache-Control", "no-store"),
            ("Connection", "close"),
        ]
    )
    return Response(status, reason, headers, body)


def json_response(payload, status=200, reason="OK"):
    body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
    return http_response(status, reason, body, JSON_CONTENT_TYPE)


@dataclass
class Seat:
    """Um dos dois assentos da sala.

    `token` identifica a reconexao do mesmo navegador (parte 5) e nao e
    credencial de seguranca - o anti-scope da spec exclui roubo de assento.
    """

    token: str | None = None
    connection: object | None = None

    @property
    def connected(self):
        return self.connection is not None


@dataclass
class Room:
    room_id: str
    created_at: float
    updated_at: float
    seed: int
    config: dict
    seats: dict = field(default_factory=lambda: {seat: Seat() for seat in SEATS})
    status: str = "waiting"
    started: bool = False
    last_seq: int = 0
    commands: list = field(default_factory=list)
    result: dict | None = None
    current_player: str = "p1"
    phase: str = "energy"
    turn: int = 1
    pending_choice: bool = False

    def connected_seats(self):
        return [seat for seat in SEATS if self.seats[seat].connected]

    def both_connected(self):
        return len(self.connected_seats()) == 2

    def public_state(self):
        """Estado da sala que pode trafegar e virar JSON (nenhum segredo)."""
        return {
            "roomId": self.room_id,
            "status": self.status,
            "createdAt": now_iso(self.created_at),
            "updatedAt": now_iso(self.updated_at),
            "turno": self.turn,
            "jogadorAtual": self.current_player,
            "fase": self.phase,
            "escolhaPendente": self.pending_choice,
            "assentos": {
                seat: {
                    "conectado": self.seats[seat].connected,
                    "reservado": self.seats[seat].token is not None,
                }
                for seat in SEATS
            },
            "resultado": self.result,
        }

    def ledger_dict(self):
        """Espelho completo em disco: metadata + ledger de comandos."""
        return {
            **self.public_state(),
            "seed": self.seed,
            "config": self.config,
            "commands": list(self.commands),
        }

    def claim(self, seat, token, connection):
        """Tenta ocupar um assento. Devolve None em caso de sucesso."""
        target = self.seats[seat]
        if target.connected:
            return f"Assento {seat} ja esta ocupado nesta partida"
        if target.token is not None and token != target.token:
            return (
                f"Assento {seat} esta reservado para outra sessao; "
                "reabra o mesmo link no navegador original"
            )
        if token:
            target.token = token
        elif target.token is None:
            target.token = secrets.token_hex(8)
        target.connection = connection
        return None

    def release(self, seat, connection):
        target = self.seats[seat]
        if target.connection is connection:
            target.connection = None
            self.updated_at = time.time()

    def add_command(self, actor, cmd, args, reveals):
        self.last_seq += 1
        entry = {
            "seq": self.last_seq,
            "actor": actor,
            "cmd": cmd,
            "args": args,
            "reveals": reveals,
            "at": now_iso(),
        }
        self.commands.append(entry)
        self.updated_at = time.time()
        self.apply_to_turn_state(actor, cmd, args)
        return entry

    def apply_to_turn_state(self, actor, cmd, args):
        """Mantem turno/fase declarados no ledger (unico juiz de ordem)."""
        if cmd == "SET_PHASE":
            phase = args.get("phase")
            if phase in PHASES:
                self.phase = phase
        elif cmd == "END_TURN":
            self.current_player = other_seat(actor)
            self.turn += 1
            self.phase = "energy"
        if args.get("setsChoice"):
            self.pending_choice = True
        if cmd == "CHOICE":
            self.pending_choice = False

    def validate_command(self, seat, cmd, args):
        """Valida ordem/assento/fase declarados. Devolve motivo ou None."""
        if self.status == "finished":
            return "A partida ja terminou"
        if cmd not in ALL_COMMANDS:
            return f"Comando desconhecido: {cmd}"
        if not isinstance(args, dict):
            return "Argumentos do comando invalidos"
        if self.pending_choice and cmd != "CHOICE":
            return "Existe uma escolha pendente: resolva a escolha antes de agir"
        if cmd == "CHOICE":
            if not self.pending_choice:
                return "Nenhuma escolha pendente"
            return None
        if cmd in TURN_COMMANDS and seat != self.current_player:
            return "Nao e o seu turno"
        if cmd == "SET_PHASE" and args.get("phase") not in PHASES:
            return "Fase invalida"
class RoomRegistry:
    """Salas vivas em memoria. Reiniciar o servidor descarta tudo, por design."""

    def __init__(self):
        self.rooms = {}

    def create(self, config=None):
        room_id = secrets.token_hex(4)
        while room_id in self.rooms:
            room_id = secrets.token_hex(4)
        room = Room(
            room_id=room_id,
            created_at=time.time(),
            updated_at=time.time(),
            seed=secrets.randbits(32),
            config={**DEFAULT_CONFIG, **(config or {})},
        )
        self.rooms[room_id] = room
        return room

    def get(self, room_id):
        return self.rooms.get(room_id)

    def cleanup(self):
        """Remove salas ociosas ou finalizadas (spec parte 5, item 6)."""
        current = time.time()
        removed = []
        for room_id, room in list(self.rooms.items()):
            ttl = ROOM_TTL_FINISHED if room.status == "finished" else ROOM_TTL_IDLE
            if current - room.updated_at > ttl and not room.connected_seats():
                del self.rooms[room_id]
                removed.append(room_id)
        return removed


REGISTRY = RoomRegistry()


def ledger_path(room_id):
    """Caminho do espelho da sala, sempre dentro de matches/."""
    return MATCHES_DIR / f"{room_id}.json"


def write_ledger_sync(room_id, payload):
    """Escrita atomica (tmp + replace) para o JSON nunca ficar pela metade."""
    MATCHES_DIR.mkdir(parents=True, exist_ok=True)
    target = ledger_path(room_id)
    temp = target.with_name(f"{target.name}.tmp")
    temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temp.replace(target)


async def persist_room(room):
    """Grava o espelho da sala sem derrubar o servidor por falha de disco."""
    try:
        await asyncio.to_thread(write_ledger_sync, room.room_id, room.ledger_dict())
    except OSError as error:
        log(f"[aviso] nao foi possivel gravar matches/{room.room_id}.json: {error}")


def content_type_for(path):
    guessed, _ = mimetypes.guess_type(path.name)
    if guessed is None:
        return "application/octet-stream"
    if guessed.startswith("text/") or guessed in (
        "application/javascript",
        "application/json",
    ):
        return f"{guessed}; charset=utf-8"
    return guessed


def resolve_static(path_only):
    """Resolve um caminho estatico dentro da raiz do projeto.

    Devolve None para traversal, caminho inexistente ou qualquer coisa dentro de
    matches/ - o espelho das partidas nunca e servido por HTTP.
    """
    relative = unquote(path_only).lstrip("/")
    if not relative:
        relative = "index.html"
    candidate = (ROOT / relative).resolve()
    if candidate != ROOT and not str(candidate).startswith(str(ROOT) + os.sep):
        return None
    if candidate.is_dir():
        candidate = candidate / "index.html"
    if candidate == MATCHES_DIR or str(candidate).startswith(str(MATCHES_DIR) + os.sep):
        return None
    if not candidate.is_file():
        return None
    return candidate


PAGE_ROUTES = {"/pvp": "pvp-lobby.html", "/pvp/": "pvp-lobby.html"}


def resolve_page(path_only):
    """Mapeia as rotas de pagina do PvP para o arquivo que as serve."""
    if path_only in ("", "/"):
        return ROOT / "index.html"
    if path_only in PAGE_ROUTES:
        return ROOT / PAGE_ROUTES[path_only]
    parts = [part for part in path_only.split("/") if part]
    if len(parts) >= 2 and parts[0] == "pvp" and ROOM_ID_RE.match(parts[1]):
        if len(parts) == 2:
            return ROOT / "pvp.html"
        if len(parts) == 3 and parts[2] in SEATS:
            return ROOT / "pvp.html"
    return None


def links_for(room, host):
    """Links compartilhaveis da sala (absolutos quando o Host e conhecido)."""
    base = f"http://{host}" if host else ""
    return {
        "lobby": f"{base}/pvp",
        "p1": f"{base}/pvp/{room.room_id}/p1",
        "p2": f"{base}/pvp/{room.room_id}/p2",
    }


async def handle_api(method, path_only, host):
    """API HTTP minima do lobby: criar sala e consultar status."""
    if path_only == "/api/matches":
        if method != "POST":
            return http_response(405, "Method Not Allowed", b"Use POST para criar uma partida")
        room = REGISTRY.create()
        await persist_room(room)
        log(f"[sala] {room.room_id} criada (seed {room.seed})")
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
            201,
            "Created",
        )

    match = re.match(r"^/api/matches/([A-Za-z0-9_-]{4,32})$", path_only)
    if match:
        if method != "GET":
            return http_response(405, "Method Not Allowed", b"Use GET para consultar a partida")
        room = REGISTRY.get(match.group(1))
        if room is None:
            return json_response({"erro": "Sala nao encontrada"}, 404, "Not Found")
        return json_response(
            {
                **room.public_state(),
                "links": links_for(room, host),
                "totalComandos": len(room.commands),
            }
        )

    return json_response({"erro": "Rota de API desconhecida"}, 404, "Not Found")


async def handle_http(method, path_only, host):
    """Serve uma requisicao HTTP nao-WebSocket na mesma porta do relay."""
    if path_only.startswith("/api/"):
        return await handle_api(method, path_only, host)
    if method != "GET":
        return http_response(405, "Method Not Allowed", b"Metodo nao suportado")
    target = resolve_page(path_only) or resolve_static(path_only)
    if target is None or not target.is_file():
        return http_response(404, "Not Found", b"Arquivo nao encontrado")
    try:
        body = await asyncio.to_thread(target.read_bytes)
    except OSError as error:
        return http_response(
            500, "Internal Server Error", f"Falha ao ler o arquivo: {error}".encode("utf-8")
        )
    return http_response(200, "OK", body, content_type_for(target))


async def process_request(connection, request):
    """Unico ponto de entrada HTTP: /ws vira WebSocket, o resto e estatico/API."""
    path_only = urlsplit(request.path).path
    if path_only == "/ws":
        return None  # deixa o websockets concluir o handshake
    return await handle_http(request.method, path_only, request.headers.get("Host"))


async def send_message(connection, payload):
    """Envia um objeto JSON; devolve False se a conexao caiu no meio."""
    try:
        await connection.send(json.dumps(payload, ensure_ascii=False))
        return True
    except Exception as error:  # noqa: BLE001 - conexao morta nao pode derrubar a sala
        log(f"[aviso] falha ao enviar {payload.get('type')}: {error}")
        return False


async def broadcast(room, payload):
    """Replica uma mensagem para todos os assentos conectados."""
    for seat in SEATS:
        connection = room.seats[seat].connection
        if connection is not None:
            await send_message(connection, payload)


async def recv_json(connection, timeout=None):
    """Le uma mensagem JSON; None em timeout, queda ou JSON invalido."""
    try:
        if timeout is None:
            raw = await connection.recv()
        else:
            raw = await asyncio.wait_for(connection.recv(), timeout=timeout)
    except Exception:  # noqa: BLE001 - handshake/queda tratados pelo chamador
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


async def handle_dice_request(room, seat, connection):
    """RNG do servidor: o dado e o mesmo para os dois navegadores."""
    reason = room.validate_command(seat, "ROLL_DICE", {})
    if reason:
        await send_message(connection, {"type": "REJECTED", "cmd": "ROLL_DICE", "reason": reason})
        return
    value = random.randint(1, 6)
    entry = room.add_command(seat, "ROLL_DICE", {"value": value, "custo": 2}, [])
    await persist_room(room)
    # O ledger guarda ROLL_DICE; no fio sai DICE_RESULT para a UI reagir na hora.
    await broadcast(room, {"type": "COMMAND", **entry})
    await broadcast(room, {"type": "DICE_RESULT", "seq": entry["seq"], "actor": seat, "value": value})
    log(f"[dado] {room.room_id} {seat} tirou {value}")


async def handle_command(connection, room, seat, message):
    """Valida no ledger, grava no espelho e replica para os dois assentos."""
    cmd = message.get("cmd")
    args = message.get("args") or {}
    reveals = message.get("reveals") or []
    reason = room.validate_command(seat, cmd, args)
    if reason:
        await send_message(connection, {"type": "REJECTED", "cmd": cmd, "reason": reason})
        log(f"[rejeitado] {room.room_id} {seat} {cmd}: {reason}")
        return
    entry = room.add_command(seat, cmd, args, reveals)
    await persist_room(room)
    await broadcast(room, {"type": "COMMAND", **entry})
    client_hash = message.get("hash")
    if client_hash:
        await broadcast(
            room,
            {"type": "STATE_HASH", "seq": entry["seq"], "actor": seat, "hash": client_hash},
        )
    log(f"[comando] {room.room_id} #{entry['seq']} {seat} {cmd}")


async def handle_client_message(connection, room, seat, message):
    """Roteia uma mensagem ja desserializada do cliente."""
    kind = message.get("type")
    if kind == "COMMAND":
        await handle_command(connection, room, seat, message)
    elif kind == "DICE_REQUEST":
        await handle_dice_request(room, seat, connection)
    elif kind == "PING":
        await send_message(connection, {"type": "PONG", "at": now_iso()})
    else:
        await send_message(
            connection, {"type": "ERROR", "reason": f"Mensagem desconhecida: {kind}"}
        )


async def handle_socket(connection):
    """Ciclo de vida do socket: HELLO -> assento -> comandos -> liberacao."""
    hello = await recv_json(connection, HELLO_TIMEOUT)
    if not hello or hello.get("type") != "HELLO":
        await send_message(
            connection,
            {"type": "ERROR", "reason": "Handshake invalido: envie HELLO com sala e assento"},
        )
        await connection.close()
        return

    room_id = str(hello.get("room") or "")
    seat = hello.get("seat")
    token = hello.get("token")

    if not ROOM_ID_RE.match(room_id):
        await send_message(connection, {"type": "ERROR", "reason": "Identificador de sala invalido"})
        await connection.close()
        return
    room = REGISTRY.get(room_id)
    if room is None:
        await send_message(
            connection,
            {
                "type": "ERROR",
                "reason": f"Sala nao encontrada: {room_id} (crie uma partida em /pvp)",
            },
        )
        await connection.close()
        return
    if seat not in SEATS:
        await send_message(connection, {"type": "ERROR", "reason": f"Assento invalido: {seat}"})
        await connection.close()
        return
    rejection = room.claim(seat, token, connection)
    if rejection:
        await send_message(connection, {"type": "ERROR", "reason": rejection})
        await connection.close()
        return

    room.updated_at = time.time()
    log(f"[sala] {room_id}: assento {seat} conectado")
    await send_message(
        connection,
        {
            "type": "ROOM_STATE",
            "seuAssento": seat,
            "token": room.seats[seat].token,
            "state": room.public_state(),
        },
    )
    await broadcast(room, {"type": "ROOM_STATE", "state": room.public_state()})

    if room.both_connected() and not room.started:
        room.started = True
        room.status = "playing"
        room.updated_at = time.time()
        await persist_room(room)
        for target_seat in SEATS:
            target = room.seats[target_seat].connection
            if target is None:
                continue
            await send_message(
                target,
                {
                    "type": "MATCH_START",
                    "roomId": room.room_id,
                    "seat": target_seat,
                    "opponentSeat": other_seat(target_seat),
                    "assentoInicial": room.current_player,
                    "config": room.config,
                    "seed": room.seed,
                    "state": room.public_state(),
                },
            )
        log(f"[partida] {room_id} iniciada com os dois assentos conectados")

    try:
        async for raw in connection:
            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                await send_message(connection, {"type": "ERROR", "reason": "Mensagem JSON invalida"})
                continue
            await handle_client_message(connection, room, seat, message)
    except Exception as error:  # noqa: BLE001 - queda do socket nao derruba a sala
        log(f"[aviso] conexao encerrada ({seat}/{room_id}): {error}")
    finally:
        room.release(seat, connection)
        room.updated_at = time.time()
        await broadcast(
            room,
            {"type": "OPPONENT", "seat": seat, "conectado": False, "state": room.public_state()},
        )
        log(f"[sala] {room_id}: assento {seat} desconectado")


async def cleanup_loop():
    """Limpeza periodica das salas ociosas/finalizadas."""
    while True:
        await asyncio.sleep(300)
        removed = REGISTRY.cleanup()
        if removed:
            log(f"[limpeza] salas removidas da memoria: {', '.join(removed)}")


async def main_async(host, port):
    async with serve(
        handle_socket,
        host,
        port,
        process_request=process_request,
        max_size=256 * 1024,
    ):
        log(f"X Monsters PvP no ar em http://{host}:{port}/pvp (estaticos + WebSocket /ws)")
        log(f"Espelho das partidas em {MATCHES_DIR}")
        await cleanup_loop()


def main():
    parser = argparse.ArgumentParser(description="Servidor PvP Online do X Monsters")
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="interface de escuta (use 0.0.0.0 para jogar com outra pessoa na rede local)",
    )
    parser.add_argument("--port", type=int, default=8000, help="porta (padrao 8000)")
    args = parser.parse_args()
    try:
        asyncio.run(main_async(args.host, args.port))
    except KeyboardInterrupt:
        log("Servidor encerrado pelo usuario.")


if __name__ == "__main__":
    main()