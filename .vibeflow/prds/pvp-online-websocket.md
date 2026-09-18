# PRD: PvP Online — Partidas 1v1 em Navegadores Separados com Link Compartilhável

> Generated via vibeflow-discover on 2026-09-17

## Problem

Hoje o X Monsters é um jogo "hotseat": um único `game.html` no mesmo navegador
controla os dois jogadores. As mãos ficam ocultas apenas por CSS/DOM
(`player-hand-hidden` e o botão "Espiar Mão" em `src/js/game.js:552-583`), de modo
que a informação privada de cada jogador vive no mesmo `gameState` e no mesmo
DOM. Isso torna a partida impossível de ser jogada por duas pessoas em lugares
diferentes e mantém a privacidade como teatro: qualquer um abre o devtools e lê
`window.gameState.cards.p2.hand`.

Não existe forma de convidar alguém para jogar — é preciso estar fisicamente na
mesma máquina, o que na prática significa que o jogo nunca é jogado contra outra
pessoa.

## Target Audience

O autor do projeto e um oponente convidado (amigo), cada um no seu próprio
navegador, na mesma rede local ou via túnel, jogando uma partida completa de 1v1
com as 110 cartas existentes.

## Proposed Solution

Uma nova página (`pvp.html`, fork do `game.html`) onde cada partida tem um **link
compartilhável com assento explícito**: `/pvp/<roomId>/p1` e `/pvp/<roomId>/p2`.
O lobby (`pvp-lobby.html`) cria a partida e exibe os dois links; ao abrir o link,
cada jogador recebe seu assento; no fim da partida a página apresenta um link
para gerar a próxima.

Um servidor Python local (`server.py`) passa a servir o jogo e atua como
**intermediário de tempo real**: cria as salas, ordena os comandos das jogadas
via WebSocket, é a única autoridade de aleatoriedade (dado da sorte e
embaralhamento dos decks) e grava o estado da partida em `matches/<roomId>.json`
— sem banco de dados, sem persistência entre execuções.

Todas as funcionalidades atuais continuam valendo (as 110 cartas, fases,
PV/energia, dado, invocação, equipamento, ataque, ataque direto, descarte,
escolhas pendentes de habilidade): cada cliente roda o **mesmo motor JS já
existente** e aplica a mesma sequência de comandos. A mão do oponente chega como
**contagem + verso de carta**, nunca como identidade.

## Success Criteria

Duas pessoas, em dois navegadores, abrem seus links e terminam uma partida
completa de 1v1 com as seguintes evidências observáveis:

- cada jogador vê apenas a quantidade de cartas da mão do oponente — nenhuma
  identidade de carta alheia aparece no `gameState` local nem no devtools;
- PV, energia, fase, turno e campo do oponente atualizam em tempo real, sem
  recarregar a página nem sincronizar manualmente;
- o dado da sorte dá o mesmo resultado nos dois navegadores;
- o resultado final aparece nos dois lados e a página oferece um novo link;
- `matches/<roomId>.json` existe e contém os comandos da partida em ordem.

## Scope v0

- `server.py`: arquivos estáticos + WebSocket na mesma porta (8000), salas em
  memória, `matches/*.json`.
- `pvp-lobby.html`: criar partida, exibir os dois links, status da sala
  (aguardando / conectada / em partida / finalizada) e "nova partida".
- `pvp.html`: tabuleiro PvP (fork do `game.html`), assento por URL, mão do
  oponente como verso + contagem, perspectiva espelhada (cada jogador vê o seu
  campo embaixo).
- Protocolo de comandos: `DRAW`, `ROLL_DICE`, `SET_PHASE`, `END_TURN`, `SUMMON`,
  `EQUIP`, `ATTACK`, `DIRECT_ATTACK`, `ABILITY`, `CHOICE`, `DESTROY`,
  `SET_NAME` — com revelação sob demanda (`reveals`) das cartas que deixam a mão.
- Sincronização em tempo real nos dois lados e reconexão (F5) por replay do log
  de comandos.
- Determinismo: seed do servidor para os decks e para o dado.

## Anti-scope

- Não alterar `game.html`, `index.html`, `game-engine.js`, `card-rules.js`,
  `tests/browser/*`.
- Não duplicar a UI de `src/js/game.js` em uma segunda cópia — o fork é só do
  HTML; a lógica é compartilhada.
- Não reimplementar regras de carta em Python: o servidor não conhece as 110
  cartas, seu papel é ordenar comandos e prover aleatoriedade.
- Não adicionar bundler, npm, TypeScript ou framework de testes.
- Não ter anti-cheat forte: o servidor valida assento, ordem, turno e fase; o
  conteúdo da ação é declarado pelo cliente.
- Não persistir partidas entre reinícios do servidor; sem banco de dados.
- Sem contas, login, matchmaking, espectador, torneio, chat, ranking.
- Sem Docker, deploy, HTTPS ou túnel público.

## Technical Context

- `game.html` (179 linhas) é só o esqueleto; a UI real está em `src/js/game.js`
  (2288 linhas) e o layout em `src/css/game.css` (grid com
  `grid-template-areas`).
- Estado canônico único: `window.gameState` (`GameStateModel`), mutado por ações
  no `window.gameEngine` (`resolveAction` / `resolveCombat` / `resolveChoice`),
  que é determinístico e sem `Math.random`.
- As ações da UI **não são serializáveis** (carregam closures em `validators` e
  `effects`) → o protocolo troca **comandos semânticos** e cada cliente remonta
  a ação com o seu próprio código.
- `resetMatchState(state, decks, options)` já aceita `options.idFactory`, usado
  para ids opacos (sem revelar a ordem do deck).
- As regras leem apenas as zonas do próprio controlador e nunca `hand.length` →
  replicação com informação oculta é viável sem tocar em `card-rules.js`.
- Convenções do repo: sem build step, módulos UMD IIFE, `node:assert`, textos em
  pt-BR, budget ≤4 arquivos por tarefa.
- Ambiente: Python 3.14.7, Node 24.19.0, nenhuma dependência npm.

## Open Questions

1. **Transporte**: `websockets` (pip, 1 dependência justificada, traz cliente WS
   para os testes) vs. SSE + POST sem dependência nenhuma. Assumido:
   `websockets`; o fallback fica registrado na spec como alternativa.
2. **Rede**: os links usam o host de quem abriu (`window.location.host`), então
   funcionam por IP local na mesma rede. Túnel/expôr na internet está fora do
   escopo.