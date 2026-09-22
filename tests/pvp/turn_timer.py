"""Smoke do relogio de turno no relay PvP.

Sobe o `server.py` com `XM_TURN_SECONDS=2` (limite curto, so para o teste), abre
dois clientes na mesma sala e verifica que:

  1. o estado da sala publica `limiteTurno`/`prazoTurno`;
  2. o servidor registra um `END_TURN` do assento da vez quando o tempo estoura
     (comando normal no ledger, marcado com `timeout`), sem o cliente pedir nada;
  3. os dois assentos recebem o comando replicado e passam a ver o outro na vez;
  4. o espelho `matches/<roomId>.json` guarda os comandos automaticos;
  5. o turno seguinte tambem estoura (o relogio reinicia a cada virada).

Exit code 0 = tudo passou.
"""

import asyncio
import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from websockets.asyncio.client import connect

ROOT = Path(__file__).resolve().parent.parent.parent
HOST = "127.0.0.1"
PORT = 8098
WS_URL = f"ws://{HOST}:{PORT}/ws"
API_BASE = f"http://{HOST}:{PORT}"
LIMITE = 2
TIMEOUT = 5.0


def assert_true(condition, message):
    if not condition:
        print(f"  FALHOU: {message}")
        sys.exit(1)
    print(f"  OK: {message}")


def http_post(url, data=b""):
    req = urllib.request.Request(url, data=data, method="POST")
    return json.loads(urllib.request.urlopen(req, timeout=TIMEOUT).read())


def http_get(url):
    return json.loads(urllib.request.urlopen(url, timeout=TIMEOUT).read())


class WsClient:
    """Cliente WS minimo com listener de fundo (mesmo padrao do smoke_match)."""

    def __init__(self, seat):
        self.seat = seat
        self.ws = None
        self.messages = []
        self._task = None

    async def connect(self, room_id, token=None):
        self.ws = await connect(WS_URL, max_size=None, max_queue=None)
        await self.ws.send(json.dumps({
            "type": "HELLO",
            "room": room_id,
            "seat": self.seat,
            "token": token or f"relogio_{self.seat}",
        }))
        self._task = asyncio.create_task(self._listen())

    async def _listen(self):
        try:
            while True:
                raw = await self.ws.recv()
                self.messages.append(json.loads(raw))
        except Exception:  # noqa: BLE001 - socket fechado no fim do teste
            pass

    async def close(self):
        try:
            await self.ws.close()
        except Exception:  # noqa: BLE001
            pass

    def automaticos(self):
        return [m for m in self.messages
                if m.get("type") == "COMMAND" and m.get("timeout")]


async def esperar(condicao, segundos=TIMEOUT):
    fim = time.time() + segundos
    while time.time() < fim:
        if condicao():
            return True
        await asyncio.sleep(0.1)
    return False


async def run_test():
    env = {**os.environ, "XM_TURN_SECONDS": str(LIMITE)}
    server = subprocess.Popen(
        [sys.executable, str(ROOT / "server.py"), "--port", str(PORT)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        env=env,
    )
    time.sleep(1.5)

    p1 = WsClient("p1")
    p2 = WsClient("p2")

    try:
        sala = http_post(f"{API_BASE}/api/matches")
        room_id = sala["roomId"]
        print(f"Sala criada: {room_id} (limite de turno {sala['config'].get('turnSeconds')}s)")
        assert_true(
            sala["config"].get("turnSeconds") == LIMITE,
            "a sala nasce com o limite de turno configurado",
        )

        await p1.connect(room_id)
        await asyncio.sleep(0.3)
        await p2.connect(room_id)
        await asyncio.sleep(0.6)

        estado = http_get(f"{API_BASE}/api/matches/{room_id}")
        assert_true(estado.get("limiteTurno") == LIMITE, "o estado publica `limiteTurno`")
        assert_true(
            isinstance(estado.get("prazoTurno"), (int, float))
            and 0 < estado["prazoTurno"] <= LIMITE,
            f"e o `prazoTurno` correndo ({estado.get('prazoTurno')}s)",
        )
        assert_true(estado.get("jogadorAtual") == "p1", "a partida abre com p1")

        # O turno estoura sozinho: ninguem envia comando.
        estourou = await esperar(lambda: bool(p1.automaticos()), LIMITE + 4)
        assert_true(estourou, "o servidor registrou o END_TURN automatico")

        auto = p1.automaticos()[0]
        assert_true(auto.get("cmd") == "END_TURN", "o comando automatico e um END_TURN")
        assert_true(auto.get("actor") == "p1", "com o assento da vez como autor")
        assert_true("prazoTurno" in auto, "o comando carrega o novo prazo do turno")

        replicado = await esperar(lambda: bool(p2.automaticos()), 2.0)
        assert_true(replicado, "o oponente recebe o mesmo comando")

        depois = http_get(f"{API_BASE}/api/matches/{room_id}")
        assert_true(depois.get("jogadorAtual") == "p2", "a vez passou para o oponente")
        assert_true(depois.get("turno") == 2, "o turno avancou")

        # O relogio do novo turno tambem corre: o servidor passa a vez de novo
        # (cada cliente ve os DOIS comandos automaticos, o de p1 e o de p2).
        segundo_estouro = await esperar(
            lambda: len(p2.automaticos()) >= 2, LIMITE + 5
        )
        assert_true(segundo_estouro, "o relogio reinicia e estoura o turno seguinte")
        final = http_get(f"{API_BASE}/api/matches/{room_id}")
        assert_true(final.get("turno") >= 3, "o turno avancou de novo (relogio reiniciou)")

        espelho = json.loads((ROOT / "matches" / f"{room_id}.json").read_text(encoding="utf-8"))
        automaticos = [c for c in espelho["commands"] if c.get("cmd") == "END_TURN"]
        assert_true(len(automaticos) >= 2, "o espelho guarda os END_TURN automaticos")
        assert_true(
            [c["actor"] for c in automaticos][:2] == ["p1", "p2"],
            "com o autor certo em cada um",
        )

        await p1.close()
        await p2.close()
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()

    print("\n[OK] turn_timer: o turno estoura e passa a vez sozinho.")


def main():
    print("=== PvP: relogio de turno (servidor) ===")
    try:
        asyncio.run(run_test())
    except SystemExit:
        raise
    except Exception as error:  # noqa: BLE001
        print(f"\n[ERRO] turn_timer FALHOU com excecao: {error}", file=sys.stderr)
        raise
    print("\n=== Fim ===")


if __name__ == "__main__":
    main()
