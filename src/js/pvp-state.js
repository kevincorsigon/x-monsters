/**
 * pvp-state.js - Estado oculto (placeholders) e identidade opaca do PvP.
 *
 * UMD (module.exports + window.PvpState). Sem dependência de DOM.
 *
 * Papel desta camada (spec parte 3):
 *   - representar as zonas ocultas do oponente como instâncias *contáveis*,
 *     sem identidade (`definitionId: null`, `data: null`);
 *   - materializar a carta no mesmo slot quando o reveal chega;
 *   - gerar ids opacos (`i_<owner>_<hash>`) para o `idFactory` do
 *     `GameStateModel.resetMatchState`.
 *
 * Exporta:
 *   - createHiddenInstance(ownerId, index)
 *   - createHiddenZone(ownerId, zoneType, length)
 *   - installHiddenZones(state, ownerId, counts)
 *   - findHiddenSlot(state, instanceId)
 *   - revealInstance(state, reveal, options)
 *   - applyReveals(state, reveals, options)
 *   - createPvpIdFactory(seed)
 *   - isHiddenInstance(card)
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
    const ZONE_NAMES = ['deck', 'hand', 'field', 'equipment', 'discard'];

    // Marcador do id de placeholder: `hidden_<owner>_<k>`.
    const HIDDEN_PREFIX = 'hidden_';

    /**
     * Instância placeholder: ocupa a zona normalmente (contagem correta) mas
     * não carrega identidade nenhuma da carta real.
     */
    function createHiddenInstance(ownerId, index, zone = 'deck') {
        return {
            instanceId: `${HIDDEN_PREFIX}${ownerId}_${index}`,
            definitionId: null,
            data: null,
            ownerId,
            controllerId: ownerId,
            player: ownerId,
            zonePlayerId: ownerId,
            zone,
            index,
            baseStats: { attack: 0, defense: 0 },
            damage: 0,
            attachments: [],
            attachedTo: null,
            modifiers: [],
            usage: {},
            element: null
        };
    }

    function isHiddenInstance(card) {
        return Boolean(card) && (
            card.definitionId === null ||
            card.definitionId === undefined ||
            String(card.instanceId || '').startsWith(HIDDEN_PREFIX)
        );
    }

    /**
     * Preenche uma zona com placeholders (nunca identidade).
     *
     * `startIndex` desloca a numeração para que os ids continuem únicos quando o
     * jogador tem mais de uma zona oculta (senão o mesmo id existiria em duas
     * zonas e o `moveCard` acusaria "ocupa N zonas").
     */
    function createHiddenZone(ownerId, zoneType, length, startIndex = 0) {
        const zone = [];
        for (let i = 0; i < length; i++) {
            zone.push(createHiddenInstance(ownerId, startIndex + i, zoneType));
        }
        return zone;
    }

    /**
     * Troca as zonas do jogador pelas versões ocultas e mantém os aliases legados
     * (`state.cards[owner]`, `state.decks[owner]`) apontando para os arrays novos.
     *
     * @param {object} state
     * @param {string} ownerId jogador cujas zonas ficam ocultas
     * @param {object} counts { deck, hand, field, equipment, discard }
     */
    function installHiddenZones(state, ownerId, counts = {}) {
        if (!state?.players?.[ownerId]) {
            throw new Error('Estado inválido para zonas ocultas: ' + ownerId);
        }

        let indice = 0;
        ZONE_NAMES.forEach(zone => {
            const length = Number(counts[zone] || 0);
            const placeholders = createHiddenZone(ownerId, zone, length, indice);
            indice += length;
            state.players[ownerId].zones[zone] = placeholders;
            placeholders.forEach(card => {
                state.cardInstances[card.instanceId] = card;
            });
        });

        // Os aliases legados foram montados no reset apontando para os arrays
        // antigos: precisam ser re-apontados para as zonas ocultas.
        if (state.cards?.[ownerId]) {
            state.cards[ownerId].hand = state.players[ownerId].zones.hand;
            state.cards[ownerId].field = state.players[ownerId].zones.field;
            state.cards[ownerId].equipment = state.players[ownerId].zones.equipment;
            state.cards[ownerId].discard = state.players[ownerId].zones.discard;
        }
        if (state.decks) {
            state.decks[ownerId] = state.players[ownerId].zones.deck;
        }

        return state;
    }

/**
     * Localiza o slot de um placeholder pelo instanceId anunciado.
     * Devolve { ownerId, zone, slot } ou null.
     */
    /**
     * Bookkeeping dos slots ocultos por zona de um jogador: onde ainda não há
     * identidade (spec parte 3, escopo: `hiddenSlots`).
     */
    function createHiddenSlots(state, ownerId) {
        const hiddenSlots = {};
        ZONE_NAMES.forEach(zone => {
            hiddenSlots[zone] = [];
            const zona = state?.players?.[ownerId]?.zones?.[zone] || [];
            zona.forEach((carta, index) => {
                if (isHiddenInstance(carta)) {
                    hiddenSlots[zone].push(index);
                }
            });
        });
        return hiddenSlots;
    }

    /**
     * Próximo índice livre de placeholder para o dono: os ids são
     * `hidden_<owner>_<index>`, então partir do maior índice em uso evita
     * colisão com o que já está nas zonas (inclusive o deck oculto).
     */
    function nextHiddenIndex(state, ownerId) {
        let maior = -1;
        ZONE_NAMES.forEach(zone => {
            (state?.players?.[ownerId]?.zones?.[zone] || []).forEach((carta, slot) => {
                if (!carta) return;
                const indice = Number.isFinite(Number(carta.index)) ? Number(carta.index) : slot;
                maior = Math.max(maior, indice);
            });
        });
        return maior + 1;
    }

    /**
     * Ajusta o tamanho de uma zona oculta para bater com a contagem publicada
     * pelo servidor (`handSizes`).
     *
     * O cliente não inventa identidade: a sobra vira placeholder (sem
     * `definitionId`) e o excesso sai do fim da zona. É o que mantém o leque do
     * oponente coerente com o contador exibido — o número vem do websocket e o
     * cliente só desenha a quantidade de versos anunciada.
     *
     * Devolve quantos slots entraram/saíram (0 = já batia).
     */
    function resizeHiddenZone(state, ownerId, zoneType, targetLength) {
        const zona = state?.players?.[ownerId]?.zones?.[zoneType];
        const alvo = Number(targetLength);
        if (!Array.isArray(zona) || !Number.isFinite(alvo) || alvo < 0) return 0;

        let ajuste = 0;
        while (zona.length > alvo) {
            const removida = zona.pop();
            if (removida?.instanceId) delete state.cardInstances[removida.instanceId];
            if (removida && !isHiddenInstance(removida)) {
                console.warn('pvp-state: contagem do servidor removeu uma carta revelada', removida.instanceId);
            }
            ajuste -= 1;
        }
        while (zona.length < alvo) {
            const placeholder = createHiddenInstance(ownerId, nextHiddenIndex(state, ownerId), zoneType);
            zona.push(placeholder);
            state.cardInstances[placeholder.instanceId] = placeholder;
            ajuste += 1;
        }
        return ajuste;
    }

    function findHiddenSlot(state, instanceId) {
        for (const playerId of PLAYER_IDS) {
            const zones = state?.players?.[playerId]?.zones;
            if (!zones) continue;
            for (const zoneName of ZONE_NAMES) {
                const slot = (zones[zoneName] || []).findIndex(
                    card => card && card.instanceId === instanceId
                );
                if (slot !== -1) {
                    return { ownerId: playerId, zone: zoneName, slot };
                }
            }
        }
        return null;
    }

    /**
     * Resolve a definição da carta pelo catálogo já carregado (nunca por dado
     * de carta duplicado em JS).
     */
    function resolveDefinition(definitionId) {
        const cards = (typeof window !== 'undefined' ? window.cardsDatabase : null)?.cards;
        if (!Array.isArray(cards)) return null;
        return cards.find(card => card.id === definitionId) || null;
    }

    /**
     * Substitui o placeholder **no mesmo slot** pela instância real anunciada no
     * reveal. É idempotente: se a posição já tem a instância anunciada, devolve a
     * que está lá.
     *
     * @param {object} state
     * @param {object} reveal { instanceId, definitionId, ownerId, fromZone, slot }
     * @param {object} [options] { resolveDefinition }
     */
    function revealInstance(state, reveal, options = {}) {
        if (!reveal || typeof reveal !== 'object') {
            throw new Error('Reveal inválido: não é um objeto');
        }
        const { instanceId, definitionId, ownerId, fromZone, slot } = reveal;
        const zone = state?.players?.[ownerId]?.zones?.[fromZone];
        if (!Array.isArray(zone)) {
            throw new Error(`Reveal fora de zona: ${ownerId}/${fromZone}`);
        }
        if (slot === undefined || slot === null || slot >= zone.length) {
            throw new Error('Reveal fora de zona: slot ' + slot);
        }

        const ocupante = zone[slot];
        if (ocupante && !isHiddenInstance(ocupante)) {
            if (ocupante.instanceId === instanceId) {
                return ocupante; // já revelado: idempotente
            }
            throw new Error('Reveal não é placeholder: posição já revelada');
        }

        const definition = (options.resolveDefinition || resolveDefinition)(definitionId);
        const realInstance = {
            id: instanceId,
            instanceId,
            definitionId,
            ownerId,
            controllerId: ocupante?.controllerId || ownerId,
            player: ownerId,
            zonePlayerId: ownerId,
            zone: fromZone,
            index: slot,
            baseStats: {
                attack: definition?.attack || 0,
                defense: definition?.defense || 0
            },
            damage: 0,
            attachments: [],
            attachedTo: null,
            modifiers: [],
            usage: {},
            attackLimit: 1,
            cost: definition?.cost || 0,
            data: definition ? { ...definition } : { id: definitionId },
            element: null
        };

        if (ocupante) {
            delete state.cardInstances[ocupante.instanceId];
        }
        zone[slot] = realInstance;
        state.cardInstances[instanceId] = realInstance;
        return realInstance;
    }

    /**
     * Aplica uma lista de reveals no estado local, ignorando (com aviso) os que
     * não se aplicam — o replay não pode morrer por um reveal repetido.
     */
    function applyReveals(state, reveals, options = {}) {
        const applied = [];
        (reveals || []).forEach(reveal => {
            try {
                applied.push(revealInstance(state, reveal, options));
            } catch (error) {
                console.warn('pvp-state: reveal ignorado —', error.message);
            }
        });
        return applied;
    }

    function fnv1a(texto) {
        let hash = 2166136261;
        for (let i = 0; i < texto.length; i++) {
            hash = Math.imul(hash ^ texto.charCodeAt(i), 16777619) >>> 0;
        }
        return hash >>> 0;
    }

    /**
     * Fábrica de ids opacos determinística: `i_<owner>_<hash>`.
     *
     * O hash é calculado sobre `definitionId + owner + sequência`, então o id não
     * expõe a definição nem a posição da carta no deck (spec parte 3, DoD 2).
     * A unicidade é garantida por um registro interno (o modelo lança em id
     * duplicado, então a fábrica nunca pode repetir).
     */
    function createPvpIdFactory(seed) {
        const hash = fnv1a;
        let sequence = 0;
        const usados = new Set();

        // `seed` entra na mistura para que duas salas não compartilhem ids.
        const sal = Number(seed) || 0;

        return function idFactory(definition, ownerId) {
            const definitionId = definition?.id || String(definition);
            sequence += 1;
            let id = `i_${ownerId}_${hash(`${definitionId}|${ownerId}|${sequence}|${sal}`).toString(36)}`;
            let desambiguador = 0;
            while (usados.has(id)) {
                desambiguador += 1;
                id = `i_${ownerId}_${hash(`${definitionId}|${ownerId}|${sequence}|${desambiguador}|${sal}`).toString(36)}`;
            }
            usados.add(id);
            return id;
        };
    }

    return {
        PLAYER_IDS,
        ZONE_NAMES,
        HIDDEN_PREFIX,
        createHiddenInstance,
        isHiddenInstance,
        createHiddenZone,
        installHiddenZones,
        createHiddenSlots,
        findHiddenSlot,
        resizeHiddenZone,
        revealInstance,
        applyReveals,
        createPvpIdFactory,
        fnv1a
    };
});