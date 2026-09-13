> You are only seeing this prompt; there is no context outside it.

# Motor de Habilidades - Fase 5C2: Dano Multi-alvo

## Objetivo e Definition of Done

Migrar `051` e `057`:

- Dino Elétrico: 1x/turno, sem seleção, 10 de dano de habilidade simultâneo a
  todas as criaturas inimigas.
- Quimera de Fogo: 1x/turno, escolher de 1 a 3 inimigos distintos, 5 de dano
  de habilidade simultâneo em cada alvo.

1. Dano em lote usa snapshots, move letais/attachments canonicamente e reverte
   integralmente em falha tardia.
2. Dino não atinge aliados e funciona sem alvo explícito.
3. Quimera rejeita duplicatas, zero e quarto alvo sem consumir uso.
4. Painel manual suporta ação sem alvo e seleção múltipla mínima para o lote.
5. Estado/DOM/descarte/limite por turno e testes passam.

## Anti-escopo

- Nenhuma outra área, imunidade ou redesign amplo.
- Nenhuma dependência.

## Orçamento

Quatro arquivos: `src/js/game-engine.js`, `src/js/card-rules.js`,
`src/js/manual_abilities.js`, `tests/unit/run-tests.js`.

## Como Validar

`node tests/unit/run-tests.js`, sintaxe/diff e smoke browser.