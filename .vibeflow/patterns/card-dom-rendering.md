---
tags: [dom-rendering, drag-and-drop, css-theming, ui-state]
modules: [game.html]
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
`game.html`: `createCard`, `updateCardDisplay`, `destroyCard`,
`dragStart`/`dragOver`/`dropCard`/`allowDrop`, and the `<style>` block
(`:root`, `.card.*` state classes).

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

## Examples from this codebase
File: [game.html](../../game.html#L3273)
`dropCard` — see "The Pattern" above.

File: [game.html](../../game.html) (`<style>` block)
`.card.can-attack`, `.card.can-be-targeted`, `.card.already-attacked` rules.
<!-- vibeflow:auto:end -->

## Anti-patterns
- Dynamically created UI outside the card system (e.g. the floating panel
  in `manual_abilities.js`, turn notifications) is built with large
  `style.cssText` template strings instead of CSS classes — bypasses the
  theming convention above and duplicates colors already defined as CSS
  variables.
