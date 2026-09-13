> You are only seeing this prompt; there is no context outside it.

# Motor de Habilidades - Fase 4A: Invocação Simples

## Objetivo e Definition of Done

Migrar as primeiras quatro habilidades de invocação para regras puras
registradas no engine:

- `card_012` Natalino: ao ser invocado, cura 10 de dano das outras criaturas
  aliadas, sem ultrapassar a DEF efetiva.
- `card_013` Zol: ao ser invocado, compra a carta do topo do próprio deck.
- `card_023` Raylaser: ao ser invocado, causa 15 ao PV adversário.
- `card_079` Lobo Beta Lightning: ao ser invocado, causa 20 ao PV adversário.

Definition of Done:

1. As quatro definições possuem registro único ligado a `CREATURE_SUMMONED`.
2. Efeitos usam somente descritores do engine e participam do rollback da ação
   de invocação.
3. Natalino cura somente outras criaturas aliadas e nunca deixa `damage < 0`.
4. Zol move a mesma instância deck -> mão sem duplicação e não falha com deck
   vazio.
5. Raylaser e Lobo Beta alteram PV canônico e a UI reprojeta stats/mãos após a
   invocação; os handlers legados não repetem os efeitos.
6. Testes automatizados cobrem as quatro cartas, condição negativa, rollback e
   ausência de duplicação; suíte completa e smoke browser passam.

## Anti-escopo

- Não migrar outras cartas ou habilidades passivas.
- Não alterar combate, catálogo, traits, balanceamento ou texto das cartas.
- Não criar UI genérica de seleção; estas quatro habilidades não escolhem alvo.
- Não remover métodos legados ainda usados por cartas não migradas.
- Não adicionar dependências.

## Orçamento

No máximo quatro arquivos de implementação:

- criar `src/js/card-rules.js`;
- modificar `src/js/card-abilities.js`;
- modificar `game.html`;
- modificar `tests/unit/run-tests.js`.

## Padrões a Seguir

- Regras são puras, sem DOM, alertas ou timers.
- O registro usa `definitionId`, nunca nome ou texto da habilidade.
- O evento fornece `cardId/playerId`; o estado localiza aliados, deck e PV.
- Cada carta tem um único owner de resolução: engine para IDs migrados, legado
  para os demais.
- Feedback visual ocorre somente depois do commit.
- APIs devem funcionar em browser e CommonJS.

## Como Validar

1. `node tests/unit/run-tests.js`.
2. `node --check src/js/card-rules.js` e demais módulos tocados.
3. Browser: invocar cada carta em fixture controlada e comparar estado/DOM.
4. `git diff --check`.

## Documentação

Salvar auditoria em
`.vibeflow/audits/motor-habilidades-fase-4a-invocacao-audit.md`.