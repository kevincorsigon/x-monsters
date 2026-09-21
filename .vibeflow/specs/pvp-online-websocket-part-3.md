# Spec: PvP Online — Parte 3: Estado Oculto e Sessão Cliente (headless)

> Depende de: [part-1](pvp-online-websocket-part-1.md),
> [part-2](pvp-online-websocket-part-2.md).
> PRD: [.vibeflow/prds/pvp-online-websocket.md](../prds/pvp-online-websocket.md)

## Objective

Um cliente PvP reconstrói a partida a partir de comandos, mantendo as cartas do
oponente como **contagem** (nunca identidade) no seu próprio `gameState`, e
converge exatamente com o outro cliente — tudo verificável em Node, sem DOM.

## Context

Hoje não existe segredo: `game.html` controla os dois jogadores e a "mão oculta"
é CSS (`player-hand-hidden`). Para o sigilo valer, o cliente do jogador A não
pode possuir a identidade das cartas do jogador B. O ponto crítico é que a UI
existente **precisa do comprimento correto** das zonas alheias:
`renderHandsFromState` itera `gameState.cards[player].hand` dos dois lados
(`src/js/game.js:1053-1065`) e `findCardData` varre as duas mãos
(`src/js/game.js:1608-1611`). Logo, as zonas ocultas não podem ser arrays vazios:
elas precisam de instâncias *placeholder* contáveis, sem `definitionId`.

Achado que define o desenho: nenhuma regra de `card-rules.js` lê a mão ou o deck
do oponente — todas as leituras usam `players[controllerId]`
(`card-rules.js:35, 644, 973, 2531, 2546, 2797`) e nenhuma regra lê `hand.length`.
É isso que permite replicar sem tocar em `card-rules.js`.

## Definition of Done

- [ ] 1. `createHiddenInstance(ownerId, index)` cria uma instância
      `{instanceId: 'hidden_<owner>_<k>', definitionId: null, data: null}` que
      ocupa zona normalmente (contagem correta em `hand`/`deck`) e não quebra
      `GameStateModel.moveCard` nem `findCardLocations`.
- [ ] 2. O `idFactory` de PvP gera ids opacos (`i_<owner>_<hash>`) para cartas
      reveladas: nenhum id contém `card_NNN`, nem revela a posição no deck.
- [ ] 3. `revealInstance(state, reveal)` substitui o placeholder **no mesmo slot**
      pela instância real (mesmo `instanceId` anunciado) e é idempotente; um
      comando que referencie uma carta oculta sem `reveal` é rejeitado por
      `pvp-protocol.js`.
- [ ] 4. Teste de vazamento de informação: com placeholders instrumentados por
      getter de auditoria, um replay cobrindo invocação, equipamento, ataque,
      ataque direto, descarte e escolha pendente falha se qualquer código do
      motor/regras ler `definitionId` ou `data` de uma instância oculta.
- [ ] 5. `pvp-session.js` aplica o log em ordem com transporte injetável
      (fake em teste), sob 4 condições verificadas: `seq` fora de ordem
      (gap/duplicada) pede `COMMAND_LOG`; `REJECTED` não muta o estado;
      `DICE_RESULT` alimenta o dado; e o replay completo de dois estados — um
      "cego" para o oponente e um completo — produz o **mesmo `stateHash`**.
- [ ] 6. Zero regressão: `node tests/unit/run-tests.js` exit 0 (150 pré-existentes
      + novos desta parte).
- [ ] 7. Craftsmanship Gate: nenhuma segunda fonte de verdade de jogo (o estado
      continua sendo `GameStateModel`); nenhum id derivado de `Date.now()`;
      acesso cross-file só via `window.PvpState` / `window.PvpSession` com
      guarda opcional; uso de `stateHash` de `pvp-protocol.js`, sem reimplementar.

## Scope

- `src/js/pvp-state.js` (novo, UMD):
  - `createHiddenInstance`, `createHiddenZone` (mão/deck ocultos), bookkeeping de
    slots ocultos por jogador (`hiddenSlots`), `revealInstance`.
  - `createPvpIdFactory(seed)` — ids opacos determinísticos (`i_<owner>_<hash>`)
    para passar em `resetMatchState(..., {idFactory})`
    (`src/js/game-state.js:132-161`).
  - Auditoria de vazamento: modo `auditHiddenAccess()` que falha o teste ao
    detectar leitura de `definitionId`/`data` de placeholder.
- `src/js/pvp-session.js` (novo, UMD): cliente de sessão PvP **sem DOM** —
  transporte injetável, fila ordenada por `seq`, `applyRemoteCommand`,
  `handleRejected`, `handleCommandLog` (replay), `requestResync`, `sendCommand`,
  `stateHash` de `pvp-protocol.js`. É a única porta de entrada de comando e o
  ponto usado pelos hooks de UI na parte 4.
- `tests/unit/run-tests.js` — casos dos DoD 1–5 e 7.

## Anti-scope

- Não criar `pvp.html`, CSS, nem tocar em `src/js/game.js` — parte 4.
- Não implementar `MATCH_START`, reconexão real, `GAME_OVER`/`rematch` — parte 5
  (aqui só o replay local do log, que a parte 5 reusa).
- Não alterar `card-rules.js`, `game-engine.js`, `game-state.js`.
- Não implementar anti-cheat nem validação de conteúdo no servidor.
- Não criptografar nada: ids opacos são ofuscação, não segurança.
- Não trocar o formato de id usado por `game.html`.

## Technical Decisions

1. **Placeholder contável em vez de zona vazia**: `renderHandsFromState` e
   `findCardData` dependem de `.length` e da varredura das duas mãos
   (`src/js/game.js:1053-1065, 1608-1611`). Zona vazia quebraria a UI e o
   `findCardData` de cartas do oponente; o placeholder mantém contrato sem
   entregar identidade.
2. **Revelação sob demanda, nunca por padrão**: só o que entra em zona pública
   (campo, equipamento, descarte) ou precisa de identidade para uma validação é
   revelado, no mesmo comando que o movimenta. Isso evita um vazamento estático
   reconstructível por devtools.
3. **Id opaco (`i_p2_<hash>`)**: o formato atual
   `${definitionId}_${owner}_${seq}` (`game-state.js:15-18`) codifica a posição
   no deck — cada revelação entregaria um mapa parcial da ordem do deck alheio.
   O `idFactory` é suportado nativamente pela API (`options.idFactory`), então a
   correção é gratuita e não muda `game.html`.
4. **`handSlot` em vez de id oculto como identidade pública**: o comando carrega
   `handSlot` para posicionar/remover o placeholder; a identidade chega apenas no
   `reveal`. Alternativa descartada: mandar o id oculto no `args`, que permitiria
   correlação por quem observa o tráfego.
5. **Sessão headless e testável**: `pvp-session.js` não toca em DOM, então o
   núcleo do PvP é testado com `node:assert`, seguindo o padrão do projeto; a
   parte 4 apenas pluga a UI nele.

## Applicable Patterns

- `patterns/event-effect-engine.md` — módulos UMD, `state.cardInstances` como
  índice de identidade, `instanceId` como chave canônica.
- `patterns/game-state-management.md` — um único `gameState`; nenhuma cópia
  paralela de zonas ou stats.
- `patterns/automated-unit-tests.md` — determinismo e regressão em
  `tests/unit/run-tests.js`.
- Novo padrão: **relay lockstep com estado oculto** (documentado como
  `patterns/pvp-lockstep-sync.md` ao final da parte 4).

## Risks

- **Risco**: alguma regra futura passar a ler `hand`/`deck` do oponente e o
  sigilo quebrar silenciosamente.
  - *Mitigação*: auditoria de placeholder no DoD 4 — o teste falha no acesso, não
    na aparência.
- **Risco**: `revealInstance` trocar a instância de slot e o `moveCard` não
  encontrar a carta (erro "Instância ocupa N zonas").
  - *Mitigação*: a revelação é in-place (mesmo slot e mesmo `gameState.cards`
  array) e o DoD 3 verifica idempotência e localização única.
- **Risco**: hash de id colidir em decks grandes.
  - *Mitigação*: hash sobre `definitionId + owner + sequence` e verificação de
    unicidade no `resetMatchState` (já lança em id duplicado,
    `game-state.js:152`).
- **Risco**: replay divergir por comandos não idempotentes (ex.: `DESTROY`
  aplicado duas vezes).
  - *Mitigação*: aplicação estritamente por `seq` com deduplicação e um teste de
    "mesma lista, duas vezes, mesmo hash".
- **Risco**: a UI local (não-PvP) regredir por causa das mudanças de sessão.
  - *Mitigação*: nada em `game.js`/`game.html` é tocado nesta parte; os testes
    pré-existentes são o gate.

## References

- `src/js/game.js:1053-1065` — `renderHandsFromState`, o consumidor do
  comprimento das mãos.
- `src/js/game.js:1608-1611` — `findCardData` varrendo as duas mãos.
- `src/js/game-state.js:15-18, 132-161` — `createInstanceId` e
  `resetMatchState(..., {idFactory})`.
- `card-rules.js:35, 644, 973, 2531, 2546, 2797` — leituras de deck/mão sempre no
  próprio controlador: a base do argumento de que replicar não quebra regras.