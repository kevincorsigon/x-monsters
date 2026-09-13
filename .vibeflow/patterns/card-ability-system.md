---
tags: [abilities, triggers, switch-dispatch, effects, card-game]
modules: [card-abilities.js]
applies_to: [services]
confidence: inferred
---
# Pattern: Card Ability Trigger System

<!-- vibeflow:auto:start -->
## What
`CardAbilitiesSystem` (instantiated as `window.cardAbilities`) is a single
class dispatching per-card behavior: each trigger method
(`onCardSummoned`, `onSupportCardPlayed`, `onCardEquipped`, `onBeforeAttack`,
`onAfterAttack`) contains a `switch (cardData.id)` where every `case`
delegates to one dedicated method implementing that card's specific ability.

## Where
`card-abilities.js` (2300+ lines, one file for all ~110 cards' abilities).
Consumed from `game.html` at the invocation (`dropCard`), equip
(`equipSupportCard`), and combat (`performAttack`) call sites via guarded
`window.cardAbilities` checks.

## The Pattern
```javascript
class CardAbilitiesSystem {
    constructor() {
        this.activeEffects = new Map();   // Efeitos ativos no jogo
        this.turnEffects = new Map();     // Efeitos que duram X turnos
        this.permanentEffects = new Map();// Efeitos permanentes
        this.oneShotEffects = new Set();  // Efeitos únicos usados
    }

    onCardSummoned(cardId, cardData, playerId) {
        switch(cardData.id) {
            case 'card_012': // Natalino
                this.natalino_healAllies(playerId);
                break;
            case 'card_013': // Zol
                this.zol_drawCard(playerId);
                break;
            // one case per card with a summon-trigger ability
        }
        this.applyPassiveAbilities(cardId, cardData, playerId);
    }

    // Method name = camelCase(card name) + '_' + effect description
    natalino_healAllies(playerId) {
        const allies = this.getAllyCreatures(playerId);
        allies.forEach(ally => this.modifyCardStats(ally.id, 0, 10));
        this.showAbilityFeedback(null, "🎄 Natalino: Todos os aliados +10 DEF!");
    }

    chocolicia_weakenCreature(targetId) {
        if (!targetId) return;
        const target = this.getCardById(targetId);
        if (target) {
            this.modifyCardStats(targetId, -10, -10);
            this.showAbilityFeedback(targetId, "💫 Chocolicia: -10 ATK/DEF");
        }
    }
}
```

Turn-scoped effects are tracked centrally and resolved once per turn:
```javascript
processTurnEffects() {
    for (const [cardId, effects] of this.turnEffects.entries()) {
        for (const [effectName, effectInfo] of effects.entries()) {
            effectInfo.turnsRemaining--;
            if (effectName === 'poisoned' && effectInfo.data.defenseReduction) {
                this.modifyCardStats(cardId, 0, -effectInfo.data.defenseReduction);
                this.showAbilityFeedback(cardId, "☠️ Veneno: -5 DEF");
            }
            if (effectInfo.turnsRemaining <= 0) effects.delete(effectName);
        }
        if (effects.size === 0) this.turnEffects.delete(cardId);
    }
}
```

## Rules
- One method per ability, named `<camelCaseCardName>_<effectDescription>`
  (e.g. `natalino_healAllies`, `espadaMagica_boost`,
  `zicaPantano_poison`) — never inline the ability logic in the `switch`.
- Every ability call ends with `this.showAbilityFeedback(cardId, message)`
  (cardId may be `null` for field-wide effects) — this drives both the
  toast notification and the card glow effect. New abilities must call it.
- Stat changes always go through `this.modifyCardStats(cardId, atkMod,
  defMod)` — never touch `cardElement.querySelector('.attack')` directly
  from an ability method.
- Effect lifetime determines the store: `addTurnEffect` (`turnEffects`, N
  turns, drained by `processTurnEffects`), `addPermanentEffect`
  (`permanentEffects`, checked by `canAttackTarget` in game.html for
  immunities), `addOneShotEffect`/`markAbilityUsed`+`hasUsedAbilityThisTurn`
  (`oneShotEffects`, once per turn/game).
- Card/ally/enemy lookups go through `getCardById`/`findCardById`,
  `getAllyCreatures(playerId)`, `getEnemyCreatures(playerId)` — these read
  `window.gameState.cards[...].field`, they don't duplicate that logic.
- Adding a new card ability: find its trigger point (summon / support-play /
  equip / before-attack / after-attack), add one `case 'card_0XX':` calling
  one new method following the naming rule above.

## Examples from this codebase
File: [card-abilities.js](../../card-abilities.js#L244)
`onCardSummoned` switch — see "The Pattern" above.

File: [card-abilities.js](../../card-abilities.js#L2024)
```javascript
modifyCardStats(cardId, attackMod, defenseMod) {
    const cardElement = document.getElementById(cardId);
    if (!cardElement) return;
    const attackSpan = cardElement.querySelector('.attack');
    if (attackSpan && attackMod !== 0) {
        const newAttack = Math.max(0, (parseInt(attackSpan.textContent) || 0) + attackMod);
        attackSpan.textContent = newAttack;
        attackSpan.style.color = attackMod > 0 ? '#00ff00' : '#ff6b6b';
        setTimeout(() => attackSpan.style.color = '', 2000);
    }
}
```
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
