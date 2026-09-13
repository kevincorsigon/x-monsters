> You are only seeing this prompt; there is no context outside it.

# Motor de Habilidades - Fase 4B2: Sabota Copos

## Objetivo e Definition of Done

Migrar `card_026` Sabota Copos como habilidade ativada uma vez por turno:
escolher uma criatura inimiga e aplicar -5 ATK/-5 DEF permanente naquela
instância enquanto ela permanecer em campo.

1. A ação só está disponível no turno/controlador da fonte, com a fonte no
   campo e durante invocação ou combate.
2. O painel manual lista Sabota Copos e somente criaturas inimigas legais.
3. Abrir/cancelar/errar a escolha não consome uso nem cria modificador.
4. Escolha válida aplica exatamente -5/-5 pelo engine e atualiza o DOM.
5. O limite `PER_TURN` bloqueia segunda ativação e libera no turno seguinte.
6. Testes e smoke browser passam sem usar os métodos legados de Sabota Copos.

## Anti-escopo

- Nenhuma outra habilidade ativada ou redesign do painel.
- Nenhuma dependência ou mudança no combate.
- Não apagar o código legado ainda.

## Orçamento

Quatro arquivos: `src/js/card-rules.js`, `src/js/manual_abilities.js`,
`src/js/card-abilities.js` e `tests/unit/run-tests.js`.

## Como Validar

1. `node tests/unit/run-tests.js`.
2. Checks de sintaxe e `git diff --check`.
3. Browser: selecionar alvo, ativar, conferir -5/-5 e bloqueio da segunda vez.