# Audit Report: Ajustes de Mecânicas de Campo, Dado, Energia e Nome do Jogador

**Data:** 2026-09-16
**Spec:** `.vibeflow/specs/ajustes-mecanicas-campo-dado-energia-nome.md`

---

## Verdict: PASS

---

### Testes

```
node tests/unit/run-tests.js
144/144 testes passaram.
```

Incluindo 2 novos testes adicionados nesta implementação:
- `GameStateModel persiste nome do jogador via setPlayerName`
- `Trox: modificador de custo zero é consumido após reinvocação`

---

### DoD Checklist

- [x] **1. Equipamento negado retorna à mão** — `dropCard` (game.html:3536) bloqueia drop de suporte no campo vazio via `return` sem mover o elemento; `handleEquipmentDrop` (game.html:4052-4054) retorna cedo se `validateEquipmentTarget` falha; `equipSupportCard` (game.html:4175-4177) retorna cedo se engine rejeitar. Em todos os casos o elemento DOM permanece na mão (DnD nativo não move sem `appendChild` explícito).

- [x] **2. Retorno à mão sincronizado + custo zero** — `manual_abilities.js` (linhas 200-201) já chamava `renderFieldsFromState()` e `renderHandsFromState()` após cada ativação. Modificador `free_resummon` do Trox corrigido: agora usa `DURATION_KINDS.UNTIL_NEXT_MATCHING_EVENT` com `predicate` que expira ao receber `CREATURE_SUMMONED` para a mesma instância (`card-rules.js:943-953`). Teste confirma custo = 0 antes da reinvocação e ≠ 0 depois.

- [x] **3. Efeitos de descarte limpam campo** — `renderFieldsFromState` (game.html:3166) remove qualquer `.card` cujo `id` não esteja em `gameState.cards[player].field`; `manual_abilities.js` chama ambas as funções de sync e `updateDiscardCount` após cada ativação (linhas 200-202).

- [x] **4. Evolução descarta base + equipamentos DOM** — `dropCard` (game.html:3563-3579) coleta `evolutionBaseInstanceId` e `evolutionBaseAttachmentIds` antes de `resolveAction`; o engine move base e equipamentos para `discard` via `MOVE_CARD` effects (linhas 3596-3607); `renderFieldsFromState()` + `renderHandsFromState()` chamados após `summonResult.status === 'resolved'` (linhas 3663-3664) removem os órfãos do DOM.

- [x] **5. Dado animado + sincronizado** — `rollDice` (game.html:2317) adiciona `dice-animation` CSS class; usa `changeStat` que chama `changePlayerStat` (escreve em `gameState`); `showMessage` substitui `alert()` bloqueante; div flutuante com `+N` visível 1500ms; `endTurn` restaura energia via `setPlayerStat` (linhas 2459-2466) sem acumular bônus do dado.

- [x] **6. Automação de energia e remoção de botões +/-** — HTML dos stats de p1 (linhas 2053-2059) e p2 (linhas 2004-2010): apenas `dice-button`, sem `+`/`-` de energia. `endTurn` incrementa `maxEnergy` e restaura energia automaticamente (linhas 2453-2466).

- [x] **7. Nome no estado + zero regressão** — `editName` (game.html:2268) chama `setPlayerName`; `updateUI` (game.html:2556) usa `getPlayerName(gameState, gameState.currentPlayer)` em vez de string hardcoded; `endTurn` (game.html:2451) usa `getPlayerName` para notificações. 144/144 testes passam.

---

### Pattern Compliance

- [x] **game-state-management** — `updateUI` lê nome via `GameStateModel.getPlayerName`; `endTurn` lê nome do estado; nenhum nome hardcoded no DOM path de render. `setPlayerName` chamada em `editName` antes de qualquer DOM update.

- [x] **event-effect-engine** — Modificador Trox usa `UNTIL_NEXT_MATCHING_EVENT` com `predicate` function, padrão canônico do engine para expirar por evento específico. Sem efeitos colaterais fora da transação.

- [x] **card-dom-rendering** — Sync via `renderFieldsFromState` / `renderHandsFromState`. Estado visual por classes CSS, não inline styles. Custo efetivo lido via `getEffectiveCardCost` (usa modifiers do engine).

- [x] **automated-unit-tests** — Novos testes usam `node:assert/strict`, sem framework, seguem padrão `test(name, callback)` existente. Fixtures reutilizadas (`addFieldCreature`, `emitSummoned`).

---

### Convention Violations

Nenhuma.

---

### Budget

**Arquivos modificados: 3 / ≤ 5 (budget do spec)**
- `src/js/card-rules.js` — Trox modifier duration
- `game.html` — `updateUI` player name
- `tests/unit/run-tests.js` — 2 novos testes

---

### Anti-scope Confirmado

- `data/cards_database.json` — não tocado
- Botões de PV — não removidos
- Dependências npm — não adicionadas

---

### Overall: PASS

Implementação pronta para ship. Todos os 7 DoD checks verificados com evidência no código. Testes: 144/144.
