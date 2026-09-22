// Relógio de turno (45s): o contador vive no painel central, reinicia a cada
// virada e — no hotseat — passa a vez sozinho quando estoura. Em PvP quem passa a
// vez é o servidor; aqui só se verifica o contador. Roda contra game.html.
(function runTurnTimerTests() {
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

    console.log('🧪 ===== TESTES DO RELÓGIO DE TURNO (45s) =====\n');

    const contador = document.getElementById('turn-timer');
    if (!contador || !window.reiniciarTempoDeTurno) {
        console.error('❌ Contador de turno ausente no game.html');
        return;
    }

    const segundosDoContador = () => parseInt((contador.textContent || '').replace(/[^0-9]/g, ''), 10);
    const estado = window.gameState;

    // 1. Estado de partida nova: 45s no painel e o limite no gameConfig.
    assert('o gameConfig expõe o limite de 45s', window.gameConfig.turnSeconds === 45);
    window.reiniciarTempoDeTurno();
    assert('o contador começa no limite do turno', segundosDoContador() === 45);
    assert('o contador não está em alerta no começo',
        !contador.classList.contains('turn-timer-warning')
        && !contador.classList.contains('turn-timer-over'));

    // 2. O relógio anda de verdade e avisa nos últimos 10s.
    window.reiniciarTempoDeTurno(9);
    assert('o contador entra em alerta nos últimos 10s',
        contador.classList.contains('turn-timer-warning'));

    setTimeout(() => {
        const decorrido = segundosDoContador();
        assert(`o contador decrementa (${decorrido}s depois de 9s)`, decorrido <= 8 && decorrido >= 5);

        // 3. Zerar passa a vez sozinho no hotseat.
        const jogadorAntes = estado.currentPlayer;
        const turnoAntes = estado.turn;
        window.reiniciarTempoDeTurno(1);
        // Pinta o "0s" no primeiro tick para o estado de alerta ser observável.
        window.pintaContadorDeTurno(0);
        assert('com 0s o contador fica marcado como estourado',
            contador.classList.contains('turn-timer-over'));

        setTimeout(() => {
            assert('o turno virou sozinho ao estourar o tempo',
                estado.currentPlayer !== jogadorAntes && estado.turn === turnoAntes + 1);
            assert('a vez passou para o outro assento',
                estado.currentPlayer === (jogadorAntes === 'p1' ? 'p2' : 'p1'));
            assert('o contador do novo turno volta ao limite',
                segundosDoContador() === 45 && !contador.classList.contains('turn-timer-over'));

            // 4. Limite desligado (0) não deixa contador ativo.
            window.reiniciarTempoDeTurno(0);
            assert('sem limite o contador é neutralizado', contador.textContent.trim() === '--');
            const turnoCongelado = estado.turn;
            setTimeout(() => {
                assert('com o relógio desligado o turno não vira sozinho',
                    estado.turn === turnoCongelado);

                // Devolve o relógio ligado para não afetar outra verificação.
                window.reiniciarTempoDeTurno();
                console.log(`\n🧪 Resultado relógio de turno: ${passed}/${passed + failed} checks`);
                console.log(failed === 0 ? '✅ o turno tem limite e passa sozinho' : `❌ ${failed} falhas\n`);
            }, 1400);
        }, 1700);
    }, 1300);
})();
