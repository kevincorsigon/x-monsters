# Relatório: `traits` do catálogo × arte das cartas

Escopo: cruzar o campo `traits` de `data/cards_database.json` (79 criaturas +
evoluções com traits, de 110 cartas) contra a arte impressa em
`assets/cards/*.png`.

Status: **suíte verde (257/257 unit, 20/20 browser)** com as **sugestões
aplicadas** (seções A e E) e as 79 cartas **validadas em tudo que é verificável
sem visão** (seção D): inventário de traits travado por teste, invariantes de
corpo, integridade das 110 artes e triagem textual — hoje com **zero divergência
de trait pendente**. O que resta é julgamento visual: 19 cartas foram inspecionadas
por olhos humanos e o modelo desta sessão não aceita entrada de imagem
(`Current model does not support image input`); as 60 restantes têm as folhas de
contato prontas em `reports/trait-review/folha_00..08.jpg`.

## Critério usado (fonte: `.vibeflow/decisions.md`, 2026-09-21)

1. `humanoide` = bípede + **corpo de humano** + capaz de empunhar arma. Corpo
   não humano (`dragao`, `robotico`, `aquatico`, `planta`, `fantasma`) nunca é
   `humanoide`.
2. Ofício humano (`guerreiro`, `paladino`, `vampiro`) implica `humanoide`.
   **`lobisomem` não implica**: lobos são caninos; só licantropos de corpo
   humano (`card_059`, `card_077`, `card_085`) são `humanoide`.
3. `elite` é derivável de ATK > 50 (implicação de **mão única**) e também marca
   uma lista fechada de chefes nomeados com ATK <= 50: `card_036` Rei das Feras,
   `card_054` Lorde Sanguinário, `card_061` Alquimista Guardião, `card_067`
   Paladino Alvorada, `card_068` Paladino Crepuscular e `card_076` Condessa
   Carmilla — lista levantada na auditoria de 2026-09-21 e travada por teste.
4. `evolução` herda os traits da forma base (+ `elite` se ATK > 50).
5. Canino, felino e afins são `besta` (família Lobo `078`–`082`); `magico`,
   `voador`, `aquatico` e `planta` descrevem ofício, meio ou substância quando a
   arte, o nome ou o efeito declaram — aplicado na seção E.

## A. Família Lobo — RESOLVIDA pela decisão do autor (213/213)

O ponto de partida era uma inconsistência de dados: `card_078`/`card_079`/`card_080`
estavam sem `humanoide` no JSON, mas com `humanoide` no fallback
`TRAITS_BY_DEFINITION` e na lista esperada dos testes (3 FAILs). A primeira
correção aplicada foi somar `humanoide` aos três, seguindo
`.vibeflow/decisions.md` (que tratava licantropo como sempre humanoide).

O autor do jogo corrigiu o critério: **"lobos não são humanoides por padrão,
lobisomens sim"**. A direção foi invertida — `humanoide` saiu dos **cinco**
lobos, não só dos três:

| Carta | Antes | Depois |
| --- | --- | --- |
| `card_078` Lobo Alfa Fly | `lobisomem, elite, humanoide` | `lobisomem, elite` |
| `card_079` Lobo Beta Lightning | `lobisomem, elite, humanoide` | `lobisomem, elite` |
| `card_080` Lobo Omega Pyro | `lobisomem, fogo, elite, humanoide` | `lobisomem, fogo, elite` |
| `card_081` Latex | `lobisomem, elite, humanoide` | `lobisomem, elite` |
| `card_082` Lobo Gamma Freeze | `lobisomem, elite, humanoide` | `lobisomem, elite` |

Opção escolhida pelo autor: **só `humanoide` sai; `lobisomem` fica**. Assim os
matchups de caça não mudam (`card_107` Lâmina Sagrada, `card_102` Estaca do
Caçador e `card_095` Manto da Luz Solar leem `lobisomem`, que os lobos
conservam). `card_059` O Lica, `card_077` Marik e `card_085` Marik 2 mantêm
`humanoide` — licantropos de corpo humano.

Três arquivos sincronizados:

- `data/cards_database.json` — traits dos 5 (fonte de verdade, `json.load` OK).
- `src/js/card-rules.js` — `TRAITS_BY_DEFINITION` dos 5 + comentário do critério.
- `tests/unit/run-tests.js` — 5 ids removidos da lista de humanoides;
  invariante de ofício humano restrito a `guerreiro`/`paladino`/`vampiro`;
  teste novo `lobisomens de corpo humano são humanoides; a família Lobo não é`
  trava os dois lados da regra.

Evidência: `node tests/unit/run-tests.js` → **213/213 testes passaram** (212
anteriores + o teste novo). Contagem de `humanoide` no catálogo: 31 → **26**;
`lobisomem` continua em 8 cartas.

Efeito colateral real (não coberto por teste): `card_097` Flecha de Prata
(`requiredTraitsAny: ['humanoide','besta']`) e `card_102` Estaca do Caçador
(`['guerreiro','humanoide']`) **deixam de aceitar os lobos como hospedeiros**.
Correção proposta na seção E: dar `besta` à família Lobo (caninos são bestas) —
não aplicada, depende de decisão do autor.

Nota fora do escopo: a suíte de browser dá **20 PASS / 0 FAIL**, desde que o
servidor estático esteja no ar (`py -3 -m http.server 8080`) — sem ele as páginas
não carregam, os globals faltam e o resultado é 5 PASS / 15 FAIL, um falso
negativo idêntico com ou sem as mudanças de trait. O runner agora faz
`ensureServer()` e aborta com mensagem explícita (`ECONNREFUSED`) em vez de
reportar os 15 FAILs. `decisions.md:84` registrava 20 PASS naquele ciclo.

## B. Divergências confirmadas por inspeção visual (19 cartas)

| Carta | Traits no catálogo | Arte observada | Veredito |
| --- | --- | --- | --- |
| `card_012` Natalino | `planta` | **árvore** de Natal antropomórfica (tronco/corpo, raízes, folhagem, estrela; crianças ao redor) | **APLICADO** — era `humanoide`; trocado por `planta` |
| `card_016` Baltz | `besta` | **cão Shiba Inu quadrúpede** movendo latas de lixo por telecinese | **APLICADO** — era `guerreiro, humanoide`; trocado por `besta` |
| `card_003` ETC | `humanoide, voador` | alienígena cinza bípede pilotando disco voador | **APLICADO** — corpo humanoide mantido, `voador` somado |
| `card_011` Kirb | `besta` | esfera rosa (Kirby), sem anatomia de fera | **MANTIDO** — `besta` é o fallback do catálogo e a habilidade (copiar habilidade) não declara magia |
| `card_013` Zol | `besta` | blob amarelo de um olho só, braços-tentáculo | **MANTIDO** — mesmo caso do fallback `besta` |
| `card_023` Raylaser | `robotico` | criatura azul orgânica de um olho, chifre, armadura dourada, disparando laser | **MANTIDO** — `robotico` tem mecânica ativa (3 equipamentos com `requiredTrait`, filtros em habilidades); trocar seria balanceamento, não trait |
| `card_021` Paladar | `besta` | boca/tentáculo flutuante gigante | OK (fallback `besta`) — sem ação |
| `card_019` Garras Afiadas | `besta` | fera lupina negra de garras longas | OK |
| `card_020` Gobra | `dragao` | serpente alada | OK (`voador` seria opcional) |
| `card_022` Puma da Selva | `besta` | pantera negra | OK |
| `card_024` Slipul | `demonio` | silhueta sombria com faixa vermelha | OK |
| `card_025` Zé Mulherzinha | `humanoide` | bruxa em vestido, corpo humano | OK |
| `card_026` Sabota Copos | `humanoide` | homem de terno e óculos em bar | OK |
| `card_017` Bufaboi | `besta` | bisão | OK |
| `card_018` Cp-2 | `robotico` | drone/olho cibernético | OK |
| `card_014` Tobinha e Boguinha | `besta` | dois filhotes de cachorro | OK |
| `card_010_1/2/3` Diabrete Alado | `demonio, voador` | demônios alados | OK |

## C. Varredura automatizada das 79 cartas (o resto, sem visão)

Ferramenta: `scripts/analyze_card_art_features.py` →
`reports/trait-review/art_features.csv` (79 linhas, uma por criatura/evolução,
com paleta do painel, pistas textuais e sinais).

O que foi medido, calibrado contra as 19 cartas da seção B:

- **Rejeitado — cor e geometria.** As artes são cartas **já renderizadas**
  (768x1017, sem canal alfa): moldura + nome + painel de ilustração (x 55-715,
  y 110-785, medido no template) + texto. O painel é uma **cena pintada**, não um
  recorte do monstro, então a paleta mede o cenário. Na calibração os sinais de
  cor **não acusaram** a divergência confirmada de `card_012` (árvore de Natal
  tem paleta vermelho/dourado: `planta=0.11`) e **falsificaram** `card_016`
  (`metal=0.61` = fundo), `card_023` (`metal=0.04` apesar da armadura),
  `card_010_1/2/3` (`planta=0.45` = vegetação do fundo) e `card_070`
  (`fogo=0.77` = céu). Silhueta bípede/quadrúpede é inexistente sem alfa. A
  paleta permanece no CSV como dado descritivo, **sem gerar sinal**.
- **Aceito — pistas textuais** (nome + `hability`), independentes de arte e
  reproduzíveis: 79 cartas varridas, **5 na fila de triagem**, 70 sem sinal.
  Falsos positivos revisados e descartados com motivo em `EXCECOES` no script:
  `card_029` Aladar (a habilidade é ataque extra, não voo), `card_045` (o
  "Diabrete Alado" do texto é o token invocado, não a criatura), `card_067`/
  `card_068` (`paladino` nunca leva `guerreiro` no catálogo) e `card_087`
  (recusa de `voador` registrada em `decisions.md:63-66`).

| Carta | Traits hoje | Sinal | Leitura |
| --- | --- | --- | --- |
| `card_061` Alquimista Guardião | `elite, humanoide, magico` | texto indicava `magico` | **APLICADO** — Elixir Protetor; passa a equipar `092`/`099` |
| `card_063` Beluga de Terracota | `besta, aquatico` | texto indicava `aquatico` | **APLICADO pelo nome** (cetáceo) — a arte desta carta segue sem inspeção visual |
| `card_078` Lobo Alfa Fly | `lobisomem, elite, besta, voador` | texto indicava `voador` | **APLICADO** — "Domínio Aéreo" + nome "Fly" |
| `card_079` Lobo Beta Lightning | `lobisomem, elite, besta` | catálogo sem `eletrico` | gap de catálogo, não de carta |
| `card_082` Lobo Gamma Freeze | `lobisomem, elite, besta` | catálogo sem `gelo` | gap de catálogo, não de carta |

Limite explícito: para traits de corpo (`humanoide`, `besta`, `dragao`,
`robotico`, `voador`) nenhuma automação substitui a arte — a conferência visual
da seção D continua sendo a única fonte.

## D. Validação das 79 cartas e o que ainda depende de olho humano

### D.1 Validação executável (feita, roda na suíte de unidade)

1. **Inventário travado** — `inventário de traits do catálogo é fechado (lista por
   trait)`: as 16 traits e as 79 cartas que as carregam estão fixadas em teste.
   Somar, remover ou trocar uma trait em qualquer carta quebra a suíte, o que
   protege justamente as 60 cartas que ninguém olhou ainda.
2. **Vocabulário fechado** — nenhuma criatura/evolução sem traits, nenhuma trait
   fora do vocabulário (`typo`) e nenhuma trait repetida na mesma carta. Também
   confirma que as 31 cartas sem traits são todas do tipo `suporte`.
3. **Corpo** — `humanoide` nunca coexiste com `dragao`/`robotico`/`aquatico`/
   `planta`/`fantasma`; ofício humano (`guerreiro`/`paladino`/`vampiro`) sempre
   com `humanoide`; a família Lobo tem `lobisomem` + `besta` e nunca `humanoide`.
4. **`elite`** — ATK > 50 sempre com `elite`, e a lista de `elite` com ATK <= 50
   é exatamente a dos 6 chefes nomeados (item 3 do critério).
5. **`evolução`** — as duas evoluções herdam todos os traits da base declarada no
   motor (`CardRules.getEvolutionBaseDefinitionId`).
6. **Integridade das artes** — as **110** imagens do catálogo existem, são PNG
   válidos (IHDR + CRC conferidos) e medem **768x1017**: 77 criaturas, 31
   suportes e 2 evoluções. Sem isso as folhas de contato não valeriam nada.
7. **Triagem textual** — 79 cartas varridas, **0 divergência de trait pendente**.
   As 2 entradas restantes são nota de catálogo, não de carta: `card_079`
   ("Lightning") e `card_082` ("Freeze") pedem traits `eletrico`/`gelo` que o
   vocabulário não tem.
8. **Matriz de equipamento** — teste dedicado confirma quem hospeda os dois
   suportes de caça depois das correções: Flecha de Prata (`humanoide`/`besta`)
   aceita guerreiro, Alquimista, família Lobo, Baltz e Tobinha e recusa Natalino
   (`planta`), Raylaser (`robotico`), Superior (`dragao`) e Hidra (`aquatico`);
   Estaca do Caçador (`guerreiro`/`humanoide`) aceita guerreiro e Alquimista e
   recusa lobos, Baltz e Natalino.

### D.2 O que continua exigindo olho humano (60 cartas)

Traits de corpo (`humanoide`, `besta`, `dragao`, `robotico`, `voador`) e de
habitat não são deriváveis do texto nem do recorte do painel: só a arte confirma.
As folhas de contato com id, nome e traits estão em
`reports/trait-review/folha_00..08.jpg`.

48 de risco alto (trait específico que a arte precisa confirmar) e 12 de risco
baixo (só `besta`/`elite`).

Risco alto:
`027 029 030 031 032 033 034 035 037 038 040 042 043 044 045 046 047 051 052 054 055 056 057 058 059 060 061 062 064 065 066 067 068 071 072 074 076 077 078 079 080 081 082 083 084 085 086 087`

Risco baixo:
`036 039 041 048 049 050 053 063 069 070 073 075`

Checagens dirigidas (hipóteses por nome/`hability`, **não** por arte — confirmar
na folha antes de mexer):

- Resolvidos na seção E: `card_078` (`voador`), `card_063` (`aquatico` pelo
  nome, arte ainda a confirmar) e `card_061` (`magico`).
- `card_073` Golem de Pedra e `card_053` Gárgula de Rocha: construtos, `besta` é discutível.
- `card_056` Minotauro Guerreiro: cabeça bovina em corpo humano — decidir se satisfaz "corpo de humano".
- `card_057` Quimera de Fogo: quimera é animal composto — avaliar `besta` junto de `fogo`.
- `card_032` Hipool, `card_034` Medusa de Lama, `card_074` Nucles: `aquatico` declarado, mas a paleta do painel não tem azul — só a arte confirma se o cenário é aquático.
- `card_079` "Lightning" e `card_082` "Freeze": o catálogo não tem traits `eletrico`/`gelo`; hoje não há como marcar — decisão de catálogo, não de carta.

## E. Sugestões — APLICADAS (221/221)

As nove correções da rodada anterior foram aplicadas pelo autor no catálogo
(`data/cards_database.json`, fonte de verdade), no fallback
`TRAITS_BY_DEFINITION` (`src/js/card-rules.js`) e travadas por dois testes novos
(`traits aplicados por arte/efeito…` e `a família Lobo é besta e volta a ser
hospedeira da Flecha de Prata`).

| Carta | Antes | Depois | Evidência |
| --- | --- | --- | --- |
| `card_012` Natalino | `humanoide` | `planta` | arte: árvore de Natal antropomórfica |
| `card_016` Baltz | `guerreiro, humanoide` | `besta` | arte: cão Shiba Inu quadrúpede |
| `card_003` ETC | `humanoide` | `humanoide, voador` | arte: alienígena em disco voador |
| `card_061` Alquimista Guardião | `elite, humanoide` | `+ magico` | Elixir Protetor |
| `card_063` Beluga de Terracota | `besta` | `besta, aquatico` | nome (cetáceo) — arte não inspecionada |
| `card_078` Lobo Alfa Fly | `lobisomem, elite` | `+ besta, + voador` | "Domínio Aéreo" + nome "Fly" |
| `card_079`/`080`/`081`/`082` | `lobisomem, elite` (`080` com `fogo`) | `+ besta` | canino é `besta`, como `card_014` Tobinha |

Mantidos (as sugestões previam "manter"): `card_011` Kirb e `card_013` Zol
seguem `besta` — copiar habilidade e comprar carta extra não declaram magia — e
`card_023` Raylaser segue `robotico`, porque a trait tem mecânica ativa
(`requiredTrait` em três equipamentos, ex.: `card_106`, e filtros de robôs em
habilidades); trocar por `besta` seria balanceamento, não descrição de corpo.

Consequências de jogo assumidas:

- `card_012` e `card_016` deixam de ser hospedeiros de `card_097` Flecha de
  Prata e `card_102` Estaca do Caçador.
- `card_097` volta a equipar a família Lobo (`besta`); `card_102` **continua**
  não equipando neles, pois exige `guerreiro`/`humanoide`.
- `card_063` passa a ser procurada pela habilidade do `card_038` Tlantidu ("ao
  morrer pode procurar um monstro aquático no deck").
- `card_061` passa a equipar `card_092` Cajado da Ilusão e `card_099` Tomo de
  Feitiços Ancestrais (hospedeiro `magico`).

Contagem de `humanoide` no catálogo: 31 → **24**; `besta` vai a 26, `voador` a
7, `magico` a 4, `aquatico` a 6 e `planta` a 2.

## F. Alinhamento deck × tema (`data/decks.json`) — 2026-09-22

Auditoria complementar à das traits: aqui o cruzamento é **criatura × tema do
preset** (não × arte). Critério: a criatura está no tema quando alguma trait dela
(exceto `elite`) aparece no `traits` do deck; `elite` fica fora porque está nos
nove presets e faria qualquer elite casar com qualquer arquétipo.

Baseline: **43 slots fora de tema** em 360 (11,9%) — `sangue` e `apelino` com
58% das criaturas no tema, `arcano` 63%, `robotico` 71%, `mare` 76%, `draconico`
96% e `furia`/`cacadores`/`alcateia` 100%. Depois das movimentações 1:1 (40
cartas por deck preservadas): **8 slots fora** — 3 na Legião Robótica (Turtol x2
e Fantom x1, limites do catálogo), 3 no Banquete de Apelino (as elites de facções
diferentes, decisão de design) e 2 na Maré Profunda (as duas únicas cartas
`planta` sobrevivem com uma cópia cada para manter a cobertura 110/110).

Números finais por preset (distintas / cópias por carta / criaturas / fora do
tema): `robotico` 18 / 2,22 / 24 / 3 · `furia` 32 / 1,25 / 25 / 0 · `draconico`
20 / 2,00 / 26 / 0 · `cacadores` 24 / 1,67 / 26 / 0 · `alcateia` 24 / 1,67 / 26 /
0 · `apelino` 31 / 1,29 / 25 / 3 · `mare` 30 / 1,33 / 25 / 2 · `arcano` 30 / 1,33
/ 24 / 0 · `sangue` 21 / 1,90 / 24 / 0. As descrições dos seis decks mexidos
acompanham a nova receita.

### F.1 Rebalanceamento após a reclassificação das traits — 2026-09-22

O autor reclassificou as traits no catálogo (Kirb virou `magico`, Gulosinho voltou
a `humanoide`, Salatiel virou dragão/voador, Latex virou `robotico`, o corpo duplo
entrou em K-023/Tlantidu/Turtol/Cacton, Hidra e Quimera ganharam `besta`,
Turtol Maximus ganhou `elite`, entre outras). Com os presets defasados, os slots
fora de tema voltaram a 6+ e a distribuição das criaturas deixou de acompanhar os
arquétipos. Movimentações aplicadas (troca 1:1, 40 cartas por deck):

| deck | o que entrou | o que saiu |
| --- | --- | --- |
| `robotico` | Latex x1 (8ª carta `robotico`: canino mecânico de custo 11) | Fantom x1 (voltou ao Círculo Arcano, tema `fantasma`) |
| `furia` | Dino Elétrico x1, Tiranossauro +1, Rei das Feras +1 (todos `besta`) | Kirb x2 (agora `magico`) e Gulosinho x1 (agora `humanoide`) |
| `draconico` | Salatiel x3 (dragão/voador que paga energia para ignorar DEF) | ETC -1 (foi para os Caçadores), Grifo Real -1 e Dino Elétrico -1 (foram para a matilha) |
| `cacadores` | ETC x2, Gulosinho x1, Little Big Shimbard +1 (todos `humanoide`/`guerreiro`) | Salatiel x2 (virou dragão), Zé Mulherzinha x1, Olho de Águia -1 |
| `alcateia` | Grifo Real x1, Quimera de Fogo +1, O Lica +1, Tobinha +1, Garras Afiadas +1 | Kirb x3, Gulosinho x1 e Latex x1 (reclassificados) |
| `apelino` | Beluga +1 (hospedeiro de ataque direto), Tiranossauro +1, Puma +1, Lorde +1 e Pena do Gigante (proteção do hospedeiro) | Gulosinho x1 (virou humanoide), Garras, Roller, Botas -1, Manoplas e Olho de Águia |
| `mare` | Turtol +1 (fecha o "duas de cada" aquática) | Kirb x1 (agora `magico`) |
| `arcano` | Kirb x2 (hospedeiro `magico` para Cajado/Tomo), Zé Mulherzinha x1 e Fantom +1 | Salatiel x1, ETC x1, Little Big Shimbard x1 |

Números finais (distintas / cópias por carta / criaturas / fora do tema):
`robotico` 19 / 2,11 / 24 / 0 · `furia` 31 / 1,29 / 25 / 0 · `draconico` 21 / 1,90
/ 26 / 0 · `cacadores` 24 / 1,67 / 28 / 0 · `alcateia` 22 / 1,82 / 26 / 0 ·
`apelino` 27 / 1,48 / 27 / 3 · `mare` 29 / 1,38 / 25 / 1 · `arcano` 28 / 1,43 /
24 / 0 · `sangue` 21 / 1,90 / 24 / 0 → **4 slots fora do tema** em 360 (1,1%),
todos estruturais. Cobertura 110/110, curva e teto de cópias preservados; a régua
executável é `node scripts/deck_synergy_audit.js --check`.

### F.2 Reboot da Legião Robótica: "máquinas e mecha-dragões" — 2026-09-22

A Legião era o pior deck em distribuição: 18 distintas com 2,22 cópias por carta,
x3 de tudo (inclusive do chefe de custo 12) e o Turtol como muralha fora do
tema — uma exceção estrutural que o usuário mandou eliminar ("o Turtol faz o que
ali?"). O eixo `magico` (Raylaser) foi rejeitado porque roubaria os hospedeiros
do Círculo Arcano; o `dragao` venceu: o Iron Dragon já é `dragao`/`robotico` (a
ponte perfeita), o Núcleo de Energia Pura equipa dragão/elite e o catálogo tem
dragões pouco usados em outros decks.

Receita nova (24 criaturas, 0 fora do tema, média 4,70):

| fica (robôs) | entra (dragões de outro decks) | sai |
| --- | --- | --- |
| Cp-2 x3, Raylaser x3, K-023 x3, Iron Dragon x3 | Dragão de Cobre x2 (uso 2) — escamas de cobre, 10 PV após derrotar | Turtol x2 (a muralha fora do tema; o Cp-2 x3 já segura) |
| Bilugatron x2, Gamaa x2, Latex x1 → **x2** | Dino Elétrico x2 (uso 2) — descarga de choque em área | Imperial X x3 → x2 (fim da pilha do chefe) |
| Imperial X x2 | Núcleo de Energia Pura x2 → x3 (hosts de dragão/elite: 6 → 11) e Bilugação Astral x1 (uso 2; par do Bilugatron) | Superior x1 (uso 2) — o autor preferiu dois Latex ao Superior —, Espada -1, Machado -1, Botas x1 (redundante com chefes que já atacam 2x) |

Números: 19 distintas / 2,11 cópias / 24 criaturas / **0 fora do tema** (era 2) /
média 4,68 (a Legião deixou de ser exceção estrutural do teste de tema).

O **Banquete de Apelino é, por decisão de design, o deck mais forte do catálogo**
(teto de dano com o Apelino equipado). O rebalanceamento **reforçou** a receita em
vez de diluí-la: o brutamontes de 50 de ataque voltou para x3, o ignorador de
defesa foi para x3, o vampiro elite que drena abate foi para x2 e o pacote de
proteção do hospedeiro ganhou Pena do Gigante (bloqueia um ataque mesmo de
criatura imune a habilidades) — tudo pago com as cartas de menor teto (Garras,
Roller, a segunda Botas da Rapidez, Manoplas de Gelo e Olho de Águia), mantendo a
média em 4,70 e os três corpos de 59/59 das elites de facções. Só o Gulosinho
saiu, porque a reclassificação dele para `humanoide` o tornaria um quarto slot
fora do tema (o teto do teste é 3).

O fallback `TRAITS_BY_DEFINITION` (`src/js/card-rules.js`) foi sincronizado com o
catálogo (7 cartas) e as fotos de trait dos testes (`inventário…`, listas de
humanoides, lista fechada de `elite`, herança da evolução) foram atualizadas.

O `card_089` Apelino Pão e Vinho é **única por deck** (o ataque ilimitado não
empilha): o teto vive em `DeckBuilder` (`LIMITES_DE_COPIA`, padrão 3 para as demais
cartas) e vale para presets, hotseat, PvP pela seed e o fallback local.

## Como reproduzir

```powershell
py -3 scripts/generate_trait_review_sheets.py   # reports/trait-review/folha_00..08.jpg (3x3, id+nome+traits)
py -3 scripts/analyze_card_art_features.py      # fila de triagem textual + CSV (paleta exige Pillow)
py -3 -m http.server 8080                       # pré-requisito da suíte de browser (raiz do projeto)
node tests/unit/run-tests.js                    # 258/258 (seções A, E, D, F e F.1)
node scripts/deck_synergy_audit.js --check      # régua do alinhamento deck × tema (sem browser)
node tests/browser/run-browser-tests.js         # 26/26 com o servidor no ar (aborta se a porta estiver morta)
py -3 tests/pvp/smoke_match.py                  # servidor + 2 clientes WS (sobe a própria porta)
```

`analyze_card_art_features.py` roda sem Pillow (avisa e omite as colunas de
paleta, que são descritivas e não geram sinal); com Pillow instalado ele mede a
paleta do painel. Os sinais vêm só do texto.

Cada folha traz 9 cartas com id, nome e traits impressos no topo do tile, então
a comparação é visual e direta. O analisador imprime a fila de triagem textual e
a calibração contra a amostra conferida à mão (inclusive o resultado negativo dos
sinais de cor). `reports/` está no `.gitignore` (artefato gerado, não é fonte de
verdade).

