# Audit Report: Motor de Habilidades - Fase 5D2 (Prevenção e Bypass Defensivo)

**Verdict: PASS**

Contrato: [.vibeflow/prompt-packs/motor-habilidades-fase-5d2-prevencao-bypass.md](../prompt-packs/motor-habilidades-fase-5d2-prevencao-bypass.md)
Arquivos do lote: [src/js/game-engine.js](../../src/js/game-engine.js), [src/js/card-rules.js](../../src/js/card-rules.js), [src/js/manual_abilities.js](../../src/js/manual_abilities.js), [tests/unit/run-tests.js](../../tests/unit/run-tests.js).

Reauditoria somente leitura, escopo estrito: fechar o único gap do ciclo
anterior (FAIL) — 5 asserts negativos ausentes no teste "Olho de Águia
ignora somente Evasão e Intocável, não outras restrições", cobrindo
`card_018` (CP-2), `card_025` (Zé Mulherzinha), `card_044` (Grifo Real),
`card_059` (Licantropia) e `card_060` (Tranca Rua). Os 5 asserts foram
adicionados dentro do mesmo teste já existente (sem novo bloco `test(...)`),
seguindo o padrão já usado para `card_014`. Nenhuma mudança em
`src/js/game-engine.js` neste ciclo.

### Nota sobre o "Critical Gate" de diff

Não existe commit intermediário que isole "estado no audit anterior": todo o
lote 5D2 (`card-rules.js`, `manual_abilities.js`, `run-tests.js`,
`decisions.md`) segue não commitado sobre o mesmo `HEAD` (`bd7bd4c`), então
`git diff --stat` contra `HEAD` mostra os quatro arquivos — isso é esperado e
não indica regressão, pois o lote inteiro (produção 092/097/101 +
`decisions.md`) já havia sido implementado antes do audit anterior. O que
importa para este ciclo é que **nada mudou em `card-rules.js` e
`manual_abilities.js` desde o audit anterior (FAIL)**, especificamente. Como
não há commit para isolar esse intervalo, a verificação usou duas evidências
complementares:

1. **Timestamps de última escrita** — `card-rules.js` (01:12:13) e
   `manual_abilities.js` (01:11:23) têm `LastWriteTime` anterior ao de
   `run-tests.js` (01:23:08), consistente com "produção parada, só o teste
   seguiu sendo editado depois".
2. **Leitura direta do conteúdo atual** de `validateAttackTarget`
   ([card-rules.js:570-627](../../src/js/card-rules.js#L570-L627)) — os gates
   de `card_018`, `card_025`, `card_044`, `card_059` e `card_060` (bem como
   os bypasses `bypassesAllDefenses`/`bypassesEvasion` de 097/101) estão
   presentes e coerentes com a spec já aprovada no ciclo anterior; nenhum
   sinal de edição nova ou fora de escopo.

### DoD Checklist (escopo deste ciclo: item 3 da spec)

- [x] **DoD 3 — Olho de Águia (101) ignora somente evasão (058) e
  `UNTOUCHABLE_SHIELD` (092), nada além disso.** Os 5 novos asserts provam a
  metade que faltava (a metade "nada além disso"):
  - **CP-2 (`card_018`)** — gate em
    [card-rules.js:583-585](../../src/js/card-rules.js#L583-L585):
    `taunts.length > 0 && target.definitionId !== 'card_018'`. O teste
    registra um `card_018` no campo do defensor e usa `target` com
    `definitionId = 'normal_target'` (≠ `'card_018'`), disparando o gate
    independente de custo do atacante. Bypass é só `bypassesAllDefenses`
    (097), não `bypassesEvasion` (101) — Olho, sozinho, não zera `taunts.length
    > 0`. `assert(...valid, false)` prova o bloqueio mantido.
  - **Zé Mulherzinha (`card_025`)** — gate em
    [card-rules.js:594-601](../../src/js/card-rules.js#L594-L601): requer
    `hasOtherAlly` (outra criatura/evolução no campo defensor, diferente do
    alvo). O teste registra um segundo `card_025` (`eye_ze_ally`) no mesmo
    campo do alvo antes de checar — sem esse aliado o gate nunca dispararia
    e o assert provaria a coisa errada. Aliado é removido (`discard`) logo
    depois para não vazar para os próximos blocos.
  - **Grifo Real (`card_044`)** — gate em
    [card-rules.js:602-604](../../src/js/card-rules.js#L602-L604):
    `attacker.data.cost <= 4`. O teste ajusta `attacker.data.cost = 3`
    (≤ 4) exatamente para satisfazer o próprio gate do Grifo — se o custo
    ficasse em 5 (herdado do bloco anterior de `card_014`), o gate nunca
    dispararia e o `valid === false` seria um falso positivo por motivo
    errado (custo alto), não por Olho falhar em ignorar Grifo. Confirmado:
    custo foi explicitamente rebaixado para 3 antes de setar
    `target.definitionId = 'card_044'`.
  - **Licantropia (`card_059`)** — gate em
    [card-rules.js:607-613](../../src/js/card-rules.js#L607-L613): exige
    `attackingField.length === 1` (campo do próprio atacante com uma única
    criatura). `createCombatFixture` registra só o atacante no campo de
    `p1` (o equipamento `card_101` vai para a zona `equipment`, não conta
    como criatura), então o gate dispara corretamente sem setup adicional.
  - **Tranca Rua (`card_060`)** — gate em
    [card-rules.js:615-622](../../src/js/card-rules.js#L615-L622): exige
    `trancaRua` presente, `target !== trancaRua` e
    `defendingField.filter(isCreatureCard).length > 1`. O teste registra
    `card_060` no campo do defensor com `target.definitionId =
    'normal_target'` (instância diferente), e nesse ponto o campo defensor
    já tem exatamente 2 criaturas (`target` + `tranca`, já que o aliado e o
    CP-2 anteriores foram movidos para `discard`) — satisfazendo `length >
    1` sem depender de resíduo de blocos anteriores.
  - Ordem de execução confirmada por leitura: cada entidade auxiliar
    (`ally`, `cp2`, `tranca`) é criada, usada no assert imediatamente
    seguinte e movida para `discard` antes do próximo cenário — sem
    vazamento entre os 5 novos casos nem para o assert final de
    `card_058` (evasão, que continua `valid === true`, inalterado).

### Pattern Compliance

- [x] **Padrão de asserts inline no mesmo teste** (mesma convenção do bloco
  já existente de `card_014`) — nenhum novo bloco `test(...)` criado; suíte
  permanece em 102 testes totais.
- [x] **Bypass lido de `attachments` reais do atacante** — nenhum dos novos
  asserts inventa um campo externo de bypass; todos passam pelo mesmo
  `validateAttackTarget` que lê `attacker.attachments` e resolve
  `attachedDefinitions` normalmente.
- [x] **Traits e fixtures reaproveitadas** — `createCombatFixture`,
  `GameStateModel.registerCard`/`moveCard` usados sem desvio de padrão.

### Convention Violations

Nenhuma encontrada.

### Testes

- `node tests/unit/run-tests.js` → **102/102 testes passaram** (mesma
  contagem do ciclo anterior; os 5 asserts foram adicionados dentro do teste
  já existente, sem novo bloco `test(...)`).
- `node --check src/js/card-rules.js` → sem erro de sintaxe (exit 0).
- `git diff --check` → sem problemas de whitespace/conflito (exit 0).
- `git diff --stat` (contra `HEAD` `bd7bd4c`) →
  `.vibeflow/decisions.md`, `src/js/card-rules.js`,
  `src/js/manual_abilities.js` e `tests/unit/run-tests.js` aparecem
  modificados — esperado, pois todo o lote 5D2 segue não commitado sobre o
  mesmo `HEAD` usado pelo ciclo anterior. A pergunta relevante para este
  ciclo ("mudou algo em produção *desde o audit anterior*, especificamente?")
  foi respondida por timestamps de arquivo + leitura de conteúdo (ver seção
  acima), não pelo diff bruto contra `HEAD` — ambos confirmam **nenhuma
  mudança em `card-rules.js`/`manual_abilities.js`/`game-engine.js` desde o
  FAIL anterior**.
- Os 5 cenários adversariais do gap anterior — todos fechados e verificados
  por leitura direta do gate correspondente em `card-rules.js` (ver DoD
  Checklist acima). Nenhum dos 5 é satisfeito acidentalmente por outro gate.

### Gaps Fechados (referência ao audit anterior)

1. ~~CP-2 (`card_018`) sem assert negativo contra Olho de Águia~~ — fechado.
2. ~~Zé Mulherzinha (`card_025`) sem assert negativo contra Olho de Águia~~ —
   fechado.
3. ~~Grifo Real (`card_044`) sem assert negativo contra Olho de Águia~~ —
   fechado (custo do atacante corretamente ajustado a ≤ 4 para não confundir
   "gate de Grifo bloqueou por custo" com "Olho falhou em ignorar Grifo").
4. ~~Licantropia (`card_059`) sem assert negativo contra Olho de Águia~~ —
   fechado.
5. ~~Tranca Rua (`card_060`) sem assert negativo contra Olho de Águia~~ —
   fechado.

Nenhum gap remanescente identificado.

### Orçamento

4/4 arquivos declarados no contrato original; o pacote incremental deste
ciclo tocou apenas 1 (`tests/unit/run-tests.js`), dentro do orçamento.
