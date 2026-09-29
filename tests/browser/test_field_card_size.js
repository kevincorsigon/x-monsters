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
    // Criaturas explícitas: comprar do deck sorteado não garante 3 criaturas na mão
    // (o balanceamento tem 48–50 cartas e o tipo varia).
    [1, 2, 3].forEach(numero => {
        const criatura = Model.createCardInstance({
            id: `card_campo_${numero}`, name: `Criatura de Teste ${numero}`, type: 'criatura',
            cost: 1, attack: 5, defense: 5
        }, 'p1', { instanceId: `campo_criatura_${numero}` });
        Model.registerCard(state, criatura, 'hand', 'p1');
    });
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
    assert('a mão tem 3 criaturas prontas para invocar', criaturas.length === 3);

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

    // Espelhamento do palco por assento: os CAMPOS têm que trocar de lado junto
    // com as faixas. Sem isso, no assento p2 o campo do próprio jogador aparecia
    // em cima (onde mora o adversário) e o do adversário embaixo, colado na mão
    // local — o print "campo do player 2 do outro lado da tela".
    const palco = () => {
        const assento = document.body.dataset.seat;
        const caixa = seletor => {
            const r = document.querySelector(seletor).getBoundingClientRect();
            return { topo: r.top, base: r.bottom, altura: r.height };
        };
        return {
            assento,
            board: caixa('.board'),
            barra: caixa('.controls'),
            alheio: caixa(`#field-${assento === 'p2' ? 'p1' : 'p2'}`),
            proprio: caixa(`#field-${assento}`)
        };
    };

    const palcoP1 = palco();
    assert('no assento p1 o palco é campo alheio · barra · campo próprio',
        palcoP1.alheio.base <= palcoP1.barra.topo + 1 &&
        palcoP1.proprio.topo >= palcoP1.barra.base - 1);

    document.body.dataset.seat = 'p2';
    const palcoP2 = palco();
    assert(`no assento p2 o palco espelha (alheio ${Math.round(palcoP2.alheio.topo)}-${Math.round(palcoP2.alheio.base)}, barra ${Math.round(palcoP2.barra.topo)}-${Math.round(palcoP2.barra.base)}, próprio ${Math.round(palcoP2.proprio.topo)}-${Math.round(palcoP2.proprio.base)})`,
        palcoP2.alheio.base <= palcoP2.barra.topo + 1 &&
        palcoP2.proprio.topo >= palcoP2.barra.base - 1);
    assert('o campo próprio do assento p2 fica na metade de baixo do palco',
        palcoP2.proprio.topo > palcoP2.board.topo + palcoP2.board.altura / 2 &&
        palcoP2.alheio.base < palcoP2.board.topo + palcoP2.board.altura / 2);
    assert('o palco segue com três linhas (a barra não cai numa 4ª)',
        Math.abs(palcoP2.alheio.topo - palcoP2.board.topo) < 2 &&
        Math.abs(palcoP2.proprio.base - palcoP2.board.base) < 2);
    // Coerência com as faixas: no assento p2 a faixa de baixo é `.zone-opponent`
    // (pvp.css troca as áreas), então o campo próprio tem que ficar logo acima
    // dela — e não do outro lado da mesa.
    const faixaLocal = document.querySelector('.zone-opponent').getBoundingClientRect();
    const faixaAlheia = document.querySelector('.zone-player').getBoundingClientRect();
    assert(`o campo próprio fica colado na faixa da mão local (vão de ${Math.round(faixaLocal.top - palcoP2.proprio.base)}px)`,
        faixaLocal.top - palcoP2.proprio.base <= 20 &&
        palcoP2.alheio.topo - faixaAlheia.bottom <= 20);

    document.body.dataset.seat = 'p1';


    console.log(`\n🧪 Resultado tamanho em campo: ${passed}/${passed + failed} checks`);
    console.log(failed === 0 ? '✅ a carta invocada entra no tamanho do slot' : `❌ ${failed} falhas\n`);
})();
