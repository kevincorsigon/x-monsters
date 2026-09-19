/**
 * pvp-protocol.js - Validação, normalização e hash de estado para PvP online.
 *
 * UMD (module.exports + window.PvpProtocol). Sem dependência de DOM.
 *
 * Exporta:
 *   - PROTOCOL_COMMANDS: lista de todos os comandos válidos da v1
 *   - TURN_COMMANDS: subconjunto que exige ser o turno do ator
 *   - REQUIRED_ARGS: campos obrigatórios por comando
 *   - normalizeCommand(rawMessage, state): valida e devolve {cmd, args, reveals, actor}
 *   - stateHash(state): hash FNV-1a determinístico da projeção pública do estado
 *   - fnv1a(texto): hash FNV-1a 32 bits
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    root.PvpProtocol = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const PLAYER_IDS = ['p1', 'p2'];
    const ZONE_NAMES = ['deck', 'hand', 'field', 'equipment', 'discard'];
    const PHASES = ['energy', 'invocation', 'combat'];

    // Comandos que exigem ser o turno do ator. CHOICE e DESTROY herdam o turno
    // de quem abriu a ação, por isso ficam de fora.
    const TURN_COMMANDS = [
        'DRAW', 'SUMMON', 'EQUIP', 'ATTACK', 'DIRECT_ATTACK',
        'ABILITY', 'SET_PHASE', 'END_TURN', 'ROLL_DICE'
    ];
    const ALL_COMMANDS = TURN_COMMANDS.concat(['CHOICE', 'DESTROY', 'SET_NAME']);

    // Campos obrigatórios por comando (contrato único cliente <-> servidor).
    const REQUIRED_ARGS = {
        DRAW: [],
        ROLL_DICE: [],
        END_TURN: [],
        SUMMON: ['handSlot'],
        EQUIP: ['cardId', 'creatureId'],
        ATTACK: ['attackerId', 'targetId'],
        DIRECT_ATTACK: ['attackerId'],
        ABILITY: ['cardId'],
        CHOICE: ['choiceId', 'selection'],
        SET_PHASE: ['phase'],
        DESTROY: ['cardId'],
        SET_NAME: ['name']
    };

    /**
     * Valida um único reveal.
     * Cada reveal deve ter: instanceId, definitionId, ownerId, fromZone, slot.
     * Devolve o motivo (string) ou null quando válido.
     */
    function validateReveal(reveal) {
        if (typeof reveal !== 'object' || reveal === null) {
            return 'reveal inválido: não é um objeto';
        }
        if (typeof reveal.instanceId !== 'string' || reveal.instanceId.length === 0) {
            return 'reveal inválido: instanceId ausente ou vazio';
        }
        if (typeof reveal.definitionId !== 'string' || reveal.definitionId.length === 0) {
            return 'reveal inválido: definitionId ausente ou vazio';
        }
        if (!PLAYER_IDS.includes(reveal.ownerId)) {
            return 'reveal inválido: ownerId inválido (' + reveal.ownerId + ')';
        }
        if (!ZONE_NAMES.includes(reveal.fromZone)) {
            return 'reveal inválido: fromZone inválido (' + reveal.fromZone + ')';
        }
        if (typeof reveal.slot !== 'number' || reveal.slot < 0) {
            return 'reveal inválido: slot inválido';
        }
        return null;
    }

/**
     * Exige um reveal para o slot informado (owner + zona + slot).
     */
    function requireReveal(reveals, ownerId, fromZone, slot) {
        const found = reveals.some(
            reveal => reveal.ownerId === ownerId &&
                reveal.fromZone === fromZone &&
                reveal.slot === slot
        );
        if (!found) {
            throw new Error(
                'Reveals ausente para a carta oculta em ' + fromZone + '[' + slot + '] de ' + ownerId
            );
        }
    }

    /**
     * Uma posição já revelada não aceita novo reveal (evita sobrescrever
     * identidade real com informação divergente).
     */
    function assertRevealsMatchPlaceholders(state, reveals) {
        reveals.forEach((reveal, index) => {
            const zone = state.players && state.players[reveal.ownerId]
                && state.players[reveal.ownerId].zones
                && state.players[reveal.ownerId].zones[reveal.fromZone];
            if (!Array.isArray(zone)) return;
            const ocupante = zone[reveal.slot];
            if (!ocupante) return;
            const isPlaceholder = ocupante.definitionId === null || ocupante.definitionId === undefined;
            if (isPlaceholder) return;
            throw new Error('reveal inválido: posição já revelada (índice ' + index + ')');
        });
    }

    /**
     * Normaliza e valida uma mensagem de comando.
     * Devolve {cmd, args, reveals, actor}. Lança Error (pt-BR) se inválido.
     *
     * @param {object} rawMessage
     * @param {object} [state] estado local, usado para recusar reveal em cima
     *   de posição que já tem identidade.
     */
    function normalizeCommand(rawMessage, state) {
        if (typeof rawMessage !== 'object' || rawMessage === null) {
            throw new Error('Mensagem inválida: não é um objeto');
        }

        const cmd = rawMessage.cmd;
        if (typeof cmd !== 'string') {
            throw new Error('Comando inválido: cmd ausente ou não é string');
        }
        if (!ALL_COMMANDS.includes(cmd)) {
            throw new Error('Comando desconhecido: ' + cmd);
        }

        const actor = rawMessage.actor;
        if (!PLAYER_IDS.includes(actor)) {
            throw new Error('Ator inválido: ' + actor + ' (esperado p1 ou p2)');
        }

        const args = rawMessage.args === undefined ? {} : rawMessage.args;
        if (typeof args !== 'object' || args === null || Array.isArray(args)) {
            throw new Error('Args inválido: não é um objeto');
        }

        const requiredArgs = REQUIRED_ARGS[cmd] || [];
        requiredArgs.forEach(field => {
            if (!(field in args) || args[field] === undefined || args[field] === null) {
                throw new Error('Args ausente para ' + cmd + ': ' + field);
            }
        });

        if (cmd === 'SUMMON' && (typeof args.handSlot !== 'number' || args.handSlot < 0)) {
            throw new Error('SUMMON: handSlot inválido (' + args.handSlot + ')');
        }
        if (cmd === 'SET_PHASE' && !PHASES.includes(args.phase)) {
            throw new Error('SET_PHASE: fase inválida (' + args.phase + ')');
        }

        const reveals = rawMessage.reveals === undefined ? [] : rawMessage.reveals;
        if (!Array.isArray(reveals)) {
            throw new Error('Reveals inválido: não é um array');
        }
        reveals.forEach((reveal, index) => {
            const problem = validateReveal(reveal);
            if (problem) {
                throw new Error(problem + ' (índice ' + index + ')');
            }
        });

        // Toda carta que sai da mão precisa viajar com o seu reveal: o receptor
        // conhece o slot, nunca a identidade.
        if (cmd === 'SUMMON') {
            requireReveal(reveals, actor, 'hand', args.handSlot);
        }
        if (cmd === 'EQUIP') {
            const revealDaMaoPropria = reveals.some(
                reveal => reveal.ownerId === actor && reveal.fromZone === 'hand'
            );
            if (!revealDaMaoPropria) {
                throw new Error('Reveals ausente para EQUIP: a carta de suporte vem da mão');
            }
        }

        if (state) {
            assertRevealsMatchPlaceholders(state, reveals);
        }

        return { cmd, actor, args, reveals };
    }

/**
     * FNV-1a 32 bits. Determinístico e sem dependência de biblioteca.
     */
    function fnv1a(texto) {
        let hash = 2166136261;
        for (let i = 0; i < texto.length; i++) {
            hash = Math.imul(hash ^ texto.charCodeAt(i), 16777619) >>> 0;
        }
        return hash >>> 0;
    }

    /**
     * Projeção canônica do estado (ordem fixa, sem depender de iteração de
     * chaves de objeto) e hash FNV-1a.
     *
     * Campos incluídos (todos públicos):
     *   - turn, currentPlayer, currentPhase
     *   - pv, energy, maxEnergy de cada jogador
     *   - .length das 5 zonas de cada jogador
     *   - nº de cardInstances
     *   - .length de effects
     *   - pendingChoice.id
     *   - diceUsed de cada jogador
     *
     * Campos de UI (attackingCard, selectedCard, elementos) ficam de fora.
     */
    function stateHash(state) {
        if (!state || typeof state !== 'object') {
            return fnv1a('estado-invalido');
        }

        const parts = [];
        parts.push('t=' + (state.turn || 0));
        parts.push('p=' + (state.currentPlayer || '-'));
        parts.push('ph=' + (state.currentPhase || '-'));

        PLAYER_IDS.forEach(playerId => {
            const player = state.players && state.players[playerId];
            if (!player || !player.zones) {
                parts.push(playerId + '=none');
                return;
            }
            const zones = player.zones;
            parts.push(playerId + '=pv:' + (player.pv || 0) +
                '|en:' + (player.energy || 0) +
                '|mx:' + (player.maxEnergy || 0) +
                '|deck:' + (zones.deck || []).length +
                '|hand:' + (zones.hand || []).length +
                '|field:' + (zones.field || []).length +
                '|eq:' + (zones.equipment || []).length +
                '|discard:' + (zones.discard || []).length
            );
        });

        parts.push('ci=' + Object.keys(state.cardInstances || {}).length);
        parts.push('ef=' + (state.effects || []).length);

        const pendingChoice = state.pendingChoice;
        parts.push('pc=' + (pendingChoice && pendingChoice.id ? pendingChoice.id : '-'));

        const diceUsed = state.diceUsed || {};
        parts.push('du=' + (diceUsed.p1 ? '1' : '0') + (diceUsed.p2 ? '1' : '0'));

        return fnv1a(parts.join('|'));
    }

    return {
        PLAYER_IDS,
        ZONE_NAMES,
        PHASES,
        PROTOCOL_COMMANDS: ALL_COMMANDS.slice(),
        TURN_COMMANDS,
        ALL_COMMANDS,
        REQUIRED_ARGS,
        normalizeCommand,
        validateReveal,
        stateHash,
        fnv1a
    };
});