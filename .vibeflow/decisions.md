# Decision Log
> Newest first. Updated by the architect during specs and audits.

## 2026-09-21 — Regras do jogo no lobby PvP (botão + modal, igual ao index.html)
Pedido: "na tela do lobby do pvp, temos que ter um botão com modal das regras do
jogo, assim como temos em index.html".

Causa: o modal de regras existia **só** no `index.html` (`.modal-overlay` /
`.modal-content` / `.rules-text` + `showRulesModal`/`closeRulesModal`). O
`pvp-lobby.html` é uma página autocontida (bloco `<style>` próprio, sem
`src/css/game.css`) e não tinha nem o botão nem o CSS do modal — quem abria o
lobby não tinha acesso às regras, apesar de jogar o mesmo jogo.

Decisão: o lobby recebe o mesmo modal, com o conteúdo **idêntico** ao do
`index.html`, e com dois caminhos extras de fechar.
- **`pvp-lobby.html` (HTML)**: `<button id="rules-button" class="secondary"
  onclick="showRulesModal()">Regras do Jogo</button>` no `.action-row` (junto de
  Criar partida / Atualizar / Nova partida, e **nunca `disabled`** — não depende
  de sala) e `#rules-modal.modal-overlay` com o mesmo texto das 5 seções
  (Objetivo, Energia, Fases, Combate, Mecânicas Adicionais). O índice é `h2` +
  `h3` + `p`/`ul`, idêntico ao `index.html` — travado por teste.
- **`pvp-lobby.html` (CSS)**: as regras de `.modal-overlay` / `.modal-content` /
  `.rules-text` foram copiadas para o bloco local (mesma linguagem: overlay
  `position: fixed` + `inset: 0`, `visibility/opacity` com transição, conteúdo
  `max-height: 80vh` + `overflow-y: auto`) porque a página não carrega o CSS do
  board.
- **`pvp-lobby.html` (JS)**: `showRulesModal()` / `closeRulesModal()` trocando a
  classe `visible`, mais fechar por **clique no fundo escuro** (`evento.target ===
  modalDeRegras`, para não fechar ao clicar dentro do texto) e por **Esc**.

Evidências: **203/203** em `node tests/unit/run-tests.js` (teste novo: botão,
modal, as duas funções, os três caminhos de fechar, CSS do overlay e — o mais
importante — `deepEqual` dos `h3`/`p` contra o `index.html`, para o texto não
divergir) e **19 PASS / 0 FAIL** em `node tests/browser/run-browser-tests.js`,
com o novo `tests/browser/test_pvp_lobby_rules.js` (13 checks rodando em
`pvp-lobby.html` via o novo `LOBBY_CONSOLE_SCRIPTS` do runner: abre pelo clique
real, cobre a viewport, cabe na tela com rolagem interna, 5 seções iguais às do
index, fecha no ×/fundo/Esc e reabre). O teste do Esc é comprovadamente vermelho
ao remover o listener de `keydown`. Screenshot CDP conferido: modal aberto em
600×643 px sobre o lobby com o × no canto. `py -3 tests/pvp/smoke_match.py` segue
com todos os checklists OK.

## 2026-09-21 — Tlantidu: a carta buscada ao morrer aparecia no estado, não na mão
Sintoma (relatado jogando): "Tlantidu ao morrer não trouxe carta do tipo aquática
para a mão — deveria trazer caso exista e apresentar um disclaimer".

Causa: a busca é do **motor** e funcionava (os testes de `card-rules.js` já
cobriam: a aquática ia para a mão do dono em `resolveCombat`). O que não
acontecia era a **UI**: `performAttack` só reprojetava a mão no bloco
`returnedToHand` (atacante/alvo que voltam à mão por efeito próprio), então um
`MOVE_CARD` deck→mão vindo da reação de morte ficava invisível — a carta existia
em `zones.hand`, o DOM e o contador da mão não mudavam, e nada era anunciado.
Medido com o CDP: 4/9 checks antes da correção (mão renderizada, contador e
aviso vermelhos; o estado já estava certo).

Decisão: a UI sincroniza a mão depois de qualquer combate e explica o efeito.
- **`src/js/game.js`**: `instantaneoDasMaos()` tira um snapshot dos `instanceId`
  das mãos **antes** do `resolveCombat`; `sincronizarMaosDoCombate(maosAntes)`
  reprojeta a mão só quando algo entrou/saiu (cobre Tlantidu, Zol, ETC sem
  renderizar à toa); `anunciarBuscaDoTlantidu(result.defeated, maosAntes)` é o
  disclaimer: diz qual carta veio (`Tlantidu: <nome> foi buscada no deck e entrou
  na mão.`) ou avisa `Tlantidu: não havia monstro aquático no deck.` Em PvP a mão
  alheia é contagem, então a identidade só é revelada para o assento local
  (`podeRevelar = !window.PvpSession || dono === assentoLocal()`), com mensagem
  genérica para o oponente. O canal é o `showAbilityFeedback` das habilidades.
- **`src/js/card-rules.js`**: `card_038` ganhou `feedback` em `COMBAT_RULES`
  (mesmo lugar do Fantom, `card_042`) — o disclaimer preventivo aparece na
  invocação pelo `getFeedback` que o `onCardSummoned` já usa.

Evidências: **202/202** em `node tests/unit/run-tests.js` (teste novo: feedback
do `card_038` + o fluxo de snapshot/sincronização/anúncio na fonte do
`performAttack`) e **18 PASS / 0 FAIL** em `node tests/browser/run-browser-tests.js`
com o novo `tests/browser/test_tlantidu_death.js` (10 checks: a aquática do deck
entra na mão renderizada e no contador, a não aquática fica no deck, o
disclaimer nomeia a carta, e sem aquática no deck a mão fica intacta com o aviso
de ausência). O teste é comprovadamente vermelho sem a correção (4/9) — foi
escrito antes dela. `py -3 tests/pvp/smoke_match.py` segue com todos os
checklists OK.

## 2026-09-21 — Dado da Sorte com ícones de face e estado "já jogado" no CSS
Pedido: "não temos ícones de dados com os valores aplicados, tipo dice-1, dice-4"
e "depois de jogado o dado é que o botão ficasse desativado em CSS".

Causa do visual atual: o resultado saía como **número** no botão (sem ícone de
face) e o `:disabled` era genérico (`#666` + `opacity .5`), com a classe
`dice-settled` ficando no botão depois da animação — o estado "usado" não era
declarado em CSS.

Decisão: a face é o ícone do dado e o repouso do botão é discreto; o estado
"já jogado" é o `:disabled` do CSS.
- **`assets/dice/dice-1.svg` … `dice-6.svg`** (novos): dado marfim com os pips
  da face, desenhados para o círculo escuro com anel dourado.
- **`src/css/game.css`**: `.dice-button` passou a ser neutro no repouso
  (`--secondary-color` + `border: 2px solid var(--primary-color)`; o dourado
  cheio continua no `:hover`, herdado do `.mini-button`) — era o bloco dourado
  que chamava atenção ao lado da energia. `.dice-face-1`…`dice-face-6` ligam o
  `background-image` de cada ícone. `.dice-button:disabled` agora é o estado
  "usado": fundo `--field-color`, anel cinza, `filter: grayscale(1)`,
  `opacity: .45`, `cursor: not-allowed`. `.dice-rolling`/`.dice-settled`
  garantem `filter: none; opacity: 1` para o giro e o quique aparecerem mesmo
  com o botão desabilitado (dado do oponente no PvP).
- **`src/js/game.js`**: `DICE_FACES`, `marcarFaceDoDado` (classe `dice-face-N`
  + `data-face`), `limparFaceDoDado`, `iniciarGiroDeFaces`/`pararGiroDeFaces`
  (`setInterval` de 90ms por botão num `WeakMap` — os dois lados podem rolar em
  PvP, e a primeira face entra na hora). No resultado, o giro para, a face
  sorteada fica no botão e a classe `dice-settled` sai 500ms depois, deixando o
  `:disabled` cuidar da aparência. `resetGame` limpa face, classes e para o giro.
- Bug colateral: o `setTimeout` de 800ms da rolagem local sobrevivia ao
  `resetGame` e aplicava o resultado na partida nova. Ganhou a mesma guarda de
  geração dos outros timers (`generation !== window.matchGeneration`).
- Layout da pílula: o dado saiu de lado do número e foi para a **linha de baixo**
  (`game.html`/`pvp.html`: `class="stat stat-energy"`; `game.css`:
  `.stat-energy` em `grid` com `Energia: N` na linha 1 e o
  `.stat-energy .dice-button` ocupando as duas colunas da linha 2). Grid explícito
  para não depender da ordem dos filhos e manter o botão como filho direto da
  pílula (o `+N` continua ancorado nele). O dado ficou centralizado na horizontal
  e abaixo do valor — medido no CDP: dado em `y=304,8` contra valor terminando em
  `y=297,7`, centros alinhados em `x≈145,4`.
- Já jogado, o dado fica **bem apagado e inerte**: `.dice-button:disabled` com
  `filter: grayscale(1) brightness(0.7)`, `opacity: .35` e `cursor: not-allowed`.
  O `:hover` do `.mini-button` virou `.mini-button:not(:disabled):hover` porque o
  seletor cru deixava o dado usado **dourado e maior** sob o mouse (parecia
  disponível), com `.dice-button:disabled:hover` zerando o `transform` para o caso
  do ponteiro já estar em cima quando o botão desabilita. O clique não faz nada:
  o `disabled` do botão bloqueia o `onclick` e o teste dispara `.click()` para
  provar que nem custo, nem giro, nem novo resultado acontecem.

Evidências: 201/201 em `node tests/unit/run-tests.js` (4 testes do dado, os
ícones e o `:disabled`) e 17 PASS / 0 FAIL em `node tests/browser/run-browser-tests.js`
com o `tests/browser/test_dice_roll.js` (28 checks: face marcada pelo ícone,
`backgroundImage` = `dice-N.svg`, estado usado pelo CSS computado, giro com
faces trocando, reset). Vermelho confirmado removendo `filter: grayscale(1)` do
`:disabled` (1 teste de unidade + 1 check do browser falham). Screenshot CDP
conferido com o dado mostrando a face 4 e o "+4" subindo.

## 2026-09-21 — Dado da Sorte: alinhado na pílula e resultado sem quebrar o layout
Sintoma: o dado aparecia fora do centro da pílula de energia e o "+N" do
resultado empurrava o conteúdo do botão (a pílula dançava a cada rolagem).

Causas: (1) `.control-buttons` (`margin-top: 3px`) envolvia o botão e o próprio
botão tinha um `margin-top: 4px` **inline** — 7 px de desalinhamento contra o
`align-items: center` do `.stat`; (2) `.dice-result-floating` **não tinha regra
nenhuma** em `game.css`: o `+N` era um `div` em fluxo dentro do `<button>`, então
entrava no layout do botão; (3) o feedback era um `showMessage` centralizado, que
cobria o tabuleiro.

Decisão: o dado é filho direto da pílula e o resultado aparece **no próprio
dado**.
- **`game.html` / `pvp.html`**: `<button class="mini-button dice-button">` direto
  no `.stat` (sem wrapper, sem margem inline) — o alinhamento passa a ser o do
  `align-items: center` da pílula.
- **`src/css/game.css`**: `.control-buttons` e a animação antiga (`@keyframes
  diceRoll` / `.dice-animation`) saíram. `padding: 0; line-height: 1` no
  `.mini-button` centraliza o glifo; `.dice-button` é `position: relative`;
  `.dice-rolling` roda `diceTumble 0.4s linear infinite` enquanto espera;
  `.dice-settled` entra com `diceSettle` (quique); `.dice-result-floating` é
  `position: absolute` + `pointer-events: none` subindo com `diceResultFloat`
  (fora do fluxo, por isso não empurra nada); `.energy-value.energy-gain-dice`
  pulsa com `energyGainDice` (a animação vence o `transform` inline do
  `changeStat`).
- **`src/js/game.js`**: `animarResultadoDoDado` (pulso + flutuante);
  `rollDice` troca classe de rolagem por resultado, mostra a face no botão
  (`textContent` **e** `data-face` — o flutuante é filho, então `textContent`
  leria "5+5"), tira o `showMessage` central, tem rede de segurança de 5 s se o
  resultado não voltar no PvP e título com o valor. `resetGame` devolve 🎲 e
  limpa `dice-rolling`/`dice-settled`/`data-face`/`dataset.diceRolled` — este
  último era um bug: sobrevivia ao reset, a guarda de aplicação dupla retornava
  cedo e o dado da partida seguinte não dava energia nenhuma.

Evidências: 200/200 em `node tests/unit/run-tests.js` (3 testes novos: HTML sem
wrapper/margem, CSS das animações e do flutuante, `rollDice`/`resetGame`) e
17 PASS / 0 FAIL em `node tests/browser/run-browser-tests.js`, com o novo
`tests/browser/test_dice_roll.js` (23 checks: dado centrado na pílula, face
sorteada, custo/ganho de energia exatos, "+N" absoluto, pílula sem crescer nem
estourar, dado já usado inerte, reset devolvendo o dado). Vermelho confirmado
trocando `position: absolute` do flutuante por `static` (1 teste de unidade + 1
check do browser falham).

## 2026-09-21 — A área de saque passou a mostrar as cartas restantes
Pedido: "a quantidade de cartas restantes devem aparecer na área de sacar" —
o tabuleiro dizia "Clique para sacar" sem dizer se ainda havia carta para
comprar, e o único jeito de saber era o gear "Decks" (modal).

Decisão: o contador é uma **view da zona `deck` do estado**, não um contador
paralelo — quem compra mexe no array, o rótulo só o lê.
- **`game.html` / `pvp.html`**: `<div id="deck-count-p1|p2" class="deck-count">`
  dentro de cada área de saque (`.player1-deck` / `.player2-deck`), ao lado do
  hint de compra existente.
- **`src/css/game.css`**: `.deck-count` (10px, cor primária, dentro da caixa do
  slot) e `.deck-count[data-empty="1"]` na cor de alerta (`--pv-zero-color`) —
  zero cartas precisa gritar, é o que decide se ainda dá para comprar.
- **`src/js/game.js`**: `updateDeckCounter(player)` lê
  `gameState.players[player].zones.deck.length` e escreve texto + `data-count` +
  `data-empty`; repintado em `renderHandsFromState` (boot, F5/replay, DRAW do
  ledger), em `addCardToHand` (clique de compra) e em `updateUI` (repaint geral,
  por onde passam os efeitos que puxam do deck, ex. Zol).
- **`src/js/pvp-game.js`**: `atualizarContadoresDeMao` repinta o deck junto da
  mão — o deck oculto do oponente encolhe a cada `DRAW` replicado. Exibir o
  **tamanho** do deck alheio não fere a decisão 6 da spec parte 4 (o segredo é a
  *composição*): o servidor já publica `opponentDeckSize` no `MATCH_START` e a
  contagem de mão em cada comando.

Evidências: 197/197 em `node tests/unit/run-tests.js` (4 testes novos: markup de
`game.html`/`pvp.html`, CSS, origem do número em `game.js`, repaint em
`pvp-game.js`) e 16 PASS / 0 FAIL em `node tests/browser/run-browser-tests.js`
(22 checks no hotseat + 10 no PvP, incluindo o rótulo dentro da caixa do deck sem
overflow). Confirmado vermelho removendo o `<div>` de `pvp.html` (2 testes de
unidade falham) e o `updateDeckCounter(player)` de `addCardToHand` (3 checks do
hotseat e 7 do PvP falham).

## 2026-09-21 — Overlay de fim de partida voltou a aparecer no PvP (e agora leva ao lobby)
Sintoma: acabava a partida no PvP e nada acontecia na tela — o `tratarFimDePartida`
rodava (overlay no DOM, botões travados, vinheta) mas o jogador não via o
resultado.

Causa: o overlay nasce com `class="pvp-overlay"` no fim do `<body>`, e
`src/css/pvp.css` não tinha nenhuma regra `pvp-overlay*`. Sem `position: fixed`
o bloco cai no fluxo **depois** do tabuleiro (`.game-container` = 100dvh) e o
`body { overflow: hidden }` recorta tudo: o overlay existia e ficava fora da
janela. Medido com o CDP: `position: static` → 3 checks vermelhos (não cobre a
viewport, topo fora do canto); `fixed` → verde.

Decisão: o fim de partida no PvP é um overlay fixo, na linguagem visual do
`game.html`, com o caminho de volta para o lobby.
- **`src/css/pvp.css`**: `.pvp-overlay` (`position: fixed`, `inset: 0`,
  `z-index: 2000`, backdrop) + `.pvp-overlay-card`, `.pvp-overlay-detail` e
  `.pvp-primary-link` (CTA dourado), usando só os tokens do `game.css`.
- **`src/js/pvp-game.js`**: título com o nome do vencedor no padrão da casa
  (`Jogador X venceu!`, via `GameStateModel.getPlayerName`), linha na
  perspectiva do assento ("Você venceu/perdeu"), detalhe `Sala · turno · motivo`
  e CTA **`<a href="/pvp">Voltar ao lobby</a>`** — o `?nova=1` anterior era
  inerte (o lobby ignora a query) e não era `<button>` de propósito: o fim de
  partida desabilita todo botão da página. `montarPartida` repõe o overlay
  quando o `MATCH_START` traz `state.resultado` (sala finalizada + F5).

Evidências: 193/193 em `node tests/unit/run-tests.js` (teste novo de fonte+CSS)
e 14 PASS / 0 FAIL em `node tests/browser/run-browser-tests.js`, com o novo
`tests/browser/test_pvp_game_over.js` (16 checks: ausência do overlay com a
partida viva, cobertura da viewport, vencedor, CTA e a reposição no F5),
confirmado vermelho ao trocar `position: fixed` por `static`. Screenshot CDP
conferido com o overlay sobre o tabuleiro.

Pendência detectada (não corrigida): `atualizarBadges` escreve em
`#pvp-status`, elemento que **não existe** em `pvp.html` — o badge de
conexão/turno prometido na spec parte 5 é inerte hoje. Falta decidir onde ele
fica na tela antes de existir.

## 2026-09-21 — Carta em campo não muda de tamanho por causa do destaque de seleção
Sintoma (PvP e hotseat): depois de alguns cliques, UMA carta do campo aparecia
maior que as vizinhas (149,2×198,9 ao lado de 135,6×180,8, com o topo ~9 px
acima) — sem nenhum comando de rede envolvido, o servidor seguia com os dois
lados idênticos.

Causa: `selectCard` marca a carta clicada com `.card.selected`, e `game.css`
dava `transform: scale(1.1)` nessa classe. Na mão o arco (`:nth-child`, 0,3,0)
tem especificidade maior e engolia o scale; no campo não existe regra
concorrente, então o destaque do clique crescia a carta. Pior: o elemento da mão
é movido (não recriado) para o campo em `dropCard`, então a última carta clicada
levava a classe junto — e como `selectCard` limpa `.selected` de todas antes de
marcar a próxima, o resultado é sempre "uma única carta maior" na mesa.

Decisão: estado visual nunca muda o tamanho da carta; seleção é só cor/brilho.
- **`src/css/game.css`**: `.card.selected` fica com `border-color` + `box-shadow`
  e sem `transform` (a escala nunca teve efeito na mão de qualquer forma).
- **`src/js/game.js`**: `dropCard` remove `selected` da carta que entra no campo
  e zera `gameState.selectedCard` — o destaque do clique não viaja para a mesa.

Evidências: sonda headless mediu as 3 cartas em campo em 135,6×180,8 depois do
fix (antes, a última clicada: 149,2×198,9); 192/192 em
`node tests/unit/run-tests.js` (dois testes novos: fonte de `dropCard` e
`.card.selected` sem `transform`) e 13 PASS / 0 FAIL em
`node tests/browser/run-browser-tests.js`, com o novo
`tests/browser/test_field_card_size.js` (7 checks) confirmado vermelho ao
reintroduzir o `scale(1.1)` sem a limpeza no `dropCard`.

## 2026-09-21 — Contagem de cartas na mão passa a ser publicada pelo websocket
O contador exibido (`hand-title-<p>` com `data-count`) era sempre
`state.players[<p>].zones.hand.length` recontado no cliente. Nos dois assentos
isso é derivado do mesmo ledger, mas nada garantia que o número exibido fosse o
que o servidor aceitou: um efeito que mexe na mão (Trox devolvendo carta, compra
por habilidade) e o corte de limite no cliente eram invisíveis para o outro lado.

Decisão: a contagem vira um campo replicado do servidor, e o cliente só exibe o
que recebeu.
- **`server.py`**: `Room.hand_sizes` (+ `HAND_DELTAS` = `DRAW` +1, `SUMMON`/`EQUIP`
  −1, o que o servidor sabe contar sozinho), `entry["hand"]` no ledger,
  `handSizes` em todo `COMMAND` aceito e no `COMMAND_LOG`, `maos` no
  `public_state` (portanto no `MATCH_START`/`ROOM_STATE` e no espelho em disco),
  mensagem nova `HAND_SIZE {hand}` (o dono publica o que só o motor sabe) com
  broadcast `HAND_SIZES`, e `validate_command` recusa `DRAW` com a mão cheia —
  o corte do limite deixa de ser só do cliente.
- **`src/js/pvp-session.js`**: `handSizes`/`handSizeOf`/`setHandSizes` +
  `publicarContagemDeMao()` (só publica quando o valor muda).
- **`src/js/game.js`**: `updateHandCounter` prefere `handSizeOf(player)` e cai no
  estado local fora do PvP; `publicarContagemDivergente` publica `HAND_SIZE`
  quando o motor local muda a mão (nunca durante replay/aplicação);
  `window.updateHandCounter` exposto para o repaint.
- **`src/js/pvp-game.js`**: `atualizarContadoresDeMao` repinta os contadores a
  cada mensagem com contagem do servidor e, para a mão alheia, chama
  `PvpState.resizeHiddenZone` — o leque exibido passa a ter exatamente os versos
  que o servidor anunciou (no `MATCH_START` o ajuste é pulado: quem constrói a
  mão do oponente é o `COMMAND_LOG` da abertura).
- **`src/js/pvp-state.js`**: `resizeHiddenZone(state, ownerId, zone, n)` completa
  com placeholders sem identidade (índice derivado do maior em uso, para não
  colidir com o deck oculto) ou remove o excesso do fim, mantendo
  `cardInstances` e os aliases legados coerentes.

Evidências: 190/190 em `node tests/unit/run-tests.js`, 29/29 no
`tests/browser/test_pvp_draw.js` (12 PASS / 0 FAIL na suíte de browser) e
`py -3 tests/pvp/smoke_match.py` com `maos` 5/5 no `MATCH_START`, `handSizes`
do `DRAW` igual nos dois lados, `HAND_SIZE` replicado, `DRAW` de mão cheia
recusado e o espelho registrando `{"p1": 5, "p2": 7}`. Detalhes do padrão em
[patterns/pvp-lockstep-protocol.md](patterns/pvp-lockstep-protocol.md).

## 2026-09-13 — Fechado o gap de custo do Trox/Roller
Fechamento da limitação #1 registrada na entrada da Fase 6 ("039 Trox / 069
Roller — cláusulas de custo dependiam do fluxo de invocação por arrasto em
`game.html`, que lia `cardData.data.cost` direto").

Mudanças:
- **`src/js/card-rules.js`**: a habilidade de 039 Trox agora também emite um
  `ADD_MODIFIER` (`stat: 'cost'`, `SET 0`, `PERMANENT_ON_INSTANCE`) junto do
  retorno à mão, tornando a próxima invocação de fato gratuita. O modificador
  de 069 Roller (emitido em `CREATURE_DESTROYED`) trocou o stat livre
  `costPenalty` (nunca lido por ninguém) para `stat: 'cost'` com `ADD 1`,
  que já é o nome que `getEffectiveStat(instanceId, 'cost')` lê nativamente
  — nenhuma mudança de engine foi necessária, só o nome do stat no
  modificador.
- **`game.html`**: novo helper `getEffectiveCardCost(cardId, cardData)`
  (usa `gameEngine.getEffectiveStat(cardId, 'cost')` quando a instância já
  está registrada no motor, com fallback para o custo bruto do catálogo).
  Substituído `cardData.data.cost` por esse helper nos 4 pontos que faziam
  gating de invocação por arrasto (`highlightSummonableCards`, `dragStart`,
  `dropCard` — highlight de campo/suporte, alerta de energia insuficiente e
  o custo efetivamente cobrado em `SUMMON_CARD`) e no badge de custo exibido
  no card da mão (`createCard`), para não mostrar um número que diverge do
  que será cobrado.
- **`tests/unit/run-tests.js`**: teste do Trox passou a afirmar
  `getEffectiveStat(..., 'cost') === 0` após a habilidade; teste do Roller
  passou a afirmar `getEffectiveStat(..., 'cost') === 3` (custo base 2 do
  fixture + 1 de penalidade) em vez de inspecionar o modificador bruto.

Validação: `node tests/unit/run-tests.js` → 141/141; smoke test no
navegador confirmando que `getEffectiveCardCost` (usado por `game.html`)
concorda exatamente com `gameEngine.getEffectiveStat` para uma instância de
Trox pós-habilidade (custo 0) e uma de Roller pós-morte (custo 7→8); sem
erros de console.

Escopo intencionalmente não tocado: **038 Tlantidu** continua inerte (gap de
tagueamento de trait `aquatico` no catálogo, item de dados e não de lógica —
não fazia parte deste pedido).

## 2026-09-13 — Fase 7 completada: remoção do legado
Escopo: `.vibeflow/specs/motor-habilidades-eventos-e-efeitos.md`, seção
"Fase 7 - Remoção do legado". Com as 110 cartas resolvidas pelo motor
(confirmado via `CardRules.isMigrated` cobrindo 100% do catálogo), todo o
caminho legado em `src/js/card-abilities.js` era código morto — nunca
executado, pois `onCardSummoned`/`onCardEquipped` retornavam cedo para
qualquer carta migrada, e `onSupportCardPlayed`/`onBeforeAttack`/
`onAfterAttack` não eram mais chamados por `game.html`.

Achado adicional: as primeiras ~229 linhas de `card-abilities.js` eram um
comentário de bloco (`/** ... */`) corrompido que continha, por acidente,
uma cópia inteira e não-executável do switch de invocação — puro ruído,
sem relação com o código real abaixo dele.

Mudanças:
- **`src/js/card-abilities.js`** reescrito de ~2400 linhas para uma ponte
  fina (~100 linhas): mantém apenas `attachEngine`, `reset`,
  `onCombatDeclared`/`onCombatResolved` (logs), `processTurnEffects`
  (no-op — os ticks já são resolvidos pelo motor via `TURN_STARTED`/
  `TURN_ENDED`), `onCardSummoned`/`onCardEquipped` (repassam o feedback de
  `CardRules.getFeedback`/`getEquipmentRule`) e `showAbilityFeedback`
  (notificação visual). Todas as ~100 funções de habilidade por carta, os
  switches de invocação/equipar/suporte/antes-ataque/depois-ataque e as
  helpers internas (`addPermanentEffect`, `addTurnEffect`,
  `hasUsedAbilityThisTurn` etc.) foram removidas — nenhuma delas era
  alcançável.
- **`game.html`**: removido o bloco de `canAttackTarget` que lia
  `cardAbilities.permanentEffects` (sempre vazio, pois nada mais escrevia
  nele) — as mesmas proteções (fofura, imunidade a habilidade, evasão,
  licantropia etc.) já são verificadas por
  `CardRules.validateAttackTarget`, confirmado por leitura direta de
  `card-rules.js` antes da remoção. Removidas as 7 tags `<script>` de
  `tests/browser/*.js` (diagnóstico de console, nunca eram testes
  automatizados) — os arquivos continuam no repositório para uso manual.
- **`src/js/manual_abilities.js`**: removida a entrada hardcoded do Mago
  Arcano (`card_055`) e o ramo `else if` que a acionava — a carta já é
  resolvida dinamicamente via `CardRules.getActivatedRule`, então o ramo
  legado nunca era mais alcançado; removida também a função
  `activateManualAbility` (sem chamador restante).
- **Docs**: `docs/PROGRESSO_HABILIDADES.md` reescrito com o status atual
  (110/110, 141/141 testes); `docs/RELATORIO_FINAL_HABILIDADES.md` recebeu
  um aviso de atualização no topo, mantendo o corpo como registro
  histórico da migração.

Validação: `node tests/unit/run-tests.js` → 141/141; `get_errors` limpo nos
3 arquivos JS/HTML alterados; smoke test no navegador (reload sem erros de
console, `onCardSummoned`/`onCardEquipped` disparando o feedback correto do
`CardRules` para uma carta ativada migrada e um equipamento migrado, painel
de habilidades manuais abrindo sem erro, ciclo de fim de turno completo sem
exceções); checagem de referências de `<script src>` quebradas = 0.

Gate da Fase 7 atendido: nenhuma regra de jogo depende mais de leitura/
escrita direta do DOM em `card-abilities.js`, e nenhuma carta migrada possui
caminho alternativo no motor legado (o "motor legado" como implementação de
regras deixou de existir).

## 2026-09-20 — Fase 6 completada: 30 cartas (Zonas, vínculos e habilidades especiais)
Escopo integral solicitado pelo usuário ("Fase 6 inteira de uma vez"), sem
sub-lotes. `075` Turtol Maximus já estava migrado (nenhuma ação necessária).
Fase 7 (remoção do legado) permanece bloqueada até auditoria desta fase.

Novo primitivo de engine: `RESET_ABILITY_USE` (EFFECT_KINDS), limpa
`card.usage[abilityId].turnCounts[turn]` transacionalmente — necessário para
o Duende (031) conceder uma ativação extra a um aliado.

Padrão novo consolidado: efeito `ATTACK_DISABLED` (genérico, substitui a
necessidade de um efeito por carta) consumido por um novo handler
`ATTACK_DECLARED` (prioridade 100) que cancela o combate sempre que o
atacante carrega esse efeito — usado por 005, 008, 027 (auto-alvo), 034,
049, 050, 082. Justificativa: `getAttackLimit()` nunca reduz o limite de
ataque abaixo de 1 via modificador, então "não pode atacar" só é
implementável cancelando o combate no `ATTACK_DECLARED`, que dispara mesmo
em ataques diretos sem alvo (diferente de `BECAME_ATTACK_TARGET`).

Novo handler `TURN_STARTED` centraliza três tiques por turno: `DEFENSE_DRAIN`
(005), `BURNING` (080) e `BILUGA_BOND` (027), além da compra extra do Tomo
de Feitiços Ancestrais (099) — todos vinculados ao `controllerId`/`playerId`
correto do payload, sem necessidade de contadores manuais (a duração
`FOR_TARGET_CONTROLLER_TURNS`/`UNTIL_SOURCE_LEAVES` já expira sozinha).

Decisões de modelagem por carta:
- **003 ETC**: `SUMMON_RULES`, remove ao entrar em campo todo inimigo com
  `cost < 3` para a mão do dono.
- **005 Zica do pantano / 015 11 de Setembro**: equipamentos com `effects()`
  customizado (imobilização via `ATTACK_DISABLED` + dreno/stats via
  `ADD_MODIFIER`/`DEFENSE_DRAIN`), sem bônus implícito de `modifiers`.
- **006 Adubaram / 007 Camisa 14 do América / 008 Cara de cu estourado**:
  modelados como `ACTIVATED_RULES` com `sourceZone: 'hand'` (habilidades de
  carta-suporte de uso único, descartando-se após o efeito). 007 funde o
  roubo de controle (`MOVE_CARD` com `destinationPlayerId` diferente) e o
  bônus de +10 ATK no MESMO alvo roubado, em vez de dois alvos separados —
  simplificação de modelagem (o engine só suporta uma escolha por ação).
- **011 Kirb**: cópia de habilidade restrita a habilidades **sem alvo**
  (`rule.maxTargets === 0`) de aliados com custo < 4, via novo
  `rule.targetsFn` e helper `buildRuleEffects` extraído do closure genérico
  de `createActivatedAbilityAction` (reuso). Habilidades com alvo próprio
  (`buildEffects` dependente de `context.selection`) foram deliberadamente
  excluídas do pool copiável para evitar colisão de semântica de seleção.
- **016 Baltz / 020 Gobra / 039 Trox / 091 Feitiço de Teletransporte**:
  ações de zero alvo que retornam a própria carta (ou o hospedeiro, no caso
  de 091) à mão do dono; adicionado helper `detachAttachedEquipment` que
  descarta equipamentos anexados quando uma criatura sai do campo para a
  mão (convenção comum de TCG, cobre "orfandade" de equipamentos).
- **027 Bilugatron**: vínculo `BILUGA_BOND` (dano de 10/turno via
  `TURN_STARTED`) + `ATTACK_DISABLED` auto-alvo + `defense SET 0`, tudo com
  duração `UNTIL_SOURCE_LEAVES` (o vínculo dura enquanto Bilugatron estiver
  em campo, sem limite de turnos).
- **031 Duende**: `targetsFn` retorna aliados com `ACTIVATED_RULES`
  registrada; `buildEffects` emite `RESET_ABILITY_USE` (novo primitivo).
- **038 Tlantidu**: busca no deck por criatura com trait `aquatico` ao ser
  destruído — **funcionalmente completo, porém inerte hoje** (nenhuma carta
  do catálogo tem essa trait). Gap de tagueamento de catálogo, não é
  decisão de produto bloqueante.
- **041 Gulosinho**: `TURN_ENDED` concede +5/+5 permanente se
  `usage.combatAttacks.count === 0` no turno que terminou.
- **045 Invocador das Trevas**: única exceção às cartas "bloqueadas" pelo
  gap de `game.html` (custo lido direto de `data.cost`, ignorando
  modificadores) — implementada como ação nova e independente com
  `action.costs` próprio (`energy: 1`) e emissão de `CREATURE_SUMMONED`,
  sem passar pelo fluxo legado de invocação por arrasto.
- **046 Salatiel**: "ignora defesa" reaproveita o padrão existente
  (056/064/078) de dano penetrante via `combat.penetratingDamage`; a
  criatura-alvo **não morre automaticamente** — o excedente vai direto para
  o PV do oponente, igual às demais cartas dessa família.
- **049 Entola Guela / 034 Medusa de Lama / 050 Shupáku / 082 Lobo Gamma
  Freeze**: variações de `ATTACK_DISABLED` com durações diferentes
  (`UNTIL_END_OF_OPPONENT_TURN`, `FOR_TARGET_CONTROLLER_TURNS`,
  `UNTIL_SOURCE_LEAVES`, todos-os-inimigos).
- **055 Mago Arcano / 085 Marik 2**: dano direto simples e "ataca todos os
  inimigos com o próprio ATK, depois `defense SET 0` permanente",
  respectivamente.
- **061 Alquimista Guardião**: primeira carta a usar `rule.targetsAllies`
  (nova opção em `getActivatedTargets`) para alvo aliado em vez de inimigo.
- **062 Alucard**: espelha a reanimação de `087` Superior, mas para o
  **campo** em vez da mão (`destinationZone: 'field'`), sem re-emitir
  `CREATURE_SUMMONED` (mesma simplificação já usada por 087 — reanimação
  direta, sem re-disparar gatilhos de invocação).
- **069 Roller**: retorna à mão ao morrer + modificador `costPenalty`
  (stat livre, não lido por nenhum sistema hoje) — **forward-compatible,
  porém inerte** até `game.html` consultar `getEffectiveStat('cost')` no
  fluxo de invocação legado.
- **093 Medalhão de Cura / 099 Tomo de Feitiços Ancestrais / 106 Escudo de
  Energia Estável**: 093 modelado como ativação manual 1x/turno (em vez de
  automática "ao final da Fase de Combate", simplificação de timing); 099 é
  totalmente automático via `TURN_STARTED` (compra extra); 106 é totalmente
  automático via `DAMAGE_DEALT` (+1 energia por dano recebido).

**Limitações conhecidas e documentadas (não bloqueantes para fechar a
Fase 6, mas pendentes de acompanhamento):**
1. **039 Trox / 069 Roller** — as cláusulas "invocado sem custo" e "custando
   um ponto a mais" dependem do fluxo de invocação por arrasto em
   `game.html`, que lê `cardData.data.cost` diretamente em vez de
   `engine.getEffectiveStat`. Fora do escopo desta migração de engine;
   registrado como tarefa de integração futura.
2. **038 Tlantidu** — nenhuma carta do catálogo tem a trait `aquatico`
   tagueada em `TRAITS_BY_DEFINITION`; a busca funciona mas nunca encontra
   alvo até o catálogo ser atualizado.

Testes: 141/141 (110 pré-existentes + 31 novos) via
`node tests/unit/run-tests.js`.

## 2026-09-13 — Fase 5 completada: lote final de 8 cartas (053, 067, 072, 081, 083, 087, 094, 107)
Fechado o gap remanescente da Fase 5 (Combate avançado) identificado por
análise cruzada spec × prompt-packs anteriores (5A1/5B1/5C1/5C2/5D1/5D2/5D4
só cobriam parte da lista). `090` Bilugação Astral segue de fora por
decisão de produto já registrada (termo "intransponível").

Decisões de modelagem deste lote:
- **053 Gárgula de Rocha**: "não pode ser atacada por criaturas de custo <
  5" modelado como novo check em `validateAttackTarget` (respeitando
  `bypassesAllDefenses` de Flecha de Prata); a troca ATK/DEF "ao ativar" é
  uma habilidade ativada self-target com dois efeitos `ADD_MODIFIER`
  (`SET`), `UNTIL_END_OF_TURN`.
- **067 Paladino Alvorada / 107 Lâmina Sagrada (lado ativado)**: "anula a
  habilidade do inimigo escolhido" modelado como efeito reativo
  `ABILITY_NULLIFIED` com duração `UNTIL_END_OF_OPPONENT_TURN` (expira
  sozinho via `advanceDuration` genérico); `preventMigratedEffect` passou a
  bloquear `APPLY_CARD_DAMAGE`/`CHANGE_PLAYER_STAT` cuja `provenance.sourceId`
  bate com o alvo anulado, quando `provenance.kind==='ability'`. 107 reusa o
  mesmo efeito mas com `sourceZone:'equipment'` e `targetFilter` restrito a
  alvos com trait vampiro/lobisomem — exigiu estender `getActivatedTargets`
  com suporte a `rule.targetFilter` opcional.
- **072 Gigante da Marreta**: espelha exatamente `card_051` Dino Elétrico
  (10 dano a todos os inimigos, sem custo extra de modelagem).
- **081 Latex**: dano de área dinâmico = `floor(ATK/2)` do próprio,
  calculado via `context.getEffectiveStat` no `buildEffects`, aplicado a
  todos os inimigos via `APPLY_DAMAGE_BATCH`.
- **083 Hidra das Profundezas**: "20 adicional a todas as outras criaturas
  do campo ao atacar" modelado no handler `AFTER_ATTACK` (`unregisterAfterAttack`,
  reestruturado para builder de múltiplas condições), sem limite por turno
  (dispara em todo ataque bem-sucedido, `!event.payload.cancelled`); dano
  mútuo padrão de combate (contra-ataque do defensor) continua se aplicando
  normalmente à Hidra — não é anulado pela habilidade.
- **087 Superior**: ganha `attackLimit SET 2` (mesmo padrão de 047/084); ao
  ser destruída, reanima para a mão a criatura/evolução descartada mais
  recentemente (busca reversa no array de descarte do controlador) — default
  determinístico conservador, mesma convenção usada em decks/descarte de
  outras cartas.
- **094 Pena do Gigante**: equipamento que adiciona efeito reativo
  `FEATHER_SHIELD` ao equipar; a checagem de cancelamento no handler
  `BECAME_ATTACK_TARGET` foi deliberadamente colocada fora dos guards de
  `bypassesAllShields`/`bypassesUntouchableShield`, ou seja, Flecha de Prata
  e Olho de Águia NÃO ignoram este escudo (não é um "escudo defensivo
  especial" no mesmo sentido de 002/092 — releitura literal do texto).
- **107 Lâmina Sagrada (lado equipamento)**: `requiredTraitsAny: ['elite',
  'paladino']`, sem modificadores de atributo (segue a convenção já
  registrada de que campos numéricos legados não são bônus implícitos).

Suíte de testes: 8 novos casos adicionados a `tests/unit/run-tests.js`
cobrindo as 8 cartas, usando helpers existentes (`createCombatFixture`,
`addFieldCreature`, `createAreaAbilityFixture`, `attachTraitEquipment`,
`emitSummoned`) sem inventar novos. Suíte final: 110/110 (102 preexistentes
+ 8 novos). Nenhuma regressão em `card-rules.js` fora do escopo destas 8
cartas. Fase 5 encerrada.

## 2026-09-13 — Fase 5D2 reauditada PASS após fechar o gap de cobertura do Olho de Águia
O único gap do audit anterior (FAIL) — 5 asserts negativos ausentes contra
`card_018` (CP-2), `card_025` (Zé Mulherzinha), `card_044` (Grifo Real),
`card_059` (Licantropia) e `card_060` (Tranca Rua) no teste "Olho de Águia
ignora somente Evasão e Intocável, não outras restrições" — foi fechado
dentro do mesmo teste (sem novo bloco `test(...)`), suíte em 102/102. Cada
assert configura o gate correspondente para realmente disparar (aliado extra
para Zé Mulherzinha, custo do atacante ≤ 4 explicitamente ajustado para o
gate do Grifo Real, campo do atacante com uma única criatura para
Licantropia, campo defensor com 2+ criaturas para Tranca Rua), evitando o
risco apontado no ciclo anterior de um assert "passar" por motivo errado
(ex.: bloqueio pelo próprio gate de custo do Grifo em vez de por Olho não
ignorá-lo). Nenhuma mudança em `card-rules.js`, `manual_abilities.js` ou
`game-engine.js` neste ciclo — confirmado por timestamps de arquivo e
leitura direta do conteúdo de `validateAttackTarget`, já que não há commit
intermediário isolando o estado do audit anterior (todo o lote 5D2 segue não
commitado sobre o mesmo `HEAD`). Ver
[audits/motor-habilidades-fase-5d2-prevencao-bypass-audit.md](audits/motor-habilidades-fase-5d2-prevencao-bypass-audit.md).
Fase 5D2 encerrada.

## 2026-09-13 — Escopo do lote 5D2 e semântica de bypass defensivo
Para `092` Cajado da Ilusão, `097` Flecha de Prata e `101` Olho de Águia:
"Intocável" (092) é modelado como um efeito reativo `UNTOUCHABLE_SHIELD`,
igual em mecânica ao `MAGIC_SHIELD` de Estrela Mágica (002): consome o
próximo ataque contra o equipado e é removido. A ativação é 1x/turno,
sem seleção de alvo (o alvo é sempre o próprio hospedeiro), e a fonte da
habilidade é o equipamento na zona `equipment`, não uma criatura em campo —
isso exige que a ação ativada aceite uma zona de origem configurável e que
o painel manual descubra habilidades também nas zonas de equipamento dos
jogadores, não somente no campo.

"Evasão" (058, citado literalmente no texto de Sábio da Montanha) e
"Intocável" (092) são os dois únicos conceitos que Olho de Águia (101)
ignora, por serem os únicos nomeados literalmente com esses termos no
catálogo; Olho NÃO ignora Estrela Mágica (002), Zé Mulherzinha (025), Grifo
Real (044), CP-2 (018), O Lica (059), Tranca Rua (060) ou Licantropia,
porque nenhum desses textos usa "evasão" ou "intocável".

Flecha de Prata (097) ignora "todas as habilidades especiais defensivas do
monstro alvo", interpretado como o conjunto completo de restrições de alvo
migradas (014, 018, 025, 044, 058, 059, 060) mais os escudos reativos
migrados (002 MAGIC_SHIELD, 092 UNTOUCHABLE_SHIELD) — é estritamente mais
amplo que Olho de Águia.

Bilugação Astral (090, "intransponível") permanece bloqueada por decisão
de produto já registrada; seu termo não é literalmente "intocável" e não
entra no escopo de bypass desta fase.

## 2026-09-13 — Fase 5D4 reauditada PASS após pacote incremental de cobertura
Os 3 gaps de teste do FAIL anterior (mesmo dia) foram fechados só em
`tests/unit/run-tests.js`: um assert inline em "Estaca concede +10 apenas em
host elegível contra Vampiro/Lobisomem" (host sem trait rejeitado por
`validateEquipmentTarget`), um novo teste "Estaca não concede bônus contra
alvo sem trait Vampiro/Lobisomem", e um novo teste "Manto do mesmo
controlador do Iron Dragon não é bloqueado". Suíte em 95/95;
`src/js/card-rules.js` confirmado sem diff frente ao commit já auditado
(`git diff --stat` só mostra `run-tests.js`, 36 inserções). Ver
[audits/motor-habilidades-fase-5d4-matchups-trait-audit.md](audits/motor-habilidades-fase-5d4-matchups-trait-audit.md).
Fase 5D4 encerrada.

## 2026-09-13 — Fase 5D4 auditada FAIL por cobertura de teste, não por bug de lógica
Manto da Luz Solar (095), Estaca do Caçador (102) e Manoplas de Gelo (105)
estão implementados corretamente (proveniência composta com a infra do 5D1,
sem stats implícitos, traits só via `TRAITS_BY_DEFINITION`), mas 3 dos 6
cenários adversariais exigidos pelo lote não têm assert dedicado em
`tests/unit/run-tests.js`: Estaca equipando host sem trait válida (rejeição),
Estaca contra alvo sem trait vampiro/lobisomem (sem bônus), e Manto vs Iron
Dragon do mesmo controlador do Manto (não deveria bloquear). Ver
[audits/motor-habilidades-fase-5d4-matchups-trait-audit.md](audits/motor-habilidades-fase-5d4-matchups-trait-audit.md).
Pitfall para specs futuras do motor de habilidades: exigir que o DoD liste os
cenários negativos/adversariais explicitamente como "testes obrigatórios",
não só o comportamento positivo — este lote descrevia os matchups em prosa
mas não obrigava o caminho de rejeição.

## 2026-09-12 — Defaults conservadores aprovados para habilidades ambíguas
O usuário aprovou aplicar os defaults recomendados da spec durante as Fases 4
e 5, registrando cada interpretação. Para o lote 4B: o texto da habilidade é
canônico e substitui os campos numéricos de suporte; debuffs sem prazo duram
enquanto a fonte permanecer equipada; e “acabou de ser invocado” vale até o
fim do próximo turno do adversário da criatura invocada. Expirar no próprio
turno da invocação tornaria Garras Afiadas inutilizável no fluxo alternado.
Cartas que exigem UI de ativação/seleção
são separadas em lote próprio para manter testes e orçamento auditáveis.

Para o lote 4C: ataque direto sem habilidade só é permitido quando o oponente
não controla criaturas; CP-2 força ataques contra si; “enquanto houver aliados”
significa outro aliado além da própria fonte; Estrela Mágica consome e anula o
próximo ataque; Atravessava dura enquanto equipado e Rego Freitas até o fim do
turno em que for equipado.

O usuário autorizou inferir traits pelo nome quando o catálogo não os declarar.
A implementação deve materializar a inferência em um mapa explícito por ID,
sem procurar substrings em runtime. Para K-023 e Dispositivo de Sincronia,
havendo vários robôs aliados, o bônus se aplica a todos os robôs elegíveis.
Para `elite`, o mapa inicial usa apenas títulos inequivocamente hierárquicos:
Rei das Feras, Lorde Sanguinário, Alquimista Guardião, Paladinos, Condessa,
Imperial X, Sentinela Solar e Superior. O mapa é explícito e pode ser revisado
sem alterar o parser ou inferir por substring em runtime.

Para o lote 5A1: Paladar compara a DEF restante do alvo ao ATK efetivo da
fonte; Hipool compara a DEF restante do alvo à DEF restante da fonte; “primeiro
ataque” significa primeiro ataque de cada turno; “ignorar N DEF” transforma N
pontos adicionais em penetração sem impedir o dano normal à criatura; “ignorar
toda DEF” faz o ATK completo penetrar no PV se o ataque for contra criatura.

Para o lote 5B1: reflexão de metade arredonda para baixo; Fantom retorna
automaticamente à mão e remove todo dano quando substituir a morte; efeitos
opcionais benéficos de abate (novo ataque e drenagem) são aplicados
automaticamente; drenagem transfere até 10 PV, limitada pelo PV disponível do
oponente; Aura de Vingança usa o ATK efetivo imediatamente anterior à morte.

Para matchups de traits: Vampiros são Lorde Sanguinário, Alucard e Condessa
Carmilla; Lobisomens são O Lica e a família Lobo; fogo é Quimera de Fogo e
Lobo Omega Pyro. Guerreiro/humanoide inclui Goblin Mestre de Armas, Minotauro
Guerreiro, Paladinos e Superior. Esses valores ficam em mapa explícito por ID.

## 2026-09-12 — Complete root organization implemented and audited
The repository root now contains only the two HTML entry points, primary
README, requirements, and configuration. Runtime JavaScript moved to
`src/js/`, audio to `assets/audio/`, browser diagnostics to `tests/browser/`,
secondary documents to `docs/`, and Python tools remain canonical under
`scripts/`. The unused `embedded_cards.js` duplicate was removed. Validation
passed for 20 HTTP resources, 110 loaded cards, all 10 JavaScript files,
all Python scripts, Markdown links, and the existing coverage reports. See
[audits/complete-root-organization-audit.md](audits/complete-root-organization-audit.md).

## 2026-09-12 — Root cleanup will preserve static entry points and proceed in phases
The target structure keeps `game.html`, `index.html`, `README.md`,
`AGENTS.md`, `requirements_ocr.txt`, and configuration at the root. Audio
moves to `assets/audio/`, runtime JavaScript to `src/js/`, browser tests to
`tests/browser/`, secondary documentation to `docs/`, and canonical Python
tools remain in `scripts/`. Ten root Python files were verified SHA-256
identical to their canonical `scripts/` copies, so they will be deleted
rather than moved. Ignored `debug_*.png` files have no active references and
will be removed instead of retained as source assets. See
[specs/complete-root-organization.md](specs/complete-root-organization.md).

The work is phased because audio and JavaScript moves change paths consumed
by both entry points, browser tests, and Python validators. `game.html` keeps
loading the existing development scripts during relocation; removing those
production includes is a separate behavior change, not part of structural
cleanup.

## 2026-09-12 — Part 4 (final) of project-structure refactor audited PASS — spec-writing pitfall
`check_cards.py`, `final_check.py`, `analyze_json.py` moved to `scripts/`,
now reading `data/cards_database.json`; `card-abilities.js` stays at the
repo root, untouched. See
[audits/refactor-project-structure-part-4-audit.md](audits/refactor-project-structure-part-4-audit.md).
Pitfall for future specs: [specs/refactor-project-structure-part-4.md](specs/refactor-project-structure-part-4.md)'s
DoD item 3 suggested `../card-abilities.js` as the path from `scripts/`,
which actively contradicts the CWD-relative-to-repo-root convention the
same spec family established in Parts 2-3 (scripts run as
`python scripts/foo.py` from the repo root, so `card-abilities.js` is
already reachable unprefixed — `../` would escape the repo). Implemented as
unchanged `'card-abilities.js'`, verified correct by actually running the
script. Future specs should avoid parenthetical path examples that assume
`__file__`-relative resolution when the project's established convention is
CWD-relative — state the resolution rule once and let it apply, don't
re-derive a literal example that can silently contradict it.

With this part, the "refactor-project-structure" initiative (images →
`assets/cards/`, data → `data/cards_database.json`, Python tooling →
`scripts/`) is complete — Parts 1-4 all audited PASS.

## 2026-09-12 — Part 3 of project-structure refactor audited PASS; pre-existing bug found
`create_cards_front_back.py` and `card_printing_advanced.py` (now in
`scripts/`) load `cards_database.json` as the raw dict (`{cards, total_cards,
types}`) and then iterate `for card in cards_data`, which walks the dict's
*keys* instead of the card list — `cards_by_image` ends up empty and printed
card sheets can't match real names/art to images. Confirmed pre-existing
(same JSON shape existed before the Part 1 move) via real execution during
the Part 3 audit — not a regression from this refactor, out of its scope to
fix. See [audits/refactor-project-structure-part-3-audit.md](audits/refactor-project-structure-part-3-audit.md).
Worth a dedicated hotfix/spec: fix both scripts to read `data['cards']`
like `create_cards_high_quality.py` already does correctly.
Also noted: `create_cards_high_quality.py` requires a `verso_card_kevao.png`
that has never existed in this repo and aborts before generating any output
without it — pre-existing, unrelated to the reorg.

## 2026-09-12 — Part 1 of project-structure refactor audited PASS
Card images now live at `assets/cards/` and the card database at
`data/cards_database.json` (moved from repo root); `deck_system.js` updated
accordingly. See [specs/refactor-project-structure-part-1.md](specs/refactor-project-structure-part-1.md)
and [audits/refactor-project-structure-part-1-audit.md](audits/refactor-project-structure-part-1-audit.md).
Pitfall for future work: the files were moved with `Move-Item`, not `git mv`,
so `git status` shows them as delete+untracked-add rather than renames —
harmless for content/behavior, but stage with `git add -A` (not selective
`git mv`) to keep history clean, and prefer `git mv` in future relocations
so rename detection stays intact. Parts 2–4 (Python script relocation) are
still pending and depend on this part.
