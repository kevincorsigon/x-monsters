// Testes do módulo pvp-state.js
(function runPvpStateTests() {
    let passed = 0, failed = 0;
    function assert(label, cond) { cond ? (console.log('✅ ' + label), passed++) : (console.error('❌ ' + label), failed++); }

    console.log('🧪 ===== TESTES PVP STATE =====\n');
    const PvpState = window.PvpState;
    if (!PvpState) { console.error('❌ PvpState não carregado'); return; }

    // createHiddenInstance
    console.log('📋 createHiddenInstance:');
    const hidden = PvpState.createHiddenInstance('p1', 0, 'deck');
    assert('instanceId começa com hidden_', hidden.instanceId.startsWith('hidden_'));
    assert('definitionId null', hidden.definitionId === null);
    assert('data null', hidden.data === null);
    assert('ownerId correto', hidden.ownerId === 'p1');
    assert('zone correta', hidden.zone === 'deck');
    assert('index correto', hidden.index === 0);

    // isHiddenInstance
    console.log('\n🔍 isHiddenInstance:');
    assert('hidden é hidden', PvpState.isHiddenInstance(hidden) === true);
    const real = { instanceId: 'i_p1_abc', definitionId: 'card_001', data: {} };
    assert('real não é hidden', PvpState.isHiddenInstance(real) === false);
    assert('null não é hidden', PvpState.isHiddenInstance(null) === false);

    // createHiddenZone
    console.log('\n📦 createHiddenZone:');
    const zone = PvpState.createHiddenZone('p1', 'hand', 5);
    assert('Zone tem 5 cards', zone.length === 5);
    assert('Todos são hidden', zone.every(c => PvpState.isHiddenInstance(c)));
    assert('Zone correta', zone.every(c => c.zone === 'hand'));

    // installHiddenZones
    console.log('\n🏗️ installHiddenZones:');
    const state = {
        players: {
            p1: { zones: { deck: [], hand: [], field: [], equipment: [], discard: [] } }
        },
        cards: { p1: {} },
        cardInstances: {}
    };
    PvpState.installHiddenZones(state, 'p1', { deck: 3, hand: 2 });
    assert('Deck tem 3 placeholders', state.players.p1.zones.deck.length === 3);
    assert('Hand tem 2 placeholders', state.players.p1.zones.hand.length === 2);
    assert('Field vazio', state.players.p1.zones.field.length === 0);

    // findHiddenSlot
    console.log('\n🔎 findHiddenSlot:');
    const slot = PvpState.findHiddenSlot(state, 'hidden_p1_0');
    assert('Encontra slot', slot !== null);
    assert('Slot tem owner', slot?.ownerId === 'p1');
    const notFound = PvpState.findHiddenSlot(state, 'hidden_p1_999');
    assert('Não encontrado retorna null', notFound === null);

    // revealInstance
    console.log('\n🎴 revealInstance:');
    const state2 = {
        players: {
            p1: { zones: { deck: [PvpState.createHiddenInstance('p1', 0, 'deck')], hand: [], field: [], equipment: [], discard: [] } }
        },
        cardInstances: {}
    };
    state2.cardInstances['hidden_p1_0'] = state2.players.p1.zones.deck[0];

    const reveal = {
        instanceId: 'i_p1_real',
        definitionId: 'card_001',
        ownerId: 'p1',
        fromZone: 'deck',
        slot: 0
    };
    const resolver = (defId) => ({ id: defId, attack: 10, defense: 5 });
    const revealed = PvpState.revealInstance(state2, reveal, { resolveDefinition: resolver });
    assert('Reveal retorna instância', revealed !== null);
    assert('definitionId materializado', revealed.definitionId === 'card_001');
    assert('data materializado', revealed.data !== null);
    assert('Stats do definition', revealed.baseStats.attack === 10);

    // applyReveals
    console.log('\n🎴 applyReveals:');
    const state3 = {
        players: {
            p1: { zones: { deck: [PvpState.createHiddenInstance('p1', 0, 'deck')], hand: [], field: [], equipment: [], discard: [] } }
        },
        cardInstances: {}
    };
    state3.cardInstances['hidden_p1_0'] = state3.players.p1.zones.deck[0];

    const reveals = [{ instanceId: 'i_p1_real', definitionId: 'card_001', ownerId: 'p1', fromZone: 'deck', slot: 0 }];
    const applied = PvpState.applyReveals(state3, reveals, { resolveDefinition: resolver });
    assert('applyReveals retorna array', Array.isArray(applied));
    assert('1 reveal aplicado', applied.length === 1);

    // createPvpIdFactory
    console.log('\n🆔 createPvpIdFactory:');
    const idFactory = PvpState.createPvpIdFactory('room123');
    const id1 = idFactory({ id: 'card_001' }, 'p1');
    const id2 = idFactory({ id: 'card_002' }, 'p1');
    assert('id1 começa com i_p1_', id1.startsWith('i_p1_'));
    assert('id2 começa com i_p1_', id2.startsWith('i_p1_'));
    assert('ids únicos', id1 !== id2);
    assert('Determinístico com seed', idFactory({ id: 'card_001' }, 'p1').startsWith('i_p1_'));

    // fnv1a
    console.log('\n🔢 fnv1a:');
    const hash = PvpState.fnv1a('teste');
    assert('fnv1a retorna número', typeof hash === 'number');
    assert('fnv1a determinístico', PvpState.fnv1a('teste') === hash);
    assert('fnv1a difere textos', PvpState.fnv1a('a') !== PvpState.fnv1a('b'));

    console.log(`\n🧪 Resultado State: ${passed}/${passed + failed} checks`);
    console.log(`✅ ${passed} passed / ❌ ${failed} failed\n`);
})();