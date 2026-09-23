// Auditoria de sinergia carta x deck (read-only).
//
// Uso:
//   node scripts/deck_synergy_audit.js            -> relatório completo
//   node scripts/deck_synergy_audit.js --check    -> trava as invariantes dos
//     presets (40 cartas, teto de cópias, <= 3 fora do tema, hospedeiro de
//     suporte, base da evolução, cobertura 110/110) e sai com código != 0
//
// Não escreve nada: é a régua usada para decidir movimentações entre presets.
const path = require('node:path');
const cardsDatabase = require(path.join(__dirname, '..', 'data', 'cards_database.json'));
const decksDatabase = require(path.join(__dirname, '..', 'data', 'decks.json'));
const CardRules = require(path.join(__dirname, '..', 'src', 'js', 'card-rules.js'));
const DeckSystem = require(path.join(__dirname, '..', 'src', 'js', 'deck_system.js'));

const cartas = cardsDatabase.cards;
const porId = id => cartas.find(carta => carta.id === id);
const ehCriatura = carta => carta && ['criatura', 'evolução'].includes(carta.type);
const traitsDoTema = deck => deck.traits.filter(trait => trait !== 'elite');
const noTema = (carta, deck) => (carta.traits || []).some(t => traitsDoTema(deck).includes(t));

function inventarioDeck(deck) {
    const cartasDoDeck = deck.cartas.map(porId);
    const criaturas = cartasDoDeck.filter(ehCriatura);
    const suportes = cartasDoDeck.filter(carta => carta.type === 'suporte');
    const copias = deck.cartas.reduce((acc, id) => ({ ...acc, [id]: (acc[id] || 0) + 1 }), {});
    const custos = cartasDoDeck.map(carta => carta.cost);
    const hospedeiros = suporte => {
        const regra = CardRules.getEquipmentRule(suporte.id);
        if (!regra) return [];
        const exigidas = regra.requiredTraitsAny || (regra.requiredTrait ? [regra.requiredTrait] : []);
        if (!exigidas.length) return [];
        const elegivel = (carta, trait) => CardRules.hasTrait({ definitionId: carta.id, data: carta }, trait);
        return [suporte.name, exigidas.join('/'), criaturas.filter(c => exigidas.some(t => elegivel(c, t)))];
    };
    return {
        deck,
        cartas: cartasDoDeck,
        criaturas,
        suportes,
        copias,
        distintas: Object.keys(copias).length,
        foraDoTema: criaturas.filter(carta => !noTema(carta, deck)),
        hospedeiros: suportes.map(hospedeiros).filter(linha => linha.length),
        media: custos.reduce((a, b) => a + b, 0) / custos.length,
        baratas: custos.filter(c => c <= 3).length,
        medias: custos.filter(c => c >= 4 && c <= 6).length,
        caras: custos.filter(c => c >= 7).length,
        evolucoes: cartasDoDeck.filter(carta => carta.type === 'evolução'),
        maxCopias: Math.max(...Object.values(copias))
    };
}

function relatorio() {
    console.log('== CATÁLOGO: decks de cada carta ==');
    cartas.forEach(carta => {
        const decks = decksDatabase.decks
            .filter(deck => deck.cartas.includes(carta.id))
            .map(deck => deck.id);
        console.log(`${carta.id} ${(carta.name || '').padEnd(26)} ${String(carta.type).padEnd(10)} ` +
            `c${String(carta.cost).padStart(2)} ${String(carta.attack).padStart(3)}/${String(carta.defense).padStart(3)} ` +
            `[${(carta.traits || []).join(',')}] -> ${decks.join(',') || '-'}`);
    });

    console.log('\n== DECKS ==');
    decksDatabase.decks.forEach(deck => {
        const i = inventarioDeck(deck);
        console.log(`\n[${deck.id}] ${deck.nome} — traits: ${deck.traits.join(',')}`);
        console.log(`  cartas ${deck.cartas.length} | distintas ${i.distintas} | max copias ${i.maxCopias} ` +
            `| media ${i.media.toFixed(2)} | curva ${i.baratas}/${i.medias}/${i.caras} | criaturas ${i.criaturas.length}`);
        console.log(`  fora do tema (${i.foraDoTema.length}): ` +
            `${i.foraDoTema.map(c => `${c.name}[${(c.traits || []).join('/')}]`).join(', ') || '-'}`);
        console.log('  copias ( * = criatura fora do tema ): ' + Object.entries(i.copias)
            .sort((a, b) => porId(a[0]).cost - porId(b[0]).cost)
            .map(([id, n]) => `${id}x${n}${ehCriatura(porId(id)) && !noTema(porId(id), deck) ? '*' : ''}`)
            .join(' '));
        const porTrait = {};
        i.criaturas.forEach(carta => (carta.traits || []).forEach(t => { porTrait[t] = (porTrait[t] || 0) + 1; }));
        console.log('  criaturas por trait: ' + Object.entries(porTrait)
            .sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(', '));
        i.hospedeiros.forEach(([nome, exigidas, hosts]) => {
            console.log(`  suporte ${nome} (${exigidas}): ${hosts.length} hospedeiros ` +
                `[${[...new Set(hosts.map(c => c.name))].join(', ')}]`);
        });
    });

    const usadas = new Set(decksDatabase.decks.flatMap(deck => deck.cartas));
    const orfas = cartas.filter(carta => !usadas.has(carta.id)).map(carta => `${carta.id} ${carta.name}`);
    console.log(`\n== COBERTURA == ${usadas.size}/${cartas.length} usadas; orfas: ${orfas.join(', ') || '-'}`);
}

function checar() {
    const problemas = [];
    const usadas = new Set();
    // Customs (`custom: true`) são livres: a régua trava só os oficiais.
    decksDatabase.decks.filter(deck => deck.custom !== true).forEach(deck => {
        const i = inventarioDeck(deck);
        deck.cartas.forEach(id => usadas.add(id));
        if (deck.cartas.length !== DeckSystem.DECK_SIZE) {
            problemas.push(`${deck.id}: ${deck.cartas.length} cartas (esperado ${DeckSystem.DECK_SIZE})`);
        }
        Object.entries(i.copias).forEach(([id, n]) => {
            if (!porId(id)) problemas.push(`${deck.id}: ${id} nao existe no catalogo`);
            if (n > DeckSystem.limiteDeCopias(id)) problemas.push(`${deck.id}: ${id} x${n} acima do teto`);
        });
        if (i.foraDoTema.length > 3) {
            problemas.push(`${deck.id}: ${i.foraDoTema.length} fora do tema ` +
                `(${[...new Set(i.foraDoTema.map(c => c.name))].join(', ')})`);
        }
        deck.traits.forEach(trait => {
            if (!i.criaturas.some(c => (c.traits || []).includes(trait))) {
                problemas.push(`${deck.id}: trait ${trait} sem portadora`);
            }
        });
        if (i.distintas < 18) problemas.push(`${deck.id}: ${i.distintas} cartas distintas (minimo 18)`);
        if (i.cartas.length / i.distintas > 2.3) {
            problemas.push(`${deck.id}: ${(i.cartas.length / i.distintas).toFixed(2)} copias por carta (max 2.3)`);
        }
        if (i.criaturas.length < 24) problemas.push(`${deck.id}: ${i.criaturas.length} criaturas (minimo 24)`);
        if (i.media < 3 || i.media > 4.8) {
            problemas.push(`${deck.id}: custo medio ${i.media.toFixed(2)} fora da faixa 3.0-4.8`);
        }
        if (i.baratas < 10) problemas.push(`${deck.id}: ${i.baratas} cartas de custo <= 3 (minimo 10)`);
        if (i.medias < 8) problemas.push(`${deck.id}: ${i.medias} cartas de custo 4-6 (minimo 8)`);
        i.hospedeiros.forEach(([nome, exigidas, hosts]) => {
            if (hosts.length < 3) problemas.push(`${deck.id}: ${nome} (${exigidas}) com ${hosts.length} hospedeiros`);
        });
        i.evolucoes.forEach(evolucao => {
            const base = CardRules.EVOLUTION_BASE_IDS[evolucao.id];
            if (base && !deck.cartas.includes(base)) {
                problemas.push(`${deck.id}: ${evolucao.name} sem a base ${base}`);
            }
        });
    });
    cartas.filter(carta => !usadas.has(carta.id)).forEach(carta => {
        problemas.push(`cobertura: ${carta.id} ${carta.name} fora de todos os presets`);
    });
    if (problemas.length) {
        console.log(`CHECK FALHOU (${problemas.length}):`);
        problemas.forEach(p => console.log(` - ${p}`));
        process.exitCode = 1;
        return;
    }
    console.log('CHECK OK: presets coerentes com tema, teto de copias, hospedeiros e cobertura 110/110.');
}

if (process.argv.includes('--check')) checar();
else relatorio();

