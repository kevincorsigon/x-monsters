// Overlay de fim de partida no PvP: aparece sobre o tabuleiro, diz quem venceu
// e devolve o jogador ao lobby. O `body` tem `overflow: hidden` e o tabuleiro
// ocupa 100dvh: sem `position: fixed` o overlay era criado no DOM mas nascia
// fora da janela ("não aparecia"). Roda contra pvp.html, sem servidor.
(function runPvpGameOverTests() {
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

    console.log('🧪 ===== TESTES DO FIM DE PARTIDA NO PVP =====\n');

    const PvpGame = window.PvpGame;
    const SessionClass = window.PvpSession?.PvpSession;
    const Model = window.GameStateModel;
    if (!PvpGame || !SessionClass || !Model || !window.deckBuilder) {
        console.error('❌ Ponte PvP/estado/decks não carregados');
        return;
    }

    const decks = window.deckBuilder.createMatchDecks(50);
    const sessao = new SessionClass({
        transportSend: () => {},
        gameState: window.gameState,
        seat: 'p2',
        applyCommand: () => {},
        onEvent: () => {}
    });
    PvpGame.setSession(sessao);

    const abertura = {
        type: 'MATCH_START',
        seat: 'p2',
        opponentSeat: 'p1',
        seed: 4242,
        deck: decks.player2,
        opponentDeckSize: 50,
        config: { initialPv: 200, initialEnergy: 6 },
        state: { maos: { p1: 4, p2: 4 }, assentos: {} }
    };

    // 1. Partida em andamento: nenhum overlay na tela.
    PvpGame.montarPartida({ ...abertura });
    assert('partida em andamento não tem overlay',
        document.getElementById('pvp-game-over') === null);

    // 2. GAME_OVER do servidor: overlay visível, com o vencedor e o lobby.
    PvpGame.tratarFimDePartida({ winner: 'p1', reason: 'pv-zero', turn: 12 });

    const overlay = document.getElementById('pvp-game-over');
    assert('o overlay existe no DOM', Boolean(overlay));
    if (!overlay) {
        console.log(`\n🧪 Resultado fim de partida: ${passed}/${passed + failed} checks`);
        return;
    }

    const estilo = getComputedStyle(overlay);
    assert('o overlay é fixo (não nasce fora da janela)', estilo.position === 'fixed');

    const caixa = overlay.getBoundingClientRect();
    assert('o overlay cobre a viewport',
        caixa.width >= window.innerWidth - 1 && caixa.height >= window.innerHeight - 1);
    assert('o overlay começa no canto da janela', caixa.top <= 0.5 && caixa.left <= 0.5);
    assert('o overlay fica acima do tabuleiro', Number(estilo.zIndex) >= 1000);

    assert('o overlay diz quem venceu', overlay.textContent.includes('Jogador 1 venceu!'));
    assert('o overlay fala na perspectiva do assento (p2 perdeu)',
        overlay.textContent.includes('Você perdeu a partida.'));
    assert('o overlay mostra sala/turno/motivo',
        overlay.textContent.includes('turno 12') && overlay.textContent.includes('pv-zero'));

    const cta = overlay.querySelector('a.pvp-primary-link');
    assert('o overlay tem o botão de voltar ao lobby', Boolean(cta));
    assert('o botão aponta para o lobby (/pvp)', cta?.getAttribute('href') === '/pvp');
    assert('o botão do lobby não é um <button> desabilitado', cta?.tagName === 'A' && !cta.disabled);
    assert('o botão do lobby está visível',
        Boolean(cta) && cta.getBoundingClientRect().width > 0 && getComputedStyle(cta).display !== 'none');

    // 3. F5 numa sala já finalizada: o MATCH_START traz `resultado` e o overlay
    // volta sem esperar um GAME_OVER novo (que não vem).
    overlay.remove();
    PvpGame.montarPartida({ ...abertura, state: { ...abertura.state, resultado: { winner: 'p2', reason: 'pv-zero', turn: 9 } } });

    const overlayReconexao = document.getElementById('pvp-game-over');
    assert('o F5 numa sala finalizada ressuscita o overlay', Boolean(overlayReconexao));
    assert('o overlay da reconexão traz o vencedor do servidor',
        Boolean(overlayReconexao?.textContent.includes('Jogador 2 venceu!')));
    assert('o overlay da reconexão mantém o botão do lobby',
        overlayReconexao?.querySelector('a.pvp-primary-link')?.getAttribute('href') === '/pvp');

    console.log(`\n🧪 Resultado fim de partida: ${passed}/${passed + failed} checks`);
    console.log(failed === 0 ? '✅ o fim de partida aparece e oferece o lobby' : `❌ ${failed} falhas\n`);
})();
