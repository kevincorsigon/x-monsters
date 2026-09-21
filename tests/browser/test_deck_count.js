// Contagem restante na área de saque (hotseat): o número exibido é o saldo da
// zona `deck` do estado — repintado na compra, no reset e no repaint geral.
// Roda contra game.html (game.js real), sem servidor.
(function runDeckCountTests() {
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

    console.log('🧪 ===== TESTES DE CONTAGEM NA ÁREA DE SACAR (hotseat) =====\n');

    const Model = window.GameStateModel;
    const state = window.gameState;
    if (!Model || !state) {
        console.error('❌ Estado do jogo não carregado');
        return;
    }

    const el = player => document.getElementById(`deck-count-${player}`);
    const saldo = player => state.players[player].zones.deck.length;
    const texto = player => (el(player)?.textContent || '').trim();
    const mao = player => state.players[player].zones.hand.length;

    // Boot do game.html: `startNewMatch` distribui 5 cartas por lado e o
    // `initFirstTurn` compra mais 1 para quem abre (p1). O deck balanceado tem
    // 48–50 cartas (o pool é sorteado), então o invariante é a distribuição, não
    // um total fixo de 50.
    const totalDoBoot = player => saldo(player) + mao(player);
    assert('as duas áreas de saque têm contador', Boolean(el('p1')) && Boolean(el('p2')));
    assert('o rótulo de p1 é o saldo do deck', texto('p1') === `${saldo('p1')} cartas`);
    assert('o rótulo de p2 é o saldo do deck', texto('p2') === `${saldo('p2')} cartas`);
    assert('o boot deixa 5 cartas por lado (+1 compra para quem abre) e o resto no deck',
        mao('p2') === 5 && mao('p1') === 6
        && totalDoBoot('p1') >= 45 && totalDoBoot('p1') <= 50
        && totalDoBoot('p2') >= 45 && totalDoBoot('p2') <= 50);
    assert('o saldo também vai no data-count',
        el('p1').getAttribute('data-count') === String(saldo('p1')));

    // Compra pelo clique na área de saque: -1 no deck, +1 na mão.
    const saldoAntes = saldo('p1');
    const maoAntes = mao('p1');
    assert('a mão local ainda tem espaço para comprar', maoAntes < Model.HAND_LIMIT);
    window.addCardToHand('p1');
    assert('comprar tira 1 do deck (rótulo e estado)',
        saldo('p1') === saldoAntes - 1 && texto('p1') === `${saldoAntes - 1} cartas`);
    assert('comprar põe 1 carta na mão', mao('p1') === maoAntes + 1);
    assert('a compra local não mexe no deck do oponente', texto('p2') === `${saldo('p2')} cartas`);

    // Efeito que puxa do deck sem passar pelo renderer da mão (Zol): quem mantém
    // o saldo exibido fiel é o repaint geral (`updateUI`).
    state.players.p1.zones.deck.pop();
    window.updateUI();
    assert('updateUI repinta o saldo do deck', texto('p1') === `${saldo('p1')} cartas`);

    // Deck vazio: zero no rótulo, alerta visual ligado e nenhuma compra.
    const guardadas = state.players.p1.zones.deck.splice(0);
    window.updateDeckCounter('p1');
    assert('deck vazio exibe "0 cartas"', texto('p1') === '0 cartas');
    assert('deck vazio liga o alerta visual', el('p1').getAttribute('data-empty') === '1');
    const maoComDeckVazio = mao('p1');
    window.addCardToHand('p1');
    assert('com o deck vazio o clique não compra',
        texto('p1') === '0 cartas' && mao('p1') === maoComDeckVazio);

    // Devolver as cartas volta o rótulo (e desliga o alerta).
    state.players.p1.zones.deck.push(...guardadas);
    window.updateDeckCounter('p1');
    assert('restaurar o deck volta o saldo ao rótulo', texto('p1') === `${saldo('p1')} cartas`);
    assert('deck com cartas desliga o alerta', el('p1').getAttribute('data-empty') === '0');

    // Nova partida: o reset redesenha as mãos e a área de saque junto.
    window.resetGame();
    assert('nova partida devolve o saldo ao rótulo e a mão inicial',
        texto('p1') === `${saldo('p1')} cartas` && texto('p2') === `${saldo('p2')} cartas`
        && mao('p1') === 6 && mao('p2') === 5);

    // O rótulo mora dentro da caixa do deck (que tem o tamanho do slot): não pode
    // estourar a área nem sair do enquadramento.
    ['p1', 'p2'].forEach(player => {
        const area = el(player).closest('.player1-deck, .player2-deck');
        const caixa = area.getBoundingClientRect();
        const rotulo = el(player).getBoundingClientRect();
        const estilo = getComputedStyle(el(player));

        assert(`o contador de ${player} fica dentro da área de saque`,
            rotulo.top >= caixa.top - 0.5 && rotulo.bottom <= caixa.bottom + 0.5);
        assert(`o contador de ${player} não estoura a caixa do deck`,
            area.scrollHeight <= area.clientHeight + 1);
        assert(`o contador de ${player} usa o estilo .deck-count`,
            estilo.fontSize === '10px');
    });

    console.log(`\n🧪 Resultado contagem na área de sacar: ${passed}/${passed + failed} checks`);
    console.log(failed === 0 ? '✅ a área de saque mostra as cartas restantes' : `❌ ${failed} falhas\n`);
})();
