/**
 * pvp-game.js - Bootstrap da partida PvP (spec parte 4).
 *
 * Papel deste arquivo:
 *   - ler o assento pela URL (`/pvp/<roomId>/<p1|p2>`) e espelhar a perspectiva;
 *   - abrir o WebSocket, fazer o handshake `HELLO` e manter a sessão
 *     (`window.PvpSession`) ligada na UI existente de `src/js/game.js`;
 *   - aplicar cada comando do ledger no motor local (o autor também aplica pelo
 *     broadcast do servidor, nunca por conta própria);
 *   - manter a mão do oponente como contagem + verso, sem identidade.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    root.PvpGame = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const TOKEN_KEY_PREFIX = 'xmPvpToken:';
    const DECK_SIZE = 40;

    let seatLocal = null;
    let roomIdLocal = null;
    let session = null;
    let socket = null;
    let estadoDaPartida = 'conectando';

    /**
     * Extrai o assento do path `/pvp/<roomId>/<seat>`.
     */
    function parseSeat(pathname) {
        const parts = String(pathname || '').split('/').filter(Boolean);
        if (parts.length < 3 || parts[0] !== 'pvp') return null;
        const assento = parts[2];
        return assento === 'p1' || assento === 'p2' ? assento : null;
    }

    function parseRoomId(pathname) {
        const parts = String(pathname || '').split('/').filter(Boolean);
        return parts[0] === 'pvp' && parts[1] ? parts[1] : null;
    }

    function outroAssento(seat) {
        return seat === 'p1' ? 'p2' : 'p1';
    }

    const api = {
        parseSeat,
        parseRoomId,
        applyCommand,
        bootstrap,
        getSeat: () => seatLocal,
        getRoomId: () => roomIdLocal,
        getSession: () => session
    };

// ── aplicação dos comandos do ledger ─────────────────────────────────────

    /**
     * Aplica um comando já ordenado pela sessão. Roda com
     * `PvpSession.isApplying() === true`, então as guardas de `game.js` deixam o
     * corpo dos handlers executar (nenhum comando é reenviado ao servidor).
     */
    function applyCommand(entry) {
        const state = window.gameState;
        if (!state || !entry || !entry.cmd) return;

        // Revelação primeiro: a carta oculta vira instância real no mesmo slot.
        if (Array.isArray(entry.reveals) && entry.reveals.length > 0) {
            window.PvpState?.applyReveals(state, entry.reveals);
        }

        switch (entry.cmd) {
            case 'DRAW':
                aplicarCompra(entry);
                return;
            case 'SUMMON':
                aplicarInvocacao(entry);
                return;
            case 'SET_PHASE':
                window.setPhase?.(entry.args.phase);
                return;
            case 'END_TURN':
                window.endTurn?.();
                return;
            case 'EQUIP':
                window.renderHandsFromState?.();
                window.equipSupportCard?.(entry.args.cardId, entry.args.creatureId);
                return;
            case 'ATTACK':
                window.renderFieldsFromState?.();
                window.performAttack?.(entry.args.attackerId, entry.args.targetId);
                return;
            case 'DIRECT_ATTACK':
                state.attackingCard = entry.args.attackerId;
                window.directAttack?.();
                return;
            case 'DESTROY':
                window.destroyCard?.(entry.args.cardId);
                return;
            case 'ABILITY':
                aplicarHabilidade(entry);
                return;
            case 'ROLL_DICE':
                window.rollDice?.(entry.actor, entry.args.value);
                return;
            case 'SET_NAME':
                window.GameStateModel.setPlayerName(state, entry.actor, entry.args.name);
                atualizarNomeNaTela(entry.actor, entry.args.name);
                window.renderHandsFromState?.();
                return;
            case 'CHOICE':
                window.gameEngine?.resolveChoice?.(entry.args.choiceId, entry.args.selection);
                window.renderFieldsFromState?.();
                window.updateUI?.();
                return;
            default:
                console.warn('pvp-game: comando sem aplicador —', entry.cmd);
        }
    }

    function aplicarCompra(entry) {
        const player = entry.actor;
        if (player === seatLocal) {
            window.addCardToHand?.(player);
            return;
        }
        // Mão alheia: só a contagem avança (o placeholder anda de deck para mão).
        window.GameStateModel.drawCard(window.gameState, player);
        window.renderHandsFromState?.();
    }

    function aplicarInvocacao(entry) {
        const owner = entry.actor;
        const reveal = (entry.reveals || []).find(
            item => item.ownerId === owner && item.fromZone === 'hand' && item.slot === entry.args.handSlot
        );
        const cardId = entry.args.cardId || reveal?.instanceId;
        if (!cardId) {
            console.warn('pvp-game: SUMMON sem reveal para o slot', entry.args.handSlot);
            return;
        }

        // Garante o DOM da carta revelada antes de reusar o handler de drop.
        window.renderHandsFromState?.();

        const campo = document.getElementById(`field-${owner}`);
        const carta = document.getElementById(cardId);
        if (!campo || !carta) {
            console.warn('pvp-game: SUMMON sem elemento de campo/carta para', cardId);
            return;
        }

        // Mesmo caminho da UI local: nada de lógica de invocação duplicada.
        window.dropCard?.({
            preventDefault() {},
            stopPropagation() {},
            dataTransfer: { getData: () => cardId },
            currentTarget: campo
        });
    }

    function aplicarHabilidade(entry) {
        const cardId = entry.args.cardId;
        const definitionId = window.gameState.cardInstances[cardId]?.definitionId;
        const rule = window.CardRules?.getActivatedRule(definitionId);
        if (!rule || typeof window.applyMigratedAbilityLocally !== 'function') {
            console.warn('pvp-game: ABILITY sem regra para', definitionId);
            return;
        }
        window.renderFieldsFromState?.();
        window.applyMigratedAbilityLocally(rule, cardId, entry.args.targetIds || [], null);
    }

    function atualizarNomeNaTela(playerId, nome) {
        const classe = playerId === 'p1' ? '.player1-stats' : '.player2-stats';
        const elemento = document.querySelector(`${classe} .player-name`);
        if (elemento) elemento.innerText = nome;
    }

// ── transporte, sessão e UI ──────────────────────────────────────────────

    function webSocketUrl() {
        const protocolo = location.protocol === 'https:' ? 'wss' : 'ws';
        return `${protocolo}://${location.host}/ws`;
    }

    function bootstrap() {
        if (typeof document === 'undefined' || typeof WebSocket === 'undefined') return null;

        seatLocal = parseSeat(location.pathname);
        roomIdLocal = parseRoomId(location.pathname);
        if (!seatLocal || !roomIdLocal) {
            console.warn('pvp-game: assento PvP não identificado na URL');
            return null;
        }

        marcarAssento();
        restringirFuncoesGlobais(seatLocal);

        socket = new WebSocket(webSocketUrl());
        socket.addEventListener('open', enviarHello);
        socket.addEventListener('message', receberMensagem);
        socket.addEventListener('close', () => {
            estadoDaPartida = 'desconectado';
            atualizarBadges('reconectando…');
        });
        socket.addEventListener('error', () => {
            estadoDaPartida = 'erro';
            atualizarBadges('falha de conexão');
        });

        session = new window.PvpSession({
            transportSend: (mensagem) => {
                if (socket && socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify(mensagem));
                }
            },
            gameState: window.gameState,
            seat: seatLocal,
            applyCommand: aplicarComandoDoLedger,
            onEvent: tratarEventoDeSessao,
            onGameOver: tratarFimDePartida
        });
        // O construtor de PvpSession registra a instancia em PvpSession.current;
        // window.PvpSession segue sendo a classe (new + metodos estaticos).

        atualizarBadges('conectando…');
        return session;
    }

    function enviarHello() {
        const token = window.sessionStorage?.getItem(TOKEN_KEY_PREFIX + roomIdLocal) || null;
        socket.send(JSON.stringify({
            type: 'HELLO',
            room: roomIdLocal,
            seat: seatLocal,
            token
        }));
        atualizarBadges('aguardando o oponente…');
    }

    function receberMensagem(evento) {
        let mensagem;
        try {
            mensagem = JSON.parse(evento.data);
        } catch (error) {
            console.warn('pvp-game: mensagem inválida do servidor', error);
            return;
        }

        // Sincronização primeiro (COMMAND, COMMAND_LOG, DICE_RESULT, STATE_HASH…).
        session.handleMessage(mensagem);

        switch (mensagem.type) {
            case 'ROOM_STATE':
                tratarEstadoDaSala(mensagem);
                break;
            case 'MATCH_START':
                montarPartida(mensagem);
                break;
            case 'OPPONENT':
                atualizarBadges(mensagem.conectado ? 'oponente conectado' : 'oponente desconectado');
                break;
            case 'ERROR':
                estadoDaPartida = 'erro';
                avisar(mensagem.reason || 'Erro do servidor');
                atualizarBadges(mensagem.reason || 'erro');
                break;
            case 'PONG':
            case 'GAME_OVER':
            case 'COMMAND':
            case 'COMMAND_LOG':
            case 'DICE_RESULT':
            case 'STATE_HASH':
            case 'REJECTED':
                break;
            default:
                console.warn('pvp-game: mensagem desconhecida', mensagem.type);
        }
    }

    function tratarEstadoDaSala(mensagem) {
        if (mensagem.token) {
            try {
                window.sessionStorage?.setItem(TOKEN_KEY_PREFIX + roomIdLocal, mensagem.token);
            } catch (error) {
                console.warn('pvp-game: sessionStorage indisponível', error);
            }
        }
        const conectados = ['p1', 'p2']
            .filter(assento => mensagem.state?.assentos?.[assento]?.conectado)
            .length;
        atualizarBadges(conectados === 2 ? 'em partida' : `aguardando o oponente (${conectados}/2)`);
    }

    /**
     * Monta a partida a partir do MATCH_START: reset do estado canônico com o id
     * opaco, mão do oponente só como contagem e render inicial.
     */
    function montarPartida(mensagem) {
        const assento = mensagem.seat || seatLocal;
        const oponente = mensagem.opponentSeat || outroAssento(assento);
        seatLocal = assento;

        const decksPrivados = Array.isArray(mensagem.deck) && mensagem.deck.length > 0
            ? mensagem.deck
            : gerarDeckLocal(mensagem.seed, assento);
        const tamanhoDeckOculto = Number(mensagem.opponentDeckSize ?? DECK_SIZE);
        window.__gameOverEnviado = false;

        window.GameStateModel.resetMatchState(
            window.gameState,
            { [assento]: decksPrivados, [oponente]: [] },
            {
                idFactory: window.PvpState.createPvpIdFactory(mensagem.seed),
                initialPv: mensagem.config?.initialPv,
                initialEnergy: mensagem.config?.initialEnergy
            }
        );
        window.PvpState.installHiddenZones(window.gameState, oponente, {
            deck: tamanhoDeckOculto,
            hand: 0
        });

        session.setSeat(assento);
        session.setState(window.gameState);
        session.resetLog();
        window.__pvpPartidaMontada = true;

        marcarAssento();
        estadoDaPartida = 'em partida';
        atualizarBadges('em partida');
        window.renderHandsFromState?.();
        window.renderPlayerStats?.();
        window.updateUI?.();
        restringirFuncoesGlobais(assento);
        atualizarBloqueioPorTurno();
    }

// ── deck privado, badges e restrições de UI ──────────────────────────────

    /**
     * Deck privado do assento local, gerado da seed do servidor.
     * O servidor só envia a seed; o cliente monta o deck com o mesmo
     * `DeckBuilder` determinístico usado pelo `scripts/deck_factory.js`.
     */
    function gerarDeckLocal(seed, assento) {
        if (!window.DeckBuilder || !window.cardsDatabase || !Number.isFinite(Number(seed))) {
            console.warn('pvp-game: sem DeckBuilder/seed para montar o deck privado');
            return [];
        }
        const rng = window.DeckFactory?.mulberry32
            ? window.DeckFactory.mulberry32(seed)
            : mulberry32(seed);
        const builder = new window.DeckBuilder(window.cardsDatabase, { rng });
        const decks = builder.createMatchDecks(DECK_SIZE);
        return assento === 'p1' ? decks.player1 : decks.player2;
    }

    function mulberry32(seed) {
        let a = seed >>> 0;
        return function () {
            a |= 0;
            a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function marcarAssento() {
        const container = document.querySelector('.game-container') || document.body;
        container.dataset.seat = seatLocal;
        document.body.dataset.seat = seatLocal;
    }

    function atualizarBadges(texto) {
        const badge = document.getElementById('pvp-status');
        if (badge) badge.textContent = texto;
    }

    function avisar(mensagem) {
        if (typeof window.showMessage === 'function') {
            window.showMessage(mensagem, 'warning');
            return;
        }
        console.warn('pvp-game:', mensagem);
    }

    /**
     * Bloqueia as funções que só fazem sentido no hotseat: editar nome/stats do
     * oponente e espiar a mão alheia (spec parte 4, DoD 2).
     */
    function restringirFuncoesGlobais(assento) {
        const oponente = outroAssento(assento);

        desabilitarBotaoDoOponente('editName', oponente);
        desabilitarBotaoDoOponente('editStatValue', 'pv', oponente);
        desabilitarBotaoDoOponente('editStatValue', 'energy', oponente);

        const espiarOponente = document.querySelector(`.player${oponente === 'p1' ? '1' : '2'}-hand .peek-hand-btn`);
        if (espiarOponente) {
            espiarOponente.remove();
        }

        // Preferências globais continuam válidas, mas só para o próprio deck.
        const infoDeck = document.getElementById('deck-info-btn');
        if (infoDeck) infoDeck.remove();
    }

    function desabilitarBotaoDoOponente(funcao, ...args) {
        const assinatura = args.map(valor => `'${valor}'`).join(', ');
        const seletor = `button[onclick="${funcao}(${assinatura})"]`;
        const elemento = document.querySelector(seletor);
        if (elemento) {
            elemento.disabled = true;
            elemento.title = 'Ação indisponível no modo PvP';
        }
    }

    /** Habilita a interação só quando é o turno local e a partida está viva. */
    function atualizarBloqueioPorTurno() {
        const state = window.gameState;
        if (!state || !seatLocal) return;
        const ehMeuTurno = state.currentPlayer === seatLocal;
        const interagindo = ehMeuTurno && !window.gameOver;

        document.querySelectorAll('.phase-button, .dice-button, .action-button').forEach(botao => {
            botao.disabled = !interagindo;
        });

        const aviso = document.getElementById('pvp-turno');
        if (aviso) {
            aviso.textContent = ehMeuTurno ? 'Sua vez' : 'Vez do oponente';
            aviso.classList.toggle('pvp-turno-ativo', ehMeuTurno);
        }
    }

// ── fim de partida, revelações e bootstrap automático ────────────────────

    /**
     * Monta o `reveal` de uma carta que sai da mão: identidade + slot, para que o
     * outro cliente saiba exatamente qual placeholder substituir.
     */
    function buildReveal(cardId, fromZone) {
        const state = window.gameState;
        const instancia = state?.cardInstances?.[cardId];
        if (!instancia) return null;
        const zona = fromZone || instancia.zone;
        const lista = state.players?.[instancia.ownerId]?.zones?.[zona];
        const slot = Array.isArray(lista)
            ? lista.findIndex(carta => carta && carta.instanceId === cardId)
            : -1;
        if (slot === -1) return null;
        return {
            instanceId: cardId,
            definitionId: instancia.definitionId,
            ownerId: instancia.ownerId,
            fromZone: zona,
            slot
        };
    }

    /**
     * Reação aos avisos da sessão (recusa, divergência, resync).
     */
    function tratarEventoDeSessao(evento) {
        if (!evento) return;
        switch (evento.type) {
            case 'REJECTED':
                avisar(`Jogada recusada: ${evento.reason || evento.cmd}`);
                break;
            case 'INVALID':
                avisar(`Comando inválido: ${evento.reason}`);
                break;
            case 'DIVERGENCE':
                console.warn('pvp-game: divergência de estado', evento);
                avisar('Sincronizando o tabuleiro…');
                break;
            case 'APPLY_ERROR':
                avisar('Falha ao aplicar uma jogada recebida.');
                break;
            case 'RESYNC':
                atualizarBadges('sincronizando…');
                break;
            case 'SYNCED':
                atualizarBadges('em partida');
                atualizarBloqueioPorTurno();
                break;
            default:
                break;
        }
    }

    /**
     * Envolve o despacho: mantém o bloqueio de turno coerente e, quando o turno
     * passou a ser local, envia os comandos de abertura (compra + fase de
     * invocação) — o `setTimeout` do modo hotseat não vale em PvP.
     */
    function aplicarComandoDoLedger(entry) {
        applyCommand(entry);
        atualizarBloqueioPorTurno();

        if (entry.cmd === 'END_TURN' && window.gameState.currentPlayer === seatLocal && session) {
            session.sendCommand('DRAW', {});
            session.sendCommand('SET_PHASE', { phase: 'invocation' });
        }
    }

    /**
     * Fim de partida decidido pelo servidor: overlay único com o vencedor e o
     * link para uma sala nova (spec parte 5, DoD 1 e 3).
     */
    function tratarFimDePartida(mensagem) {
        estadoDaPartida = 'finalizada';
        atualizarBadges('partida finalizada');
        window.gameOver = true;
        document.querySelectorAll('button').forEach(botao => { botao.disabled = true; });

        if (document.getElementById('pvp-game-over')) return;

        const vencedor = mensagem?.winner;
        const euVenci = vencedor === seatLocal;
        const nomeVencedor = vencedor === 'p1' ? 'Jogador 1' : vencedor === 'p2' ? 'Jogador 2' : '—';

        const overlay = document.createElement('div');
        overlay.id = 'pvp-game-over';
        overlay.className = 'pvp-overlay';
        overlay.innerHTML = `
            <div class="pvp-overlay-card">
                <h1>${euVenci ? 'Vitória!' : 'Derrota'}</h1>
                <p>Vencedor: ${nomeVencedor}${mensagem?.reason ? ` (${mensagem.reason})` : ''}</p>
                <p class="pvp-overlay-detail">Sala ${roomIdLocal} · turno ${mensagem?.turn ?? '—'}</p>
                <a class="pvp-primary-link" href="/pvp?nova=1">Nova partida</a>
            </div>`;
        document.body.appendChild(overlay);
    }

    /** Informa o resultado ao servidor (decisão do motor local). */
    function enviarFimDePartida(vencedor) {
        if (window.__gameOverEnviado || !session) return;
        window.__gameOverEnviado = true;
        session.transportSend({
            type: 'GAME_OVER',
            winner: vencedor,
            reason: 'pv-zero',
            turn: window.gameState.turn,
            at: new Date().toISOString()
        });
    }

    /**
     * Em PvP o estado vem do MATCH_START: travamos o bootstrap local de
     * `startNewMatch` e o `resetGame` do hotseat antes do DOMContentLoaded.
     */
    function neutralizarBootstrapLocal() {
        window.__pvp = true;

        const startNewMatchOriginal = window.startNewMatch;
        window.startNewMatch = function () {
            if (window.__pvpPartidaMontada) {
                return startNewMatchOriginal?.apply(this, arguments);
            }
            console.info('pvp-game: startNewMatch local ignorado (o estado vem do MATCH_START)');
            return null;
        };

        window.resetGame = function () {
            avisar('Use "Nova partida" ao final da partida para criar uma sala nova.');
        };

        window.sendGameOver = enviarFimDePartida;
    }

    const ehPaginaPvp = typeof document !== 'undefined' && parseSeat(location.pathname) !== null;
    if (ehPaginaPvp) {
        neutralizarBootstrapLocal();
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => bootstrap());
        } else {
            bootstrap();
        }
    }

    api.buildReveal = buildReveal;
    api.aplicarComandoDoLedger = aplicarComandoDoLedger;
    api.gerarDeckLocal = gerarDeckLocal;
    return api;
});