(function(root, factory) {
    const gameStateModel = factory();

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = gameStateModel;
    }

    root.GameStateModel = gameStateModel;
})(typeof window !== 'undefined' ? window : globalThis, function() {
    const PLAYER_IDS = ['p1', 'p2'];
    const ZONE_NAMES = ['deck', 'hand', 'field', 'equipment', 'discard'];

    let nextInstanceSequence = 1;

    function createInstanceId(definition, ownerId) {
        const sequence = nextInstanceSequence++;
        return `${definition.id}_${ownerId}_${sequence}`;
    }

    function createZones() {
        return {
            deck: [],
            hand: [],
            field: [],
            equipment: [],
            discard: []
        };
    }

    function createPlayerState(initialPv, initialEnergy) {
        return {
            pv: initialPv,
            energy: initialEnergy,
            maxEnergy: initialEnergy,
            zones: createZones()
        };
    }

    function attachLegacyAliases(state) {
        state.cards = {};
        state.decks = {};
        state.maxEnergy = {};

        PLAYER_IDS.forEach(playerId => {
            const player = state.players[playerId];

            state.cards[playerId] = {
                hand: player.zones.hand,
                field: player.zones.field,
                equipment: player.zones.equipment,
                discard: player.zones.discard
            };
            state.decks[playerId] = player.zones.deck;

            Object.defineProperty(state.maxEnergy, playerId, {
                enumerable: true,
                configurable: true,
                get() {
                    return player.maxEnergy;
                },
                set(value) {
                    player.maxEnergy = value;
                }
            });
        });

        return state;
    }

    function createInitialGameState(options = {}) {
        const initialPv = options.initialPv ?? 200;
        const initialEnergy = options.initialEnergy ?? 6;

        return attachLegacyAliases({
            currentPlayer: 'p1',
            currentPhase: 'energy',
            turn: 1,
            diceUsed: { p1: false, p2: false },
            selectedCard: null,
            attackingCard: null,
            targetCard: null,
            attackedThisTurn: [],
            recentlySummoned: [],
            players: {
                p1: createPlayerState(initialPv, initialEnergy),
                p2: createPlayerState(initialPv, initialEnergy)
            },
            cardInstances: {},
            effects: [],
            pendingChoice: null,
            eventQueue: []
        });
    }

    function createCardInstance(definition, ownerId, options = {}) {
        if (!definition || !definition.id) {
            throw new Error('Definição de carta inválida');
        }
        if (!PLAYER_IDS.includes(ownerId)) {
            throw new Error(`Jogador inválido: ${ownerId}`);
        }

        const idFactory = options.idFactory || createInstanceId;
        const instanceId = options.instanceId || idFactory(definition, ownerId);

        return {
            id: instanceId,
            instanceId,
            definitionId: definition.id,
            ownerId,
            controllerId: ownerId,
            player: ownerId,
            zonePlayerId: ownerId,
            zone: options.zone || 'deck',
            baseStats: {
                attack: definition.attack || 0,
                defense: definition.defense || 0,
                cost: definition.cost || 0
            },
            damage: 0,
            attachments: [],
            attachedTo: null,
            modifiers: [],
            usage: {},
            data: { ...definition },
            element: null
        };
    }

    function resetMatchState(state, deckDefinitions, options = {}) {
        if (!state || !deckDefinitions) {
            throw new Error('Estado e decks são obrigatórios');
        }

        const nextState = createInitialGameState(options);
        Object.keys(state).forEach(key => delete state[key]);
        Object.assign(state, nextState);

        const idFactory = options.idFactory || createInstanceId;

        PLAYER_IDS.forEach(playerId => {
            const definitions = deckDefinitions[playerId] || [];

            definitions.forEach(definition => {
                const instance = createCardInstance(definition, playerId, {
                    idFactory,
                    zone: 'deck'
                });

                if (state.cardInstances[instance.instanceId]) {
                    throw new Error(`ID de instância duplicado: ${instance.instanceId}`);
                }

                state.cardInstances[instance.instanceId] = instance;
                state.players[playerId].zones.deck.push(instance);
            });
        });

        return state;
    }

    function findCardLocations(state, instanceId) {
        const locations = [];

        PLAYER_IDS.forEach(playerId => {
            ZONE_NAMES.forEach(zone => {
                const index = state.players[playerId].zones[zone]
                    .findIndex(card => card.instanceId === instanceId);

                if (index !== -1) {
                    locations.push({ playerId, zone, index });
                }
            });
        });

        return locations;
    }

    function registerCard(state, instance, destinationZone, destinationPlayerId) {
        if (!ZONE_NAMES.includes(destinationZone)) {
            throw new Error(`Zona inválida: ${destinationZone}`);
        }
        if (!PLAYER_IDS.includes(destinationPlayerId)) {
            throw new Error(`Jogador inválido: ${destinationPlayerId}`);
        }

        const registeredInstance = state.cardInstances[instance.instanceId];
        if (registeredInstance && registeredInstance !== instance) {
            throw new Error(`ID de instância duplicado: ${instance.instanceId}`);
        }
        if (findCardLocations(state, instance.instanceId).length !== 0) {
            throw new Error(`Instância já posicionada: ${instance.instanceId}`);
        }

        state.cardInstances[instance.instanceId] = instance;
        state.players[destinationPlayerId].zones[destinationZone].push(instance);
        instance.zone = destinationZone;
        instance.zonePlayerId = destinationPlayerId;
        instance.controllerId = destinationPlayerId;
        instance.player = destinationPlayerId;

        return instance;
    }

    function moveCard(state, instanceId, destinationZone, destinationPlayerId) {
        if (!ZONE_NAMES.includes(destinationZone)) {
            throw new Error(`Zona inválida: ${destinationZone}`);
        }
        if (!PLAYER_IDS.includes(destinationPlayerId)) {
            throw new Error(`Jogador inválido: ${destinationPlayerId}`);
        }

        const instance = state.cardInstances[instanceId];
        if (!instance) {
            throw new Error(`Instância não encontrada: ${instanceId}`);
        }

        const locations = findCardLocations(state, instanceId);
        if (locations.length !== 1) {
            throw new Error(`Instância ${instanceId} ocupa ${locations.length} zonas`);
        }

        const source = locations[0];
        state.players[source.playerId].zones[source.zone].splice(source.index, 1);
        state.players[destinationPlayerId].zones[destinationZone].push(instance);

        instance.zone = destinationZone;
        instance.zonePlayerId = destinationPlayerId;
        instance.controllerId = destinationPlayerId;
        instance.player = destinationPlayerId;

        return instance;
    }

    function drawCard(state, playerId) {
        const deck = state.players[playerId]?.zones.deck;
        if (!deck || deck.length === 0) return null;

        return moveCard(state, deck[0].instanceId, 'hand', playerId);
    }

    function getPlayerStat(state, stat, playerId) {
        const player = state.players[playerId];
        if (!player || !['pv', 'energy', 'maxEnergy'].includes(stat)) {
            throw new Error(`Stat inválido: ${stat}/${playerId}`);
        }
        return player[stat];
    }

    function setPlayerStat(state, stat, playerId, value, options = {}) {
        const player = state.players[playerId];
        if (!player || !['pv', 'energy', 'maxEnergy'].includes(stat)) {
            throw new Error(`Stat inválido: ${stat}/${playerId}`);
        }

        let nextValue = Math.max(0, Number(value) || 0);
        if (stat === 'energy') {
            const energyCap = options.energyCap ?? player.maxEnergy;
            nextValue = Math.min(nextValue, energyCap);
        }

        player[stat] = nextValue;
        return nextValue;
    }

    function changePlayerStat(state, stat, playerId, amount, options = {}) {
        const currentValue = getPlayerStat(state, stat, playerId);
        return setPlayerStat(state, stat, playerId, currentValue + amount, options);
    }

    return {
        PLAYER_IDS,
        ZONE_NAMES,
        attachLegacyAliases,
        createInitialGameState,
        createCardInstance,
        resetMatchState,
        findCardLocations,
        registerCard,
        moveCard,
        drawCard,
        getPlayerStat,
        setPlayerStat,
        changePlayerStat
    };
});