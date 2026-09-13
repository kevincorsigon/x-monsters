---
tags: [data-loading, fallback, deck-building, json, card-schema]
modules: [src/js/deck_system.js, data/cards_database.json]
applies_to: [services, configs]
confidence: inferred
---
# Pattern: Card Data Loading & Deck Balancing

<!-- vibeflow:auto:start -->
## What
`loadCardSystem()` fetches the authoritative `data/cards_database.json`; on any
failure (notably `fetch` of a local file over `file://`, which is CORS-blocked)
it falls back to a hardcoded sample dataset. `DeckBuilder` then builds
cost/type-balanced 30-card decks from whichever dataset loaded.

## Where
`src/js/deck_system.js`: `loadCardSystem`, `getFallbackCardData`, `DeckBuilder`,
`startNewMatch`, `drawCardFromDeck`. Schema source of truth:
`data/cards_database.json`.

## The Pattern
```javascript
async function loadCardSystem() {
    try {
        const response = await fetch('data/cards_database.json');
        const cardsData = await response.json();
        window.deckBuilder = new DeckBuilder(cardsData);
        window.cardsDatabase = cardsData;
        return true;
    } catch (error) {
        console.warn('Erro ao carregar via fetch, usando dados embarcados:', error);
        const fallbackData = getFallbackCardData();
        window.deckBuilder = new DeckBuilder(fallbackData);
        window.cardsDatabase = fallbackData;
        return true;
    }
}
```

Card schema (`data/cards_database.json`):
```json
{
  "name": "Espada Mágica",
  "type": "suporte",
  "cost": 1,
  "attack": 10,
  "defense": 5,
  "hability": "Equipa +5 de ataque e +5 defesa a um monstro.",
  "id": "card_001",
  "image": "cards/espada_mágica.png"
}
```

Balanced deck construction:
```javascript
createBalancedDeck(deckSize = 30) {
    const numCriaturas = Math.floor(deckSize * 0.6);
    const numSuportes = Math.floor(deckSize * 0.3);
    // + up to 10% evoluções, filled from criaturas if short
    const criaturasSelecionadas = this.selectBalancedByMana(criaturas, numCriaturas);
    ...
}

selectBalancedByMana(cards, count) {
    // 40% cost<=3, 40% cost 4-6, 20% cost>=7
}
```

## Rules
- Card object shape is fixed:
  `{ name, type: 'criatura'|'suporte'|'evolução', cost, attack, defense,
  hability, id: 'card_0NN', image: 'assets/cards/<slug>.png' }` — `id` is a
  zero-padded `card_NNN` string; multi-copy cards suffix with `_1`/`_2`/`_3`
  (see `card_010_1..3` for Diabrete Alado in `card-abilities.js`).
- Deck composition is always 60% criaturas / 30% suporte / 10% evoluções by
  count, and creatures are further split 40% low-cost (≤3) / 40% mid (4-6) /
  20% high (≥7). Reuse `selectBalancedByMana`/`createBalancedDeck` rather
  than writing new distribution logic for a variant deck size.
- Drawn cards get a synthetic `instanceId`
  (`` `${id}_${Date.now()}_${random}` ``) via `drawCardFromDeck` so the same
  base card can appear multiple times in hand/field without id collisions —
  DOM element ids and ability lookups use this `instanceId`, not the raw
  `id`.
- `window.deckBuilder` / `window.cardsDatabase` are the cross-file access
  points — read them, don't re-fetch or re-parse `cards_database.json`
  elsewhere.

## Examples from this codebase
File: [deck_system.js](../../src/js/deck_system.js#L1)
`DeckBuilder` class — see "The Pattern" above.

File: [cards_database.json](../../data/cards_database.json#L1)
First card entry — see schema above.
<!-- vibeflow:auto:end -->

## Anti-patterns
- `getFallbackCardData()` in `src/js/deck_system.js` is a stale 30-card
  sample that does not match the real 110-card database. Do not create a
  second fallback copy; update or remove this fallback in a dedicated task.
- `fetch('data/cards_database.json')` fails under `file://` and silently
  falls back to the sample dataset. Run the documented local HTTP server.
