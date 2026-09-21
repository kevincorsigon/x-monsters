---
tags: [pvp, hidden-state, placeholders, reveals, instance-ids, fog-of-war]
modules: [src/js/pvp-state.js, src/js/game-state.js]
applies_to: [models, services, components]
confidence: inferred
---
# Pattern: PvP Hidden Zones & Reveal-on-Play

<!-- vibeflow:auto:start -->
## What
In an online match each client only owns its own identity. The opponent's
zones are materialized as *countable* placeholders (`definitionId: null`,
`data: null`) and become real instances only when a `reveal` travels with the
command that moved the card. Instance ids are opaque hashes, so the id never
leaks the card definition or its deck position.

## Where
`src/js/pvp-state.js` (`createHiddenInstance`, `installHiddenZones`,
`revealInstance`, `createPvpIdFactory`), consumed by `src/js/pvp-game.js`
(`montarPartida`, `buildReveal`) and `src/js/game.js`
(`renderHandsFromState`, `createCardBack`, `getHandSlot`). The state model it
extends is `src/js/game-state.js` (`resetMatchState`, zone arrays).

## The Pattern
Placeholders occupy the zone so counting, movement and `findCardLocations`
keep working with zero identity:

```javascript
// src/js/pvp-state.js
const HIDDEN_PREFIX = 'hidden_';

function createHiddenInstance(ownerId, index, zone = 'deck') {
    return {
        instanceId: `${HIDDEN_PREFIX}${ownerId}_${index}`,
        definitionId: null,
        data: null,
        ownerId, controllerId: ownerId, player: ownerId, zonePlayerId: ownerId,
        zone, index,
        baseStats: { attack: 0, defense: 0 }, damage: 0,
        attachments: [], attachedTo: null, modifiers: [], usage: {}, element: null
    };
}
```

`installHiddenZones` replaces the opponent zones and re-points the legacy
aliases that `resetMatchState` had bound to the old arrays:

```javascript
function installHiddenZones(state, ownerId, counts = {}) {
    let indice = 0;
    ZONE_NAMES.forEach(zone => {
        const length = Number(counts[zone] || 0);
        const placeholders = createHiddenZone(ownerId, zone, length, indice);
        indice += length;                       // ids únicos entre zonas ocultas
        state.players[ownerId].zones[zone] = placeholders;
        placeholders.forEach(card => { state.cardInstances[card.instanceId] = card; });
    });
    if (state.cards?.[ownerId]) {
        state.cards[ownerId].hand = state.players[ownerId].zones.hand;
        state.cards[ownerId].field = state.players[ownerId].zones.field;
        // ...
    }
    return state;
}
```

The local seat's deck comes from the server seed and an opaque id factory, so
two clients mint the same ids without sharing card identity:

```javascript
function createPvpIdFactory(seed) {
    let sequence = 0;
    const usados = new Set();
    const sal = Number(seed) || 0;
    return function idFactory(definition, ownerId) {
        const definitionId = definition?.id || String(definition);
        sequence += 1;
        let id = `i_${ownerId}_${hash(`${definitionId}|${ownerId}|${sequence}|${sal}`).toString(36)}`;
        // desambigua colisões mantendo determinismo
        return id;
    };
}
```

`revealInstance` swaps the placeholder **in the same slot** and is idempotent
(re-applying the author's own command must not throw):

```javascript
function revealInstance(state, reveal, options = {}) {
    const { instanceId, definitionId, ownerId, fromZone, slot } = reveal;
    const zone = state?.players?.[ownerId]?.zones?.[fromZone];
    if (!Array.isArray(zone)) throw new Error(`Reveal fora de zona: ${ownerId}/${fromZone}`);
    if (slot === undefined || slot === null || slot >= zone.length) {
        throw new Error('Reveal fora de zona: slot ' + slot);
    }
    const ocupante = zone[slot];
    if (ocupante && !isHiddenInstance(ocupante)) {
        if (ocupante.instanceId === instanceId) return ocupante;   // idempotente
        throw new Error('Reveal não é placeholder: posição já revelada');
    }
    // ...cria a instância real a partir do catálogo e a coloca no mesmo slot
}
```

The UI renders the opponent hand as backs — never identity, even if a local
instance happens to hold it:

```javascript
// src/js/game.js
function renderHandsFromState() {
    ['p1', 'p2'].forEach(player => {
        const handElement = document.getElementById(`hand-${player}`);
        handElement.innerHTML = '';
        const isLocalHand = player === assentoLocal();
        const emPvp = Boolean(window.PvpSession);

        gameState.cards[player].hand.forEach(cardInstance => {
            if (emPvp && !isLocalHand) {
                handElement.appendChild(createCardBack(cardInstance));
                return;
            }
            handElement.appendChild(createCard(cardInstance, player).element);
        });
        updateHandCounter(player);
    });
}
```

The match bootstrap installs both halves: the local deck with the opaque ids
and the invisible opponent zones.

```javascript
// src/js/pvp-game.js
window.GameStateModel.resetMatchState(
    window.gameState,
    { [assento]: decksPrivados, [oponente]: [] },
    {
        idFactory: window.PvpState.createPvpIdFactory(mensagem.seed),
        initialPv: mensagem.config?.initialPv,
        initialEnergy: mensagem.config?.initialEnergy
    }
);
window.PvpState.installHiddenZones(window.gameState, oponente, {
    deck: tamanhoDeckOculto,
    hand: 0
});
```

## Rules
- A hidden instance never carries identity: `definitionId: null`, `data: null`.
  `isHiddenInstance(card)` is the single check for "no identity yet".
- Sending a card out of the hand always travels with its reveal:
  `SUMMON` requires the reveal for its `handSlot`; `EQUIP` requires a hand
  reveal from the actor. The receiver knows the slot, never the identity.
- Ids are minted by `createPvpIdFactory(seed)` (`GameStateModel.resetMatchState`
  `idFactory` option) — never `Date.now()` and never a definition-revealing id.
- Reveals are idempotent (`revealInstance` returns the existing instance when
  the slot already holds the announced `instanceId`) and
  `assertRevealsMatchPlaceholders` rejects overwriting a slot that already has
  a different identity.
- Client-side reveals apply **before** the command applier runs
  (`applyCommand` calls `PvpState.applyReveals` first), so the applier always
  sees real instances.
- `applyReveals` never aborts the replay for a bad reveal: it logs
  (`pvp-state: reveal ignorado — ...`) and continues.

## Examples from this codebase
File: `src/js/pvp-state.js`
`installHiddenZones` (alias re-pointing + unique ids across zones),
`createPvpIdFactory` (FNV-1a of `definitionId|owner|sequence|seed`).

File: `src/js/pvp-protocol.js`
`requireReveal` / `validateReveal` — each reveal must carry
`instanceId, definitionId, ownerId, fromZone, slot`.

File: `src/js/game.js`
`createCardBack` + the `emPvp && !isLocalHand` branch in `renderHandsFromState`.
<!-- vibeflow:auto:end -->

## Anti-patterns
- Resolving the opponent definition locally to "just show the card" — identity
  crosses the wire only inside a reveal.
- Making an id from `Date.now()` or from the definition id: both leak
  information and break determinism between the two clients.
- Rebuilding the zone arrays without re-pointing `state.cards` / `state.decks`:
  the legacy aliases keep pointing at the old arrays and the UI renders
  nothing.
