/**
 * pvm-game.js - Driver do modo PvM (jogador vs máquina) para o `game.html`.
 *
 * Reusa a engine e a UI existentes de `src/js/game.js`: o humano pilota p1 e a
 * máquina pilota p2 com os MESMOS handlers (summon/equip/attack/direct/ability).
 * A mão da máquina fica em verso (como o oponente no PvP) via `window.__pvm`.
 * Não há regra de carta aqui: a decisão vem de `PvmAi` (puro) e a execução delega
 * para `window.summonCard`/`equipSupportCard`/`performAttack`/`directAttack`/
 * `applyMigratedAbilityLocally`.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    root.PvmGame = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const ASSENTO_HUMANO = 'p1';
    const ASSENTO_MAQUINA = 'p2';
    const MAX_PASSOS_POR_FASE = 25;
    const INTERVALO_DO_TURNO = 250;

    let botExecutando = false;
    let turnoDaMaquinaIniciado = false;
    let relogio = null;

    function aguardar(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function ehTurnoDaMaquina() {
        const state = typeof window !== 'undefined' ? window.gameState : null;
        return Boolean(state && state.currentPlayer === ASSENTO_MAQUINA);
    }

    /** Esconde/bloqueia os controles da máquina (idempotente). */
    function configurarMaquina() {
        if (typeof document === 'undefined') return;
        document.body.dataset.seat = ASSENTO_HUMANO;

        // Espiar a mão da máquina não existe em PvM.
        document.querySelectorAll('.player2-hand .peek-hand-btn').forEach(el => el.remove());

        // Deck da máquina: secreto (a compra é automática).
        const deckP2 = document.querySelector('.player2-deck');
        if (deckP2) {
            deckP2.removeAttribute('onclick');
            deckP2.style.cursor = 'default';
            deckP2.onclick = () => window.showMessage?.('O deck da máquina é secreto nesta partida.', 'warning');
        }

        // Deck do humano: a compra é automática no próprio turno.
        const deckP1 = document.querySelector('.player1-deck');
        if (deckP1) {
            deckP1.removeAttribute('onclick');
            deckP1.style.cursor = 'default';
            deckP1.onclick = null;
        }

        // Nome/PV da máquina não são editáveis.
        const nomeP2 = document.querySelector('.player2-stats .player-name');
        if (nomeP2) {
            nomeP2.removeAttribute('onclick');
            nomeP2.style.cursor = 'default';
            nomeP2.onclick = null;
        }
        const pvP2 = document.getElementById('pv-p2');
        if (pvP2) {
            pvP2.removeAttribute('onclick');
            pvP2.style.cursor = 'default';
            pvP2.onclick = null;
        }

        garantirDadoDaMaquina();
    }

    /** O reset reabilita o dado; a máquina não usa dado em PvM. */
    function garantirDadoDaMaquina() {
        if (typeof document === 'undefined') return;
        const dado = document.getElementById('dice-' + ASSENTO_MAQUINA);
        if (dado && !dado.disabled) dado.disabled = true;
    }

    /** Trava fase/fim de turno enquanto a máquina joga (o humano não interfere). */
    function desabilitarControlesDoHumano(desabilitar) {
        if (typeof document === 'undefined') return;
        document.querySelectorAll('.phase-button, .control-section .action-button').forEach(btn => {
            btn.disabled = desabilitar;
        });
    }

    function executarComando(cmd) {
        const state = window.gameState;
        if (!cmd || !state) return;

        switch (cmd.type) {
            case 'ability': {
                const carta = state.cardInstances[cmd.cardId];
                const rule = carta ? window.CardRules?.getActivatedRule?.(carta.definitionId) : null;
                if (!rule) return;
                const alvos = window.CardRules?.getActivatedTargets?.(state, cmd.cardId) || [];
                window.applyMigratedAbilityLocally?.(rule, cmd.cardId, cmd.targetIds || [], alvos);
                return;
            }
            case 'equip':
                window.equipSupportCard?.(cmd.cardId, cmd.creatureId);
                // `equipSupportCard` não reprojeta a mão: garante contador/verso.
                window.renderHandsFromState?.();
                return;
            case 'summon':
                window.summonCard?.(cmd.cardId, ASSENTO_MAQUINA);
                return;
            case 'attack':
                window.performAttack?.(cmd.attackerId, cmd.targetId);
                return;
            case 'direct_attack':
                state.attackingCard = cmd.attackerId;
                window.directAttack?.();
                return;
        }
    }

    async function executarFase(fase) {
        let passos = 0;
        while (
            !window.gameOver &&
            ehTurnoDaMaquina() &&
            window.gameState.currentPhase === fase &&
            passos < MAX_PASSOS_POR_FASE
        ) {
            const cmd = window.PvmAi?.decidirJogada(window.gameState, window.gameEngine, ASSENTO_MAQUINA);
            if (!cmd) break;
            executarComando(cmd);
            passos += 1;
            await aguardar(900);
        }
    }

    async function executarTurnoDaMaquina() {
        if (botExecutando || window.gameOver) return;
        botExecutando = true;
        desabilitarControlesDoHumano(true);
        try {
            await aguardar(700);
            if (window.gameOver || !ehTurnoDaMaquina()) return;

            await executarFase('invocation');
            if (window.gameOver || !ehTurnoDaMaquina()) return;

            window.setPhase?.('combat');
            await aguardar(500);
            if (window.gameOver || !ehTurnoDaMaquina()) return;

            await executarFase('combat');
            if (window.gameOver || !ehTurnoDaMaquina()) return;

            window.endTurn?.();
        } finally {
            botExecutando = false;
            desabilitarControlesDoHumano(false);
        }
    }

    function verificarTurno() {
        if (typeof window === 'undefined') return;
        garantirDadoDaMaquina();
        const state = window.gameState;
        if (!state || window.gameOver) return;
        if (state.currentPlayer !== ASSENTO_MAQUINA) {
            turnoDaMaquinaIniciado = false;
            return;
        }
        // A máquina age na invocação: a compra/energia já foram resolvidas pelo
        // fluxo de turno (o auto-flow desenha e troca a fase após o fim do turno).
        if (state.currentPhase !== 'invocation') return;
        if (turnoDaMaquinaIniciado || botExecutando) return;
        turnoDaMaquinaIniciado = true;
        executarTurnoDaMaquina();
    }

    function iniciar() {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;
        window.__pvm = true;
        configurarMaquina();
        if (relogio) clearInterval(relogio);
        relogio = setInterval(verificarTurno, INTERVALO_DO_TURNO);
    }

    const api = { iniciar, configurarMaquina, executarTurnoDaMaquina, verificarTurno, executarComando };

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', iniciar);
        } else {
            iniciar();
        }
    }

    return api;
});

