# Audit Report: Motor de Habilidades - Fase 2: Ações, Eventos e Efeitos

**Verdict: PASS**

Dependência Fase 1: **PASS**. A implementação cumpre os sete itens do DoD e
permanece dentro do orçamento de quatro arquivos.

## DoD Checklist

- [x] `resolveAction` valida turno, fase, fonte, controle, zona, custo, limite,
  validators, escolha e descritores antes do pagamento. Falhas transacionais
  restauram custo, zona, índice, efeitos, uso, fila e log.
- [x] Handlers são ordenados por prioridade e ordem de registro; eventos
  aninhados seguem FIFO, payloads são congelados e loops são interrompidos.
- [x] Escolhas headless pausam sem custo; seleção inválida e cancelamento não
  alteram estado; seleção válida retoma a mesma ação.
- [x] Stats efetivos seguem `SET`, soma e multiplicação. As sete durações são
  suportadas e o cleanup remove apenas efeitos correspondentes.
- [x] Limites `PER_TURN` e `PER_MATCH` são consultáveis e consumidos somente
  após resolução bem-sucedida.
- [x] Invocação, equipamento, fases e turnos usam o engine; o adaptador legado
  recebe a instância sem migrar habilidades específicas.
- [x] `node tests/unit/run-tests.js` passa com 18/18 testes.

## Correções da Primeira Auditoria

- Rollback de movimento volta a carta ao índice original da zona.
- Referências inválidas são rejeitadas antes do pagamento.
- `UNTIL_NEXT_MATCHING_EVENT` executa `predicate` quando fornecido.
- Movimento para fora de `field` emite `SOURCE_LEFT_FIELD` automaticamente.
- Eventos `ENDING` são drenados antes da mudança de estado; eventos `STARTED`
  observam o estado novo.
- Os quatro probes foram transformados em testes de regressão.

## Evidência de Integração

- Engine e adaptador carregados sem `pageerror` ou erro de console.
- Invocação real: `card_029` pagou 4 de energia, moveu mão -> campo e atualizou
  o DOM, emitindo `CARD_MOVED`, `CARD_PLAYED` e `CREATURE_SUMMONED`.
- Equipamento real: custo e movimento foram resolvidos uma única vez; zona,
  `attachedTo` e `attachments` ficaram consistentes.
- Observadores viram `PHASE_ENDING`/`TURN_ENDING` em `p1/invocation` e
  `TURN_STARTED` em `p2/energy`.
- Fim de turno resultou em jogador `p2`, turno 2, fase `invocation`, energia
  igual no estado e no DOM e fila de eventos vazia.

## Pattern Compliance

- [x] Um único `gameState`; nenhuma cópia paralela de stats ou zonas.
- [x] APIs browser/CommonJS preservadas.
- [x] Transações usam apenas descritores com operações inversas conhecidas.
- [x] O engine não acessa DOM, `alert`, `prompt` ou timers.
- [x] Nenhuma habilidade individual, regra de combate ou catálogo foi alterado.
- [x] Nenhuma dependência foi adicionada.

## Critical Gate

Clean - nenhuma operação destrutiva ou regressão de segurança detectada.

## Testes

- `node tests/unit/run-tests.js` - PASS, 18/18.
- `node --check src/js/game-engine.js` - PASS.
- `node --check src/js/card-abilities.js` - PASS.
- JavaScript inline de `game.html` - PASS.
- Diagnósticos do VS Code - nenhum erro.
- `git diff --check` - PASS.
- Smoke test no browser - PASS.
- `py -3 scripts/check_cards.py` - código zero; 107/110 é uma métrica textual
  legada e não mede a cobertura funcional desta fase.

## Orçamento

4/4 arquivos de implementação:

- `src/js/game-engine.js`
- `game.html`
- `src/js/card-abilities.js`
- `tests/unit/run-tests.js`

Prompt pack e audit são artefatos do workflow e não integram o orçamento.

## Resultado

Fase 2 aprovada e pronta para servir de dependência da Fase 3.