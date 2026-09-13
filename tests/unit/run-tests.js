const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const GameStateModel = require('../../src/js/game-state.js');
const GameEngine = require('../../src/js/game-engine.js');
const CardRules = require('../../src/js/card-rules.js');

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

function createCombatFixture(options = {}) {
    const state = GameStateModel.createInitialGameState();
    const idFactory = createIdFactory();
    const attackerDefinition = {
        id: 'card_attacker',
        name: 'Atacante',
        type: 'criatura',
        cost: 3,
        attack: options.attackerAttack ?? 15,
        defense: options.attackerDefense ?? 10
    };
    const targetDefinition = {
        id: 'card_target',
        name: 'Defensor',
        type: 'criatura',
        cost: 2,
        attack: options.targetAttack ?? 8,
        defense: options.targetDefense ?? 12
    };
    const attacker = GameStateModel.createCardInstance(attackerDefinition, 'p1', { idFactory });
    const target = GameStateModel.createCardInstance(targetDefinition, 'p2', { idFactory });
    GameStateModel.registerCard(state, attacker, 'field', 'p1');
    GameStateModel.registerCard(state, target, 'field', 'p2');
    state.currentPhase = 'combat';
    return { state, attacker, target, engine: GameEngine.createEngine(state), idFactory };
}

test('resolve dano mútuo, morte e penetração pelo estado canônico', () => {
    const { state, attacker, target, engine } = createCombatFixture();
    const result = engine.resolveCombat({ attackerId: attacker.instanceId, targetId: target.instanceId });

    assert.equal(result.status, 'resolved');
    assert.equal(result.damageToTarget, 15);
    assert.equal(result.damageToAttacker, 8);
    assert.equal(result.attackerRemainingDefense, 2);
    assert.equal(result.targetRemainingDefense, 0);
    assert.equal(result.targetDestroyed, true);
    assert.equal(result.penetratingDamage, 3);
    assert.equal(state.players.p2.pv, 197);
    assert.equal(target.zone, 'discard');
    assert.equal(attacker.zone, 'field');
    assert.equal(engine.getAttackCount(attacker.instanceId), 1);
    assert.equal(attacker.data.defense, 10);
    assert.equal(target.data.defense, 12);
    assert.deepEqual(state.eventLog.map(event => event.type), [
        GameEngine.EVENT_TYPES.ATTACK_DECLARED,
        GameEngine.EVENT_TYPES.BECAME_ATTACK_TARGET,
        GameEngine.EVENT_TYPES.BEFORE_DAMAGE,
        GameEngine.EVENT_TYPES.DAMAGE_DEALT,
        GameEngine.EVENT_TYPES.DAMAGE_DEALT,
        GameEngine.EVENT_TYPES.CREATURE_WOULD_DIE,
        GameEngine.EVENT_TYPES.SOURCE_LEFT_FIELD,
        GameEngine.EVENT_TYPES.CREATURE_DESTROYED,
        GameEngine.EVENT_TYPES.CREATURE_DEFEATED,
        GameEngine.EVENT_TYPES.AFTER_ATTACK
    ]);
});

test('rejeita ataques inválidos sem dano ou consumo', () => {
    const { state, attacker, target, engine } = createCombatFixture();
    state.currentPhase = 'invocation';
    const wrongPhase = engine.resolveCombat({
        attackerId: attacker.instanceId,
        targetId: target.instanceId
    });
    assert.equal(wrongPhase.status, 'rejected');
    assert.equal(attacker.damage, 0);
    assert.equal(target.damage, 0);
    assert.equal(engine.getAttackCount(attacker.instanceId), 0);

    state.currentPhase = 'combat';
    const ally = GameStateModel.createCardInstance(target.data, 'p1', {
        instanceId: 'ally_target'
    });
    GameStateModel.registerCard(state, ally, 'field', 'p1');
    const allyAttack = engine.resolveCombat({
        attackerId: attacker.instanceId,
        targetId: ally.instanceId
    });
    assert.equal(allyAttack.status, 'rejected');
    assert.equal(ally.damage, 0);
});

test('permite modificar e prevenir dano na janela BEFORE_DAMAGE', () => {
    const { attacker, target, engine } = createCombatFixture();
    engine.registerEventHandler(GameEngine.EVENT_TYPES.BEFORE_DAMAGE, event => [
        {
            kind: GameEngine.EFFECT_KINDS.MODIFY_COMBAT,
            combatId: event.payload.combatId,
            field: 'damageToTarget',
            operation: GameEngine.MODIFIER_OPERATIONS.SET,
            value: 0
        },
        {
            kind: GameEngine.EFFECT_KINDS.MODIFY_COMBAT,
            combatId: event.payload.combatId,
            field: 'damageToAttacker',
            operation: GameEngine.MODIFIER_OPERATIONS.ADD,
            value: -3
        }
    ]);

    const result = engine.resolveCombat({ attackerId: attacker.instanceId, targetId: target.instanceId });

    assert.equal(result.status, 'resolved');
    assert.equal(target.damage, 0);
    assert.equal(attacker.damage, 5);
    assert.equal(result.targetDestroyed, false);
});

test('permite substituir morte na janela CREATURE_WOULD_DIE', () => {
    const { attacker, target, engine } = createCombatFixture();
    engine.registerEventHandler(GameEngine.EVENT_TYPES.CREATURE_WOULD_DIE, event => {
        if (event.payload.cardId !== target.instanceId) return undefined;
        return [
            {
                kind: GameEngine.EFFECT_KINDS.MODIFY_COMBAT,
                combatId: event.payload.combatId,
                field: 'preventTargetDeath',
                value: true
            },
            {
                kind: GameEngine.EFFECT_KINDS.APPLY_CARD_DAMAGE,
                targetId: target.instanceId,
                amount: -15
            }
        ];
    });

    const result = engine.resolveCombat({ attackerId: attacker.instanceId, targetId: target.instanceId });

    assert.equal(result.status, 'resolved');
    assert.equal(result.targetDestroyed, false);
    assert.equal(target.zone, 'field');
    assert.equal(target.damage, 0);
    assert.equal(result.penetratingDamage, 0);
});

test('resolve morte simultânea e descarta attachments com seus owners', () => {
    const { state, attacker, target, engine, idFactory } = createCombatFixture({
        attackerDefense: 5,
        targetDefense: 12
    });
    const equipmentDefinition = {
        id: 'card_equipment',
        name: 'Equipamento',
        type: 'suporte',
        cost: 1,
        attack: 0,
        defense: 0
    };
    const equipment = GameStateModel.createCardInstance(equipmentDefinition, 'p2', { idFactory });
    GameStateModel.registerCard(state, equipment, 'equipment', 'p2');
    equipment.attachedTo = attacker.instanceId;
    attacker.attachments.push(equipment.instanceId);

    const result = engine.resolveCombat({ attackerId: attacker.instanceId, targetId: target.instanceId });

    assert.equal(result.attackerDestroyed, true);
    assert.equal(result.targetDestroyed, true);
    assert.equal(attacker.zone, 'discard');
    assert.equal(target.zone, 'discard');
    assert.equal(equipment.zone, 'discard');
    assert.equal(equipment.ownerId, 'p2');
    assert.equal(state.cards.p2.discard.includes(equipment), true);
    assert.equal(equipment.attachedTo, null);
    assert.deepEqual(attacker.attachments, []);
    const destroyedEvents = state.eventLog
        .filter(event => event.type === GameEngine.EVENT_TYPES.CREATURE_DESTROYED);
    assert.deepEqual(destroyedEvents.map(event => event.payload.cardId), [
        target.instanceId,
        attacker.instanceId
    ]);
});

test('preserva snapshots de owner e controller após destruir carta controlada por outro jogador', () => {
    const { state, attacker, target, engine } = createCombatFixture();
    target.ownerId = 'p1';
    target.controllerId = 'p2';
    target.player = 'p2';

    const result = engine.resolveCombat({ attackerId: attacker.instanceId, targetId: target.instanceId });
    const wouldDie = state.eventLog.find(event =>
        event.type === GameEngine.EVENT_TYPES.CREATURE_WOULD_DIE &&
        event.payload.cardId === target.instanceId
    );
    const defeated = state.eventLog.find(event =>
        event.type === GameEngine.EVENT_TYPES.CREATURE_DEFEATED &&
        event.payload.defeatedId === target.instanceId
    );

    assert.equal(result.status, 'resolved');
    assert.equal(target.zone, 'discard');
    assert.equal(target.zonePlayerId, 'p1');
    assert.equal(wouldDie.payload.ownerId, 'p1');
    assert.equal(wouldDie.payload.controllerId, 'p2');
    assert.equal(defeated.payload.defeatedOwnerId, 'p1');
    assert.equal(defeated.payload.defeatedControllerId, 'p2');
});

test('resolve ataque direto e bloqueia uso acima do orçamento', () => {
    const { state, attacker, engine } = createCombatFixture();
    const first = engine.resolveCombat({
        attackerId: attacker.instanceId,
        isDirect: true,
        allowDirectAttack: true
    });
    const second = engine.resolveCombat({
        attackerId: attacker.instanceId,
        isDirect: true,
        allowDirectAttack: true
    });

    assert.equal(first.status, 'resolved');
    assert.equal(first.directDamage, 15);
    assert.equal(state.players.p2.pv, 185);
    assert.equal(second.status, 'rejected');
    assert.equal(state.players.p2.pv, 185);
});

test('aceita limite derivado para ataques adicionais', () => {
    const { state, attacker, engine } = createCombatFixture();
    attacker.modifiers.push({
        id: 'double_attack',
        stat: 'attackLimit',
        operation: GameEngine.MODIFIER_OPERATIONS.SET,
        value: 2
    });

    assert.equal(engine.resolveCombat({ attackerId: attacker.instanceId, isDirect: true }).status, 'resolved');
    assert.equal(engine.resolveCombat({ attackerId: attacker.instanceId, isDirect: true }).status, 'resolved');
    assert.equal(engine.resolveCombat({ attackerId: attacker.instanceId, isDirect: true }).status, 'rejected');
    assert.equal(state.players.p2.pv, 170);
    assert.equal(engine.getAttackCount(attacker.instanceId), 2);
});

test('reverte integralmente o combate quando um handler falha', () => {
    const { state, attacker, target, engine, idFactory } = createCombatFixture();
    const secondTarget = GameStateModel.createCardInstance(target.data, 'p2', { idFactory });
    GameStateModel.registerCard(state, secondTarget, 'field', 'p2');
    engine.registerEventHandler(GameEngine.EVENT_TYPES.AFTER_ATTACK, () => ({
        kind: 'UNKNOWN_EFFECT'
    }));
    const originalTargetOrder = state.cards.p2.field.map(card => card.instanceId);

    const result = engine.resolveCombat({ attackerId: attacker.instanceId, targetId: target.instanceId });

    assert.equal(result.status, 'failed');
    assert.equal(state.players.p2.pv, 200);
    assert.equal(attacker.damage, 0);
    assert.equal(target.damage, 0);
    assert.equal(attacker.zone, 'field');
    assert.equal(target.zone, 'field');
    assert.deepEqual(state.cards.p2.field.map(card => card.instanceId), originalTargetOrder);
    assert.equal(engine.getAttackCount(attacker.instanceId), 0);
    assert.equal(state.eventLog.length, 0);
    assert.equal(state.eventQueue.length, 0);
});

function createSummonRuleFixture(definitionId) {
    const state = GameStateModel.createInitialGameState();
    const engine = GameEngine.createEngine(state);
    CardRules.install(engine);
    const source = GameStateModel.createCardInstance({
        id: definitionId,
        name: definitionId,
        type: 'criatura',
        cost: 2,
        attack: 10,
        defense: 10
    }, 'p1', { instanceId: `${definitionId}_source` });
    GameStateModel.registerCard(state, source, 'field', 'p1');
    return { state, engine, source };
}

function emitSummoned(engine, source) {
    return engine.emit(GameEngine.EVENT_TYPES.CREATURE_SUMMONED, {
        cardId: source.instanceId,
        playerId: source.controllerId,
        definitionId: source.definitionId
    });
}

test('registra exatamente as quatro habilidades do lote 4A', () => {
    assert.deepEqual(Object.keys(CardRules.SUMMON_RULES).sort(), [
        'card_012',
        'card_013',
        'card_023',
        'card_079'
    ]);
});

test('Natalino cura somente outras criaturas aliadas até zero de dano', () => {
    const { state, engine, source } = createSummonRuleFixture('card_012');
    const ally = GameStateModel.createCardInstance({
        id: 'ally', name: 'Aliado', type: 'criatura', cost: 1, attack: 1, defense: 20
    }, 'p1', { instanceId: 'ally_1' });
    const enemy = GameStateModel.createCardInstance({
        id: 'enemy', name: 'Inimigo', type: 'criatura', cost: 1, attack: 1, defense: 20
    }, 'p2', { instanceId: 'enemy_1' });
    GameStateModel.registerCard(state, ally, 'field', 'p1');
    GameStateModel.registerCard(state, enemy, 'field', 'p2');
    source.damage = 7;
    ally.damage = 15;
    enemy.damage = 15;

    assert.equal(emitSummoned(engine, source).status, 'resolved');
    assert.equal(source.damage, 7);
    assert.equal(ally.damage, 5);
    assert.equal(enemy.damage, 15);

    ally.damage = 4;
    emitSummoned(engine, source);
    assert.equal(ally.damage, 0);
});

test('Zol move a mesma carta do topo do deck para a mão sem duplicar', () => {
    const { state, engine, source } = createSummonRuleFixture('card_013');
    const drawnCard = GameStateModel.createCardInstance({
        id: 'drawn', name: 'Comprada', type: 'criatura', cost: 1, attack: 1, defense: 1
    }, 'p1', { instanceId: 'drawn_1' });
    GameStateModel.registerCard(state, drawnCard, 'deck', 'p1');

    assert.equal(emitSummoned(engine, source).status, 'resolved');
    assert.equal(state.decks.p1.length, 0);
    assert.strictEqual(state.cards.p1.hand[0], drawnCard);
    assert.equal(GameStateModel.findCardLocations(state, drawnCard.instanceId).length, 1);
    assert.equal(emitSummoned(engine, source).status, 'resolved');
    assert.equal(state.cards.p1.hand.length, 1);
});

test('Raylaser e Lobo Beta aplicam dano direto canônico', () => {
    const raylaser = createSummonRuleFixture('card_023');
    const loboBeta = createSummonRuleFixture('card_079');

    assert.equal(emitSummoned(raylaser.engine, raylaser.source).status, 'resolved');
    assert.equal(raylaser.state.players.p2.pv, 185);
    assert.equal(emitSummoned(loboBeta.engine, loboBeta.source).status, 'resolved');
    assert.equal(loboBeta.state.players.p2.pv, 180);
});

test('reverte habilidade de invocação quando handler posterior falha', () => {
    const { state, engine, source } = createSummonRuleFixture('card_023');
    engine.registerEventHandler(GameEngine.EVENT_TYPES.CREATURE_SUMMONED, () => ({
        kind: 'UNKNOWN_EFFECT'
    }), -1);

    const result = engine.resolveAction({
        type: 'SUMMON_ROLLBACK_TEST',
        actorId: 'p1',
        sourceId: source.instanceId,
        events: [{
            type: GameEngine.EVENT_TYPES.CREATURE_SUMMONED,
            payload: {
                cardId: source.instanceId,
                playerId: 'p1',
                definitionId: source.definitionId
            }
        }]
    });

    assert.equal(result.status, 'failed');
    assert.equal(state.players.p2.pv, 200);
    assert.equal(state.eventLog.length, 0);
});

function createEquipmentRuleFixture(definitionId) {
    const state = GameStateModel.createInitialGameState();
    const engine = GameEngine.createEngine(state);
    CardRules.install(engine);
    const target = GameStateModel.createCardInstance({
        id: 'equipment_target',
        name: 'Alvo',
        type: 'criatura',
        cost: 1,
        attack: 20,
        defense: 20
    }, 'p2', { instanceId: `${definitionId}_target` });
    const equipment = GameStateModel.createCardInstance({
        id: definitionId,
        name: definitionId,
        type: 'suporte',
        cost: 1,
        attack: 99,
        defense: 99
    }, 'p1', { instanceId: `${definitionId}_equipment` });
    GameStateModel.registerCard(state, target, 'field', 'p2');
    GameStateModel.registerCard(state, equipment, 'hand', 'p1');

    const result = engine.resolveAction({
        type: 'EQUIP_TEST',
        actorId: 'p1',
        sourceId: equipment.instanceId,
        effects: [
            {
                kind: GameEngine.EFFECT_KINDS.MOVE_CARD,
                instanceId: equipment.instanceId,
                destinationZone: 'equipment',
                destinationPlayerId: 'p1'
            },
            {
                kind: GameEngine.EFFECT_KINDS.ATTACH_CARD,
                equipmentId: equipment.instanceId,
                targetId: target.instanceId
            },
            ...CardRules.createEquipmentEffects(equipment, target.instanceId)
        ]
    });

    return { state, engine, target, equipment, result };
}

test('equipamentos 001, 004 e 009 usam exatamente os números do texto', () => {
    const sword = createEquipmentRuleFixture('card_001');
    assert.equal(sword.result.status, 'resolved');
    assert.equal(sword.engine.getEffectiveStat(sword.target.instanceId, 'attack'), 25);
    assert.equal(sword.engine.getEffectiveStat(sword.target.instanceId, 'defense'), 25);

    const chocolate = createEquipmentRuleFixture('card_004');
    assert.equal(chocolate.engine.getEffectiveStat(chocolate.target.instanceId, 'attack'), 10);
    assert.equal(chocolate.engine.getEffectiveStat(chocolate.target.instanceId, 'defense'), 10);

    const abutuaram = createEquipmentRuleFixture('card_009');
    assert.equal(abutuaram.engine.getEffectiveStat(abutuaram.target.instanceId, 'attack'), 20);
    assert.equal(abutuaram.engine.getEffectiveStat(abutuaram.target.instanceId, 'defense'), 5);
});

test('remover equipamento limpa somente seus próprios modificadores', () => {
    const { engine, target, equipment } = createEquipmentRuleFixture('card_004');
    target.modifiers.push({
        id: 'independent',
        stat: 'attack',
        operation: GameEngine.MODIFIER_OPERATIONS.ADD,
        value: 3
    });

    assert.equal(engine.getEffectiveStat(target.instanceId, 'attack'), 13);
    const result = engine.resolveAction({
        type: 'REMOVE_EQUIPMENT_TEST',
        actorId: 'p1',
        sourceId: equipment.instanceId,
        effects: [{
            kind: GameEngine.EFFECT_KINDS.MOVE_CARD,
            instanceId: equipment.instanceId,
            destinationZone: 'discard',
            destinationPlayerId: equipment.ownerId
        }]
    });

    assert.equal(result.status, 'resolved');
    assert.equal(engine.getEffectiveStat(target.instanceId, 'attack'), 23);
    assert.deepEqual(target.modifiers.map(modifier => modifier.id), ['independent']);
});

test('Bufaboi recebe +10 somente no primeiro ataque de cada turno', () => {
    const { state, attacker, engine } = createCombatFixture({ attackerAttack: 10 });
    attacker.definitionId = 'card_017';
    attacker.modifiers.push({
        id: 'two_attacks',
        stat: 'attackLimit',
        operation: GameEngine.MODIFIER_OPERATIONS.SET,
        value: 2
    });
    CardRules.install(engine);

    const first = engine.resolveCombat({ attackerId: attacker.instanceId, isDirect: true });
    const second = engine.resolveCombat({ attackerId: attacker.instanceId, isDirect: true });

    assert.equal(first.directDamage, 20);
    assert.equal(second.directDamage, 10);
    assert.equal(state.players.p2.pv, 170);

    state.turn++;
    const nextTurn = engine.resolveCombat({ attackerId: attacker.instanceId, isDirect: true });
    assert.equal(nextTurn.directDamage, 20);
});

test('Garras Afiadas recebe +10 somente durante a janela de recém-invocada', () => {
    const { state, attacker, target, engine } = createCombatFixture({
        attackerAttack: 10,
        targetAttack: 0,
        targetDefense: 100
    });
    attacker.definitionId = 'card_019';
    CardRules.install(engine);
    emitSummoned(engine, target);
    state.currentPlayer = 'p1';

    const recentAttack = engine.resolveCombat({
        attackerId: attacker.instanceId,
        targetId: target.instanceId
    });
    assert.equal(recentAttack.attackPower, 20);
    assert.equal(recentAttack.damageToTarget, 20);

    engine.emit(GameEngine.EVENT_TYPES.TURN_ENDED, { playerId: 'p1', turnNumber: state.turn });
    state.turn++;
    const secondAttacker = GameStateModel.createCardInstance(attacker.data, 'p1', {
        instanceId: 'garras_second'
    });
    secondAttacker.definitionId = 'card_019';
    GameStateModel.registerCard(state, secondAttacker, 'field', 'p1');
    const laterAttack = engine.resolveCombat({
        attackerId: secondAttacker.instanceId,
        targetId: target.instanceId
    });
    assert.equal(laterAttack.attackPower, 10);
    assert.equal(laterAttack.damageToTarget, 10);
});

function createActivatedRuleFixture() {
    const state = GameStateModel.createInitialGameState();
    const engine = GameEngine.createEngine(state);
    CardRules.install(engine);
    const source = GameStateModel.createCardInstance({
        id: 'card_026', name: 'Sabota Copos', type: 'criatura', cost: 3, attack: 15, defense: 20
    }, 'p1', { instanceId: 'sabota_source' });
    const enemy = GameStateModel.createCardInstance({
        id: 'enemy', name: 'Inimigo', type: 'criatura', cost: 2, attack: 20, defense: 20
    }, 'p2', { instanceId: 'sabota_enemy' });
    const ally = GameStateModel.createCardInstance({
        id: 'ally', name: 'Aliado', type: 'criatura', cost: 2, attack: 20, defense: 20
    }, 'p1', { instanceId: 'sabota_ally' });
    GameStateModel.registerCard(state, source, 'field', 'p1');
    GameStateModel.registerCard(state, enemy, 'field', 'p2');
    GameStateModel.registerCard(state, ally, 'field', 'p1');
    state.currentPhase = 'invocation';
    return { state, engine, source, enemy, ally };
}

test('Sabota Copos oferece somente criaturas inimigas como alvo', () => {
    const { state, source, enemy, ally } = createActivatedRuleFixture();
    const targets = CardRules.getActivatedTargets(state, source.instanceId);

    assert.deepEqual(targets, [enemy.instanceId]);
    assert.equal(targets.includes(ally.instanceId), false);
});

test('Sabota Copos não consome uso em escolha inválida e aplica -5/-5 na válida', () => {
    const { state, engine, source, enemy, ally } = createActivatedRuleFixture();
    const rule = CardRules.getActivatedRule(source.definitionId);
    const pending = CardRules.activateAbility(engine, source.instanceId);

    assert.equal(pending.status, 'pending_choice');
    assert.equal(engine.resolveChoice(pending.choiceId, [ally.instanceId]).status, 'rejected');
    assert.equal(engine.getUsageCount(source.instanceId, rule.abilityId, rule.limit), 0);
    assert.equal(enemy.modifiers.length, 0);

    const resolved = engine.resolveChoice(pending.choiceId, [enemy.instanceId]);
    assert.equal(resolved.status, 'resolved');
    assert.equal(engine.getEffectiveStat(enemy.instanceId, 'attack'), 15);
    assert.equal(engine.getEffectiveStat(enemy.instanceId, 'defense'), 15);
    assert.equal(engine.getUsageCount(source.instanceId, rule.abilityId, rule.limit), 1);
});

test('Sabota Copos bloqueia segunda ativação e libera no turno seguinte', () => {
    const { state, engine, source, enemy } = createActivatedRuleFixture();

    assert.equal(CardRules.activateAbility(engine, source.instanceId, [enemy.instanceId]).status, 'resolved');
    assert.equal(CardRules.activateAbility(engine, source.instanceId, [enemy.instanceId]).status, 'rejected');
    assert.equal(enemy.modifiers.length, 2);

    state.turn++;
    assert.equal(CardRules.activateAbility(engine, source.instanceId, [enemy.instanceId]).status, 'resolved');
    assert.equal(engine.getEffectiveStat(enemy.instanceId, 'attack'), 10);
    assert.equal(engine.getEffectiveStat(enemy.instanceId, 'defense'), 10);
});

test('Sabota Copos exige turno, fase e fonte válidos', () => {
    const { state, engine, source, enemy } = createActivatedRuleFixture();
    state.currentPlayer = 'p2';
    assert.equal(CardRules.activateAbility(engine, source.instanceId, [enemy.instanceId]).status, 'rejected');
    state.currentPlayer = 'p1';
    state.currentPhase = 'energy';
    assert.equal(CardRules.activateAbility(engine, source.instanceId, [enemy.instanceId]).status, 'rejected');
    assert.equal(enemy.modifiers.length, 0);
});

test('equipamentos migrados validam o lado permitido do alvo', () => {
    const state = GameStateModel.createInitialGameState();
    const ally = GameStateModel.createCardInstance({
        id: 'ally', name: 'Aliado', type: 'criatura', cost: 1, attack: 1, defense: 1
    }, 'p1', { instanceId: 'equipment_ally' });
    const enemy = GameStateModel.createCardInstance({
        id: 'enemy', name: 'Inimigo', type: 'criatura', cost: 1, attack: 1, defense: 1
    }, 'p2', { instanceId: 'equipment_enemy' });
    const sword = GameStateModel.createCardInstance({
        id: 'card_001', name: 'Espada', type: 'suporte', cost: 1, attack: 10, defense: 5
    }, 'p1', { instanceId: 'equipment_sword' });
    const chocolate = GameStateModel.createCardInstance({
        id: 'card_004', name: 'Chocolicia', type: 'suporte', cost: 1, attack: 10, defense: 10
    }, 'p1', { instanceId: 'equipment_chocolate' });
    [ally, sword, chocolate].forEach(card => GameStateModel.registerCard(
        state,
        card,
        card.data.type === 'suporte' ? 'hand' : 'field',
        'p1'
    ));
    GameStateModel.registerCard(state, enemy, 'field', 'p2');

    assert.equal(CardRules.validateEquipmentTarget(sword, ally).valid, true);
    assert.equal(CardRules.validateEquipmentTarget(sword, enemy).valid, false);
    assert.equal(CardRules.validateEquipmentTarget(chocolate, ally).valid, false);
    assert.equal(CardRules.validateEquipmentTarget(chocolate, enemy).valid, true);
});

test('proteções 014, 018, 025 e 044 restringem somente os alvos declarados', () => {
    const { state, attacker, target } = createCombatFixture();
    attacker.data.cost = 5;
    target.definitionId = 'card_014';
    assert.equal(CardRules.validateAttackTarget(state, attacker.instanceId, target.instanceId).valid, false);
    attacker.data.cost = 3;
    assert.equal(CardRules.validateAttackTarget(state, attacker.instanceId, target.instanceId).valid, true);

    target.definitionId = 'card_044';
    assert.equal(CardRules.validateAttackTarget(state, attacker.instanceId, target.instanceId).valid, false);
    attacker.data.cost = 5;
    assert.equal(CardRules.validateAttackTarget(state, attacker.instanceId, target.instanceId).valid, true);

    target.definitionId = 'card_025';
    const ally = GameStateModel.createCardInstance(target.data, 'p2', { instanceId: 'protected_ally' });
    GameStateModel.registerCard(state, ally, 'field', 'p2');
    assert.equal(CardRules.validateAttackTarget(state, attacker.instanceId, target.instanceId).valid, false);
    GameStateModel.moveCard(state, ally.instanceId, 'discard', 'p2');
    assert.equal(CardRules.validateAttackTarget(state, attacker.instanceId, target.instanceId).valid, true);

    target.definitionId = 'normal_target';
    const cp2 = GameStateModel.createCardInstance({
        id: 'card_018', name: 'CP-2', type: 'criatura', cost: 3, attack: 12, defense: 23
    }, 'p2', { instanceId: 'cp2_taunt' });
    GameStateModel.registerCard(state, cp2, 'field', 'p2');
    assert.equal(CardRules.validateAttackTarget(state, attacker.instanceId, target.instanceId).valid, false);
    assert.equal(CardRules.validateAttackTarget(state, attacker.instanceId, cp2.instanceId).valid, true);
});

function grantDirectAttackEquipment(definitionId) {
    const { state, attacker, target, engine } = createCombatFixture({ targetDefense: 100 });
    CardRules.install(engine);
    const equipment = GameStateModel.createCardInstance({
        id: definitionId, name: definitionId, type: 'suporte', cost: 1, attack: 0, defense: 0
    }, 'p1', { instanceId: `${definitionId}_direct` });
    GameStateModel.registerCard(state, equipment, 'equipment', 'p1');
    equipment.attachedTo = attacker.instanceId;
    attacker.attachments.push(equipment.instanceId);
    const effects = CardRules.createEquipmentEffects(equipment, attacker.instanceId, state);
    const result = engine.resolveAction({
        type: 'GRANT_DIRECT_TEST',
        actorId: 'p1',
        sourceId: equipment.instanceId,
        effects
    });
    return { state, attacker, target, equipment, engine, result };
}

test('ataque direto básico exige campo vazio e criaturas aéreas ignoram defensores', () => {
    const { state, attacker, target } = createCombatFixture();
    assert.equal(CardRules.canDirectAttack(state, attacker.instanceId), false);
    GameStateModel.moveCard(state, target.instanceId, 'discard', 'p2');
    assert.equal(CardRules.canDirectAttack(state, attacker.instanceId), true);

    const flying = GameStateModel.createCardInstance({
        id: 'card_010_1', name: 'Diabrete', type: 'criatura', cost: 2, attack: 10, defense: 8
    }, 'p1', { instanceId: 'flying_direct' });
    GameStateModel.registerCard(state, flying, 'field', 'p1');
    const newDefender = GameStateModel.createCardInstance(target.data, 'p2', { instanceId: 'new_defender' });
    GameStateModel.registerCard(state, newDefender, 'field', 'p2');
    assert.equal(CardRules.canDirectAttack(state, flying.instanceId), true);
    flying.definitionId = 'card_035';
    assert.equal(CardRules.canDirectAttack(state, flying.instanceId), true);
});

test('Atravessava limpa permissão ao sair e Rego expira no fim do turno', () => {
    const atravessava = grantDirectAttackEquipment('card_028');
    assert.equal(atravessava.result.status, 'resolved');
    assert.equal(CardRules.canDirectAttack(atravessava.state, atravessava.attacker.instanceId), true);
    atravessava.engine.resolveAction({
        type: 'REMOVE_DIRECT_EQUIPMENT',
        actorId: 'p1',
        sourceId: atravessava.equipment.instanceId,
        effects: [{
            kind: GameEngine.EFFECT_KINDS.MOVE_CARD,
            instanceId: atravessava.equipment.instanceId,
            destinationZone: 'discard',
            destinationPlayerId: 'p1'
        }]
    });
    assert.equal(CardRules.canDirectAttack(atravessava.state, atravessava.attacker.instanceId), false);

    const rego = grantDirectAttackEquipment('card_088');
    assert.equal(CardRules.canDirectAttack(rego.state, rego.attacker.instanceId), true);
    rego.engine.emit(GameEngine.EVENT_TYPES.TURN_ENDED, {
        playerId: 'p1',
        turnNumber: rego.state.turn
    });
    assert.equal(CardRules.canDirectAttack(rego.state, rego.attacker.instanceId), false);
});

test('Estrela Mágica consome e anula somente o próximo ataque', () => {
    const { state, attacker, target, engine } = createCombatFixture({ targetDefense: 100 });
    attacker.modifiers.push({
        id: 'two_attacks_for_shield',
        stat: 'attackLimit',
        operation: GameEngine.MODIFIER_OPERATIONS.SET,
        value: 2
    });
    CardRules.install(engine);
    const star = GameStateModel.createCardInstance({
        id: 'card_002', name: 'Estrela', type: 'suporte', cost: 1, attack: 5, defense: 7
    }, 'p2', { instanceId: 'magic_star' });
    GameStateModel.registerCard(state, star, 'equipment', 'p2');
    star.attachedTo = target.instanceId;
    target.attachments.push(star.instanceId);
    const effects = CardRules.createEquipmentEffects(star, target.instanceId, state);
    assert.equal(engine.resolveAction({
        type: 'ADD_SHIELD', actorId: 'p2', sourceId: star.instanceId,
        requiresControl: false, effects
    }).status, 'resolved');

    const first = engine.resolveCombat({ attackerId: attacker.instanceId, targetId: target.instanceId });
    const second = engine.resolveCombat({ attackerId: attacker.instanceId, targetId: target.instanceId });

    assert.equal(first.cancelled, true);
    assert.equal(target.damage, 15);
    assert.equal(engine.getAttackCount(attacker.instanceId), 2);
    assert.equal(second.cancelled, false);
    assert.equal(state.effects.some(effect => effect.effectType === 'MAGIC_SHIELD'), false);
});

function addFieldCreature(state, playerId, definitionId, instanceId, options = {}) {
    const card = GameStateModel.createCardInstance({
        id: definitionId,
        name: definitionId,
        type: options.type || 'criatura',
        cost: options.cost ?? 3,
        attack: options.attack ?? 10,
        defense: options.defense ?? 10
    }, playerId, { instanceId });
    GameStateModel.registerCard(state, card, 'field', playerId);
    return card;
}

test('Slipul e Marik recalculam bônus pela quantidade atual de inimigos', () => {
    const slipulFixture = createSummonRuleFixture('card_024');
    const enemy1 = addFieldCreature(slipulFixture.state, 'p2', 'enemy_1', 'slipul_enemy_1');
    const enemy2 = addFieldCreature(slipulFixture.state, 'p2', 'enemy_2', 'slipul_enemy_2');
    emitSummoned(slipulFixture.engine, slipulFixture.source);
    assert.equal(slipulFixture.engine.getEffectiveStat(slipulFixture.source.instanceId, 'attack'), 20);
    assert.equal(slipulFixture.engine.getEffectiveStat(slipulFixture.source.instanceId, 'defense'), 20);
    const ally = addFieldCreature(slipulFixture.state, 'p1', 'ally', 'slipul_ally');
    assert.equal(slipulFixture.engine.getEffectiveStat(slipulFixture.source.instanceId, 'attack'), 10);
    GameStateModel.moveCard(slipulFixture.state, ally.instanceId, 'discard', 'p1');
    GameStateModel.moveCard(slipulFixture.state, enemy2.instanceId, 'discard', 'p2');
    assert.equal(slipulFixture.engine.getEffectiveStat(slipulFixture.source.instanceId, 'attack'), 15);

    const marikFixture = createSummonRuleFixture('card_077');
    const marikEnemy1 = addFieldCreature(marikFixture.state, 'p2', 'enemy_a', 'marik_enemy_1');
    const marikEnemy2 = addFieldCreature(marikFixture.state, 'p2', 'enemy_b', 'marik_enemy_2');
    emitSummoned(marikFixture.engine, marikFixture.source);
    assert.equal(marikFixture.engine.getEffectiveStat(marikFixture.source.instanceId, 'attack'), 20);
    GameStateModel.moveCard(marikFixture.state, marikEnemy1.instanceId, 'discard', 'p2');
    assert.equal(marikFixture.engine.getEffectiveStat(marikFixture.source.instanceId, 'attack'), 15);
    assert.equal(marikEnemy2.zone, 'field');
    assert.equal(enemy1.zone, 'field');
});

test('condições de aliado ativam e desativam 040, 043 e 068', () => {
    const shimbard = createSummonRuleFixture('card_040');
    emitSummoned(shimbard.engine, shimbard.source);
    assert.equal(shimbard.engine.getEffectiveStat(shimbard.source.instanceId, 'defense'), 20);
    const shimbardAlly = addFieldCreature(shimbard.state, 'p1', 'ally', 'shimbard_ally');
    assert.equal(shimbard.engine.getEffectiveStat(shimbard.source.instanceId, 'defense'), 10);
    GameStateModel.moveCard(shimbard.state, shimbardAlly.instanceId, 'discard', 'p1');
    assert.equal(shimbard.engine.getEffectiveStat(shimbard.source.instanceId, 'defense'), 20);

    const goblin = createSummonRuleFixture('card_043');
    emitSummoned(goblin.engine, goblin.source);
    assert.equal(goblin.engine.getEffectiveStat(goblin.source.instanceId, 'attack'), 10);
    const cheapAlly = addFieldCreature(goblin.state, 'p1', 'cheap', 'cheap_ally', { cost: 2 });
    assert.equal(goblin.engine.getEffectiveStat(goblin.source.instanceId, 'attack'), 20);
    GameStateModel.moveCard(goblin.state, cheapAlly.instanceId, 'discard', 'p1');
    assert.equal(goblin.engine.getEffectiveStat(goblin.source.instanceId, 'attack'), 10);

    const paladin = createSummonRuleFixture('card_068');
    emitSummoned(paladin.engine, paladin.source);
    assert.equal(paladin.engine.getEffectiveStat(paladin.source.instanceId, 'defense'), 20);
    addFieldCreature(paladin.state, 'p1', 'ally', 'paladin_ally');
    assert.equal(paladin.engine.getEffectiveStat(paladin.source.instanceId, 'defense'), 10);
});

test('Turtol Maximus reage à quantidade de inimigos e evoluções recebem regra de entrada', () => {
    const fixture = createSummonRuleFixture('card_075');
    fixture.source.data.type = 'evolução';
    const enemy = addFieldCreature(fixture.state, 'p2', 'enemy', 'maximus_enemy');
    emitSummoned(fixture.engine, fixture.source);
    assert.equal(fixture.engine.getEffectiveStat(fixture.source.instanceId, 'defense'), 20);
    addFieldCreature(fixture.state, 'p2', 'enemy2', 'maximus_enemy_2');
    assert.equal(fixture.engine.getEffectiveStat(fixture.source.instanceId, 'defense'), 10);
    assert.equal(enemy.zone, 'field');
});

test('Scoul ativa +10/+10 com dragão inferido por ID em qualquer campo', () => {
    const fixture = createSummonRuleFixture('card_037');
    emitSummoned(fixture.engine, fixture.source);
    assert.equal(fixture.engine.getEffectiveStat(fixture.source.instanceId, 'attack'), 10);
    const dragon = addFieldCreature(fixture.state, 'p2', 'card_052', 'copper_dragon');
    assert.equal(CardRules.hasTrait(dragon, 'dragao'), true);
    assert.equal(fixture.engine.getEffectiveStat(fixture.source.instanceId, 'attack'), 20);
    assert.equal(fixture.engine.getEffectiveStat(fixture.source.instanceId, 'defense'), 20);
    GameStateModel.moveCard(fixture.state, dragon.instanceId, 'discard', 'p2');
    assert.equal(fixture.engine.getEffectiveStat(fixture.source.instanceId, 'attack'), 10);
});

test('K-023 concede +5 ATK a todos os robôs aliados e limpa ao sair', () => {
    const fixture = createSummonRuleFixture('card_033');
    const robot1 = addFieldCreature(fixture.state, 'p1', 'card_018', 'robot_1');
    const robot2 = addFieldCreature(fixture.state, 'p1', 'card_065', 'robot_2');
    emitSummoned(fixture.engine, fixture.source);
    assert.equal(fixture.engine.getEffectiveStat(fixture.source.instanceId, 'attack'), 15);
    assert.equal(fixture.engine.getEffectiveStat(robot1.instanceId, 'attack'), 15);
    assert.equal(fixture.engine.getEffectiveStat(robot2.instanceId, 'attack'), 15);
    fixture.engine.resolveAction({
        type: 'REMOVE_K023', actorId: 'p1', sourceId: fixture.source.instanceId,
        effects: [{
            kind: GameEngine.EFFECT_KINDS.MOVE_CARD,
            instanceId: fixture.source.instanceId,
            destinationZone: 'discard',
            destinationPlayerId: 'p1'
        }]
    });
    assert.equal(fixture.engine.getEffectiveStat(robot1.instanceId, 'attack'), 10);
    assert.equal(fixture.engine.getEffectiveStat(robot2.instanceId, 'attack'), 10);
});

test('Dispositivo de Sincronia exige robô e concede +5/+5 aos robôs aliados', () => {
    const state = GameStateModel.createInitialGameState();
    const engine = GameEngine.createEngine(state);
    CardRules.install(engine);
    const host = addFieldCreature(state, 'p1', 'card_033', 'sync_host');
    const otherRobot = addFieldCreature(state, 'p1', 'card_018', 'sync_robot');
    const nonRobot = addFieldCreature(state, 'p1', 'normal', 'sync_normal');
    const device = GameStateModel.createCardInstance({
        id: 'card_098', name: 'Dispositivo', type: 'suporte', cost: 3, attack: 5, defense: 5
    }, 'p1', { instanceId: 'sync_device' });
    GameStateModel.registerCard(state, device, 'equipment', 'p1');
    device.attachedTo = host.instanceId;
    host.attachments.push(device.instanceId);
    assert.equal(CardRules.validateEquipmentTarget(device, host).valid, true);
    assert.equal(CardRules.validateEquipmentTarget(device, nonRobot).valid, false);
    assert.equal(engine.resolveAction({
        type: 'SYNC_DEVICE_TEST', actorId: 'p1', sourceId: device.instanceId,
        effects: CardRules.createEquipmentEffects(device, host.instanceId, state)
    }).status, 'resolved');
    assert.equal(engine.getEffectiveStat(host.instanceId, 'attack'), 20);
    assert.equal(engine.getEffectiveStat(host.instanceId, 'defense'), 15);
    assert.equal(engine.getEffectiveStat(otherRobot.instanceId, 'attack'), 20);
    assert.equal(engine.getEffectiveStat(otherRobot.instanceId, 'defense'), 15);
    assert.equal(engine.getEffectiveStat(nonRobot.instanceId, 'attack'), 10);
});

test('proteções condicionais 058, 059 e 060 acompanham o campo atual', () => {
    const { state, attacker, target } = createCombatFixture();
    attacker.data.cost = 4;
    target.definitionId = 'card_058';
    assert.equal(CardRules.validateAttackTarget(state, attacker.instanceId, target.instanceId).valid, false);
    const targetAlly = addFieldCreature(state, 'p2', 'ally', 'conditional_ally');
    assert.equal(CardRules.validateAttackTarget(state, attacker.instanceId, target.instanceId).valid, true);

    target.definitionId = 'card_059';
    GameStateModel.moveCard(state, targetAlly.instanceId, 'discard', 'p2');
    assert.equal(CardRules.validateAttackTarget(state, attacker.instanceId, target.instanceId).valid, false);
    const attackerAlly = addFieldCreature(state, 'p1', 'ally2', 'attacker_ally');
    assert.equal(CardRules.validateAttackTarget(state, attacker.instanceId, target.instanceId).valid, true);

    target.definitionId = 'normal';
    const tranca = addFieldCreature(state, 'p2', 'card_060', 'tranca_rua');
    const otherDefender = addFieldCreature(state, 'p2', 'other', 'other_defender');
    assert.equal(CardRules.validateAttackTarget(state, attacker.instanceId, otherDefender.instanceId).valid, false);
    assert.equal(CardRules.validateAttackTarget(state, attacker.instanceId, tranca.instanceId).valid, true);
    assert.equal(attackerAlly.zone, 'field');
});

test('invocação, equipamento e destruição reprojetam todos os campos uma vez', () => {
    const gameHtml = fs.readFileSync(path.join(__dirname, '../../game.html'), 'utf8');
    const functionBody = (name, nextName) => {
        const start = gameHtml.indexOf(`function ${name}`);
        const end = gameHtml.indexOf(`function ${nextName}`, start);
        assert.notEqual(start, -1, `Função ${name} não encontrada`);
        assert.notEqual(end, -1, `Limite ${nextName} não encontrado`);
        return gameHtml.slice(start, end);
    };
    const countRenders = body => (body.match(/renderFieldsFromState\(\);/g) || []).length;

    assert.equal(countRenders(functionBody('dropCard', 'findCardData')), 1);
    assert.equal(countRenders(functionBody('equipSupportCard', 'highlightEquippableCreatures')), 1);
    assert.equal(countRenders(functionBody('destroyCard', 'resetGame')), 1);
});

test('Núcleo de Energia Pura aceita dragão ou elite e aplica somente +5/+5', () => {
    const state = GameStateModel.createInitialGameState();
    const engine = GameEngine.createEngine(state);
    CardRules.install(engine);
    const dragon = addFieldCreature(state, 'p1', 'card_052', 'nucleo_dragon');
    const elite = addFieldCreature(state, 'p1', 'card_087', 'nucleo_elite');
    const normal = addFieldCreature(state, 'p1', 'normal', 'nucleo_normal');
    const core = GameStateModel.createCardInstance({
        id: 'card_104', name: 'Núcleo', type: 'suporte', cost: 4, attack: 10, defense: 10
    }, 'p1', { instanceId: 'nucleo_support' });
    GameStateModel.registerCard(state, core, 'equipment', 'p1');

    assert.equal(CardRules.validateEquipmentTarget(core, dragon).valid, true);
    assert.equal(CardRules.validateEquipmentTarget(core, elite).valid, true);
    assert.equal(CardRules.validateEquipmentTarget(core, normal).valid, false);
    assert.equal(engine.resolveAction({
        type: 'NUCLEO_TEST', actorId: 'p1', sourceId: core.instanceId,
        effects: CardRules.createEquipmentEffects(core, dragon.instanceId, state)
    }).status, 'resolved');
    assert.equal(engine.getEffectiveStat(dragon.instanceId, 'attack'), 15);
    assert.equal(engine.getEffectiveStat(dragon.instanceId, 'defense'), 15);

    engine.resolveAction({
        type: 'REMOVE_NUCLEO', actorId: 'p1', sourceId: core.instanceId,
        effects: [{
            kind: GameEngine.EFFECT_KINDS.MOVE_CARD,
            instanceId: core.instanceId,
            destinationZone: 'discard',
            destinationPlayerId: 'p1'
        }]
    });
    assert.equal(engine.getEffectiveStat(dragon.instanceId, 'attack'), 10);
    assert.equal(engine.getEffectiveStat(dragon.instanceId, 'defense'), 10);
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