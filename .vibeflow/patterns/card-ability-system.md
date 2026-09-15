---
tags: [abilities, ui-bridge, feedback, integration]
modules: [src/js/card-abilities.js]
applies_to: [services]
confidence: inferred
---
# Pattern: Card Ability Trigger System (deprecated — removed in Fase 7)

> ⚠️ **Removed.** `card-abilities.js` no longer contains any of the switch-case
> logic described below — it was dead code (every card is migrated to the
> engine) and was deleted in Fase 7 of the ability-engine migration. The file
> is now a ~100-line bridge that only forwards feedback text from
> `CardRules`/`game-engine.js` to the UI. For adding or changing card
> abilities, use `src/js/card-rules.js` (`SUMMON_RULES`, `EQUIPMENT_RULES`,
> `ACTIVATED_RULES`, and the event handlers registered in `install()`) instead
> — see `.vibeflow/specs/motor-habilidades-eventos-e-efeitos.md` and
> `.vibeflow/decisions.md` for the current architecture and per-card
> modeling decisions. This doc is kept only as historical reference for the
> pattern that used to exist.

<!-- vibeflow:auto:start -->
## What
`CardAbilitiesSystem` (`window.cardAbilities`) is a thin UI bridge: it
installs `CardRules` on the engine and shows toast/glow feedback. It holds
no effect maps and no per-card methods.

## Where
`src/js/card-abilities.js`. `game.html` still calls `onCardSummoned` /
`onCardEquipped` / `onCombatDeclared` after the engine has already
resolved the action.

## The Pattern
```javascript
class CardAbilitiesSystem {
    attachEngine(engine) {
        if (this.unregisterCardRules) this.unregisterCardRules();
        this.engine = engine;
        if (window.CardRules) {
            this.unregisterCardRules = window.CardRules.install(engine);
        }
    }

    onCardSummoned(cardId, cardData, playerId) {
        if (window.CardRules?.isMigrated(cardData.id)) {
            const feedback = window.CardRules.getFeedback(cardData.id);
            if (feedback) this.showAbilityFeedback(cardId, feedback);
        }
    }

    onCardEquipped(equipmentId, equipmentData, targetId) {
        const migratedRule = window.CardRules?.getEquipmentRule(equipmentData.id);
        if (migratedRule) {
            this.showAbilityFeedback(targetId, migratedRule.feedback);
        }
    }

    processTurnEffects() {
        // Ticks are TURN_STARTED / TURN_ENDED in the engine.
    }
}

window.cardAbilities = new CardAbilitiesSystem();
```

## Rules
- Do not add `switch (cardData.id)` or per-card methods here.
- `showAbilityFeedback` is the only UI notification helper this file owns.
- `attachEngine` must run once after `GameEngine.createEngine`.
- New ability behavior goes in `card-rules.js` (see
  `patterns/card-rules-registry.md`).

## Examples from this codebase
File: `src/js/card-abilities.js`
`attachEngine`, `onCardSummoned`, `showAbilityFeedback`.
<!-- vibeflow:auto:end -->

## Anti-patterns
- No config-driven/table-based dispatch — every new card grows the `switch`
  statements linearly; there's no shared registry mapping card id → ability
  function.
- Coverage is incomplete and drifts from `cards_database.json`:
  `check_cards.py`/`ability_audit.js` exist specifically to detect cards in
  the database with no matching `case` in `card-abilities.js`. Check
  coverage before assuming a card's ability is implemented.
- `getCardById` is a thin alias for `findCardById` (kept for naming
  consistency with other getters) — don't add more redundant aliases.
