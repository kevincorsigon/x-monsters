# Decision Log
> Newest first. Updated by the architect during specs and audits.

## 2026-09-21 — Seleção de decks (hotseat + lobby PvP) e traits no modal da carta

Pedido: "tela de seleção de decks assim que o usuário ingressar na tela da partida",
com modal oferecendo deck aleatório ou decks prontos vindos de JSON (≥3, ≤40
cartas, balanceados por custo, agrupados por traits/suportes/tipos), visual de
cartas empilhadas com a cor de cada deck; e os **traits** no modal de detalhes da
criatura, além da habilidade.

Decisões de arquitetura:

- **`data/decks.json` é a fonte única dos presets** e guarda **só ids** de
  `data/cards_database.json` (nada de definição duplicada). Schema: `id`, `nome`,
  `tema`, `descricao`, `emblema`, `traits` (tema), `cores`
  (`primaria`/`secundaria`/`acento`) e `cartas[]` (id repetido uma vez por cópia).
  4 decks de 40: Legião Robótica (robotico), Matilha Selvagem (besta + evolução
  Turtol Maximus), Corte Dracônica (dragao/voador/elite) e Ordem dos Caçadores
  (humanoide/guerreiro/paladino/elite) — depois somados de Alcateia Lunar
  (lobisomem/besta/elite, ver bullet do quinto deck). Curvas: 13–29 cartas de
  custo 1–3, 10–22 de 4–6 e 1–9 de 7+, custo médio 3,08–4,65 e no máximo 3
  cópias por carta.
- **Suporte casa com o deck**: cada preset traz ≥3 hospedeiros reais para os
  suportes que exigem trait (`Dispositivo de Sincronia`/`Couraça`/`Escudo` →
  robotico, `Núcleo de Energia Pura` → dragao|elite, `Flecha de Prata` →
  humanoide|besta, `Estaca do Caçador` → guerreiro|humanoide, `Lâmina Sagrada` e
  `Aura de Vingança` → elite|paladino) e a evolução vem com a forma base
  (`card_048` para `card_075`). Um teste de unidade valida isso contra
  `CardRules.getEquipmentRule`/`hasTrait` — não é só estética.
- **Tamanho do baralho unificado em 40** (`DECK_SIZE`): `src/js/deck_system.js`
  (fonte), `src/js/pvp-game.js`, `server.py` e o default de
  `scripts/deck_factory.js`. Um teste trava a sincronia dos quatro (`const
  DECK_SIZE = 40` / `^DECK_SIZE = 40$` / `args.size || '40'`).
- **Um componente, dois modos** (`src/js/deck-select.js` + `src/css/deck-select.css`):
  `abrir()` no hotseat (modal bloqueante do boot; resolve com o id escolhido) e
  `renderizar(container, { onSelect })` no lobby PvP. A pilha usa
  `assets/verso.jpeg` em 5 versos girados, e a identidade de cada deck chega como
  CSS var `--deck-primaria/--deck-secundaria/--deck-acento` escrita a partir do
  JSON (dado de tema; o estado visual continua em classe). O botão do aleatório
  (`aleatorio`) entra como opção sintética, sem curva inventada.
- **Boot do hotseat**: `DOMContentLoaded` → `loadCardSystem()` (que agora também
  carrega `data/decks.json` em `window.deckCatalog`) → `await DeckSelect.abrir()`
  → `startNewMatch(escolha)`. O `p2` do hotseat entra com deck balanceado sorteado
  (o modal explica isso). Sem catálogo (fetch bloqueado/`file://`) `abrir()` resolve
  `null` e a partida segue aleatória — nenhum dataset alternativo embutido.
- **Reset preserva o deck, "Trocar deck" reabre o modal**: a escolha vive em
  `gameState.deckSelections` (inicializado em `GameStateModel.createInitialGameState`
  e propagado por `resetMatchState(state, decks, {...gameConfig, deckSelections})`),
  não num global paralelo. `startNewMatch()` sem argumento reusa a seleção;
  `resetGame(escolha)` fica **síncrono** (o `startNewMatch` não tem `await` interno),
  o que mantém os testes de browser existentes válidos.
- **Limite de turno de 45s** (a pedido): cada turno tem relógio e, ao estourar, a
  vez passa sozinha. Decisão de arquitetura: **o servidor é a autoridade** — o
  `cleanup_loop` confere os relógios a cada 2s e, quando o assento da vez passa de
  `limite_turno()`, registra um `END_TURN` **no ledger** (autor = assento da vez,
  com `timeout: true` na replicação) e faz o broadcast normal: os dois clientes
  aplicam a mesma transição pelo caminho de sempre (nada de relógios paralelos
  decidindo o jogo, o que furaria o lockstep). O servidor só passa a vez com os
  **dois assentos conectados**, então um F5 não faz a partida andar nas costas de
  quem caiu. `Room.turn_started_at` reinicia em cada `END_TURN` e no `start_match`;
  `public_state()` e o broadcast de `COMMAND` carregam `limiteTurno`/`prazoTurno`,
  e o cliente só **desenha** o contador a partir do relógio do servidor. No
  **hotseat** (sem servidor) o próprio cliente passa a vez quando zera (com a
  mesma guarda de geração de partida dos outros timers). Config:
  `gameConfig.turnSeconds` (45) e `DEFAULT_CONFIG.turnSeconds` (45); o
  `XM_TURN_SECONDS` do ambiente afina/desliga (0) o relógio do servidor — os
  smokes usam isso (o `smoke_match.py` roda com 0 para manter as contagens exatas
  do ledger, e o novo `tests/pvp/turn_timer.py` sobe o servidor com 2s e verifica
  o estouro, a replicação e o espelho). UI: `#turn-timer` no painel central das
  duas telas, com aviso nos últimos 10s (`.turn-timer-warning`) e pulso em 0.
- **Fix (PvP): F5 numa partida em andamento reabria o seletor de decks** — o
  `bootstrap` sempre chamava `escolherDeckDeEntrada()` antes de conectar, então
  quem recarregava o tabuleiro no meio da partida era forçado a escolher de novo
  (uma escolha que o servidor já tinha resolvido e ignoraria). Agora o bootstrap
  consulta o status via `GET /api/matches/<id>` (`salaEmAndamento`): se a sala
  está `playing`/`finished` (ou tem `resultado`), pula o seletor, zera o
  `deckEscolhido` e conecta direto — o `MATCH_START`/`COMMAND_LOG` remontam a
  partida exatamente como estava. Sala nova (`waiting`) segue pedindo o deck. Sem
  servidor (testes headless), cai no fluxo de primeira entrada. Travado por teste
  de unidade (source-scan do bootstrap) e pelo novo `test_pvp_reconnect.js` (fetch
  dublado com sala `playing`).
- **Fix (UI): Fantom não ficava mais preso em campo ao voltar à mão** — o retorno
  (evasão fantasmagórica) movia a carta para a mão no estado, mas o elemento do
  campo nunca era removido: o `renderFieldsFromState` pula qualquer `.card` com a
  classe `.destroying` (guard de animação de morte), e o bloco de retorno-à-mão só
  animava e reprojetava a mão. O Fantom não morre (nada chama `destroyCard`), então
  a classe ficava para sempre e a carta "fantasma" permanecia no campo. Corrigido
  espelhando a limpeza do `destroyCard`: `animationend` (com fallback de 400ms
  guardado por geração) remove o elemento e reprojeta o campo. Travado por teste de
  unidade (source-scan do bloco) e pelo novo `tests/browser/test_fantom_return.js`
  (combate real da UI: sai do campo, permanece na mão, reprojeção não ressuscita).
- **Ataque direto proibido no primeiro turno de CADA jogador**: antes a trava era
  `state.turn <= 1` (turno 1 global), então p2 atacava direto no seu primeiro turno
  e uma permissão de equipamento (`Atravessava`/`Rego Freitas`) furava a regra até
  no turno 1. Agora `CardRules.canDirectAttack` abre com
  `ehPrimeiroTurnoDoJogador(state, attacker.controllerId)` — vale para ataque
  direto inerente (Diabretes/Ptera/Beluga), campo vazio **e** permissão de carta.
  O estado ganhou `startingPlayer: 'p1'` (p1 joga os turnos ímpares, p2 os pares),
  então a regra não depende de números mágicos e continua determinística no PvP.
  As regras do jogo (index.html e lobby, textos idênticos) anunciam a proibição.
- **Vida inicial: 200 → 300** (análise de poder dos decks). Medições dos 9 presets
  (média ponderada por cópias): **ATK médio 27,1**, **DEF média 24,2** e **média
  dos 3 melhores ATK 47,7** — ou seja, no atrito o vazamento por ataque é pequeno
  (~3 de overflow contra defesa cheia), mas quando um campo cai, cada atacante
  despeja o ATK inteiro (40–59 nas elites) e 3 atacantes passam de **100 PV por
  turno**. Com 200 PV, o perdedor do embate de campo morria em 1–2 turnos (é a
  sensação de "partida curta"); com **300** a fase de atrito (~8 turnos, 90–120 PV)
  ainda deixa **2–3 turnos de cerco** para quem virou a mesa, dando espaço para
  rebuild de campo, `Aura de Vingança`, Condessa e Marik 2. O valor está nas três
  pontas do jogo: `src/js/game.js INITIAL_PV`, `server.py DEFAULT_CONFIG`, o
  contador `index.html`, os spans pintados de `game.html`/`pvp.html` e as duas
  telas de regras — um teste novo trava todos eles (300 nos dois PV e no texto).
  O default do `GameStateModel` segue 200 **como fixture** (comentado no arquivo):
  a partida real sempre passa o config do hotseat ou do `MATCH_START`.
- **Bilugação Astral implementada** (era a única das 110 cartas sem regra, 109/110):
  `card_090` é suporte de custo 2 que equipa **qualquer** criatura aliada e aplica o
  efeito `IMPENETRABLE` com duração `UNTIL_END_OF_OPPONENT_TURN` — a criatura fica
  **intransponível até o fim do turno do oponente**. Default conservador para a
  ambiguidade registrada (pergunta de produto #13): **nenhum ataque passa** —
  recusa em `CardRules.validateAttackTarget` (o motivo aparece na UI) **e** combate
  cancelado no `BECAME_ATTACK_TARGET` (caminho determinístico do ledger, ambos os
  clientes iguais) —, sem consumir o efeito a cada ataque e sem bloquear dano de
  habilidade (Dino Elétrico, Quimera) nem ataques diretos ao jogador. `check_cards.py`
  agora reporta **110/110 (100%)**. A carta entrou no **Círculo Arcano** (o deck dos
  magos) e no **Banquete de Apelino** (a "apelação" literal), fechando a cobertura
  do catálogo nos decks: **110/110 cartas em uso**, com um teste que agora exige
  cobertura total (antes tolerava a carta inerte fora).
- **Fúria Selvagem** (era "Matilha Selvagem", id `furia`): a pedido, o deck passou a
  ser o das **feras variadas** — 32 cartas distintas em 40 (1,25 cópia/carta contra
  2,11 antes), média 3,48, curva 24/12/4, 25 criaturas **100% besta**;
  entraram Baltz, Paladar ×1, Gulosinho, Grifo Real, Turtol, Entola Guela, Gárgula,
  Beluga, Tiranossauro e Golem de Pedra, e saíram as cópias repetidas (Bufaboi,
  Rei das Feras, Puma, Zol, Tobinha, Flecha/Espada/Estaca em tripla). Nomes/id
  atualizados em `data/decks.json`, README, testes de unidade e de browser.
- **Turtol Maximus na Maré Profunda (e Roller na Matilha)** (a pedido): a
  evolução do Turtol pertencia à Matilha, mas o deck aquático é o dono natural
  dela — `card_048` Turtol ×1 já estava lá como muralha (imune a habilidades de
  custo < 4) e agora evolui para `card_075` Turtol Maximus (35/48), fechando o
  "segura e vira fortaleza". O `card_069` Roller foi para a **Matilha Selvagem**
  (besta, 39/35, volta à mão ao morrer): troca direta de um para um, os dois decks
  seguem com 40 cartas e o teste de evolução continua exigindo a base presente
  (`card_048`). Descrições dos dois decks atualizadas.
- **Aladar é besta, não dragão** (decisão do autor): `card_029` tinha a trait
  `dragao` no catálogo e no inventário travado por teste. Corrigido para `besta`
  em `data/cards_database.json` e nos dois lugares do teste (`INVENTARIO`.
  besta/dragao e a lista de dragões), que agora também assevera explicitamente
  `card_029 → ['besta']`. Consequências: a **Corte Dracônica** perdeu Aladar (e
  ganhou mais uma cópia de Scoul e de Ptera — curva idêntica: os três custam 4) e
  o Aladar entrou na **Matilha Selvagem**, onde é besta legítimo (30/12, ataca de
  novo ao derrotar). `card_037` Scoul deixa de contar Aladar como dragão em campo.
- **Cobertura total do catálogo**: os 9 decks agora usam **109 das 110 cartas**.
  Os buracos foram fechados rebalanceando: `card_050` Shupáku e `card_029` Aladar
  na Matilha (saíram Baltz ×2 e Gulosinho), `card_057` Quimera de Fogo na
  Alcateia (que ganhou `fogo` nas traits — carregada pelo Lobo Omega Pyro),
  `card_041` Gulosinho na Alcateia (no lugar de uma Tobinha), `card_007` Camisa 14
  do América na Ordem dos Caçadores e os **três arts do Diabrete Alado** na Corte
  Dracônica (`card_010_1`+`card_010_2`+`card_010_3`; seguro porque
  `DIRECT_ATTACK_DEFINITION_IDS` lista os três). A única carta fora é
  `card_090` Bilugação Astral, **sem regra implementada** (pergunta de produto
  #13) — um teste novo exige cobertura de *todas as cartas jogáveis* e proíbe a
  inerte em deck.
- **O lobby não escolhe mais deck**: o seletor embutido (`DeckSelect.renderizar`)
  foi removido do `pvp-lobby.html` (seção, CSS, scripts e `loadCardSystem`) e do
  componente — a escolha acontece **só ao entrar na partida** (`game.html` e o
  link da sala em `pvp.html`, mesmo modal bloqueante). O lobby voltou a ser só
  criar/compartilhar sala + Regras do Jogo. Testes: o `test_pvp_lobby_deck.js` foi
  removido e um teste de unidade novo garante que o lobby não carrega/grava nada de
  deck (`deck-select.js`, `deck-select.css`, `deck-picker`, `loadCardSystem`).
- **🌑 Lua de Sangue** (a pedido, o par noturno da Alcateia): vampiros +
  demônios + fantasmas + elite. A corte é `card_054` Lorde Sanguinário ×2,
  `card_062` Alucard ×2 e `card_076` Condessa Carmilla ×2 (os três elite, então
  Núcleo de Energia Pura e Aura de Vingança têm 4 hospedeiros), com o séquito
  demoníaco (`card_024` Slipul ×2, `card_060` Tranca Rua ×2, `card_010_1`
  Diabretes ×2 convocados pelo `card_045` Invocador das Trevas) e o Fantom ×2
  como evasão. Fecha com o pacote de travamento (11 de Setembro ×2, Zica ×2, Cara
  de Cu Estourado, Chocolicia) e Pena do Gigante/Medalhão/Estrela para sustentar a
  corte. Números: 40 cartas, **26 distintas**, ≤2 cópias, média 3,50, curva
  26/10/4, 24 criaturas (58% no tema — os três vampiros do catálogo estão aqui,
  duas cópias de cada). O catálogo ficou com **9 arquétipos**.
- **Cada partida embaralha o baralho (inclusive nos decks prontos)**: a ordem do
  `data/decks.json` é só a receita. `DeckBuilder.embaralhar(definicoes, rng)` é o
  **único** Fisher-Yates do jogo (o `shuffleArray` do deck aleatório passou a
  delegar para ele), aplicado no hotseat em `montarDecksDaEscolha` (RNG do
  builder = `Math.random`) e no PvP em `pvp-game.js#embaralharDeck` com o
  **mulberry32 da seed da sala** — não por acaso: o F5 reenvia o `MATCH_START` e o
  replay dos `DRAW` do ledger move o **topo** do baralho, então a ordem precisa ser
  reproduzível dentro da sala (seeds diferentes entre salas ⇒ ordens diferentes).
  O stream do RNG é novo e local, sem tocar em `gameState.rng` (dado/efeitos).
  Efeito colateral corrigido: `window.DeckBuilder` nunca era exposto, então o
  fallback "cliente gera o deck pela seed" (`gerarDeckLocal`) sempre avisava
  "sem DeckBuilder` e devolvia `null` — agora a classe está no escopo global.
- **Três arquétipos novos, com variedade alta** (a pedido: "combine mais traits,
  sinergias sem repetir tantas cartas"): **🍷 Banquete de Apelino** (o deck de
  custo alto — `card_089` Apelino ×2 é o motor de ataques ilimitados, os
  hospedeiros são os furadores de defesa Tiranossauro, Minotauro, Gárgula e
  Mexica, e a mesa mistura elites de facções diferentes: Superior, Imperial X,
  Sentinela Solar, Condessa Carmilla, Lorde Sanguinário, Golem e Nucles —
  **32 cartas distintas**, 18/11/11 de curva, 11 cartas de custo 7+, média 4,72);
  **🌊 Maré Profunda** (aquáticos + pacote de controle/paralisação: o único deck
  que usa **todas as 6 cartas aquáticas do catálogo, duas de cada** — Tlantidu ×2
  e Hidra das Profundezas ×2 fecham a linha de tutor, porque o Tlantidu busca um
  aquático no deck ao morrer —, com 11 de Setembro, Zica, Cara de Cu Estourado,
  Abutuaram e Chocolicia atrasando o oponente e Cacton/Turtol/Fantom/Roller como
  muralha: 28 distintas, média 3,77); **🔮 Círculo Arcano**
  (magico + humanoide + elite + fantasma: Cajado da Ilusão e Tomo de Feitiços só
  equipam os quatro conjuradores, o Invocador traz Diabretes, o Tranca Rua provoca
  e o Manto da Luz Solar responde a vampiros/lobisomens — 29 distintas, média
  3,27). Os três usam **no máximo 2 cópias por carta** (1,25–1,38 cópias/carta
  contra 2,0–2,2 dos quatro primeiros) e juntos os 8 decks cobrem **103 das 110
  cartas** do catálogo. Um teste novo trava isso: ≥18 distintas por deck, ≤2,3
  cópias/carta, ≥3 decks de variedade alta e ≥100 cartas cobertas.
- **Quinto deck — Alcateia Lunar** (a pedido): lobisomens + lobos elementais.
  Núcleo: `card_059` O Lica ×2, `card_077` Marik ×2, `card_085` **Marik 2** ×1
  (evolução ← Marik, 59/59), `card_078` Alfa Fly, `card_079` Beta Lightning,
  `card_080` Omega Pyro, `card_081` Latex e `card_082` Gamma Freeze (1 cópia cada
  — o teto do deck); a vanguarda é de bestas de custo baixo (Kirb, Zol, Tobinha,
  Bufaboi, Garras Afiadas, Rei das Feras, Trox) para segurar até o custo 9.
  Suportes: `card_097` Flecha de Prata ×3, `card_104` Núcleo de Energia Pura ×2 e
  `card_108` Aura de Vingança ×2 (os dois últimos só equipam elite — 8 cópias de
  elites hospedeiras), Espada Mágica, Botas da Rapidez, Medalhão de Cura e Rego
  Freitas. Paleta roxo-lunar (`#c4b5fd`), emblema 🌕. Números: 40 cartas, 22
  distintas, ≤3 cópias, média **4,53**, curva 22/10/8, 26 criaturas (100% no
  tema lobisomem/besta/elite).
- **Roster ajustado a pedido**: a **Corte Dracônica** recebeu o **Invocador das
  Trevas** (`card_045`) — a regra dele (`ritual_invocacao`) invoca um Diabrete Alado
  **da mão** por 1 de energia, então o deck subiu os **Diabretes Alados**
  (`card_010_1`) de 2 para **3 cópias** e abriu espaço tirando o `Medalhão de
  Cura` (custo 2 → média 4,15, criaturas 26). Na **Ordem dos Caçadores** o
  Invocador saiu e entrou o **Paladino Alvorada** (`card_067`, elite/paladino/
  humanoide, 37/28) em **3 cópias** — a ala nobre do deck e mais um hospedeiro de
  `Lâmina Sagrada`/`Estaca do Caçador`/`Flecha de Prata` (média 4,65). Os testes
  de catálogo (40 cartas, ≤3 cópias, curva, tema, hospedeiros) seguem verdes sem
  afrouxar nenhum limite.
- **PvP — a escolha é confirmada na ENTRADA da sala** (correção do pedido): o
  `bootstrap` do `pvp.html` chama `escolherDeckDeEntrada()` **antes** de abrir o
  socket — o modal é o mesmo do hotseat (bloqueante, sem ×) e o `HELLO` nasce com
  `deck: <id confirmado>`. Como o servidor só inicia a partida com os dois
  assentos, ninguém entra numa mesa sem o outro ter escolhido. O seletor do
  **lobby** passou a ser só **pré-seleção** (o `localStorage['xmDeckPreferido']`
  pré-marca a opção no modal). O tabuleiro PvP nunca carregava o catálogo de
  cartas (o deck vem do servidor) — agora `escolherDeckDeEntrada()` carrega
  `loadCardSystem()` para o resumo do modal (stats/curva/cartas) e isso de
  quebra conserta o fallback `gerarDeckLocal`, que dependia de
  `window.cardsDatabase`. PvP/hotseat carregando em paralelo expôs uma corrida
  (`cardsDatabase` pronto e `deckCatalog` não, o modal caía no aleatório):
  `loadDeckCatalog` agora compartilha a promessa em andamento e `loadCardSystem`
  é idempotente.
- **PvP — servidor**: o lobby escolhe (mesmo componente,
  `localStorage['xmDeckPreferido']`) e o `HELLO` manda `deck: <id>`; `server.py` guarda `Room.deck_choices`, valida o id
  contra `deck_presets()` (lidas de `data/decks.json`, com cache) e resolve
  `resolver_decks(room)`: preset expandido **em Python** (não depende do Node) ou
  deck pela seed (fallback do `deck_factory`, inalterado). A escolha só vale antes
  da partida (`room.decks is None and not room.started`); `reset_for_rematch` limpa
  `decks`/`deck_ids` para re-resolver. `MATCH_START` ganhou `deckId`/`deckNome`
  **só do próprio assento** — o deck alheio continua secreto (nada em
  `public_state`); o espelho `matches/<roomId>.json` audita
  `escolhasDeck`/`decksResolvidos`.
- **Traits no modal de detalhes** (`showCardModal`): bloco **"Características:"**
  entre stats e habilidade, alimentado por `DeckSelect.traitsDaCarta(cardData)`
  (catálogo primeiro, `CardRules.getTraits` como fallback) e rotulado em pt-BR por
  `TRAIT_LABELS` (16 traits: `besta` → "Besta 🐾", `lobisomem` → "Lobisomem 🌕",
  `elite` → "Elite 👑" …). Suporte não tem traits no catálogo: a seção não aparece
  (nada de bloco vazio). Um teste garante que o mapa de rótulos e as traits do
  catálogo não divergem e que o PvP também carrega o componente (os chips viajam
  no `pvp.html`).

Evidências: `node tests/unit/run-tests.js` **240/240** (novos blocos de catálogo de
decks, motor, traits, markup/ordem de scripts, guarda de sintaxe dos classic
scripts e do servidor), `node tests/browser/run-browser-tests.js` **23/23** (novos
`test_deck_select.js`, `test_pvp_lobby_deck.js` e `test_pvp_deck_entry.js` — este
último dubla o `WebSocket`, entra em `/pvp/<sala>/<assento>` e prova que o `HELLO`
leva o deck confirmado; o harness confirma o deck aleatório via
`DeckSelect.confirmarAleatorio()` antes de injetar os scripts) e
`py -3 tests/pvp/smoke_match.py` com os casos novos (preset de 40 na ordem do JSON,
`deckNome`, id desconhecido → sorteio, espelho auditando a escolha).

Pitfall registrado: um `await` dentro de função não-async em `game.js` derrubava o
arquivo inteiro no navegador (a página ficava sem `window.gameState` e 10 testes de
browser falharam em massa). Agora `run-tests.js` compila todo `src/js/*.js` com
`new vm.Script(...)` — os testes de unidade pegam esse tipo de erro antes do
browser.

## 2026-09-21 — Suporte equipado soma sempre os próprios ATK/DEF do catálogo

Reclamação de produto: cartas de suporte com `attack`/`defense` no
`data/cards_database.json` não somavam ao serem equipadas. Causa: em
`CardRules.createEquipmentEffects` o ramo migrado devolvia apenas
`rule.modifiers`, e o fallback de stats do catálogo (dentro de
`equipSupportCard`, em `game.js`) só rodava para suportes **sem** regra — 14
cartas migradas ficavam sem soma alguma (`card_002`, `089`, `092`, `093`,
`095`, `096`, `100`, `101`, `102`, `103`, `105`, `106`, `107`, `108`).

Regra adotada (precedência explícita):

1. `rule.modifiers` (números do texto) vence quando declara o stat —
   `card_001` continua +5/+5 e `card_104` continua +5/+5 mesmo com 10/5 e 10/10
   no catálogo; `card_004`/`015` mantêm a penalidade assinada.
2. Stat não declarado pela regra (nem por `ADD_MODIFIER` devolvido por
   `rule.effects`) recebe `ADD_MODIFIER` com o valor do catálogo, duração
   `UNTIL_SOURCE_LEAVES` e id `${instanceId}:${stat}`.
3. `targetSide: 'ENEMY'` nunca deriva stat do catálogo: ali o número é a
   magnitude da penalidade aplicada pela própria regra (`card_005` drena 5 DEF
   por turno via `DEFENSE_DRAIN`; `card_015` aplica -10/-25 em `effects`), e
   somar de novo duplicaria o efeito.

Dois testes novos (`suportes somam os próprios ATK/DEF ...` e `suportes hostis
aplicam só a penalidade da regra ...`) varrem a lista real do catálogo, e o
harness de drag-and-drop passou a conferir `getEffectiveStat` depois do
equipamento pela UI (Mago Arcano 25/30 + Cajado da Ilusão 5/5 = 30/35).

Fixtures ajustadas: `createEquipmentRuleFixture` lê o catálogo real (antes
usava 99/99 arbitrários, que com a nova regra virariam soma) e
`installAttackEquipment` ficou em 0/0 para isolar limite/penalidade de ataque
da soma de stats.

No mesmo passo, as duas falhas que restavam na suíte foram corrigidas: `CSS do
dado: rolagem, resultado e "+N" fora do fluxo` e `os ícones de face do dado
existem...` ancoravam em `\n\s*\.dice-button \{\n` e quebravam em checkout
Windows com `core.autocrlf=true` (o repositório guarda LF). Agora os testes
leem arquivos-fonte por `readSourceText(...)`, que normaliza CRLF → LF —
**223/223**.

## 2026-09-21 — Auditoria das 79 cartas: o que é travável sem olhar a arte

Segunda rodada da revisão de traits: em vez de tentar adivinhar arte, foram
fixados os invariantes que o catálogo pode provar sozinho. Seis testes novos na
suíte de unidade (total **221/221**):

1. **Inventário fechado por trait** — as 16 traits e as 79 cartas que as carregam
   estão fixadas em teste. Qualquer trait somada, removida ou trocada quebra a
   suíte. É o que protege as 60 cartas que ainda não passaram por olho humano.
2. **Vocabulário fechado** — nenhuma criatura/evolução sem traits, nenhuma trait
   fora do vocabulário (typo) e nenhuma repetida na mesma carta; as 31 cartas sem
   traits são todas `suporte`.
3. **`elite`** — ATK > 50 implica `elite` (mão única) e a lista de `elite` com
   ATK <= 50 é exatamente a dos **6 chefes nomeados**: `card_036` Rei das Feras,
   `card_054` Lorde Sanguinário, `card_061` Alquimista Guardião, `card_067`
   Paladino Alvorada, `card_068` Paladino Crepuscular e `card_076` Condessa
   Carmilla. Antes desta auditoria só `card_036` estava identificado.
4. **`evolução`** — as duas evoluções herdam todos os traits da base declarada no
   motor (`CardRules.getEvolutionBaseDefinitionId`), sem lista paralela no teste.
5. **Integridade das artes** — as 110 imagens do catálogo existem, são PNG válidos
   (IHDR + CRC) e medem 768x1017 (77 criaturas, 31 suportes, 2 evoluções). Lido
   direto do header, sem Pillow, para rodar no Node puro.
6. **Matriz de equipamento** — `card_097` (humanoide/besta) aceita guerreiro,
   Alquimista, família Lobo, Baltz e Tobinha, e recusa Natalino (`planta`),
   Raylaser (`robotico`), Superior (`dragao`) e Hidra (`aquatico`); `card_102`
   (guerreiro/humanoide) aceita guerreiro e Alquimista e recusa lobos, Baltz e
   Natalino.

Triagem textual (`scripts/analyze_card_art_features.py`): 79 cartas varridas e
**zero divergência de trait pendente**. As duas entradas restantes são nota de
catálogo — `card_079` ("Lightning") e `card_082` ("Freeze") pedem `eletrico`/`gelo`,
que o vocabulário não tem.

O script agora roda sem Pillow (avisa e omite as colunas de paleta, que são
descritivas e nunca geraram sinal): `py -3` deixa de quebrar por
`ModuleNotFoundError: PIL`, usando o mesmo interpretador dos outros scripts.

O que continua dependendo de gente: traits de corpo/habitat das 60 cartas sem
inspeção visual — folhas de contato em `reports/trait-review/folha_00..08.jpg`
(9 folhas, 3x3, com id, nome e traits impressos).

## 2026-09-21 — Seção E do relatório de traits aplicada (corpo por arte/efeito)

O autor autorizou aplicar as sugestões pendentes de
`docs/RELATORIO_TRAITS_VS_IMAGENS.md`. Aplicado no catálogo (fonte de verdade),
no fallback `TRAITS_BY_DEFINITION` e travado por teste:

| Carta | Antes | Depois | Evidência |
| --- | --- | --- | --- |
| `card_012` Natalino | `humanoide` | `planta` | arte: árvore de Natal antropomórfica |
| `card_016` Baltz | `guerreiro, humanoide` | `besta` | arte: cão Shiba Inu quadrúpede |
| `card_003` ETC | `humanoide` | `humanoide, voador` | arte: alienígena em disco voador |
| `card_061` Alquimista Guardião | `elite, humanoide` | `+ magico` | Elixir Protetor |
| `card_063` Beluga de Terracota | `besta` | `besta, aquatico` | nome (cetáceo) — arte desta carta não foi inspecionada |
| `card_078` Lobo Alfa Fly | `lobisomem, elite` | `+ besta, + voador` | "Domínio Aéreo" + nome "Fly" |
| `card_079`/`card_080`/`card_081`/`card_082` | `lobisomem, elite` (`080` com `fogo`) | `+ besta` | canino é `besta` (precedente `card_014` Tobinha, filhotes de cachorro) |

Mantidos por decisão explícita — as sugestões previam "manter":

- `card_011` Kirb e `card_013` Zol seguem `besta`: as habilidades (copiar
  habilidade de carta barata; comprar carta extra) não declaram magia, e `besta`
  é o fallback descritivo do catálogo.
- `card_023` Raylaser segue `robotico`: a trait tem mecânica ativa (três
  equipamentos com `requiredTrait: 'robotico'` — ex.: `card_106` Escudo de
  Energia Estável — e filtros de robôs em habilidades); trocar por `besta`
  mudaria equipamentos e imunidades, o que é decisão de balanceamento, não de
  descrição de corpo.

Consequências de jogo assumidas e cobertas por teste:

- `card_012` e `card_016` deixam de ser hospedeiros de `card_097` Flecha de
  Prata e `card_102` Estaca do Caçador (perderam `humanoide`/`besta` conforme o
  caso).
- `card_097` volta a equipar toda a família Lobo (`besta`), mas `card_102`
  **continua** não equipando neles: exige `guerreiro`/`humanoide`, e lobo não é
  guerreiro.
- `card_063` passa a ser encontrada pela habilidade do `card_038` Tlantidu
  ("ao morrer pode procurar um monstro aquático no deck").
- `card_061` passa a poder equipar `card_092` Cajado da Ilusão e `card_099` Tomo
  de Feitiços Ancestrais (ambos exigem hospedeiro `magico`).

Validação: `node tests/unit/run-tests.js` → **215/215**,
`node tests/browser/run-browser-tests.js` → **20/20** (com o servidor estático),
`py -3 tests/pvp/smoke_match.py` → todos os checklists passaram.
Contagem de `humanoide` no catálogo: 26 → **24**.

## 2026-09-21 — Lobos não são humanoides; só lobisomens de corpo humano são

Correção do autor do jogo: **"lobos não são humanoides por padrão, lobisomens
sim"**. Isso revoga parte da decisão anterior (mesma data), que aplicou
`humanoide` à família Lobo tratando licantropo como sempre humanoide.

Ajuste (opção escolhida pelo autor: só `humanoide` sai, `lobisomem` fica):

| Carta | Antes | Depois |
| --- | --- | --- |
| `card_078` Lobo Alfa Fly | `lobisomem, elite, humanoide` | `lobisomem, elite` |
| `card_079` Lobo Beta Lightning | `lobisomem, elite, humanoide` | `lobisomem, elite` |
| `card_080` Lobo Omega Pyro | `lobisomem, fogo, elite, humanoide` | `lobisomem, fogo, elite` |
| `card_081` Latex | `lobisomem, elite, humanoide` | `lobisomem, elite` |
| `card_082` Lobo Gamma Freeze | `lobisomem, elite, humanoide` | `lobisomem, elite` |

`card_059` O Lica, `card_077` Marik e `card_085` Marik 2 **mantêm**
`humanoide` + `lobisomem`: são licantropos de corpo humano.

Consequência semântica: na família Lobo, `lobisomem` passa a ser **trait
temática de grupo** (alvo de matchups de caça), não declaração de corpo humano.
Por isso o invariante "ofício humano ⇒ humanoide" foi restrito a
`guerreiro`/`paladino`/`vampiro`, e um teste novo trava os dois lados da regra
(licantropos humanos com `humanoide`; família Lobo com `lobisomem` e nunca
`humanoide`). Sincronizado em `data/cards_database.json` (fonte de verdade) e
no fallback `TRAITS_BY_DEFINITION` (`src/js/card-rules.js`).

Matchups de caça **não** mudam: `card_107` Lâmina Sagrada, `card_102` Estaca do
Caçador e `card_095` Manto da Luz Solar continuam lendo `lobisomem`, que os
lobos conservam. Efeito colateral real: `card_097` Flecha de Prata
(`requiredTraitsAny: ['humanoide','besta']`) e `card_102`
(`['guerreiro','humanoide']`) deixam de aceitar os lobos como hospedeiros —
corrigível dando `besta` à família Lobo, decisão ainda em aberto.

## 2026-09-21 — `humanoide` = bípede + corpo de humano + empunha arma (Superior sai)
Critério definido pelo autor do jogo: "humanoide é quem é bípede, poderia carregar uma
arma, corpo de humano". O caso que motivou a definição é `card_087` (Superior): a rodada
anterior deu `humanoide` + `guerreiro` a ele, mas a arte mostra um **dragão de duas
cabeças** e o trait correto é `dragao` — corpo de dragão, não de humano. Ajuste feito:

`card_087`: `['elite','guerreiro','humanoide','dragao']` → `['elite','dragao']`.

Dois invariantes novos no teste de unidade passam a sustentar o critério:
1. **`humanoide` nunca coexiste com corpo não humano** (`dragao`, `robotico`, `aquatico`,
   `planta`, `fantasma`) — é o que impede um dragão, uma máquina ou um peixe de receberem
   `humanoide` só por serem bípedes que carregam arma. Robôs (`Cp-2`, `Raylaser`,
   `K-023`, `Gamaa`, `Imperial X`, e o `Iron Dragon`, que é `dragao`+`robotico`) ficam de
   fora: corpo mecânico ≠ corpo de humano, e `robotico` já é o trait deles.
2. **Ofício humano implica `humanoide`** (`guerreiro`, `paladino`, `vampiro`, `lobisomem`) —
   quem empunha arma ou veste armadura tem corpo humano por definição; nenhum desses
   traits pode aparecer sem `humanoide`.

Estado do catálogo: **31 humanoides** em 79 criaturas/evoluções (era 32 com o Superior
incluído à força). Impacto: `card_097` (Flecha de Prata, humanoide *ou* besta) e `card_102`
(Estaca do Caçador, guerreiro *ou* humanoide) deixam de equipar no Superior — coerente,
já que a carta é um dragão; `card_098`/`card_207`, que aceitam `dragao` *ou* `elite`,
continuam aceitando.

Evidências: **212/212** em `node tests/unit/run-tests.js` (dois testes novos: conflito de
corpo não humano e órfãos de ofício humano), **20 PASS / 0 FAIL** em
`node tests/browser/run-browser-tests.js` e `py -3 tests/pvp/smoke_match.py` com todos os
checklists OK. Vermelho comprovado: reintroduzir `humanoide` no `card_087` derruba
"humanoide exige corpo de humano".

## 2026-09-21 — Catálogo de traits das criaturas (todas com trait, humanoides marcados)
Sintoma (relatado pelo autor do jogo): "todas as cartas criaturas devem ter traits;
criaturas humanoides devem ter o trait humanoide aplicado na lista, validando também
pelas imagens das cartas".
Inventário do catálogo (`data/cards_database.json`, 110 cartas, 79 criaturas +
evoluções): só **duas** cartas sem `traits` — `card_075` (Turtol Maximus) e
`card_085` (Marik 2), ambas de `type: "evolução"`. O invariante de teste existente
("toda criatura do JSON tem ao menos uma trait") filtrava `type === 'criatura'`, e
`isCreatureCard` (`card-rules.js`) considera `evolução` criatura — a lacuna passou
despercebida justamente por isso. Também havia **fallback desatualizado**:
`TRAITS_BY_DEFINITION` dava `['lobisomem','elite']` a `card_085` enquanto o JSON não
tinha nada, e `card_036` divergia (`['elite']` no mapa vs `['elite','besta']` no JSON).

Regras usadas para sugerir (nome → descrição `hability` → imagem): 
1. **`elite` é derivável**: criatura com ATK > 50. Vale para 10 cartas (Lobo Alfa/Beta/
   Gamma/Omega, Latex, Hidra das Profundezas, Imperial X, Marik 2, Sentinela Solar,
   Superior). `card_036` já era `elite` com ATK 25 antes desta decisão e **não** foi
   alterado (a regra é usada no sentido ATK>50 ⇒ elite, não o inverso).
2. **`evolução` herda os traits da forma base** (+ `elite` quando ATK > 50):
   Turtol Maximus (`card_075`) = Turtol (`card_048`) = `['besta']`; Marik 2 (`card_085`)
   = traits de Marik (`card_077`) + `elite`.
3. **`humanoide` = criatura de corpo humano** (bípede, membros e cabeça humana na
   imagem), incluindo mortos-vivos humanoides (`vampiro`) e licantropos (`lobisomem`) —
   convenção que Marik (`['humanoide','guerreiro','lobisomem']`) já documentava. Não
   foi aplicado a formas não humanoides do mesmo tema (golem/gárgula de pedra, Ptera/
   Grifo, robôs, bestas, plantas) nem a `fantasma`/`demonio`, que já têm trait própria.
   Adicionado em 12 cartas: Lorde Sanguinário, Mago Arcano, O Lica, Alquimista
   Guardião, Alucard, Condessa Carmilla, Lobo Alfa Fly, Lobo Beta Lightning, Lobo Omega
   Pyro, Latex, Lobo Gamma Freeze, Sentinela Solar.
4. **Traço temático confirmado pela imagem**: `card_087` (Superior) recebeu `dragao` —
   a arte é um dragão de duas cabeças e a habilidade é "Senhor dos céus". Não recebeu
   `voador`, porque a carta não tem voo/ataque direto (padrão de Diabrete Alado, Ptera
   e Grifo Real) em nome, habilidade ou arte.

Decisão de implementação: **o JSON é a fonte de verdade** e `TRAITS_BY_DEFINITION`
passa a ser fallback legado declarado como tal, sincronizado com o catálogo (um teste
trava a sincronia). 15 cartas ajustadas no JSON (14 por script com round-trip
`JSON.parse`/`JSON.stringify` verificado byte-idêntico antes de escrever, para não
reformatar o arquivo, e `card_087` por edição pontual); nenhuma outra linha do catálogo
mudou.

Impacto em regras (esperado e verificado): suportes que exigem `humanoide`
(`card_097` "Flecha de Prata" — humanoide *ou* besta; `card_102` "Estaca do Caçador" —
guerreiro *ou* humanoide) passam a aceitar essas 12 cartas, que antes eram recusadas.
O invariante do teste foi corrigido para cobrir `evolução` (era a lacuna que deixou
Turtol Maximus e Marik 2 passarem).

Evidências: **210/210** em `node tests/unit/run-tests.js` (novos testes: invariante
cobrindo `evolução` com a contagem do catálogo, lista de humanoides, lista de dragões com
Superior, Scoul reagindo ao Superior, ATK>50 ⇒ `elite`, herança das evoluções e sincronia
mapa↔JSON) e **20 PASS / 0 FAIL** em
`node tests/browser/run-browser-tests.js`; `py -3 tests/pvp/smoke_match.py` com todos
os checklists OK. Vermelho comprovado: o invariante antigo (só `criatura`) deixava as
duas cartas passarem, e o teste de sincronia acusa qualquer divergência reintroduzida
no fallback.

## 2026-09-21 — Dado da sorte: usado em uma tela, "disponível" na outra
Sintoma (relatado jogando, com print das duas janelas): "inconsistências nos dados
entre os dois players, ambos usaram, deveriam estar iguais nas duas telas,
desativados". A tela de quem tinha o turno mostrava os **dois** dados com anel
dourado (disponíveis); a outra mostrava os dois apagados, com as faces sorteadas.

Causa (medida com dois assentos reais via CDP, servidor + duas abas):
`atualizarBloqueioPorTurno` (`src/js/pvp-game.js`) fazia
`document.querySelectorAll('.phase-button, .dice-button, .action-button').forEach(b => b.disabled = !interagindo)`
— um `disabled` **blanket** que ignorava `gameState.diceUsed` e a posse do botão.
Resultado: a cada `SYNCED`/`END_TURN` o dado já jogado **reacendia** quando o turno
voltava ao dono e o dado do oponente ficava clicável. O clique num dado já usado
não fazia nada (a guarda de `diceUsed` só mostrava o aviso), então era puramente
visual — mas com a energia do lado, o botão dourado chamava atenção.
Ao mesmo tempo, o `montarPartida` (F5/MATCH_START repetido) não devolvia o dado ao
estado de partida nova: `dataset.diceRolled`/face sobreviviam no DOM e engoliam o
`ROLL_DICE` do replay do ledger, que é justamente quem recontabiliza a energia no
remount (risco de energia divergente entre as telas).

Decisão: o dado passa a ser **estado do jogador**, num só lugar, e todo repaint
respeita esse estado.
- **`src/js/game.js`**: `marcarDadoComoUsado(diceButton, player, valor)` concentra
  o "já jogado" (face pelo ícone, `disabled`, `diceUsed`, `dataset.diceRolled`,
  title). `resetDiceUI()` (exportado como `window.resetDiceUI`) devolve os dois
  dados ao estado de partida nova — o `resetGame` e o remount do PvP passam por ele
  antes de qualquer replay. `rollDice(player, forcedValue)`, quando o valor vem do
  ledger e o dado já está contabilizado, **só repinta** (não paga a energia de novo
  nem aplica outro resultado); sem valor (clique local) mantém o aviso.
- **`src/js/pvp-game.js`**: o blanket ficou só com `.phase-button`/`.action-button`;
  o dado ganhou regra própria — `botao.disabled = usado || !interagindo || dono !==
  seatLocal` (o meu, no meu turno e ainda não usado). `montarPartida` chama
  `window.resetDiceUI?.()` junto da limpeza do DOM, antes do reset canônico.

Evidências: **204/204** em `node tests/unit/run-tests.js` (rollDice/resetDiceUI
dirigidos pelo estado + teste novo do bloqueio por turno, que proíbe o seletor
blanket com `.dice-button` e exige a chamada de `resetDiceUI` antes do
`resetMatchState`) e **20 PASS / 0 FAIL** em `node tests/browser/run-browser-tests.js`
com o novo `tests/browser/test_pvp_dice_state.js` (23 checks: dado do oponente
bloqueado, ROLL_DICE do ledger aplica energia e face nos dois lados, repaint não
reabilita o usado, clique inerte, replay idempotente e remount limpando o dado).
Comprovadamente vermelho: revertendo o `disabled` blanket, 6 checks do teste novo
falham — incluindo "o meu dado usado não reabilita quando o turno volta" — e o
teste de unidade acusa o seletor antigo. Antes/depois com dois assentos no CDP:
`disabled` dos dois dados era `false/true` invertido por assento no bug e passou a
ser idêntico nas duas telas (`off/off` com faces 5 e 6) em todos os passos,
inclusive depois do F5. `py -3 tests/pvp/smoke_match.py` segue OK.

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
