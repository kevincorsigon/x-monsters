# Spec: Reorganização de Estrutura — Parte 1: Imagens das Cartas e Dados do Jogo

## Objetivo
Mover as imagens das cartas para `assets/cards/` e o `cards_database.json` para
`data/cards_database.json`, sem quebrar o carregamento do jogo em `game.html`.

## Contexto
Hoje `cards/*.png` (110+ imagens) e `cards_database.json` ficam na raiz do
repositório, junto com todo o resto (scripts Python, HTML, JS, áudio). Isso
não é um padrão de mercado para um projeto web: assets e dados deveriam estar
isolados do código. `deck_system.js` faz `fetch('cards_database.json')` e usa
o campo `image` (ex.: `"cards/espada_mágica.png"`) diretamente como `src` de
`<img>` em `game.html` (ver
[patterns/deck-loading-and-card-data.md](../patterns/deck-loading-and-card-data.md)
e [patterns/card-dom-rendering.md](../patterns/card-dom-rendering.md)). Toda
essa cadeia de caminhos relativos precisa ser atualizada de forma consistente.

**Suposição (TODO confirmar):** por "imagens numa pasta certa" entendo
`assets/cards/`, e por "cartas" entendo o arquivo de dados
`cards_database.json` (não as imagens, que já são cobertas por "imagens"). Os
scripts Python ficam nas Partes 2–4 desta mesma iniciativa. Os arquivos JS do
jogo (`game.html`, `card-abilities.js`, `deck_system.js`,
`test_*.js`/`.html`) **não** são movidos nesta iniciativa — apenas os
caminhos que eles referenciam mudam. Isso reduz o raio de quebra durante o
"sem parar de funcionar".

## Definição de Pronto (DoD)
1. `cards/` não existe mais na raiz; todas as imagens estão em
   `assets/cards/` (mesmos nomes de arquivo, sem perdas).
2. `cards_database.json` não existe mais na raiz; está em
   `data/cards_database.json`, com todos os 110+ campos `image` atualizados
   para `assets/cards/<arquivo>.png`.
3. `deck_system.js`: `fetch('cards_database.json')` aponta para
   `data/cards_database.json`, e os caminhos de imagem em
   `getFallbackCardData()` apontam para `assets/cards/...`.
4. Teste manual documentado: servir a pasta via um servidor local (ex.
   `python -m http.server`), abrir `game.html`, iniciar uma partida e
   confirmar no DevTools → Network que nenhuma imagem de carta retorna 404.
5. Nenhuma alteração em `game.html`, `card-abilities.js`,
   `test_abilities.html` ou `test_fix.html` além do necessário — nenhum
   desses arquivos referencia `cards/` ou `cards_database.json` diretamente
   hoje, então nenhum deles deve ser tocado nesta parte (gate de
   artesanato: menor mudança possível).
6. `embedded_cards.js` não é alterado nesta parte — é código morto (não
   referenciado por nenhum `<script src>`), já registrado em
   `.vibeflow/index.md` → Known Issues; corrigi-lo aqui seria escopo extra
   sem benefício funcional.

## Escopo
- Mover a pasta `cards/` → `assets/cards/`.
- Mover `cards_database.json` → `data/cards_database.json`.
- Atualizar os 110+ campos `image` dentro do JSON movido.
- Atualizar `deck_system.js`: caminho do `fetch` e os caminhos de imagem do
  dataset de fallback (`getFallbackCardData`).

## Fora de Escopo
- Mover ou reorganizar `game.html`, `index.html`, `card-abilities.js`,
  `test_*.js`, `test_*.html`, arquivos de áudio (`*.mp3`) — nenhum destes foi
  pedido e nenhum referencia `cards/`/`cards_database.json` hoje.
- Corrigir ou apagar `embedded_cards.js` (dead code) — é uma limpeza
  independente, não uma consequência funcional desta mudança.
- Atualizar textos de documentação (`README.md`, `README_NEW.md`,
  `GUIA_IMPRESSAO*.md`) que citam `/cards/` — não afeta o funcionamento,
  fica para uma tarefa de documentação à parte.
- Mover os scripts Python — cobertos nas Partes 2, 3 e 4 (dependem desta).

## Decisões Técnicas
- **`assets/cards/` em vez de `images/cards/`**: mantém o nome `cards`
  (já usado em toda a base) como subpasta de um `assets/` genérico, evitando
  renomear referências ao conceito de "carta" em outros lugares do código.
- **`data/` para o JSON**: separa dado (conteúdo do jogo) de assets binários
  e de código, é o padrão mais comum em projetos client-only sem backend.
- **Não usar caminho absoluto nem variável de configuração**: os caminhos
  seguem relativos à raiz do site, igual ao padrão já usado
  (`fetch('cards_database.json')` → `fetch('data/cards_database.json')`),
  sem introduzir nenhuma camada de configuração nova (ex.: `config.js`) —
  seria escopo além do pedido.

## Padrões Aplicáveis
- [patterns/deck-loading-and-card-data.md](../patterns/deck-loading-and-card-data.md)
  — schema do card e o par fetch/fallback devem continuar seguindo este
  padrão; apenas os valores de caminho mudam.
- [patterns/card-dom-rendering.md](../patterns/card-dom-rendering.md) — a
  imagem continua sendo injetada como `<img src="${cardData.image}">` sem
  mudança de lógica, só o valor do campo `image` muda.

## Riscos
- **Abrir `game.html` via `file://` já falha hoje** (fetch bloqueado por
  CORS) e cai no fallback — isso é um problema pré-existente
  (`.vibeflow/index.md` → Known Issues), não introduzido por esta mudança,
  mas fica mais visível: o teste manual do DoD exige servir via HTTP local.
  Mitigação: documentar isso no teste manual, não tentar corrigi-lo aqui.
- **Uma imagem esquecida na atualização do JSON** quebra silenciosamente
  aquela carta específica (ícone genérico no lugar). Mitigação: gerar o
  novo JSON via substituição mecânica de string (`cards/` → `assets/cards/`)
  em todo o array, não edição manual campo a campo.
- **Nomes de arquivo com acentuação** (`espada_mágica.png`,
  `zé_mulherzinha.png`) podem se comportar diferente em sistemas de arquivo
  case/accent-sensitive ao mover pastas. Mitigação: mover a pasta inteira de
  uma vez (não recriar arquivo por arquivo) e comparar a contagem de
  arquivos antes/depois.

## Dependências
_Nenhuma — esta é a primeira parte da iniciativa._
