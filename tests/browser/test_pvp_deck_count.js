// Contagem restante na área de saque em PvP: o dono conta o deck privado e o
// oponente conta o deck oculto (tamanho publicado no MATCH_START), encolhendo a
// cada DRAW replicado no ledger. Roda contra pvp.html, sem servidor.
(function runPvpDeckCountTests() {
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

    console.log('🧪 ===== TESTES DE CONTAGEM NA ÁREA DE SACAR (PvP) =====\n');

    const PvpGame = window.PvpGame;
    const SessionClass = window.PvpSession?.PvpSession;
    const Model = window.GameStateModel;
    const state = window.gameState;
    if (!PvpGame || !SessionClass || !Model || !state || !window.deckBuilder || !window.PvpState) {
        console.error('❌ Ponte PvP/estado/decks não carregados');
        return;
    }

    // Estado determinístico de teste (o que o MATCH_START monta via reset) com o
    // deck oculto do oponente no tamanho publicado pelo servidor.
    const decks = window.deckBuilder.createMatchDecks(50);
    Model.resetMatchState(state, { p1: decks.player1, p2: decks.player2 }, window.gameConfig);
    document.body.dataset.seat = 'p2';
    PvpGame.setSeat('p2');
    window.PvpState.installHiddenZones(state, 'p1', { deck: 40, hand: 0 });
    window.renderHandsFromState();
    window.renderPlayerStats();

    const sessao = new SessionClass({
        transportSend: () => {},
        gameState: state,
        seat: 'p2',
        applyCommand: entry => PvpGame.aplicarComandoDoLedger(entry),
        onEvent: () => {}
    });
    PvpGame.setSession(sessao);

    const el = player => document.getElementById(`deck-count-${player}`);
    const saldo = player => state.players[player].zones.deck.length;
    const texto = player => (el(player)?.textContent || '').trim();
    const versos = player => document.querySelectorAll(`#hand-${player} .card-back`).length;
    const comando = (seq, cmd, actor, args = {}) => ({ seq, cmd, actor, args, reveals: [] });

    assert('o deck privado aparece na área de saque do dono',
        saldo('p2') === 50 && texto('p2') === '50 cartas');
    assert('o deck oculto mostra o tamanho publicado no MATCH_START',
        saldo('p1') === 40 && texto('p1') === '40 cartas');

    // DRAW do assento local: o deck privado encolhe e o rótulo acompanha.
    sessao.handleMessage({ type: 'COMMAND', ...comando(1, 'DRAW', 'p2') });
    assert('o DRAW local tira 1 do deck privado', saldo('p2') === 49 && texto('p2') === '49 cartas');
    assert('o deck do oponente não é tocado pela compra local',
        saldo('p1') === 40 && texto('p1') === '40 cartas');

    // DRAW do oponente replicado no ledger: o deck oculto encolhe na tela dele.
    sessao.handleMessage({ type: 'COMMAND', ...comando(2, 'DRAW', 'p1') });
    assert('o DRAW do oponente tira 1 do deck oculto', saldo('p1') === 39 && texto('p1') === '39 cartas');
    assert('a mão do oponente ganha 1 verso e nada de identidade',
        versos('p1') === 1 && state.players.p1.zones.hand[0].definitionId === null);

    // Contagem publicada pelo servidor: o repaint das contagens leva o saldo junto.
    const mensagem = { type: 'HAND_SIZES', handSizes: { p1: 3, p2: 5 } };
    sessao.handleMessage(mensagem);
    PvpGame.atualizarContadoresDeMao(mensagem);
    assert('o saldo exibido segue o estado depois da sincronização',
        texto('p1') === `${saldo('p1')} cartas` && texto('p2') === `${saldo('p2')} cartas`);
    assert('a sincronização da mão alheia não come o deck dele',
        saldo('p1') === 39 && saldo('p2') === 49);

    // F5/reidratação: remontar as mãos redesenha as duas áreas de saque.
    window.renderHandsFromState();
    assert('reidratar a tela mantém o saldo publicado',
        texto('p1') === '39 cartas' && texto('p2') === '49 cartas');

    // Deck do oponente é segredo de conteúdo, não de tamanho: o saldo continua
    // visível, como a contagem da mão publicada pelo websocket.
    assert('o contador do deck do oponente está visível na área de saque dele',
        Boolean(el('p1')) && el('p1').closest('[data-deck="p1"]') !== null);

    console.log(`\n🧪 Resultado contagem na área de sacar (PvP): ${passed}/${passed + failed} checks`);
    console.log(failed === 0 ? '✅ os dois decks mostram o saldo correto' : `❌ ${failed} falhas\n`);
})();
