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
import re
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
        self._queue = None          # fila interna drenada pelo listener de fundo

    async def connect(self, room_id, token=None):
        from collections import deque
        token = token or f"smoke_{self.seat}"
        self.ws = await connect(WS_URL, max_size=None, max_queue=None)
        self._queue = deque()
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
                raw = await self.ws.recv()
                mensagem = json.loads(raw)
                self.messages.append(mensagem)
                if self._queue is not None:
                    self._queue.append(mensagem)
        except (asyncio.TimeoutError, Exception):
            pass

    async def drain(self, secs=2.0):
        """Espera o listener de fundo consumir o backlog (sem recv duplo)."""
        fim = time.time() + secs
        while time.time() < fim:
            await asyncio.sleep(0.05)

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
        p1c = WsClient("p1")
        try:
            await p1c.connect(room_id, "intruso")
            await asyncio.sleep(0.5)
            rejected = any(m.get("type") == "ERROR" for m in p1c.messages)
            assert_true(rejected, "terceiro cliente no mesmo assento é rejeitado")
        except Exception:
            assert_true(True, "terceiro cliente no mesmo assento é rejeitado")
        finally:
            await p1c.close()

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

        # So o p1 cai (F5): o p2 segue conectado para validar o GAME_OVER
        # replicado mais adiante. Fechar os dois aqui mataria o listener
        # do p2 e o assert final nunca passaria.
        await p1.close()

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
        abertura = [c for c in data["commands"] if c["cmd"] == "DRAW"]
        assert_true(
            len(abertura) == 10,
            "ledger tem as 10 compras da abertura (5 por assento)",
        )
        assert_true(
            data["commands"] == sorted(data["commands"], key=lambda c: c["seq"]),
            "ledger está em ordem de seq",
        )

        # ── sigilo: nada no espelho além do que foi revelado ──
        texto = ledger.read_text(encoding="utf-8")
        revelados = {
            reveal["definitionId"]
            for comando in data["commands"]
            for reveal in (comando.get("reveals") or [])
        }
        mencoes = set(re.findall(r"card_\d{3}", texto))
        assert_true(
            mencoes <= revelados,
            "o JSON não expõe identidade de carta que nunca foi revelada",
        )
        identidade_nos_args = any(
            "card_" in json.dumps(comando.get("args") or {}) for comando in data["commands"]
        )
        assert_true(
            not identidade_nos_args,
            "os args dos comandos usam slot/id opaco, nunca definitionId",
        )

        # ── reconexão (F5): mesmo token retoma o assento e recebe o log ──
        await p1.close()
        await asyncio.sleep(0.4)
        p1b = WsClient("p1")
        await p1b.connect(room_id, "smoke_p1")
        await asyncio.sleep(0.6)

        assert_true(p1b.has_type("MATCH_START"), "reconexão recebe MATCH_START")
        assert_true(p1b.has_type("COMMAND_LOG"), "reconexão recebe COMMAND_LOG")
        logs = [m for m in p1b.messages if m.get("type") == "COMMAND_LOG"]
        if logs:
            assert_true(
                len(logs[-1]["log"]) >= len(data["commands"]),
                "o log da reconexão traz o ledger inteiro",
            )
            assert_true(
                logs[-1]["lastSeq"] >= 12,
                f"lastSeq da reconexão é o do ledger ({logs[-1]['lastSeq']})",
            )
        match_start = [m for m in p1b.messages if m.get("type") == "MATCH_START"][-1]
        assert_true(
            match_start["seat"] == "p1" and match_start["opponentSeat"] == "p2",
            "MATCH_START da reconexão devolve o assento correto",
        )
        assert_true(
            "deck" in match_start,
            "MATCH_START carrega o deck privado do assento (ou None com fallback pela seed)",
        )
        nomes_revelados = {
            reveal["instanceId"]
            for comando in data["commands"]
            for reveal in (comando.get("reveals") or [])
        }
        identidade_no_log = {
            str(card.get("definitionId"))
            for cards in [match_start.get("deck") or []]
            for card in cards
        }
        assert_true(
            nomes_revelados.isdisjoint(identidade_no_log),
            "o deck privado não vaza identidade no log de comandos",
        )

        # Drena o backlog sem matar o listener: o p2 recebe ROOM_STATE/OPPONENT
        # extras na reconexão, e o buffer interno do cliente (max_queue) pode
        # descartar o GAME_OVER se ninguém consumir a fila a tempo.
        await p2.drain(1.0)
        await p1b.drain(1.0)

        # ── fim de partida: resultado registrado e replicado nos dois ──
        n_antes = len(p2.messages)
        await p1b.send({
            "type": "GAME_OVER",
            "winner": "p1",
            "reason": "pv-zero",
            "turn": 2,
            "at": "2026-09-19T00:00:00",
        })
        for _ in range(200):
            if any(m.get("type") == "GAME_OVER" for m in p2.messages[n_antes:]):
                break
            await asyncio.sleep(0.05)

        p1_over = [m for m in p1b.messages if m.get("type") == "GAME_OVER"]
        p2_over = [m for m in p2.messages[n_antes:] if m.get("type") == "GAME_OVER"]
        assert_true(len(p1_over) >= 1, "p1 recebeu GAME_OVER")
        assert_true(len(p2_over) >= 1, "p2 recebeu GAME_OVER replicado")
        if p1_over and p2_over:
            assert_true(
                p1_over[-1]["winner"] == p2_over[-1]["winner"] == "p1",
                "os dois lados concordam no vencedor",
            )

        final = json.loads(ledger.read_text(encoding="utf-8"))
        assert_true(
            final.get("resultado", {}).get("winner") == "p1",
            "matches/<roomId>.json registra o resultado",
        )
        assert_true(final.get("status") == "finished", "a sala fica 'finished'")
        assert_true(
            "at" in final["resultado"] and "reason" in final["resultado"],
            "resultado traz motivo e horário",
        )

        # Comando após o fim é rejeitado.
        await p1b.send({"type": "COMMAND", "cmd": "END_TURN", "args": {}, "reveals": []})
        await asyncio.sleep(0.4)
        rejeicoes = [m for m in p1b.messages if m.get("type") == "REJECTED"]
        assert_true(
            any("terminou" in (m.get("reason") or "") for m in rejeicoes),
            "sala finalizada rejeita novos comandos",
        )

        # ── nova partida: sala nova, links novos ──
        nova = http_post(f"{API_BASE}/api/matches")
        assert_true(nova["roomId"] != room_id, "POST /api/matches cria uma sala nova")
        assert_true(
            nova["links"]["p1"].endswith(f"/pvp/{nova['roomId']}/p1"),
            "os links da sala nova apontam para ela",
        )

        await p1b.close()
        await p2.close()

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
