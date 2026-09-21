/**
 * pvp-session.js - Núcleo headless da sessão PvP (ordenação, dedupe e replay).
 *
 * UMD (module.exports + window.PvpSession). Sem DOM.
 *
 * Responsabilidades (spec parte 3, DoD 5):
 *   - enviar comandos com o contrato de `pvp-protocol.js`;
 *   - aplicar o log do servidor **em ordem de seq**, ignorando duplicadas;
 *   - detectar gap de seq e pedir `COMMAND_LOG`;
 *   - alimentar o dado da sorte a partir de `DICE_RESULT`;
 *   - comparar o `STATE_HASH` do servidor com o local e pedir log se divergir.
 *
 * A mutação de estado fica com o `applyCommand` injetado (headless e testável).
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    root.PvpSession = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const Protocol = (typeof window !== 'undefined' ? window : globalThis).PvpProtocol;
    if (!Protocol) {
        throw new Error('PvpProtocol deve ser carregado antes de PvpSession');
    }

    class PvpSession {
        /**
         * @param {object} options
         * @param {function(object):void} options.transportSend envia uma mensagem
         * @param {object} [options.gameState] estado canônico (`window.gameState`)
         * @param {string} [options.seat] assento local (p1/p2)
         * @param {function(object):void} [options.applyCommand] aplica comando ordenado
         * @param {function(object):void} [options.onEvent] notificações (REJECTED, SYNCED…)
         * @param {function(object):void} [options.onGameOver] mensagem GAME_OVER
         */
        constructor(options = {}) {
            this.transportSend = options.transportSend || (() => {});
            this.state = options.gameState || null;
            this.seat = options.seat || null;
            this.applyCommand = options.applyCommand || (() => {});
            this.onEvent = options.onEvent || (() => {});
            this.onGameOver = options.onGameOver || null;

            this.lastSeq = 0;
            this.commandLog = [];
            this.applying = false;
            this.pendingResync = false;
            PvpSession.current = this;
        }

        static intercept(request) {
            return PvpSession.current ? PvpSession.current.intercept(request) : false;
        }

        static sendCommand(cmd, args, options) {
            return PvpSession.current ? PvpSession.current.sendCommand(cmd, args, options) : null;
        }

        static sendDiceRequest() {
            if (PvpSession.current) PvpSession.current.sendDiceRequest();
        }

        static isApplying() {
            return Boolean(PvpSession.current && PvpSession.current.isApplying());
        }

        /** Próxima seq que pode ser aplicada (o servidor começa em 1). */
        get nextSeq() {
            return this.lastSeq + 1;
        }

        /** Verdadeiro enquanto um comando remoto está sendo aplicado. */
        isApplying() {
            return this.applying;
        }

        setState(state) {
            this.state = state;
        }

        setSeat(seat) {
            this.seat = seat;
        }

        /** Limpa o log (usado quando a partida é remontada do zero). */
        resetLog() {
            this.lastSeq = 0;
            this.commandLog = [];
            this.pendingResync = false;
        }

        // ── envio ────────────────────────────────────────────────────────────

        /**
         * Envia um comando local. A seq é sempre atribuída pelo servidor.
         */
        sendCommand(cmd, args = {}, options = {}) {
            const actor = options.actor || this.seat || this.state?.currentPlayer || 'p1';
            const command = {
                type: 'COMMAND',
                cmd,
                args,
                reveals: options.reveals || [],
                actor
            };
            this.transportSend(command);
            return command;
        }

        /** Pede o dado da sorte ao servidor (única autoridade de RNG). */
        sendDiceRequest() {
            this.transportSend({ type: 'DICE_REQUEST' });
        }

        /** Pede o log completo (gap de seq, divergência de hash ou reconexão). */
        requestCommandLog(reason = 'gap') {
            if (this.pendingResync) return;
            this.pendingResync = true;
            this.transportSend({ type: 'COMMAND_LOG_REQUEST', reason });
            this.onEvent({ type: 'RESYNC', reason });
        }

        /**
         * Guarda usada pelos handlers de `game.js`:
         *   `if (window.PvpSession?.intercept({cmd, args})) return;`
         *
         * Em PvP devolve `true` (comando enviado) e durante a aplicação remota
         * devolve `false`, para que o handler local execute o corpo.
         */
        intercept(request) {
            if (this.applying) return false;
            if (!request || typeof request !== 'object' || !request.cmd) return false;
            if (request.cmd === 'ROLL_DICE') {
                this.sendDiceRequest();
                return true;
            }

            try {
                Protocol.normalizeCommand({
                    cmd: request.cmd,
                    actor: this.seat || this.state?.currentPlayer || 'p1',
                    args: request.args || {},
                    reveals: request.reveals || []
                });
            } catch (error) {
                this.onEvent({ type: 'INVALID', reason: error.message, cmd: request.cmd });
                return true;
            }

            this.sendCommand(request.cmd, request.args || {}, { reveals: request.reveals || [] });
            return true;
        }

// ── recepção ─────────────────────────────────────────────────────────

        /**
         * Roteia uma mensagem do transporte. Devolve `true` quando a mensagem era
         * de sincronização (tratada aqui).
         */
        handleMessage(message) {
            if (!message || typeof message !== 'object') return false;

            switch (message.type) {
                case 'COMMAND':
                    this.handleRemoteCommand(message);
                    return true;
                case 'COMMAND_LOG':
                    this.handleCommandLog(message.log);
                    return true;
                case 'DICE_RESULT':
                    this.handleDiceResult(message);
                    return true;
                case 'STATE_HASH':
                    this.handleStateHash(message);
                    return true;
                case 'REJECTED':
                    this.onEvent({ type: 'REJECTED', reason: message.reason, cmd: message.cmd });
                    return true;
                case 'GAME_OVER':
                    if (this.onGameOver) this.onGameOver(message);
                    return true;
                case 'MATCH_START':
                    this.resetLog();
                    return false;
                default:
                    return false;
            }
        }

        /**
         * Aplica um comando remoto respeitando a ordem das seqs.
         */
        handleRemoteCommand(entry) {
            const seq = Number(entry?.seq);
            if (!Number.isFinite(seq)) {
                this.onEvent({ type: 'INVALID', reason: 'COMMAND sem seq', cmd: entry?.cmd });
                return;
            }
            if (seq < this.nextSeq) {
                return; // duplicada/antiga: idempotência do replay
            }
            if (seq > this.nextSeq) {
                this.requestCommandLog(`gap: esperado ${this.nextSeq}, veio ${seq}`);
                return;
            }
            this.applyEntry(entry);
        }

        /**
         * Alimenta o dado da sorte. A `seq` do ROLL_DICE entra na mesma ordenação
         * dos demais comandos do ledger.
         */
        handleDiceResult(message) {
            const seq = Number(message?.seq);
            if (Number.isFinite(seq)) {
                if (seq < this.nextSeq) return;
                if (seq > this.nextSeq) {
                    this.requestCommandLog(`gap no dado: esperado ${this.nextSeq}, veio ${seq}`);
                    return;
                }
            }
            this.applyEntry({
                cmd: 'ROLL_DICE',
                actor: message.actor,
                args: { value: message.value },
                reveals: [],
                seq
            });
        }

        /**
         * Compara o hash do autor com o hash local: divergência pede replay.
         */
        handleStateHash(message) {
            if (!this.state || message.actor !== this.seat) return;
            const localHash = Protocol.stateHash(this.state);
            if (Number(localHash) !== Number(message.hash)) {
                this.onEvent({
                    type: 'DIVERGENCE',
                    expected: message.hash,
                    local: localHash,
                    seq: message.seq
                });
                this.requestCommandLog(`divergência de hash na seq ${message.seq}`);
            }
        }

        /**
         * Aplica o log completo (reconexão ou resync). O estado já deve ter sido
         * remontado pelo chamador; aqui o log entra em ordem, sem duplicar o que
         * já foi aplicado.
         */
        handleCommandLog(log) {
            if (!Array.isArray(log)) return;

            const entries = log
                .slice()
                .sort((a, b) => (Number(a?.seq) || 0) - (Number(b?.seq) || 0));

            this.pendingResync = false;
            entries.forEach(entry => {
                const seq = Number(entry?.seq);
                if (!Number.isFinite(seq) || seq <= this.lastSeq) return;
                // F5 duplo: o mesmo COMMAND_LOG pode chegar 2x (reconnect +
                // abertura). Sem esta checagem o DRAW reaplicava e a mão do
                // oponente crescia a cada reload.
                const duplicada = this.commandLog.some(item => Number(item?.seq) === seq);
                if (duplicada) {
                    this.lastSeq = Math.max(this.lastSeq, seq);
                    return;
                }
                this.applyEntry(entry);
            });

            this.onEvent({ type: 'SYNCED', lastSeq: this.lastSeq });
        }

        /**
         * Valida e aplica uma entrada do ledger, mantendo `applying` ligado para
         * que os handlers de `game.js` não reenviem o comando.
         */
        applyEntry(entry) {
            let normalized;
            try {
                normalized = Protocol.normalizeCommand(
                    { cmd: entry.cmd, actor: entry.actor, args: entry.args, reveals: entry.reveals },
                    this.state
                );
            } catch (error) {
                this.onEvent({ type: 'INVALID', reason: error.message, cmd: entry?.cmd });
                return false;
            }

            const ordered = { ...normalized, seq: Number(entry.seq) || null };

            this.applying = true;
            try {
                this.applyCommand(ordered);
            } catch (error) {
                console.error('pvp-session: falha ao aplicar comando', ordered.cmd, error);
                this.onEvent({ type: 'APPLY_ERROR', reason: error.message, cmd: ordered.cmd });
                return false;
            } finally {
                this.applying = false;
            }

            this.commandLog.push(ordered);
            if (Number.isFinite(Number(ordered.seq))) {
                this.lastSeq = Math.max(this.lastSeq, Number(ordered.seq));
            }
            return true;
        }
    }

    return { PvpSession };
});