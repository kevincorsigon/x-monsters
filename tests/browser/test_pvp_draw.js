// Testes da regra "em PvP só o DRAW do servidor muda a mão".
// Roda contra pvp.html (game.js + pvp-game.js + pvp-session.js reais), sem
// servidor: a sessão recebe um transporte de teste e o ledger é dirigido aqui.
(function runPvpDrawTests() {
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

    console.log('🧪 ===== TESTES PVP DRAW (só o ledger compra) =====\n');

    const PvpGame = window.PvpGame;
    const SessionClass = window.PvpSession?.PvpSession;
    const Model = window.GameStateModel;
    const state = window.gameState;
    if (!PvpGame || !SessionClass || !Model || !state || !window.deckBuilder) {
        console.error('❌ Ponte PvP/estado/decks não carregados');
        return;
    }

    // 1. A página PvP não roda a abertura do hotseat: sem 5 cartas locais e sem
    // o +1 de energia do `initFirstTurn` (era daí que vinha o DRAW automático).
    assert('mão de p1 nasce vazia na página PvP', state.players.p1.zones.hand.length === 0);
    assert('mão de p2 nasce vazia na página PvP', state.players.p2.zones.hand.length === 0);
    assert('sem energia extra do primeiro turno',
        Model.getPlayerStat(state, 'energy', 'p1') === window.gameConfig.initialEnergy);

    // 2. Estado determinístico de teste (o que o MATCH_START monta via reset).
    const decks = window.deckBuilder.createMatchDecks(50);
    Model.resetMatchState(state, { p1: decks.player1, p2: decks.player2 }, window.gameConfig);
    document.body.dataset.seat = 'p2';
    PvpGame.setSeat('p2');
    window.renderHandsFromState();
    window.renderPlayerStats();

    const enviados = [];
    const sessao = new SessionClass({
        transportSend: mensagem => enviados.push(mensagem),
        gameState: state,
        seat: 'p2',
        applyCommand: entry => PvpGame.aplicarComandoDoLedger(entry),
        onEvent: () => {}
    });
    PvpGame.setSession(sessao);

    const comando = (seq, cmd, actor, args = {}) => ({ seq, cmd, actor, args, reveals: [] });
    const mao = player => state.players[player].zones.hand.length;
    const cartas = player => document.querySelectorAll(`#hand-${player} .card`).length;
    const versos = player => document.querySelectorAll(`#hand-${player} .card-back`).length;
    const contador = player => document.getElementById(`hand-title-${player}`)?.innerText || '';
    const encerrar = (seq, actor) => {
        state.currentPhase = 'combat';
        sessao.handleMessage({ type: 'COMMAND', ...comando(seq, 'END_TURN', actor) });
    };

    // 3. F5/reconexão: o COMMAND_LOG volta com a sessão em replay. Nada pode ser
    // reenviado e o DRAW do log compra uma única vez, para o assento local.
    sessao.handleMessage({ type: 'COMMAND_LOG', log: [
        comando(1, 'END_TURN', 'p1'),
        comando(2, 'DRAW', 'p2')
    ] });
    assert('replay do log não reenvia comando', enviados.length === 0);
    assert('DRAW do log rende a mão local', mao('p2') === 1 && cartas('p2') === 1 && versos('p2') === 0);
    assert('contador da mão local reflete o DRAW', contador('p2').includes('(1)'));
    assert('mão do oponente fica intacta', mao('p1') === 0 && cartas('p1') === 0);

    // 4. A virada ao vivo abre o turno local com DRAW + SET_PHASE (nada além).
    encerrar(3, 'p2');
    assert('fim do turno do oposto não envia comando', enviados.length === 0);
    encerrar(4, 'p1');
    assert('abertura do turno local envia DRAW + SET_PHASE',
        enviados.map(m => m.cmd).join(',') === 'DRAW,SET_PHASE');

    // 5. Os DRAW do ledger: a mão local rende carta real, a alheia só verso.
    sessao.handleMessage({ type: 'COMMAND', ...comando(5, 'DRAW', 'p2') });
    sessao.handleMessage({ type: 'COMMAND', ...comando(6, 'DRAW', 'p1') });
    assert('DRAW local virou carta real no DOM',
        mao('p2') === 2 && cartas('p2') === 2 && versos('p2') === 0);
    assert('contador local = 2', contador('p2').includes('(2)'));
    assert('DRAW do oponente vira verso + contagem',
        mao('p1') === 1 && cartas('p1') === 1 && versos('p1') === 1);
    assert('contador do oponente = 1', contador('p1').includes('(1)'));

    // 6. Mão cheia: o clique no deck não entra no ledger e a mão do dono e a
    // contagem do oponente param no mesmo ponto (limite de 7 cartas).
    while (Model.drawCard(state, 'p2')) { /* enche a mão local até o limite */ }
    window.renderHandsFromState();
    window.updateUI?.();
    enviados.length = 0;

    assert('mão local chega ao limite',
        mao('p2') === Model.HAND_LIMIT && cartas('p2') === Model.HAND_LIMIT);
    assert('contador da mão cheia = limite', contador('p2').includes(`(${Model.HAND_LIMIT})`));
    assert('badge "N cartas" acompanha o título',
        document.getElementById('hand-title-p2').getAttribute('data-count') === String(Model.HAND_LIMIT));

    window.addCardToHand('p2'); // mesmo caminho do clique no deck
    assert('clique com a mão cheia não envia DRAW', enviados.length === 0);
    assert('clique com a mão cheia não compra',
        mao('p2') === Model.HAND_LIMIT && cartas('p2') === Model.HAND_LIMIT);

    // A mão alheia replica o mesmo corte: o DRAW do ledger não vira verso.
    while (Model.drawCard(state, 'p1')) { /* enche a mão do oponente */ }
    window.renderHandsFromState();
    const versosAntes = versos('p1');
    sessao.handleMessage({ type: 'COMMAND', ...comando(7, 'DRAW', 'p1') });
    assert('DRAW do oponente também para no limite',
        mao('p1') === Model.HAND_LIMIT && versos('p1') === versosAntes);

    // 7. Contagem de mão sincronizada pelo websocket: o contador exibe o número
    // publicado pelo servidor (mesmo que o estado local ainda não o tenha).
    enviados.length = 0;
    const mensagemMaos = { type: 'HAND_SIZES', handSizes: { p1: 3, p2: 5 } };
    sessao.handleMessage(mensagemMaos);
    PvpGame.atualizarContadoresDeMao(mensagemMaos);
    assert('contador local mostra a contagem do servidor', contador('p2').includes('(5)'));
    assert('contador do oponente mostra a contagem do servidor', contador('p1').includes('(3)'));
    assert('badge do oponente acompanha o título',
        document.getElementById('hand-title-p1').getAttribute('data-count') === '3');

    // A contagem local divergiu da publicada (aqui, mão cheia no estado): o dono
    // publica o número novo em vez de exibir um contador que só ele vê.
    assert('divergência publica HAND_SIZE para o servidor',
        enviados.some(m => m.type === 'HAND_SIZE' && m.hand === Model.HAND_LIMIT));
    assert('o contador segue o servidor até a confirmação',
        contador('p2').includes('(5)'));
    assert('o leque do oponente encolhe para a contagem publicada',
        versos('p1') === 3 && mao('p1') === 3);

    // Contagem maior: o leque cresce na mesma medida (e o contador acompanha).
    const mensagemMaior = { type: 'HAND_SIZES', handSizes: { p1: 5, p2: 5 } };
    sessao.handleMessage(mensagemMaior);
    PvpGame.atualizarContadoresDeMao(mensagemMaior);
    assert('contagem maior acrescenta versos', versos('p1') === 5 && mao('p1') === 5);
    assert('contador do oponente segue o servidor', contador('p1').includes('(5)'));
    const acrescentadas = state.players.p1.zones.hand.filter(carta => window.PvpState.isHiddenInstance(carta));
    assert('as cartas que o servidor acrescenta nascem sem identidade',
        acrescentadas.length === 2 && acrescentadas.every(carta => carta.definitionId === null));

    // 8. O MATCH_START já traz a contagem da abertura (`state.maos`), antes de
    // qualquer COMMAND_LOG.
    const mensagemInicio = { type: 'MATCH_START', state: { maos: { p1: 2, p2: 4 } } };
    sessao.handleMessage(mensagemInicio);
    PvpGame.atualizarContadoresDeMao(mensagemInicio);
    assert('MATCH_START publica a contagem da abertura',
        contador('p1').includes('(2)') && contador('p2').includes('(4)'));

    console.log(`\n🧪 Resultado PvP DRAW: ${passed}/${passed + failed} checks`);
    console.log(failed === 0 ? '✅ a mão só mudou por comando DRAW' : `❌ ${failed} falhas\n`);
})();
