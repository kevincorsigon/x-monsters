const assert = require('node:assert/strict');
const GameStateModel = require('../../src/js/game-state.js');
const GameEngine = require('../../src/js/game-engine.js');

const tests = [];

function test(name, callback) {
    tests.push({ name, callback });
}

function createIdFactory() {
    let sequence = 0;
    return (definition, ownerId) => `${definition.id}_${ownerId}_test_${++sequence}`;
}

function countZoneOccurrences(state, instanceId) {
    return GameStateModel.PLAYER_IDS.reduce((total, playerId) => {
        return total + GameStateModel.ZONE_NAMES.reduce((playerTotal, zone) => {
            const matches = state.players[playerId].zones[zone]
                .filter(card => card.instanceId === instanceId).length;
            return playerTotal + matches;
        }, 0);
    }, 0);
}

const repeatedDefinition = {
    id: 'card_010_1',
    name: 'Diabrete Alado',
    type: 'criatura',
    cost: 2,
    attack: 10,
    defense: 8
};

test('cria aliases legados apontando para as zonas canônicas', () => {
    const state = GameStateModel.createInitialGameState();

    assert.strictEqual(state.cards.p1.hand, state.players.p1.zones.hand);
    assert.strictEqual(state.cards.p2.field, state.players.p2.zones.field);
    assert.strictEqual(state.decks.p1, state.players.p1.zones.deck);

    state.maxEnergy.p1 = 9;
    assert.equal(state.players.p1.maxEnergy, 9);
});

test('cria instâncias distintas para definições repetidas', () => {
    const state = GameStateModel.createInitialGameState();
    GameStateModel.resetMatchState(state, {
        p1: [repeatedDefinition, repeatedDefinition],
        p2: [repeatedDefinition]
    }, { idFactory: createIdFactory() });

    const instanceIds = Object.keys(state.cardInstances);
    assert.equal(instanceIds.length, 3);
    assert.equal(new Set(instanceIds).size, 3);
    assert.equal(state.decks.p1[0].definitionId, repeatedDefinition.id);
    assert.notStrictEqual(state.decks.p1[0].data, repeatedDefinition);
});

test('registra uma nova instância em exatamente uma zona', () => {
    const state = GameStateModel.createInitialGameState();
    const instance = GameStateModel.createCardInstance(repeatedDefinition, 'p1', {
        instanceId: 'manual_test'
    });

    GameStateModel.registerCard(state, instance, 'hand', 'p1');

    assert.strictEqual(state.cards.p1.hand[0], instance);
    assert.strictEqual(state.cardInstances.manual_test, instance);
    assert.equal(countZoneOccurrences(state, instance.instanceId), 1);
    assert.throws(
        () => GameStateModel.registerCard(state, instance, 'field', 'p1'),
        /já posicionada/
    );
});

test('sacar move a mesma instância sem duplicá-la', () => {
    const state = GameStateModel.createInitialGameState();
    GameStateModel.resetMatchState(state, {
        p1: [repeatedDefinition, repeatedDefinition],
        p2: []
    }, { idFactory: createIdFactory() });

    const deckInstance = state.decks.p1[0];
    const drawnInstance = GameStateModel.drawCard(state, 'p1');

    assert.strictEqual(drawnInstance, deckInstance);
    assert.equal(state.decks.p1.length, 1);
    assert.equal(state.cards.p1.hand.length, 1);
    assert.strictEqual(state.cards.p1.hand[0], deckInstance);
    assert.equal(countZoneOccurrences(state, deckInstance.instanceId), 1);
});

test('move a instância entre zonas preservando identidade', () => {
    const state = GameStateModel.createInitialGameState();
    GameStateModel.resetMatchState(state, {
        p1: [repeatedDefinition],
        p2: []
    }, { idFactory: createIdFactory() });

    const instance = GameStateModel.drawCard(state, 'p1');
    GameStateModel.moveCard(state, instance.instanceId, 'field', 'p1');
    assert.strictEqual(state.cards.p1.field[0], instance);
    assert.equal(instance.zone, 'field');

    GameStateModel.moveCard(state, instance.instanceId, 'equipment', 'p1');
    assert.strictEqual(state.cards.p1.equipment[0], instance);
    assert.equal(instance.zone, 'equipment');

    GameStateModel.moveCard(state, instance.instanceId, 'discard', 'p1');
    assert.strictEqual(state.cards.p1.discard[0], instance);
    assert.equal(instance.ownerId, 'p1');
    assert.equal(countZoneOccurrences(state, instance.instanceId), 1);
});

test('mantém PV e energia canônicos com limites', () => {
    const state = GameStateModel.createInitialGameState({ initialPv: 200, initialEnergy: 6 });

    assert.equal(GameStateModel.changePlayerStat(state, 'pv', 'p1', -30), 170);
    assert.equal(GameStateModel.changePlayerStat(state, 'pv', 'p1', -500), 0);

    state.maxEnergy.p1 = 8;
    assert.equal(GameStateModel.setPlayerStat(state, 'energy', 'p1', 12), 8);
    assert.equal(GameStateModel.changePlayerStat(state, 'energy', 'p1', -3), 5);
});

test('reset limpa zonas, referências e estado transitório', () => {
    const state = GameStateModel.createInitialGameState();
    const idFactory = createIdFactory();
    GameStateModel.resetMatchState(state, {
        p1: [repeatedDefinition],
        p2: []
    }, { idFactory });

    const oldInstance = GameStateModel.drawCard(state, 'p1');
    state.effects.push({ sourceId: oldInstance.instanceId });
    state.attackedThisTurn.push(oldInstance.instanceId);

    GameStateModel.resetMatchState(state, {
        p1: [],
        p2: [repeatedDefinition]
    }, { idFactory });

    assert.equal(state.cards.p1.hand.length, 0);
    assert.equal(state.effects.length, 0);
    assert.equal(state.attackedThisTurn.length, 0);
    assert.equal(state.cardInstances[oldInstance.instanceId], undefined);
    assert.strictEqual(state.decks.p2, state.players.p2.zones.deck);
});

function createEngineFixture() {
    const state = GameStateModel.createInitialGameState();
    GameStateModel.resetMatchState(state, {
        p1: [repeatedDefinition, repeatedDefinition],
        p2: [repeatedDefinition]
    }, { idFactory: createIdFactory() });
    const card = GameStateModel.drawCard(state, 'p1');
    return { state, card, engine: GameEngine.createEngine(state) };
}

test('resolve ações com custo e movimento de forma atômica', () => {
    const { state, card, engine } = createEngineFixture();
    const secondCard = GameStateModel.drawCard(state, 'p1');
    engine.registerEventHandler('FAIL_AFTER_MOVE', () => ({ kind: 'UNKNOWN_EFFECT' }));
    const result = engine.resolveAction({
        type: 'TEST_MOVE',
        actorId: 'p1',
        sourceId: card.instanceId,
        sourceZone: 'hand',
        requiresTurn: true,
        requiredPhase: 'energy',
        costs: [{ kind: 'PLAYER_STAT', stat: 'energy', amount: 2 }],
        effects: [
            {
                kind: GameEngine.EFFECT_KINDS.MOVE_CARD,
                instanceId: card.instanceId,
                destinationZone: 'field',
                destinationPlayerId: 'p1'
            },
            {
                kind: GameEngine.EFFECT_KINDS.EMIT_EVENT,
                type: 'FAIL_AFTER_MOVE'
            }
        ]
    });

    assert.equal(result.status, 'failed');
    assert.equal(state.players.p1.energy, 6);
    assert.equal(card.zone, 'hand');
    assert.strictEqual(state.cards.p1.hand[0], card);
    assert.strictEqual(state.cards.p1.hand[1], secondCard);
    assert.equal(state.eventLog.length, 0);
});

test('rejeita descritores com alvo inválido antes de pagar custos', () => {
    const { state, card, engine } = createEngineFixture();
    const result = engine.resolveAction({
        type: 'INVALID_TARGET',
        actorId: 'p1',
        sourceId: card.instanceId,
        costs: [{ kind: 'PLAYER_STAT', stat: 'energy', amount: 2 }],
        effects: [{
            kind: GameEngine.EFFECT_KINDS.MOVE_CARD,
            instanceId: 'missing',
            destinationZone: 'field',
            destinationPlayerId: 'p1'
        }]
    });

    assert.equal(result.status, 'rejected');
    assert.equal(state.players.p1.energy, 6);
    assert.equal(card.zone, 'hand');
});

test('processa handlers por prioridade e eventos aninhados em FIFO', () => {
    const { state, engine } = createEngineFixture();
    const order = [];

    engine.registerEventHandler('FIRST', () => {
        order.push('low');
    }, 0);
    engine.registerEventHandler('FIRST', () => {
        order.push('high');
        return {
            kind: GameEngine.EFFECT_KINDS.EMIT_EVENT,
            type: 'SECOND',
            payload: { value: 2 }
        };
    }, 10);
    engine.registerEventHandler('SECOND', event => {
        order.push(`second:${event.payload.value}`);
    });

    const result = engine.emit('FIRST', { value: 1 });

    assert.equal(result.status, 'resolved');
    assert.deepEqual(order, ['high', 'low', 'second:2']);
    assert.deepEqual(state.eventLog.map(event => event.type), ['FIRST', 'SECOND']);
    assert.equal(Object.isFrozen(state.eventLog[0].payload), true);
});

test('pausa e cancela escolhas sem pagar custo', () => {
    const { state, card, engine } = createEngineFixture();
    const enemy = state.decks.p2[0];
    const action = {
        type: 'TEST_CHOICE',
        actorId: 'p1',
        sourceId: card.instanceId,
        costs: [{ kind: 'PLAYER_STAT', stat: 'energy', amount: 3 }],
        choice: { options: [enemy.instanceId], min: 1, max: 1 },
        effects: context => [{
            kind: GameEngine.EFFECT_KINDS.ADD_EFFECT,
            effect: { id: `selected_${context.selection[0]}` }
        }]
    };

    const pending = engine.resolveAction(action);
    assert.equal(pending.status, 'pending_choice');
    assert.equal(state.players.p1.energy, 6);
    assert.equal(engine.resolveChoice(pending.choiceId, ['invalid']).status, 'rejected');
    assert.equal(state.players.p1.energy, 6);
    assert.equal(engine.cancelChoice(pending.choiceId), true);
    assert.equal(state.pendingChoice, null);

    const secondPending = engine.resolveAction(action);
    const resolved = engine.resolveChoice(secondPending.choiceId, [enemy.instanceId]);
    assert.equal(resolved.status, 'resolved');
    assert.equal(state.players.p1.energy, 3);
    assert.equal(state.effects[0].id, `selected_${enemy.instanceId}`);
});

test('calcula camadas de modificadores e expira somente o boundary correto', () => {
    const { state, card, engine } = createEngineFixture();
    const result = engine.resolveAction({
        type: 'TEST_MODIFIERS',
        actorId: 'p1',
        sourceId: card.instanceId,
        effects: [
            {
                kind: GameEngine.EFFECT_KINDS.ADD_MODIFIER,
                targetId: card.instanceId,
                modifier: {
                    id: 'set_attack',
                    stat: 'attack',
                    operation: GameEngine.MODIFIER_OPERATIONS.SET,
                    value: 20,
                    duration: { kind: GameEngine.DURATION_KINDS.PERMANENT_ON_INSTANCE }
                }
            },
            {
                kind: GameEngine.EFFECT_KINDS.ADD_MODIFIER,
                targetId: card.instanceId,
                modifier: {
                    id: 'temporary_attack',
                    stat: 'attack',
                    operation: GameEngine.MODIFIER_OPERATIONS.ADD,
                    value: 5,
                    duration: {
                        kind: GameEngine.DURATION_KINDS.UNTIL_END_OF_TURN,
                        playerId: 'p1',
                        turnNumber: 1
                    }
                }
            },
            {
                kind: GameEngine.EFFECT_KINDS.ADD_MODIFIER,
                targetId: card.instanceId,
                modifier: {
                    id: 'double_attack',
                    stat: 'attack',
                    operation: GameEngine.MODIFIER_OPERATIONS.MULTIPLY,
                    value: 2,
                    duration: { kind: GameEngine.DURATION_KINDS.PERMANENT_ON_INSTANCE }
                }
            }
        ]
    });

    assert.equal(result.status, 'resolved');
    assert.equal(engine.getEffectiveStat(card.instanceId, 'attack'), 50);
    engine.emit(GameEngine.EVENT_TYPES.TURN_ENDED, { playerId: 'p2', turnNumber: 1 });
    assert.equal(engine.getEffectiveStat(card.instanceId, 'attack'), 50);
    engine.emit(GameEngine.EVENT_TYPES.TURN_ENDED, { playerId: 'p1', turnNumber: 1 });
    assert.equal(engine.getEffectiveStat(card.instanceId, 'attack'), 40);
    assert.deepEqual(card.modifiers.map(modifier => modifier.id), ['set_attack', 'double_attack']);
});

test('expira efeitos ligados quando a fonte deixa o campo', () => {
    const { state, card, engine } = createEngineFixture();
    GameStateModel.moveCard(state, card.instanceId, 'field', 'p1');
    engine.resolveAction({
        type: 'TEST_SOURCE_EFFECT',
        actorId: 'p1',
        sourceId: card.instanceId,
        effects: [{
            kind: GameEngine.EFFECT_KINDS.ADD_EFFECT,
            effect: {
                id: 'source_bound',
                sourceId: card.instanceId,
                duration: {
                    kind: GameEngine.DURATION_KINDS.UNTIL_SOURCE_LEAVES,
                    sourceId: card.instanceId
                }
            }
        }]
    });

    assert.equal(state.effects.length, 1);
    const moveResult = engine.resolveAction({
        type: 'LEAVE_FIELD',
        actorId: 'p1',
        sourceId: card.instanceId,
        sourceZone: 'field',
        effects: [{
            kind: GameEngine.EFFECT_KINDS.MOVE_CARD,
            instanceId: card.instanceId,
            destinationZone: 'discard',
            destinationPlayerId: 'p1'
        }]
    });
    assert.equal(moveResult.status, 'resolved');
    assert.equal(state.effects.length, 0);
    assert.equal(state.eventLog.at(-1).type, GameEngine.EVENT_TYPES.SOURCE_LEFT_FIELD);
});

test('conta duração apenas nos turnos do controlador indicado', () => {
    const { state, card, engine } = createEngineFixture();
    engine.resolveAction({
        type: 'TEST_TURN_DURATION',
        actorId: 'p1',
        sourceId: card.instanceId,
        effects: [{
            kind: GameEngine.EFFECT_KINDS.ADD_EFFECT,
            effect: {
                id: 'two_controller_turns',
                duration: {
                    kind: GameEngine.DURATION_KINDS.FOR_CONTROLLER_TURNS,
                    controllerId: 'p1',
                    count: 2
                }
            }
        }]
    });

    engine.emit(GameEngine.EVENT_TYPES.TURN_ENDED, { playerId: 'p2', turnNumber: 1 });
    assert.equal(state.effects[0].duration.remaining, 2);
    engine.emit(GameEngine.EVENT_TYPES.TURN_ENDED, { playerId: 'p1', turnNumber: 2 });
    assert.equal(state.effects[0].duration.remaining, 1);
    engine.emit(GameEngine.EVENT_TYPES.TURN_ENDED, { playerId: 'p1', turnNumber: 3 });
    assert.equal(state.effects.length, 0);
});

test('suporta durações do oponente, alvo, próximo evento e permanente', () => {
    const { state, card, engine } = createEngineFixture();
    engine.resolveAction({
        type: 'TEST_ALL_DURATIONS',
        actorId: 'p1',
        sourceId: card.instanceId,
        effects: [
            {
                kind: GameEngine.EFFECT_KINDS.ADD_EFFECT,
                effect: {
                    id: 'opponent_turn',
                    duration: {
                        kind: GameEngine.DURATION_KINDS.UNTIL_END_OF_OPPONENT_TURN,
                        controllerId: 'p1'
                    }
                }
            },
            {
                kind: GameEngine.EFFECT_KINDS.ADD_EFFECT,
                effect: {
                    id: 'target_turn',
                    duration: {
                        kind: GameEngine.DURATION_KINDS.FOR_TARGET_CONTROLLER_TURNS,
                        targetControllerId: 'p2',
                        count: 1
                    }
                }
            },
            {
                kind: GameEngine.EFFECT_KINDS.ADD_EFFECT,
                effect: {
                    id: 'predicate_event',
                    duration: {
                        kind: GameEngine.DURATION_KINDS.UNTIL_NEXT_MATCHING_EVENT,
                        predicate: event => event.type === 'MATCH' && event.payload.allowed
                    }
                }
            },
            {
                kind: GameEngine.EFFECT_KINDS.ADD_EFFECT,
                effect: {
                    id: 'permanent',
                    duration: { kind: GameEngine.DURATION_KINDS.PERMANENT_ON_INSTANCE }
                }
            }
        ]
    });

    engine.emit('MATCH', { allowed: false });
    assert.equal(state.effects.some(effect => effect.id === 'predicate_event'), true);
    engine.emit('MATCH', { allowed: true });
    assert.equal(state.effects.some(effect => effect.id === 'predicate_event'), false);
    engine.emit(GameEngine.EVENT_TYPES.TURN_ENDED, { playerId: 'p1', turnNumber: 1 });
    assert.equal(state.effects.some(effect => effect.id === 'opponent_turn'), true);
    engine.emit(GameEngine.EVENT_TYPES.TURN_ENDED, { playerId: 'p2', turnNumber: 1 });
    assert.deepEqual(state.effects.map(effect => effect.id), ['permanent']);
});

test('eventos ending observam estado anterior e started observam estado novo', () => {
    const { state, engine } = createEngineFixture();
    const observed = [];
    engine.registerEventHandler(GameEngine.EVENT_TYPES.TURN_ENDING, () => {
        observed.push(`ending:${state.currentPlayer}:${state.turn}`);
    });
    engine.registerEventHandler(GameEngine.EVENT_TYPES.TURN_STARTED, () => {
        observed.push(`started:${state.currentPlayer}:${state.turn}`);
    });

    const result = engine.resolveAction({
        type: 'END_TURN_TEST',
        actorId: 'p1',
        effects: [
            {
                kind: GameEngine.EFFECT_KINDS.EMIT_EVENT,
                type: GameEngine.EVENT_TYPES.TURN_ENDING,
                payload: { playerId: 'p1', turnNumber: 1 },
                immediate: true
            },
            {
                kind: GameEngine.EFFECT_KINDS.SET_TURN_STATE,
                changes: { currentPlayer: 'p2', turn: 2 }
            },
            {
                kind: GameEngine.EFFECT_KINDS.EMIT_EVENT,
                type: GameEngine.EVENT_TYPES.TURN_STARTED,
                payload: { playerId: 'p2', turnNumber: 2 },
                immediate: true
            }
        ]
    });

    assert.equal(result.status, 'resolved');
    assert.deepEqual(observed, ['ending:p1:1', 'started:p2:2']);
});

test('interrompe loops de eventos e reverte a fila e o log', () => {
    const state = GameStateModel.createInitialGameState();
    const engine = GameEngine.createEngine(state, { maxEventsPerResolution: 3 });
    engine.registerEventHandler('LOOP', () => ({
        kind: GameEngine.EFFECT_KINDS.EMIT_EVENT,
        type: 'LOOP'
    }));

    const result = engine.emit('LOOP');

    assert.equal(result.status, 'failed');
    assert.match(result.reason, /Limite de eventos/);
    assert.equal(state.eventQueue.length, 0);
    assert.equal(state.eventLog.length, 0);
});

test('consome limites somente depois de uma resolução bem-sucedida', () => {
    const { state, card, engine } = createEngineFixture();
    const limit = { kind: GameEngine.LIMIT_KINDS.PER_TURN, count: 1 };
    const action = {
        type: 'TEST_LIMIT',
        actorId: 'p1',
        sourceId: card.instanceId,
        abilityId: 'test_ability',
        limit,
        effects: []
    };

    assert.equal(engine.resolveAction(action).status, 'resolved');
    assert.equal(engine.canUseAbility(card.instanceId, 'test_ability', limit), false);
    assert.equal(engine.resolveAction(action).status, 'rejected');

    state.turn++;
    assert.equal(engine.canUseAbility(card.instanceId, 'test_ability', limit), true);

    const failedAction = {
        ...action,
        abilityId: 'failed_ability',
        effects: [{
            kind: GameEngine.EFFECT_KINDS.MOVE_CARD,
            instanceId: 'missing',
            destinationZone: 'field',
            destinationPlayerId: 'p1'
        }]
    };
    assert.equal(engine.resolveAction(failedAction).status, 'rejected');
    assert.equal(engine.getUsageCount(card.instanceId, 'failed_ability', limit), 0);

    const matchLimit = { kind: GameEngine.LIMIT_KINDS.PER_MATCH, count: 1 };
    assert.equal(engine.resolveAction({ ...action, abilityId: 'match', limit: matchLimit }).status, 'resolved');
    state.turn++;
    assert.equal(engine.canUseAbility(card.instanceId, 'match', matchLimit), false);
});

let failures = 0;

tests.forEach(({ name, callback }) => {
    try {
        callback();
        console.log(`PASS ${name}`);
    } catch (error) {
        failures++;
        console.error(`FAIL ${name}`);
        console.error(error.stack);
    }
});

console.log(`\n${tests.length - failures}/${tests.length} testes passaram.`);
if (failures > 0) process.exitCode = 1;