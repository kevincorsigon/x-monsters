# Relatório: `traits` do catálogo × arte das cartas

Escopo: cruzar o campo `traits` de `data/cards_database.json` (79 criaturas +
evoluções com traits, de 110 cartas) contra a arte impressa em
`assets/cards/*.png`.

Status: **suíte verde (215/215 unit, 20/20 browser)** com as **sugestões
aplicadas** (seções A e E). A conferência **visual** continua parcial: 19 cartas
foram inspecionadas por olhos humanos e o modelo desta sessão não aceita entrada
de imagem (`Current model does not support image input`), então as 60 restantes
ficam na fila da seção D — com a fila de triagem já priorizada pela seção C.

## Critério usado (fonte: `.vibeflow/decisions.md`, 2026-09-21)

1. `humanoide` = bípede + **corpo de humano** + capaz de empunhar arma. Corpo
   não humano (`dragao`, `robotico`, `aquatico`, `planta`, `fantasma`) nunca é
   `humanoide`.
2. Ofício humano (`guerreiro`, `paladino`, `vampiro`) implica `humanoide`.
   **`lobisomem` não implica**: lobos são caninos; só licantropos de corpo
   humano (`card_059`, `card_077`, `card_085`) são `humanoide`.
3. `elite` é derivável: criatura com ATK > 50.
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

## D. Pendente de conferência visual (60 cartas)

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

## E. Sugestões — APLICADAS (215/215)

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

## Como reproduzir

```powershell
py -3 scripts/generate_trait_review_sheets.py   # reports/trait-review/folha_00..08.jpg (3x3, id+nome+traits)
py -3 scripts/analyze_card_art_features.py      # reports/trait-review/art_features.csv + fila de triagem + calibração
py -3 -m http.server 8080                       # pré-requisito da suíte de browser (raiz do projeto)
node tests/unit/run-tests.js                    # 215/215 após as seções A e E
node tests/browser/run-browser-tests.js         # 20/20 com o servidor no ar (aborta se a porta estiver morta)
py -3 tests/pvp/smoke_match.py                  # servidor + 2 clientes WS (sobe a própria porta)
```

Cada folha traz 9 cartas com id, nome e traits impressos no topo do tile, então
a comparação é visual e direta. O analisador imprime a fila de triagem textual e
a calibração contra a amostra conferida à mão (inclusive o resultado negativo dos
sinais de cor). `reports/` está no `.gitignore` (artefato gerado, não é fonte de
verdade).

