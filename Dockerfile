# X Monsters — container com servidor PvP (HTTP + WebSocket + deck_factory Node)
#
# O server.py serve, na mesma porta (8000 no Docker; 8080 localmente por padrão):
#   - arquivos estáticos (pvp.html, pvp-lobby.html, game.html, index.html, CSS, …)
#   - API do lobby (/api/matches)
#   - WebSocket do relay (/ws)
#
# Pré-requisitos da image: Python 3 + Node (o deck_factory.js é o balanceador de
# decks oficial; sem Node o servidor fallback para "cliente gera o deck pela seed").

FROM node:20-alpine AS base
RUN apk add --no-cache python3 py3-pip

FROM base AS deps
# websockets é a única dependência externa do server.py (resto é stdlib).
# --break-system-packages é necessário em Python 3.11+ (PEP 668) em containers
# onde a imagem é descartável — não há risco de quebrar o sistema host.
RUN python3 -m pip install --no-cache-dir --break-system-packages websockets

FROM deps AS runtime
WORKDIR /app
COPY . .
# matches/ é runtime-only; nunca commitado no git, mas criado/O cultivado na imagem.
RUN mkdir -p matches && chmod -R 777 matches

EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --start-period=3s --retries=3 \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/')" || exit 1

# Por padrão: escuta apenas em 127.0.0.1 (local). Use --host 0.0.0.0 no docker run
# para expor na rede (ex: acesso de outro container ou máquina host no Docker Desktop).
CMD ["python3", "server.py", "--host", "0.0.0.0", "--port", "8000"]
