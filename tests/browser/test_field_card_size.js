// Regressão: carta invocada entra no campo com o tamanho do slot, igual às
// vizinhas. O destaque de seleção (`.card.selected`) já carregou
// `transform: scale(1.1)`: o clique que antecedia o arrasto fazia a carta
// invocada medir 149x199 no campo enquanto as demais mediam 136x181.
// Roda contra pvp.html (game.js + renderers reais), sem servidor.
(function runFieldCardSizeTests() {
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

    console.log('🧪 ===== TESTES DE TAMANHO DA CARTA EM CAMPO =====\n');

    const Model = window.GameStateModel;
    const state = window.gameState;
    if (!Model || !state || !window.deckBuilder) {
        console.error('❌ Estado/decks não carregados');
        return;
    }

    const decks = window.deckBuilder.createMatchDecks(50);
    Model.resetMatchState(state, { p1: decks.player1, p2: decks.player2 }, window.gameConfig);
    document.body.dataset.seat = 'p1';
    state.currentPlayer = 'p1';
    state.currentPhase = 'invocation';
    for (let i = 0; i < 6; i++) Model.drawCard(state, 'p1');
    window.renderHandsFromState();
    window.renderPlayerStats();
    window.renderFieldsFromState();

    const drop = (cardId, targetId) => window.dropCard({
        preventDefault() {},
        stopPropagation() {},
        dataTransfer: { getData: () => cardId },
        currentTarget: document.getElementById(targetId)
    });

    // A animação de invocação (`cardPlay`, 0.5s) interpola o scale; o que
    // interessa aqui é o layout que fica depois dela passar. O `transform` da
    // classe, esse sim, não passa — é ele que a regressão precisa pegar.
    const medir = player => [...document.querySelectorAll(`#field-${player} > .card`)].map(el => {
        el.classList.remove('card-play-animation');
        el.style.animation = 'none';
        const r = el.getBoundingClientRect();
        return {
            id: el.id,
            classe: el.className,
            largura: +r.width.toFixed(1),
            altura: +r.height.toFixed(1),
            topo: +r.top.toFixed(1)
        };
    });

    const criaturas = state.players.p1.zones.hand
        .filter(carta => carta.data?.type === 'criatura')
        .sort((a, b) => (a.data.cost || 0) - (b.data.cost || 0))
        .slice(0, 3);
    assert('a mão rende 3 criaturas para invocar', criaturas.length === 3);

    criaturas.forEach(carta => {
        Model.setPlayerStat(state, 'energy', 'p1', 20, { energyCap: 20 });
        window.selectCard(carta.instanceId);   // clique do jogador antes do arrasto
        drop(carta.instanceId, 'field-p1');    // invocação: move o elemento para o campo
    });

    const noCampo = medir('p1');
    assert('as 3 criaturas estão no campo', noCampo.length === 3);
    assert('nenhuma carta no campo guarda o destaque de seleção',
        noCampo.every(carta => !carta.classe.includes('selected')));

    const base = noCampo[0];
    assert('todas as cartas do campo têm a mesma largura',
        noCampo.every(carta => Math.abs(carta.largura - base.largura) < 0.5));
    assert('todas as cartas do campo têm a mesma altura',
        noCampo.every(carta => Math.abs(carta.altura - base.altura) < 0.5));
    assert('todas as cartas do campo alinham no mesmo topo',
        noCampo.every(carta => Math.abs(carta.topo - base.topo) < 0.5));
    assert('invocar limpa o estado de seleção local',
        state.selectedCard === null);

    console.log(`\n🧪 Resultado tamanho em campo: ${passed}/${passed + failed} checks`);
    console.log(failed === 0 ? '✅ a carta invocada entra no tamanho do slot' : `❌ ${failed} falhas\n`);
})();
