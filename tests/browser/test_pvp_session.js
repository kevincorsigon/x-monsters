// Testes do módulo pvp-session.js
(function runPvpSessionTests() {
    let passed = 0, failed = 0;
    function assert(label, cond) { cond ? (console.log('✅ ' + label), passed++) : (console.error('❌ ' + label), failed++); }

    console.log('🧪 ===== TESTES PVP SESSION =====\n');
    const SessionClass = window.PvpSession?.PvpSession;
    const Protocol = window.PvpProtocol;
    if (!SessionClass || !Protocol) { console.error('❌ PvpSession ou PvpProtocol não carregado'); return; }

    const state = {
        turn: 1, currentPlayer: 'p1', currentPhase: 'invocation',
        players: { p1: { pv: 20, energy: 5, maxEnergy: 10, zones: { deck: [], hand: [], field: [], equipment: [], discard: [] } },
                   p2: { pv: 20, energy: 5, maxEnergy: 10, zones: { deck: [], hand: [], field: [], equipment: [], discard: [] } } },
        cardInstances: {}, effects: [], pendingChoice: null, diceUsed: { p1: false, p2: false }
    };
    const sent = [], applied = [], events = [];
    const session = new SessionClass({
        transportSend: (msg) => sent.push(msg), gameState: state, seat: 'p1',
        applyCommand: (e) => applied.push(e), onEvent: (e) => events.push(e)
    });
    assert('Sessão criada', session !== null);
    assert('nextSeq=1', session.nextSeq === 1);
    assert('lastSeq=0', session.lastSeq === 0);
    assert('isApplying=false', session.isApplying() === false);

    // sendCommand
    session.sendCommand('DRAW', {});
    assert('sendCommand envia', sent.length === 1 && sent[0].type === 'COMMAND');

    // intercept
    sent.length = 0;
    assert('intercept ok', session.intercept({ cmd: 'DRAW', args: {} }) === true);
    session.applying = true; sent.length = 0;
    assert('intercept false applying', session.intercept({ cmd: 'DRAW', args: {} }) === false);
    session.applying = false;
    sent.length = 0;
    session.intercept({ cmd: 'ROLL_DICE', args: {} });
    assert('DICE_REQUEST', sent[0]?.type === 'DICE_REQUEST');
    sent.length = 0; events.length = 0;
    assert('cmd inválido bloqueia', session.intercept({ cmd: 'INVALID', args: {} }) === true);
    assert('evento INVALID', events.some(e => e.type === 'INVALID'));

    // Ordenação
    applied.length = 0; session.lastSeq = 0; session.commandLog = [];
    session.handleRemoteCommand({ seq: 1, cmd: 'DRAW', actor: 'p1', args: {}, reveals: [] });
    session.handleRemoteCommand({ seq: 2, cmd: 'DRAW', actor: 'p1', args: {}, reveals: [] });
    assert('Seq 1+2 aplicadas', applied.length === 2);
    applied.length = 0;
    session.handleRemoteCommand({ seq: 1, cmd: 'DRAW', actor: 'p1', args: {}, reveals: [] });
    assert('Dedupe', applied.length === 0);

    // Gap
    applied.length = 0; events.length = 0; sent.length = 0; session.lastSeq = 2;
    session.handleRemoteCommand({ seq: 5, cmd: 'DRAW', actor: 'p1', args: {}, reveals: [] });
    assert('Gap não aplica', applied.length === 0);
    assert('Gap pede resync', sent.some(m => m.type === 'COMMAND_LOG_REQUEST'));

    // Replay em ordem
    applied.length = 0; events.length = 0; session.lastSeq = 0; session.commandLog = [];
    session.handleCommandLog([
        { seq: 2, cmd: 'DRAW', actor: 'p1', args: {}, reveals: [] },
        { seq: 1, cmd: 'DRAW', actor: 'p1', args: {}, reveals: [] }
    ]);
    assert('Replay ordenado', applied.length === 2 && applied[0].seq === 1);
    assert('SYNCED', events.some(e => e.type === 'SYNCED'));

    // Dedupe no replay
    applied.length = 0; session.lastSeq = 2;
    session.commandLog = [{ seq: 1 }, { seq: 2 }];
    session.handleCommandLog([
        { seq: 1, cmd: 'DRAW', actor: 'p1', args: {}, reveals: [] },
        { seq: 3, cmd: 'DRAW', actor: 'p1', args: {}, reveals: [] }
    ]);
    assert('Dedupe replay', applied.length === 1);

    // resetLog
    session.lastSeq = 5; session.commandLog = [1, 2, 3]; session.resetLog();
    assert('resetLog', session.lastSeq === 0 && session.commandLog.length === 0);

    // DICE_RESULT
    applied.length = 0; session.lastSeq = 0; session.commandLog = [];
    session.handleDiceResult({ seq: 1, actor: 'p1', value: 4 });
    assert('DICE_RESULT', applied[0]?.cmd === 'ROLL_DICE' && applied[0]?.args.value === 4);

    // STATE_HASH divergente
    events.length = 0; sent.length = 0;
    session.handleStateHash({ actor: 'p1', hash: 999999, seq: 1 });
    assert('DIVERGENCE', events.some(e => e.type === 'DIVERGENCE'));

    // applying flag
    let flag = null;
    const s2 = new SessionClass({ transportSend: () => {}, gameState: state, seat: 'p1',
        applyCommand: () => { flag = s2.isApplying(); }, onEvent: () => {} });
    s2.applyEntry({ cmd: 'DRAW', actor: 'p1', args: {}, reveals: [], seq: 1 });
    assert('applying=true durante', flag === true);
    assert('applying=false após', s2.isApplying() === false);

    console.log(`\n🧪 Resultado Session: ${passed}/${passed + failed} checks`);
    console.log(`✅ ${passed} passed / ❌ ${failed} failed\n`);
})();