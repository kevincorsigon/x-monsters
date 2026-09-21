# Spec: PvP Online — Parte 4: Tabuleiro PvP Jogável

> Depende de: [part-1](pvp-online-websocket-part-1.md),
> [part-2](pvp-online-websocket-part-2.md),
> [part-3](pvp-online-websocket-part-3.md).
> PRD: [.vibeflow/prds/pvp-online-websocket.md](../prds/pvp-online-websocket.md)

## Objective

Dois jogadores, em dois navegadores, jogam uma partida completa pelo link: cada
um vê o próprio campo embaixo, o adversário em cima com apenas a contagem de
cartas na mão, e todas as jogadas existentes (fases, invocação, equipamento,
ataque, ataque direto, dado, descarte, escolhas) funcionam.

## Context

`game.html` (179 linhas) já é só o esqueleto; toda a UI está em
`src/js/game.js` (2288 linhas) e o layout em `src/css/game.css`, um grid com
`grid-template-areas` (`game.css:40-69`) cujas media queries alteram apenas
colunas/linhas — o que permite espelhar a perspectiva com uma única regra. Os
pontos de mutação da UI já estão identificados e todos passam pelo motor:
`endTurn` (`game.js:277-379`), `setPhase` (`382-431`), `addCardToHand`
(`1118-1160`), `dropCard` (`1426-1599`), `equipSupportCard` (`2013-2153`),
`performAttack` (`743-839`), `directAttack` (`841-878`), `rollDice` (`185-221`),
`destroyCard` (`892-933`). A parte 3 entregou `window.PvpSession`; falta plugar a
UI nele sem duplicar a UI.

## Definition of Done

- [ ] 1. `GET /pvp/<roomId>/p1` e `/p2` abrem `pvp.html` montado com o campo
      local embaixo e o do oponente em cima; `[data-seat="p2"]` inverte as áreas
      do grid sem alterar `src/css/game.css` e sem quebrar as media queries.
- [ ] 2. A mão do oponente mostra exatamente N versos + contagem no título
      (`hand-title-*`), sem botão "Espiar Mão" para a mão alheia;
      `editStatValue`, `editName` e `showDeckInfo` do oponente ficam bloqueados
      ou restritos ao próprio jogador.
- [ ] 3. Duas janelas de navegador completam a sequência real fase → invocar
      criatura → equipar suporte → atacar → fim de turno, com PV, energia, fase,
      turno e campo idênticos nos dois lados (evidência no audit da parte 4).
- [ ] 4. O dado funciona pelo servidor: `rollDice` só aplica o valor após
      `DICE_RESULT` e os dois lados exibem o mesmo número.
- [ ] 5. Modo local intacto: `game.html` inalterado em comportamento,
      `window.PvpSession` continua `undefined` nele, e
      `node tests/unit/run-tests.js` → exit 0 (150 pré-existentes + os da parte 3).
- [ ] 6. `pvp.html` não carrega `tests/browser/*` nem passa a usar fonte
      diferente do `game.html` (Cinzel via CDN + `src/css/game.css`).
- [ ] 7. Craftsmanship Gate: os hooks em `src/js/game.js` são guardas curtas
      (`if (window.PvpSession?.intercept(...)) return;`) sem duplicar o corpo dos
      handlers; todo CSS novo vive em `src/css/pvp.css`; nenhuma alteração em
      `game.html`, `game.css`, `card-rules.js` ou `game-engine.js`.

## Scope

- `pvp.html` (novo) — fork do `game.html`: mesmo `game-container`, modais e
  áudios; acrescenta `data-seat`, badge de conexão/turno do oponente, e carrega
  `src/js/pvp-protocol.js`, `pvp-state.js`, `pvp-session.js`, `pvp-game.js`
  **depois** da ordem atual de scripts (`game.html:171-177`).
- `src/css/pvp.css` (novo) — espelhamento de perspectiva por `data-seat`,
  verso de carta, badges de status; nenhuma regra movida de `game.css`.
- `src/js/pvp-game.js` (novo) — bootstrap PvP: parse do assento pela URL,
  conexão via `PvpSession`, `MATCH_START` (config, assento inicial, seed e deck
  privado), `resetMatchState` com `createPvpIdFactory`, renderização da mão
  alheia por contagem/verso, `DICE_RESULT` → `rollDice`, e bloqueio dos controles
  quando não é o turno local.
- `src/js/game.js` — apenas as guardas de interceptação nos pontos de mutação
  listados no Context, em cada um: `if (window.PvpSession?.intercept({cmd, args})) return;`
  e, na aplicação remota, execução síncrona (sem `setTimeout` de animação).

## Anti-scope

- Não forkar `src/js/game.js` nem criar uma segunda cópia da UI.
- Não implementar `GAME_OVER`, reconexão, rematch ou `ABILITY` manual — parte 5.
- Não alterar regras, motor, `game-state.js` ou o formato de id do modo local.
- Não criar efeitos visuais novos, animações, temas ou som além do que já existe.
- Não implementar espectador, chat ou placar.
- Não mexer em `index.html`.

## Technical Decisions

1. **Fork do HTML, não da UI**: duplicar `src/js/game.js` significaria que cada
   ajuste futuro de regra/UI teria de ser feito duas vezes — o histórico de
   `.vibeflow/decisions.md` (Trox, Roller, `getEffectiveCardCost`) mostra que
   esses ajustes são frequentes. As guardas custam ~10 linhas em `game.js` e
   mantêm o modo local sem `PvpSession`.
2. **Espelhamento por `data-seat`**: `grid-template-areas` permite trocar a
   perspectiva em uma regra, e as media queries de `game.css` só alteram
   colunas/linhas, então o espelhamento sobrevive a todas as resoluções.
3. **O autor também aplica pelo broadcast**: o cliente não muta estado local e
   "avisa" o servidor — ele envia o comando e espera aplicá-lo na ordem do
   servidor. Isso elimina divergência entre os dois lados ao custo de ~1 RTT
   local (imperceptível em LAN).
4. **Aplicação remota síncrona**: caminhos com `setTimeout` (`game.js:368`,
   `832`, `1568`) precisam de variante síncrona durante a aplicação remota, senão
   o oponente interage com estado ainda não assentado.
5. **Verso em vez de vazio**: a mão alheia mantém a contagem visível (requisito
   do PRD) e reaproveita os placeholders da parte 3, que já são a fonte do
   comprimento.
6. **`showDeckInfo` só do próprio deck**: os decks do oponente são segredo do
   jogo; exibir estatística do deck alheio seria vazamento de informação.

## Applicable Patterns

- `patterns/card-dom-rendering.md` — estados visuais por `classList`, DOM de
  carta criado por `createCard`, sem inline style novo.
- `patterns/game-state-management.md` — `gameState` único, stats via
  `GameStateModel`, sem espelho em DOM como fonte de verdade.
- `patterns/card-ability-system.md` — `cardAbilities` segue sendo ponte de
  feedback; nenhuma lógica por carta é adicionada na UI.
- Novo padrão (a documentar em `patterns/pvp-lockstep-sync.md`): sessão relay com
  comandos semânticos, interceptação nos handlers e estado oculto por contagem.

## Risks

- **Risco**: as guardas em `game.js` deixarem passar algum ponto de mutação e a
  partida divergir silenciosamente.
  - *Mitigação*: `STATE_HASH` após cada comando (parte 3) detecta a divergência e
    pede `COMMAND_LOG`; o audit da parte 4 compara os dois `stateHash` até o fim
    da partida.
- **Risco**: `destroyCard` e `data.equipment.push` mutam estado fora do motor
  (`game.js:905-910, 2115-2118`) e ficam fora de ordem entre os clientes.
  - *Mitigação*: a limpeza pós-combate é enviada como comando `DESTROY` e a
    mutação de `data.equipment` é derivada do ledger (é efeito do mesmo
    `EQUIP`); correção estrutural fica registrada como dívida técnica.
- **Risco**: o modo local regredir com as guardas novas.
  - *Mitigação*: `window.PvpSession` é `undefined` em `game.html` (DoD 5) e a
    suíte de 150 testes é o gate.
- **Risco**: o layout espelhado quebrar em telas pequenas.
  - *Mitigação*: o espelhamento só troca nomes de área; as media queries
    permanecem válidas porque não referenciam nomes de área.
- **Risco**: latência percebida como travamento por o clique não ter resposta
  otimista.
  - *Mitigação*: desabilitar/indicar "aguardando servidor" no botão de fase
    enquanto o comando não volta; otimismo fica fora do escopo.

## References

- `game.html:12-112` — estrutura do tabuleiro a ser forkeada.
- `src/css/game.css:40-69, 424-505` — grid e media queries que o espelhamento
  precisa respeitar.
- `src/js/game.js:1053-1065, 1118-1160, 1426-1599, 2013-2153, 743-878, 185-221` —
  handlers que recebem as guardas.
- `src/js/deck_system.js:479-532` — `startNewMatch` / `drawCardFromDeck`, o fluxo
  de setup que o bootstrap PvP substitui por dados do servidor.