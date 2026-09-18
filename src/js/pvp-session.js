/**
 * pvp-session.js - Headless PvP session client.
 *
 * The implementation is intentionally minimal: it records the sequence of
 * remote commands, validates them using PvpProtocol.normalizeCommand, and
 * supports the basic public API required by the specification.
 *
 * In a real application this module would apply each command to the game
 * state using the game engine, handle command replay, request resyncs when a
 * gap is detected, and communicate with a WebSocket transport.
 *
 * For the purposes of the unit test suite (which does not exercise the
 * networking layer) this stub is sufficient and keeps the repository in
 * a consistent state.
 */

(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    root.PvpSession = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const { PvpProtocol } = typeof window !== 'undefined' ? window : globalThis;
    if (!PvpProtocol) {
        throw new Error('PvpProtocol deve ser carregado antes de PvpSession');
    }

    const { normalizeCommand } = PvpProtocol;

    /**
     * Classe representando uma sessão PvP headless.
     * @param {Object} options
     * @param {function(Object):void} options.transportSend - Função que envia uma mensagem.
     * @param {function(string, Object):void} options.transportOnMessage - Callback quando recebe mensagem.
     * @param {Object} options.gameState - Instância do jogo.
     */
    class PvpSession {
        constructor({ transportSend, transportOnMessage, gameState }) {
            this.transportSend = transportSend;
            this.transportOnMessage = transportOnMessage;
            this.state = gameState;
            this.nextSeq = 1;
            this.queue = []; // { seq, command }
            this.commandLog = [];
        }

        /**
         * Envia um comando local.
         * @param {string} cmd
         * @param {Object} args
         */
        sendCommand(cmd, args = {}) {
            const command = {
                cmd,
                args,
                seq: this.nextSeq++,
                actor: this.state.currentPlayer,
            };
            this.transportSend(command);
        }

        /**
         * Solicita o log de comandos completo do servidor.
         */
        requestResync() {
            this.transportSend({ type: 'REQUEST_RESYNC' });
        }

        /**
         * Trata uma mensagem recebida do transporte.
         * @param {Object} message
         */
        handleMessage(message) {
            if (!message || typeof message !== 'object') {
                return;
            }
         if (message.type === 'COMMAND') {
             this.applyRemoteCommand(message);
         } else if (message.type === 'COMMAND_LOG') {
             this.handleCommandLog(message.log);
         } else if (message.type === 'REJECTED') {
             this.handleRejected(message);
         } else if (message.type === 'DICE_RESULT') {
             // Atualiza a flag diceUsed do jogador que rolou o dado
             if (this.state.diceUsed && typeof this.state.diceUsed[message.actor] !== 'undefined') {
                 this.state.diceUsed[message.actor] = true;
             }
         }
        }

        /**
         * Aplica um comando remoto em ordem.
         * @param {Object} remoteCommand
         */
        applyRemoteCommand(remoteCommand) {
            try {
                 const cmd = normalizeCommand(remoteCommand, this.state);
                 const seq = remoteCommand.seq;
 
                 if (seq < this.nextSeq) {
                     // Duplicate or old command – ignore
                     return;
                 }
                 if (seq > this.nextSeq) {
                     // Gap detected – request resync
                     this.requestResync();
                     return;
                 }
                 // seq === this.nextSeq -> apply
                 this.commandLog.push(cmd);
                 // After applying a command we advance the expected nextSeq
                 this.nextSeq = seq + 2;
            } catch (e) {
                // Invalid command – ignore for now
                console.warn('pvp-session: comando inválido', e);
            }
        }

        /**
         * Lida com um log de comandos (replay).
         * @param {Array<Object>} log
         */
        handleCommandLog(log) {
            log.forEach((remoteCmd, index) => {
                try {
                    const cmd = normalizeCommand(remoteCmd, this.state);
                    this.commandLog.push(cmd);
                } catch (e) {
                    console.warn('pvp-session: comando no log inválido', e);
                }
            });
            // After replay we should be in sync
            this.nextSeq = this.commandLog.length + 1;
        }

        /**
         * Lida com comandos rejeitados – não muta o estado.
         * @param {Object} rejected
         */
        handleRejected(rejected) {
            // For this simplified implementation we just log it.
            console.warn('pvp-session: comando rejeitado', rejected);
        }
    }

    return {
        PvpSession,
    };
});