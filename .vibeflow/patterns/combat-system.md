---
tags: [combat, damage-calculation, game-rules, engine]
modules: [src/js/game-engine.js, src/js/card-rules.js, game.html]
applies_to: [handlers]
confidence: inferred
---
# Pattern: Combat & Damage Resolution

<!-- vibeflow:auto:start -->
## What
Creature combat and direct attacks are resolved by
`gameEngine.resolveCombat`. `game.html` only validates, displays the
result, and animates destruction. Card-specific combat modifiers hook
`BEFORE_DAMAGE` / death events inside `CardRules.install`.

## Where
`src/js/game-engine.js` (`validateCombat`, `resolveCombat`,
`getEffectiveStat`, `getRemainingDefense`). `src/js/card-rules.js`
(`validateAttackTarget`, `canDirectAttack`, combat handlers).
`game.html`: `canAttackTarget`, `performAttack`, `directAttack`.

## The Pattern
```javascript
function canAttackTarget(attackerId, targetId, options = {}) {
    if (!options.skipEngine) {
        const baseCheck = window.gameEngine.validateCombat({ attackerId, targetId });
        if (!baseCheck.valid) {
            return { canAttack: false, reason: baseCheck.reason };
        }
    }
    const migratedCheck = window.CardRules.validateAttackTarget(
        gameState, attackerId, targetId
    );
    if (!migratedCheck.valid) {
        return { canAttack: false, reason: migratedCheck.reason };
    }
    return { canAttack: true, reason: 'Ataque permitido' };
}

function performAttack(attackerId, targetId) {
    const result = window.gameEngine.resolveCombat({
        attackerId,
        targetId,
        targetValidator: () => {
            const legacyCheck = canAttackTarget(attackerId, targetId, { skipEngine: true });
            return legacyCheck.canAttack || legacyCheck.reason;
        }
    });
    // then updateCardDisplay from getEffectiveStat / remaining defense
    result.defeated.forEach(cardId => {
        setTimeout(() => destroyCard(cardId), 500);
    });
}
```

Direct attack:

```javascript
const allowDirectAttack = window.CardRules.canDirectAttack(gameState, attackerId);
window.gameEngine.resolveCombat({
    attackerId, defenderPlayerId: opponent, isDirect: true, allowDirectAttack
});
```

Attack limits use `getAttackCount` / `getAttackLimit`, not a parallel
`gameState.attackedThisTurn` as the engine's source of truth (the array
still exists for UI highlighting).

## Rules
- Do not subtract `data.defense` in `game.html`. Remaining DEF is
  `getRemainingDefense`; ATK is `getEffectiveStat(..., 'attack')`.
- Protections (taunt, evasion, fofura, etc.) belong in
  `CardRules.validateAttackTarget` / engine effects, not
  `cardAbilities.permanentEffects`.
- New combat hooks are `registerEventHandler` on `ATTACK_DECLARED`,
  `BEFORE_DAMAGE`, `CREATURE_WOULD_DIE`, `CREATURE_DESTROYED` — not
  `onBeforeAttack` on the UI bridge.
- Destruction remains visually deferred (`setTimeout(destroyCard)`).
- Cost and attack-count badges that must match rules use engine getters
  (`getEffectiveCardCost`, `canAttack`).

## Examples from this codebase
File: `game.html` — `canAttackTarget`, `performAttack`, `directAttack`.

File: `src/js/game-engine.js` — `resolveCombat` event sequence.

File: `src/js/card-rules.js` — `validateAttackTarget`, `BEFORE_DAMAGE` handler.
<!-- vibeflow:auto:end -->

## Anti-patterns
- `alert()` is used for combat result messages (blocking, modal) right next
  to `showMessage()` (a non-blocking toast) in the same functions —
  inconsistent feedback UX. New combat feedback should prefer `showMessage`.
- Extensive `console.log` debug tracing is left in the shipped combat path.
