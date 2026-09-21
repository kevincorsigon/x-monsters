---
tags: [data-loading, fallback, deck-building, json, card-schema]
modules: [src/js/deck_system.js, scripts/deck_factory.js, data/cards_database.json]
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
`src/js/deck_system.js`: `loadCardSystem`, `getFallbackCardData`, `DeckBuilder`
(`{ rng }` option), `createMatchDecks`, `startNewMatch`, `drawCardFromDeck`.
`scripts/deck_factory.js`: CLI that reuses the same builder with a seeded
RNG. Schema source of truth: `data/cards_database.json`.

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
  "image": "assets/cards/espada_mágica.png"
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

Deterministic decks (PvP): `DeckBuilder` takes an injected RNG and every
shuffle accepts one, so a seed reproduces the same two decks on both clients
and in `scripts/deck_factory.js`:

```javascript
// src/js/deck_system.js
shuffleArray(array, rng = this.rng) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

createMatchDecks(deckSize = 40) {
    const allCardsShuffled = this.shuffleArray([...this.allCards]);
    const midPoint = Math.floor(allCardsShuffled.length / 2);
    const deckBuilder1 = new DeckBuilder({ cards: allCardsShuffled.slice(0, midPoint) }, { rng: this.rng });
    const deckBuilder2 = new DeckBuilder({ cards: allCardsShuffled.slice(midPoint) }, { rng: this.rng });
    return {
        player1: deckBuilder1.createBalancedDeck(deckSize),
        player2: deckBuilder2.createBalancedDeck(deckSize)
    };
}
```

```javascript
// scripts/deck_factory.js
const rng = mulberry32(seed);
const builder = new DeckBuilder(cardsData, { rng });
const decks = builder.createMatchDecks(size);
process.stdout.write(JSON.stringify({ p1: decks.player1, p2: decks.player2 }));
```

PvP matches use 50-card decks (`DECK_SIZE` in `server.py` / `pvp-game.js`);
the server calls the CLI and degrades to "the client builds the deck from the
same seed" when Node is not installed.

## Rules
- Card object shape is fixed:
  `{ name, type: 'criatura'|'suporte'|'evolução', cost, attack, defense,
  hability, id: 'card_0NN', image: 'assets/cards/<slug>.png' }` — `id` is a
  zero-padded `card_NNN` string; multi-copy cards suffix with `_1`/`_2`/`_3`
  (see `card_010_1..3` for Diabrete Alado).
- Deck composition is always 60% criaturas / 30% suporte / 10% evoluções by
  count, and creatures are further split 40% low-cost (≤3) / 40% mid (4-6) /
  20% high (≥7). Reuse `selectBalancedByMana`/`createBalancedDeck` rather
  than writing new distribution logic for a variant deck size.
- Match setup calls `GameStateModel.resetMatchState` with the two decks;
  `drawCardFromDeck` is `GameStateModel.drawCard` (moves the same instance
  from `deck` → `hand`). Do not mint a second `instanceId` with `Date.now()`.
- `window.deckBuilder` / `window.cardsDatabase` are the cross-file access
  points — read them, don't re-fetch or re-parse `cards_database.json`
  elsewhere.
- Never call `Math.random()` for anything the two PvP clients must agree on:
  inject the RNG (`new DeckBuilder(cardsData, { rng })`,
  `shuffleArray(arr, rng)`) and derive it from the server seed
  (`mulberry32(seed)`); `Math.random` stays the default only for hotseat.

## Examples from this codebase
File: [deck_system.js](../../src/js/deck_system.js#L54)
`DeckBuilder` class — see "The Pattern" above.

File: [scripts/deck_factory.js](../../scripts/deck_factory.js#L50)
`main()` — `--seed`/`--size`, prints `{"p1":[…],"p2":[…]}` (called by
`server.py#generate_decks`).

File: [cards_database.json](../../data/cards_database.json#L1)
First card entry — see schema above.
<!-- vibeflow:auto:end -->

## Anti-patterns
- `getFallbackCardData()` in `src/js/deck_system.js` is a stale 30-card
  sample that does not match the real 110-card database. Do not create a
  second fallback copy; update or remove this fallback in a dedicated task.
- `fetch('data/cards_database.json')` fails under `file://` and silently
  falls back to the sample dataset. Run the documented local HTTP server.
