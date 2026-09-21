---
tags: [abilities, card-rules, registry, events, traits]
modules: [src/js/card-rules.js]
applies_to: [services, handlers]
confidence: inferred
---
# Pattern: Card Rules Registry

<!-- vibeflow:auto:start -->
## What
All 110 catalog abilities are modeled in `src/js/card-rules.js` as frozen
tables plus shared event handlers installed onto `GameEngine`. Adding a
card means extending those tables or a `definitionId === 'card_XXX'`
check inside `install()`, never a new method on `CardAbilitiesSystem`.

## Where
`src/js/card-rules.js` (`SUMMON_RULES`, `EQUIPMENT_RULES`, `COMBAT_RULES`,
`ACTIVATED_RULES`, `TARGET_RULES`, `STATE_RULES`, `PROTECTION_RULES`,
`install`). Consumed by `card-abilities.js` (`attachEngine` →
`CardRules.install`), `src/js/game.js` (validation, cost, combat), and
`manual_abilities.js` (`getActivatedRule` / `activateAbility`).

## The Pattern
Declarative summon effect — return engine effects, do not touch the DOM:

```javascript
const SUMMON_RULES = Object.freeze({
    card_012: {
        feedback: 'Natalino: outras criaturas aliadas recuperaram 10 DEF.',
        resolve(event, context) {
            return context.state.players[event.payload.playerId].zones.field
                .filter(card =>
                    card.instanceId !== event.payload.cardId &&
                    card.data.type === 'criatura'
                )
                .map(card => ({
                    kind: GameEngine.EFFECT_KINDS.APPLY_CARD_DAMAGE,
                    targetId: card.instanceId,
                    amount: -10
                }));
        }
    }
});
```

Equipment as modifiers / duration-bound effects:

```javascript
const EQUIPMENT_RULES = Object.freeze({
    card_001: {
        feedback: 'Espada Mágica: +5 ATK/+5 DEF enquanto equipada.',
        targetSide: 'ALLY',
        modifiers: { attack: 5, defense: 5 }
    }
});
```

`modifiers` usa os números do texto e tem precedência sobre o catálogo. Todo
stat de `attack`/`defense` que a regra **não** declara (nem via `ADD_MODIFIER`
em `effects`) é somado ao hospedeiro com o valor do próprio suporte no
`data/cards_database.json` (`createCatalogStatEffects`, duração
`UNTIL_SOURCE_LEAVES`). Regras com `targetSide: 'ENEMY'` são isentas dessa
derivação: nelas o número do catálogo é a magnitude da penalidade que a regra
já aplica assinada (`card_004`/`009`/`015`) ou via efeito próprio (`card_005`).

Activated abilities used from the manual panel:

```javascript
const ACTIVATED_RULES = Object.freeze({
    card_026: {
        abilityId: 'sabotar_copo',
        feedback: 'Sabota Copos: -5 ATK/-5 DEF.',
        limit: { kind: GameEngine.LIMIT_KINDS.PER_TURN, count: 1 },
        minTargets: 1,
        maxTargets: 1
    }
});
```

`install(engine)` registers handlers (summon, combat, death, turn ticks).
`manual_abilities.js` only lists cards that have `getActivatedRule` and
calls `CardRules.activateAbility(engine, cardId, targetIds)`.

## Rules
- Key tables by `definitionId` (`card_012`), not instance id.
- Handlers return arrays of `EFFECT_KINDS` objects. UI feedback is the
  rule's `feedback` string, shown by `cardAbilities.showAbilityFeedback`.
- Special-case cards that do not fit a table go in shared `install()`
  handlers with `definitionId === 'card_XXX'` (this is valid coverage;
  `check_cards.py` scans the file text, not `isMigrated()`).
- Traits live in `TRAITS_BY_DEFINITION`. Do not invent a parallel trait
  map in `src/js/game.js`.
- `DIRECT_ATTACK_DEFINITION_IDS` is checked as a **fallback**, after the
  card-specific branch. A card listed there (e.g. `card_063` Beluga) that
  also has a per-turn rule must be evaluated before the generic `return
  true`, otherwise the specific rule is unreachable.
- `isMigrated()` only lists table keys + direct-attack ids; it undercounts
  handler-only cards. Do not use it as the coverage gate.

## Examples from this codebase
File: `src/js/card-rules.js`
`SUMMON_RULES.card_012`, `EQUIPMENT_RULES.card_001`, `ACTIVATED_RULES.card_026`,
`install`, `validateAttackTarget`, `canDirectAttack` (Beluga usage check
reading `attacker.usage.combatAttacks.directAttacks` before the generic
`DIRECT_ATTACK_DEFINITION_IDS` branch).

File: `src/js/manual_abilities.js`
`renderMigratedAbilityCard` / `activateMigratedAbility`.
<!-- vibeflow:auto:end -->

## Anti-patterns
- Putting per-card logic back into `card-abilities.js`.
- Using `CardRules.isMigrated()` in `scripts/check_cards.py` as the
  implementation signal (fixed: the script now regex-scans `card-rules.js`).
