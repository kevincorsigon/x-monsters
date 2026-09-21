# Spec: PvP Online — Parte 1: Servidor Relay, Salas e Persistência

> Depende de: nada. É a base das partes 2–5.
> PRD: [.vibeflow/prds/pvp-online-websocket.md](../prds/pvp-online-websocket.md)

## Objective

Duas pessoas conseguem criar uma partida pelo navegador, receber dois links de
assento e conectar-se simultaneamente, com cada comando da partida sendo
ordenado pelo servidor e registrado em `matches/<roomId>.json`.

## Context

Hoje o projeto roda em `py -3 -m http.server 8000` (servidor estático sem
processo, ver `README.md`), que não tem estado, não aceita conexões WebSocket e
não conhece partidas. Também não existe nenhuma noção de "partida" persistida em
arquivo: `gameState` vive só na memória do navegador. Esta parte cria o processo
servidor que tudo o mais vai usar, deliberadamente **sem** conhecer regras de
carta.

## Definition of Done

- [x] 1. `py -3 server.py` sobe na porta 8000 e serve `pvp-lobby.html` em
      `GET /pvp` com HTTP 200, mantendo o modo antigo intacto:
      `py -3 -m http.server 8000` continua sendo a forma de rodar o jogo local.
- [x] 2. `POST /api/matches` cria uma sala e devolve
      `{"roomId": "...", "links": {"p1": ".../pvp/<roomId>/p1", "p2": ".../pvp/<roomId>/p2"}}`;
      `GET /pvp`, `GET /pvp/<roomId>/p1` e `/p2` respondem 200 servindo
      `pvp.html` (nesta parte uma casca de diagnóstico, substituída na parte 4),
      e `GET /api/matches/<roomId>` devolve o status da sala.
- [x] 3. Duas conexões WebSocket (`/ws?room=<id>&seat=p1|p2`) recebem
      `ROOM_STATE` com os dois assentos; um `HELLO` de um terceiro cliente ou com
      assento já ocupado é rejeitado com motivo legível.
- [x] 4. `py -3 tests/pvp/smoke_match.py` passa: dois clientes WS conectam,
      ambos recebem `MATCH_START`, um `END_TURN` é aceito e replicado para os
      dois, um `DICE_REQUEST` devolve o mesmo `DICE_RESULT` aos dois, os dois
      `STATE_HASH` batem, e um comando fora do turno é rejeitado; exit code 0.
- [x] 5. Cada comando aceito acrescenta uma entrada em `matches/<roomId>.json`
      (`{seq, actor, cmd, args, reveals, at}`), o arquivo é JSON válido, e
      reiniciar o servidor com o arquivo presente não impede criar salas novas.
- [x] 6. Zero regressão: `node tests/unit/run-tests.js` → 150/150, exit 0.
- [x] 7. Craftsmanship Gate: `matches/` no `.gitignore`; mensagens e logs em
      pt-BR; nenhuma alteração em `game.html`, `src/js/*.js`, `index.html`,
      `card-rules.js` ou `game-engine.js` nesta parte; nenhuma dependência npm.

## Scope

- `server.py` (novo) — servidor HTTP + WebSocket na mesma porta usando a lib
  `websockets` para o upgrade e `http.server` para os estáticos:
  - `GET /pvp` → `pvp-lobby.html`; `GET /pvp/<roomId>` → assento automático
    (primeiro a entrar = p1, segundo = p2); `GET /pvp/<roomId>/p1|p2` → link
    compartilhável com assento explícito.
  - `POST /api/matches` (cria sala), `GET /api/matches/<roomId>` (status).
  - `WS /ws?room=&seat=` — handshake `HELLO` → `ROOM_STATE`; sequenciador com
    `seq` monotônica por sala; validação de `actor === currentPlayer` excluindo
    `CHOICE`/`DESTROY`; recusa novo comando enquanto `pendingChoice` está aberto;
    `DICE_REQUEST` → `DICE_RESULT {value}` com RNG do servidor (1..6) para os
    dois assentos.
  - Ledger em memória por sala + append em `matches/<roomId>.json`.
- `pvp.html` (novo, nesta parte uma **casca de diagnóstico**) — mostra sala,
  assento e estado da conexão, conecta no WS e lista as mensagens recebidas
  (`ROOM_STATE`, `MATCH_START`, `COMMAND`, `DICE_RESULT`, `REJECTED`). Serve de
  superfície de teste manual do relay; a parte 4 a substitui pelo tabuleiro.
- `pvp-lobby.html` (novo) — botão "Criar partida", exibição dos dois links com
  botão de copiar, status da sala atualizando por polling em
  `GET /api/matches/<roomId>`, e "Nova partida".
- `tests/pvp/smoke_match.py` (novo) — cliente WS de teste (a lib `websockets`
  fornece o cliente); joga um turno scriptado sem navegador.
- `README.md` — seção "PvP Online" com `py -3 -m pip install websockets` e
  `py -3 server.py`.
- `.gitignore` — linha `matches/`.

## Anti-scope

- Não implementar regras de carta, `stateHash` real nem tabuleiro PvP — partes
  2, 3 e 4.
- Não implementar revelação de cartas, deck secreto ou seed — parte 2.
- Não mexer em nenhum arquivo de `src/` nesta parte.
- Não ter autenticação, token criptográfico, rate limit ou anti-flood.
- Não persistir salas entre reinícios do servidor: `matches/*.json` é registro
  de auditoria, não fonte de verdade.
- Não expor na internet, não configurar TLS, não adicionar CORS liberado.

## Technical Decisions

1. **WebSocket em vez de SSE + POST**: o jogo precisa de latência baixa nos dois
   sentidos e de detecção de queda de conexão; SSE é unidirecional e exigiria
   emparelhar um POST para cada comando. Trade-off: 1 dependência pip
   (`websockets`) — justificada porque também fornece o cliente usado no smoke
   test, sem escrever RFC6455 à mão em stdlib.
2. **Servidor não conhece cartas**: validar conteúdo de ação exigiria
   reimplementar `card-rules.js` (2871 linhas) em Python. O servidor valida
   assento, ordem, turno e fase declarados no ledger. Trade-off assumido: sem
   anti-cheat de conteúdo (registrado no PRD e na spec da parte 4).
3. **`seq` monotônica + ledger como único ordenador**: toda réplica é uma
   sequência; reconexão (parte 5) é replay. Trade-off: o servidor guarda o log
   completo em memória, aceitável para partidas 1v1 de um turno por sessão.
4. **Salas só em memória, `matches/*.json` como espelho**: atende "não precisa
   ser persistido" e ainda dá trilha de auditoria legível.
5. **Porta única (8000) servindo estáticos e WS**: mantém o modelo mental atual
   (`README.md`) e evita CORS / dois processos.
6. **Budget justificado**: 6 arquivos (2 acima do budget de 4 do
   `.vibeflow/index.md`). Três deles são de custo quase nulo: `.gitignore` e
   `README.md` (linhas de configuração/documentação) e `pvp.html` (casca de
   diagnóstico descartada na parte 4). Sem `pvp.html` nesta parte, o DoD 2 não
   teria como ser verificado no navegador antes da parte 4.

## Applicable Patterns

- `patterns/game-state-management.md` — princípio de fonte única de verdade:
  o servidor não cria um segundo modelo de jogo, apenas um ledger de comandos.
- `patterns/python-card-asset-scripts.md` — convenção de scripts Python rodados
  a partir da raiz; `server.py` segue snake_case e mensagens em pt-BR.
- Novo padrão a nascer aqui: **relay lockstep com ledger** — documentado em
  `patterns/pvp-lockstep-sync.md` ao final da parte 4.

## Risks

- **Risco**: a lib `websockets` não estar disponível e o smoke test virar
  dependência frágil.
  - *Mitigação*: o smoke test detecta a ausência e falha com mensagem clara
    ("instale com `py -3 -m pip install websockets`"); o `README.md` documenta.
- **Risco**: dois clientes abrindo o mesmo assento e travando a partida.
  - *Mitigação*: assento ocupado é rejeitado com motivo legível e o lobby mostra
    o status (aguardando / em partida).
- **Risco**: servidor Python single-thread bloquear com os dois sockets.
  - *Mitigação*: `websockets` é asyncio; os estáticos são servidos em thread
    separada na mesma porta.
- **Risco**: vazar caminho absoluto de `matches/` na resposta HTTP.
  - *Mitigação*: `roomId` validado por regex restrita (`[A-Za-z0-9_-]{4,32}`) e
    resolvido sempre dentro de `matches/`.

## References

- `game.html:171-177` — ordem de inclusão dos scripts que a página PvP reutiliza.
- `README.md` — forma atual de rodar o projeto (servidor estático).
- `src/js/game-state.js:132-161` — `resetMatchState(..., {idFactory})`, consumido
  pelas partes 2 e 3.
- `src/js/game.js:277-379` — `endTurn()`, o comando `END_TURN` que o smoke test
  replica.