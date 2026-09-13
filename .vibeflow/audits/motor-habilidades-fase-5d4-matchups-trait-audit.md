# Audit Report: Motor de Habilidades - Fase 5D4 (Matchups por Trait)

**Verdict: PASS**

Contrato: [.vibeflow/prompt-packs/motor-habilidades-fase-5d4-matchups-trait.md](../prompt-packs/motor-habilidades-fase-5d4-matchups-trait.md)
Dependências: 5D1 PASS ([audits/motor-habilidades-fase-5d1-proveniencia-imunidades-audit.md](motor-habilidades-fase-5d1-proveniencia-imunidades-audit.md)) e lotes anteriores PASS — confirmado.
Arquivos do lote: [src/js/card-rules.js](../../src/js/card-rules.js), [tests/unit/run-tests.js](../../tests/unit/run-tests.js).

Reauditoria somente leitura após o pacote incremental que fechou os 3 gaps de
cobertura de teste do audit anterior (FAIL). Nenhuma mudança em
`card-rules.js` — confirmado por `git diff --stat` (só `run-tests.js` tem
diff) e pela leitura do conteúdo atual, idêntico ao já revisado no ciclo
anterior. A lógica de produção continua correta; o único trabalho deste
ciclo foi cobertura de teste, e os 3 novos asserts provam exatamente o que
afirmam provar.

### DoD Checklist

- [x] **DoD 1** — Manto (`card_095`) causa 15 de dano ao atacante Vampiro/Lobisomem
  quando o host equipado vira alvo; Iron Dragon bloqueia dano de controlador
  diferente; Golem não bloqueia dano de fonte suporte. Evidência:
  [card-rules.js:1207-1231](../../src/js/card-rules.js#L1207-L1231) (efeito criado em
  `BECAME_ATTACK_TARGET`, gate por `hasTrait(attacker, 'vampiro'||'lobisomem')`);
  [card-rules.js:759-807](../../src/js/card-rules.js#L759-L807) (`preventMigratedEffect`:
  Iron Dragon bloqueia por `sourceControllerId !== target.controllerId`; Golem
  exige `sourceIsCreature`, e o Manto é `type: 'suporte'`, nunca bloqueado por
  Golem). Testado nos três sentidos agora: "Manto Solar causa 15 somente a
  atacante Vampiro ou Lobisomem" (positivo + negativo sem trait), "dano de
  suporte atravessa Golem e é bloqueado por Iron inimigo" (Golem passa, Iron
  inimigo bloqueia) e o **novo** "Manto do mesmo controlador do Iron Dragon
  não é bloqueado" (gap 3 fechado — ver Gaps Fechados).
- [x] **DoD 2 (equipar)** — `card_102` só aceita host com trait guerreiro ou
  humanoide. Evidência: [card-rules.js:224-229](../../src/js/card-rules.js#L224-L229)
  (`requiredTraitsAny: ['guerreiro', 'humanoide']`) e
  [card-rules.js:511-521](../../src/js/card-rules.js#L511-L521)
  (`validateEquipmentTarget` rejeita quando nenhuma trait bate). Agora testado
  nos dois sentidos dentro do mesmo teste "Estaca concede +10 apenas em host
  elegível contra Vampiro/Lobisomem": host elegível (`card_056`, `valid ===
  true`) e o **novo assert** com host sem trait (`definitionId:
  'ineligible_host'`, ausente de `TRAITS_BY_DEFINITION`, `valid === false`) —
  gap 1 fechado.
- [x] **DoD 2 (matchup)** — Estaca concede +10 ATK/dano apenas contra alvo
  Vampiro/Lobisomem. Lógica em
  [card-rules.js:1099-1106](../../src/js/card-rules.js#L1099-L1106), gate por
  `hasTrait(target, 'vampiro'||'lobisomem')`. Agora coberta nos dois sentidos:
  teste existente cobre o alvo vampiro (`card_076`, +10 aplicado); **novo
  teste** "Estaca não concede bônus contra alvo sem trait Vampiro/Lobisomem"
  cobre o alvo sem a trait (`attackPower`/`damageToTarget` == 20, sem bônus)
  — gap 2 fechado.
- [x] **DoD 3** — Manoplas (`card_105`) concede +15 de dano só contra trait
  fogo, sem alterar ATK exibido. Sem alteração desde o último PASS; testado
  nos dois sentidos na mesma função de teste.
- [x] **DoD 4** — Sem bônus implícito dos campos numéricos brutos do JSON;
  limpeza ao equipamento sair. Inalterado desde o último ciclo — `modifiers:
  {}` para os três cards e `attack: 99, defense: 99` nos stubs de teste sem
  efeito no resultado.
- [x] **DoD 5** — Traits vêm de `TRAITS_BY_DEFINITION`
  ([card-rules.js:403-429](../../src/js/card-rules.js#L403-L429)), mapa explícito
  por `definitionId`, congelado. Inalterado.

### Pattern Compliance

- [x] **Proveniência canônica (5D1)** — Os 3 novos asserts/testes usam os
  mesmos helpers já auditados (`applyAbilityEffect`, que monta
  `provenance: { kind: 'ability', sourceId, abilityId }` e deixa
  `resolveProvenance` resolver `sourceControllerId` a partir de
  `getCard(sourceId).controllerId`, nunca de um valor declarado por fora).
  Nenhuma superfície de forjamento nova.
- [x] **Convenção de equipamentos migrados / fixtures de teste** — o novo
  teste da Estaca reusa `attachTraitEquipment`/`createCombatFixture` sem
  desvio de padrão; o novo teste do Manto reusa a estrutura exata de "dano de
  suporte atravessa Golem e é bloqueado por Iron inimigo", só invertendo o
  `ownerId` do suporte para o mesmo controlador do alvo — é o padrão espelhado
  corretamente, não uma reinvenção.
- [x] **Mapa de traits explícito** — inalterado, `card_056` (guerreiro/
  humanoide) usado como host elegível da Estaca e `ineligible_host` (fora do
  mapa) como host inválido — ambos corretos para o que o assert alega provar.

### Convention Violations

Nenhuma encontrada.

### Critical Gate

`git diff --stat` frente ao `HEAD` (`bd7bd4c`) mostra apenas
`tests/unit/run-tests.js | 36 ++++++++++++++++++++++++++++++++++++`
(36 inserções, 0 remoções) — `src/js/card-rules.js` sem diff, confirmando que
o pacote incremental não tocou produção. Revisão manual do diff: 3 blocos de
teste puro (asserts e um novo teste + um novo bloco de teste), sem SQL, sem
auth/CSRF/rate limit, sem segredo hardcoded, sem `eval`/`exec`, sem
IaC/K8s/config sensível — módulo de teste client-side puro.

- Clean — nenhuma operação destrutiva ou regressão de segurança detectada.

### Testes

- `node tests/unit/run-tests.js` → **95/95 passaram** (rodado agora; 93
  anteriores + "Manto do mesmo controlador do Iron Dragon não é bloqueado" +
  "Estaca não concede bônus contra alvo sem trait Vampiro/Lobisomem"; o
  terceiro gap fechado como assert inline, sem novo bloco `test(...)`).
- `node --check src/js/card-rules.js` → sem erro de sintaxe (exit 0).
- `git diff --check` → sem problemas de whitespace/conflito (exit 0).
- `git diff --stat` (HEAD) → só `tests/unit/run-tests.js` mudou; `card-rules.js`
  bit-a-bit idêntico ao commit já auditado.
- Cenários adversariais dos 3 gaps do audit anterior — todos fechados e
  verificados por leitura direta do código do teste:
  - [x] **Estaca em host sem trait válida (equipar deve ser rejeitado).**
    `ineligibleHost` tem `definitionId: 'ineligible_host'`, ausente de
    `TRAITS_BY_DEFINITION` ⇒ `hasTrait` retorna `false` para qualquer trait ⇒
    `validateEquipmentTarget` cai no ramo `requiredTraitsAny` e retorna
    `valid: false`. O assert (`assert.equal(...valid, false)`) prova
    exatamente a rejeição pedida. **Fechado corretamente.**
  - [x] **Estaca contra alvo sem trait vampiro/lobisomem (sem bônus).**
    Novo teste usa `fixture.attacker.definitionId = 'card_056'` (host
    elegível, guerreiro/humanoide) e alvo com `definitionId` padrão
    (`card_target`, fora do mapa de traits) ⇒ `targetIsHunterMatchup` é
    `false` ⇒ o bloco de `+10` em
    [card-rules.js:1099-1106](../../src/js/card-rules.js#L1099-L1106) nunca
    executa. Assert confere `attackPower === 20` e `damageToTarget === 20`
    (mesmo valor base, sem bônus). Isola corretamente o matchup do gate de
    equipar (host já é elegível, então o teste prova especificamente a
    ausência de bônus, não uma rejeição de equipar). **Fechado
    corretamente.**
  - [x] **Manto vs Iron Dragon do MESMO controlador do Manto (não deveria
    bloquear).** Novo teste registra `fixture.target` (controllerId `p2`,
    default do fixture) com `definitionId = 'card_065'` (Iron Dragon) e o
    suporte `card_095` também sob `ownerId/controllerId = 'p2'` — o mesmo
    controlador do alvo. `applyAbilityEffect` monta a proveniência a partir
    de `source.instanceId`, e `resolveProvenance` resolve
    `sourceControllerId` como `p2`, igual a `target.controllerId`. O gate de
    Iron Dragon em
    [card-rules.js:780-784](../../src/js/card-rules.js#L780-L784) só bloqueia
    quando `sourceControllerId !== target.controllerId`; aqui são iguais,
    então não bloqueia. Assert confere `fixture.target.damage === 15`
    (dano passou integralmente). É o espelho exato do teste já existente
    "dano de suporte atravessa Golem e é bloqueado por Iron inimigo" (que
    cobre o caso de controladores diferentes), agora cobrindo o caso mesmo
    controlador. **Fechado corretamente.**

### Gaps Fechados (referência ao audit anterior)

1. ~~Estaca — equipar em host inválido não testado~~ — fechado por assert
   inline em "Estaca concede +10 apenas em host elegível contra
   Vampiro/Lobisomem".
2. ~~Estaca — matchup negativo não testado~~ — fechado por novo teste
   "Estaca não concede bônus contra alvo sem trait Vampiro/Lobisomem".
3. ~~Manto — composição com Iron Dragon do mesmo controlador não testada~~ —
   fechado por novo teste "Manto do mesmo controlador do Iron Dragon não é
   bloqueado".

Nenhum gap remanescente identificado.

### Orçamento

2/2 arquivos declarados no contrato original; o pacote incremental tocou
apenas 1 (`tests/unit/run-tests.js`), dentro do orçamento próprio do pacote
incremental (nenhuma mudança em `card-rules.js`).
