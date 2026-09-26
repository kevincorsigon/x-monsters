// Vinheta do fim de partida no PvP: quem ganha ouve `victorySound` e quem
// perde, `defeatSound`. A decisão vem do assento local (bootstrap/`setSeat`) e
// do `winner` (p1/p2) publicado pelo servidor no GAME_OVER.
(function runPvpDefeatSoundTests() {
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

    console.log('🧪 ===== TESTES DA VINHETA DE DERROTA NO PVP =====\n');

    const PvpGame = window.PvpGame;
    if (!PvpGame || typeof PvpGame.tratarFimDePartida !== 'function') {
        console.error('❌ PvpGame não carregado');
        return;
    }

    const derrota = document.getElementById('defeatSound');
    assert('pvp.html carrega a vinheta de derrota', Boolean(derrota));
    assert('a derrota aponta para assets/audio/defeat.wav',
        derrota?.querySelector('source')?.getAttribute('src') === 'assets/audio/defeat.wav');
    assert('a vinheta de vitória continua na página', Boolean(document.getElementById('victorySound')));

    const tocaram = [];
    const playOriginal = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
        tocaram.push(this.id);
        return Promise.resolve();
    };

    function fimDePartida(assento, winner) {
        PvpGame.setSeat(assento);
        document.body.dataset.seat = assento;
        window.victorySoundPlayed = false;
        window.defeatSoundPlayed = false;
        document.querySelectorAll('#pvp-game-over').forEach(el => el.remove());
        tocaram.length = 0;
        PvpGame.tratarFimDePartida({ winner, reason: 'pv-zero', turn: 3 });
    }

    try {
        fimDePartida('p2', 'p1');
        assert('p2 perdeu: toca a derrota', tocaram.includes('defeatSound'));
        assert('p2 perdeu: não toca a vitória', !tocaram.includes('victorySound'));

        fimDePartida('p2', 'p2');
        assert('p2 venceu: toca a vitória', tocaram.includes('victorySound'));
        assert('p2 venceu: não toca a derrota', !tocaram.includes('defeatSound'));

        fimDePartida('p1', 'p2');
        assert('p1 perdeu: toca a derrota', tocaram.includes('defeatSound'));

        fimDePartida('p1', 'p1');
        assert('p1 venceu: toca a vitória', tocaram.includes('victorySound'));
    } finally {
        HTMLMediaElement.prototype.play = playOriginal;
    }

    console.log(`\n🧪 Resultado vinheta de derrota no PvP: ${passed}/${passed + failed} checks`);
    console.log(failed === 0 ? '✅ cada lado ouve a vinheta do seu resultado' : `❌ ${failed} falhas\n`);
})();
