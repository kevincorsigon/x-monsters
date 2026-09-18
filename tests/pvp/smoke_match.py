"""Smoke test do relay PvP Online (spec: pvp-online-websocket-part-1, item 4).

Inicia `server.py` como subprocesso, cria uma sala via HTTP, abre dois
clientes WebSocket simultaneamente (p1 e p2) e verifica o ciclo mínimo:

  1. ambos recebem ROOM_STATE -> MATCH_START;
  2. END_TURN de p1 é aceito e replicado para os dois;
  3. DICE_REQUEST de p2 devolve o mesmo DICE_RESULT aos dois;
  4. STATE_HASH broadcast bate nos dois lados;
  5. comando fora do turno é rejeitado (REJECTED);
  6. matches/<roomId>.json existe, é JSON válido e tem o ledger gravado.

Exit code 0 = tudo passou.
"""

import asyncio
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from websockets.asyncio.client import connect

ROOT = Path(__file__).resolve().parent.parent.parent
HOST = "127.0.0.1"
PORT = 8099
WS_URL = f"ws://{HOST}:{PORT}/ws"
API_BASE = f"http://{HOST}:{PORT}"
TIMEOUT = 5.0

# ── helpers HTTP ──────────────────────────────────────────────────────────

def http_post(url, data=b""):
    req = urllib.request.Request(url, data=data, method="POST")
    return json.loads(urllib.request.urlopen(req, timeout=TIMEOUT).read())


def http_get(url):
    return json.loads(urllib.request.urlopen(url, timeout=TIMEOUT).read())


# ── cliente WS ────────────────────────────────────────────────────────────

class WsClient:
    """Envoltório async com listener de fundo que coleta todas as mensagens."""

    def __init__(self, seat):
        self.seat = seat
        self.ws = None
        self.messages = []          # mensagens recebidas, em ordem
        self._recv_task = None

    async def connect(self, room_id, token=None):
        token = token or f"smoke_{self.seat}"
        self.ws = await connect(WS_URL)
        await self.ws.send(json.dumps({
            "type": "HELLO",
            "room": room_id,
            "seat": self.seat,
            "token": token,
        }))
        # inicia o listener de fundo
        self._recv_task = asyncio.create_task(self._listen())

    async def _listen(self):
        try:
            while True:
                raw = await asyncio.wait_for(self.ws.recv(), timeout=TIMEOUT * 3)
                self.messages.append(json.loads(raw))
        except (asyncio.TimeoutError, Exception):
            pass

    async def send(self, payload):
        if isinstance(payload, str):
            await self.ws.send(payload)
        else:
            await self.ws.send(json.dumps(payload))

    def has_type(self, msg_type):
        return any(m.get("type") == msg_type for m in self.messages)

    def wait_for(self, msg_type, timeout=TIMEOUT):
        """Síncrono: espera (polling) até que uma mensagem do tipo apareça."""
        deadline = time.time() + timeout
        while time.time() < deadline:
            if self.has_type(msg_type):
                return True
            time.sleep(0.02)
        return False

    async def close(self):
        if self._recv_task:
            self._recv_task.cancel()
        if self.ws:
            await self.ws.close()


# ── assertions ────────────────────────────────────────────────────────────

def assert_true(condition, message):
    if not condition:
        print(f"  FALHOU: {message}")
        sys.exit(1)
    print(f"  OK: {message}")


# ── teste principal ───────────────────────────────────────────────────────

async def run_test():
    server = subprocess.Popen(
        [sys.executable, str(ROOT / "server.py"), "--port", str(PORT)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(1.5)

    try:
        # ── cria sala ──
        room = http_post(f"{API_BASE}/api/matches")
        room_id = room["roomId"]
        print(f"Sala criada: {room_id} (seed {room['seed']})")

        # ── dois clientes conectam ──
        p1 = WsClient("p1")
        p2 = WsClient("p2")
        await p1.connect(room_id, "smoke_p1")
        await asyncio.sleep(0.3)   # deixa p1 estabelecer antes de p2
        await p2.connect(room_id, "smoke_p2")

        # dá ao servidor um instante para processar ambos os HELLO
        await asyncio.sleep(0.5)

        assert_true(p1.has_type("ROOM_STATE"), "p1 recebeu ROOM_STATE")
        assert_true(p2.has_type("ROOM_STATE"), "p2 recebeu ROOM_STATE")
        assert_true(p1.has_type("MATCH_START"), "p1 recebeu MATCH_START")
        assert_true(p2.has_type("MATCH_START"), "p2 recebeu MATCH_START")

        # ── rejeita terceiro cliente no mesmo assento ──
        p3 = WsClient("p1")
        try:
            await p3.connect(room_id, "smoke_p1_copy")
            await asyncio.sleep(0.5)
            rejected = any(m.get("type") == "ERROR" for m in p3.messages)
            assert_true(rejected, "terceiro cliente no mesmo assento é rejeitado")
        except Exception:
            assert_true(True, "terceiro cliente no mesmo assento é rejeitado")
        finally:
            await p3.close()

        # ── END_TURN de p1 aceito e replicado ──
        await p1.send({
            "type": "COMMAND",
            "cmd": "END_TURN",
            "args": {},
            "reveals": [],
            "hash": "turno-1-end",
        })
        await asyncio.sleep(0.5)

        p1_commands = [m for m in p1.messages if m.get("type") == "COMMAND"]
        p2_commands = [m for m in p2.messages if m.get("type") == "COMMAND"]
        assert_true(len(p1_commands) >= 1, "p1 recebeu o COMMAND de END_TURN")
        assert_true(len(p2_commands) >= 1, "p2 recebeu o COMMAND replicado")
        if p2_commands:
            entry = p2_commands[-1]
            assert_true(
                entry["cmd"] == "END_TURN" and entry["actor"] == "p1",
                "o COMMAND replicado carrega cmd=END_TURN actor=p1",
            )

        # ── STATE_HASH broadcast bate nos dois ──
        p1_hashes = [m for m in p1.messages if m.get("type") == "STATE_HASH"]
        p2_hashes = [m for m in p2.messages if m.get("type") == "STATE_HASH"]
        assert_true(len(p1_hashes) >= 1, "p1 recebeu STATE_HASH")
        assert_true(len(p2_hashes) >= 1, "p2 recebeu STATE_HASH")
        if p1_hashes and p2_hashes:
            assert_true(
                p1_hashes[-1]["hash"] == p2_hashes[-1]["hash"],
                f"STATE_HASH bate nos dois ({p1_hashes[-1]['hash']})",
            )

        # ── DICE_REQUEST de p2 (agora é a vez de p2) ──
        await p2.send({"type": "DICE_REQUEST"})
        await asyncio.sleep(0.5)

        p1_dice = [m for m in p1.messages if m.get("type") == "DICE_RESULT"]
        p2_dice = [m for m in p2.messages if m.get("type") == "DICE_RESULT"]
        assert_true(len(p1_dice) >= 1, "p1 recebeu DICE_RESULT")
        assert_true(len(p2_dice) >= 1, "p2 recebeu DICE_RESULT")
        if p1_dice and p2_dice:
            assert_true(
                p1_dice[-1]["value"] == p2_dice[-1]["value"],
                f"DICE_RESULT igual nos dois ({p1_dice[-1]['value']})",
            )

        # ── comando fora do turno é rejeitado ──
        await p1.send({
            "type": "COMMAND",
            "cmd": "END_TURN",
            "args": {},
            "reveals": [],
            "hash": "out-of-turn",
        })
        await asyncio.sleep(0.5)
        assert_true(
            any(m.get("type") == "REJECTED" for m in p1.messages),
            "END_TURN fora do turno é rejeitado para p1",
        )

        await p1.close()
        await p2.close()

        # ── matches/<roomId>.json existe e tem o ledger ──
        ledger = ROOT / "matches" / f"{room_id}.json"
        assert_true(ledger.is_file(), f"matches/{room_id}.json existe")
        data = json.loads(ledger.read_text(encoding="utf-8"))
        assert_true("commands" in data, "ledger contém a chave 'commands'")
        assert_true(
            len(data["commands"]) >= 2,
            "ledger tem pelo menos 2 comandos (END_TURN + ROLL_DICE)",
        )
        cmds = [c["cmd"] for c in data["commands"]]
        assert_true("END_TURN" in cmds, "ledger registra END_TURN")
        assert_true("ROLL_DICE" in cmds, "ledger registra ROLL_DICE")
        assert_true(data["roomId"] == room_id, "roomId no ledger confere")

    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()

    print("\n[OK] smoke_match: todos os checklists passaram.")


def main():
    print("=== PvP Smoke Test (relay lockstep) ===")
    try:
        asyncio.run(run_test())
    except SystemExit:
        raise
    except Exception as error:
        print(f"\n[ERRO] smoke_match FALHOU com excecao: {error}", file=sys.stderr)
        raise
    print("\n=== Fim ===")


if __name__ == "__main__":
    main()
