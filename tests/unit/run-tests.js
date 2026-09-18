const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const GameStateModel = require('../../src/js/game-state.js');
const GameEngine = require('../../src/js/game-engine.js');
const CardRules = require('../../src/js/card-rules.js');
// Adiciona os módulos necessários para os novos testes da Parte 2
const PvpProtocol = require('../../src/js/pvp-protocol.js');
const { DeckBuilder, mulberry32 } = require('../../scripts/deck_factory.js');
const cardsDatabase = require('../../data/cards_database.json');

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
        'card_003',
        'card_012',
        'card_013',
        'card_023',
        'card_050',
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
    state.turn = 2; // regra de turno 1 é testada separadamente; aqui o foco é campo vazio
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
    const gameHtml = fs.readFileSync(path.join(__dirname, '../../src/js/game.js'), 'utf8');
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

test('Paladar e Hipool aplicam bônus somente nas comparações aprovadas', () => {
    const paladar = createCombatFixture({ attackerAttack: 10, targetDefense: 15, targetAttack: 0 });
    paladar.attacker.definitionId = 'card_021';
    CardRules.install(paladar.engine);
    const paladarResult = paladar.engine.resolveCombat({
        attackerId: paladar.attacker.instanceId,
        targetId: paladar.target.instanceId
    });
    assert.equal(paladarResult.attackPower, 20);
    assert.equal(paladarResult.damageToTarget, 20);

    const hipool = createCombatFixture({
        attackerAttack: 10,
        attackerDefense: 30,
        targetDefense: 20,
        targetAttack: 0
    });
    hipool.attacker.definitionId = 'card_032';
    CardRules.install(hipool.engine);
    assert.equal(hipool.engine.resolveCombat({
        attackerId: hipool.attacker.instanceId,
        targetId: hipool.target.instanceId
    }).damageToTarget, 20);
});

test('Puma e Minotauro fazem o ATK final penetrar conforme a regra', () => {
    const puma = createCombatFixture({ attackerAttack: 10, targetDefense: 50, targetAttack: 0 });
    puma.attacker.definitionId = 'card_022';
    CardRules.install(puma.engine);
    const pumaResult = puma.engine.resolveCombat({
        attackerId: puma.attacker.instanceId,
        targetId: puma.target.instanceId
    });
    assert.equal(pumaResult.penetratingDamage, 10);
    assert.equal(puma.state.players.p2.pv, 190);

    const minotaur = createCombatFixture({ attackerAttack: 12, targetDefense: 100, targetAttack: 0 });
    minotaur.attacker.definitionId = 'card_056';
    minotaur.attacker.modifiers.push({
        id: 'minotaur_two_attacks', stat: 'attackLimit',
        operation: GameEngine.MODIFIER_OPERATIONS.SET, value: 2
    });
    CardRules.install(minotaur.engine);
    const first = minotaur.engine.resolveCombat({
        attackerId: minotaur.attacker.instanceId,
        targetId: minotaur.target.instanceId
    });
    const second = minotaur.engine.resolveCombat({
        attackerId: minotaur.attacker.instanceId,
        targetId: minotaur.target.instanceId
    });
    assert.equal(first.penetratingDamage, 12);
    assert.equal(second.penetratingDamage, 0);
});

test('Gamaa, Tiranossauro e Lobo Alfa ignoram a quantidade declarada de DEF', () => {
    const gamaa = createCombatFixture({ attackerAttack: 10, targetDefense: 25, targetAttack: 0 });
    gamaa.attacker.definitionId = 'card_064';
    addFieldCreature(gamaa.state, 'p1', 'card_018', 'gamaa_robot_1');
    addFieldCreature(gamaa.state, 'p1', 'card_033', 'gamaa_robot_2');
    CardRules.install(gamaa.engine);
    assert.equal(gamaa.engine.resolveCombat({
        attackerId: gamaa.attacker.instanceId,
        targetId: gamaa.target.instanceId
    }).penetratingDamage, 5);

    const tyrannosaurus = createCombatFixture({ attackerAttack: 50, targetDefense: 55, targetAttack: 0 });
    tyrannosaurus.attacker.definitionId = 'card_070';
    CardRules.install(tyrannosaurus.engine);
    assert.equal(tyrannosaurus.engine.resolveCombat({
        attackerId: tyrannosaurus.attacker.instanceId,
        targetId: tyrannosaurus.target.instanceId
    }).penetratingDamage, 5);

    const alpha = createCombatFixture({ attackerAttack: 57, targetDefense: 70, targetAttack: 0 });
    alpha.attacker.definitionId = 'card_078';
    CardRules.install(alpha.engine);
    assert.equal(alpha.engine.resolveCombat({
        attackerId: alpha.attacker.instanceId,
        targetId: alpha.target.instanceId
    }).penetratingDamage, 7);
});

test('Mexica dobra somente o primeiro ataque de cada turno', () => {
    const { state, attacker, engine } = createCombatFixture({ attackerAttack: 10 });
    attacker.definitionId = 'card_066';
    attacker.modifiers.push({
        id: 'mexica_two_attacks', stat: 'attackLimit',
        operation: GameEngine.MODIFIER_OPERATIONS.SET, value: 2
    });
    CardRules.install(engine);
    assert.equal(engine.resolveCombat({ attackerId: attacker.instanceId, isDirect: true }).directDamage, 20);
    assert.equal(engine.resolveCombat({ attackerId: attacker.instanceId, isDirect: true }).directDamage, 10);
    assert.equal(state.players.p2.pv, 170);
});

test('Nucles e Couraça reduzem dano físico e podem empilhar', () => {
    const fixture = createCombatFixture({ attackerAttack: 30, targetDefense: 100, targetAttack: 0 });
    fixture.attacker.data.cost = 8;
    fixture.target.definitionId = 'card_074';
    fixture.target.definitionId = 'card_018';
    const armor = GameStateModel.createCardInstance({
        id: 'card_103', name: 'Couraça', type: 'suporte', cost: 4, attack: 0, defense: 10
    }, 'p2', { instanceId: 'nano_armor' });
    GameStateModel.registerCard(fixture.state, armor, 'equipment', 'p2');
    armor.attachedTo = fixture.target.instanceId;
    fixture.target.attachments.push(armor.instanceId);
    CardRules.install(fixture.engine);
    fixture.engine.resolveAction({
        type: 'ARMOR_TEST', actorId: 'p2', sourceId: armor.instanceId,
        requiresControl: false,
        effects: CardRules.createEquipmentEffects(armor, fixture.target.instanceId, fixture.state)
    });
    const armorResult = fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        targetId: fixture.target.instanceId
    });
    assert.equal(armorResult.damageToTarget, 20);

    const nucles = createCombatFixture({ attackerAttack: 30, targetDefense: 100, targetAttack: 0 });
    nucles.target.definitionId = 'card_074';
    CardRules.install(nucles.engine);
    assert.equal(nucles.engine.resolveCombat({
        attackerId: nucles.attacker.instanceId,
        targetId: nucles.target.instanceId
    }).damageToTarget, 20);
});

test('Condessa usa ATK-15 e acumula +10 ATK por abate com rollback', () => {
    const fixture = createCombatFixture({ attackerAttack: 47, targetDefense: 30, targetAttack: 0 });
    fixture.attacker.definitionId = 'card_076';
    CardRules.install(fixture.engine);
    const result = fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        targetId: fixture.target.instanceId
    });
    assert.equal(result.damageToTarget, 32);
    assert.equal(result.targetDestroyed, true);
    assert.equal(fixture.engine.getEffectiveStat(fixture.attacker.instanceId, 'attack'), 57);

    const rollback = createCombatFixture({ attackerAttack: 47, targetDefense: 30, targetAttack: 0 });
    rollback.attacker.definitionId = 'card_076';
    CardRules.install(rollback.engine);
    rollback.engine.registerEventHandler(GameEngine.EVENT_TYPES.AFTER_ATTACK, () => ({
        kind: 'UNKNOWN_EFFECT'
    }), -1);
    assert.equal(rollback.engine.resolveCombat({
        attackerId: rollback.attacker.instanceId,
        targetId: rollback.target.instanceId
    }).status, 'failed');
    assert.equal(rollback.engine.getEffectiveStat(rollback.attacker.instanceId, 'attack'), 47);
    assert.equal(rollback.target.zone, 'field');
});

test('Aladar recupera orçamento de ataque após abate', () => {
    const fixture = createCombatFixture({ attackerAttack: 20, targetDefense: 20, targetAttack: 0 });
    fixture.attacker.definitionId = 'card_029';
    CardRules.install(fixture.engine);
    const result = fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        targetId: fixture.target.instanceId
    });

    assert.equal(result.targetDestroyed, true);
    assert.equal(fixture.engine.getAttackCount(fixture.attacker.instanceId), 1);
    assert.equal(fixture.engine.getAttackLimit(fixture.attacker.instanceId), 2);
    assert.equal(fixture.engine.canAttack(fixture.attacker.instanceId).canAttack, true);
    fixture.engine.emit(GameEngine.EVENT_TYPES.TURN_ENDED, { playerId: 'p1', turnNumber: 1 });
    assert.equal(fixture.engine.getAttackLimit(fixture.attacker.instanceId), 1);
});

test('Rei das Feras e Dragão de Cobre causam 10 PV após abate', () => {
    for (const definitionId of ['card_036', 'card_052']) {
        const fixture = createCombatFixture({ attackerAttack: 20, targetDefense: 20, targetAttack: 0 });
        fixture.attacker.definitionId = definitionId;
        CardRules.install(fixture.engine);
        const result = fixture.engine.resolveCombat({
            attackerId: fixture.attacker.instanceId,
            targetId: fixture.target.instanceId
        });
        assert.equal(result.targetDestroyed, true);
        assert.equal(fixture.state.players.p2.pv, 190);
    }
});

test('Cacton reflete metade do dano físico arredondando para baixo', () => {
    const fixture = createCombatFixture({
        attackerAttack: 21,
        attackerDefense: 50,
        targetDefense: 100,
        targetAttack: 0
    });
    fixture.target.definitionId = 'card_030';
    CardRules.install(fixture.engine);
    const result = fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        targetId: fixture.target.instanceId
    });

    assert.equal(result.status, 'resolved');
    assert.equal(fixture.target.damage, 21);
    assert.equal(fixture.attacker.damage, 10);
});

test('Dragão de Jade causa 10 ao atacante quando vira alvo', () => {
    const fixture = createCombatFixture({
        attackerAttack: 10,
        attackerDefense: 50,
        targetDefense: 100,
        targetAttack: 0
    });
    fixture.target.definitionId = 'card_071';
    CardRules.install(fixture.engine);
    fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        targetId: fixture.target.instanceId
    });
    assert.equal(fixture.attacker.damage, 10);
    assert.equal(fixture.target.damage, 10);
});

test('Fantom substitui morte por retorno à mão sem dano residual', () => {
    const fixture = createCombatFixture({ attackerAttack: 15, targetDefense: 10, targetAttack: 0 });
    fixture.target.definitionId = 'card_042';
    CardRules.install(fixture.engine);
    const result = fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        targetId: fixture.target.instanceId
    });

    assert.equal(result.status, 'resolved');
    assert.equal(result.targetDestroyed, false);
    assert.equal(result.penetratingDamage, 0);
    assert.equal(fixture.target.zone, 'hand');
    assert.equal(fixture.target.damage, 0);
    assert.equal(fixture.state.cards.p2.hand.includes(fixture.target), true);
});

test('Lorde Sanguinário transfere até 10 PV somente uma vez por turno', () => {
    const fixture = createCombatFixture({ attackerAttack: 20, targetDefense: 20, targetAttack: 0 });
    fixture.attacker.definitionId = 'card_054';
    fixture.attacker.modifiers.push({
        id: 'lorde_two_attacks', stat: 'attackLimit',
        operation: GameEngine.MODIFIER_OPERATIONS.SET, value: 2
    });
    const secondTarget = addFieldCreature(
        fixture.state,
        'p2',
        'second_target',
        'lorde_second_target',
        { attack: 0, defense: 20 }
    );
    CardRules.install(fixture.engine);

    fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        targetId: fixture.target.instanceId
    });
    assert.equal(fixture.state.players.p1.pv, 210);
    assert.equal(fixture.state.players.p2.pv, 190);
    fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        targetId: secondTarget.instanceId
    });
    assert.equal(fixture.state.players.p1.pv, 210);
    assert.equal(fixture.state.players.p2.pv, 190);
});

function attachVengeanceAura(fixture) {
    fixture.target.definitionId = 'card_087';
    const aura = GameStateModel.createCardInstance({
        id: 'card_108', name: 'Aura', type: 'suporte', cost: 5, attack: 10, defense: 5
    }, 'p2', { instanceId: 'vengeance_aura' });
    GameStateModel.registerCard(fixture.state, aura, 'equipment', 'p2');
    aura.attachedTo = fixture.target.instanceId;
    fixture.target.attachments.push(aura.instanceId);
    return aura;
}

test('Aura de Vingança usa ATK efetivo pré-morte e respeita owner', () => {
    const fixture = createCombatFixture({ attackerAttack: 40, targetDefense: 10, targetAttack: 30 });
    const aura = attachVengeanceAura(fixture);
    CardRules.install(fixture.engine);
    const result = fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        targetId: fixture.target.instanceId
    });

    assert.equal(result.targetDestroyed, true);
    assert.equal(fixture.state.players.p1.pv, 170);
    assert.equal(aura.zone, 'discard');
    assert.equal(fixture.state.cards.p2.discard.includes(aura), true);
});

test('rollback tardio desfaz Aura, morte, dano e descarte', () => {
    const fixture = createCombatFixture({ attackerAttack: 40, targetDefense: 10, targetAttack: 30 });
    const aura = attachVengeanceAura(fixture);
    CardRules.install(fixture.engine);
    fixture.engine.registerEventHandler(GameEngine.EVENT_TYPES.CREATURE_DESTROYED, () => ({
        kind: 'UNKNOWN_EFFECT'
    }), -1);

    const result = fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        targetId: fixture.target.instanceId
    });

    assert.equal(result.status, 'failed');
    assert.equal(fixture.state.players.p1.pv, 200);
    assert.equal(fixture.target.zone, 'field');
    assert.equal(aura.zone, 'equipment');
    assert.equal(aura.attachedTo, fixture.target.instanceId);
    assert.equal(fixture.target.attachments.includes(aura.instanceId), true);
});

function installAttackEquipment(fixture, definitionId) {
    const equipment = GameStateModel.createCardInstance({
        id: definitionId,
        name: definitionId,
        type: 'suporte',
        cost: 1,
        attack: 99,
        defense: 99
    }, 'p1', { instanceId: `${definitionId}_attack_equipment` });
    GameStateModel.registerCard(fixture.state, equipment, 'equipment', 'p1');
    equipment.attachedTo = fixture.attacker.instanceId;
    fixture.attacker.attachments.push(equipment.instanceId);
    const result = fixture.engine.resolveAction({
        type: 'ATTACK_EQUIPMENT_TEST',
        actorId: 'p1',
        sourceId: equipment.instanceId,
        effects: CardRules.createEquipmentEffects(
            equipment,
            fixture.attacker.instanceId,
            fixture.state
        )
    });
    assert.equal(result.status, 'resolved');
    return equipment;
}

test('Tobias e Botas causam metade no segundo ataque', () => {
    for (const kind of ['card_047', 'card_100']) {
        const fixture = createCombatFixture({
            attackerAttack: 25,
            targetDefense: 100,
            targetAttack: 0
        });
        CardRules.install(fixture.engine);
        if (kind === 'card_047') {
            fixture.attacker.definitionId = kind;
            emitSummoned(fixture.engine, fixture.attacker);
        } else {
            installAttackEquipment(fixture, kind);
        }

        const first = fixture.engine.resolveCombat({
            attackerId: fixture.attacker.instanceId,
            targetId: fixture.target.instanceId
        });
        const second = fixture.engine.resolveCombat({
            attackerId: fixture.attacker.instanceId,
            targetId: fixture.target.instanceId
        });
        assert.equal(first.damageToTarget, 25);
        assert.equal(second.damageToTarget, 12);
        assert.equal(fixture.engine.getAttackCount(fixture.attacker.instanceId), 2);
    }
});

test('Imperial X realiza dois ataques integrais', () => {
    const fixture = createCombatFixture({ attackerAttack: 25, targetDefense: 100, targetAttack: 0 });
    fixture.attacker.definitionId = 'card_084';
    CardRules.install(fixture.engine);
    emitSummoned(fixture.engine, fixture.attacker);

    assert.equal(fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        targetId: fixture.target.instanceId
    }).damageToTarget, 25);
    assert.equal(fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        targetId: fixture.target.instanceId
    }).damageToTarget, 25);
    assert.equal(fixture.engine.canAttack(fixture.attacker.instanceId).canAttack, false);
});

test('Machado exige alvo diferente e reduz o segundo ataque pela metade', () => {
    const fixture = createCombatFixture({ attackerAttack: 25, targetDefense: 100, targetAttack: 0 });
    const secondTarget = addFieldCreature(
        fixture.state,
        'p2',
        'second',
        'machado_second_target',
        { attack: 0, defense: 100 }
    );
    CardRules.install(fixture.engine);
    installAttackEquipment(fixture, 'card_096');
    const targetValidator = ({ state, attacker, target }) =>
        CardRules.validateAttackTarget(state, attacker.instanceId, target.instanceId);

    assert.equal(fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        targetId: fixture.target.instanceId,
        targetValidator
    }).damageToTarget, 25);
    assert.equal(fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        targetId: fixture.target.instanceId,
        targetValidator
    }).status, 'rejected');
    assert.equal(fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        targetId: secondTarget.instanceId,
        targetValidator
    }).damageToTarget, 12);
    assert.deepEqual(fixture.engine.getAttackTargets(fixture.attacker.instanceId), [
        fixture.target.instanceId,
        secondTarget.instanceId
    ]);
});

test('Apelino permite vários ataques e volta ao limite base ao sair', () => {
    const fixture = createCombatFixture({ attackerAttack: 10, targetDefense: 100, targetAttack: 0 });
    CardRules.install(fixture.engine);
    const equipment = installAttackEquipment(fixture, 'card_089');
    GameStateModel.moveCard(fixture.state, fixture.target.instanceId, 'discard', 'p2');

    for (let count = 0; count < 3; count++) {
        assert.equal(fixture.engine.resolveCombat({
            attackerId: fixture.attacker.instanceId,
            isDirect: true
        }).status, 'resolved');
    }
    assert.equal(fixture.engine.getAttackCount(fixture.attacker.instanceId), 3);

    fixture.engine.resolveAction({
        type: 'REMOVE_APELINO', actorId: 'p1', sourceId: equipment.instanceId,
        effects: [{
            kind: GameEngine.EFFECT_KINDS.MOVE_CARD,
            instanceId: equipment.instanceId,
            destinationZone: 'discard',
            destinationPlayerId: 'p1'
        }]
    });
    assert.equal(fixture.engine.getAttackLimit(fixture.attacker.instanceId), 1);
    assert.equal(fixture.engine.canAttack(fixture.attacker.instanceId).canAttack, false);
});

test('Beluga ataca diretamente pela metade mesmo com defensor', () => {
    const fixture = createCombatFixture({ attackerAttack: 33, targetDefense: 100, targetAttack: 0 });
    fixture.attacker.definitionId = 'card_063';
    CardRules.install(fixture.engine);

    assert.equal(CardRules.canDirectAttack(fixture.state, fixture.attacker.instanceId), true);
    const result = fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        isDirect: true,
        allowDirectAttack: true
    });
    assert.equal(result.directDamage, 16);
    assert.equal(fixture.state.players.p2.pv, 184);
    assert.equal(fixture.engine.canAttack(fixture.attacker.instanceId).canAttack, false);
});

test('fontes de dois ataques não acumulam acima de dois e Apelino prevalece', () => {
    const fixture = createCombatFixture();
    fixture.attacker.definitionId = 'card_047';
    CardRules.install(fixture.engine);
    emitSummoned(fixture.engine, fixture.attacker);
    installAttackEquipment(fixture, 'card_100');
    installAttackEquipment(fixture, 'card_096');
    assert.equal(fixture.engine.getAttackLimit(fixture.attacker.instanceId), 2);

    installAttackEquipment(fixture, 'card_089');
    assert.equal(
        fixture.engine.getAttackLimit(fixture.attacker.instanceId),
        Number.MAX_SAFE_INTEGER
    );
});

test('Beluga usa bypass direto uma vez e mantém ataque adicional contra criatura', () => {
    const fixture = createCombatFixture({ attackerAttack: 33, targetDefense: 100, targetAttack: 0 });
    fixture.attacker.definitionId = 'card_063';
    CardRules.install(fixture.engine);
    installAttackEquipment(fixture, 'card_100');

    assert.equal(CardRules.canDirectAttack(fixture.state, fixture.attacker.instanceId), true);
    const direct = fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        isDirect: true,
        allowDirectAttack: CardRules.canDirectAttack(fixture.state, fixture.attacker.instanceId)
    });
    assert.equal(direct.directDamage, 16);
    assert.equal(CardRules.canDirectAttack(fixture.state, fixture.attacker.instanceId), false);
    const secondDirect = fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        isDirect: true,
        allowDirectAttack: CardRules.canDirectAttack(fixture.state, fixture.attacker.instanceId)
    });
    assert.equal(secondDirect.status, 'rejected');

    const creatureAttack = fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        targetId: fixture.target.instanceId
    });
    assert.equal(creatureAttack.status, 'resolved');
    assert.equal(creatureAttack.damageToTarget, 16);
    assert.equal(fixture.engine.getAttackCount(fixture.attacker.instanceId), 2);
});

function createAreaAbilityFixture(definitionId) {
    const state = GameStateModel.createInitialGameState();
    const engine = GameEngine.createEngine(state);
    CardRules.install(engine);
    const source = addFieldCreature(state, 'p1', definitionId, `${definitionId}_area_source`, {
        attack: 30,
        defense: 30
    });
    const ally = addFieldCreature(state, 'p1', 'ally', `${definitionId}_area_ally`, {
        defense: 20
    });
    const enemy1 = addFieldCreature(state, 'p2', 'enemy1', `${definitionId}_area_enemy_1`, {
        defense: 20
    });
    const enemy2 = addFieldCreature(state, 'p2', 'enemy2', `${definitionId}_area_enemy_2`, {
        defense: 20
    });
    state.currentPhase = 'combat';
    return { state, engine, source, ally, enemy1, enemy2 };
}

test('Dino Elétrico causa 10 a todos os inimigos e não atinge aliados', () => {
    const fixture = createAreaAbilityFixture('card_051');
    const result = CardRules.activateAbility(fixture.engine, fixture.source.instanceId);

    assert.equal(result.status, 'resolved');
    assert.equal(fixture.ally.damage, 0);
    assert.equal(fixture.enemy1.damage, 10);
    assert.equal(fixture.enemy2.damage, 10);
    assert.equal(CardRules.activateAbility(fixture.engine, fixture.source.instanceId).status, 'rejected');
});

test('Quimera aceita de um a três alvos distintos e rejeita seleção inválida', () => {
    const fixture = createAreaAbilityFixture('card_057');
    const enemy3 = addFieldCreature(fixture.state, 'p2', 'enemy3', 'quimera_enemy_3', {
        defense: 20
    });
    const enemy4 = addFieldCreature(fixture.state, 'p2', 'enemy4', 'quimera_enemy_4', {
        defense: 20
    });
    const pending = CardRules.activateAbility(fixture.engine, fixture.source.instanceId);
    const rule = CardRules.getActivatedRule(fixture.source.definitionId);

    assert.equal(pending.status, 'pending_choice');
    assert.equal(fixture.engine.resolveChoice(pending.choiceId, []).status, 'rejected');
    assert.equal(fixture.engine.resolveChoice(pending.choiceId, [
        fixture.enemy1.instanceId,
        fixture.enemy1.instanceId
    ]).status, 'rejected');
    assert.equal(fixture.engine.resolveChoice(pending.choiceId, [
        fixture.enemy1.instanceId,
        fixture.enemy2.instanceId,
        enemy3.instanceId,
        enemy4.instanceId
    ]).status, 'rejected');
    assert.equal(
        fixture.engine.getUsageCount(fixture.source.instanceId, rule.abilityId, rule.limit),
        0
    );

    assert.equal(fixture.engine.resolveChoice(pending.choiceId, [
        fixture.enemy1.instanceId,
        fixture.enemy2.instanceId,
        enemy3.instanceId
    ]).status, 'resolved');
    assert.equal(fixture.enemy1.damage, 5);
    assert.equal(fixture.enemy2.damage, 5);
    assert.equal(enemy3.damage, 5);
    assert.equal(enemy4.damage, 0);
});

test('Quimera recupera após quatro alvos inválidos e aceita três na tentativa seguinte', () => {
    const fixture = createAreaAbilityFixture('card_057');
    const enemy3 = addFieldCreature(fixture.state, 'p2', 'enemy3', 'quimera_retry_3', {
        defense: 20
    });
    const enemy4 = addFieldCreature(fixture.state, 'p2', 'enemy4', 'quimera_retry_4', {
        defense: 20
    });
    const invalid = CardRules.activateAbility(fixture.engine, fixture.source.instanceId, [
        fixture.enemy1.instanceId,
        fixture.enemy2.instanceId,
        enemy3.instanceId,
        enemy4.instanceId
    ]);

    assert.equal(invalid.status, 'rejected');
    assert.equal(fixture.state.pendingChoice, null);
    assert.deepEqual([
        fixture.enemy1.damage,
        fixture.enemy2.damage,
        enemy3.damage,
        enemy4.damage
    ], [0, 0, 0, 0]);

    const valid = CardRules.activateAbility(fixture.engine, fixture.source.instanceId, [
        fixture.enemy1.instanceId,
        fixture.enemy2.instanceId,
        enemy3.instanceId
    ]);
    const rule = CardRules.getActivatedRule(fixture.source.definitionId);
    assert.equal(valid.status, 'resolved');
    assert.equal(fixture.state.pendingChoice, null);
    assert.deepEqual([
        fixture.enemy1.damage,
        fixture.enemy2.damage,
        enemy3.damage,
        enemy4.damage
    ], [5, 5, 5, 0]);
    assert.equal(
        fixture.engine.getUsageCount(fixture.source.instanceId, rule.abilityId, rule.limit),
        1
    );
});

test('dano em lote move letais e attachments aos descartes dos owners', () => {
    const fixture = createAreaAbilityFixture('card_051');
    fixture.enemy1.baseStats.defense = 10;
    fixture.enemy1.data.defense = 10;
    const equipment = GameStateModel.createCardInstance({
        id: 'equipment', name: 'Equipamento', type: 'suporte', cost: 1, attack: 0, defense: 0
    }, 'p2', { instanceId: 'area_equipment' });
    GameStateModel.registerCard(fixture.state, equipment, 'equipment', 'p2');
    equipment.attachedTo = fixture.enemy1.instanceId;
    fixture.enemy1.attachments.push(equipment.instanceId);

    assert.equal(CardRules.activateAbility(fixture.engine, fixture.source.instanceId).status, 'resolved');
    assert.equal(fixture.enemy1.zone, 'discard');
    assert.equal(equipment.zone, 'discard');
    assert.equal(equipment.attachedTo, null);
    assert.equal(fixture.enemy2.zone, 'field');
    assert.equal(fixture.enemy2.damage, 10);
});

test('falha tardia reverte todo o dano em lote, mortes, attachments e uso', () => {
    const fixture = createAreaAbilityFixture('card_051');
    fixture.enemy1.baseStats.defense = 10;
    fixture.enemy1.data.defense = 10;
    const equipment = GameStateModel.createCardInstance({
        id: 'equipment', name: 'Equipamento', type: 'suporte', cost: 1, attack: 0, defense: 0
    }, 'p2', { instanceId: 'area_rollback_equipment' });
    GameStateModel.registerCard(fixture.state, equipment, 'equipment', 'p2');
    equipment.attachedTo = fixture.enemy1.instanceId;
    fixture.enemy1.attachments.push(equipment.instanceId);
    fixture.engine.registerEventHandler(GameEngine.EVENT_TYPES.CREATURE_DESTROYED, () => ({
        kind: 'UNKNOWN_EFFECT'
    }), -1);

    const result = CardRules.activateAbility(fixture.engine, fixture.source.instanceId);
    const rule = CardRules.getActivatedRule(fixture.source.definitionId);
    assert.equal(result.status, 'failed');
    assert.equal(fixture.enemy1.zone, 'field');
    assert.equal(fixture.enemy1.damage, 0);
    assert.equal(fixture.enemy2.damage, 0);
    assert.equal(equipment.zone, 'equipment');
    assert.equal(equipment.attachedTo, fixture.enemy1.instanceId);
    assert.equal(
        fixture.engine.getUsageCount(fixture.source.instanceId, rule.abilityId, rule.limit),
        0
    );
    assert.equal(fixture.state.eventLog.length, 0);
});

function applyAbilityEffect(engine, source, effect) {
    return engine.resolveAction({
        type: 'ABILITY_EFFECT_TEST',
        actorId: source.controllerId,
        sourceId: source.instanceId,
        effects: [{
            ...effect,
            provenance: {
                kind: 'ability',
                sourceId: source.instanceId,
                abilityId: 'test_ability'
            }
        }]
    });
}

test('Turtol bloqueia habilidade de criatura custo menor que 4, mas não combate', () => {
    const fixture = createCombatFixture({ attackerAttack: 10, targetDefense: 100, targetAttack: 0 });
    fixture.target.definitionId = 'card_048';
    fixture.attacker.data.cost = 3;
    CardRules.install(fixture.engine);
    const blocked = applyAbilityEffect(fixture.engine, fixture.attacker, {
        kind: GameEngine.EFFECT_KINDS.ADD_MODIFIER,
        targetId: fixture.target.instanceId,
        modifier: {
            id: 'low_cost_debuff', sourceId: fixture.attacker.instanceId,
            stat: 'attack', operation: GameEngine.MODIFIER_OPERATIONS.ADD, value: -5
        }
    });
    assert.equal(blocked.status, 'resolved');
    assert.equal(fixture.target.modifiers.length, 0);

    const combat = fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        targetId: fixture.target.instanceId
    });
    assert.equal(combat.damageToTarget, 10);
    assert.equal(fixture.target.damage, 10);

    const highCostSource = addFieldCreature(
        fixture.state, 'p1', 'high_source', 'high_cost_source', { cost: 4 }
    );
    assert.equal(applyAbilityEffect(fixture.engine, highCostSource, {
        kind: GameEngine.EFFECT_KINDS.ADD_MODIFIER,
        targetId: fixture.target.instanceId,
        modifier: {
            id: 'cost_four_debuff', sourceId: highCostSource.instanceId,
            stat: 'attack', operation: GameEngine.MODIFIER_OPERATIONS.ADD, value: -5
        }
    }).status, 'resolved');
    assert.equal(fixture.target.modifiers.length, 1);
});

test('Iron Dragon bloqueia habilidades inimigas e aceita habilidade aliada e combate', () => {
    const fixture = createCombatFixture({ attackerAttack: 10, targetDefense: 100, targetAttack: 0 });
    fixture.target.definitionId = 'card_065';
    CardRules.install(fixture.engine);
    applyAbilityEffect(fixture.engine, fixture.attacker, {
        kind: GameEngine.EFFECT_KINDS.APPLY_CARD_DAMAGE,
        targetId: fixture.target.instanceId,
        amount: 10
    });
    assert.equal(fixture.target.damage, 0);

    const allySource = addFieldCreature(fixture.state, 'p2', 'ally_source', 'iron_ally_source');
    applyAbilityEffect(fixture.engine, allySource, {
        kind: GameEngine.EFFECT_KINDS.APPLY_CARD_DAMAGE,
        targetId: fixture.target.instanceId,
        amount: 10
    });
    assert.equal(fixture.target.damage, 10);

    fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        targetId: fixture.target.instanceId
    });
    assert.equal(fixture.target.damage, 20);
});

test('Golem bloqueia apenas dano de habilidade de criatura inimiga', () => {
    const fixture = createCombatFixture({ attackerAttack: 10, targetDefense: 100, targetAttack: 10 });
    fixture.target.definitionId = 'card_073';
    CardRules.install(fixture.engine);
    applyAbilityEffect(fixture.engine, fixture.attacker, {
        kind: GameEngine.EFFECT_KINDS.APPLY_CARD_DAMAGE,
        targetId: fixture.target.instanceId,
        amount: 10
    });
    assert.equal(fixture.target.damage, 0);

    applyAbilityEffect(fixture.engine, fixture.attacker, {
        kind: GameEngine.EFFECT_KINDS.ADD_MODIFIER,
        targetId: fixture.target.instanceId,
        modifier: {
            id: 'golem_debuff', sourceId: fixture.attacker.instanceId,
            stat: 'attack', operation: GameEngine.MODIFIER_OPERATIONS.ADD, value: -5
        }
    });
    assert.equal(fixture.engine.getEffectiveStat(fixture.target.instanceId, 'attack'), 5);

    fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        targetId: fixture.target.instanceId
    });
    assert.equal(fixture.target.damage, 10);
});

function createSolarBarrierFixture(sourceAttack = 30) {
    const state = GameStateModel.createInitialGameState();
    const engine = GameEngine.createEngine(state);
    CardRules.install(engine);
    const sentinel = addFieldCreature(state, 'p2', 'card_086', 'solar_sentinel', {
        attack: 59,
        defense: 59
    });
    const source = addFieldCreature(state, 'p1', 'solar_source', 'solar_attacker', {
        attack: sourceAttack,
        defense: 100
    });
    state.currentPhase = 'combat';
    engine.emit(GameEngine.EVENT_TYPES.CREATURE_SUMMONED, {
        cardId: sentinel.instanceId,
        playerId: 'p2',
        definitionId: sentinel.definitionId
    });
    return { state, engine, sentinel, source };
}

test('Sentinela bloqueia dano de fonte ATK até 30 contra si e seu controlador', () => {
    const fixture = createSolarBarrierFixture(30);
    const physical = fixture.engine.resolveCombat({
        attackerId: fixture.source.instanceId,
        targetId: fixture.sentinel.instanceId
    });
    assert.equal(physical.damageToTarget, 0);
    assert.equal(fixture.sentinel.damage, 0);
    assert.equal(fixture.engine.getAttackCount(fixture.source.instanceId), 1);

    fixture.state.turn++;
    const secondSource = addFieldCreature(
        fixture.state, 'p1', 'solar_source_2', 'solar_attacker_2', { attack: 30 }
    );
    const direct = fixture.engine.resolveCombat({
        attackerId: secondSource.instanceId,
        defenderPlayerId: 'p2',
        isDirect: true,
        allowDirectAttack: true
    });
    assert.equal(direct.directDamage, 0);
    assert.equal(fixture.state.players.p2.pv, 200);
});

test('Sentinela permite ATK acima de 30 e expira no fim do turno adversário', () => {
    const fixture = createSolarBarrierFixture(31);
    assert.equal(fixture.engine.resolveCombat({
        attackerId: fixture.source.instanceId,
        targetId: fixture.sentinel.instanceId
    }).damageToTarget, 31);

    fixture.engine.emit(GameEngine.EVENT_TYPES.TURN_ENDED, {
        playerId: 'p1',
        turnNumber: fixture.state.turn
    });
    assert.equal(fixture.state.effects.some(effect => effect.effectType === 'SOLAR_BARRIER'), false);
});

test('Dino aplica dano por alvo conforme Turtol, Iron, Golem e Sentinela', () => {
    const fixture = createAreaAbilityFixture('card_051');
    fixture.source.data.attack = 35;
    fixture.source.baseStats.attack = 35;
    fixture.source.data.cost = 6;
    fixture.source.baseStats.cost = 6;
    fixture.enemy1.definitionId = 'card_048';
    fixture.enemy2.definitionId = 'card_065';
    const golem = addFieldCreature(fixture.state, 'p2', 'card_073', 'mixed_golem', {
        defense: 50
    });
    const sentinel = addFieldCreature(fixture.state, 'p2', 'card_086', 'mixed_sentinel', {
        attack: 59,
        defense: 59
    });
    fixture.engine.emit(GameEngine.EVENT_TYPES.CREATURE_SUMMONED, {
        cardId: sentinel.instanceId,
        playerId: 'p2',
        definitionId: sentinel.definitionId
    });

    assert.equal(CardRules.activateAbility(fixture.engine, fixture.source.instanceId).status, 'resolved');
    assert.equal(fixture.enemy1.damage, 10);
    assert.equal(fixture.enemy2.damage, 0);
    assert.equal(golem.damage, 0);
    assert.equal(sentinel.damage, 10);
    const preventedEvents = fixture.state.eventLog
        .filter(event => event.type === GameEngine.EVENT_TYPES.EFFECT_PREVENTED);
    assert.equal(preventedEvents.length, 2);
});

test('proveniência forjada não atravessa Sentinela Solar', () => {
    const fixture = createSolarBarrierFixture(30);
    const result = fixture.engine.resolveAction({
        type: 'FORGED_SENTINEL_DAMAGE',
        actorId: 'p1',
        sourceId: fixture.source.instanceId,
        effects: [{
            kind: GameEngine.EFFECT_KINDS.APPLY_CARD_DAMAGE,
            targetId: fixture.sentinel.instanceId,
            amount: 10,
            provenance: {
                kind: 'combat',
                sourceId: fixture.sentinel.instanceId,
                sourceAttack: 99
            }
        }]
    });

    assert.equal(result.status, 'resolved');
    assert.equal(fixture.sentinel.damage, 0);
    const prevented = fixture.state.eventLog.find(event =>
        event.type === GameEngine.EVENT_TYPES.EFFECT_PREVENTED
    );
    assert.equal(prevented.payload.provenance.kind, 'ability');
    assert.equal(prevented.payload.provenance.sourceId, fixture.source.instanceId);
    assert.equal(prevented.payload.provenance.sourceAttack, 30);
});

test('kind e sourceId forjados não atravessam Turtol', () => {
    const fixture = createCombatFixture();
    fixture.target.definitionId = 'card_048';
    fixture.attacker.data.cost = 3;
    const highCost = addFieldCreature(fixture.state, 'p1', 'high', 'forged_high', { cost: 12 });
    CardRules.install(fixture.engine);
    const result = fixture.engine.resolveAction({
        type: 'FORGED_TURTOL_EFFECT',
        actorId: 'p1',
        sourceId: fixture.attacker.instanceId,
        effects: [{
            kind: GameEngine.EFFECT_KINDS.ADD_MODIFIER,
            targetId: fixture.target.instanceId,
            modifier: {
                id: 'forged_turtol_debuff',
                sourceId: highCost.instanceId,
                stat: 'attack',
                operation: GameEngine.MODIFIER_OPERATIONS.ADD,
                value: -5
            },
            provenance: { kind: 'combat', sourceId: highCost.instanceId }
        }]
    });

    assert.equal(result.status, 'resolved');
    assert.equal(fixture.target.modifiers.length, 0);
});

test('controller forjado não atravessa Iron Dragon', () => {
    const fixture = createCombatFixture();
    fixture.target.definitionId = 'card_065';
    CardRules.install(fixture.engine);
    const result = fixture.engine.resolveAction({
        type: 'FORGED_IRON_EFFECT',
        actorId: 'p1',
        sourceId: fixture.attacker.instanceId,
        effects: [{
            kind: GameEngine.EFFECT_KINDS.APPLY_CARD_DAMAGE,
            targetId: fixture.target.instanceId,
            amount: 10,
            provenance: {
                kind: 'ability',
                sourceId: fixture.attacker.instanceId,
                sourceControllerId: 'p2'
            }
        }]
    });

    assert.equal(result.status, 'resolved');
    assert.equal(fixture.target.damage, 0);
});

function attachTraitEquipment(fixture, definitionId, ownerId = 'p1') {
    const equipment = GameStateModel.createCardInstance({
        id: definitionId,
        name: definitionId,
        type: 'suporte',
        cost: 2,
        attack: 99,
        defense: 99
    }, ownerId, { instanceId: `${definitionId}_trait_equipment` });
    GameStateModel.registerCard(fixture.state, equipment, 'equipment', ownerId);
    equipment.attachedTo = fixture.attacker.instanceId;
    fixture.attacker.attachments.push(equipment.instanceId);
    return equipment;
}

test('Manto Solar causa 15 somente a atacante Vampiro ou Lobisomem', () => {
    const vampire = createCombatFixture({ attackerAttack: 20, attackerDefense: 50, targetDefense: 100 });
    vampire.attacker.definitionId = 'card_076';
    const mantle = GameStateModel.createCardInstance({
        id: 'card_095', name: 'Manto', type: 'suporte', cost: 2, attack: 0, defense: 8
    }, 'p2', { instanceId: 'solar_mantle' });
    GameStateModel.registerCard(vampire.state, mantle, 'equipment', 'p2');
    mantle.attachedTo = vampire.target.instanceId;
    vampire.target.attachments.push(mantle.instanceId);
    CardRules.install(vampire.engine);
    vampire.engine.resolveCombat({
        attackerId: vampire.attacker.instanceId,
        targetId: vampire.target.instanceId
    });
    assert.equal(vampire.attacker.damage, 23);

    const normal = createCombatFixture({ attackerAttack: 20, attackerDefense: 50, targetDefense: 100 });
    const normalMantle = GameStateModel.createCardInstance(mantle.data, 'p2', {
        instanceId: 'normal_solar_mantle'
    });
    GameStateModel.registerCard(normal.state, normalMantle, 'equipment', 'p2');
    normalMantle.attachedTo = normal.target.instanceId;
    normal.target.attachments.push(normalMantle.instanceId);
    CardRules.install(normal.engine);
    normal.engine.resolveCombat({
        attackerId: normal.attacker.instanceId,
        targetId: normal.target.instanceId
    });
    assert.equal(normal.attacker.damage, normal.target.data.attack);
});

test('dano de suporte atravessa Golem e é bloqueado por Iron inimigo', () => {
    for (const [definitionId, expectedDamage] of [['card_073', 15], ['card_065', 0]]) {
        const fixture = createCombatFixture();
        fixture.target.definitionId = definitionId;
        const support = GameStateModel.createCardInstance({
            id: 'card_095', name: 'Manto', type: 'suporte', cost: 2, attack: 0, defense: 0
        }, 'p1', { instanceId: `support_source_${definitionId}` });
        GameStateModel.registerCard(fixture.state, support, 'equipment', 'p1');
        CardRules.install(fixture.engine);
        applyAbilityEffect(fixture.engine, support, {
            kind: GameEngine.EFFECT_KINDS.APPLY_CARD_DAMAGE,
            targetId: fixture.target.instanceId,
            amount: 15
        });
        assert.equal(fixture.target.damage, expectedDamage);
    }
});

test('Manto do mesmo controlador do Iron Dragon não é bloqueado', () => {
    const fixture = createCombatFixture();
    fixture.target.definitionId = 'card_065';
    const sameControllerMantle = GameStateModel.createCardInstance({
        id: 'card_095', name: 'Manto', type: 'suporte', cost: 2, attack: 0, defense: 0
    }, 'p2', { instanceId: 'same_controller_mantle' });
    GameStateModel.registerCard(fixture.state, sameControllerMantle, 'equipment', 'p2');
    CardRules.install(fixture.engine);
    applyAbilityEffect(fixture.engine, sameControllerMantle, {
        kind: GameEngine.EFFECT_KINDS.APPLY_CARD_DAMAGE,
        targetId: fixture.target.instanceId,
        amount: 15
    });
    assert.equal(fixture.target.damage, 15);
});

test('Estaca concede +10 apenas em host elegível contra Vampiro/Lobisomem', () => {
    const fixture = createCombatFixture({ attackerAttack: 20, targetDefense: 100, targetAttack: 0 });
    fixture.attacker.definitionId = 'card_056';
    fixture.target.definitionId = 'card_076';
    const stake = attachTraitEquipment(fixture, 'card_102');
    assert.equal(CardRules.validateEquipmentTarget(stake, fixture.attacker).valid, true);

    const ineligibleHost = addFieldCreature(fixture.state, 'p1', 'ineligible_host', 'ineligible_stake_host');
    const stakeForIneligible = GameStateModel.createCardInstance({
        id: 'card_102', name: 'card_102', type: 'suporte', cost: 2, attack: 99, defense: 99
    }, 'p1', { instanceId: 'stake_ineligible_equipment' });
    assert.equal(CardRules.validateEquipmentTarget(stakeForIneligible, ineligibleHost).valid, false);

    CardRules.install(fixture.engine);
    const result = fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        targetId: fixture.target.instanceId
    });
    assert.equal(result.attackPower, 30);
    assert.equal(result.damageToTarget, 30);

    fixture.engine.resolveAction({
        type: 'REMOVE_STAKE', actorId: 'p1', sourceId: stake.instanceId,
        effects: [{
            kind: GameEngine.EFFECT_KINDS.MOVE_CARD,
            instanceId: stake.instanceId,
            destinationZone: 'discard',
            destinationPlayerId: 'p1'
        }]
    });
    fixture.state.turn++;
    assert.equal(fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        targetId: fixture.target.instanceId
    }).damageToTarget, 20);
});

test('Estaca não concede bônus contra alvo sem trait Vampiro/Lobisomem', () => {
    const fixture = createCombatFixture({ attackerAttack: 20, targetDefense: 100, targetAttack: 0 });
    fixture.attacker.definitionId = 'card_056';
    attachTraitEquipment(fixture, 'card_102');
    CardRules.install(fixture.engine);
    const result = fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        targetId: fixture.target.instanceId
    });
    assert.equal(result.attackPower, 20);
    assert.equal(result.damageToTarget, 20);
});

test('Manoplas adiciona 15 dano somente contra fogo sem alterar ATK', () => {
    const fire = createCombatFixture({ attackerAttack: 20, targetDefense: 100, targetAttack: 0 });
    fire.target.definitionId = 'card_057';
    attachTraitEquipment(fire, 'card_105');
    CardRules.install(fire.engine);
    const fireResult = fire.engine.resolveCombat({
        attackerId: fire.attacker.instanceId,
        targetId: fire.target.instanceId
    });
    assert.equal(fireResult.attackPower, 20);
    assert.equal(fireResult.damageToTarget, 35);

    const normal = createCombatFixture({ attackerAttack: 20, targetDefense: 100, targetAttack: 0 });
    attachTraitEquipment(normal, 'card_105');
    CardRules.install(normal.engine);
    assert.equal(normal.engine.resolveCombat({
        attackerId: normal.attacker.instanceId,
        targetId: normal.target.instanceId
    }).damageToTarget, 20);
});

test('Flecha de Prata equipa somente em host humanoide ou besta', () => {
    const state = GameStateModel.createInitialGameState();
    const humanoid = GameStateModel.createCardInstance({
        id: 'card_056', name: 'Humanoide', type: 'criatura', cost: 2, attack: 10, defense: 10
    }, 'p1', { instanceId: 'arrow_humanoid_host' });
    const nonHumanoid = GameStateModel.createCardInstance({
        id: 'normal_host', name: 'Normal', type: 'criatura', cost: 2, attack: 10, defense: 10
    }, 'p1', { instanceId: 'arrow_normal_host' });
    GameStateModel.registerCard(state, humanoid, 'field', 'p1');
    GameStateModel.registerCard(state, nonHumanoid, 'field', 'p1');
    const arrow = GameStateModel.createCardInstance({
        id: 'card_097', name: 'Flecha', type: 'suporte', cost: 3, attack: 8, defense: 0
    }, 'p1', { instanceId: 'arrow_equipment' });

    assert.equal(CardRules.validateEquipmentTarget(arrow, humanoid).valid, true);
    assert.equal(CardRules.validateEquipmentTarget(arrow, nonHumanoid).valid, false);
});

test('Flecha de Prata concede +8 de ataque ao ser equipada no Paladino Crepuscular', () => {
    const state = GameStateModel.createInitialGameState();
    const engine = GameEngine.createEngine(state);
    CardRules.install(engine);

    const paladin = GameStateModel.createCardInstance({
        id: 'card_068', name: 'Paladino Crepuscular', type: 'criatura', cost: 7, attack: 33, defense: 39
    }, 'p1', { instanceId: 'paladin_host' });
    const arrow = GameStateModel.createCardInstance({
        id: 'card_097', name: 'Flecha de Prata', type: 'suporte', cost: 3, attack: 8, defense: 0
    }, 'p1', { instanceId: 'silver_arrow' });

    GameStateModel.registerCard(state, paladin, 'field', 'p1');
    GameStateModel.registerCard(state, arrow, 'hand', 'p1');

    const result = engine.resolveAction({
        type: 'EQUIP_CARD',
        actorId: 'p1',
        sourceId: arrow.instanceId,
        sourceZone: 'hand',
        requiresControl: false,
        effects: [
            {
                kind: GameEngine.EFFECT_KINDS.MOVE_CARD,
                instanceId: arrow.instanceId,
                destinationZone: 'equipment',
                destinationPlayerId: 'p1'
            },
            {
                kind: GameEngine.EFFECT_KINDS.ATTACH_CARD,
                equipmentId: arrow.instanceId,
                targetId: paladin.instanceId
            },
            ...CardRules.createEquipmentEffects(arrow, paladin.instanceId, state)
        ]
    });

    assert.equal(result.status, 'resolved');
    assert.equal(engine.getEffectiveStat(paladin.instanceId, 'attack'), 41);
    assert.equal(engine.getEffectiveStat(paladin.instanceId, 'defense'), 39);
});

test('Flecha de Prata ignora todas as restrições de alvo migradas', () => {
    const { state, attacker, target } = createCombatFixture();
    const arrow = GameStateModel.createCardInstance({
        id: 'card_097', name: 'Flecha', type: 'suporte', cost: 3, attack: 8, defense: 0
    }, 'p1', { instanceId: 'silver_arrow' });
    GameStateModel.registerCard(state, arrow, 'equipment', 'p1');
    arrow.attachedTo = attacker.instanceId;
    attacker.attachments.push(arrow.instanceId);

    attacker.data.cost = 5;
    target.definitionId = 'card_014';
    assert.equal(CardRules.validateAttackTarget(state, attacker.instanceId, target.instanceId).valid, true);

    target.definitionId = 'card_044';
    assert.equal(CardRules.validateAttackTarget(state, attacker.instanceId, target.instanceId).valid, true);

    target.definitionId = 'card_025';
    const ally = GameStateModel.createCardInstance(target.data, 'p2', { instanceId: 'ze_protected_ally' });
    GameStateModel.registerCard(state, ally, 'field', 'p2');
    assert.equal(CardRules.validateAttackTarget(state, attacker.instanceId, target.instanceId).valid, true);
    GameStateModel.moveCard(state, ally.instanceId, 'discard', 'p2');

    target.definitionId = 'card_058';
    attacker.data.cost = 3;
    assert.equal(CardRules.validateAttackTarget(state, attacker.instanceId, target.instanceId).valid, true);

    target.definitionId = 'card_059';
    assert.equal(CardRules.validateAttackTarget(state, attacker.instanceId, target.instanceId).valid, true);

    target.definitionId = 'normal_target';
    const cp2 = GameStateModel.createCardInstance({
        id: 'card_018', name: 'CP-2', type: 'criatura', cost: 3, attack: 12, defense: 23
    }, 'p2', { instanceId: 'cp2_bypass' });
    GameStateModel.registerCard(state, cp2, 'field', 'p2');
    assert.equal(CardRules.validateAttackTarget(state, attacker.instanceId, target.instanceId).valid, true);
    GameStateModel.moveCard(state, cp2.instanceId, 'discard', 'p2');

    const tranca = GameStateModel.createCardInstance({
        id: 'card_060', name: 'Tranca Rua', type: 'criatura', cost: 6, attack: 30, defense: 30
    }, 'p2', { instanceId: 'tranca_bypass' });
    GameStateModel.registerCard(state, tranca, 'field', 'p2');
    assert.equal(CardRules.validateAttackTarget(state, attacker.instanceId, target.instanceId).valid, true);
});

test('Flecha de Prata ignora Estrela Mágica e o Intocável do Cajado da Ilusão', () => {
    const fixture = createCombatFixture({ attackerAttack: 20, targetDefense: 100 });
    CardRules.install(fixture.engine);
    const star = GameStateModel.createCardInstance({
        id: 'card_002', name: 'Estrela', type: 'suporte', cost: 1, attack: 0, defense: 0
    }, 'p2', { instanceId: 'flecha_star_shield' });
    GameStateModel.registerCard(fixture.state, star, 'equipment', 'p2');
    star.attachedTo = fixture.target.instanceId;
    fixture.target.attachments.push(star.instanceId);
    fixture.engine.resolveAction({
        type: 'ADD_SHIELD', actorId: 'p2', sourceId: star.instanceId, requiresControl: false,
        effects: CardRules.createEquipmentEffects(star, fixture.target.instanceId, fixture.state)
    });
    const staff = GameStateModel.createCardInstance({
        id: 'card_092', name: 'Cajado', type: 'suporte', cost: 2, attack: 5, defense: 5
    }, 'p2', { instanceId: 'flecha_staff' });
    GameStateModel.registerCard(fixture.state, staff, 'equipment', 'p2');
    staff.attachedTo = fixture.target.instanceId;
    fixture.target.attachments.push(staff.instanceId);
    fixture.engine.resolveAction({
        type: 'ADD_UNTOUCHABLE', actorId: 'p2', sourceId: staff.instanceId, requiresControl: false,
        effects: [{
            kind: GameEngine.EFFECT_KINDS.ADD_EFFECT,
            effect: {
                id: `${staff.instanceId}:untouchable_shield:manual`,
                effectType: 'UNTOUCHABLE_SHIELD',
                sourceId: staff.instanceId,
                targetId: fixture.target.instanceId,
                duration: { kind: GameEngine.DURATION_KINDS.UNTIL_SOURCE_LEAVES, sourceId: staff.instanceId }
            }
        }]
    });
    attachTraitEquipment(fixture, 'card_097');

    const result = fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        targetId: fixture.target.instanceId
    });

    assert.equal(result.status, 'resolved');
    assert.equal(result.cancelled, false);
    assert.equal(fixture.target.damage, 20);
});

test('Olho de Águia ignora somente Evasão e Intocável, não outras restrições', () => {
    const { state, attacker, target } = createCombatFixture();
    const eye = GameStateModel.createCardInstance({
        id: 'card_101', name: 'Olho', type: 'suporte', cost: 3, attack: 3, defense: 3
    }, 'p1', { instanceId: 'eagle_eye' });
    GameStateModel.registerCard(state, eye, 'equipment', 'p1');
    eye.attachedTo = attacker.instanceId;
    attacker.attachments.push(eye.instanceId);

    attacker.data.cost = 5;
    target.definitionId = 'card_014';
    assert.equal(CardRules.validateAttackTarget(state, attacker.instanceId, target.instanceId).valid, false);

    attacker.data.cost = 3;
    target.definitionId = 'card_044';
    assert.equal(CardRules.validateAttackTarget(state, attacker.instanceId, target.instanceId).valid, false);

    target.definitionId = 'card_025';
    const ally = GameStateModel.createCardInstance(target.data, 'p2', { instanceId: 'eye_ze_ally' });
    GameStateModel.registerCard(state, ally, 'field', 'p2');
    assert.equal(CardRules.validateAttackTarget(state, attacker.instanceId, target.instanceId).valid, false);
    GameStateModel.moveCard(state, ally.instanceId, 'discard', 'p2');

    target.definitionId = 'card_059';
    assert.equal(CardRules.validateAttackTarget(state, attacker.instanceId, target.instanceId).valid, false);

    target.definitionId = 'normal_target';
    const cp2 = GameStateModel.createCardInstance({
        id: 'card_018', name: 'CP-2', type: 'criatura', cost: 3, attack: 12, defense: 23
    }, 'p2', { instanceId: 'eye_cp2' });
    GameStateModel.registerCard(state, cp2, 'field', 'p2');
    assert.equal(CardRules.validateAttackTarget(state, attacker.instanceId, target.instanceId).valid, false);
    GameStateModel.moveCard(state, cp2.instanceId, 'discard', 'p2');

    const tranca = GameStateModel.createCardInstance({
        id: 'card_060', name: 'Tranca Rua', type: 'criatura', cost: 6, attack: 30, defense: 30
    }, 'p2', { instanceId: 'eye_tranca' });
    GameStateModel.registerCard(state, tranca, 'field', 'p2');
    assert.equal(CardRules.validateAttackTarget(state, attacker.instanceId, target.instanceId).valid, false);
    GameStateModel.moveCard(state, tranca.instanceId, 'discard', 'p2');

    target.definitionId = 'card_058';
    assert.equal(CardRules.validateAttackTarget(state, attacker.instanceId, target.instanceId).valid, true);
});

test('Olho de Águia ignora o Intocável do Cajado mas não a Estrela Mágica', () => {
    const fixture = createCombatFixture({ attackerAttack: 20, targetDefense: 100 });
    CardRules.install(fixture.engine);
    const star = GameStateModel.createCardInstance({
        id: 'card_002', name: 'Estrela', type: 'suporte', cost: 1, attack: 0, defense: 0
    }, 'p2', { instanceId: 'eye_star_shield' });
    GameStateModel.registerCard(fixture.state, star, 'equipment', 'p2');
    star.attachedTo = fixture.target.instanceId;
    fixture.target.attachments.push(star.instanceId);
    fixture.engine.resolveAction({
        type: 'ADD_SHIELD', actorId: 'p2', sourceId: star.instanceId, requiresControl: false,
        effects: CardRules.createEquipmentEffects(star, fixture.target.instanceId, fixture.state)
    });
    attachTraitEquipment(fixture, 'card_101');

    const result = fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        targetId: fixture.target.instanceId
    });

    assert.equal(result.cancelled, true);
    assert.equal(fixture.target.damage, 0);
});

test('Olho de Águia consegue atacar hospedeiro protegido pelo Intocável do Cajado', () => {
    const fixture = createCombatFixture({ attackerAttack: 20, targetDefense: 100 });
    CardRules.install(fixture.engine);
    const staff = GameStateModel.createCardInstance({
        id: 'card_092', name: 'Cajado', type: 'suporte', cost: 2, attack: 5, defense: 5
    }, 'p2', { instanceId: 'eye_staff' });
    GameStateModel.registerCard(fixture.state, staff, 'equipment', 'p2');
    staff.attachedTo = fixture.target.instanceId;
    fixture.target.attachments.push(staff.instanceId);
    fixture.engine.resolveAction({
        type: 'ADD_UNTOUCHABLE', actorId: 'p2', sourceId: staff.instanceId, requiresControl: false,
        effects: [{
            kind: GameEngine.EFFECT_KINDS.ADD_EFFECT,
            effect: {
                id: `${staff.instanceId}:untouchable_shield:manual`,
                effectType: 'UNTOUCHABLE_SHIELD',
                sourceId: staff.instanceId,
                targetId: fixture.target.instanceId,
                duration: { kind: GameEngine.DURATION_KINDS.UNTIL_SOURCE_LEAVES, sourceId: staff.instanceId }
            }
        }]
    });
    attachTraitEquipment(fixture, 'card_101');

    const result = fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        targetId: fixture.target.instanceId
    });

    assert.equal(result.cancelled, false);
    assert.equal(fixture.target.damage, 20);
});

test('Cajado da Ilusão equipa somente host mágico, ativa 1x/turno e cancela o próximo ataque', () => {
    const fixture = createCombatFixture({ attackerAttack: 20, targetDefense: 100 });
    CardRules.install(fixture.engine);
    const staff = GameStateModel.createCardInstance({
        id: 'card_092', name: 'Cajado', type: 'suporte', cost: 2, attack: 5, defense: 5
    }, 'p2', { instanceId: 'illusion_staff' });
    GameStateModel.registerCard(fixture.state, staff, 'equipment', 'p2');
    staff.attachedTo = fixture.target.instanceId;
    fixture.target.attachments.push(staff.instanceId);
    fixture.target.definitionId = 'card_055';

    assert.equal(CardRules.validateEquipmentTarget(staff, fixture.target).valid, true);
    const ineligibleHost = addFieldCreature(fixture.state, 'p2', 'ineligible_magic_host', 'ineligible_magic_host_id');
    assert.equal(CardRules.validateEquipmentTarget(staff, ineligibleHost).valid, false);

    fixture.state.currentPlayer = 'p2';
    fixture.state.currentPhase = 'invocation';
    const activation = CardRules.activateAbility(fixture.engine, staff.instanceId);
    assert.equal(activation.status, 'resolved');
    assert.equal(
        fixture.state.effects.some(effect =>
            effect.effectType === 'UNTOUCHABLE_SHIELD' && effect.targetId === fixture.target.instanceId
        ),
        true
    );

    const secondActivation = CardRules.activateAbility(fixture.engine, staff.instanceId);
    assert.equal(secondActivation.status, 'rejected');

    fixture.state.currentPlayer = 'p1';
    fixture.state.currentPhase = 'combat';
    const attack = fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        targetId: fixture.target.instanceId
    });
    assert.equal(attack.cancelled, true);
    assert.equal(fixture.target.damage, 0);
    assert.equal(
        fixture.state.effects.some(effect => effect.effectType === 'UNTOUCHABLE_SHIELD'),
        false
    );

    fixture.state.turn++;
    fixture.state.currentPlayer = 'p2';
    fixture.state.currentPhase = 'invocation';
    const reactivation = CardRules.activateAbility(fixture.engine, staff.instanceId);
    assert.equal(reactivation.status, 'resolved');
});

test('Gárgula de Rocha bloqueia atacantes de custo menor que 5 e troca ATK/DEF ao ativar', () => {
    const fixture = createCombatFixture({
        attackerAttack: 20,
        attackerDefense: 10,
        targetAttack: 12,
        targetDefense: 45
    });
    fixture.target.definitionId = 'card_053';
    fixture.attacker.data.cost = 4;
    CardRules.install(fixture.engine);

    assert.equal(
        CardRules.validateAttackTarget(fixture.state, fixture.attacker.instanceId, fixture.target.instanceId).valid,
        false
    );
    fixture.attacker.data.cost = 5;
    assert.equal(
        CardRules.validateAttackTarget(fixture.state, fixture.attacker.instanceId, fixture.target.instanceId).valid,
        true
    );

    fixture.state.currentPlayer = 'p2';
    const activation = CardRules.activateAbility(fixture.engine, fixture.target.instanceId);
    assert.equal(activation.status, 'resolved');
    assert.equal(fixture.engine.getEffectiveStat(fixture.target.instanceId, 'attack'), 45);
    assert.equal(fixture.engine.getEffectiveStat(fixture.target.instanceId, 'defense'), 12);
    assert.equal(CardRules.activateAbility(fixture.engine, fixture.target.instanceId).status, 'rejected');
});

test('Gigante da Marreta causa 10 a todos os inimigos e não atinge aliados', () => {
    const fixture = createAreaAbilityFixture('card_072');
    const result = CardRules.activateAbility(fixture.engine, fixture.source.instanceId);

    assert.equal(result.status, 'resolved');
    assert.equal(fixture.ally.damage, 0);
    assert.equal(fixture.enemy1.damage, 10);
    assert.equal(fixture.enemy2.damage, 10);
    assert.equal(CardRules.activateAbility(fixture.engine, fixture.source.instanceId).status, 'rejected');
});

test('Latex causa metade do ATK efetivo a todos os inimigos sem atingir aliados', () => {
    const fixture = createAreaAbilityFixture('card_081');
    const result = CardRules.activateAbility(fixture.engine, fixture.source.instanceId);

    assert.equal(result.status, 'resolved');
    assert.equal(fixture.ally.damage, 0);
    assert.equal(fixture.enemy1.damage, 15);
    assert.equal(fixture.enemy2.damage, 15);
});

test('Hidra das Profundezas causa 20 adicionais a todas as outras criaturas ao atacar', () => {
    const state = GameStateModel.createInitialGameState();
    const engine = GameEngine.createEngine(state);
    CardRules.install(engine);
    const hidra = addFieldCreature(state, 'p1', 'card_083', 'hidra_source', { attack: 40, defense: 40 });
    const ally = addFieldCreature(state, 'p1', 'ally', 'hidra_ally', { defense: 30 });
    const target = addFieldCreature(state, 'p2', 'target', 'hidra_target', { attack: 0, defense: 100 });
    const otherEnemy = addFieldCreature(state, 'p2', 'other_enemy', 'hidra_other_enemy', { defense: 30 });
    state.currentPhase = 'combat';

    const result = engine.resolveCombat({ attackerId: hidra.instanceId, targetId: target.instanceId });

    assert.equal(result.status, 'resolved');
    assert.equal(hidra.damage, 0);
    assert.equal(ally.damage, 20);
    assert.equal(otherEnemy.damage, 20);
    assert.equal(target.damage, 60);
});

test('Superior ataca duas vezes e recupera a criatura mais recente do cemitério ao derrotar', () => {
    const fixture = createCombatFixture({ attackerAttack: 25, targetDefense: 10, targetAttack: 0 });
    fixture.attacker.definitionId = 'card_087';
    CardRules.install(fixture.engine);
    emitSummoned(fixture.engine, fixture.attacker);

    const buried1 = addFieldCreature(fixture.state, 'p1', 'buried_1', 'superior_buried_1');
    GameStateModel.moveCard(fixture.state, buried1.instanceId, 'discard', 'p1');
    const buried2 = addFieldCreature(fixture.state, 'p1', 'buried_2', 'superior_buried_2');
    GameStateModel.moveCard(fixture.state, buried2.instanceId, 'discard', 'p1');

    const first = fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        targetId: fixture.target.instanceId
    });
    assert.equal(first.targetDestroyed, true);
    assert.equal(buried2.zone, 'hand');
    assert.equal(buried1.zone, 'discard');
    assert.equal(fixture.engine.canAttack(fixture.attacker.instanceId).canAttack, true);
});

test('Pena do Gigante bloqueia um ataque mesmo com Flecha de Prata equipada no atacante', () => {
    const fixture = createCombatFixture({ attackerAttack: 20, targetDefense: 100 });
    CardRules.install(fixture.engine);
    const feather = GameStateModel.createCardInstance({
        id: 'card_094', name: 'Pena', type: 'suporte', cost: 2, attack: 0, defense: 10
    }, 'p2', { instanceId: 'giant_feather' });
    GameStateModel.registerCard(fixture.state, feather, 'equipment', 'p2');
    feather.attachedTo = fixture.target.instanceId;
    fixture.target.attachments.push(feather.instanceId);
    fixture.engine.resolveAction({
        type: 'ADD_FEATHER_SHIELD', actorId: 'p2', sourceId: feather.instanceId, requiresControl: false,
        effects: CardRules.createEquipmentEffects(feather, fixture.target.instanceId, fixture.state)
    });
    attachTraitEquipment(fixture, 'card_097');

    const result = fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        targetId: fixture.target.instanceId
    });

    assert.equal(result.cancelled, true);
    assert.equal(fixture.target.damage, 0);
});

test('Paladino Alvorada anula a habilidade do inimigo escolhido até o fim do turno dele', () => {
    const fixture = createAreaAbilityFixture('card_051');
    const paladino = addFieldCreature(fixture.state, 'p2', 'card_067', 'paladino_source', {
        attack: 37,
        defense: 28
    });

    fixture.state.currentPlayer = 'p2';
    const activation = CardRules.activateAbility(fixture.engine, paladino.instanceId, [
        fixture.source.instanceId
    ]);
    assert.equal(activation.status, 'resolved');
    assert.equal(
        CardRules.activateAbility(fixture.engine, paladino.instanceId, [fixture.source.instanceId]).status,
        'rejected'
    );

    fixture.state.currentPlayer = 'p1';
    const dinoResult = CardRules.activateAbility(fixture.engine, fixture.source.instanceId);
    assert.equal(dinoResult.status, 'resolved');
    assert.equal(fixture.enemy1.damage, 0);
    assert.equal(fixture.enemy2.damage, 0);
});

test('Lâmina Sagrada equipa somente Elite/Paladino e ignora a habilidade de um Vampiro/Lobisomem', () => {
    const fixture = createCombatFixture({ attackerAttack: 20, targetDefense: 100 });
    CardRules.install(fixture.engine);
    fixture.attacker.definitionId = 'card_067';
    const blade = GameStateModel.createCardInstance({
        id: 'card_107', name: 'Lâmina', type: 'suporte', cost: 4, attack: 5, defense: 5
    }, 'p1', { instanceId: 'sacred_blade' });
    GameStateModel.registerCard(fixture.state, blade, 'equipment', 'p1');
    blade.attachedTo = fixture.attacker.instanceId;
    fixture.attacker.attachments.push(blade.instanceId);

    assert.equal(CardRules.validateEquipmentTarget(blade, fixture.attacker).valid, true);
    const nonEliteHost = addFieldCreature(fixture.state, 'p1', 'plain', 'plain_host');
    assert.equal(CardRules.validateEquipmentTarget(blade, nonEliteHost).valid, false);

    fixture.target.definitionId = 'card_079';
    addFieldCreature(fixture.state, 'p2', 'plain_enemy', 'plain_enemy_id');
    assert.deepEqual(
        CardRules.getActivatedTargets(fixture.state, blade.instanceId),
        [fixture.target.instanceId]
    );

    const activation = CardRules.activateAbility(fixture.engine, blade.instanceId, [fixture.target.instanceId]);
    assert.equal(activation.status, 'resolved');
    assert.equal(
        fixture.state.effects.some(effect =>
            effect.effectType === 'ABILITY_NULLIFIED' && effect.targetId === fixture.target.instanceId
        ),
        true
    );
});

function createHandAbilityFixture(definitionId, options = {}) {
    const state = GameStateModel.createInitialGameState();
    const engine = GameEngine.createEngine(state);
    CardRules.install(engine);
    const source = GameStateModel.createCardInstance({
        id: definitionId,
        name: definitionId,
        type: options.type || 'suporte',
        cost: options.cost ?? 1,
        attack: options.attack ?? 0,
        defense: options.defense ?? 0
    }, 'p1', { instanceId: `${definitionId}_hand_source` });
    GameStateModel.registerCard(state, source, 'hand', 'p1');
    state.currentPhase = 'invocation';
    return { state, engine, source };
}

function installEquipmentByRule(fixture, definitionId, hostId, ownerId = 'p1') {
    const equipment = GameStateModel.createCardInstance({
        id: definitionId,
        name: definitionId,
        type: 'suporte',
        cost: 1,
        attack: 0,
        defense: 0
    }, ownerId, { instanceId: `${definitionId}_equip_on_${hostId}` });
    GameStateModel.registerCard(fixture.state, equipment, 'equipment', ownerId);
    equipment.attachedTo = hostId;
    fixture.state.cardInstances[hostId].attachments.push(equipment.instanceId);
    const result = fixture.engine.resolveAction({
        type: 'EQUIP_RULE_TEST',
        actorId: ownerId,
        sourceId: equipment.instanceId,
        effects: CardRules.createEquipmentEffects(equipment, hostId, fixture.state)
    });
    assert.equal(result.status, 'resolved');
    return equipment;
}

test('ETC remove monstros inimigos de custo abaixo de 3 para a mão', () => {
    const fixture = createSummonRuleFixture('card_003');
    const cheap = addFieldCreature(fixture.state, 'p2', 'cheap_enemy', 'etc_cheap', { cost: 1 });
    const expensive = addFieldCreature(fixture.state, 'p2', 'expensive_enemy', 'etc_expensive', { cost: 5 });
    emitSummoned(fixture.engine, fixture.source);
    assert.equal(cheap.zone, 'hand');
    assert.equal(expensive.zone, 'field');
});

test('Shupáku paralisa a primeira criatura inimiga encontrada ao entrar em campo', () => {
    const fixture = createSummonRuleFixture('card_050');
    const enemy = addFieldCreature(fixture.state, 'p2', 'enemy', 'shupaku_enemy');
    emitSummoned(fixture.engine, fixture.source);
    assert.equal(
        fixture.state.effects.some(effect =>
            effect.effectType === 'ATTACK_DISABLED' && effect.targetId === enemy.instanceId
        ),
        true
    );
});

test('Zica do pantano imobiliza e drena 5 de defesa por turno', () => {
    const fixture = createCombatFixture({ targetDefense: 30 });
    CardRules.install(fixture.engine);
    installEquipmentByRule(fixture, 'card_005', fixture.target.instanceId, 'p1');
    assert.equal(
        fixture.state.effects.some(effect =>
            effect.effectType === 'ATTACK_DISABLED' && effect.targetId === fixture.target.instanceId
        ),
        true
    );
    fixture.engine.emit(GameEngine.EVENT_TYPES.TURN_STARTED, { playerId: 'p2', turnNumber: fixture.state.turn });
    assert.equal(fixture.engine.getEffectiveStat(fixture.target.instanceId, 'defense'), 25);
});

test('11 de Setembro reduz stats e imobiliza o alvo por 5 turnos', () => {
    const fixture = createCombatFixture({ targetAttack: 20, targetDefense: 40 });
    installEquipmentByRule(fixture, 'card_015', fixture.target.instanceId, 'p1');
    assert.equal(fixture.engine.getEffectiveStat(fixture.target.instanceId, 'attack'), 10);
    assert.equal(fixture.engine.getEffectiveStat(fixture.target.instanceId, 'defense'), 15);
    assert.equal(
        fixture.state.effects.some(effect =>
            effect.effectType === 'ATTACK_DISABLED' && effect.targetId === fixture.target.instanceId
        ),
        true
    );
});

test('Feitiço de Teletransporte devolve o hospedeiro à mão e se descarta', () => {
    const fixture = createCombatFixture();
    const spell = installEquipmentByRule(fixture, 'card_091', fixture.attacker.instanceId, 'p1');
    const result = CardRules.activateAbility(fixture.engine, spell.instanceId);
    assert.equal(result.status, 'resolved');
    assert.equal(fixture.attacker.zone, 'hand');
    assert.equal(spell.zone, 'discard');
});

test('Medalhão de Cura recupera 15 de defesa do hospedeiro', () => {
    const fixture = createCombatFixture();
    fixture.attacker.damage = 20;
    const medallion = installEquipmentByRule(fixture, 'card_093', fixture.attacker.instanceId, 'p1');
    const result = CardRules.activateAbility(fixture.engine, medallion.instanceId);
    assert.equal(result.status, 'resolved');
    assert.equal(fixture.attacker.damage, 5);
});

test('Tomo de Feitiços Ancestrais compra uma carta extra no início do turno', () => {
    const fixture = createCombatFixture();
    CardRules.install(fixture.engine);
    fixture.attacker.definitionId = 'card_055';
    installEquipmentByRule(fixture, 'card_099', fixture.attacker.instanceId, 'p1');
    const deckCard = GameStateModel.createCardInstance({
        id: 'tomo_deck_card', name: 'Deck', type: 'criatura', cost: 1, attack: 1, defense: 1
    }, 'p1', { instanceId: 'tomo_deck_1' });
    GameStateModel.registerCard(fixture.state, deckCard, 'deck', 'p1');

    fixture.engine.emit(GameEngine.EVENT_TYPES.TURN_STARTED, { playerId: 'p1', turnNumber: fixture.state.turn });
    assert.equal(deckCard.zone, 'hand');
});

test('Escudo de Energia Estável concede 1 de energia a cada dano recebido', () => {
    const fixture = createCombatFixture();
    CardRules.install(fixture.engine);
    fixture.attacker.definitionId = 'card_027';
    installEquipmentByRule(fixture, 'card_106', fixture.attacker.instanceId, 'p1');
    GameStateModel.setPlayerStat(fixture.state, 'energy', 'p1', 3);

    fixture.engine.emit(GameEngine.EVENT_TYPES.DAMAGE_DEALT, {
        sourceId: fixture.target.instanceId,
        damagedId: fixture.attacker.instanceId,
        amount: 5,
        attemptedAmount: 5,
        damageType: 'physical'
    });

    assert.equal(fixture.state.players.p1.energy, 4);
});

test('Adubaram descarta um inimigo, compra uma carta e se descarta', () => {
    const fixture = createHandAbilityFixture('card_006');
    const enemy = addFieldCreature(fixture.state, 'p2', 'enemy', 'adubaram_enemy');
    const deckCard = GameStateModel.createCardInstance({
        id: 'deck_card', name: 'Deck', type: 'criatura', cost: 1, attack: 1, defense: 1
    }, 'p1', { instanceId: 'adubaram_deck_1' });
    GameStateModel.registerCard(fixture.state, deckCard, 'deck', 'p1');

    const result = CardRules.activateAbility(fixture.engine, fixture.source.instanceId, [enemy.instanceId]);
    assert.equal(result.status, 'resolved');
    assert.equal(enemy.zone, 'discard');
    assert.equal(deckCard.zone, 'hand');
    assert.equal(fixture.source.zone, 'discard');
});

test('Camisa 14 alicia um inimigo barato e concede +10 ATK por 2 turnos', () => {
    const fixture = createHandAbilityFixture('card_007');
    const enemy = addFieldCreature(fixture.state, 'p2', 'enemy', 'camisa_enemy', { cost: 2, attack: 5 });

    const result = CardRules.activateAbility(fixture.engine, fixture.source.instanceId, [enemy.instanceId]);
    assert.equal(result.status, 'resolved');
    assert.equal(enemy.controllerId, 'p1');
    assert.equal(fixture.engine.getEffectiveStat(enemy.instanceId, 'attack'), 15);
    assert.equal(fixture.source.zone, 'discard');

    fixture.engine.emit(GameEngine.EVENT_TYPES.TURN_ENDED, { playerId: 'p1', turnNumber: fixture.state.turn });
    fixture.engine.emit(GameEngine.EVENT_TYPES.TURN_ENDED, { playerId: 'p1', turnNumber: fixture.state.turn + 1 });
    assert.equal(fixture.engine.getEffectiveStat(enemy.instanceId, 'attack'), 5);
});

test('Cara de cu estourado paralisa e zera a defesa de um inimigo por 2 turnos', () => {
    const fixture = createHandAbilityFixture('card_008');
    const enemy = addFieldCreature(fixture.state, 'p2', 'enemy', 'cu_estourado_enemy', { defense: 20 });

    const result = CardRules.activateAbility(fixture.engine, fixture.source.instanceId, [enemy.instanceId]);
    assert.equal(result.status, 'resolved');
    assert.equal(fixture.engine.getEffectiveStat(enemy.instanceId, 'defense'), 0);
    assert.equal(
        fixture.state.effects.some(effect =>
            effect.effectType === 'ATTACK_DISABLED' && effect.targetId === enemy.instanceId
        ),
        true
    );
    assert.equal(fixture.source.zone, 'discard');
});

test('Kirb copia a habilidade sem alvo de um aliado de custo baixo', () => {
    const state = GameStateModel.createInitialGameState();
    const engine = GameEngine.createEngine(state);
    CardRules.install(engine);
    const kirb = addFieldCreature(state, 'p1', 'card_011', 'kirb_1', { cost: 3 });
    const gobra = addFieldCreature(state, 'p1', 'card_020', 'gobra_1', { cost: 3 });
    state.currentPhase = 'combat';

    const result = CardRules.activateAbility(engine, kirb.instanceId, [gobra.instanceId]);
    assert.equal(result.status, 'resolved');
    assert.equal(gobra.zone, 'hand');
});

test('Baltz descarta todas as cartas de suporte do oponente', () => {
    const state = GameStateModel.createInitialGameState();
    const engine = GameEngine.createEngine(state);
    CardRules.install(engine);
    const baltz = addFieldCreature(state, 'p1', 'card_016', 'baltz_1', { cost: 3 });
    const support1 = GameStateModel.createCardInstance({
        id: 'support1', name: 'Suporte 1', type: 'suporte', cost: 1, attack: 0, defense: 0
    }, 'p2', { instanceId: 'baltz_support_1' });
    GameStateModel.registerCard(state, support1, 'equipment', 'p2');
    const support2 = GameStateModel.createCardInstance({
        id: 'support2', name: 'Suporte 2', type: 'suporte', cost: 1, attack: 0, defense: 0
    }, 'p2', { instanceId: 'baltz_support_2' });
    GameStateModel.registerCard(state, support2, 'equipment', 'p2');
    state.currentPhase = 'combat';

    const result = CardRules.activateAbility(engine, baltz.instanceId);
    assert.equal(result.status, 'resolved');
    assert.equal(support1.zone, 'discard');
    assert.equal(support2.zone, 'discard');
});

test('Gobra retorna à mão e descarta equipamentos anexados', () => {
    const state = GameStateModel.createInitialGameState();
    const engine = GameEngine.createEngine(state);
    CardRules.install(engine);
    const gobra = addFieldCreature(state, 'p1', 'card_020', 'gobra_2', { cost: 3 });
    const gear = GameStateModel.createCardInstance({
        id: 'gear', name: 'Gear', type: 'suporte', cost: 1, attack: 0, defense: 0
    }, 'p1', { instanceId: 'gobra_gear' });
    GameStateModel.registerCard(state, gear, 'equipment', 'p1');
    gear.attachedTo = gobra.instanceId;
    gobra.attachments.push(gear.instanceId);
    state.currentPhase = 'combat';

    const result = CardRules.activateAbility(engine, gobra.instanceId);
    assert.equal(result.status, 'resolved');
    assert.equal(gobra.zone, 'hand');
    assert.equal(gear.zone, 'discard');
});

test('Bilugatron gruda em um inimigo, causa 10 de dano por turno e perde ataque/defesa', () => {
    const state = GameStateModel.createInitialGameState();
    const engine = GameEngine.createEngine(state);
    CardRules.install(engine);
    const bilugatron = addFieldCreature(state, 'p1', 'card_027', 'bilugatron_1');
    const enemy = addFieldCreature(state, 'p2', 'enemy', 'bilugatron_enemy');
    state.currentPhase = 'combat';

    const result = CardRules.activateAbility(engine, bilugatron.instanceId, [enemy.instanceId]);
    assert.equal(result.status, 'resolved');
    assert.equal(engine.getEffectiveStat(bilugatron.instanceId, 'defense'), 0);
    assert.equal(
        state.effects.some(effect =>
            effect.effectType === 'ATTACK_DISABLED' && effect.targetId === bilugatron.instanceId
        ),
        true
    );

    engine.emit(GameEngine.EVENT_TYPES.TURN_STARTED, { playerId: 'p1', turnNumber: state.turn });
    assert.equal(enemy.damage, 10);

    const combat = engine.resolveCombat({ attackerId: bilugatron.instanceId, targetId: enemy.instanceId });
    assert.equal(combat.cancelled, true);
});

test('Duende reseta o uso de uma habilidade ativada aliada', () => {
    const state = GameStateModel.createInitialGameState();
    const engine = GameEngine.createEngine(state);
    CardRules.install(engine);
    const duende = addFieldCreature(state, 'p1', 'card_031', 'duende_1');
    const mago = addFieldCreature(state, 'p1', 'card_055', 'mago_1');
    state.currentPhase = 'combat';

    assert.equal(CardRules.activateAbility(engine, mago.instanceId).status, 'resolved');
    assert.equal(CardRules.activateAbility(engine, mago.instanceId).status, 'rejected');

    const reset = CardRules.activateAbility(engine, duende.instanceId, [mago.instanceId]);
    assert.equal(reset.status, 'resolved');
    assert.equal(CardRules.activateAbility(engine, mago.instanceId).status, 'resolved');
});

test('Medusa de Lama paralisa um inimigo por 1 turno', () => {
    const fixture = createAreaAbilityFixture('card_034');
    const result = CardRules.activateAbility(fixture.engine, fixture.source.instanceId, [fixture.enemy1.instanceId]);
    assert.equal(result.status, 'resolved');
    assert.equal(
        fixture.state.effects.some(effect =>
            effect.effectType === 'ATTACK_DISABLED' && effect.targetId === fixture.enemy1.instanceId
        ),
        true
    );
});

test('Trox retorna à mão uma vez por partida e pode ser reinvocado sem custo', () => {
    const state = GameStateModel.createInitialGameState();
    const engine = GameEngine.createEngine(state);
    CardRules.install(engine);
    const trox = addFieldCreature(state, 'p1', 'card_039', 'trox_1');
    state.currentPhase = 'combat';

    const result = CardRules.activateAbility(engine, trox.instanceId);
    assert.equal(result.status, 'resolved');
    assert.equal(trox.zone, 'hand');
    assert.equal(engine.getEffectiveStat(trox.instanceId, 'cost'), 0);
});

test('Invocador das Trevas invoca um Diabrete Alado da mão pagando 1 de energia', () => {
    const state = GameStateModel.createInitialGameState();
    const engine = GameEngine.createEngine(state);
    CardRules.install(engine);
    const invocador = addFieldCreature(state, 'p1', 'card_045', 'invocador_1');
    const diabrete = GameStateModel.createCardInstance({
        id: 'card_010_1', name: 'Diabrete Alado', type: 'criatura', cost: 2, attack: 10, defense: 8
    }, 'p1', { instanceId: 'diabrete_hand_1' });
    GameStateModel.registerCard(state, diabrete, 'hand', 'p1');
    state.currentPhase = 'invocation';

    const result = CardRules.activateAbility(engine, invocador.instanceId, [diabrete.instanceId]);
    assert.equal(result.status, 'resolved');
    assert.equal(diabrete.zone, 'field');
    assert.equal(state.players.p1.energy, 5);
});

test('Salatiel paga energia para ignorar a defesa de um alvo no próximo ataque', () => {
    const fixture = createCombatFixture({ attackerAttack: 5, targetDefense: 50, targetAttack: 0 });
    fixture.attacker.definitionId = 'card_046';
    CardRules.install(fixture.engine);

    const result = CardRules.activateAbility(fixture.engine, fixture.attacker.instanceId, [fixture.target.instanceId]);
    assert.equal(result.status, 'resolved');
    assert.equal(fixture.state.players.p1.energy, 3);

    const combat = fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        targetId: fixture.target.instanceId
    });
    assert.equal(combat.penetratingDamage, 5);
    assert.equal(fixture.target.damage, 5);
});

test('Entola Guela impede o ataque do alvo até o fim do turno dele', () => {
    const fixture = createAreaAbilityFixture('card_049');
    const result = CardRules.activateAbility(fixture.engine, fixture.source.instanceId, [fixture.enemy1.instanceId]);
    assert.equal(result.status, 'resolved');
    assert.equal(
        fixture.state.effects.some(effect =>
            effect.effectType === 'ATTACK_DISABLED' && effect.targetId === fixture.enemy1.instanceId
        ),
        true
    );
});

test('Mago Arcano causa 5 de dano direto ao oponente', () => {
    const fixture = createAreaAbilityFixture('card_055');
    const result = CardRules.activateAbility(fixture.engine, fixture.source.instanceId);
    assert.equal(result.status, 'resolved');
    assert.equal(fixture.state.players.p2.pv, 195);
});

test('Alquimista Guardião concede +10 DEF a um aliado até o fim do próximo turno adversário', () => {
    const fixture = createAreaAbilityFixture('card_061');
    const result = CardRules.activateAbility(fixture.engine, fixture.source.instanceId, [fixture.ally.instanceId]);
    assert.equal(result.status, 'resolved');
    assert.equal(fixture.engine.getEffectiveStat(fixture.ally.instanceId, 'defense'), 30);
});

test('Lobo Omega Pyro aplica queimadura contínua que reduz DEF a cada turno', () => {
    const fixture = createAreaAbilityFixture('card_080');
    const result = CardRules.activateAbility(fixture.engine, fixture.source.instanceId, [fixture.enemy1.instanceId]);
    assert.equal(result.status, 'resolved');
    fixture.engine.emit(GameEngine.EVENT_TYPES.TURN_STARTED, { playerId: 'p1', turnNumber: fixture.state.turn });
    assert.equal(fixture.engine.getEffectiveStat(fixture.enemy1.instanceId, 'defense'), 15);
});

test('Lobo Gamma Freeze paralisa todos os inimigos por 3 turnos', () => {
    const fixture = createAreaAbilityFixture('card_082');
    const result = CardRules.activateAbility(fixture.engine, fixture.source.instanceId);
    assert.equal(result.status, 'resolved');
    assert.equal(
        fixture.state.effects.filter(effect => effect.effectType === 'ATTACK_DISABLED').length,
        2
    );
});

test('Marik 2 ataca todos os inimigos e perde toda a defesa depois', () => {
    const fixture = createAreaAbilityFixture('card_085');
    const result = CardRules.activateAbility(fixture.engine, fixture.source.instanceId);
    assert.equal(result.status, 'resolved');
    assert.equal(fixture.enemy1.damage, 30);
    assert.equal(fixture.enemy2.damage, 30);
    assert.equal(fixture.engine.getEffectiveStat(fixture.source.instanceId, 'defense'), 0);
});

test('Tlantidu busca um monstro aquático no deck ao ser destruído', () => {
    const fixture = createCombatFixture({ attackerAttack: 30, targetDefense: 5, targetAttack: 0 });
    fixture.target.definitionId = 'card_038';
    CardRules.install(fixture.engine);
    const nonAquaticCard = GameStateModel.createCardInstance({
        id: 'tlantidu_deck_card', name: 'Deck', type: 'criatura', cost: 1, attack: 1, defense: 1
    }, 'p2', { instanceId: 'tlantidu_deck_1' });
    nonAquaticCard.definitionId = 'card_target';
    const aquaticCard = GameStateModel.createCardInstance({
        id: 'card_083', name: 'Hidra das Profundezas', type: 'criatura', cost: 12, attack: 59, defense: 59
    }, 'p2', { instanceId: 'tlantidu_deck_2' });
    GameStateModel.registerCard(fixture.state, nonAquaticCard, 'deck', 'p2');
    GameStateModel.registerCard(fixture.state, aquaticCard, 'deck', 'p2');

    const result = fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        targetId: fixture.target.instanceId
    });

    assert.equal(result.status, 'resolved');
    assert.equal(fixture.target.zone, 'discard');
    assert.equal(nonAquaticCard.zone, 'deck');
    assert.equal(aquaticCard.zone, 'hand');
});

test('Alucard ressuscita um aliado do cemitério diretamente para o campo ao derrotar', () => {
    const fixture = createCombatFixture({ attackerAttack: 25, targetDefense: 10, targetAttack: 0 });
    fixture.attacker.definitionId = 'card_062';
    CardRules.install(fixture.engine);
    const buried = addFieldCreature(fixture.state, 'p1', 'buried_ally', 'alucard_buried_1');
    GameStateModel.moveCard(fixture.state, buried.instanceId, 'discard', 'p1');

    const result = fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        targetId: fixture.target.instanceId
    });

    assert.equal(result.targetDestroyed, true);
    assert.equal(buried.zone, 'field');
});

test('Roller retorna à mão ao morrer e acumula penalidade de custo', () => {
    const fixture = createCombatFixture({ attackerAttack: 30, targetDefense: 5, targetAttack: 0 });
    fixture.target.definitionId = 'card_069';
    CardRules.install(fixture.engine);

    const result = fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        targetId: fixture.target.instanceId
    });

    assert.equal(result.status, 'resolved');
    assert.equal(fixture.target.zone, 'hand');
    assert.equal(fixture.engine.getEffectiveStat(fixture.target.instanceId, 'cost'), 3);
});

test('Gulosinho ganha +5/+5 permanentes ao abdicar de atacar no turno', () => {
    const state = GameStateModel.createInitialGameState();
    const engine = GameEngine.createEngine(state);
    CardRules.install(engine);
    const gulosinho = addFieldCreature(state, 'p1', 'card_041', 'gulosinho_1');

    engine.emit(GameEngine.EVENT_TYPES.TURN_ENDED, { playerId: 'p1', turnNumber: state.turn });
    assert.equal(engine.getEffectiveStat(gulosinho.instanceId, 'attack'), 15);
    assert.equal(engine.getEffectiveStat(gulosinho.instanceId, 'defense'), 15);
});

test('Gulosinho não ganha bônus se atacou no turno', () => {
    const fixture = createCombatFixture();
    fixture.attacker.definitionId = 'card_041';
    CardRules.install(fixture.engine);
    fixture.engine.resolveCombat({
        attackerId: fixture.attacker.instanceId,
        targetId: fixture.target.instanceId
    });
    fixture.engine.emit(GameEngine.EVENT_TYPES.TURN_ENDED, { playerId: 'p1', turnNumber: fixture.state.turn });
    assert.equal(fixture.engine.getEffectiveStat(fixture.attacker.instanceId, 'attack'), 15);
});

test('GameStateModel persiste nome do jogador via setPlayerName', () => {
    const state = GameStateModel.createInitialGameState();
    assert.equal(GameStateModel.getPlayerName(state, 'p1'), 'Jogador 1');
    GameStateModel.setPlayerName(state, 'p1', 'Kevin');
    assert.equal(GameStateModel.getPlayerName(state, 'p1'), 'Kevin');
    assert.equal(GameStateModel.getPlayerName(state, 'p2'), 'Jogador 2');
});

test('Trox: modificador de custo zero é consumido após reinvocação', () => {
    const state = GameStateModel.createInitialGameState();
    const engine = GameEngine.createEngine(state);
    CardRules.install(engine);
    const trox = addFieldCreature(state, 'p1', 'card_039', 'trox_1');
    state.currentPhase = 'combat';

    const result = CardRules.activateAbility(engine, trox.instanceId);
    assert.equal(result.status, 'resolved');
    assert.equal(trox.zone, 'hand');
    assert.equal(engine.getEffectiveStat(trox.instanceId, 'cost'), 0, 'custo deve ser 0 antes da reinvocação');

    engine.emit(GameEngine.EVENT_TYPES.CREATURE_SUMMONED, {
        cardId: trox.instanceId,
        playerId: 'p1',
        definitionId: trox.definitionId
    });
    assert.notEqual(engine.getEffectiveStat(trox.instanceId, 'cost'), 0, 'modificador deve ser consumido após CREATURE_SUMMONED');
});

test('equipagem de suporte sem regra retorna null em vez de lançar', () => {
    ['card_006', 'card_007', 'card_008', 'card_090'].forEach(definitionId => {
        const state = GameStateModel.createInitialGameState();
        const equipment = GameStateModel.createCardInstance({
            id: definitionId,
            name: definitionId,
            type: 'suporte',
            cost: 2,
            attack: 0,
            defense: 0
        }, 'p1', { instanceId: `ruleless_${definitionId}` });
        GameStateModel.registerCard(state, equipment, 'hand', 'p1');

        assert.equal(
            CardRules.createEquipmentEffects(equipment, 'qualquer-alvo', state),
            null,
            `${definitionId} não deve lançar sem EQUIPMENT_RULES`
        );
    });
});

test('fluxo de drag-and-drop do suporte usa o motivo exato da recusa', () => {
    // Harness mínimo de DOM para carregar o código de UI (src/js/game.js) no
    // Node: elementos falsos com classList/ondrop e captura dos toasts.
    const gameSource = fs.readFileSync(path.join(__dirname, '../../src/js/game.js'), 'utf8');
    const toasts = [];
    const elementsById = new Map();
    const createEl = (id = '') => {
        const classes = new Set();
        const element = {
            id,
            children: [],
            parentElement: null,
            style: {},
            dataset: {},
            textContent: '',
            innerHTML: '',
            ondrop: null,
            ondragover: null,
            onclick: null,
            ondragstart: null,
            ondragend: null,
            onmousedown: null,
            ondblclick: null,
            onmouseenter: null,
            onmouseleave: null,
            classList: {
                add(...names) { names.forEach(name => classes.add(name)); },
                remove(...names) { names.forEach(name => classes.delete(name)); },
                contains(name) { return classes.has(name); },
                toggle() {},
                _classes: classes
            },
            setAttribute() {},
            getAttribute() { return null; },
            appendChild(child) {
                element.children.push(child);
                child.parentElement = element;
            },
            remove() {
                element.removed = true;
            },
            querySelector() { return createEl('filho'); },
            querySelectorAll() { return []; },
            addEventListener() {},
            play() { return Promise.resolve(); }
        };
        Object.defineProperty(element, 'className', {
            get() { return [...classes].join(' '); },
            set(value) {
                classes.clear();
                String(value).split(/\s+/).filter(Boolean).forEach(name => classes.add(name));
            }
        });
        return element;
    };
    const fakeDocument = {
        addEventListener() {},
        getElementById(id) { return elementsById.get(id) || null; },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        createElement() { return createEl(''); },
        body: {
            appendChild(node) { toasts.push(node.textContent); },
            removeChild() {}
        },
        documentElement: createEl('')
    };
    const fakeWindow = {
        GameStateModel,
        GameEngine,
        CardRules,
        cardAbilities: { attachEngine() {}, onCardSummoned() {}, onCardEquipped() {} }
    };
    const ui = new Function('window', 'document', `${gameSource}\n;return { gameState, dragStart, dropCard, createCard };`)(fakeWindow, fakeDocument);
    const uiState = ui.gameState;

    const field = createEl('field-p1');
    field.className = 'player1-field';
    field.dataset.player = 'p1';
    elementsById.set('field-p1', field);

    const dragon = GameStateModel.createCardInstance({
        id: 'card_055', name: 'Mago Arcano', type: 'criatura', cost: 6, attack: 25, defense: 30
    }, 'p1', { instanceId: 'dnd_host' });
    GameStateModel.registerCard(uiState, dragon, 'field', 'p1');
    const dragonElement = createEl('dnd_host');
    dragonElement.className = 'card monster';
    elementsById.set('dnd_host', dragonElement);
    field.appendChild(dragonElement);
    dragon.element = dragonElement;

    const staff = GameStateModel.createCardInstance({
        id: 'card_092', name: 'Cajado', type: 'suporte', cost: 2, attack: 5, defense: 5
    }, 'p1', { instanceId: 'dnd_staff' });
    GameStateModel.registerCard(uiState, staff, 'hand', 'p1');
    ui.createCard(staff, 'p1');
    elementsById.set('dnd_staff', staff.element);

    uiState.currentPhase = 'invocation';
    uiState.currentPlayer = 'p1';
    const dragEvent = (target, currentTarget) => ({
        target,
        currentTarget,
        preventDefault() {},
        stopPropagation() { currentTarget.stopped = true; },
        dataTransfer: { setData() {}, getData() { return 'dnd_staff'; } }
    });
    // Cenário 1: energia insuficiente — o drop na criatura recebe handler e o
    // drop no campo exibe o motivo real (energia), não a mensagem genérica.
    GameStateModel.setPlayerStat(uiState, 'energy', 'p1', 1);
    ui.dragStart(dragEvent(staff.element, staff.element));
    assert.equal(typeof dragonElement.ondrop, 'function', 'criatura deve ter handler de drop mesmo sem energia');
    assert.equal(field.classList.contains('field-drop-zone'), false, 'campo não é alvo de suporte');
    assert.equal(field.classList.contains('field-invalid-drop'), false, 'campo não deve ser marcado para suporte');
    toasts.length = 0;
    ui.dropCard(dragEvent(dragonElement, field));
    assert.equal(toasts.length, 1);
    assert.match(toasts[0], /Energia insuficiente para equipar/);
    assert.equal(toasts[0].includes('devem ser equipadas em uma criatura'), false);
    assert.equal(staff.zone, 'hand');

    // Cenário 2: energia suficiente — equipa uma única vez, sem toast duplicado.
    toasts.length = 0;
    GameStateModel.setPlayerStat(uiState, 'energy', 'p1', 6);
    ui.dragStart(dragEvent(staff.element, staff.element));
    assert.equal(typeof dragonElement.ondrop, 'function');
    assert.equal(dragonElement.classList.contains('can-be-equipped'), true);
    dragonElement.ondrop(dragEvent(dragonElement, dragonElement));
    assert.equal(uiState.cardInstances.dnd_staff.zone, 'equipment');
    assert.equal(toasts.length, 1);
    assert.match(toasts[0], /foi equipada em/);
    toasts.length = 0;

    // Cenário 3: mesmo com a carta já equipada, um drop subsequente no campo
    // não deve acusar a carta de suporte no campo nem gastar energia de novo.
    const energyAfterEquip = GameStateModel.getPlayerStat(uiState, 'energy', 'p1');
    ui.dropCard(dragEvent(dragonElement, field));
    assert.equal(toasts.length, 1, 'o drop no campo exibe a mensagem de suporte no campo');
    assert.match(toasts[0], /devem ser equipadas em uma criatura/);
    assert.equal(GameStateModel.getPlayerStat(uiState, 'energy', 'p1'), energyAfterEquip);
});

test('game.js mantém uma única definição de highlightEquippableCreatures', () => {
    const interfaceSource = fs.readFileSync(path.join(__dirname, '../../src/js/game.js'), 'utf8');
    const definitions = interfaceSource.match(/function highlightEquippableCreatures\(/g) || [];
    assert.equal(definitions.length, 1);
    assert.match(interfaceSource, /function highlightEquippableCreatures\(supportCardData, canEquip/);
    assert.equal(interfaceSource.includes('Overridden highlightEquippableCreatures'), false);
});

test('drop em criatura interrompe a propagação até o campo', () => {
    const interfaceSource = fs.readFileSync(path.join(__dirname, '../../src/js/game.js'), 'utf8');
    const creatureDrop = interfaceSource.slice(
        interfaceSource.indexOf('const isCreatureDrop'),
        interfaceSource.indexOf('const targetPlayer')
    );
    assert.match(creatureDrop, /e\.stopPropagation\(\);/);
    assert.match(creatureDrop, /handleEquipmentDrop\(e, cardId\);/);
});

test('fim de jogo trava os botões e o reset devolve a interatividade', () => {
    const interfaceSource = fs.readFileSync(path.join(__dirname, '../../src/js/game.js'), 'utf8');
    const functionBody = (name, nextName) => {
        const start = interfaceSource.indexOf(`function ${name}`);
        const end = interfaceSource.indexOf(`function ${nextName}`, start);
        assert.notEqual(start, -1, `Função ${name} não encontrada`);
        assert.notEqual(end, -1, `Limite ${nextName} não encontrado`);
        return interfaceSource.slice(start, end);
    };

    // Um único ponto de verdade para habilitar/desabilitar os controles
    const definitions = interfaceSource.match(/function setMatchButtonsEnabled\(/g) || [];
    assert.equal(definitions.length, 1);

    // O fim de jogo (inclusive o disparado pelo motor) trava tudo e toca a vinheta
    const endGameBody = functionBody('endGame', 'changeStat');
    assert.match(endGameBody, /setMatchButtonsEnabled\(false\);/);
    assert.match(endGameBody, /playVictorySound\(\);/);
    assert.equal(endGameBody.includes("querySelectorAll('button')"), false);

    // O reset reabre os controles e invalida timers/vinheta da partida anterior
    const resetBody = functionBody('resetGame', 'createCard');
    assert.match(resetBody, /setMatchButtonsEnabled\(true\);/);
    assert.match(resetBody, /window\.victorySoundPlayed = false;/);
    assert.match(resetBody, /window\.matchGeneration \+= 1;/);

    // A vinheta é idempotente por partida
    const victorySoundBody = functionBody('playVictorySound', 'nextPhase');
    assert.match(victorySoundBody, /if \(window\.victorySoundPlayed\) return;/);
});

test('timers de fim de turno e de vitória respeitam a geração da partida', () => {
    const interfaceSource = fs.readFileSync(path.join(__dirname, '../../src/js/game.js'), 'utf8');
    const generationGuards = interfaceSource.match(/generation !== window\.matchGeneration/g) || [];
    assert.equal(generationGuards.length, 2);
});

/**
 * TESTES DA PARTE 2 – RIGOR
 */

// 1. RNG injetável – shuffleArray determinístico
test('shuffleArray com RNG injetável produz mesma ordem para mesma seed', () => {
    const rngA = mulberry32(42);
    const rngB = mulberry32(42);
    const builderA = new DeckBuilder(cardsDatabase, { rng: rngA });
    const builderB = new DeckBuilder(cardsDatabase, { rng: rngB });
    const arrA = [...builderA.allCards];
    const arrB = [...builderB.allCards];
    const shuffledA = builderA.shuffleArray(arrA, rngA);
    const shuffledB = builderB.shuffleArray(arrB, rngB);
    assert.deepStrictEqual(shuffledA.map(c => c.id), shuffledB.map(c => c.id));
});

// 2. createMatchDecks determinístico
test('createMatchDecks com seed fixa gera decks idênticos', () => {
    const rng1 = mulberry32(99);
    const rng2 = mulberry32(99);
    const builder1 = new DeckBuilder(cardsDatabase, { rng: rng1 });
    const builder2 = new DeckBuilder(cardsDatabase, { rng: rng2 });
    const decks1 = builder1.createMatchDecks(40);
    const decks2 = builder2.createMatchDecks(40);
    assert.deepStrictEqual(decks1.player1.map(c => c.id), decks2.player1.map(c => c.id));
    assert.deepStrictEqual(decks1.player2.map(c => c.id), decks2.player2.map(c => c.id));
});

// 3. normalizeCommand validação de comando
test('normalizeCommand valida comando DRAW válido', () => {
    const raw = { cmd: 'DRAW', actor: 'p1', args: {} };
    const norm = PvpProtocol.normalizeCommand(raw);
    assert.strictEqual(norm.cmd, 'DRAW');
    assert.strictEqual(norm.actor, 'p1');
    assert.deepStrictEqual(norm.args, {});
    assert.deepStrictEqual(norm.reveals, []);
});

test('normalizeCommand rejeita comando desconhecido', () => {
    const raw = { cmd: 'FOO', actor: 'p1', args: {} };
    assert.throws(() => PvpProtocol.normalizeCommand(raw), /Comando desconhecido/);
});

test('normalizeCommand rejeita ator inválido', () => {
    const raw = { cmd: 'DRAW', actor: 'p3', args: {} };
    assert.throws(() => PvpProtocol.normalizeCommand(raw), /Ator invalido/);
});

test('normalizeCommand rejeita SUMMON sem handSlot', () => {
    const raw = { cmd: 'SUMMON', actor: 'p1', args: {} };
    assert.throws(() => PvpProtocol.normalizeCommand(raw), /Args ausente para SUMMON/);
});

test('normalizeCommand rejeita SET_PHASE fase inválida', () => {
    const raw = { cmd: 'SET_PHASE', actor: 'p1', args: { phase: 'xyz' } };
    assert.throws(() => PvpProtocol.normalizeCommand(raw), /SET_PHASE: fase invalida/);
});

test('normalizeCommand rejeita reveals malformado', () => {
    const raw = { cmd: 'DRAW', actor: 'p1', reveals: [{ bad: true }] };
    assert.throws(() => PvpProtocol.normalizeCommand(raw), /reveal invalido/);
});

// 4. stateHash determinístico e sensível a mudanças
test('stateHash é determinístico para o mesmo estado', () => {
    const stateA = GameStateModel.createInitialGameState();
    const stateB = JSON.parse(JSON.stringify(stateA)); // deep copy
    const hashA = PvpProtocol.stateHash(stateA);
    const hashB = PvpProtocol.stateHash(stateB);
    assert.strictEqual(hashA, hashB);
});

test('stateHash muda quando turno muda', () => {
    const state = GameStateModel.createInitialGameState();
    const hash1 = PvpProtocol.stateHash(state);
    state.turn = state.turn + 1;
    const hash2 = PvpProtocol.stateHash(state);
    assert.notStrictEqual(hash1, hash2);
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