(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    root.PvpGame = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    /**
     * Bootstrap da partida PvP.
     * - Detecta assento pela URL (`/pvp/<room>/<seat>`)
     * - Define data-seat no container
     * - Instancia PvpSession
     * - Configura interceptors nos handlers de game.js
     */
    const { PvpProtocol } = typeof window !== 'undefined' ? window : globalThis;
    const { PvpSession } = typeof window !== 'undefined' ? window : globalThis;
    const { PvpState } = typeof window !== 'undefined' ? window : globalThis;
    const gameState = window.gameState;

    function getSeatFromUrl() {
        const parts = location.pathname.split('/');
        const seat = parts[parts.length - 1];
        return seat === 'p1' || seat === 'p2' ? seat : null;
    }

    const localSeat = getSeatFromUrl();
    if (!localSeat) {
        console.warn('Assento PvP não identificado na URL');
        return;
    }
    const opponentSeat = localSeat === 'p1' ? 'p2' : 'p1';

    // Espelhe UI quando p2
    if (localSeat === 'p2') {
        document.body.setAttribute('data-seat', 'p2');
    }

    // Disable opponent controls
    function disableOpponentControls() {
        // editName, editStatValue, showDeckInfo for opponent
        const disabledSelectors = [
            `button[onclick="editName('\\${opponentSeat}')"]`,
            `button[onclick="editStatValue('pv', '\\${opponentSeat}')"]`,
            `button[onclick="editStatValue('energy', '\\${opponentSeat}')"]`,
            `button[onclick="showDeckInfo()"]` // deck info global
        ];
        disabledSelectors.forEach(sel => {
            const el = document.querySelector(sel);
            if (el) el.disabled = true;
        });
    }
    disableOpponentControls();

    // Update opponent hand title with count
    function updateOpponentHandTitle() {
        const count = gameState.cards[opponentSeat].hand.length;
        const title = document.getElementById(`hand-title-${opponentSeat}`);
        if (title) title.innerText = `Mão - Jogador ${opponentSeat.toUpperCase()} (${count})`;
    }
    updateOpponentHandTitle();

    // Instantiate session (stub transport using console)
    // WebSocket transport – placeholder URL
    const socket = new WebSocket('ws://localhost:8080');
    socket.binaryType = 'arraybuffer';
    socket.onopen = () => console.log('PvP socket conectado');
    socket.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            session.handleMessage(msg);
        } catch (e) {
            console.warn('Falha ao parsear mensagem do PvP', e);
        }
    };
    socket.onerror = (e) => console.warn('PvP socket erro', e);

    const session = new PvpSession({
        transportSend: (msg) => {
            socket.send(JSON.stringify(msg));
        },
        transportOnMessage: (cb) => { /* not used in this simplified client */ },
        gameState: gameState
    });
    window.PvpSession = session;

    // Guard hook into game.js handlers
    const intercept = (cmdObj) => {
        session.sendCommand(cmdObj.cmd, cmdObj.args);
        return true;
    };
    if (window.PvpSession) {
        window.PvpSession.intercept = intercept;
    }
});