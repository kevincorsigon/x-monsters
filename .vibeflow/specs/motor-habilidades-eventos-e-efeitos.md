# Spec: Motor de Habilidades por Eventos e Efeitos

## Status

- Tipo: arquitetura e plano de implementação.
- Fonte funcional primária: `data/cards_database.json`.
- Catálogo auditado: 110 entradas, 108 designs únicos.
- Implementação: concluída (Fases 1-7, ver `.vibeflow/decisions.md`).
  109/110 cartas têm alguma regra própria em `src/js/card-rules.js`
  (`py -3 scripts/check_cards.py`); `node tests/unit/run-tests.js` → 141/141.
- Pendência única: **090 Bilugação Astral** segue de fora, bloqueada pela
  questão de produto #13 (semântica de "intransponível") na seção
  "Decisões de Produto Bloqueadoras" abaixo — todas as demais 23 questões
  já foram respondidas ao longo da implementação e estão registradas em
  `.vibeflow/decisions.md`.

## Objetivo

Substituir gradualmente o conjunto atual de handlers desconectados por um
motor determinístico capaz de representar, validar e resolver todas as
habilidades escritas nas cartas, preservando o jogo em JavaScript puro e a
fachada pública `window.cardAbilities` durante a migração.

O resultado deve separar regras, estado e renderização. Toda ação altera um
estado canônico; a interface apenas solicita escolhas e apresenta esse estado.
Uma habilidade só conta como implementada quando seu efeito participa do fluxo
real da partida e possui teste comportamental, não quando existe apenas um
`case`, método ou flag com o nome da carta.

## Definition of Done

1. As 110 entradas do catálogo possuem registro válido e os 108 designs únicos
  possuem ao menos um teste comportamental.
2. Estado, combate e interface usam a mesma fonte de verdade para PV, energia,
   ATK, DEF, dano, zonas, equipamentos, limites de uso e efeitos ativos.
3. Todos os triggers, escolhas, custos, durações e movimentos de zona descritos
   nesta spec passam pelo resolvedor de ações e eventos.
4. Buffs e debuffs expiram no boundary correto, removendo somente seus próprios
   modificadores; efeitos ligados a uma fonte são limpos quando ela sai de campo.
5. Ataques adicionais, prevenção, reflexão, imunidade, bypass, dano em área,
   morte, abate, retorno, roubo, busca, ressurreição e evolução têm cenários
   automatizados determinísticos.
6. Uma auditoria automática falha para habilidade sem registro, handler
   inexistente, descritor desconhecido, alvo impossível ou efeito órfão.
7. A página de produção não carrega scripts de teste; ao final da iniciativa,
  `node tests/unit/run-tests.js` e `py -3 scripts/check_cards.py` terminam com
  código zero.

## Escopo

- Normalizar identidade de definição e de instância, owner/controller e zonas.
- Tornar PV, energia, stats, dano e efeitos parte do estado do jogo.
- Criar um pipeline de ações, eventos, seleção de alvos e state-based actions.
- Criar um registro híbrido: descritores para efeitos comuns e handlers para
  comportamentos especiais.
- Modelar limites por turno/partida, custos, opcionalidade e durações relativas.
- Modelar equipamentos como instâncias ligadas a criaturas.
- Migrar as 108 habilidades únicas em lotes testáveis.
- Adicionar testes automatizados sem bibliotecas externas.

## Fora de Escopo

- Redesign visual, novas animações ou novos sons.
- Backend, multiplayer remoto, persistência ou sistema de contas.
- Rebalancear custos, ATK, DEF ou números escritos nas habilidades.
- Criar cartas novas.
- Refatorar os scripts Python de OCR e impressão.
- Alterar o algoritmo de montagem dos decks, exceto o necessário para corrigir
  identidade de instância e transições de zona.
- Interpretar silenciosamente textos ambíguos; essas regras exigem decisão
  explícita antes da migração da carta afetada.

## Evidência Auditada

### Catálogo

`data/cards_database.json` contém:

| Medida | Valor real | Metadado atual |
|---|---:|---:|
| Entradas | 110 | 108 |
| Criaturas | 77 | 79 |
| Suportes | 31 | 27 |
| Evoluções | 2 | 2 |
| Designs únicos | 108 | não informado |

As três entradas de Diabrete Alado (`card_010_1`, `card_010_2` e
`card_010_3`) são cópias físicas do mesmo design. O metadado final do JSON
deve ser corrigido ou calculado, nunca mantido manualmente em desacordo com o
array.

O campo `hability` é texto de apresentação e contém a intenção da regra, mas
não é adequado para execução. Ele deve ser preservado por compatibilidade e
acompanhado por dados estruturados; o motor não deve interpretar linguagem
natural em runtime.

### Fluxo atual da partida

O jogo usa um `gameState` global com jogador, fase, turno e arrays de mão,
campo e descarte. PV e energia ficam no DOM. ATK e DEF são alterados tanto em
`card.data` quanto nos elementos visuais, dependendo do caminho executado.

Fluxos observados:

1. `startNewMatch` cria decks e mãos.
2. `dropCard` paga energia, move uma carta da mão ao campo e chama
   `onCardSummoned` apenas para criaturas.
3. `equipSupportCard` soma automaticamente os campos `attack` e `defense` do
   suporte, copia seus dados para `creature.data.equipment`, remove a instância
   da mão e chama `onCardEquipped`.
4. `performAttack` valida o alvo, chama `onBeforeAttack`, aplica dano mútuo,
   agenda destruições, chama `onAfterAttack` sem os argumentos esperados e
   marca um único ataque por ID.
5. `directAttack` sempre está disponível na interface e tenta chamar
   `onBeforeDirectAttack`, que não existe no motor.
6. `endTurn` troca o jogador antes de chamar `processTurnEffects`; não existem
   eventos explícitos de início/fim de turno ou fase por controlador.

### Cobertura real do motor atual

- O dispatcher executável de `onCardSummoned` contém somente Natalino, Zol e
  Raylaser. Um dispatcher muito maior está dentro do comentário inicial de
  `src/js/card-abilities.js` e nunca executa.
- `onSupportCardPlayed` contém seis cartas, mas não possui chamador no jogo.
- `onCardEquipped` registra equipamentos, porém muitos handlers apenas gravam
  flags que nenhum fluxo consulta.
- O retorno de `onBeforeAttack` é ignorado por `performAttack`.
- `onAfterAttack` espera `damage` e `destroyed`, mas recebe apenas IDs.
- `processTurnEffects` só executa a semântica de `poisoned`; outros efeitos
  apenas decrementam e desaparecem sem alterar regras ou restaurar stats.
- `modifyCardStats` altera somente o DOM; o combate lê `card.data`.
- O motor consulta `window.gameState`, mas o estado é declarado com `let` no
  script inline e não é publicado explicitamente em `window`.
- Efeitos não são limpos na destruição ou no reinício da partida.
- A interface manual contém IDs e métodos incorretos para Abutuaram/Medusa e
  não oferece seleção genérica de alvo.
- Os relatórios antigos de 41/110 e 95/110 medem presença textual de handlers,
  não fidelidade ponta a ponta. Não devem ser usados como baseline.

## Diagnóstico

A falha estrutural é a ausência de um resolvedor de regras. O sistema atual
consegue registrar intenção em `Map` e alterar a tela, mas não possui um fluxo
que consuma consistentemente modificadores, eventos, escolhas, duração e
movimentos de zona.

Adicionar mais métodos ao `switch` atual aumentaria a cobertura nominal sem
resolver:

- divergência entre modelo e DOM;
- triggers inexistentes;
- escolha e validação de alvos;
- efeitos opcionais e pagamento de custos;
- ordem de resolução e morte simultânea;
- duração relativa ao controlador;
- modificadores contínuos e restauração;
- identidade de equipamentos e cartas roubadas;
- testes determinísticos.

## Taxonomia das Habilidades

Cada habilidade estruturada deve declarar as dimensões abaixo. Uma carta pode
pertencer a mais de uma categoria.

### Por trigger

| Trigger canônico | Significado | Exemplos |
|---|---|---|
| `CARD_PLAYED` | suporte ou carta instantânea foi jogada | 004, 006, 008, 009, 015 |
| `CREATURE_SUMMONED` | criatura entrou em campo por invocação | 012, 013, 023, 050, 079, 086 |
| `EQUIPMENT_ATTACHED` | equipamento foi ligado a um alvo | 001, 002, 005, 007, 088-108 |
| `ABILITY_ACTIVATED` | jogador escolheu usar uma habilidade | 020, 026, 031, 045, 046, 049, 051, 055, 057, 061, 063, 067 |
| `ATTACK_DECLARED` | ataque e alvo foram declarados | 017, 019, 021, 032, 053, 056, 066, 070, 076, 078, 083 |
| `BECAME_ATTACK_TARGET` | criatura foi escolhida como alvo | 030, 042, 071, 094, 095 |
| `BEFORE_DAMAGE` | pacote de dano ainda pode ser modificado | 002, 021, 022, 032, 046, 053, 056, 070, 074, 078, 097, 103, 105 |
| `DAMAGE_DEALT` | dano confirmado foi aplicado | 030, 071, 095, 106 |
| `CREATURE_WOULD_DIE` | janela de substituição de morte | 042, 069 |
| `CREATURE_DESTROYED` | morte confirmada e carta movida | 038, 062, 069, 087, 108 |
| `CREATURE_DEFEATED` | fonte recebeu crédito pelo abate | 029, 036, 052, 054, 062, 076, 087 |
| `TURN_STARTED` | início do turno do controlador | 099 |
| `PHASE_ENDING` | fim de uma fase específica | 093 |
| `TURN_ENDING` | antes da troca do jogador | 041, 091 |
| `STATE_CHANGED` | composição do campo ou vínculo mudou | 024, 033, 037, 040, 043, 058, 059, 060, 064, 068, 075, 077, 098 |
| `SOURCE_LEFT_FIELD` | fonte de um efeito ligado saiu de campo | 050 e equipamentos |

### Por alvo

- Própria carta ou criatura equipada.
- Um aliado ou inimigo escolhido.
- Até três inimigos distintos.
- Todos os aliados, todos os inimigos ou todos os outros monstros.
- Jogador controlador ou oponente.
- Carta no deck, na mão ou no descarte.
- Equipamento ligado a uma criatura.
- Carta-fonte de um ataque, dano ou habilidade.

O seletor deve receber um predicado de legalidade e devolver IDs de instância.
Nenhum handler pode localizar alvos por DOM, nome visível ou posição no array.

### Por efeito

- Dano e cura de criatura.
- Dano e cura de PV.
- Buff/debuff aditivo, multiplicativo ou derivado.
- Prevenção, redução, reflexão, imunidade e negação.
- Ataque direto, dano penetrante, bypass e ataque em área.
- Concessão de ataques adicionais e alteração do dano por ordinal do ataque.
- Comprar, buscar, descartar, destruir, retornar, roubar, invocar e ressuscitar.
- Anexar/desanexar equipamento e criar vínculo entre fonte e alvo.
- Alterar custo de uma instância.
- Copiar habilidade.
- Evoluir uma criatura.

### Por duração e limite

- Instantâneo.
- Próximo ataque ou próximo evento correspondente.
- Até o fim do turno atual.
- Até o fim do próximo turno do oponente.
- Por N turnos do controlador ou do alvo.
- Enquanto a fonte permanecer em campo/equipada.
- Permanente na instância durante a partida.
- Uma vez por turno.
- Uma vez por partida.
- Sem limite, explicitamente.

## Classificação Completa do Catálogo

Legenda de implementação:

- `D` descritor declarativo comum.
- `H` handler especial, composto por primitivas.
- `M` modificador contínuo recalculado.
- `R` reação/substituição dentro de uma janela de evento.
- `A` ação ativada que exige escolha e/ou custo.
- `?` regra textual insuficiente; depende de decisão de produto.

### Suportes imediatos e de controle

| ID | Carta | Trigger e alvo | Modelo | Programação planejada |
|---|---|---|---|---|
| 004 | Chocolicia | jogar; 1 criatura inimiga | D | `MODIFIER -10 ATK/-10 DEF`; duração a decidir. |
| 006 | Adubaram | jogar; 1 criatura inimiga | H | mover alvo ao descarte e comprar 1; definir se destrói ou descarta. |
| 008 | Cara de cu estourado | jogar; 1 inimigo | D | `PARALYZED` por 2 turnos; bloquear ataque e contra-ataque. |
| 009 | Abutuaram | jogar; 1 criatura inimiga | D | `MODIFIER -15 DEF`; duração a decidir. |
| 015 | 11 de setembro | jogar; 1 criatura inimiga | D+? | -10 ATK/-25 DEF por 5 turnos; definir efeito adicional de “embriagada”. |
| 028 | Atravessava | jogar/equipar; 1 aliado | D+? | conceder ataque direto enquanto durar; texto não define duração. |
| 088 | Rego Freitas | jogar/equipar; 1 aliado | D | ataque direto até o fim do turno. |
| 090 | Bilugação Astral | jogar/equipar; 1 criatura | D+? | conceder `intransponível` por 1 turno; significado exato a decidir. |

### Equipamentos e efeitos ligados

| ID | Carta | Restrição | Modelo | Programação planejada |
|---|---|---|---|---|
| 001 | Espada Mágica | monstro | D | equipamento com +5 ATK/+5 DEF enquanto ligado. |
| 002 | Estrela Mágica | aliado | R | prevenir o próximo ataque contra o equipado e consumir o escudo. |
| 005 | Zica do pantano | criatura | D | imobilizar por 3 turnos e aplicar -5 DEF em cada tick. |
| 007 | Camisa 14 do América | criatura | H | +10 ATK por 2 turnos e roubar criatura inimiga de custo <= 3. |
| 089 | Apelino Pão e Vinho | criatura | M | limite de ataques infinito enquanto equipado. |
| 091 | Feitiço de Teletransporte | qualquer monstro | A | no fim do turno, opção de devolver equipado à mão, 1x/turno. |
| 092 | Cajado da Ilusão | monstro mágico | A+R | ativar intocável; prevenir próximo ataque e consumir, 1x/turno. |
| 093 | Medalhão de Cura | qualquer monstro | D | ao fim da fase de combate, curar 15 DEF, 1x/turno. |
| 094 | Pena do Gigante | não declarada | R+? | bloquear um ataque, inclusive contra imunidade; definir consumo. |
| 095 | Manto da Luz Solar | não declarada | R | ao ser atacado por Vampiro/Lobisomem, causar 15 à fonte. |
| 096 | Machado do Vento | não declarada | M | permitir segundo ataque em alvo distinto com 50% do dano. |
| 097 | Flecha de Prata | humanoide ou besta | M | ataque ignora habilidades defensivas do alvo. |
| 098 | Dispositivo de Sincronia | robótico | M | com outro robô aliado, ambos +5 ATK/+5 DEF. |
| 099 | Tomo de Feitiços Ancestrais | mágico | D | comprar 1 no início de cada turno do controlador. |
| 100 | Botas da Rapidez | não declarada | M | segundo ataque por turno com 50% do dano. |
| 101 | Olho de Águia | não declarada | M | ataques ignoram `EVASION` e `UNTOUCHABLE`. |
| 102 | Estaca do Caçador | guerreiro/humanoide | M | +10 ATK contra Vampiro/Lobisomem. |
| 103 | Couraça de Nano-Carbono | robótico | M | reduzir em 10 dano de atacante com custo >= 8. |
| 104 | Núcleo de Energia Pura | dragão ou elite | D | +5 ATK/+5 DEF enquanto equipado. |
| 105 | Manoplas de Gelo | não declarada | M | +15 dano contra criatura com trait `fogo`. |
| 106 | Escudo de Energia Estável | robótico | R | após cada pacote de dano recebido, controlador ganha 1 energia. |
| 107 | Lâmina Sagrada | elite/paladino | A+M | 1x/turno ignorar habilidade de Vampiro/Lobisomem escolhido. |
| 108 | Aura de Vingança | elite | R | ao equipado morrer, causar seu ATK efetivo ao PV inimigo. |

Regra estrutural: uma carta de suporte continua sendo uma instância, com
`ownerId`, `controllerId`, zona `equipment` e `attachedTo`. Seus campos
numéricos não serão somados automaticamente; o bônus executável vem da regra
estruturada aprovada para a carta.

### Entrada em campo e efeitos imediatos

| ID | Carta | Modelo | Programação planejada |
|---|---|---|---|
| 003 | ETC | H+? | ao entrar/ativar, mover monstros inimigos de custo < 3 para a mão do controlador de ETC; trigger a confirmar. |
| 012 | Natalino | D | ao ser invocado, curar 10 DEF de todas as outras criaturas aliadas. |
| 013 | Zol | D | ao ser invocado, comprar 1 carta. |
| 023 | Raylaser | D | ao ser invocado, causar 15 ao PV oponente. |
| 050 | Shupáku | H | ao entrar, escolher inimigo; ele não ataca enquanto Shupáku estiver em campo. |
| 079 | Lobo Beta Lightning | D | ao ser invocado, causar 20 ao PV oponente. |
| 086 | Sentinela Solar | M | ao ser invocado, por 1 turno prevenir dano de criaturas com ATK <= 30 contra ela e seu controlador. |

### Ações ativadas, custos e escolhas

| ID | Carta | Limite/custo | Modelo | Programação planejada |
|---|---|---|---|---|
| 011 | Kirb | ? | A+H | escolher criatura de custo < 4 e copiar habilidade; trigger, duração e elegibilidade a decidir. |
| 020 | Gobra | 1x/turno | A+? | mover campo -> mão; “voltar” ao campo e custo precisam de regra. |
| 026 | Sabota Copos | 1x/turno | A | escolher inimigo; -5 ATK/-5 DEF, duração a decidir. |
| 027 | Bilugatron | ? | A+H | anexar-se a inimigo, causar 10 por tick e desabilitar ataque/defesa próprios. |
| 031 | Duende | 1x/turno | M+? | conceder uma ativação mágica adicional; exige definir tag e limite-base. |
| 034 | Medusa de Lama | ? | A | escolher inimigo e paralisar por 1 turno. |
| 039 | Trox | 1x/partida | A+H | retornar à mão e marcar próxima invocação dessa instância com custo zero. |
| 041 | Gulosinho | 1x/turno, no fim do turno | R+? | se o controlador não declarou ataque no turno, pode receber +5 ATK/+5 DEF; duração e cumulatividade a decidir. |
| 045 | Invocador das Trevas | 1 energia | A+H | invocar Diabrete Alado; origem da instância a decidir. |
| 046 | Salatiel | 3 energias | A | declarar ataque com bypass de DEF após pagamento atômico. |
| 049 | Entola Guela | 1 alvo/turno | A | escolher inimigo e impedir ataques até o boundary definido. |
| 051 | Dino Elétrico | 1x/turno | A | causar 10 de dano a todos os monstros inimigos. |
| 055 | Mago Arcano | 1x/turno | A | causar 5 ao PV oponente. |
| 057 | Quimera de Fogo | 1x/turno | A | escolher de 1 a 3 inimigos distintos; causar 5 a cada um. |
| 061 | Alquimista Guardião | 1x/turno | A | aliado escolhido recebe +10 DEF até fim do próximo turno oponente. |
| 063 | Beluga de Terracota | 1x/turno | A | ataque direto alternativo com 50% do ATK. |
| 067 | Paladino Alvorada | 1x/turno | A | negar habilidades de inimigo até fim do turno dele. |
| 072 | Gigante da Marreta | ? | A+? | causar 10 de dano a todos os inimigos; trigger a decidir. |
| 080 | Lobo Omega Pyro | ? | A+D | escolher inimigo; aplicar -5 DEF por tick; duração a decidir. |
| 082 | Lobo Gamma Freeze | ? | A/D+? | paralisar todos os inimigos por 3 turnos; trigger a decidir. |

### Passivas, restrições e modificadores de estado

| ID | Carta | Modelo | Programação planejada |
|---|---|---|---|
| 010_1/2/3 | Diabrete Alado | M | permitir ataque direto ignorando criaturas. |
| 014 | Tobinha e Boguinha | M | atacantes de custo > 3 não podem escolhê-lo como alvo. |
| 018 | Cp-2 | M+? | restringir ataques inimigos; alcance exato (“só ele” ou nenhum ataque) a decidir. |
| 022 | Puma da Selva | M+? | ataque ignora DEF e causa dano direto; fórmula exata a decidir. |
| 024 | Slipul | M | se único aliado, +5 ATK/+5 DEF por criatura inimiga atual. |
| 025 | Zé Mulherzinha | M | não pode ser alvo direto enquanto houver outro aliado. |
| 033 | K-023 | M | com outro robô aliado, K-023 e os robôs elegíveis ganham +5 ATK. |
| 035 | Ptera | M | permitir ataque direto ignorando criaturas. |
| 037 | Scoul | M | com ao menos um dragão em campo, +10 ATK/+10 DEF. |
| 040 | Little Big Shimbard | M | dobrar DEF enquanto for única criatura aliada. |
| 043 | Goblin Mestre de Armas | M | dobrar ATK enquanto houver aliado de custo < 3. |
| 044 | Grifo Real | M | não pode ser atacado por criatura de custo <= 4. |
| 048 | Turtol | M | ignorar efeitos de habilidades de criatura-fonte com custo < 4. |
| 053 | Gárgula de Rocha | M+A | restringir atacante de custo < 5; opção de trocar ATK/DEF ao atacar. |
| 058 | Sábio da Montanha | M | se único aliado, não pode ser alvo de atacante de custo <= 4. |
| 059 | O Lica | M | não pode ser atacado quando o oponente controla exatamente 1 criatura. |
| 060 | Tranca Rua | M | havendo outro aliado, somente Tranca Rua pode ser alvo de ataque. |
| 064 | Gamaa | M | os ataques de Gamaa ignoram 10 DEF por criatura robótica que seu controlador possuir. |
| 065 | Iron Dragon | M | imune a efeitos de habilidades inimigas, não a combate físico. |
| 068 | Paladino Crepuscular | M | +10 DEF enquanto for único aliado. |
| 073 | Golem de Pedra | M | imune somente a dano de habilidade de criatura inimiga. |
| 074 | Nucles | M | reduzir em 10 o ATK efetivo do oponente no combate contra ele. |
| 075 | Turtol Maximus | M | +10 DEF quando o oponente controla exatamente 1 criatura. |
| 077 | Marik | M | +5 ATK por criatura inimiga atual. |
| 078 | Lobo Alfa Fly | M | seus ataques ignoram 20 DEF do alvo. |
| 081 | Latex | A/M+? | atacar todos os inimigos com 50% do ATK; definir se substitui ataque normal. |
| 084 | Imperial X | M | limite de 2 ataques por turno. |
| 085 | Marik 2 | A+? | atacar todos os inimigos e definir DEF própria como 0 após resolver. |
| 087 | Superior | M+R | 2 ataques/turno; após abate, escolher 1 criatura do descarte para a mão. |

### Modificadores e reações de combate

| ID | Carta | Janela | Modelo | Programação planejada |
|---|---|---|---|---|
| 017 | Bufaboi | primeiro ataque do turno | M | +10 ao dano/ATK somente naquele ataque. |
| 019 | Garras Afiadas | ataque declarado | M+? | +10 ATK se o alvo “acabou de ser invocado”; boundary exato a decidir. |
| 021 | Paladar | antes do dano | M+? | dobrar ATK se a DEF efetiva do alvo for superior; termo de comparação a confirmar. |
| 029 | Aladar | após abate | R | conceder uma nova oportunidade de ataque. |
| 030 | Cacton | dano recebido | R+? | devolver metade do dano; definir arredondamento e tipo do dano refletido. |
| 032 | Hipool | antes do dano | M+? | +10 dano se a DEF indicada no texto for menor; sujeito da comparação a decidir. |
| 036 | Rei das Feras | após abate | R | causar 10 ao PV do controlador da criatura derrotada. |
| 042 | Fantom | morte iminente por ataque | R | substituir morte por retorno à mão, opcional e sem custo. |
| 047 | Tobias | segundo ataque | M | 2 ataques/turno; segundo causa 50% do dano. |
| 052 | Dragão de Cobre | após abate | R | causar 10 ao PV inimigo. |
| 054 | Lorde Sanguinário | após abate | R | 1x/turno, opcional: transferir 10 PV do oponente ao controlador. |
| 056 | Minotauro Guerreiro | primeiro ataque de cada turno | M | ignorar toda DEF do alvo nesse ataque. |
| 066 | Mexica | primeiro ataque | M+? | dobrar dano; definir se primeiro por turno ou por partida. |
| 069 | Roller | morte iminente | R | retornar à mão; custo da instância aumenta permanentemente em 1. |
| 070 | Tiranossauro | primeiro ataque | M+? | ignorar 10 DEF; definir se primeiro por turno ou por partida. |
| 071 | Dragão de Jade | ao ser atacado | R | causar 10 de dano de habilidade ao atacante. |
| 076 | Condessa Carmilla | dano/abate | M+R | ATK efetivo do ataque = ATK - 15; após abate, +10 ATK permanente cumulativo. |
| 083 | Hidra das Profundezas | ao atacar | R | causar 20 a todos os outros monstros antes/depois do combate, a decidir. |

### Zonas, busca, roubo, morte e evolução

| ID | Carta | Modelo | Programação planejada |
|---|---|---|---|
| 003 | ETC | H | campo inimigo -> mão do controlador de ETC, preservando owner original. |
| 006 | Adubaram | H | campo -> descarte do owner e compra para o controlador do suporte. |
| 007 | Camisa 14 | H | mudar controller de inimigo custo <= 3; owner não muda. |
| 016 | Baltz | A/H+? | remover suportes do oponente; trigger, quantidade e destino a decidir. |
| 020 | Gobra | H | campo <-> mão, via transição canônica. |
| 027 | Bilugatron | H | campo próprio -> attachment hostil, com vínculo de fonte. |
| 038 | Tlantidu | R | ao morrer, opcionalmente buscar criatura `aquático` no deck; destino a decidir. |
| 039 | Trox | H | campo -> mão e desconto persistente da instância. |
| 042 | Fantom | R | substituir campo -> descarte por campo -> mão. |
| 045 | Invocador das Trevas | H | origem definida -> campo com custo de habilidade pago. |
| 062 | Alucard | R+? | após abate, ressuscitar aliado; escolha, limite e destino a decidir. |
| 069 | Roller | R | substituir morte por retorno e alterar custo da instância. |
| 075 | Turtol Maximus | H+? | evolução exige definir carta-base, custo e destino da base. |
| 085 | Marik 2 | H+? | evolução exige definir carta-base, custo e destino da base. |
| 087 | Superior | R | descarte -> mão após abate, com escolha válida. |
| 091 | Feitiço de Teletransporte | H | equipado -> mão; definir destino do equipamento anexado. |
| 108 | Aura de Vingança | R | snapshot do ATK antes da saída e dano ao PV após morte confirmada. |

## Modelo de Domínio Alvo

### Estado canônico

```javascript
gameState = {
  matchId,
  turn: { number, activePlayerId, phase, priorityPlayerId },
  players: {
    p1: { pv, energy, maxEnergy, zones: { deck: [], hand: [], field: [], discard: [] } },
    p2: { pv, energy, maxEnergy, zones: { deck: [], hand: [], field: [], discard: [] } }
  },
  cards: {
    [instanceId]: {
      instanceId,
      definitionId,
      ownerId,
      controllerId,
      zone,
      baseStats: { attack, defense, cost },
      damage,
      attachments: [],
      attachedTo: null,
      modifiers: [],
      usage: {}
    }
  },
  effects: [],
  pendingChoice: null,
  eventQueue: []
};
```

Invariantes:

- Uma instância ocupa exatamente uma zona principal.
- `definitionId` nunca muda; `instanceId` é único durante a partida.
- `ownerId` não muda; roubo altera somente `controllerId`.
- Equipamento mantém identidade, owner e controller e referencia `attachedTo`.
- PV, energia, dano e uso de habilidade são alterados primeiro no estado.
- DOM nunca decide resultado de regra.
- Uma ação inválida não paga custo nem produz efeito parcial.
- Reset elimina fila, seleções, modificadores, usos e referências pendentes.

### Dados estruturados de carta

O JSON canônico deve ser estendido, não duplicado:

```json
{
  "id": "card_061",
  "name": "Alquimista Guardião",
  "type": "criatura",
  "traits": ["magico"],
  "hability": "Elixir Protetor: ...",
  "abilities": [
    {
      "id": "elixir_protetor",
      "trigger": "ABILITY_ACTIVATED",
      "limit": { "kind": "PER_TURN", "count": 1 },
      "target": { "side": "ALLY", "type": "CREATURE", "count": 1 },
      "effects": [{ "kind": "MODIFY_STAT", "stat": "defense", "amount": 10 }],
      "duration": { "kind": "UNTIL_END_OF_OPPONENT_TURN" }
    }
  ]
}
```

Descritores devem cobrir regras repetidas. `handler: "nome"` só é permitido
quando uma composição de primitivas não representar a habilidade de forma
clara, como cópia de habilidade, evolução ou ataque em área especial.

### Traits obrigatórios

O catálogo usa conceitos que não existem no schema atual. Antes de migrar as
cartas dependentes, adicionar vocabulário controlado e auditável para:

`aquatico`, `besta`, `dragao`, `elite`, `fogo`, `guerreiro`, `humanoide`,
`lobisomem`, `magico`, `paladino`, `robotico` e `vampiro`.

Não inferir traits por nome, custo, imagem ou substring da habilidade.

### Pipeline de ação

Toda jogada passa por `resolveAction(action)`:

1. Validar turno, fase, ownership/controller, zona, custo, limite e alvos.
2. Se faltar escolha, criar `pendingChoice` e pausar sem pagar custo.
3. Confirmar escolha e construir um contexto imutável da ação.
4. Pagar custos de forma atômica.
5. Emitir evento de declaração.
6. Coletar restrições, substituições e modificadores aplicáveis.
7. Resolver o efeito base.
8. Aplicar state-based actions até estabilizar: DEF/dano letal, descarte,
   attachments inválidos e derrota do jogador.
9. Emitir eventos derivados em ordem determinística.
10. Consumir limites e efeitos de uso único.
11. Limpar efeitos expirados.
12. Renderizar uma única vez e apresentar o log da resolução.

Eventos mínimos:

`TURN_STARTED`, `PHASE_STARTED`, `PHASE_ENDING`, `TURN_ENDING`, `TURN_ENDED`,
`CARD_PLAYED`, `CREATURE_SUMMONED`, `EQUIPMENT_ATTACHED`, `ABILITY_ACTIVATED`,
`ATTACK_DECLARED`, `BECAME_ATTACK_TARGET`, `BEFORE_DAMAGE`, `DAMAGE_DEALT`,
`CREATURE_WOULD_DIE`, `CREATURE_DESTROYED`, `CREATURE_DEFEATED`, `CARD_MOVED`,
`STATE_CHANGED` e `SOURCE_LEFT_FIELD`.

### Resolução de combate

O ataque deve criar um contexto, sem modificar os objetos durante a validação:

```javascript
{
  actionId,
  attackerId,
  targetId,
  attackOrdinal,
  isDirect,
  baseAttack,
  attackModifiers: [],
  defenseModifiers: [],
  prevention: [],
  damagePackets: [],
  defeated: []
}
```

Ordem proposta:

1. Validar permissão de ataque e alvo.
2. Aplicar modificadores de declaração e ordinal do ataque.
3. Abrir reações de alvo e prevenção.
4. Calcular pacotes de dano físico e de habilidade separadamente.
5. Aplicar dano simultâneo quando a regra base exigir.
6. Resolver substituições de morte.
7. Mover mortos e equipamentos às zonas definidas.
8. Creditar abates e executar triggers pós-abate.
9. Conceder/consumir ataques adicionais.

Imunidade deve informar sua categoria: seleção por habilidade, efeito de
habilidade, dano de habilidade, ataque físico, dano físico ou condição. Nunca
converter “imune a habilidades” em “não pode ser atacado”.

### Stats e modificadores

Valores efetivos são derivados:

$$
ATK_{efetivo} = f(ATK_{base}, modificadores_{aditivos}, multiplicadores,
contexto)
$$

$$
DEF_{restante} = \max(0, DEF_{efetiva} - danoAcumulado)
$$

Cada modificador possui `sourceId`, camada, valor, condição e expiração.
Remover ou expirar um modificador não recalcula por diferença nem “devolve”
stats manualmente; o valor efetivo é novamente derivado da lista ativa.

Ordem de camadas:

1. valor base da definição/instância;
2. substituições de valor;
3. bônus e penalidades aditivas;
4. multiplicadores;
5. modificadores específicos do ataque;
6. piso em zero e arredondamento aprovado.

### Duração

Não usar apenas um inteiro decrementado a cada troca global. Toda duração deve
declarar boundary e perspectiva:

- `UNTIL_END_OF_TURN(playerId, turnNumber)`;
- `UNTIL_END_OF_OPPONENT_TURN(controllerId)`;
- `FOR_CONTROLLER_TURNS(playerId, count)`;
- `FOR_TARGET_CONTROLLER_TURNS(targetId, count)`;
- `UNTIL_SOURCE_LEAVES(sourceId, zone)`;
- `UNTIL_NEXT_MATCHING_EVENT(predicate)`;
- `PERMANENT_ON_INSTANCE`.

### Seleção e interface

O motor expõe opções legais; a UI devolve somente IDs selecionados ou
cancelamento. O mesmo mecanismo atende alvo único, até três alvos, deck,
descarte, habilidade copiada e ações opcionais.

Uma ação cancelada antes da confirmação não gasta energia nem uso. Após o
pagamento, o cancelamento só é permitido se a regra declarar rollback.
Handlers não usam `alert`, `prompt`, seletores DOM ou timeouts.

## Primitivas Reutilizáveis

| Primitiva | Uso mínimo real |
|---|---|
| `modifyStat` | 001, 004, 007, 009, 015, 017, 019, 024, 026 e outras |
| `dealDamage` | 023, 030, 051, 055, 057, 071, 079, 083 e outras |
| `healCreature` | 012, 093 |
| `changePlayerPv` | 023, 036, 052, 054, 055, 079, 108 |
| `drawCards` | 006, 013, 099 |
| `moveCard` | 003, 006, 016, 020, 038, 039, 042, 062, 069, 087, 091 |
| `attachCard` | 001, 002, 005, 007, 088-108 |
| `changeController` | 007 |
| `preventEvent` | 002, 042, 086, 090, 092, 094 |
| `grantAttackPermission` | 010, 028, 035, 088 |
| `modifyAttackLimit` | 029, 047, 084, 087, 089, 096, 100 |
| `negateAbilities` | 067, 097, 101, 107 |
| `searchCards` | 038 |
| `copyAbility` | 011 |
| `evolveCard` | 075, 085 |

Uma abstração só entra no motor quando atende ao menos dois usos reais ou é
uma regra fundamental (ação, evento, zona, dano ou escolha).

## Estratégia de Migração

A migração é vertical: cada fase entrega regras executáveis e testes, sem
manter dois motores decidindo a mesma ação. `window.cardAbilities` permanece
como adaptador temporário e delega ao novo resolvedor para cartas migradas.

### Fase 0 - Decisões e saneamento do catálogo

Arquivos previstos: JSON, esta spec e validador do catálogo.

- Resolver as decisões de produto bloqueadoras.
- Corrigir contagens de metadados.
- Adicionar traits e estruturas de habilidade em um primeiro lote pequeno.
- Criar validação de schema, IDs, handlers e vocabulário.

Gate: catálogo rejeita trait, trigger, duração, alvo ou efeito desconhecido.

### Fase 1 - Estado e identidade

Arquivos previstos: `game.html`, `src/js/deck_system.js`, novo módulo de
engine e teste unitário.

- Criar instâncias únicas e zonas canônicas.
- Mover PV e energia para `gameState`, mantendo elementos atuais como projeção.
- Corrigir compra, descarte e publicação controlada da API global.
- Preservar comportamento-base sem migrar habilidades.

Gate: sacar, invocar, descartar e reiniciar não duplicam instâncias; estado e
UI exibem os mesmos valores.

### Fase 2 - Ações, eventos e efeitos

Arquivos previstos: módulo do engine, `card-abilities.js`, `game.html` e testes.

- Implementar `resolveAction`, fila síncrona, movimentos de zona e cleanup.
- Implementar modificadores, duração e limites de uso.
- Implementar seleção headless e adaptador de UI mínimo.
- Manter o renderer atual como consumidor do estado.

Gate: testes de ordem de eventos, expiração, rollback e limpeza passam.

### Fase 3 - Combate canônico

Arquivos previstos: engine, `game.html`, `card-abilities.js` e testes.

- Migrar ataque normal/direto, dano mútuo, morte e crédito de abate.
- Integrar redução, prevenção, reflexão, bypass e pacotes de dano.
- Trocar `attackedThisTurn` por orçamento/contagem de ataques por instância.
- Remover timeouts da decisão de regra; animação observa eventos já resolvidos.

Gate: matriz de combate cobre ataque normal, direto, segundo ataque, área,
imunidade, reflexão, morte simultânea e penetração.

### Fase 4 - Cartas simples

Lotes de no máximo quatro arquivos, organizados por primitivas:

1. invocação, compra e dano direto: 012, 013, 023, 079;
2. buffs/debuffs simples: 001, 004, 009, 017, 019, 026;
3. proteções e ataque direto: 002, 010_1/2/3, 014, 018, 025, 028, 035, 044,
   088;
4. condições de campo: 024, 033, 037, 040, 043, 058, 059, 060, 068, 077 e 098;
5. equipamento declarativo simples: 104.

Gate por lote: registro completo, cenário positivo, cenário negativo,
expiração/cleanup quando aplicável e teste de integração da ação real.

### Fase 5 - Combate avançado

- Modificadores: 021, 022, 032, 053, 056, 064, 066, 070, 074, 076, 078,
  095, 102, 103 e 105.
- Reações/abates: 029, 030, 036, 042, 052, 054, 071, 073, 087 e 108.
- Ataques adicionais/área: 047, 051, 057, 063, 072, 081, 083, 084, 089,
  096 e 100.
- Imunidade/negação: 048, 065, 067, 086, 090, 092, 094, 097, 101 e 107.

Gate: nenhum modificador depende de retorno ignorado ou flag sem consumidor.

### Fase 6 - Zonas, vínculos e habilidades especiais

- Movimento/controle: 003, 006, 007, 016, 020, 027, 038, 039, 045, 050,
  062, 069 e 091.
- Ativações e ticks: 005, 008, 015, 031, 034, 041, 046, 049, 055, 061,
  080, 082, 093, 099 e 106.
- Cópia/evolução: 011, 075 e 085.

Gate: owner/controller, zona, vínculos e efeitos ligados permanecem válidos
após retorno, roubo, destruição, ressurreição e reset.

### Fase 7 - Remoção do legado

- Remover dispatchers e descritores inertes substituídos.
- Remover painel manual hardcoded e usar ações disponíveis geradas pelo motor.
- Tirar scripts de diagnóstico da página de produção.
- Atualizar documentos de progresso com métricas baseadas em testes.

Gate: nenhuma regra depende de leitura/escrita direta do DOM e nenhuma carta
migrada possui caminho alternativo no motor legado.

## Estratégia de Testes

Usar JavaScript puro e assertions automatizadas, sem dependência externa. O
núcleo deve poder ser executado fora do DOM por Node; a integração visual pode
continuar sendo validada no browser.

### Camadas

1. Catálogo: schema, IDs, contagens, traits, referências e cobertura de
   registros.
2. Unidade: cada primitiva, duração, limite, seletor, modificador e movimento.
3. Contrato por carta: ao menos um cenário positivo por design único; incluir
   cenário negativo para custo, alvo, condição ou imunidade.
4. Matriz de combate: combinações representativas e ordem de eventos.
5. Integração: ações reais de comprar, jogar, equipar, ativar, atacar e encerrar
   turno atualizam estado e projeção visual.
6. Reset: partida nova não herda efeitos, usos, escolhas ou referências.

### Determinismo

- Injetar RNG para dado, embaralhamento e futuras escolhas aleatórias.
- Não usar `setTimeout` para semântica; somente a camada visual pode atrasar.
- IDs de instância devem vir de fábrica injetável nos testes.
- Logs de evento devem permitir comparar ordem e payloads.

Uma carta está “implementada” somente quando registro, fluxo executável e teste
comportamental passam. Contagem de métodos, IDs em texto ou flags não conta.

## Critérios de Aceitação

- Alterar ATK/DEF produz o mesmo valor no estado, no próximo combate e na UI.
- Efeito temporário expira no turno/fase correto e não remove outros bônus.
- Escolha inválida ou cancelada antes da confirmação não gasta energia nem uso.
- Ataques adicionais respeitam quantidade, alvo distinto e redução declarada.
- Destruição simultânea tem ordem estável e atribui abates corretamente.
- Retorno, roubo e ressurreição preservam owner e atualizam controller/zona.
- Remover uma fonte encerra somente efeitos cuja duração depende dela.
- Imunidade diferencia targeting, efeito, dano de habilidade e ataque físico.
- Equipamento inválido por trait não pode ser pago ou anexado.
- As 110 entradas carregam e nenhum registro aponta para handler inexistente.

## Riscos e Mitigações

- **Migração longa:** entregar por primitivas e lotes verticais; não migrar as
  108 habilidades em um único patch.
- **Dois motores ativos:** cada definition ID tem um único owner de resolução;
  o adaptador legado apenas encaminha.
- **Mudança visual acidental:** manter HTML/CSS atual nas fases de fundação e
  validar snapshots/fluxos do browser separadamente.
- **Texto ambíguo virar regra acidental:** bloquear a carta no validador até a
  decisão ser registrada.
- **Loops de eventos:** limitar profundidade, registrar causalidade e impedir o
  mesmo efeito de reagir ao evento que ele próprio criou quando não permitido.
- **Modificadores cumulativos incorretos:** usar IDs de efeito e camadas, nunca
  alterar base stats para efeitos temporários.
- **Referências órfãs:** `moveCard` e reset executam cleanup e a auditoria testa
  toda referência ativa.

## Decisões de Produto Bloqueadoras

As respostas devem ser registradas antes da fase que migra a carta afetada:

1. Os campos `attack`/`defense` de suportes são bônus além do texto ou apenas
   dados legados? Recomendação: o texto é canônico e somente bônus escritos são
   aplicados.
2. Sem habilidade, ataque direto só é permitido quando o oponente não controla
   criaturas? Recomendação: sim; permissões de carta fazem bypass dessa regra.
3. “Não pode defender” elimina somente o contra-ataque ou impede ser alvo?
   Recomendação: elimina o dano de resposta, mas a criatura continua alvo legal.
4. Efeitos sem duração explícita, como Chocolicia, Abutuaram e Sabota Copos,
   duram enquanto a instância permanecer na zona atual ou pela partida?
5. Para Gulosinho, “abdicar de atacar” significa encerrar o turno sem declarar
   nenhum ataque? O bônus é permanente, cumulativo ou dura até outro boundary?
6. Para Garras Afiadas, “acabou de ser invocado” vale até o fim do turno em que
   o alvo entrou, até o início do próximo turno do controlador ou outro período?
7. Sincronia Robótica afeta K-023 e somente um outro robô escolhido, como sugere
   “ambos”, ou todos os robôs aliados elegíveis?
8. Tranca Rua considera outras criaturas aliadas, inimigas ou qualquer outra em
   campo?
9. O bônus da Condessa Carmilla é permanente e cumulativo a cada abate?
10. “Primeiro ataque” de Mexica e Tiranossauro significa por turno ou por
   entrada em campo? Recomendação: por turno, consistente com Bufaboi.
11. Qual é a duração da queimadura do Lobo Omega Pyro e quando ocorre o tick?
12. Cp-2 força ataques contra si, impede todos os ataques ou protege o jogador?
13. “Intransponível” da Bilugação Astral impede targeting, dano, destruição e/ou
   ataque direto ao controlador?
14. ETC e Baltz ativam ao serem invocados, são ações manuais ou efeitos
   opcionais? Quantos alvos afetam e para qual mão/descarte vão?
15. O Diabrete criado pelo Invocador vem do deck, da mão, do descarte ou é um
    token fora do deck?
16. Tlantidu busca para a mão ou topo do deck? O deck é embaralhado depois?
17. Alucard ressuscita qual aliado, para mão ou campo, com qual DEF e com qual
    limite por turno/partida?
18. Evoluções exigem qual carta-base, pagam diferença ou custo total, preservam
    dano/equipamentos e enviam a base para onde?
19. Kirb copia habilidade ativada, passiva ou qualquer habilidade? O jogador
    escolhe a fonte? A cópia dura até quando?
20. “Ignorar defesa” causa ATK completo à DEF e excedente ao PV, ou causa ATK
    diretamente ao PV sem ferir a criatura?
21. Dano refletido e metade de dano arredondam para baixo ou para cima?
22. “A cada dano recebido” do Escudo de Energia conta por pacote de dano, por
  ação resolvida ou no máximo uma vez por evento?
23. Suportes ofensivos podem ser ligados ao oponente ou são cartas instantâneas
    que vão ao descarte após resolver?
24. Ao retornar a criatura equipada à mão, equipamentos vão para o descarte,
    retornam às mãos de seus owners ou permanecem ligados?

## Dependências

- Nenhuma biblioteca externa nova.
- Requer Node disponível apenas para a suíte headless proposta; o jogo continua
  executando diretamente no navegador por servidor HTTP local.
- Cada fase deve gerar sua própria spec/prompt pack e respeitar o orçamento de
  no máximo quatro arquivos, salvo justificativa explícita.