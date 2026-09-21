# Spec: Layout sem Scroll — Tela Cheia com Mínimo Definido

## Objective
Eliminar o scroll vertical e horizontal desnecessário no `game.html`, garantindo que o tabuleiro ocupe exatamente `100dvh × 100dvw` sem transbordar, mesmo em monitores ultrawide (ex.: 3440×1440), mantendo um tamanho mínimo de tela legível.

## Context
Após a refatoração visual anterior, o jogo ainda apresenta scroll indesejado em monitores grandes:
- `body { overflow: visible }` permite que qualquer overflow crie scroll de janela.
- O container `.game-container` tem `height: 100vh` mas o **conteúdo interno transborda**: as áreas `#hand-p1` / `#hand-p2` têm `min-height: 120px` + `padding: 20px 10px` fixos que empurram a linha além do que o grid atribuiu.
- As cartas usam `height: clamp(100px, 12vw, 220px)`. Em ultrawide (3440px de largura) `12vw` = **413px** — muito maior que o espaço da linha; as cartas em arco com `scale(2.2) translateY(-60px)` no hover também transbordam o grid para fora dos limites da janela.
- O grid usa `minmax(120px, 1fr)` nas linhas de mão, mas o conteúdo interno não respeita o limite superior `1fr`.

## Definition of Done
- [ ] 1. **Zero regressão**: `node tests/unit/run-tests.js` continua 141/141.
- [ ] 2. **Sem scroll de janela**: `body` e `html` têm `overflow: hidden`; verificado inspecionando que `document.body.scrollHeight === window.innerHeight` ao carregar.
- [ ] 3. **Tela cheia proporcional**: o `.game-container` ocupa exatamente `100dvh` de altura e `100dvw` de largura sem transbordar em resoluções entre 1024×600 e 3440×1440.
- [ ] 4. **Cartas dimensionadas proporcionalmente à linha do grid**: largura e altura das `.card` usam apenas valores `clamp` baseados em `vh`, não `vw`, para não explodir em ultrawide.
- [ ] 5. **Overflow de hover contido**: efeitos de hover (arco, `scale`, `translateY`) das cartas na mão são visuais (via `overflow: visible` *apenas na zone da mão*) mas não forçam scroll da janela.
- [ ] 6. **Craftsmanship Gate**: Segue `conventions.md` e `patterns/card-dom-rendering.md`. Nenhum ID ou classe funcional alterada.

## Scope
- `game.html` — bloco `<style>` apenas:
  - `html` e `body`: `overflow: hidden`, `height: 100%`, `width: 100%`.
  - `.game-container`: trocar `height: 100vh` por `height: 100dvh` e garantir `max-height: 100dvh; overflow: hidden`.
  - `#hand-p1`, `#hand-p2`: remover `min-height: 120px` fixo; substituir por `min-height: 0` para que o grid controle a altura.
  - `padding` dos containers `.player2-hand #hand-p2, .player1-hand #hand-p1`: reduzir de `20px 10px` para `clamp(4px, 1vh, 12px)`.
  - `.card`: trocar `height: clamp(100px, 12vw, 220px)` por `height: clamp(80px, 11vh, 200px)` e largura correspondente baseada em `vh`.
  - `.card:hover` nas mãos: reduzir `translateY(-60px)` para `clamp(-30px, -4vh, -60px)` e `scale(2.2)` para `scale(1.8)` para conter o overflow visual.
  - `.player2-hand, .player1-hand`: adicionar `overflow: hidden` para reter cards; somente `#hand-p2` e `#hand-p1` internos mantêm `overflow: visible` para o efeito de arco.
  - Corrigir `grid-template-rows` para distribuir melhor o espaço: linha de fase menor (`minmax(50px, 0.5fr)`) e linhas de campo maiores.

## Anti-scope
- Não alterar nenhum `.js` (motor, regras, estado).
- Não alterar `index.html`.
- Não alterar IDs nem eventos DOM (`field-p1`, `hand-p1`, `pv-p1`, etc.).
- Não alterar a estrutura HTML do `<body>` — somente o bloco `<style>`.
- Não remover o efeito visual de arco das cartas na mão.

## Technical Decisions
1. **`dvh` em vez de `vh`**: `100dvh` exclui a barra de endereço do navegador em mobile/fullscreen; em desktop é idêntico a `vh`. Mitiga inconsistências cross-browser sem custo.
2. **Dimensão de carta baseada em `vh`**: a altura da tela (`dvh`) é o eixo limitante em ultrawide, não a largura. `clamp(80px, 11vh, 200px)` escala com a altura disponível.
3. **`overflow: hidden` no body e grid**: a estratégia mais simples e robusta; os efeitos de hover que precisam de overflow usam `z-index` alto e `overflow: visible` somente no container interno do arco (`#hand-p1`, `#hand-p2`), não propagando para a janela.

## Applicable Patterns
- `patterns/card-dom-rendering.md`:
  - Todas as dimensões e cores em variáveis `:root` ou `clamp`.
  - Estados visuais só por `classList`, nenhuma alteração aqui.
- `patterns/game-state-management.md`:
  - Nenhum getter/setter de stats afetado.

## Risks
- **Risco**: Cartas em campo ficarem muito pequenas em resoluções baixas (1024×600).
  - *Mitigação*: O `clamp(80px, 11vh, 200px)` garante mínimo de 80px mesmo a 600px de altura (resultado: ~66px — reajustar mínimo para `85px` se necessário após teste visual).
- **Risco**: O efeito de arco/hover das cartas cortar na borda superior/inferior da área de mão.
  - *Mitigação*: As áreas `.player1-hand` / `.player2-hand` receberão `overflow: visible` e `z-index` elevado para sobrepor os campos vizinhos; o scroll da *janela* continua contido por `body { overflow: hidden }`.

## References
- `game.html` — arquivo alvo.
- `tests/unit/run-tests.js` — suíte de regressão.
