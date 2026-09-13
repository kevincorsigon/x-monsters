> You are only seeing this prompt; there is no context outside it.

# Motor de Habilidades - Fase 4D: Condições de Campo

## Objetivo e Definition of Done

Migrar condições dinâmicas de `024`, `033`, `037`, `040`, `043`, `058`, `059`,
`060`, `068`, `075`, `077` e `098`.

1. Modificadores são derivados do campo atual, sem snapshots acumulativos.
2. 024 ganha +5/+5 por inimigo somente quando é a única criatura aliada.
3. 040 dobra DEF quando sozinho; 043 dobra ATK com outro aliado custo <3;
   068 ganha +10 DEF quando sozinho; 075 ganha +10 DEF se oponente tem uma
   criatura; 077 ganha +5 ATK por criatura inimiga.
4. 058 não pode ser alvo por custo <=4 quando sozinho; 059 não pode ser alvo
   quando o atacante controla só uma criatura; 060 força alvo enquanto houver
   outro aliado.
5. 033 concede +5 ATK a todos os robôs aliados quando houver ao menos dois;
   037 ganha +10/+10 com qualquer dragão em campo; 098 concede +5/+5 aos robôs
   aliados elegíveis enquanto equipado em robô e houver outro robô aliado.
6. Entradas/saídas de campo atualizam estado efetivo e DOM sem aplicar/remover
   bônus manualmente.
7. Testes e browser cobrem ativação, desativação e recomposição das condições.

## Anti-escopo

- Não inferir traits por substring em runtime; usar o mapa explícito aprovado.
- Nenhuma habilidade ativada, combate avançado ou dependência.

## Orçamento

Quatro arquivos: `src/js/game-engine.js`, `src/js/card-rules.js`, `game.html`
e `tests/unit/run-tests.js`.

## Como Validar

1. `node tests/unit/run-tests.js`.
2. Checks de sintaxe/diff.
3. Browser: alterar composição dos dois campos e conferir stats/alvos no DOM.