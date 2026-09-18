/**
 * pvp-state.js - Estado e helpers para partidas PvP
 *
 * O objetivo desta camada é abstrair a lógica de *placeholders* (cartas
 * ocultas) e de geração de IDs opacos. Tudo é UMD (module.exports +
 * window.PvpState) para manter a compatibilidade com o resto do código.
 *
 * Exporta:
 *   - createHiddenInstance(ownerId, index)
 *   - createHiddenZone(ownerId, zoneType, length)
 *   - createHiddenSlots(state, ownerId)
 *   - revealInstance(state, reveal)
 *   - createPvpIdFactory(seed)
 *   - constants: ZONE_NAMES, PLAYER_IDS
 */

(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    root.PvpState = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const PLAYER_IDS = ['p1', 'p2'];
    const ZONE_NAMES = ['hand', 'deck'];

    /**
     * Gera um instanceId opaco determinístico.
     * @param {number} seed - seed do RNG
     * @returns {function(string):string}
     */
    function createPvpIdFactory(seed) {
        const mulberry32 = function (s) {
            let a = s >>> 0;
            return function () {
                a |= 0;
                a = (a + 0x6D2B79F5) | 0;
                let t = Math.imul(a ^ (a >>> 15), 1 | a);
                t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
                return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
            };
        };
        const rng = mulberry32(seed);
        let counter = 0;
        return function (ownerId) {
            counter += 1;
            const hash = Math.floor(rng() * 1e6).toString(36);
            return `i_${ownerId}_${hash}_${counter}`;
        };
    }

    /**
     * Cria uma instância placeholder.
     */
    function createHiddenInstance(ownerId, index) {
        return {
            instanceId: `hidden_${ownerId}_${index}`,
            definitionId: null,
            // data is a proxy that throws when accessed – protects secrecy
            data: new Proxy({}, {
                get(target, prop) {
                    throw new Error('acesso a data de placeholder');
                }
            }),
            ownerId,
            zone: null,
            index,
        };
    }

    /**
     * Preenche uma zona com placeholders.
     */
    function createHiddenZone(ownerId, zoneType, length) {
        const zone = [];
        for (let i = 0; i < length; i++) {
            zone.push(createHiddenInstance(ownerId, i));
        }
        return zone;
    }

    /**
     * Cria os mapeamentos hiddenSlots para o jogador.
     */
    function createHiddenSlots(state, ownerId) {
        const hiddenSlots = {};
        ZONE_NAMES.forEach((zone) => {
            hiddenSlots[zone] = [];
            const zoneData = state.players[ownerId].zones[zone];
            zoneData.forEach((card, idx) => {
                if (!card.definitionId) {
                    hiddenSlots[zone].push(idx);
                }
            });
        });
        return hiddenSlots;
    }

    /**
     * Substitui o placeholder por uma instância real.
     * @param {object} state
     * @param {object} reveal { instanceId, definitionId, ownerId, fromZone, slot }
     */
     function revealInstance(state, reveal) {
         const { instanceId, definitionId, ownerId, fromZone, slot } = reveal;
         const zone = state.players[ownerId].zones[fromZone];
         if (!zone || slot >= zone.length) {
             throw new Error('Reveal fora de zona');
         }
         const placeholder = zone[slot];
         // Se já existe uma instância na posição e o ID coincide, apenas devolvemos
         // a instância existente (idempotência). Caso contrário, precisamos garantir
         // que a posição ainda seja um placeholder.
         if (placeholder && placeholder.definitionId !== null) {
             if (placeholder.instanceId === instanceId) {
                 return placeholder; // já revelado, não fazemos nada
             }
             throw new Error('Reveal não é placeholder');
         }
         const realInstance = {
             instanceId,
             definitionId,
             data: null, // will be set by card-rules when needed
             ownerId,
             zone: fromZone,
             index: slot,
         };
         zone[slot] = realInstance;
         state.cardInstances[instanceId] = realInstance;
         return realInstance;
     }

    return {
        PLAYER_IDS,
        ZONE_NAMES,
        createHiddenInstance,
        createHiddenZone,
        createHiddenSlots,
        revealInstance,
        createPvpIdFactory,
    };
});