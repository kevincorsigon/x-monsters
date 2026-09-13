# Audit Report: Motor de Habilidades - Fase 3: Combate Canônico

**Verdict: PASS**

Dependências Fases 1 e 2: **PASS**. A implementação cumpre os sete itens do
DoD e permanece dentro do orçamento de quatro arquivos.

## DoD Checklist

- [x] Ataques validam fase, controlador, zona, tipo, adversário, alvo e
  orçamento antes da transação; rejeições não causam dano nem consomem uso.
- [x] Combate usa ATK/DEF efetivos, acumula `card.damage`, preserva stats base
  e aplica dano físico mútuo sem cálculo paralelo na página.
- [x] As oito janelas canônicas são emitidas em ordem e aceitam modificações e
  prevenção por descritores reversíveis.
- [x] Mortes simples/simultâneas movem criaturas e attachments aos descartes
  dos owners, preservando snapshots de owner/controller anteriores à saída.
- [x] Penetração e ataque direto alteram PV canônico e participam do rollback.
- [x] Orçamento é contado por instância/turno, aceita limite derivado e decide
  seleção e highlights no lugar de `attackedThisTurn`.
- [x] `node tests/unit/run-tests.js` passa com 27/27 testes.

## Correções da Primeira Auditoria

- `CREATURE_WOULD_DIE` inclui `ownerId/controllerId` pré-movimento.
- `CREATURE_DEFEATED` inclui `defeatedOwnerId/defeatedControllerId`.
- Wrappers legados de combate são estritamente observacionais.
- Ataque direto também notifica `onCombatResolved` após o commit.
- Stats canônicos são reprojetados após `onCardEquipped`, impedindo soma
  exclusivamente visual.
- Regressão com owner `p1` e controller `p2` confirma descarte e snapshots.

## Evidência Browser

- Ataque 15/10 contra 8/12: atacante ficou com 2 DEF; alvo foi descartado;
  houve 3 de penetração e PV estado/DOM terminou em 197.
- Após animação, o alvo saiu do DOM, o descarte marcou uma carta e a instância
  permaneceu em exatamente uma zona.
- Ataque direto de 11 reduziu PV 197 -> 186; segunda tentativa foi bloqueada.
- Bufaboi 10/20 com Espada Mágica manteve base 10/20, estado efetivo 20/25,
  DOM 20/25 e causou 20 de dano; `oneShotEffects` legado permaneceu vazio.
- Nenhum `pageerror`; fila de eventos vazia após cada resolução.

## Pattern Compliance

- [x] Estado canônico é a fonte de verdade para zonas, stats, dano e uso.
- [x] Engine não acessa DOM, timers, alerts ou handlers legados.
- [x] Movimentos, dano, consumo e eventos possuem undo transacional.
- [x] DOM é atualizado somente após resultado confirmado.
- [x] Compatibilidade browser/CommonJS preservada.
- [x] Nenhuma habilidade individual ou dependência foi adicionada.

## Critical Gate

Clean - nenhuma operação destrutiva ou regressão de segurança detectada.

## Testes

- `node tests/unit/run-tests.js` - PASS, 27/27.
- `node --check src/js/game-engine.js` - PASS.
- `node --check src/js/card-abilities.js` - PASS.
- JavaScript inline de `game.html` - PASS.
- Diagnósticos VS Code - nenhum erro.
- `git diff --check` - PASS.
- Smoke tests no browser - PASS.

## Orçamento

4/4 arquivos de implementação:

- `src/js/game-engine.js`
- `game.html`
- `src/js/card-abilities.js`
- `tests/unit/run-tests.js`

Prompt pack e audit são artefatos do workflow e não integram o orçamento.

## Resultado

Fase 3 aprovada e pronta para os lotes de migração de cartas.