# 📊 Progresso do Sistema de Habilidades - X Monsters

> Este documento foi reescrito após a Fase 7 (remoção do legado). O conteúdo
> anterior descrevia o sistema switch-case de `card-abilities.js`, que foi
> removido: todas as 110 cartas do catálogo são resolvidas pelo motor
> determinístico (`src/js/game-engine.js` + `src/js/card-rules.js`).

## Status atual

- **110/110 cartas do catálogo** registradas no motor (`CardRules.SUMMON_RULES`
  / `EQUIPMENT_RULES` / `ACTIVATED_RULES` ou handlers de evento em
  `CardRules.install()`).
- **141/141 testes** passando via `node tests/unit/run-tests.js` (cobertura
  comportamental, não apenas presença de registro).
- `src/js/card-abilities.js` é hoje só uma ponte fina entre `game.html` e o
  motor: encaminha `onCardSummoned`/`onCardEquipped` para o feedback já
  calculado por `CardRules`, sem nenhuma lógica de jogo própria.
- `src/js/manual_abilities.js` renderiza o painel de habilidades ativadas
  inteiramente a partir de `CardRules.getActivatedRule()` — não há mais
  entradas hardcoded por carta.
- Scripts de diagnóstico (`tests/browser/*.js`) foram removidos da página de
  produção (`game.html`); os arquivos continuam disponíveis para uso manual
  via console durante desenvolvimento.

## Onde ver o progresso real

- Migração por fase: `.vibeflow/specs/motor-habilidades-eventos-e-efeitos.md`.
- Decisões de modelagem por carta: `.vibeflow/decisions.md`.
- Cobertura de testes: `tests/unit/run-tests.js` (rodar com
  `node tests/unit/run-tests.js`).

Ver também [RELATORIO_FINAL_HABILIDADES.md](RELATORIO_FINAL_HABILIDADES.md)
para o histórico da migração.
