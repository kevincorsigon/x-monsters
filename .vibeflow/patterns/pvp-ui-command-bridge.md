---
tags: [pvp, ui-hooks, guards, lockstep, seat-mirroring, command-bridge]
modules: [src/js/game.js, src/js/pvp-game.js, src/css/]
applies_to: [components, handlers]
confidence: inferred
---
# Pattern: PvP UI Command Bridge (guards + reapply)

<!-- vibeflow:auto:start -->
## What
The online mode reuses the hotseat UI instead of duplicating it. Each mutating
handler in `src/js/game.js` starts with a one-line guard: if a PvP session
exists the action becomes a ledger command, and when the broadcast comes back
the same handler body runs synchronously to reapply it. `src/js/pvp-game.js`
owns the connection, the seat and the command appliers; the seat also mirrors
the board through `data-seat`.

## Where
`src/js/game.js` (`pvpGuard`, `pvpAplicando`, `pvpReveal`, `assentoLocal` and
the guards in `rollDice`, `editName`, `endTurn`, `setPhase`, `performAttack`,
`directAttack`, `addCardToHand`, `dropCard`, `destroyCard`),
`src/js/pvp-game.js` (socket, `applyCommand`, appliers, control blocking),
`src/js/manual_abilities.js` (ABILITY path), `src/css/pvp.css`
(`body[data-seat="p2"]` mirroring).

## The Pattern
Three small helpers plus a guard at the top of every mutating handler:

```javascript
// src/js/game.js
function pvpGuard(request) {
    const sessao = window.PvpSession?.PvpSession;
    if (!sessao || typeof sessao.intercept !== 'function') return false;
    return sessao.intercept(request);
}

function pvpAplicando() {
    const sessao = window.PvpSession?.PvpSession;
    return Boolean(sessao && typeof sessao.isApplying === 'function' && sessao.isApplying());
}

function pvpReveal(cardId, fromZone) {
    const reveal = window.PvpGame?.buildReveal?.(cardId, fromZone);
    return reveal ? [reveal] : [];
}

function performAttack(attackerId, targetId) {
    if (pvpGuard({ cmd: 'ATTACK', args: { attackerId, targetId } })) return;
    // ...corpo local inalterado (também roda na aplicação remota)
}
```

Actions that move a card out of the hand carry the reveal built at the UI edge:

```javascript
function dropCard(e) {
    e.preventDefault();
    const cardIdArrastado = e?.dataTransfer?.getData?.('text/plain') || '';
    const playerAlvo = e?.currentTarget?.dataset?.player;
    const ehCampo = e?.currentTarget && !e.currentTarget.classList.contains('card');
    if (ehCampo && playerAlvo === assentoLocal() &&
        pvpGuard({
            cmd: 'SUMMON',
            args: { handSlot: getHandSlot(cardIdArrastado, playerAlvo) },
            reveals: pvpReveal(cardIdArrastado, 'hand')
        })) {
        return;
    }
    // ...
}
```

Cards destroyed by a resolved attack use the ledger in the same order on both
sides, instead of the local animation timeout:

```javascript
result.defeated.forEach(cardId => {
    if (window.PvpSession) {
        if (pvpAplicando()) {
            destroyCard(cardId);                       // aplicação remota: síncrono
        } else {
            pvpGuard({ cmd: 'DESTROY', args: { cardId } });
        }
        return;
    }
    setTimeout(() => destroyCard(cardId), 500);        // hotseat: animação
});
```

The applier runs the *existing* UI functions — no duplicated game logic:

```javascript
// src/js/pvp-game.js
function applyCommand(entry) {
    const state = window.gameState;
    if (Array.isArray(entry.reveals) && entry.reveals.length > 0) {
        window.PvpState?.applyReveals(state, entry.reveals);
    }
    switch (entry.cmd) {
        case 'DRAW': aplicarCompra(entry); return;
        case 'SUMMON': aplicarInvocacao(entry); return;
        case 'SET_PHASE': window.setPhase?.(entry.args.phase); return;
        case 'END_TURN': window.endTurn?.(); return;
        case 'EQUIP':
            window.renderHandsFromState?.();
            window.equipSupportCard?.(entry.args.cardId, entry.args.creatureId);
            return;
        case 'ATTACK':
            window.renderFieldsFromState?.();
            window.performAttack?.(entry.args.attackerId, entry.args.targetId);
            return;
        case 'ROLL_DICE': window.rollDice?.(entry.actor, entry.args.value); return;
        case 'CHOICE': window.gameEngine?.resolveChoice?.(entry.args.choiceId, entry.args.selection); return;
        default: console.warn('pvp-game: comando sem aplicador —', entry.cmd);
    }
}
```

The seat is a UI concern: `pvp-game.js` sets `data-seat` on the container and
`pvp.css` swaps the grid, without touching `game.css`.

```javascript
function marcarAssento() {
    const container = document.querySelector('.game-container') || document.body;
    container.dataset.seat = seatLocal;
    document.body.dataset.seat = seatLocal;
}
```

```css
/* src/css/pvp.css */
body[data-seat="p2"] .game-container {
    grid-template-areas:
        "player1-discard player1-hand player1-deck"
        "player1-stats player1-field player1-field"
        "phase-buttons phase-buttons phase-buttons"
        "player2-stats player2-field player2-field"
        "player2-deck player2-hand player2-discard";
}
body[data-seat] .peek-hand-btn { display: none !important; }
```

## Rules
- Every handler that mutates state in a way the opponent must know starts with
  `if (pvpGuard({ cmd, args, reveals })) return;`. The local body stays intact:
  it is what the remote application runs.
- Guards use `window.PvpSession?.PvpSession`; local (`game.html`) has no session
  and keeps the hotseat behavior untouched.
- Never duplicate rules inside `pvp-game.js`: call the UI function
  (`window.dropCard`, `window.performAttack`, `window.equipSupportCard`, …) or
  the engine, exactly like the local path does.
- `pvp-game.js` blocks what only makes sense in hotseat: `startNewMatch` /
  `resetGame` are neutralized until `MATCH_START`; editing the opponent's
  name/PV/energy, peeking the opponent hand and the deck-info button are
  disabled; interaction is enabled only on the local turn.
- The local player's own animations keep running, but remote application is
  synchronous (no `setTimeout` choreography) so both clients land on the same
  state.
- All new PvP styling lives in `src/css/pvp.css` (`body[data-seat]` selectors),
  never in `game.css`.

## Examples from this codebase
File: `src/js/game.js`
The `pvpGuard` helpers (lines 19-42) and the guards in `rollDice`,
`endTurn`, `setPhase`, `performAttack`, `directAttack`, `dropCard`.

File: `src/js/pvp-game.js`
`applyCommand` / `aplicarInvocacao` (reuses `window.dropCard` with a synthetic
event) / `aplicarHabilidade` (reuses `window.applyMigratedAbilityLocally`) /
`atualizarBloqueioPorTurno`.

File: `src/js/manual_abilities.js`
`ABILITY` is sent from the UI with the hand reveal, while
`applyMigratedAbilityLocally` stays the single applier for both modes.
<!-- vibeflow:auto:end -->

## Anti-patterns
- Reimplementing invocation/combat inside `pvp-game.js` — the applier must call
  the same UI function the local player uses, otherwise the two modes diverge.
- Applying a command locally *and* also sending it: in PvP the author applies
  its own play through the broadcast only (`intercept` returns `true` and the
  handler exits).
- Adding PvP conditionals inside `card-rules.js` / `game-engine.js`: the engine
  stays mode-agnostic; the mode lives in the UI layer.
