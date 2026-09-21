---
tags: [dom-rendering, drag-and-drop, css-theming, ui-state]
modules: [src/js/game.js, src/css/]
applies_to: [components]
confidence: inferred
---
# Pattern: Card DOM Rendering, Drag & Drop, and CSS-Class State

<!-- vibeflow:auto:start -->
## What
Cards are manually-built DOM elements (no component framework). All visual
state (selectable, targetable, equipped, destroyed, dragging) is expressed as
CSS classes toggled from JS, never inline styles for state. Theme values
(colors, radii, spacing) come from `:root` CSS custom properties.

## Where
`src/js/game.js`: `createCard`, `updateCardDisplay`, `destroyCard`,
`dragStart`/`dragOver`/`dropCard`/`allowDrop`, `renderHandsFromState`,
`createCardBack` (the inline script was extracted out of `game.html`, which
is now a shell that only loads the scripts). Theme tokens (`:root`) and the
`.card.*` state classes live in `src/css/game.css`; `src/css/pvp.css` adds
the `body[data-seat]` perspective overrides.

## The Pattern
```javascript
// Theming
:root {
    --bg-color: #1a1e28;
    --primary-color: #c9a567;
    --energy-color: #f5c94a;
    --pv-zero-color: #ff6b6b;
    --border-radius: 10px;
}

// State expressed purely as classes
.card.can-attack {
    border-color: #ffa500 !important;
    animation: pulse-attacker 2s infinite;
}
.card.can-be-targeted { border-color: #ff4444 !important; }
.card.already-attacked { filter: grayscale(50%) brightness(0.7); }
```

```javascript
function dropCard(e) {
    e.preventDefault();
    const cardId = e.dataTransfer.getData('text/plain');
    const cardElement = document.getElementById(cardId);
    if (e.currentTarget.classList.contains('card')) {
        handleEquipmentDrop(e, cardId);
        return;
    }

    const summonCost = getEffectiveCardCost(cardId, cardData.data);
    const summonResult = window.gameEngine.resolveAction({ /* SUMMON_CARD */ });
    if (summonResult.status === 'resolved') {
        cardElement.remove();
        cardElement.classList.remove('selected'); // destaque é da mão, não da mesa
        e.currentTarget.appendChild(cardElement);
        cardElement.classList.add('card-play-animation');
        cardElement.classList.remove('can-be-summoned', 'dragging');
        window.cardAbilities?.onCardSummoned(cardId, cardData.data, targetPlayer);
    }
}
```

## Rules
- Visual state toggles use `classList.add/remove` on `.card` — e.g.
  `can-be-summoned`, `can-attack`, `can-be-targeted`,
  `cannot-be-targeted`, `already-attacked`, `equipped`, `dragging`.
  Don't set `style.border`/`style.boxShadow` for these states; add a CSS
  class instead.
- Reuse the `:root` custom properties for any new UI color/spacing; don't
  hardcode new hex colors for structural chrome (existing hardcoded hex on
  state classes like `#ffa500`/`#ff4444` is legacy and not to be extended).
- Drag & drop is native HTML5 DnD: `dataTransfer.setData('text/plain',
  cardId)` on `dragstart`, read back with `getData` in `drop`. No drag
  library is used or should be introduced.
- Card ids doubling as DOM element ids: `document.getElementById(cardId)`
  is the standard lookup; `cardId` is the engine `instanceId`.
- Cost badges and summon gating use `getEffectiveCardCost` (engine
  modifiers), not the raw catalog `cost`.
- The opponent hand renders through `createCardBack` (`.card.card-back`)
  and the board mirrors by `body[data-seat="p2"]` in `src/css/pvp.css`
  (pattern: `.vibeflow/patterns/pvp-hidden-state.md`).
- Re-render from state (`renderHandsFromState` / `renderFieldsFromState`),
  never from the DOM: card identity is the engine `instanceId`.
- A visual state class must never change the card's **size**: selection,
  highlighting and alerts use color/shadow/border, not `transform: scale()`.
  `.card.selected` keeps an inline-less `transform` out of the rule for exactly
  this reason — the hand's arc rotations (`:nth-child`) win over the class and
  hide the scale there, but a card in the field has no competing rule, so the
  scale showed up as "one card bigger than its neighbours" on the board.
- Hand-only state does not travel with the element: `dropCard` moves the same
  DOM node from the hand into the field, so it strips `selected` (and
  `can-be-summoned`/`dragging`) plus clears `gameState.selectedCard` — otherwise
  the click highlight follows the card onto the board.
- Zone counters on the board are a *view* of the state, never a parallel
  counter: `updateDiscardCount`/`updateDeckCounter` read
  `state.players[id].zones.<zone>.length` and write the label plus a
  `data-count` attribute. `updateDeckCounter` is repainted where the balance
  can change — `renderHandsFromState` (boot/replay/ledger), `addCardToHand`
  (the draw click) and `updateUI` (generic repaint, through which card effects
  that pull from the deck pass) — plus `pvp-game.atualizarContadoresDeMao` for
  the server-published counts. The label stays inside the deck box (slot-sized
  area, `font-size: 10px` via `.deck-count`) and turns to the `--pv-zero-color`
  token when the balance hits zero (`data-empty="1"`).

## Examples from this codebase
File: [src/js/game.js](../../src/js/game.js#L1589)
`dropCard` — see "The Pattern" above.

File: [src/js/game.js](../../src/js/game.js#L1184)
`renderHandsFromState` + `createCardBack` — the PvP hand rendering.

File: [src/css/game.css](../../src/css/game.css)
`:root` tokens and `.card.can-attack`, `.card.can-be-targeted`,
`.card.already-attacked` rules.
<!-- vibeflow:auto:end -->

## Anti-patterns
- Dynamically created UI outside the card system (e.g. the floating panel
  in `manual_abilities.js`, turn notifications) is built with large
  `style.cssText` template strings instead of CSS classes — bypasses the
  theming convention above and duplicates colors already defined as CSS
  variables.
