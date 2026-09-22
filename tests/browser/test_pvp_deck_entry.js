// Escolha do deck na ENTRADA da sala PvP: o bootstrap abre o seletor antes de
// qualquer socket e o HELLO só sai com o deck confirmado. O WebSocket é
// substituído por um dublê para capturar o handshake. Roda em pvp.html.
(function runPvpDeckEntryTests() {
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

    console.log('🧪 ===== TESTES DA ESCOLHA DE DECK NA ENTRADA DA SALA =====\n');

    const PvpGame = window.PvpGame;
    const DeckSelect = window.DeckSelect;
    const modal = document.getElementById('deckSelectModal');
    const botaoConfirmar = document.getElementById('deckSelectConfirm');
    if (!PvpGame || !DeckSelect || !modal || !botaoConfirmar) {
        console.error('❌ PvpGame/DeckSelect/modal ausentes em pvp.html');
        return;
    }

    // 1. A página da partida monta o seletor e ele não fecha sem escolher.
    assert('pvp.html monta o seletor de decks', modal.classList.contains('deck-select-modal'));
    assert('o seletor da entrada não fecha sem escolher (sem ×)',
        modal.querySelectorAll('.modal-close').length === 0);

    // 2. Dublê do WebSocket: o HELLO é o que prova que o deck viajou.
    const WebSocketOriginal = window.WebSocket;
    function SocketFalso() {
        this.readyState = 0;
        this.enviadas = [];
        this.ouvintes = {};
        SocketFalso.instancias.push(this);
    }
    SocketFalso.OPEN = 1;
    SocketFalso.CLOSED = 3;
    SocketFalso.instancias = [];
    SocketFalso.prototype.addEventListener = function (tipo, handler) {
        (this.ouvintes[tipo] = this.ouvintes[tipo] || []).push(handler);
    };
    SocketFalso.prototype.send = function (payload) { this.enviadas.push(payload); };
    SocketFalso.prototype.close = function () { this.readyState = 3; };
    SocketFalso.prototype.disprararOpen = function () {
        this.readyState = SocketFalso.OPEN;
        (this.ouvintes['open'] || []).forEach(handler => handler({}));
    };
    window.WebSocket = SocketFalso;

    // Sem o link da sala (`/pvp/<sala>/<assento>`) o board não boota sozinho: é o
    // caso desta página de teste, e o seletor só aparece no link real.
    assert('página sem link de sala não abre o seletor nem conecta sozinha',
        !modal.classList.contains('visible') && SocketFalso.instancias.length === 0
        && PvpGame.deckEscolhido() === null);

    // 3. Entrar na sala (link no formato de produção) abre o seletor antes de
    //    qualquer conexão.
    window.history.pushState({}, '', '/pvp/abc12345/p2');
    PvpGame.bootstrap();

    assert('entrar na sala abre o seletor antes de qualquer conexão',
        modal.classList.contains('visible') && SocketFalso.instancias.length === 0);

    const opcoes = [...document.querySelectorAll('#deckSelectGrid .deck-option')];
    const presets = window.deckCatalog?.decks || [];
    assert('a entrada oferece os presets e o deck aleatório',
        presets.length >= 3 && opcoes.length === presets.length + 1);

    // 4. Escolher um preset e confirmar: só então o socket nasce com o HELLO.
    document.querySelector('#deckSelectGrid .deck-option[data-deck="robotico"]').click();
    window.confirmarSelecaoDeDeck();

    setTimeout(() => {
        const socket = SocketFalso.instancias[0];
        assert('o socket só é aberto depois de confirmar a escolha', Boolean(socket));
        if (socket) socket.disprararOpen();

        const hello = socket ? socket.enviadas.map(texto => JSON.parse(texto))
            .find(mensagem => mensagem.type === 'HELLO') : null;
        assert('o HELLO leva o deck confirmado na entrada',
            Boolean(hello) && hello.deck === 'robotico');
        assert('o HELLO mantém sala e assento do link',
            Boolean(hello) && hello.room === 'abc12345' && hello.seat === 'p2');
        assert('PvpGame expõe o deck escolhido', PvpGame.deckEscolhido() === 'robotico');

        // 5. O deck que chega do servidor entra embaralhado, com o RNG da sala:
        //    a mesma seed dá a mesma ordem (o F5 reencontra o baralho) e seeds
        //    diferentes dão ordens diferentes (cada partida é uma partida).
        const preset = (window.deckCatalog?.decks || []).find(deck => deck.id === 'robotico');
        const definicoes = preset.cartas.map(id => ({ id }));
        const a = PvpGame.embaralharDeck(definicoes, 4242).map(carta => carta.id);
        const b = PvpGame.embaralharDeck(definicoes, 4242).map(carta => carta.id);
        const c = PvpGame.embaralharDeck(definicoes, 4243).map(carta => carta.id);

        assert('existe um unico embaralhamento no DeckBuilder',
            typeof window.DeckBuilder?.embaralhar === 'function');
        assert('o baralho embaralhado mantém exatamente as cartas do preset',
            a.length === preset.cartas.length
            && [...a].sort().join() === [...preset.cartas].sort().join());
        assert('a mesma seed da sala devolve a mesma ordem (F5)', [...a].join() === [...b].join());
        assert('seed diferente embaralha em outra ordem', [...a].join() !== [...c].join());
        assert('a ordem do servidor (JSON) não é a ordem do baralho',
            a.join() !== preset.cartas.join());

        // Limpeza: devolve o WebSocket real e a URL da página de teste.
        window.WebSocket = WebSocketOriginal;
        window.localStorage.removeItem(DeckSelect.PREFS_KEY);
        window.history.pushState({}, '', '/pvp.html');

        console.log(`\n🧪 Resultado escolha de deck na entrada: ${passed}/${passed + failed} checks`);
        console.log(failed === 0 ? '✅ cada assento escolhe o deck ao entrar na sala' : `❌ ${failed} falhas\n`);
    }, 500);
})();
