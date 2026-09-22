// F5 numa partida em andamento: o bootstrap consulta o status da sala e NÃO
// reabre o seletor de decks — conecta direto e o HELLO sai sem deck (o servidor
// já resolveu). Roda em pvp.html com fetch e WebSocket dublados.
(function runPvpReconnectTests() {
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

    console.log('🧪 ===== TESTES DO F5 NUMA PARTIDA EM ANDAMENTO =====\n');

    const PvpGame = window.PvpGame;
    const modal = document.getElementById('deckSelectModal');
    if (!PvpGame || !modal) {
        console.error('❌ PvpGame/modal ausentes em pvp.html');
        return;
    }

    // Dublês: sala "playing" no GET e um WebSocket que captura o HELLO.
    const fetchOriginal = window.fetch;
    const WebSocketOriginal = window.WebSocket;
    window.fetch = async () => ({ ok: true, json: async () => ({ status: 'playing', resultado: null }) });

    function SocketFalso() {
        this.readyState = 0;
        this.enviadas = [];
        this.ouvintes = {};
        SocketFalso.instancias.push(this);
    }
    SocketFalso.OPEN = 1;
    SocketFalso.instancias = [];
    SocketFalso.prototype.addEventListener = function (tipo, handler) {
        (this.ouvintes[tipo] = this.ouvintes[tipo] || []).push(handler);
    };
    SocketFalso.prototype.send = function (payload) { this.enviadas.push(payload); };
    SocketFalso.prototype.disprararOpen = function () {
        this.readyState = SocketFalso.OPEN;
        (this.ouvintes['open'] || []).forEach(handler => handler({}));
    };
    window.WebSocket = SocketFalso;

    window.history.pushState({}, '', '/pvp/abc12345/p2');
    PvpGame.bootstrap();

    setTimeout(() => {
        const socket = SocketFalso.instancias[0];
        assert('o seletor de decks NÃO reabre num F5 de partida em andamento',
            !modal.classList.contains('visible'));
        assert('o socket conecta direto, sem esperar escolha', Boolean(socket));
        if (socket) socket.disprararOpen();

        const hello = socket ? socket.enviadas.map(t => JSON.parse(t))
            .find(m => m.type === 'HELLO') : null;
        assert('o HELLO sai sem deck (o servidor já resolveu)',
            Boolean(hello) && (hello.deck === null || hello.deck === undefined));
        assert('o HELLO mantém sala e assento do link',
            Boolean(hello) && hello.room === 'abc12345' && hello.seat === 'p2');

        // Limpeza: devolve fetch/WebSocket reais e a URL da página de teste.
        window.fetch = fetchOriginal;
        window.WebSocket = WebSocketOriginal;
        window.history.pushState({}, '', '/pvp.html');

        console.log(`\n🧪 Resultado F5 em andamento: ${passed}/${passed + failed} checks`);
        console.log(failed === 0 ? '✅ F5 reconecta sem refazer a escolha de deck' : `❌ ${failed} falhas\n`);
    }, 500);
})();
