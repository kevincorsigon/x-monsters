/**
 * deck_factory.js - Gerador de decks determinístico para partidas PvP.
 *
 * Uso (da raiz do repo):
 *   py -3 -c "..."  # ou:  node scripts/deck_factory.js --seed=123 --size=40
 *
 * Reusa DeckBuilder de src/js/deck_system.js com RNG determinístico (mulberry32)
 * para garantir que dois clientes construam decks idênticos a partir da mesma seed.
 * Output: JSON {"p1":[defs],"p2":[defs]} no stdout.
 */

const fs = require('fs');
const path = require('path');

// mulberry32 — PRNG deterministico, compacto, sem dependencias.
function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Carrega o banco de dados de cartas (arquivo JSON local).
function loadCardsData() {
    const dbPath = path.join(__dirname, '..', 'data', 'cards_database.json');
    const raw = fs.readFileSync(dbPath, 'utf-8');
    return JSON.parse(raw);
}

// DeckBuilder e loadCardSystem vêm do src/js/deck_system.js (modo UMD).
const { DeckBuilder } = require(path.join(__dirname, '..', 'src', 'js', 'deck_system.js'));

// Parseia argumentos CLI: --seed=N, --size=N
function parseArgs() {
    const args = {};
    for (let i = 2; i < process.argv.length; i++) {
        const arg = process.argv[i];
        const match = arg.match(/^--(\w+)=(.+)$/);
        if (match) {
            args[match[1]] = match[2];
        }
    }
    return args;
}

function main() {
    const args = parseArgs();
    const seed = parseInt(args.seed || '0', 10);
    const size = parseInt(args.size || '50', 10);

    if (isNaN(seed)) {
        console.error('Uso: node scripts/deck_factory.js --seed=123 --size=50');
        process.exit(1);
    }

    const cardsData = loadCardsData();
    const rng = mulberry32(seed);
    const builder = new DeckBuilder(cardsData, { rng });
    const decks = builder.createMatchDecks(size);

    // Serializa apenas as definicoes (sem funções/closures).
    const output = {
        p1: JSON.parse(JSON.stringify(decks.player1)),
        p2: JSON.parse(JSON.stringify(decks.player2)),
    };
    process.stdout.write(JSON.stringify(output));
}

if (require.main === module) {
    main();
}

// Exporta para testes unitarios.
module.exports = { mulberry32, loadCardsData, DeckBuilder };
