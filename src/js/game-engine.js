(function(root, factory) {
    let gameStateModel = root.GameStateModel;

    if (!gameStateModel && typeof require === 'function') {
        gameStateModel = require('./game-state.js');
    }

    const gameEngineApi = factory(gameStateModel);

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = gameEngineApi;
    }

    root.GameEngine = gameEngineApi;
})(typeof window !== 'undefined' ? window : globalThis, function(GameStateModel) {
    const EVENT_TYPES = Object.freeze({
        TURN_STARTED: 'TURN_STARTED',
        PHASE_STARTED: 'PHASE_STARTED',
        PHASE_ENDING: 'PHASE_ENDING',
        TURN_ENDING: 'TURN_ENDING',
        TURN_ENDED: 'TURN_ENDED',
        CARD_PLAYED: 'CARD_PLAYED',
        CREATURE_SUMMONED: 'CREATURE_SUMMONED',
        EQUIPMENT_ATTACHED: 'EQUIPMENT_ATTACHED',
        CARD_MOVED: 'CARD_MOVED',
        STATE_CHANGED: 'STATE_CHANGED',
        SOURCE_LEFT_FIELD: 'SOURCE_LEFT_FIELD'
    });

    const EFFECT_KINDS = Object.freeze({
        CHANGE_PLAYER_STAT: 'CHANGE_PLAYER_STAT',
        MOVE_CARD: 'MOVE_CARD',
        ADD_MODIFIER: 'ADD_MODIFIER',
        REMOVE_MODIFIER: 'REMOVE_MODIFIER',
        ADD_EFFECT: 'ADD_EFFECT',
        REMOVE_EFFECT: 'REMOVE_EFFECT',
        SET_TURN_STATE: 'SET_TURN_STATE',
        ATTACH_CARD: 'ATTACH_CARD',
        EMIT_EVENT: 'EMIT_EVENT'
    });

    const DURATION_KINDS = Object.freeze({
        UNTIL_END_OF_TURN: 'UNTIL_END_OF_TURN',
        UNTIL_END_OF_OPPONENT_TURN: 'UNTIL_END_OF_OPPONENT_TURN',
        FOR_CONTROLLER_TURNS: 'FOR_CONTROLLER_TURNS',
        FOR_TARGET_CONTROLLER_TURNS: 'FOR_TARGET_CONTROLLER_TURNS',
        UNTIL_SOURCE_LEAVES: 'UNTIL_SOURCE_LEAVES',
        UNTIL_NEXT_MATCHING_EVENT: 'UNTIL_NEXT_MATCHING_EVENT',
        PERMANENT_ON_INSTANCE: 'PERMANENT_ON_INSTANCE'
    });

    const LIMIT_KINDS = Object.freeze({
        PER_TURN: 'PER_TURN',
        PER_MATCH: 'PER_MATCH'
    });

    const MODIFIER_OPERATIONS = Object.freeze({
        SET: 'SET',
        ADD: 'ADD',
        MULTIPLY: 'MULTIPLY'
    });

    function createEngine(state, options = {}) {
        if (!GameStateModel || !state) {
            throw new Error('GameStateModel e gameState são obrigatórios');
        }

        const handlers = new Map();
        const maxEventsPerResolution = options.maxEventsPerResolution || 100;
        let handlerSequence = 0;
        let actionSequence = 0;
        let eventSequence = 0;
        let effectSequence = 0;
        let choiceSequence = 0;
        let isProcessingEvents = false;

        function ensureCollections() {
            if (!Array.isArray(state.effects)) state.effects = [];
            if (!Array.isArray(state.eventQueue)) state.eventQueue = [];
            if (!Array.isArray(state.eventLog)) state.eventLog = [];
            if (state.pendingChoice === undefined) state.pendingChoice = null;
        }

        function createTransaction() {
            ensureCollections();
            const undoOperations = [];
            const queueBefore = state.eventQueue.slice();
            const eventLogLength = state.eventLog.length;

            return {
                record(undoOperation) {
                    undoOperations.push(undoOperation);
                },
                rollback() {
                    for (let index = undoOperations.length - 1; index >= 0; index--) {
                        undoOperations[index]();
                    }
                    state.eventQueue.splice(0, state.eventQueue.length, ...queueBefore);
                    state.eventLog.length = eventLogLength;
                }
            };
        }

        function createId(prefix) {
            effectSequence++;
            return `${prefix}_${effectSequence}`;
        }

        function normalizeEffects(effects) {
            if (!effects) return [];
            return Array.isArray(effects) ? effects : [effects];
        }

        function createEvent(type, payload = {}, causeId = null) {
            if (!type || typeof type !== 'string') {
                throw new Error('Tipo de evento inválido');
            }

            eventSequence++;
            return Object.freeze({
                id: `event_${eventSequence}`,
                type,
                causeId,
                payload: Object.freeze({ ...payload })
            });
        }

        function enqueueEvent(type, payload, causeId) {
            const event = createEvent(type, payload, causeId);
            state.eventQueue.push(event);
            return event;
        }

        function getCard(instanceId) {
            return state.cardInstances[instanceId] || null;
        }

        function createContext(action = null, selection = []) {
            return Object.freeze({
                state,
                action,
                selection: Object.freeze([...selection]),
                getCard,
                getPlayerStat(playerId, stat) {
                    return GameStateModel.getPlayerStat(state, stat, playerId);
                },
                getEffectiveStat,
                canUseAbility
            });
        }

        function registerEventHandler(type, handler, priority = 0) {
            if (!type || typeof handler !== 'function') {
                throw new Error('Tipo e handler de evento são obrigatórios');
            }

            if (!handlers.has(type)) handlers.set(type, []);
            const registration = {
                handler,
                priority,
                order: handlerSequence++
            };
            handlers.get(type).push(registration);

            return function unregister() {
                const eventHandlers = handlers.get(type) || [];
                const index = eventHandlers.indexOf(registration);
                if (index !== -1) eventHandlers.splice(index, 1);
            };
        }

        function getOrderedHandlers(type) {
            return [...(handlers.get(type) || [])].sort((left, right) => {
                if (left.priority !== right.priority) return right.priority - left.priority;
                return left.order - right.order;
            });
        }

        function normalizeDuration(duration) {
            if (!duration) return null;
            const normalized = { ...duration };
            if (!Object.values(DURATION_KINDS).includes(normalized.kind)) {
                throw new Error(`Duração desconhecida: ${normalized.kind}`);
            }

            const requiredFieldByKind = {
                [DURATION_KINDS.UNTIL_END_OF_TURN]: 'playerId',
                [DURATION_KINDS.UNTIL_END_OF_OPPONENT_TURN]: 'controllerId',
                [DURATION_KINDS.FOR_CONTROLLER_TURNS]: 'controllerId',
                [DURATION_KINDS.FOR_TARGET_CONTROLLER_TURNS]: 'targetControllerId',
                [DURATION_KINDS.UNTIL_SOURCE_LEAVES]: 'sourceId'
            };
            const requiredField = requiredFieldByKind[normalized.kind];
            if (requiredField && !normalized[requiredField]) {
                throw new Error(`Duração ${normalized.kind} exige ${requiredField}`);
            }
            if (
                normalized.kind === DURATION_KINDS.UNTIL_NEXT_MATCHING_EVENT &&
                !normalized.eventType &&
                typeof normalized.predicate !== 'function'
            ) {
                throw new Error('Duração UNTIL_NEXT_MATCHING_EVENT exige eventType ou predicate');
            }

            if (
                [DURATION_KINDS.FOR_CONTROLLER_TURNS, DURATION_KINDS.FOR_TARGET_CONTROLLER_TURNS]
                    .includes(normalized.kind)
            ) {
                normalized.remaining = normalized.remaining ?? normalized.count;
                if (!Number.isInteger(normalized.remaining) || normalized.remaining < 1) {
                    throw new Error('Duração em turnos inválida');
                }
            }

            return normalized;
        }

        function validateEffectDescriptor(effect) {
            if (!effect || !Object.values(EFFECT_KINDS).includes(effect.kind)) {
                return { valid: false, reason: `Tipo de efeito desconhecido: ${effect?.kind}` };
            }

            if (effect.kind === EFFECT_KINDS.CHANGE_PLAYER_STAT) {
                if (!GameStateModel.PLAYER_IDS.includes(effect.playerId)) {
                    return { valid: false, reason: 'Jogador do efeito não encontrado' };
                }
                if (!['pv', 'energy', 'maxEnergy'].includes(effect.stat)) {
                    return { valid: false, reason: 'Stat do efeito inválido' };
                }
            }

            if (effect.kind === EFFECT_KINDS.MOVE_CARD) {
                if (!getCard(effect.instanceId)) {
                    return { valid: false, reason: 'Alvo de movimento não encontrado' };
                }
                if (!GameStateModel.ZONE_NAMES.includes(effect.destinationZone)) {
                    return { valid: false, reason: 'Destino de movimento inválido' };
                }
                if (!GameStateModel.PLAYER_IDS.includes(effect.destinationPlayerId)) {
                    return { valid: false, reason: 'Jogador de destino inválido' };
                }
            }

            if (
                [EFFECT_KINDS.ADD_MODIFIER, EFFECT_KINDS.REMOVE_MODIFIER]
                    .includes(effect.kind) &&
                !getCard(effect.targetId)
            ) {
                return { valid: false, reason: 'Alvo de modificador não encontrado' };
            }

            if (effect.kind === EFFECT_KINDS.ADD_MODIFIER) {
                try {
                    normalizeDuration(effect.modifier?.duration);
                } catch (error) {
                    return { valid: false, reason: error.message };
                }
            }

            if (effect.kind === EFFECT_KINDS.ADD_EFFECT) {
                try {
                    normalizeDuration(effect.effect?.duration);
                } catch (error) {
                    return { valid: false, reason: error.message };
                }
            }

            if (effect.kind === EFFECT_KINDS.SET_TURN_STATE) {
                const allowedFields = ['currentPlayer', 'currentPhase', 'turn'];
                const invalidField = Object.keys(effect.changes || {})
                    .find(field => !allowedFields.includes(field));
                if (invalidField) {
                    return { valid: false, reason: `Campo de turno inválido: ${invalidField}` };
                }
            }

            if (effect.kind === EFFECT_KINDS.ATTACH_CARD) {
                if (!getCard(effect.equipmentId) || !getCard(effect.targetId)) {
                    return { valid: false, reason: 'Equipamento ou alvo não encontrado' };
                }
            }

            if (effect.kind === EFFECT_KINDS.EMIT_EVENT && !effect.type) {
                return { valid: false, reason: 'Evento do efeito inválido' };
            }

            return { valid: true };
        }

        function getModifierContainer(targetId) {
            const target = getCard(targetId);
            if (!target) throw new Error(`Alvo não encontrado: ${targetId}`);
            if (!Array.isArray(target.modifiers)) target.modifiers = [];
            return target.modifiers;
        }

        function getUsageRecord(sourceId, abilityId) {
            const source = getCard(sourceId);
            if (!source) return null;
            if (!source.usage) source.usage = {};
            return source.usage[abilityId] || null;
        }

        function getUsageCount(sourceId, abilityId, limit) {
            const usage = getUsageRecord(sourceId, abilityId);
            if (!usage) return 0;

            if (limit.kind === LIMIT_KINDS.PER_MATCH) {
                return usage.matchCount || 0;
            }
            if (limit.kind === LIMIT_KINDS.PER_TURN) {
                return usage.turnCounts?.[state.turn] || 0;
            }

            throw new Error(`Limite desconhecido: ${limit.kind}`);
        }

        function canUseAbility(sourceId, abilityId, limit) {
            if (!limit) return true;
            const allowedCount = limit.count || 1;
            return getUsageCount(sourceId, abilityId, limit) < allowedCount;
        }

        function markAbilityUse(sourceId, abilityId, limit, transaction) {
            if (!limit) return;
            const source = getCard(sourceId);
            if (!source) throw new Error(`Fonte não encontrada: ${sourceId}`);

            const previousUsage = source.usage[abilityId]
                ? JSON.parse(JSON.stringify(source.usage[abilityId]))
                : undefined;
            const usage = source.usage[abilityId] || { matchCount: 0, turnCounts: {} };

            usage.matchCount++;
            usage.turnCounts[state.turn] = (usage.turnCounts[state.turn] || 0) + 1;
            source.usage[abilityId] = usage;

            transaction.record(() => {
                if (previousUsage) source.usage[abilityId] = previousUsage;
                else delete source.usage[abilityId];
            });
        }

        function applyEffect(effect, transaction, causeId) {
            if (!effect || !effect.kind) throw new Error('Descritor de efeito inválido');

            switch (effect.kind) {
                case EFFECT_KINDS.CHANGE_PLAYER_STAT: {
                    const previousValue = GameStateModel.getPlayerStat(
                        state,
                        effect.stat,
                        effect.playerId
                    );
                    const nextValue = effect.value !== undefined
                        ? effect.value
                        : previousValue + effect.amount;

                    GameStateModel.setPlayerStat(state, effect.stat, effect.playerId, nextValue, {
                        energyCap: effect.energyCap ?? state.players[effect.playerId].maxEnergy
                    });
                    transaction.record(() => {
                        GameStateModel.setPlayerStat(
                            state,
                            effect.stat,
                            effect.playerId,
                            previousValue,
                            { energyCap: Number.POSITIVE_INFINITY }
                        );
                    });
                    break;
                }

                case EFFECT_KINDS.MOVE_CARD: {
                    const source = GameStateModel.findCardLocations(state, effect.instanceId);
                    if (source.length !== 1) {
                        throw new Error(`Origem inválida para ${effect.instanceId}`);
                    }
                    const previous = source[0];
                    GameStateModel.moveCard(
                        state,
                        effect.instanceId,
                        effect.destinationZone,
                        effect.destinationPlayerId
                    );
                    transaction.record(() => {
                        GameStateModel.moveCard(
                            state,
                            effect.instanceId,
                            previous.zone,
                            previous.playerId
                        );
                        const restoredZone = state.players[previous.playerId].zones[previous.zone];
                        const restoredIndex = restoredZone
                            .findIndex(card => card.instanceId === effect.instanceId);
                        if (restoredIndex !== previous.index) {
                            const [restoredCard] = restoredZone.splice(restoredIndex, 1);
                            restoredZone.splice(previous.index, 0, restoredCard);
                        }
                    });
                    if (source[0].zone === 'field' && effect.destinationZone !== 'field') {
                        enqueueEvent(EVENT_TYPES.SOURCE_LEFT_FIELD, {
                            sourceId: effect.instanceId,
                            from: source[0].zone,
                            to: effect.destinationZone
                        }, causeId);
                    }
                    break;
                }

                case EFFECT_KINDS.ADD_MODIFIER: {
                    const modifiers = getModifierContainer(effect.targetId);
                    const modifier = {
                        ...effect.modifier,
                        id: effect.modifier.id || createId('modifier'),
                        targetId: effect.targetId,
                        duration: normalizeDuration(effect.modifier.duration)
                    };
                    if (modifiers.some(item => item.id === modifier.id)) {
                        throw new Error(`Modificador duplicado: ${modifier.id}`);
                    }
                    modifiers.push(modifier);
                    transaction.record(() => {
                        const index = modifiers.findIndex(item => item.id === modifier.id);
                        if (index !== -1) modifiers.splice(index, 1);
                    });
                    break;
                }

                case EFFECT_KINDS.REMOVE_MODIFIER: {
                    const modifiers = getModifierContainer(effect.targetId);
                    const index = modifiers.findIndex(item => item.id === effect.modifierId);
                    if (index === -1) break;
                    const [removed] = modifiers.splice(index, 1);
                    transaction.record(() => modifiers.splice(index, 0, removed));
                    break;
                }

                case EFFECT_KINDS.ADD_EFFECT: {
                    const activeEffect = {
                        ...effect.effect,
                        id: effect.effect.id || createId('effect'),
                        duration: normalizeDuration(effect.effect.duration)
                    };
                    if (state.effects.some(item => item.id === activeEffect.id)) {
                        throw new Error(`Efeito duplicado: ${activeEffect.id}`);
                    }
                    state.effects.push(activeEffect);
                    transaction.record(() => {
                        const index = state.effects.findIndex(item => item.id === activeEffect.id);
                        if (index !== -1) state.effects.splice(index, 1);
                    });
                    break;
                }

                case EFFECT_KINDS.REMOVE_EFFECT: {
                    const index = state.effects.findIndex(item => item.id === effect.effectId);
                    if (index === -1) break;
                    const [removed] = state.effects.splice(index, 1);
                    transaction.record(() => state.effects.splice(index, 0, removed));
                    break;
                }

                case EFFECT_KINDS.SET_TURN_STATE: {
                    const allowedFields = ['currentPlayer', 'currentPhase', 'turn'];
                    const changes = effect.changes || {};
                    const invalidField = Object.keys(changes)
                        .find(field => !allowedFields.includes(field));
                    if (invalidField) {
                        throw new Error(`Campo de turno inválido: ${invalidField}`);
                    }

                    const previousValues = {};
                    Object.entries(changes).forEach(([field, value]) => {
                        previousValues[field] = state[field];
                        state[field] = value;
                    });
                    transaction.record(() => {
                        Object.entries(previousValues).forEach(([field, value]) => {
                            state[field] = value;
                        });
                    });
                    break;
                }

                case EFFECT_KINDS.ATTACH_CARD: {
                    const equipment = getCard(effect.equipmentId);
                    const target = getCard(effect.targetId);
                    if (!equipment || !target) throw new Error('Equipamento ou alvo não encontrado');
                    if (equipment.zone !== 'equipment') {
                        throw new Error('A carta não está na zona de equipamento');
                    }

                    const previousAttachedTo = equipment.attachedTo;
                    const previousAttachments = [...target.attachments];
                    equipment.attachedTo = target.instanceId;
                    if (!target.attachments.includes(equipment.instanceId)) {
                        target.attachments.push(equipment.instanceId);
                    }
                    transaction.record(() => {
                        equipment.attachedTo = previousAttachedTo;
                        target.attachments.splice(
                            0,
                            target.attachments.length,
                            ...previousAttachments
                        );
                    });
                    break;
                }

                case EFFECT_KINDS.EMIT_EVENT:
                    enqueueEvent(effect.type, effect.payload, causeId);
                    if (effect.immediate) drainEventQueue(transaction);
                    break;

                default:
                    throw new Error(`Tipo de efeito desconhecido: ${effect.kind}`);
            }
        }

        function durationMatchesSource(duration, event) {
            const eventSourceId = event.payload.sourceId || event.payload.cardId;
            return event.type === EVENT_TYPES.SOURCE_LEFT_FIELD &&
                eventSourceId === duration.sourceId;
        }

        function advanceDuration(duration, event, transaction) {
            if (!duration || duration.kind === DURATION_KINDS.PERMANENT_ON_INSTANCE) {
                return false;
            }

            if (duration.kind === DURATION_KINDS.UNTIL_END_OF_TURN) {
                return event.type === EVENT_TYPES.TURN_ENDED &&
                    event.payload.playerId === duration.playerId &&
                    (duration.turnNumber === undefined || event.payload.turnNumber >= duration.turnNumber);
            }

            if (duration.kind === DURATION_KINDS.UNTIL_END_OF_OPPONENT_TURN) {
                return event.type === EVENT_TYPES.TURN_ENDED &&
                    event.payload.playerId !== duration.controllerId;
            }

            if (duration.kind === DURATION_KINDS.UNTIL_SOURCE_LEAVES) {
                return durationMatchesSource(duration, event);
            }

            if (duration.kind === DURATION_KINDS.UNTIL_NEXT_MATCHING_EVENT) {
                if (typeof duration.predicate === 'function') {
                    return Boolean(duration.predicate(event));
                }
                if (event.type !== duration.eventType) return false;
                if (!duration.subjectId) return true;
                return [
                    event.payload.subjectId,
                    event.payload.cardId,
                    event.payload.sourceId,
                    event.payload.targetId
                ].includes(duration.subjectId);
            }

            const controllerDuration = duration.kind === DURATION_KINDS.FOR_CONTROLLER_TURNS;
            const targetDuration = duration.kind === DURATION_KINDS.FOR_TARGET_CONTROLLER_TURNS;
            if (controllerDuration || targetDuration) {
                const expectedPlayer = controllerDuration
                    ? duration.controllerId
                    : duration.targetControllerId;
                if (event.type !== EVENT_TYPES.TURN_ENDED || event.payload.playerId !== expectedPlayer) {
                    return false;
                }

                const previousRemaining = duration.remaining;
                duration.remaining--;
                transaction.record(() => {
                    duration.remaining = previousRemaining;
                });
                return duration.remaining <= 0;
            }

            throw new Error(`Duração desconhecida: ${duration.kind}`);
        }

        function cleanupCollection(collection, event, transaction) {
            for (let index = collection.length - 1; index >= 0; index--) {
                const item = collection[index];
                if (!advanceDuration(item.duration, event, transaction)) continue;

                collection.splice(index, 1);
                transaction.record(() => collection.splice(index, 0, item));
            }
        }

        function cleanupExpiredEffects(event, transaction) {
            cleanupCollection(state.effects, event, transaction);
            Object.values(state.cardInstances).forEach(card => {
                cleanupCollection(card.modifiers || [], event, transaction);
            });
        }

        function drainEventQueue(transaction) {
            if (isProcessingEvents) return;
            isProcessingEvents = true;
            let processedEvents = 0;

            try {
                while (state.eventQueue.length > 0) {
                    processedEvents++;
                    if (processedEvents > maxEventsPerResolution) {
                        throw new Error('Limite de eventos excedido');
                    }

                    const event = state.eventQueue.shift();
                    state.eventLog.push(event);

                    getOrderedHandlers(event.type).forEach(registration => {
                        const effects = registration.handler(event, createContext());
                        normalizeEffects(effects).forEach(effect => {
                            applyEffect(effect, transaction, event.id);
                        });
                    });

                    cleanupExpiredEffects(event, transaction);
                }
            } finally {
                isProcessingEvents = false;
            }
        }

        function emit(type, payload = {}, causeId = null) {
            const transaction = createTransaction();
            try {
                const event = enqueueEvent(type, payload, causeId);
                drainEventQueue(transaction);
                return { status: 'resolved', event };
            } catch (error) {
                transaction.rollback();
                return { status: 'failed', reason: error.message, error };
            }
        }

        function validateSelection(choice, selection) {
            const selected = Array.isArray(selection) ? selection : [selection];
            const min = choice.min ?? 1;
            const max = choice.max ?? 1;

            if (selected.length < min || selected.length > max) {
                return { valid: false, reason: `Escolha exige entre ${min} e ${max} alvo(s)` };
            }
            if (new Set(selected).size !== selected.length) {
                return { valid: false, reason: 'A escolha contém alvos repetidos' };
            }
            if (selected.some(item => !choice.options.includes(item))) {
                return { valid: false, reason: 'A escolha contém alvo inválido' };
            }

            return { valid: true, selection: selected };
        }

        function validateAction(action, selection) {
            if (!action || !action.type || !action.actorId) {
                return { valid: false, reason: 'Ação inválida' };
            }
            if (!GameStateModel.PLAYER_IDS.includes(action.actorId)) {
                return { valid: false, reason: 'Jogador inválido' };
            }
            if (action.requiresTurn && state.currentPlayer !== action.actorId) {
                return { valid: false, reason: 'Não é o turno do jogador' };
            }

            const requiredPhases = Array.isArray(action.requiredPhase)
                ? action.requiredPhase
                : action.requiredPhase ? [action.requiredPhase] : [];
            if (requiredPhases.length > 0 && !requiredPhases.includes(state.currentPhase)) {
                return { valid: false, reason: 'Ação indisponível nesta fase' };
            }

            const source = action.sourceId ? getCard(action.sourceId) : null;
            if (action.sourceId && !source) {
                return { valid: false, reason: 'Fonte da ação não encontrada' };
            }
            if (source && action.requiresControl !== false && source.controllerId !== action.actorId) {
                return { valid: false, reason: 'O jogador não controla a fonte' };
            }
            if (source && action.sourceZone && source.zone !== action.sourceZone) {
                return { valid: false, reason: 'A fonte está em uma zona inválida' };
            }

            if (action.limit && !canUseAbility(action.sourceId, action.abilityId, action.limit)) {
                return { valid: false, reason: 'Limite de uso atingido' };
            }
            if (action.limit && (!action.sourceId || !action.abilityId)) {
                return { valid: false, reason: 'Limite exige fonte e habilidade' };
            }

            for (const cost of action.costs || []) {
                if (cost.kind !== 'PLAYER_STAT' || cost.amount < 0) {
                    return { valid: false, reason: 'Custo inválido' };
                }
                const currentValue = GameStateModel.getPlayerStat(
                    state,
                    cost.stat,
                    cost.playerId || action.actorId
                );
                if (currentValue < cost.amount) {
                    return { valid: false, reason: 'Recursos insuficientes' };
                }
            }

            const context = createContext(action, selection || []);
            for (const validator of action.validators || []) {
                const result = validator(context);
                if (result === false) return { valid: false, reason: 'Ação rejeitada' };
                if (typeof result === 'string') return { valid: false, reason: result };
                if (result && result.valid === false) return result;
            }

            if (action.choice && selection !== undefined) {
                const options = typeof action.choice.options === 'function'
                    ? action.choice.options(context)
                    : action.choice.options;
                return validateSelection({ ...action.choice, options }, selection);
            }

            return { valid: true, selection: selection || [] };
        }

        function executeAction(action, selection) {
            const validation = validateAction(action, selection);
            if (!validation.valid) {
                return { status: 'rejected', reason: validation.reason };
            }

            const actionId = action.id || `action_${++actionSequence}`;
            let actionEffects;
            try {
                const context = createContext(action, validation.selection);
                actionEffects = typeof action.effects === 'function'
                    ? action.effects(context)
                    : action.effects;
            } catch (error) {
                return { status: 'rejected', reason: error.message };
            }

            const normalizedActionEffects = normalizeEffects(actionEffects);
            for (const effect of normalizedActionEffects) {
                const effectValidation = validateEffectDescriptor(effect);
                if (!effectValidation.valid) {
                    return { status: 'rejected', reason: effectValidation.reason };
                }
            }

            const transaction = createTransaction();
            const eventLogStart = state.eventLog.length;

            try {
                (action.costs || []).forEach(cost => {
                    applyEffect({
                        kind: EFFECT_KINDS.CHANGE_PLAYER_STAT,
                        stat: cost.stat,
                        playerId: cost.playerId || action.actorId,
                        amount: -cost.amount
                    }, transaction, actionId);
                });

                if (action.declaredEvent) {
                    enqueueEvent(action.declaredEvent.type, action.declaredEvent.payload, actionId);
                }

                normalizedActionEffects.forEach(effect => {
                    applyEffect(effect, transaction, actionId);
                });

                (action.events || []).forEach(event => {
                    enqueueEvent(event.type, event.payload, actionId);
                });

                markAbilityUse(action.sourceId, action.abilityId, action.limit, transaction);
                drainEventQueue(transaction);

                return {
                    status: 'resolved',
                    actionId,
                    events: state.eventLog.slice(eventLogStart)
                };
            } catch (error) {
                transaction.rollback();
                return { status: 'failed', reason: error.message, error };
            }
        }

        function resolveAction(action) {
            ensureCollections();
            if (state.pendingChoice) {
                return { status: 'rejected', reason: 'Existe uma escolha pendente' };
            }

            const validation = validateAction(action);
            if (!validation.valid) {
                return { status: 'rejected', reason: validation.reason };
            }

            if (action.choice) {
                const context = createContext(action);
                const options = typeof action.choice.options === 'function'
                    ? action.choice.options(context)
                    : action.choice.options;
                if (!Array.isArray(options)) {
                    return { status: 'rejected', reason: 'Opções de escolha inválidas' };
                }
                const choiceId = `choice_${++choiceSequence}`;
                state.pendingChoice = {
                    id: choiceId,
                    action,
                    options: [...options],
                    min: action.choice.min ?? 1,
                    max: action.choice.max ?? 1
                };

                return {
                    status: 'pending_choice',
                    choiceId,
                    options: [...options],
                    min: state.pendingChoice.min,
                    max: state.pendingChoice.max
                };
            }

            return executeAction(action, []);
        }

        function resolveChoice(choiceId, selection) {
            const pendingChoice = state.pendingChoice;
            if (!pendingChoice || pendingChoice.id !== choiceId) {
                return { status: 'rejected', reason: 'Escolha pendente não encontrada' };
            }

            const selectionValidation = validateSelection(pendingChoice, selection);
            if (!selectionValidation.valid) {
                return { status: 'rejected', reason: selectionValidation.reason };
            }

            const result = executeAction(pendingChoice.action, selectionValidation.selection);
            if (result.status === 'resolved') state.pendingChoice = null;
            return result;
        }

        function cancelChoice(choiceId) {
            if (!state.pendingChoice || state.pendingChoice.id !== choiceId) return false;
            state.pendingChoice = null;
            return true;
        }

        function getEffectiveStat(instanceId, stat, context = {}) {
            const card = getCard(instanceId);
            if (!card) throw new Error(`Carta não encontrada: ${instanceId}`);

            const modifiers = (card.modifiers || []).filter(modifier => {
                return modifier.stat === stat &&
                    (!modifier.condition || modifier.condition(context, state, card));
            });
            const replacement = modifiers
                .filter(modifier => modifier.operation === MODIFIER_OPERATIONS.SET)
                .at(-1);
            const baseValue = replacement
                ? replacement.value
                : card.baseStats[stat] ?? card.data[stat] ?? 0;
            const additiveValue = modifiers
                .filter(modifier => modifier.operation === MODIFIER_OPERATIONS.ADD)
                .reduce((total, modifier) => total + modifier.value, 0);
            const multiplier = modifiers
                .filter(modifier => modifier.operation === MODIFIER_OPERATIONS.MULTIPLY)
                .reduce((total, modifier) => total * modifier.value, 1);

            return Math.max(0, (baseValue + additiveValue) * multiplier);
        }

        ensureCollections();

        return {
            state,
            registerEventHandler,
            emit,
            resolveAction,
            resolveChoice,
            cancelChoice,
            getEffectiveStat,
            getUsageCount,
            canUseAbility
        };
    }

    return {
        EVENT_TYPES,
        EFFECT_KINDS,
        DURATION_KINDS,
        LIMIT_KINDS,
        MODIFIER_OPERATIONS,
        createEngine
    };
});