// Som do fim de partida no PvM (game.html): o humano é o `p1` do `data-seat`
// (pvm-game.js), então zerar o PV do assento local toca a vinheta de derrota e
// zerar o da máquina toca a de vitória. Espia o `play()` dos <audio> reais.
(function runDefeatSoundTests() {
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

    console.log('🧪 ===== TESTES DA VINHETA DE DERROTA (PVM) =====\n');

    const Model = window.GameStateModel;
    if (!Model || typeof window.changeStat !== 'function' || typeof window.playFinishSound !== 'function') {
        console.error('❌ núcleo do jogo não carregado');
        return;
    }

    const derrota = document.getElementById('defeatSound');
    assert('game.html carrega a vinheta de derrota', Boolean(derrota));
    assert('a derrota aponta para assets/audio/defeat.wav',
        derrota?.querySelector('source')?.getAttribute('src') === 'assets/audio/defeat.wav');
    assert('a vinheta de vitória continua na página', Boolean(document.getElementById('victorySound')));
    assert('o assento local do PvM é o p1', document.body.dataset.seat === 'p1');

    const tocaram = [];
    const playOriginal = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
        tocaram.push(this.id);
        return Promise.resolve();
    };

    function zerarPv(assento) {
        window.gameOver = false;
        window.victorySoundPlayed = false;
        window.defeatSoundPlayed = false;
        tocaram.length = 0;
        Model.setPlayerStat(window.gameState, 'pv', assento, 5);
        // `changeStat` é o caminho legado do fim de partida (contador/hotseat):
        // PV 5 -> 0 dispara a vinheta do resultado na perspectiva do assento local
        window.changeStat('pv', assento, -5);
    }

    try {
        zerarPv('p1');
        assert('PV do humano zerado: toca a derrota', tocaram.includes('defeatSound'));
        assert('PV do humano zerado: não toca a vitória', !tocaram.includes('victorySound'));

        zerarPv('p2');
        assert('PV da máquina zerado: toca a vitória', tocaram.includes('victorySound'));
        assert('PV da máquina zerado: não toca a derrota', !tocaram.includes('defeatSound'));

        // Uma vinheta por partida: repetir o lado já derrotado não duplica o som
        Model.setPlayerStat(window.gameState, 'pv', 'p1', 1);
        window.gameOver = false;
        window.changeStat('pv', 'p1', -1);
        assert('a primeira derrota toca a vinheta', tocaram.includes('defeatSound'));
        tocaram.length = 0;
        window.gameOver = false;
        window.changeStat('pv', 'p1', -1);
        assert('a vinheta de derrota não repete na mesma partida', !tocaram.includes('defeatSound'));

        // PV restaurado libera a vinheta para o próximo fim
        tocaram.length = 0;
        Model.setPlayerStat(window.gameState, 'pv', 'p1', 40);
        window.changeStat('pv', 'p1', 1);
        window.changeStat('pv', 'p1', -41);
        assert('PV restaurado libera a derrota no fim seguinte', tocaram.includes('defeatSound'));
    } finally {
        HTMLMediaElement.prototype.play = playOriginal;
    }

    console.log(`\n🧪 Resultado vinheta de derrota: ${passed}/${passed + failed} checks`);
    console.log(failed === 0 ? '✅ o perdedor ouve a derrota no PvM' : `❌ ${failed} falhas\n`);
})();
