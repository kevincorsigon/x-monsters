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
        ATTACK_DECLARED: 'ATTACK_DECLARED',
        BECAME_ATTACK_TARGET: 'BECAME_ATTACK_TARGET',
        BEFORE_DAMAGE: 'BEFORE_DAMAGE',
        DAMAGE_DEALT: 'DAMAGE_DEALT',
        CREATURE_WOULD_DIE: 'CREATURE_WOULD_DIE',
        CREATURE_DESTROYED: 'CREATURE_DESTROYED',
        CREATURE_DEFEATED: 'CREATURE_DEFEATED',
        AFTER_ATTACK: 'AFTER_ATTACK',
        EFFECT_PREVENTED: 'EFFECT_PREVENTED',
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
        APPLY_CARD_DAMAGE: 'APPLY_CARD_DAMAGE',
        APPLY_DAMAGE_BATCH: 'APPLY_DAMAGE_BATCH',
        MODIFY_COMBAT: 'MODIFY_COMBAT',
        RECORD_ATTACK: 'RECORD_ATTACK',
        RECORD_ABILITY_USE: 'RECORD_ABILITY_USE',
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
        const effectInterceptors = [];
        const maxEventsPerResolution = options.maxEventsPerResolution || 100;
        let handlerSequence = 0;
        let actionSequence = 0;
        let eventSequence = 0;
        let effectSequence = 0;
        let choiceSequence = 0;
        let isProcessingEvents = false;
        const activeCombats = new Map();

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

        function registerEffectInterceptor(interceptor, priority = 0) {
            if (typeof interceptor !== 'function') {
                throw new Error('Interceptor de efeito inválido');
            }
            const registration = {
                interceptor,
                priority,
                order: handlerSequence++
            };
            effectInterceptors.push(registration);

            return function unregister() {
                const index = effectInterceptors.indexOf(registration);
                if (index !== -1) effectInterceptors.splice(index, 1);
            };
        }

        function resolveProvenance(effect, trusted = {}) {
            const declared = effect.provenance || {};
            const declaredSourceId = declared.sourceId || effect.sourceId ||
                effect.modifier?.sourceId || effect.effect?.sourceId || null;
            const sourceId = trusted.sourceId ||
                (trusted.allowEffectSource ? declaredSourceId : null);
            const source = sourceId ? getCard(sourceId) : null;
            return Object.freeze({
                kind: trusted.kind || (source ? 'ability' : 'system'),
                sourceId,
                abilityId: trusted.abilityId ||
                    (trusted.allowEffectSource ? declared.abilityId || effect.abilityId : null) ||
                    null,
                sourceDefinitionId: source?.definitionId || null,
                sourceControllerId: source?.controllerId || null,
                sourceType: source?.data.type || null,
                sourceCost: source?.data.cost ?? null,
                sourceAttack: trusted.sourceAttack ??
                    (source ? getEffectiveStat(source.instanceId, 'attack') : null)
            });
        }

        function getEffectTarget(effect) {
            const targetId = effect.targetId ||
                (effect.kind === EFFECT_KINDS.MOVE_CARD ? effect.instanceId : null);
            return {
                targetId,
                target: targetId ? getCard(targetId) : null,
                playerId: effect.playerId || null
            };
        }

        function checkEffectPrevention(effect, trustedProvenance) {
            const provenance = resolveProvenance(effect, trustedProvenance);
            const targetInfo = getEffectTarget(effect);
            const context = Object.freeze({
                state,
                effect,
                provenance,
                ...targetInfo
            });
            const ordered = [...effectInterceptors].sort((left, right) => {
                if (left.priority !== right.priority) return right.priority - left.priority;
                return left.order - right.order;
            });

            for (const registration of ordered) {
                const result = registration.interceptor(context);
                if (result?.prevented) {
                    return { ...result, provenance, ...targetInfo };
                }
            }
            return { prevented: false, provenance, ...targetInfo };
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

            if (effect.kind === EFFECT_KINDS.APPLY_CARD_DAMAGE && !getCard(effect.targetId)) {
                return { valid: false, reason: 'Alvo de dano não encontrado' };
            }
            if (effect.kind === EFFECT_KINDS.APPLY_DAMAGE_BATCH) {
                if (
                    !Array.isArray(effect.targetIds) ||
                    new Set(effect.targetIds).size !== effect.targetIds.length ||
                    effect.targetIds.some(targetId => !getCard(targetId)) ||
                    effect.amount < 0
                ) {
                    return { valid: false, reason: 'Lote de dano inválido' };
                }
            }

            if (effect.kind === EFFECT_KINDS.MODIFY_COMBAT) {
                const allowedFields = [
                    'attackPower',
                    'defenderPower',
                    'damageToTarget',
                    'damageToAttacker',
                    'directDamage',
                    'penetratingDamage',
                    'cancelled',
                    'preventTargetDeath',
                    'preventAttackerDeath'
                ];
                if (!allowedFields.includes(effect.field)) {
                    return { valid: false, reason: 'Campo de combate inválido' };
                }
            }

            if (effect.kind === EFFECT_KINDS.RECORD_ATTACK && !getCard(effect.attackerId)) {
                return { valid: false, reason: 'Atacante não encontrado' };
            }
            if (
                effect.kind === EFFECT_KINDS.RECORD_ABILITY_USE &&
                (!getCard(effect.sourceId) || !effect.abilityId || !effect.limit)
            ) {
                return { valid: false, reason: 'Registro de habilidade inválido' };
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

        function applyEffect(effect, transaction, causeId, trustedProvenance = {}) {
            if (!effect || !effect.kind) throw new Error('Descritor de efeito inválido');
            const prevention = checkEffectPrevention(effect, trustedProvenance);
            if (prevention.prevented) {
                enqueueEvent(EVENT_TYPES.EFFECT_PREVENTED, {
                    targetId: prevention.targetId,
                    playerId: prevention.playerId,
                    effectKind: effect.kind,
                    attemptedAmount: effect.amount ?? null,
                    preventionId: prevention.preventionId || null,
                    provenance: prevention.provenance
                }, causeId);
                return {
                    applied: false,
                    prevented: true,
                    attemptedAmount: effect.amount ?? null,
                    appliedAmount: 0,
                    provenance: prevention.provenance
                };
            }

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
                    return {
                        applied: true,
                        attemptedAmount: effect.amount ?? null,
                        appliedAmount: effect.amount ?? null,
                        provenance: prevention.provenance
                    };
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
                    if (
                        ['field', 'equipment'].includes(source[0].zone) &&
                        effect.destinationZone !== source[0].zone
                    ) {
                        enqueueEvent(EVENT_TYPES.SOURCE_LEFT_FIELD, {
                            sourceId: effect.instanceId,
                            from: source[0].zone,
                            to: effect.destinationZone
                        }, causeId);
                    }
                    return { applied: true, provenance: prevention.provenance };
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

                case EFFECT_KINDS.APPLY_CARD_DAMAGE: {
                    const target = getCard(effect.targetId);
                    if (!target) throw new Error(`Alvo de dano não encontrado: ${effect.targetId}`);
                    const previousDamage = target.damage;
                    target.damage = Math.max(0, target.damage + effect.amount);
                    transaction.record(() => {
                        target.damage = previousDamage;
                    });
                    return {
                        applied: true,
                        attemptedAmount: effect.amount,
                        appliedAmount: effect.amount,
                        provenance: prevention.provenance
                    };
                }

                case EFFECT_KINDS.APPLY_DAMAGE_BATCH: {
                    const source = getCard(effect.sourceId);
                    if (!source) throw new Error(`Fonte de dano não encontrada: ${effect.sourceId}`);
                    const targets = effect.targetIds.map(targetId => getCard(targetId));
                    const snapshots = targets.map(target => ({
                        card: target,
                        ownerId: target.ownerId,
                        controllerId: target.controllerId,
                        attackSnapshot: getEffectiveStat(target.instanceId, 'attack'),
                        attachmentsSnapshot: [...target.attachments]
                    }));

                    const damageResults = new Map();
                    targets.forEach(target => {
                        const result = applyEffect({
                            kind: EFFECT_KINDS.APPLY_CARD_DAMAGE,
                            targetId: target.instanceId,
                            amount: effect.amount,
                            sourceId: source.instanceId,
                            provenance: effect.provenance || {
                                kind: 'ability',
                                sourceId: source.instanceId,
                                abilityId: effect.abilityId || null
                            }
                        }, transaction, causeId, prevention.provenance);
                        damageResults.set(target.instanceId, result);
                    });
                    targets.forEach(target => {
                        const result = damageResults.get(target.instanceId);
                        if (!result?.applied || result.appliedAmount <= 0) return;
                        applyEffect({
                            kind: EFFECT_KINDS.EMIT_EVENT,
                            type: EVENT_TYPES.DAMAGE_DEALT,
                            payload: {
                                sourceId: source.instanceId,
                                damagedId: target.instanceId,
                                amount: result.appliedAmount,
                                attemptedAmount: result.attemptedAmount,
                                damageType: effect.damageType || 'ability',
                                provenance: result.provenance
                            },
                            immediate: true
                        }, transaction, causeId);
                    });

                    snapshots.filter(snapshot =>
                        snapshot.card.zone === 'field' &&
                        getRemainingDefense(snapshot.card.instanceId) <= 0
                    ).forEach(snapshot => {
                        snapshot.attachmentsSnapshot.forEach(attachmentId => {
                            const attachment = getCard(attachmentId);
                            if (!attachment || attachment.zone !== 'equipment') return;
                            const previousAttachedTo = attachment.attachedTo;
                            attachment.attachedTo = null;
                            transaction.record(() => {
                                attachment.attachedTo = previousAttachedTo;
                            });
                            applyEffect({
                                kind: EFFECT_KINDS.MOVE_CARD,
                                instanceId: attachment.instanceId,
                                destinationZone: 'discard',
                                destinationPlayerId: attachment.ownerId
                            }, transaction, causeId);
                        });

                        const previousAttachments = [...snapshot.card.attachments];
                        snapshot.card.attachments = [];
                        transaction.record(() => {
                            snapshot.card.attachments = previousAttachments;
                        });
                        applyEffect({
                            kind: EFFECT_KINDS.MOVE_CARD,
                            instanceId: snapshot.card.instanceId,
                            destinationZone: 'discard',
                            destinationPlayerId: snapshot.ownerId
                        }, transaction, causeId);
                        applyEffect({
                            kind: EFFECT_KINDS.EMIT_EVENT,
                            type: EVENT_TYPES.CREATURE_DESTROYED,
                            payload: {
                                cardId: snapshot.card.instanceId,
                                ownerId: snapshot.ownerId,
                                controllerId: snapshot.controllerId,
                                attackSnapshot: snapshot.attackSnapshot,
                                attachmentsSnapshot: snapshot.attachmentsSnapshot
                            },
                            immediate: true
                        }, transaction, causeId);
                        applyEffect({
                            kind: EFFECT_KINDS.EMIT_EVENT,
                            type: EVENT_TYPES.CREATURE_DEFEATED,
                            payload: {
                                sourceId: source.instanceId,
                                defeatedId: snapshot.card.instanceId,
                                defeatedOwnerId: snapshot.ownerId,
                                defeatedControllerId: snapshot.controllerId,
                                sourceOwnerId: source.ownerId,
                                sourceControllerId: source.controllerId
                            },
                            immediate: true
                        }, transaction, causeId);
                    });
                    break;
                }

                case EFFECT_KINDS.MODIFY_COMBAT: {
                    const combat = activeCombats.get(effect.combatId);
                    if (!combat) throw new Error(`Combate não encontrado: ${effect.combatId}`);
                    const previousValue = combat[effect.field];
                    const operation = effect.operation || MODIFIER_OPERATIONS.SET;
                    const effectValue = typeof effect.value === 'function'
                        ? effect.value(combat)
                        : effect.value;
                    if (operation === MODIFIER_OPERATIONS.SET) combat[effect.field] = effectValue;
                    else if (operation === MODIFIER_OPERATIONS.ADD) combat[effect.field] += effectValue;
                    else if (operation === MODIFIER_OPERATIONS.MULTIPLY) combat[effect.field] *= effectValue;
                    else throw new Error(`Operação de combate inválida: ${operation}`);
                    transaction.record(() => {
                        combat[effect.field] = previousValue;
                    });
                    break;
                }

                case EFFECT_KINDS.RECORD_ATTACK: {
                    const attacker = getCard(effect.attackerId);
                    if (!attacker) throw new Error(`Atacante não encontrado: ${effect.attackerId}`);
                    const previousUsage = attacker.usage.combatAttacks
                        ? {
                            ...attacker.usage.combatAttacks,
                            targets: [...(attacker.usage.combatAttacks.targets || [])]
                        }
                        : undefined;
                    const currentCount = previousUsage?.turnNumber === state.turn
                        ? previousUsage.count
                        : 0;
                    const currentTargets = previousUsage?.turnNumber === state.turn
                        ? previousUsage.targets || []
                        : [];
                    attacker.usage.combatAttacks = {
                        turnNumber: state.turn,
                        count: currentCount + 1,
                        targets: effect.targetId
                            ? [...currentTargets, effect.targetId]
                            : [...currentTargets],
                        directAttacks: (previousUsage?.turnNumber === state.turn
                            ? previousUsage.directAttacks || 0
                            : 0) + (effect.isDirect ? 1 : 0)
                    };
                    transaction.record(() => {
                        if (previousUsage) attacker.usage.combatAttacks = previousUsage;
                        else delete attacker.usage.combatAttacks;
                    });
                    break;
                }

                case EFFECT_KINDS.RECORD_ABILITY_USE:
                    markAbilityUse(effect.sourceId, effect.abilityId, effect.limit, transaction);
                    break;

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
                            applyEffect(effect, transaction, event.id, {
                                allowEffectSource: true
                            });
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
                    }, transaction, actionId, { kind: 'system' });
                });

                if (action.declaredEvent) {
                    enqueueEvent(action.declaredEvent.type, action.declaredEvent.payload, actionId);
                }

                normalizedActionEffects.forEach(effect => {
                    applyEffect(effect, transaction, actionId, {
                        kind: 'ability',
                        sourceId: action.sourceId,
                        abilityId: action.abilityId || null
                    });
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
            const getModifierValue = modifier => typeof modifier.value === 'function'
                ? modifier.value(context, state, card)
                : modifier.value;
            const replacement = modifiers
                .filter(modifier => modifier.operation === MODIFIER_OPERATIONS.SET)
                .at(-1);
            const baseValue = replacement
                ? getModifierValue(replacement)
                : card.baseStats[stat] ?? card.data[stat] ?? 0;
            const additiveValue = modifiers
                .filter(modifier => modifier.operation === MODIFIER_OPERATIONS.ADD)
                .reduce((total, modifier) => total + getModifierValue(modifier), 0);
            const multiplier = modifiers
                .filter(modifier => modifier.operation === MODIFIER_OPERATIONS.MULTIPLY)
                .reduce((total, modifier) => total * getModifierValue(modifier), 1);

            return Math.max(0, (baseValue + additiveValue) * multiplier);
        }

        function getRemainingDefense(instanceId, context = {}) {
            const card = getCard(instanceId);
            if (!card) throw new Error(`Carta não encontrada: ${instanceId}`);
            return Math.max(0, getEffectiveStat(instanceId, 'defense', context) - card.damage);
        }

        function getAttackCount(instanceId) {
            const card = getCard(instanceId);
            if (!card) return 0;
            const usage = card.usage?.combatAttacks;
            return usage?.turnNumber === state.turn ? usage.count : 0;
        }

        function getAttackTargets(instanceId) {
            const card = getCard(instanceId);
            const usage = card?.usage?.combatAttacks;
            return usage?.turnNumber === state.turn ? [...(usage.targets || [])] : [];
        }

        function getAttackLimit(instanceId, context = {}) {
            const card = getCard(instanceId);
            if (!card) return 0;
            const modifiers = (card.modifiers || []).filter(modifier =>
                modifier.stat === 'attackLimit' &&
                (!modifier.condition || modifier.condition(context, state, card))
            );
            const valueOf = modifier => typeof modifier.value === 'function'
                ? modifier.value(context, state, card)
                : modifier.value;
            const fixedLimit = modifiers
                .filter(modifier => modifier.operation === MODIFIER_OPERATIONS.SET)
                .reduce((maximum, modifier) => Math.max(maximum, valueOf(modifier)), 1);
            const additionalAttacks = modifiers
                .filter(modifier => modifier.operation === MODIFIER_OPERATIONS.ADD)
                .reduce((total, modifier) => total + valueOf(modifier), 0);
            return Math.max(1, fixedLimit + additionalAttacks);
        }

        function canAttack(instanceId, options = {}) {
            const attacker = getCard(instanceId);
            if (!attacker) return { canAttack: false, reason: 'Atacante não encontrado' };
            if (state.currentPhase !== 'combat') {
                return { canAttack: false, reason: 'Ataques só são permitidos na Fase de Combate' };
            }
            if (attacker.zone !== 'field') {
                return { canAttack: false, reason: 'O atacante não está em campo' };
            }
            if (attacker.controllerId !== state.currentPlayer) {
                return { canAttack: false, reason: 'O jogador não controla o atacante' };
            }
            if (!['criatura', 'evolução'].includes(attacker.data.type)) {
                return { canAttack: false, reason: 'Esta carta não pode atacar' };
            }

            const attackLimit = options.attackLimit ?? getAttackLimit(instanceId, options);
            if (getAttackCount(instanceId) >= attackLimit) {
                return { canAttack: false, reason: 'Esta carta já usou todos os ataques do turno' };
            }

            return { canAttack: true, attackLimit };
        }

        function validateCombat(options) {
            const attackerCheck = canAttack(options.attackerId, options);
            if (!attackerCheck.canAttack) return { valid: false, reason: attackerCheck.reason };

            const attacker = getCard(options.attackerId);
            const defenderPlayerId = options.defenderPlayerId ||
                (attacker.controllerId === 'p1' ? 'p2' : 'p1');

            if (options.isDirect) {
                if (!GameStateModel.PLAYER_IDS.includes(defenderPlayerId)) {
                    return { valid: false, reason: 'Jogador defensor inválido' };
                }
                if (defenderPlayerId === attacker.controllerId) {
                    return { valid: false, reason: 'Não é possível atacar o próprio jogador' };
                }
                if (options.allowDirectAttack === false) {
                    const defenders = state.players[defenderPlayerId].zones.field
                        .filter(card => ['criatura', 'evolução'].includes(card.data.type));
                    if (defenders.length > 0) {
                        return { valid: false, reason: 'Há criaturas protegendo o jogador' };
                    }
                }
                return { valid: true, attacker, defenderPlayerId, attackLimit: attackerCheck.attackLimit };
            }

            const target = getCard(options.targetId);
            if (!target) return { valid: false, reason: 'Alvo não encontrado' };
            if (target.zone !== 'field') return { valid: false, reason: 'O alvo não está em campo' };
            if (target.controllerId === attacker.controllerId) {
                return { valid: false, reason: 'Não é possível atacar uma carta aliada' };
            }
            if (!['criatura', 'evolução'].includes(target.data.type)) {
                return { valid: false, reason: 'O alvo não é uma criatura válida' };
            }

            if (options.targetValidator) {
                const result = options.targetValidator({ state, attacker, target });
                if (result === false) return { valid: false, reason: 'Ataque bloqueado' };
                if (typeof result === 'string') return { valid: false, reason: result };
                if (result && result.valid === false) return result;
            }

            return {
                valid: true,
                attacker,
                target,
                defenderPlayerId: target.controllerId,
                attackLimit: attackerCheck.attackLimit
            };
        }

        function emitCombatEvent(type, combat, transaction, payload = {}) {
            applyEffect({
                kind: EFFECT_KINDS.EMIT_EVENT,
                type,
                payload: {
                    combatId: combat.id,
                    attackerId: combat.attackerId,
                    targetId: combat.targetId,
                    attackOrdinal: combat.attackOrdinal,
                    isDirect: combat.isDirect,
                    attackPower: combat.attackPower,
                    defenderPower: combat.defenderPower,
                    targetDefenseBefore: combat.targetDefenseBefore,
                    attackerDefenseBefore: combat.attackerDefenseBefore,
                    damageToTarget: combat.damageToTarget,
                    damageToAttacker: combat.damageToAttacker,
                    directDamage: combat.directDamage,
                    ...payload
                },
                immediate: true
            }, transaction, combat.id);
        }

        function moveDestroyedCard(card, combat, transaction) {
            const attachments = [...card.attachments];
            attachments.forEach(attachmentId => {
                const attachment = getCard(attachmentId);
                if (!attachment || attachment.zone !== 'equipment') return;
                const previousAttachedTo = attachment.attachedTo;
                attachment.attachedTo = null;
                transaction.record(() => {
                    attachment.attachedTo = previousAttachedTo;
                });
                applyEffect({
                    kind: EFFECT_KINDS.MOVE_CARD,
                    instanceId: attachmentId,
                    destinationZone: 'discard',
                    destinationPlayerId: attachment.ownerId
                }, transaction, combat.id);
            });

            const previousAttachments = [...card.attachments];
            card.attachments = [];
            transaction.record(() => {
                card.attachments = previousAttachments;
            });

            applyEffect({
                kind: EFFECT_KINDS.MOVE_CARD,
                instanceId: card.instanceId,
                destinationZone: 'discard',
                destinationPlayerId: card.ownerId
            }, transaction, combat.id);
        }

        function resolveCombat(options) {
            const validation = validateCombat(options);
            if (!validation.valid) return { status: 'rejected', reason: validation.reason };

            const attacker = validation.attacker;
            const target = validation.target || null;
            const combatId = `combat_${++actionSequence}`;
            const attackOrdinal = getAttackCount(attacker.instanceId) + 1;
            const combat = {
                id: combatId,
                attackerId: attacker.instanceId,
                targetId: target?.instanceId || null,
                attackerPlayerId: attacker.controllerId,
                defenderPlayerId: validation.defenderPlayerId,
                attackOrdinal,
                isDirect: Boolean(options.isDirect),
                attackPower: getEffectiveStat(attacker.instanceId, 'attack', { attackOrdinal }),
                defenderPower: target
                    ? getEffectiveStat(target.instanceId, 'attack', { defending: true })
                    : 0,
                targetDefenseBefore: target ? getRemainingDefense(target.instanceId) : 0,
                attackerDefenseBefore: getRemainingDefense(attacker.instanceId),
                damageToTarget: 0,
                damageToAttacker: 0,
                directDamage: 0,
                penetratingDamage: null,
                cancelled: false,
                preventTargetDeath: false,
                preventAttackerDeath: false,
                defeated: []
            };
            combat.damageToTarget = combat.attackPower;
            combat.damageToAttacker = combat.defenderPower;
            combat.directDamage = combat.attackPower;

            const transaction = createTransaction();
            activeCombats.set(combatId, combat);

            try {
                emitCombatEvent(EVENT_TYPES.ATTACK_DECLARED, combat, transaction);
                if (target) emitCombatEvent(EVENT_TYPES.BECAME_ATTACK_TARGET, combat, transaction);
                emitCombatEvent(EVENT_TYPES.BEFORE_DAMAGE, combat, transaction);

                if (combat.cancelled) {
                    applyEffect({
                        kind: EFFECT_KINDS.RECORD_ATTACK,
                        attackerId: attacker.instanceId,
                        targetId: target?.instanceId || null,
                        isDirect: combat.isDirect
                    }, transaction, combatId);
                    emitCombatEvent(EVENT_TYPES.AFTER_ATTACK, combat, transaction, { cancelled: true });
                    return {
                        status: 'resolved',
                        combatId,
                        attackerId: combat.attackerId,
                        targetId: combat.targetId,
                        attackOrdinal,
                        isDirect: combat.isDirect,
                        cancelled: true,
                        defeated: []
                    };
                }

                combat.damageToTarget = Math.max(0, combat.damageToTarget);
                combat.damageToAttacker = Math.max(0, combat.damageToAttacker);
                combat.directDamage = Math.max(0, combat.directDamage);

                if (combat.isDirect) {
                    const directResult = applyEffect({
                        kind: EFFECT_KINDS.CHANGE_PLAYER_STAT,
                        stat: 'pv',
                        playerId: combat.defenderPlayerId,
                        amount: -combat.directDamage,
                        changeType: 'damage',
                        provenance: {
                            kind: 'combat',
                            sourceId: attacker.instanceId,
                            sourceAttack: combat.attackPower
                        }
                    }, transaction, combatId, {
                        kind: 'combat',
                        sourceId: attacker.instanceId,
                        sourceAttack: combat.attackPower
                    });
                    combat.directDamage = directResult.applied
                        ? Math.abs(directResult.appliedAmount)
                        : 0;
                    if (combat.directDamage > 0) {
                        emitCombatEvent(EVENT_TYPES.DAMAGE_DEALT, combat, transaction, {
                            sourceId: attacker.instanceId,
                            playerId: combat.defenderPlayerId,
                            amount: combat.directDamage,
                            damageType: 'physical',
                            provenance: directResult.provenance
                        });
                    }
                } else {
                    const targetDamageResult = applyEffect({
                        kind: EFFECT_KINDS.APPLY_CARD_DAMAGE,
                        targetId: target.instanceId,
                        amount: combat.damageToTarget,
                        provenance: {
                            kind: 'combat',
                            sourceId: attacker.instanceId,
                            sourceAttack: combat.attackPower
                        }
                    }, transaction, combatId, {
                        kind: 'combat',
                        sourceId: attacker.instanceId,
                        sourceAttack: combat.attackPower
                    });
                    const attackerDamageResult = applyEffect({
                        kind: EFFECT_KINDS.APPLY_CARD_DAMAGE,
                        targetId: attacker.instanceId,
                        amount: combat.damageToAttacker,
                        provenance: {
                            kind: 'combat',
                            sourceId: target.instanceId,
                            sourceAttack: combat.defenderPower
                        }
                    }, transaction, combatId, {
                        kind: 'combat',
                        sourceId: target.instanceId,
                        sourceAttack: combat.defenderPower
                    });
                    combat.damageToTarget = targetDamageResult.applied
                        ? targetDamageResult.appliedAmount
                        : 0;
                    combat.damageToAttacker = attackerDamageResult.applied
                        ? attackerDamageResult.appliedAmount
                        : 0;

                    if (combat.damageToTarget > 0) {
                        emitCombatEvent(EVENT_TYPES.DAMAGE_DEALT, combat, transaction, {
                            sourceId: attacker.instanceId,
                            damagedId: target.instanceId,
                            amount: combat.damageToTarget,
                            damageType: 'physical',
                            provenance: targetDamageResult.provenance
                        });
                    }
                    if (combat.damageToAttacker > 0) {
                        emitCombatEvent(EVENT_TYPES.DAMAGE_DEALT, combat, transaction, {
                            sourceId: target.instanceId,
                            damagedId: attacker.instanceId,
                            amount: combat.damageToAttacker,
                            damageType: 'physical',
                            provenance: attackerDamageResult.provenance
                        });
                    }

                    const targetWouldDie = getRemainingDefense(target.instanceId) <= 0;
                    const attackerWouldDie = getRemainingDefense(attacker.instanceId) <= 0;
                    if (targetWouldDie) {
                        emitCombatEvent(EVENT_TYPES.CREATURE_WOULD_DIE, combat, transaction, {
                            cardId: target.instanceId,
                            ownerId: target.ownerId,
                            controllerId: target.controllerId
                        });
                    }
                    if (attackerWouldDie) {
                        emitCombatEvent(EVENT_TYPES.CREATURE_WOULD_DIE, combat, transaction, {
                            cardId: attacker.instanceId,
                            ownerId: attacker.ownerId,
                            controllerId: attacker.controllerId
                        });
                    }

                    const targetDestroyed = targetWouldDie && !combat.preventTargetDeath;
                    const attackerDestroyed = attackerWouldDie && !combat.preventAttackerDeath;
                    combat.penetratingDamage = combat.penetratingDamage ??
                        (targetDestroyed
                            ? Math.max(0, combat.damageToTarget - combat.targetDefenseBefore)
                            : 0);

                    if (combat.penetratingDamage > 0) {
                        const penetratingResult = applyEffect({
                            kind: EFFECT_KINDS.CHANGE_PLAYER_STAT,
                            stat: 'pv',
                            playerId: combat.defenderPlayerId,
                            amount: -combat.penetratingDamage,
                            changeType: 'damage',
                            provenance: {
                                kind: 'combat',
                                sourceId: attacker.instanceId,
                                sourceAttack: combat.attackPower
                            }
                        }, transaction, combatId, {
                            kind: 'combat',
                            sourceId: attacker.instanceId,
                            sourceAttack: combat.attackPower
                        });
                        combat.penetratingDamage = penetratingResult.applied
                            ? Math.abs(penetratingResult.appliedAmount)
                            : 0;
                    }

                    const destroyedCards = [];
                    if (targetDestroyed) {
                        destroyedCards.push({
                            card: target,
                            defeatedBy: attacker,
                            ownerId: target.ownerId,
                            controllerId: target.controllerId,
                            attackSnapshot: getEffectiveStat(target.instanceId, 'attack'),
                            attachmentsSnapshot: [...target.attachments],
                            defeatedByOwnerId: attacker.ownerId,
                            defeatedByControllerId: attacker.controllerId
                        });
                    }
                    if (attackerDestroyed) {
                        destroyedCards.push({
                            card: attacker,
                            defeatedBy: target,
                            ownerId: attacker.ownerId,
                            controllerId: attacker.controllerId,
                            attackSnapshot: getEffectiveStat(attacker.instanceId, 'attack'),
                            attachmentsSnapshot: [...attacker.attachments],
                            defeatedByOwnerId: target.ownerId,
                            defeatedByControllerId: target.controllerId
                        });
                    }
                    destroyedCards.forEach(item => moveDestroyedCard(item.card, combat, transaction));

                    destroyedCards.forEach(item => {
                        combat.defeated.push(item.card.instanceId);
                        emitCombatEvent(EVENT_TYPES.CREATURE_DESTROYED, combat, transaction, {
                            cardId: item.card.instanceId,
                            ownerId: item.ownerId,
                            controllerId: item.controllerId,
                            attackSnapshot: item.attackSnapshot,
                            attachmentsSnapshot: item.attachmentsSnapshot
                        });
                        emitCombatEvent(EVENT_TYPES.CREATURE_DEFEATED, combat, transaction, {
                            sourceId: item.defeatedBy.instanceId,
                            defeatedId: item.card.instanceId,
                            defeatedOwnerId: item.ownerId,
                            defeatedControllerId: item.controllerId,
                            sourceOwnerId: item.defeatedByOwnerId,
                            sourceControllerId: item.defeatedByControllerId
                        });
                    });
                }

                applyEffect({
                    kind: EFFECT_KINDS.RECORD_ATTACK,
                    attackerId: attacker.instanceId,
                    targetId: target?.instanceId || null,
                    isDirect: combat.isDirect
                }, transaction, combatId);
                emitCombatEvent(EVENT_TYPES.AFTER_ATTACK, combat, transaction, {
                    defeated: [...combat.defeated]
                });

                return {
                    status: 'resolved',
                    combatId,
                    attackerId: combat.attackerId,
                    targetId: combat.targetId,
                    attackOrdinal: combat.attackOrdinal,
                    isDirect: combat.isDirect,
                    cancelled: false,
                    attackPower: combat.attackPower,
                    damageToTarget: combat.damageToTarget,
                    damageToAttacker: combat.damageToAttacker,
                    directDamage: combat.directDamage,
                    penetratingDamage: combat.penetratingDamage || 0,
                    attackerRemainingDefense: getRemainingDefense(attacker.instanceId),
                    targetRemainingDefense: target ? getRemainingDefense(target.instanceId) : null,
                    attackerDestroyed: combat.defeated.includes(attacker.instanceId),
                    targetDestroyed: target ? combat.defeated.includes(target.instanceId) : false,
                    defeated: [...combat.defeated]
                };
            } catch (error) {
                transaction.rollback();
                return { status: 'failed', reason: error.message, error };
            } finally {
                activeCombats.delete(combatId);
            }
        }

        ensureCollections();

        return {
            state,
            registerEventHandler,
            registerEffectInterceptor,
            emit,
            resolveAction,
            resolveChoice,
            cancelChoice,
            getEffectiveStat,
            getRemainingDefense,
            getAttackCount,
            getAttackTargets,
            getAttackLimit,
            canAttack,
            validateCombat,
            resolveCombat,
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