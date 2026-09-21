// Testes do módulo pvp-protocol.js
(function runPvpProtocolTests() {
    let passed = 0;
    let failed = 0;

    function assert(label, condition) {
        if (condition) {
            console.log(`✅ ${label}`);
            passed++;
        } else {
            console.error(`❌ FALHOU: ${label}`);
            failed++;
        }
    }

    console.log('🧪 ===== TESTES PVP PROTOCOL =====\n');

    const Protocol = window.PvpProtocol;
    if (!Protocol) {
        console.error('❌ PvpProtocol não carregado');
        return;
    }

    // 1. Comandos válidos
    console.log('📋 Validação de comandos:');
    assert('PROTOCOL_COMMANDS contém DRAW', Protocol.PROTOCOL_COMMANDS.includes('DRAW'));
    assert('PROTOCOL_COMMANDS contém SUMMON', Protocol.PROTOCOL_COMMANDS.includes('SUMMON'));
    assert('PROTOCOL_COMMANDS contém ATTACK', Protocol.PROTOCOL_COMMANDS.includes('ATTACK'));
    assert('PROTOCOL_COMMANDS contém DESTROY', Protocol.PROTOCOL_COMMANDS.includes('DESTROY'));

    // 2. TURN_COMMANDS
    assert('TURN_COMMANDS inclui DRAW', Protocol.TURN_COMMANDS.includes('DRAW'));
    assert('TURN_COMMANDS inclui END_TURN', Protocol.TURN_COMMANDS.includes('END_TURN'));
    assert('TURN_COMMANDS não inclui DESTROY', !Protocol.TURN_COMMANDS.includes('DESTROY'));

    // 3. REQUIRED_ARGS
    assert('SUMMON exige handSlot', Protocol.REQUIRED_ARGS.SUMMON.includes('handSlot'));
    assert('ATTACK exige attackerId', Protocol.REQUIRED_ARGS.ATTACK.includes('attackerId'));
    assert('ATTACK exige targetId', Protocol.REQUIRED_ARGS.ATTACK.includes('targetId'));
    assert('DRAW não exige args', Protocol.REQUIRED_ARGS.DRAW.length === 0);

    // 4. normalizeCommand - comando válido
    console.log('\n🔧 normalizeCommand:');
    const cmdValido = Protocol.normalizeCommand({
        cmd: 'DRAW',
        actor: 'p1',
        args: {},
        reveals: []
    });
    assert('normalizeCommand retorna objeto', typeof cmdValido === 'object');
    assert('normalizeCommand preserva cmd', cmdValido.cmd === 'DRAW');
    assert('normalizeCommand preserva actor', cmdValido.actor === 'p1');

    // 5. normalizeCommand - comando inválido
    let threw = false;
    try {
        Protocol.normalizeCommand({ cmd: 'INVALID_CMD', actor: 'p1', args: {} });
    } catch (e) {
        threw = true;
    }
    assert('normalizeCommand lança em comando inválido', threw);

    // 6. normalizeCommand - args faltando
    threw = false;
    try {
        Protocol.normalizeCommand({
            cmd: 'SUMMON',
            actor: 'p1',
            args: {} // falta handSlot
        });
    } catch (e) {
        threw = true;
    }
    assert('normalizeCommand lança em args faltando', threw);

    // 7. validateReveal
    console.log('\n🔍 validateReveal:');
    const revealValido = {
        instanceId: 'i_p1_abc123',
        definitionId: 'card_001',
        ownerId: 'p1',
        fromZone: 'hand',
        slot: 0
    };
    assert('validateReveal retorna null para reveal válido', Protocol.validateReveal(revealValido) === null);

    const revealInvalido = { instanceId: '', definitionId: 'card_001', ownerId: 'p1', fromZone: 'hand', slot: 0 };
    assert('validateReveal detecta instanceId vazio', Protocol.validateReveal(revealInvalido) !== null);

    const revealZoneInvalida = { instanceId: 'i_p1_abc', definitionId: 'card_001', ownerId: 'p1', fromZone: 'invalid', slot: 0 };
    assert('validateReveal detecta fromZone inválido', Protocol.validateReveal(revealZoneInvalida) !== null);

    // 8. stateHash
    console.log('\n🔐 stateHash:');
    const state1 = {
        turn: 1,
        currentPlayer: 'p1',
        currentPhase: 'invocation',
        players: {
            p1: { pv: 20, energy: 5, maxEnergy: 10, zones: { deck: [], hand: [], field: [], equipment: [], discard: [] } },
            p2: { pv: 20, energy: 5, maxEnergy: 10, zones: { deck: [], hand: [], field: [], equipment: [], discard: [] } }
        },
        cardInstances: {},
        effects: [],
        pendingChoice: null,
        diceUsed: { p1: false, p2: false }
    };
    const hash1 = Protocol.stateHash(state1);
    assert('stateHash retorna número', typeof hash1 === 'number');
    assert('stateHash é determinístico', Protocol.stateHash(state1) === hash1);

    const state2 = { ...state1, turn: 2 };
    assert('stateHash muda com estado diferente', Protocol.stateHash(state2) !== hash1);

    // 9. fnv1a
    console.log('\n🔢 fnv1a:');
    const hashTexto = Protocol.fnv1a('teste');
    assert('fnv1a retorna número', typeof hashTexto === 'number');
    assert('fnv1a é determinístico', Protocol.fnv1a('teste') === hashTexto);
    assert('fnv1a difere para textos diferentes', Protocol.fnv1a('teste1') !== Protocol.fnv1a('teste2'));

    console.log(`\n🧪 Resultado Protocol: ${passed}/${passed + failed} checks`);
    console.log(`✅ ${passed} passed / ❌ ${failed} failed\n`);
})();