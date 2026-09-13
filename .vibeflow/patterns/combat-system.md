---
tags: [combat, damage-calculation, game-rules, abilities-integration]
modules: [game.html]
applies_to: [handlers]
confidence: inferred
---
# Pattern: Combat & Damage Resolution

<!-- vibeflow:auto:start -->
## What
Attacking a creature applies **mutual damage** (both attacker and target lose
defense equal to the other's attack), checks destruction, applies penetrating
damage to PV on kill, and brackets the whole calculation with ability hooks.

## Where
`game.html`: `performAttack(attackerId, targetId)`, `directAttack()`,
`canAttackTarget(attackerId, targetId)`.

## The Pattern
```javascript
function performAttack(attackerId, targetId) {
    const attacker = findCardData(attackerId);
    const target = findCardData(targetId);

    const attackCheck = canAttackTarget(attackerId, targetId);
    if (!attackCheck.canAttack) {
        showMessage(attackCheck.reason, 'warning');
        clearCombatHighlights();
        setupCombatPhase();
        return;
    }

    if (window.cardAbilities && window.cardAbilities.onBeforeAttack) {
        window.cardAbilities.onBeforeAttack(attackerId, targetId);
    }

    const attackPower = attacker.data.attack;
    const targetDefenseOriginal = target.data.defense;
    target.data.defense -= attackPower;
    attacker.data.defense -= target.data.attack;

    const targetDestroyed = target.data.defense <= 0;
    const attackerDestroyed = attacker.data.defense <= 0;

    if (targetDestroyed) {
        const penetratingDamage = Math.max(0, attackPower - targetDefenseOriginal);
        if (penetratingDamage > 0) {
            changeStat('pv', target.player, -penetratingDamage);
        }
        setTimeout(() => destroyCard(targetId), 1000);
    }
    if (attackerDestroyed) {
        setTimeout(() => destroyCard(attackerId), 1000);
    }

    if (window.cardAbilities && window.cardAbilities.onAfterAttack) {
        window.cardAbilities.onAfterAttack(attackerId, targetId);
    }

    gameState.attackedThisTurn.push(attackerId);
    updateAttackedCardsVisual();
    clearCombatHighlights();
    setupCombatPhase();
}
```

Target immunities are checked *before* any damage is applied, by reading
`window.cardAbilities.permanentEffects`:

```javascript
function canAttackTarget(attackerId, targetId) {
    ...
    if (window.cardAbilities) {
        const targetProtections = window.cardAbilities.permanentEffects.get(targetId);
        if (targetProtections && targetProtections.has('cuteness_protection')) {
            const protection = targetProtections.get('cuteness_protection');
            if (protection.immuneToHighCostAttacks && attacker.data.cost > protection.maxAttackerCost) {
                return { canAttack: false, reason: `...` };
            }
        }
        // ... one `if` block per immunity type (ability_immunity,
        // total_ability_immunity, stone_immunity, mountain_evasion,
        // lycanthropy_protection) ...
    }
    return { canAttack: true, reason: 'Ataque permitido' };
}
```

## Rules
- Damage is always mutual: both `target.data.defense` and
  `attacker.data.defense` are reduced in the same call — there is no
  "attacker doesn't take damage" concept in the base rules, only ability
  overrides on top of it via `onBeforeAttack`/`onAfterAttack`.
- Always call `window.cardAbilities.onBeforeAttack` before applying damage and
  `onAfterAttack` after, guarded by existence checks — this is the only
  integration point between core combat and the ability system.
- Penetrating damage on a kill = `max(0, attackPower - originalDefense)`,
  applied to the *player's* PV via `changeStat('pv', player, -damage)`, never
  by mutating a PV field directly.
- Card destruction is visually deferred: update stats/DOM immediately, then
  `setTimeout(() => destroyCard(id), 1000)` — don't call `destroyCard`
  synchronously inside `performAttack`.
- New target immunities/protections are added as another `if
  (targetProtections.has('<effect_name>'))` branch in `canAttackTarget`,
  reading effect data set by `card-abilities.js`'s `addPermanentEffect`.

## Examples from this codebase
File: [game.html](../../game.html#L2591)
See `performAttack` above.

File: [game.html](../../game.html#L2702)
```javascript
function directAttack() {
    if (!gameState.attackingCard) { alert('...'); return; }
    if (gameState.attackedThisTurn.includes(gameState.attackingCard)) {
        showMessage('Esta carta já atacou neste turno!', 'warning');
        return;
    }
    const attacker = findCardData(gameState.attackingCard);
    const damage = attacker.data.attack;
    changeStat('pv', opponent, -damage);
}
```
<!-- vibeflow:auto:end -->

## Anti-patterns
- `alert()` is used for combat result messages (blocking, modal) right next
  to `showMessage()` (a non-blocking toast) in the same functions —
  inconsistent feedback UX. New combat feedback should prefer `showMessage`.
- Extensive `console.log` debug tracing is left in the shipped combat path.
