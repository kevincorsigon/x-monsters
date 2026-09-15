# Spec: Refatoração da Identidade Visual e Renderização de UI no game.html

## Objective
Modernizar a identidade visual de `game.html` para uma estética imersiva de jogo de cartas físico/digital (TCG playmat escuro, zonas táteis, acabamentos metálicos) e corrigir falhas de renderização, quebras de layout e estilos conflitantes nos botões e na exibição de cartas.

## Context
Atualmente, o jogo apresenta uma interface com elementos visuais simples (fundo em gradiente básico, áreas com cores sólidas e bordas duras, e estilos conflitantes entre classes CSS e atributos inline). 
A área central (`.phase-buttons`) e a seção de controle (`.control-section`) sofrem com problemas de renderização:
1. Conflito de estilos para `.phase-button` (uma definição circular com `clamp` e outra com cor sólida e bordas arredondadas simples em linhas subsequentes).
2. Botões de ação (`.action-button`) e botões de incremento (`.mini-button`) possuem dimensões e espaçamentos com atributos `style="..."` hardcoded no HTML que quebram o fluxo em resoluções menores ou quando o botão "Ataque Direto" é ativado.
3. As zonas de Deck e Descarte têm aspecto de botões planos de formulário em vez de áreas de cartas (Playmat / Card Zones).
4. O contraste entre os textos e os containers secundários é baixo, e em telas menores o encolhimento excessivo das cartas (até 45x60px) torna o texto e custo ilegíveis.

A refatoração preservará 100% da árvore de IDs e eventos necessários para o motor de jogo (`GameStateModel`, `GameEngine`, `CardRules` e manipulação DOM existente), ajustando a apresentação visual e a robustez do CSS.

## Definition of Done
- [ ] 1. **Zero regressão no motor e regras**: `node tests/unit/run-tests.js` continua passando 141/141 testes sem erros.
- [ ] 2. **Eliminação de CSS duplicado/conflitante**: A classe `.phase-button` e os botões de ação possuem uma única especificação CSS consolidada, eliminando regras redundantes e classes conflitantes em `game.html`.
- [ ] 3. **Remoção de estilos inline de layout/botões**: Todos os estilos inline de botões de controle (`.action-button`, `.mini-button`, `.peek-hand-btn`, `.phase-buttons`) no HTML são migrados para classes CSS sem uso de `style.cssText` arbitrário.
- [ ] 4. **Estética TCG (Playmat & Zonas)**: As áreas de Deck, Descarte, Campo e Mão utilizam estética temática coesa de TCG (slots com moldura demarcada, gradientes ricos/textura de mesa de batalha, verso de carta sugerido nas pilhas de deck).
- [ ] 5. **Robustez de renderização e responsividade**: A barra de fases e controle não quebra ou sobrepõe elementos com o botão "Ataque Direto" ativo, e as cartas mantêm tamanho mínimo legível (sem corte de custo/nome/stats) em resoluções a partir de 1024x600.
- [ ] 6. **Craftsmanship Gate**: Segue estritamente as convenções de `conventions.md` e o padrão `patterns/card-dom-rendering.md` (theming via `:root`, estados visuais via `classList`, preservação de IDs de elementos DOM).

## Scope
- Refatoração dos blocos `<style>` em `game.html` para:
  - Definir variáveis temáticas ricas em `:root` (paleta TCG inspirada em couro/feltro escuro, runas douradas, molduras acobreadas e bordas de slots).
  - Redesenhar `.game-container`, `.player-field`, `.player-hand`, `.player-deck`, `.player-discard` e `.phase-buttons` para simular uma arena/playmat autêntica de card game.
  - Consolidar e padronizar o visual de botões de fase, botões de ação e botões de incremento (+/- e dado).
  - Tratar a renderização dinâmica do botão `#direct-attack-btn` para não quebrar o layout da `.control-section`.
- Limpeza dos atributos `style="..."` cosméticos presentes nos elementos HTML em `game.html` (linhas 1845 a 1960).
- Ajustes de tipografia e badges de ATK/DEF e Custo nas cartas para evitar sobreposição ou ilegibilidade em redimensionamento.

## Anti-scope
- **Nenhuma alteração de lógica de regras**: não alterar `src/js/game-engine.js`, `src/js/card-rules.js` ou `src/js/game-state.js`.
- **Nenhum framework ou dependência externa**: proibido adicionar bibliotecas de UI, frameworks CSS (Tailwind, Bootstrap, etc.) ou bundlers.
- **Nenhum refatoramento estrutural do DnD**: manter a mecânica nativa de HTML5 Drag & Drop e eventos existentes intactos.
- **Nenhuma alteração em `index.html`**: a refatoração é exclusiva do cliente principal `game.html`.

## Technical Decisions
1. **Consolidação dos Botões de Fase em UI de Trilha (Track/Segmented Control)**:
   - *Decisão*: Substituir os círculos com textos quebrados por botões segmentados horizontais estilizados com relevo metálico e indicador de fase ativa iluminado (`gold glow`).
   - *Trade-off*: Abandona o formato de círculos que causava overflow em telas menores em favor de botões retangulares chanfrados que acomodam confortavelmente palavras como "Invocação" e "Combate".
2. **Layout TCG Playmat para Campos e Pilhas**:
   - *Decisão*: Adicionar slots com bordas tracejadas ou contornos sutis nos campos (`player-field`), e conferir visual volumétrico ao Deck e Descarte (simulando pilha de cartas empilhadas com cantos arredondados).
   - *Trade-off*: Pequeno incremento de CSS moderno (box-shadows em camadas e gradientes), mantendo alta performance de renderização no navegador.
3. **Limpeza de Estilos Inline no Grid**:
   - *Decisão*: Mover espaçamentos, tamanhos de fonte e cores inline do bloco HTML para classes utilitárias semânticas no CSS.
   - *Trade-off*: Torna o HTML mais limpo e manutenível, centralizando todo o controle visual no bloco `<style>`.

## Applicable Patterns
- `patterns/card-dom-rendering.md`:
  - Utilização estrita de `:root` para cores e dimensões.
  - Alternância de estados apenas via classes CSS (`.active`, `.can-attack`, `.field-active`, etc.).
  - Preservação da busca de instâncias via `document.getElementById(cardId)`.
- `patterns/game-state-management.md`:
  - Preservação de elementos vinculados à renderização de estatísticas (`pv-p1`, `energy-p1`, etc.) e funções de chamada global (`setPhase`, `endTurn`, `rollDice`).

## Risks
- **Risco**: Quebra de seletores JS caso algum seletor dependa de classes manipuladas no CSS.
  - *Mitigação*: Todos os IDs (`field-p1`, `hand-p1`, `pv-p1`, `energy-phase`, etc.) e classes funcionais (`card`, `can-attack`, `active`, etc.) permanecerão estritamente inalterados.
- **Risco**: Cartas no campo vazarem para fora em resoluções estreitas.
  - *Mitigação*: Manter `overflow-x: auto` e `scroll-behavior: smooth` com estilização de scrollbar temática e tamanho mínimo flexível (`min-width`) para cada carta no campo.

## References
- `game.html` — Arquivo principal de UI e renderização DOM a ser refatorado.
- `tests/unit/run-tests.js` — Suíte de testes para validação de regressão do motor.
