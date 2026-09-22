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

// O repositório guarda os arquivos com LF, mas um checkout Windows com
// `core.autocrlf=true` entrega CRLF. Testes que ancoram em início de linha
// (`\n...`) ou fatiaram um bloco por `\n` precisam do texto normalizado para
// valer nos dois checkouts.
function readSourceText(relativePath) {
    return fs.readFileSync(path.join(__dirname, '../..', relativePath), 'utf8').replace(/\r\n/g, '\n');
}

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

function findCatalogCard(definitionId) {
    return cardsDatabase.cards.find(card => card.id === definitionId) || null;
}

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
    // O suporte replica os números do catálogo: a regra da carta tem precedência
    // quando declara o stat e o catálogo preenche os stats que ela não declara.
    const definition = findCatalogCard(definitionId) || {};
    const equipment = GameStateModel.createCardInstance({
        id: definitionId,
        name: definition.name || definitionId,
        type: 'suporte',
        cost: definition.cost ?? 1,
        attack: definition.attack ?? 0,
        defense: definition.defense ?? 0
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

test('suportes somam os próprios ATK/DEF do catálogo quando a regra não declara o stat', () => {
    ['card_002', 'card_089', 'card_092', 'card_093', 'card_095', 'card_096',
        'card_100', 'card_101', 'card_102', 'card_103', 'card_105', 'card_106',
        'card_107', 'card_108'].forEach(definitionId => {
        const definition = findCatalogCard(definitionId);
        assert.ok(definition, `${definitionId} deve existir no catálogo`);
        const { engine, target, equipment } = createEquipmentRuleFixture(definitionId);

        assert.equal(
            engine.getEffectiveStat(target.instanceId, 'attack'),
            20 + definition.attack,
            `${definitionId} deve somar ${definition.attack} de ATK do catálogo`
        );
        assert.equal(
            engine.getEffectiveStat(target.instanceId, 'defense'),
            20 + definition.defense,
            `${definitionId} deve somar ${definition.defense} de DEF do catálogo`
        );

        engine.resolveAction({
            type: 'REMOVE_CATALOG_EQUIPMENT',
            actorId: 'p1',
            sourceId: equipment.instanceId,
            effects: [{
                kind: GameEngine.EFFECT_KINDS.MOVE_CARD,
                instanceId: equipment.instanceId,
                destinationZone: 'discard',
                destinationPlayerId: equipment.ownerId
            }]
        });
        assert.equal(engine.getEffectiveStat(target.instanceId, 'attack'), 20);
        assert.equal(engine.getEffectiveStat(target.instanceId, 'defense'), 20);
    });
});

test('suportes hostis aplicam só a penalidade da regra, sem duplicar o catálogo', () => {
    const zica = createEquipmentRuleFixture('card_005');
    assert.deepEqual(zica.target.modifiers, [], 'Zica drena DEF, não soma stat do catálogo');
    assert.equal(zica.engine.getEffectiveStat(zica.target.instanceId, 'defense'), 20);

    const onzeDeSetembro = createEquipmentRuleFixture('card_015');
    assert.deepEqual(
        onzeDeSetembro.target.modifiers.map(modifier => modifier.id),
        ['card_015_equipment:attack', 'card_015_equipment:defense']
    );
    assert.equal(onzeDeSetembro.engine.getEffectiveStat(onzeDeSetembro.target.instanceId, 'attack'), 10);
    // 20 - 25 = -5, mas o motor exibe DEF efetiva com piso em 0.
    assert.equal(onzeDeSetembro.engine.getEffectiveStat(onzeDeSetembro.target.instanceId, 'defense'), 0);
    assert.equal(onzeDeSetembro.target.modifiers.find(modifier => modifier.id === 'card_015_equipment:defense').value, -25);
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
    // A permissão de equipamento NÃO fura a regra do primeiro turno de cada jogador.
    assert.equal(CardRules.canDirectAttack(atravessava.state, atravessava.attacker.instanceId), false);
    atravessava.state.turn = 3; // segundo turno de p1
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
    rego.state.turn = 3; // segundo turno de p1 (o primeiro não permite ataque direto)
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

test('Scoul não ativa sozinho e Gobra (dragão) ativa pelo JSON', () => {
    const db = cardsDatabase.cards;
    assert.deepEqual(db.find(c => c.id === 'card_020').traits, ['dragao']);
    assert.ok(db.find(c => c.id === 'card_037').traits.includes('dragao'));
    const fixture = createSummonRuleFixture('card_037');
    fixture.source.data.traits = [...db.find(c => c.id === 'card_037').traits];
    emitSummoned(fixture.engine, fixture.source);
    assert.equal(fixture.engine.getEffectiveStat(fixture.source.instanceId, 'attack'), 10);
    const gobra = addFieldCreature(fixture.state, 'p1', 'card_020', 'gobra_dragao');
    gobra.data.traits = [...db.find(c => c.id === 'card_020').traits];
    assert.equal(CardRules.hasTrait(gobra, 'dragao'), true);
    assert.equal(fixture.engine.getEffectiveStat(fixture.source.instanceId, 'attack'), 20);
});

test('toda criatura e evolução do JSON tem ao menos uma trait', () => {
    // `evolução` também é criatura (ver isCreatureCard): Turtol Maximus e Marik 2
    // ficaram fora deste invariante enquanto ele só olhava `type === 'criatura'`.
    const criaturas = cardsDatabase.cards.filter(c => c.type === 'criatura' || c.type === 'evolução');
    assert.equal(criaturas.length, 79);
    const semTrait = criaturas.filter(c => !Array.isArray(c.traits));
    assert.deepEqual(semTrait.map(c => c.id), []);
    const vazias = criaturas.filter(c => c.traits.length === 0);
    assert.deepEqual(vazias.map(c => c.id), []);
});

test('criaturas de corpo humano trazem a trait humanoide', () => {
    // Critério (decision.md): humanoide = bípede + corpo de humano + capaz de
    // empunhar arma. Aplicado por nome + hability + imagem da carta.
    const humanoides = [
        'card_003', 'card_025', 'card_026', 'card_031', 'card_040',
        'card_043', 'card_045', 'card_046', 'card_047', 'card_054', 'card_055', 'card_056',
        'card_058', 'card_059', 'card_061', 'card_062', 'card_066', 'card_067', 'card_068',
        'card_072', 'card_076', 'card_077', 'card_085', 'card_086'
    ];
    const faltando = humanoides.filter(id => {
        const carta = cardsDatabase.cards.find(c => c.id === id);
        return !carta || !carta.traits.includes('humanoide');
    });
    assert.deepEqual(faltando, [], 'estas cartas deveriam ter humanoide');
});

test('humanoide exige corpo de humano: nunca junto de corpo não humano', () => {
    // Corpos claramente não humanos (dragão, máquina, peixe, planta, espectro)
    // não podem ser humanoide, mesmo em bípedes que empunham arma.
    const corposNaoHumanos = ['dragao', 'robotico', 'aquatico', 'planta', 'fantasma'];
    const conflitos = [];
    cardsDatabase.cards
        .filter(c => c.type === 'criatura' || c.type === 'evolução')
        .forEach(carta => {
            if (!carta.traits.includes('humanoide')) return;
            const corpo = carta.traits.filter(t => corposNaoHumanos.includes(t));
            if (corpo.length) conflitos.push(`${carta.id}: humanoide + ${corpo.join(',')}`);
        });
    assert.deepEqual(conflitos, []);
    // Superior é um dragão de duas cabeças: corpo de dragão, não de humano.
    assert.deepEqual(cardsDatabase.cards.find(c => c.id === 'card_087').traits, ['elite', 'dragao']);
});

test('traits de ofício humano (guerreiro/paladino/vampiro) implicam humanoide', () => {
    // Quem empunha arma ou veste armadura tem corpo de humano por definição:
    // o ofício nunca aparece sem o trait humanoide.
    // `lobisomem` NÃO entra aqui: a família Lobo é canina (ver teste seguinte).
    const oficios = ['guerreiro', 'paladino', 'vampiro'];
    const orfaos = [];
    cardsDatabase.cards
        .filter(c => c.type === 'criatura' || c.type === 'evolução')
        .forEach(carta => {
            const oficio = carta.traits.filter(t => oficios.includes(t));
            if (oficio.length && !carta.traits.includes('humanoide')) {
                orfaos.push(`${carta.id}: ${oficio.join(',')} sem humanoide`);
            }
        });
    assert.deepEqual(orfaos, []);
});

test('lobisomens de corpo humano são humanoides; a família Lobo não é', () => {
    // Critério do autor: "lobos não são humanoides por padrão, lobisomens sim".
    // Licantropos com corpo de humano (O Lica, Marik, Marik 2) mantêm humanoide;
    // a família Lobo (Alfa/Beta/Omega/Latex/Gamma) é canina e fica apenas com
    // `lobisomem`, que ali é trait temática de grupo — não corpo de humano.
    const licantroposHumanos = ['card_059', 'card_077', 'card_085'];
    const familiaLobo = ['card_078', 'card_079', 'card_080', 'card_081', 'card_082'];
    const licantroposSemHumanoide = licantroposHumanos.filter(id => {
        const carta = cardsDatabase.cards.find(c => c.id === id);
        return !carta || !carta.traits.includes('humanoide');
    });
    assert.deepEqual(
        licantroposSemHumanoide,
        [],
        'licantropos de corpo humano deveriam ter humanoide'
    );
    const lobosInvalidos = familiaLobo.filter(id => {
        const carta = cardsDatabase.cards.find(c => c.id === id);
        return !carta ||
            !carta.traits.includes('lobisomem') ||
            carta.traits.includes('humanoide');
    });
    assert.deepEqual(
        lobosInvalidos,
        [],
        'a família Lobo deve ter lobisomem e nunca humanoide'
    );
});

test('traits aplicados por arte/efeito: planta, voador, magico e aquatico', () => {
    // Decisão do autor (2026-09-21) sobre a seção E do relatório de traits:
    // cada carta recebeu a trait que a arte ou o efeito declara.
    const esperados = {
        card_012: 'planta',    // árvore de Natal antropomórfica (era humanoide)
        card_003: 'voador',    // disco voador na arte (abdução)
        card_078: 'voador',    // "Domínio Aéreo" + nome "Fly"
        card_061: 'magico',    // Alquimista Guardião / Elixir Protetor
        card_063: 'aquatico'   // Beluga de Terracota (cetáceo)
    };
    const divergentes = Object.entries(esperados)
        .filter(([id, trait]) => {
            const carta = cardsDatabase.cards.find(c => c.id === id);
            return !carta || !carta.traits.includes(trait);
        })
        .map(([id, trait]) => `${id} sem ${trait}`);
    assert.deepEqual(divergentes, []);

    const natalino = cardsDatabase.cards.find(c => c.id === 'card_012');
    assert.deepEqual(natalino.traits, ['planta'], 'Natalino é árvore, não humanoide');
    const baltz = cardsDatabase.cards.find(c => c.id === 'card_016');
    assert.deepEqual(baltz.traits, ['besta'], 'Baltz é um cão quadrúpede');
    const alquimista = cardsDatabase.cards.find(c => c.id === 'card_061');
    assert.ok(alquimista.traits.includes('humanoide'), 'Alquimista continua humanoide');
});

test('a família Lobo é besta e volta a ser hospedeira da Flecha de Prata', () => {
    const familiaLobo = ['card_078', 'card_079', 'card_080', 'card_081', 'card_082'];
    const semBesta = familiaLobo.filter(id => {
        const carta = cardsDatabase.cards.find(c => c.id === id);
        return !carta || !carta.traits.includes('besta');
    });
    assert.deepEqual(semBesta, [], 'cão é besta: a família Lobo deveria ter besta');

    const state = GameStateModel.createInitialGameState();
    const lobo = GameStateModel.createCardInstance({
        id: 'card_079', name: 'Lobo Beta Lightning', type: 'criatura', cost: 10,
        attack: 55, defense: 47
    }, 'p1', { instanceId: 'lobo_host' });
    lobo.data.traits = [...cardsDatabase.cards.find(c => c.id === 'card_079').traits];
    GameStateModel.registerCard(state, lobo, 'field', 'p1');
    const flecha = GameStateModel.createCardInstance({
        id: 'card_097', name: 'Flecha de Prata', type: 'suporte', cost: 3, attack: 8,
        defense: 0
    }, 'p1', { instanceId: 'flecha_lobo' });
    assert.equal(CardRules.validateEquipmentTarget(flecha, lobo).valid, true);
});

test('matriz de equipamento: Flecha de Prata (humanoide/besta) e Estaca (guerreiro/humanoide)', () => {
    // Valida o efeito assumido pelas correções de trait: quem hospeda os dois
    // suportes de caça depois de `012` virar planta, `016` virar besta e a
    // família Lobo ganhar `besta`.
    const state = GameStateModel.createInitialGameState();
    const host = (id, instanceId) => {
        const carta = cardsDatabase.cards.find(c => c.id === id);
        const instance = GameStateModel.createCardInstance({
            id, name: carta.name, type: carta.type, cost: carta.cost,
            attack: carta.attack, defense: carta.defense
        }, 'p1', { instanceId });
        instance.data.traits = [...carta.traits];
        GameStateModel.registerCard(state, instance, 'field', 'p1');
        return instance;
    };
    const suporte = id => GameStateModel.createCardInstance({
        id, name: id, type: 'suporte', cost: 2, attack: 8, defense: 0
    }, 'p1', { instanceId: `${id}_matriz` });
    const permite = (equipamento, alvo) =>
        CardRules.validateEquipmentTarget(equipamento, alvo).valid;

    const flecha = suporte('card_097');
    const estaca = suporte('card_102');
    const guerreiro = host('card_056', 'host_guerreiro');
    const alquimista = host('card_061', 'host_alquimista');
    const lobo = host('card_079', 'host_lobo');
    const baltz = host('card_016', 'host_baltz');
    const tobinha = host('card_014', 'host_tobinha');
    const natalino = host('card_012', 'host_natalino');
    const rayi = host('card_023', 'host_robotico');
    const superior = host('card_087', 'host_dragao');
    const hidra = host('card_083', 'host_aquatico');

    // card_097 — humanoide OU besta
    assert.equal(permite(flecha, guerreiro), true);
    assert.equal(permite(flecha, alquimista), true);
    assert.equal(permite(flecha, lobo), true, 'família Lobo é besta');
    assert.equal(permite(flecha, baltz), true, 'Baltz virou besta');
    assert.equal(permite(flecha, tobinha), true);
    assert.equal(permite(flecha, natalino), false, 'Natalino virou planta');
    assert.equal(permite(flecha, rayi), false, 'robotico não é humanoide nem besta');
    assert.equal(permite(flecha, superior), false, 'dragão não é humanoide nem besta');
    assert.equal(permite(flecha, hidra), false, 'aquatico puro não entra');

    // card_102 — guerreiro OU humanoide
    assert.equal(permite(estaca, guerreiro), true);
    assert.equal(permite(estaca, alquimista), true);
    assert.equal(permite(estaca, lobo), false, 'lobo não é guerreiro nem humanoide');
    assert.equal(permite(estaca, baltz), false);
    assert.equal(permite(estaca, natalino), false);
});

test('catálogo de traits é fechado: vocabulário, sem duplicata e sem criatura órfã', () => {
    const VOCABULARIO = new Set([
        'humanoide', 'besta', 'dragao', 'demonio', 'voador', 'robotico', 'aquatico',
        'planta', 'fantasma', 'magico', 'elite', 'guerreiro', 'paladino', 'vampiro',
        'lobisomem', 'fogo'
    ]);
    const criaturas = cardsDatabase.cards
        .filter(c => c.type === 'criatura' || c.type === 'evolução');
    const semTraits = criaturas
        .filter(c => !Array.isArray(c.traits) || c.traits.length === 0)
        .map(c => c.id);
    assert.deepEqual(semTraits, [], 'toda criatura/evolução precisa de traits');

    const desconhecidos = [];
    const duplicados = [];
    criaturas.forEach(carta => {
        (carta.traits || []).forEach(trait => {
            if (!VOCABULARIO.has(trait)) desconhecidos.push(`${carta.id}: ${trait}`);
        });
        if (new Set(carta.traits).size !== carta.traits.length) {
            duplicados.push(carta.id);
        }
    });
    assert.deepEqual(desconhecidos, [], 'trait fora do vocabulário (typo?)');
    assert.deepEqual(duplicados, [], 'trait repetida na mesma carta');
});

test('elite marca ATK > 50 e uma lista fechada de chefes com ATK menor', () => {
    // Regra registrada em decisions.md: `elite` é derivável de ATK > 50
    // (implicação de mão única). `elite` também marca chefes nomeados com
    // ATK <= 50 — lista fechada, descoberta na auditoria dos traits:
    // 036 Rei das Feras, 054 Lorde Sanguinário, 061 Alquimista Guardião,
    // 067 Paladino Alvorada, 068 Paladino Crepuscular e 076 Condessa Carmilla.
    const criaturas = cardsDatabase.cards
        .filter(c => c.type === 'criatura' || c.type === 'evolução');
    const CHEFES_SEM_ATK_ALTO = ['card_036', 'card_054', 'card_061', 'card_067',
        'card_068', 'card_076'];

    const semElite = criaturas
        .filter(c => c.attack > 50 && !c.traits.includes('elite'))
        .map(c => c.id);
    assert.deepEqual(semElite, [], 'ATK > 50 exige a trait elite');

    const eliteSemAtkAlto = criaturas
        .filter(c => c.traits.includes('elite') && c.attack <= 50)
        .map(c => c.id)
        .sort();
    assert.deepEqual(
        eliteSemAtkAlto,
        [...CHEFES_SEM_ATK_ALTO].sort(),
        'a lista de elite com ATK <= 50 é fechada: só os chefes nomeados'
    );
});

test('toda evolução herda os traits da base declarada no motor', () => {
    const evolucoes = cardsDatabase.cards.filter(c => c.type === 'evolução');
    assert.ok(evolucoes.length > 0, 'o catálogo tem cartas de evolução');
    const divergentes = [];
    evolucoes.forEach(evolucao => {
        const baseId = CardRules.getEvolutionBaseDefinitionId(evolucao.id);
        const base = cardsDatabase.cards.find(c => c.id === baseId);
        if (!base) {
            divergentes.push(`${evolucao.id}: base ${baseId} ausente no catálogo`);
            return;
        }
        const faltando = base.traits.filter(t => !evolucao.traits.includes(t));
        if (faltando.length) {
            divergentes.push(`${evolucao.id} não herdou ${faltando.join(',')} de ${baseId}`);
        }
    });
    assert.deepEqual(divergentes, []);
});

test('toda arte do catálogo é um PNG 768x1017 presente no disco', () => {
    // Sostenta a conferência visual: as folhas de revisão só valem se a arte
    // existir e estiver íntegra. Lê o IHDR direto (sem Pillow).
    const raiz = path.join(__dirname, '..', '..');
    const assinaturaPng = '\x89PNG\r\n\x1a\n';
    const problemas = [];
    cardsDatabase.cards.forEach(carta => {
        if (!carta.image) {
            problemas.push(`${carta.id}: sem campo image`);
            return;
        }
        const caminho = path.join(raiz, carta.image);
        if (!fs.existsSync(caminho)) {
            problemas.push(`${carta.id}: arte ausente (${carta.image})`);
            return;
        }
        const cabecalho = Buffer.alloc(24);
        const descritor = fs.openSync(caminho, 'r');
        fs.readSync(descritor, cabecalho, 0, 24, 0);
        fs.closeSync(descritor);
        if (cabecalho.toString('latin1', 0, 8) !== assinaturaPng) {
            problemas.push(`${carta.id}: assinatura PNG inválida`);
            return;
        }
        const largura = cabecalho.readUInt32BE(16);
        const altura = cabecalho.readUInt32BE(20);
        if (largura !== 768 || altura !== 1017) {
            problemas.push(`${carta.id}: ${largura}x${altura} (esperado 768x1017)`);
        }
    });
    assert.deepEqual(problemas, []);
});

test('inventário de traits do catálogo é fechado (lista por trait)', () => {
    // Fotografia completa das 79 criaturas/evoluções: somar, remover ou trocar
    // uma trait em qualquer carta quebra este teste. É o que segura as 60 cartas
    // que ainda não passaram por conferência visual — mudanças de trait passam
    // por aqui de propósito, obrigando a atualizar o inventário e o relatório.
    const INVENTARIO = {
        besta: ['card_011', 'card_013', 'card_014', 'card_016', 'card_017', 'card_019',
            'card_021', 'card_022', 'card_029', 'card_036', 'card_039', 'card_041',
            'card_044', 'card_048', 'card_049', 'card_050', 'card_053', 'card_063',
            'card_069', 'card_070', 'card_073', 'card_075', 'card_078', 'card_079',
            'card_080', 'card_081', 'card_082'],
        humanoide: ['card_003', 'card_025', 'card_026', 'card_031', 'card_040',
            'card_043', 'card_045', 'card_046', 'card_047', 'card_054', 'card_055',
            'card_056', 'card_058', 'card_059', 'card_061', 'card_062', 'card_066',
            'card_067', 'card_068', 'card_072', 'card_076', 'card_077', 'card_085',
            'card_086'],
        elite: ['card_036', 'card_054', 'card_061', 'card_067', 'card_068', 'card_076',
            'card_078', 'card_079', 'card_080', 'card_081', 'card_082', 'card_083',
            'card_084', 'card_085', 'card_086', 'card_087'],
        dragao: ['card_020', 'card_035', 'card_037', 'card_051', 'card_052',
            'card_065', 'card_071', 'card_087'],
        lobisomem: ['card_059', 'card_077', 'card_078', 'card_079', 'card_080',
            'card_081', 'card_082', 'card_085'],
        guerreiro: ['card_043', 'card_046', 'card_047', 'card_056', 'card_072',
            'card_077', 'card_085'],
        robotico: ['card_018', 'card_023', 'card_027', 'card_033', 'card_064',
            'card_065', 'card_084'],
        voador: ['card_003', 'card_010_1', 'card_010_2', 'card_010_3', 'card_035',
            'card_044', 'card_078'],
        aquatico: ['card_032', 'card_034', 'card_038', 'card_063', 'card_074',
            'card_083'],
        demonio: ['card_010_1', 'card_010_2', 'card_010_3', 'card_024', 'card_060'],
        magico: ['card_031', 'card_045', 'card_055', 'card_061'],
        vampiro: ['card_054', 'card_062', 'card_076'],
        fogo: ['card_057', 'card_080'],
        paladino: ['card_067', 'card_068'],
        planta: ['card_012', 'card_030'],
        fantasma: ['card_042']
    };
    const divergentes = [];
    Object.entries(INVENTARIO).forEach(([trait, esperados]) => {
        const atuais = cardsDatabase.cards
            .filter(c => (c.traits || []).includes(trait))
            .map(c => c.id)
            .sort();
        const esperado = [...esperados].sort();
        if (JSON.stringify(atuais) !== JSON.stringify(esperado)) {
            const faltando = esperado.filter(id => !atuais.includes(id));
            const extras = atuais.filter(id => !esperado.includes(id));
            divergentes.push(`${trait}: faltando [${faltando}] extras [${extras}]`);
        }
    });
    assert.deepEqual(divergentes, []);
});

test('dragões do catálogo estão marcados com a trait dragao', () => {
    // Aladar saiu da lista (decisão do autor, 2026-09-21): a arte/habilidade não
    // são de dragão — card_029 é besta.
    const dragoes = ['card_020', 'card_035', 'card_037', 'card_051',
        'card_052', 'card_065', 'card_071', 'card_087'];
    const faltando = dragoes.filter(id => {
        const carta = cardsDatabase.cards.find(c => c.id === id);
        return !carta || !carta.traits.includes('dragao');
    });
    assert.deepEqual(faltando, [], 'estas cartas deveriam ter dragao');
    assert.deepEqual(cardsDatabase.cards.find(c => c.id === 'card_029').traits, ['besta'],
        'Aladar é besta, não dragão');
});

test('Superior é dragão: Scoul reage a ele em campo', () => {
    const fixture = createSummonRuleFixture('card_037');
    fixture.source.data.traits = [...cardsDatabase.cards.find(c => c.id === 'card_037').traits];
    emitSummoned(fixture.engine, fixture.source);
    assert.equal(fixture.engine.getEffectiveStat(fixture.source.instanceId, 'attack'), 10);

    const superior = addFieldCreature(fixture.state, 'p2', 'card_087', 'superior_dragao');
    superior.data.traits = [...cardsDatabase.cards.find(c => c.id === 'card_087').traits];
    assert.equal(CardRules.hasTrait(superior, 'dragao'), true);
    assert.equal(fixture.engine.getEffectiveStat(fixture.source.instanceId, 'attack'), 20);
});

test('toda criatura com ATK maior que 50 tem a trait elite', () => {
    const fortes = cardsDatabase.cards
        .filter(c => (c.type === 'criatura' || c.type === 'evolução') && c.attack > 50);
    assert.ok(fortes.length >= 10, 'o catálogo deve manter as criaturas acima de 50 de ATK');
    const semElite = fortes.filter(c => !c.traits.includes('elite'));
    assert.deepEqual(semElite.map(c => c.id), []);
});

test('evoluções herdam os traits da forma base', () => {
    const turtol = cardsDatabase.cards.find(c => c.id === 'card_048');
    const maximus = cardsDatabase.cards.find(c => c.id === 'card_075');
    assert.deepEqual(maximus.traits, turtol.traits);

    const marik = cardsDatabase.cards.find(c => c.id === 'card_077');
    const marik2 = cardsDatabase.cards.find(c => c.id === 'card_085');
    marik.traits.forEach(trait => {
        assert.ok(marik2.traits.includes(trait), `Marik 2 deve herdar ${trait} de Marik`);
    });
    assert.ok(marik2.traits.includes('elite'), 'Marik 2 tem ATK > 50');
});

test('o fallback TRAITS_BY_DEFINITION está sincronizado com o catálogo', () => {
    Object.entries(CardRules.TRAITS_BY_DEFINITION).forEach(([id, fallback]) => {
        const carta = cardsDatabase.cards.find(c => c.id === id);
        if (!carta || !Array.isArray(carta.traits)) return;
        assert.deepEqual([...fallback].sort(), [...carta.traits].sort(), `${id} divergiu do JSON`);
    });
});

test('traits do JSON têm precedência sobre o fallback legado', () => {
    const state = GameStateModel.createInitialGameState();
    const engine = GameEngine.createEngine(state);
    CardRules.install(engine);
    const scoul = addFieldCreature(state, 'p1', 'card_037', 'scoul_json');
    scoul.data.traits = ['besta'];
    assert.equal(CardRules.hasTrait(scoul, 'dragao'), false);
    assert.equal(CardRules.hasTrait(scoul, 'besta'), true);
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

    // `destroyCard` tem dois caminhos mutuamente exclusivos (com e sem elemento
    // no DOM): exatamente uma reprojeção por chamada, nunca duas no mesmo ramo.
    const destroyBody = functionBody('destroyCard', 'resetGame');
    assert.equal(countRenders(destroyBody), 2);
    assert.match(
        destroyBody,
        /addEventListener\('animationend', \(\) => \{\s*cardElement\.remove\(\);\s*renderFieldsFromState\(\);/
    );
    assert.match(destroyBody, /if \(!hasElement\) \{\s*renderFieldsFromState\(\);\s*\}/);
});

test('carta invocada entra no campo sem o destaque de seleção', () => {
    const fonte = fs.readFileSync(path.join(__dirname, '../../src/js/game.js'), 'utf8');
    const inicio = fonte.indexOf('function dropCard');
    const fim = fonte.indexOf('function findCardData', inicio);
    assert.notEqual(inicio, -1, 'Função dropCard não encontrada');
    assert.notEqual(fim, -1, 'Limite findCardData não encontrado');
    const corpo = fonte.slice(inicio, fim);

    // O clique marca a carta na mão (`selected`); ao ser arrastada para o campo,
    // o destaque e o estado de seleção precisam ficar para trás — senão a carta
    // invocada aparece marcada na mesa e some só no próximo clique.
    assert.match(corpo, /cardNoCampo\.classList\.remove\('selected'\)/);
    assert.match(corpo, /if \(gameState\.selectedCard === cardId\) gameState\.selectedCard = null;/);
});

test('o destaque de seleção não muda o tamanho da carta (CSS)', () => {
    const css = fs.readFileSync(path.join(__dirname, '../../src/css/game.css'), 'utf8');
    const inicio = css.indexOf('.card.selected {');
    assert.notEqual(inicio, -1, 'Regra .card.selected não encontrada');
    const bloco = css.slice(inicio, css.indexOf('}', inicio));

    assert.match(bloco, /border-color: var\(--energy-color\);/);
    assert.match(bloco, /box-shadow:/);
    // Sem `transform`/`scale`: era daqui que vinha a carta maior no campo — a
    // última clicada/invocada media 149x199 ao lado das vizinhas de 136x181.
    assert.doesNotMatch(bloco, /transform/);
    assert.doesNotMatch(bloco, /scale\(/);
});

test('fim de partida no PvP: overlay fixo, vencedor e volta ao lobby', () => {
    const fonte = fs.readFileSync(path.join(__dirname, '../../src/js/pvp-game.js'), 'utf8');
    const inicio = fonte.indexOf('function tratarFimDePartida');
    const fim = fonte.indexOf('function enviarFimDePartida', inicio);
    assert.notEqual(inicio, -1, 'tratarFimDePartida não encontrada');
    assert.notEqual(fim, -1, 'Limite enviarFimDePartida não encontrado');
    const corpo = fonte.slice(inicio, fim);

    assert.match(corpo, /overlay\.id = 'pvp-game-over'/);
    assert.match(corpo, /overlay\.className = 'pvp-overlay'/);
    assert.match(corpo, /document\.body\.appendChild\(overlay\)/);
    // A próxima partida nasce no lobby: o `?nova=1` era enfeite (a página do
    // lobby ignora a query) e o jogador ficava sem caminho claro de volta.
    assert.match(corpo, /class="pvp-primary-link" href="\/pvp">Voltar ao lobby</);
    assert.doesNotMatch(corpo, /nova=1/);

    // F5 numa sala já finalizada: o `resultado` do MATCH_START repõe o overlay.
    const montar = fonte.slice(
        fonte.indexOf('function montarPartida'),
        fonte.indexOf('function gerarDeckLocal')
    );
    assert.match(
        montar,
        /if \(mensagem\.state\?\.resultado\?\.winner\) \{\s*tratarFimDePartida\(\{ \.\.\.mensagem\.state\.resultado \}\);/
    );

    // O CSS é o que faz o overlay aparecer: `body` tem `overflow: hidden` e o
    // tabuleiro ocupa 100dvh, então sem `position: fixed` ele cai fora da tela
    // (existia no DOM e "não aparecia" no PvP).
    const css = fs.readFileSync(path.join(__dirname, '../../src/css/pvp.css'), 'utf8');
    const blocoOverlay = css.slice(css.indexOf('.pvp-overlay {'), css.indexOf('.pvp-overlay-card {'));
    assert.notEqual(blocoOverlay, '', 'regra .pvp-overlay ausente em src/css/pvp.css');
    assert.match(blocoOverlay, /position: fixed;/);
    assert.match(blocoOverlay, /inset: 0;/);

    const blocoCard = css.slice(css.indexOf('.pvp-overlay-card {'), css.indexOf('.pvp-overlay-card h1'));
    assert.match(blocoCard, /background: linear-gradient/);
    assert.match(blocoCard, /border: 2px solid var\(--primary-color\);/);

    const blocoCta = css.slice(css.indexOf('.pvp-primary-link {'), css.indexOf('.pvp-primary-link:hover'));
    assert.match(blocoCta, /display: inline-block;/);
    assert.match(blocoCta, /text-decoration: none;/);
});

test('a área de sacar mostra as cartas restantes (game.html e pvp.html)', () => {
    ['game.html', 'pvp.html'].forEach(arquivo => {
        const html = fs.readFileSync(path.join(__dirname, '../..', arquivo), 'utf8');

        ['p1', 'p2'].forEach(seat => {
            const numero = seat === 'p1' ? '1' : '2';
            const inicio = html.indexOf(`class="player${numero}-deck"`);
            assert.notEqual(inicio, -1, `área de saque de ${seat} não encontrada em ${arquivo}`);

            const contador = html.indexOf(`id="deck-count-${seat}"`, inicio);
            assert.notEqual(contador, -1, `contador do deck de ${seat} ausente em ${arquivo}`);

            // O contador mora DENTRO da área de saque (entre a abertura do bloco e
            // o botão de compra), não num canto qualquer do tabuleiro.
            const trecho = html.slice(inicio, contador);
            assert.match(trecho, /Clique para sacar/, `contador de ${seat} fora da área de saque em ${arquivo}`);
            assert.match(html.slice(contador, contador + 80), new RegExp(`class="deck-count"`));
        });
    });
});

test('o contador da área de sacar tem estilo próprio (e alerta no deck vazio)', () => {
    const css = fs.readFileSync(path.join(__dirname, '../../src/css/game.css'), 'utf8');
    const inicio = css.indexOf('.deck-count {');
    const fim = css.indexOf('.deck-count[data-empty="1"]');
    assert.notEqual(inicio, -1, 'regra .deck-count ausente em src/css/game.css');
    assert.notEqual(fim, -1, 'regra .deck-count[data-empty] ausente em src/css/game.css');

    const bloco = css.slice(inicio, fim);
    assert.match(bloco, /font-size: 10px;/);
    assert.match(bloco, /color: var\(--primary-color\);/);

    const blocoVazio = css.slice(fim, css.indexOf('}', fim));
    assert.match(blocoVazio, /color: var\(--pv-zero-color\);/);
});

test('a área de sacar é repintada a partir da zona deck do estado', () => {
    const fonte = fs.readFileSync(path.join(__dirname, '../../src/js/game.js'), 'utf8');
    const inicio = fonte.indexOf('function updateDeckCounter');
    const fim = fonte.indexOf('function handleCardDoubleClick', inicio);
    assert.notEqual(inicio, -1, 'updateDeckCounter não encontrada');
    assert.notEqual(fim, -1, 'Limite handleCardDoubleClick não encontrado');
    const corpo = fonte.slice(inicio, fim);

    // Sem contador paralelo: o saldo exibido é o tamanho da zona `deck` (o que o
    // reset local e o ledger PvP movem), e o número vai para o texto e para o
    // atributo que o CSS usa para o alerta de deck vazio.
    assert.match(corpo, /const deck = gameState\?\.players\?\.\[player\]\?\.zones\?\.deck;/);
    assert.match(corpo, /const restantes = Array\.isArray\(deck\) \? deck\.length : 0;/);
    assert.match(corpo, /countElement\.textContent = `\$\{restantes\} cartas`;/);
    assert.match(corpo, /countElement\.setAttribute\('data-count', String\(restantes\)\);/);
    assert.match(corpo, /countElement\.setAttribute\('data-empty', restantes === 0 \? '1' : '0'\);/);
    assert.match(fonte, /window\.updateDeckCounter = updateDeckCounter;/);

    // Os três momentos em que o saldo muda: boot/replay/compra do ledger
    // (`renderHandsFromState`), clique na área de saque (`addCardToHand`) e o
    // repaint geral (`updateUI`), por onde passam os efeitos que puxam do deck.
    const render = fonte.slice(
        fonte.indexOf('function renderHandsFromState'),
        fonte.indexOf('function createCardBack')
    );
    assert.match(render, /updateHandCounter\(player\);\s*updateDeckCounter\(player\);/);

    const compra = fonte.slice(
        fonte.indexOf('function addCardToHand'),
        fonte.indexOf('function toggleGearMenu')
    );
    assert.match(compra, /updateHandCounter\(player\);\s*updateDeckCounter\(player\);/);

    const ui = fonte.slice(
        fonte.indexOf('function updateUI'),
        fonte.indexOf('function updatePhaseInstructions')
    );
    assert.match(ui, /\['p1', 'p2'\]\.forEach\(player => updateDeckCounter\(player\)\);/);
});

test('em PvP o contador do deck é repintado na sincronização de contagens', () => {
    const fonte = fs.readFileSync(path.join(__dirname, '../../src/js/pvp-game.js'), 'utf8');
    const inicio = fonte.indexOf('function atualizarContadoresDeMao');
    const fim = fonte.indexOf('function atualizarNomeNaTela', inicio);
    assert.notEqual(inicio, -1, 'atualizarContadoresDeMao não encontrada');
    const corpo = fonte.slice(inicio, fim);

    // A mão do oponente é só contagem publicada, e a área de saque dele anda no
    // mesmo repaint: o deck oculto encolhe a cada DRAW replicado no ledger.
    assert.match(corpo, /window\.updateHandCounter\?\.\(player\);/);
    assert.match(corpo, /window\.updateDeckCounter\?\.\(player\);/);
});

test('o botão do dado é filho direto da pílula de energia (game.html e pvp.html)', () => {
    ['game.html', 'pvp.html'].forEach(arquivo => {
        const html = fs.readFileSync(path.join(__dirname, '../..', arquivo), 'utf8');

        ['p1', 'p2'].forEach(seat => {
            const valor = html.indexOf(`id="energy-${seat}"`);
            const botao = html.indexOf(`id="dice-${seat}"`);
            assert.notEqual(valor, -1, `energia de ${seat} não encontrada em ${arquivo}`);
            assert.notEqual(botao, -1, `botão do dado de ${seat} ausente em ${arquivo}`);

            // Nem wrapper nem margem: o `.stat` é `align-items: center`, então o
            // dado se alinha pela pílula. O `.control-buttons` tinha `margin-top`
            // e o botão um `margin-top: 4px` inline — os dois desalinhavam.
            const trecho = html.slice(valor, botao);
            assert.doesNotMatch(trecho, /control-buttons/, `wrapper .control-buttons ainda envolve o dado de ${seat} em ${arquivo}`);
            assert.doesNotMatch(trecho, /<\/?div/, `o dado de ${seat} ficou fora da pílula de energia em ${arquivo}`);

            const depoisDoBotao = html.slice(botao, botao + 220);
            assert.doesNotMatch(depoisDoBotao, /margin-top/, `margin-top inline desalinha o dado de ${seat} em ${arquivo}`);
            assert.match(depoisDoBotao, /<\/div>/, `a pílula de energia de ${seat} não fecha depois do dado em ${arquivo}`);

            // O dado fica na linha de baixo da pílula (`.stat-energy`).
            const pilula = html.lastIndexOf('class="stat stat-energy"', botao);
            assert.notEqual(pilula, -1, `pílula de energia de ${seat} sem a classe .stat-energy em ${arquivo}`);
            assert.ok(pilula < valor, `a classe .stat-energy de ${seat} não envolve a energia em ${arquivo}`);
        });
    });

    // O layout da linha de baixo é do CSS: grid com o dado ocupando as duas colunas
    // da segunda linha, sob `Energia: N`.
    const css = fs.readFileSync(path.join(__dirname, '../../src/css/game.css'), 'utf8');
    const bloco = css.slice(css.indexOf('.stat-energy {'), css.indexOf('.stat-energy .dice-button'));
    assert.match(bloco, /display: grid;/);
    assert.match(bloco, /grid-template-columns: auto auto;/);
    assert.match(bloco, /justify-content: center;/);
    assert.match(css, /\.stat-energy \.stat-label \{ grid-area: 1 \/ 1; \}/);
    assert.match(css, /\.stat-energy \.stat-value \{ grid-area: 1 \/ 2; \}/);
    assert.match(css, /\.stat-energy \.dice-button \{ grid-area: 2 \/ 1 \/ 3 \/ 3; \}/);
});

test('CSS do dado: rolagem, resultado e "+N" fora do fluxo', () => {
    const css = readSourceText('src/css/game.css');

    // O flutuante precisa ser absoluto dentro do botão: em fluxo ele empurrava a
    // pílula de energia (o `+N` era um div filho do `<button>`).
    const flutuante = css.slice(css.indexOf('.dice-result-floating {'), css.indexOf('}', css.indexOf('.dice-result-floating {')));
    assert.notEqual(css.indexOf('.dice-result-floating {'), -1, 'regra .dice-result-floating ausente');
    assert.match(flutuante, /position: absolute;/);
    assert.match(flutuante, /pointer-events: none;/);
    assert.match(flutuante, /animation: diceResultFloat 1\.4s ease-out forwards;/);

    // A âncora é a regra base: `.stat-energy .dice-button` também traz o seletor.
    const botao = (/\n\s*\.dice-button \{\n([\s\S]*?)\}/.exec(css) || [])[1] || '';
    assert.notEqual(botao, '', 'regra .dice-button ausente em game.css');
    assert.match(botao, /position: relative;/);

    assert.match(css, /\.dice-button\.dice-rolling \{\s*animation: diceTumble 0\.4s linear infinite;/);
    assert.match(css, /\.dice-button\.dice-settled \{\s*animation: diceSettle 0\.45s cubic-bezier/);
    assert.match(css, /\.energy-value\.energy-gain-dice \{\s*animation: energyGainDice 0\.9s ease-out;/);
    ['diceTumble', 'diceSettle', 'diceResultFloat', 'energyGainDice'].forEach(nome => {
        assert.match(css, new RegExp(`@keyframes ${nome} \\{`), `@keyframes ${nome} ausente`);
    });

    // O wrapper e a animação antiga saíram de cena.
    assert.doesNotMatch(css, /\.control-buttons/);
    assert.doesNotMatch(css, /\.dice-animation/);
    assert.doesNotMatch(css, /@keyframes diceRoll \{/);
});

test('Tlantidu traz a aquática do deck e o aviso aparece na UI de combate', () => {
    // Disclaimer preventivo (padrão do Fantom): ao invocar, o jogador é avisado do
    // efeito de morte — `getFeedback` é o que a UI usa em `onCardSummoned`.
    const feedback = CardRules.getFeedback('card_038');
    assert.match(feedback, /Tlantidu: ao morrer/);
    assert.match(feedback, /aquático/);

    // O motor move a carta do deck para a mão; a UI precisa reprojetar a mão (a
    // busca não passa pelo bloco `returnedToHand`) e anunciar o que veio.
    const fonte = fs.readFileSync(path.join(__dirname, '../../src/js/game.js'), 'utf8');
    const inicio = fonte.indexOf('function instantaneoDasMaos');
    const fim = fonte.indexOf('function performAttack', inicio);
    assert.notEqual(inicio, -1, 'instantaneoDasMaos não encontrada');
    const helpers = fonte.slice(inicio, fim);
    assert.match(helpers, /function sincronizarMaosDoCombate\(maosAntes\)/);
    assert.match(helpers, /if \(mudou\) renderHandsFromState\(\);/);
    assert.match(helpers, /function anunciarBuscaDoTlantidu\(destruidas, maosAntes\)/);
    assert.match(helpers, /instancia\?\.definitionId !== 'card_038'/);
    assert.match(helpers, /'Tlantidu: não havia monstro aquático no deck\.'/);
    // Em PvP a mão alheia é contagem: identidade só para o assento local.
    assert.match(helpers, /const podeRevelar = !window\.PvpSession \|\| dono === assentoLocal\(\);/);

    const ataque = fonte.slice(fim, fonte.indexOf('function updateCardDisplay'));
    // O snapshot da mão tem de ser anterior ao combate, senão não há como saber o
    // que o motor colocou na mão.
    assert.match(ataque, /const maosAntes = instantaneoDasMaos\(\);\s*const result = window\.gameEngine\.resolveCombat\(/);
    assert.match(ataque, /sincronizarMaosDoCombate\(maosAntes\);\s*anunciarBuscaDoTlantidu\(result\.defeated, maosAntes\);/);
});

test('o lobby PvP tem o modal de regras do jogo (o mesmo do index.html)', () => {
    const lobby = fs.readFileSync(path.join(__dirname, '../../pvp-lobby.html'), 'utf8');
    const index = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');

    // Botão, modal e os dois caminhos de abrir/fechar declarados no lobby.
    assert.match(lobby, /<button id="rules-button" class="secondary" onclick="showRulesModal\(\)">Regras do Jogo<\/button>/);
    assert.match(lobby, /<div id="rules-modal" class="modal-overlay">/);
    assert.match(lobby, /<span class="modal-close" onclick="closeRulesModal\(\)">&times;<\/span>/);
    assert.match(lobby, /function showRulesModal\(\) \{\s*document\.getElementById\('rules-modal'\)\.classList\.add\('visible'\);/);
    assert.match(lobby, /function closeRulesModal\(\) \{\s*document\.getElementById\('rules-modal'\)\.classList\.remove\('visible'\);/);
    // Além do ×: o fundo escuro e o Esc fecham (o index só tem o ×).
    assert.match(lobby, /if \(evento\.target === modalDeRegras\) closeRulesModal\(\);/);
    assert.match(lobby, /if \(evento\.key === 'Escape'\) closeRulesModal\(\);/);

    // Conteúdo idêntico ao do index.html: um teste de consistência das regras.
    const titulos = html => [...html.matchAll(/<h3>(.*?)<\/h3>/g)].map(m => m[1]);
    const paragrafos = html => [...html.matchAll(/<p>(.*?)<\/p>/g)].map(m => m[1]);
    assert.deepEqual(titulos(lobby), titulos(index), 'seções das regras divergem do index.html');
    assert.deepEqual(paragrafos(lobby), paragrafos(index), 'parágrafos das regras divergem do index.html');
    assert.ok(titulos(lobby).length === 5, 'o lobby deve trazer as 5 seções de regras');

    // CSS do modal no lobby: mesma linguagem (overlay fixo, conteúdo rolável).
    const overlay = lobby.slice(lobby.indexOf('.modal-overlay {'), lobby.indexOf('.modal-overlay.visible'));
    assert.match(overlay, /position: fixed;/);
    assert.match(overlay, /visibility: hidden;/);
    assert.match(lobby, /\.modal-overlay\.visible \{ visibility: visible; opacity: 1; \}/);
    assert.match(lobby, /\.modal-content \{[\s\S]*?max-height: 80vh;[\s\S]*?overflow-y: auto;/);
    assert.match(lobby, /\.rules-text h3 \{[\s\S]*?border-bottom: 2px solid var\(--secondary-color\);/);
});

test('os ícones de face do dado existem e o botão usa o do valor sorteado', () => {
    const raiz = path.join(__dirname, '../..');
    const css = readSourceText('src/css/game.css');
    // O seletor aparece também em `.stat-energy .dice-button`: a âncora é a regra
    // base, no começo da linha.
    const botao = (/\n\s*\.dice-button \{\n([\s\S]*?)\}/.exec(css) || [])[1] || '';

    for (let face = 1; face <= 6; face += 1) {
        assert.ok(
            fs.existsSync(path.join(raiz, `assets/dice/dice-${face}.svg`)),
            `ícone assets/dice/dice-${face}.svg ausente`
        );
        const regra = `.dice-button.dice-face-${face} { background-image: url('../../assets/dice/dice-${face}.svg'); }`;
        assert.ok(css.includes(regra), `regra do ícone ${face} ausente em game.css`);
    }

    // O botão é discreto no repouso (o dourado cheio chamava atenção ao lado da
    // energia) e ganha o dourado no hover, herdado do `.mini-button`.
    assert.match(botao, /background-color: var\(--secondary-color\);/);
    assert.match(botao, /border: 2px solid var\(--primary-color\);/);
    assert.match(botao, /background-size: 84%;/);

    // Já jogado: a aparência do estado desativado é do CSS (o JS só liga o
    // `disabled`) — sem anel dourado, bem apagado e sem hover de botão ativo.
    const desabilitado = css.slice(css.indexOf('.dice-button:disabled {'), css.indexOf('}', css.indexOf('.dice-button:disabled {')));
    assert.match(desabilitado, /background-color: var\(--field-color\);/);
    assert.match(desabilitado, /border-color: var\(--secondary-color\);/);
    assert.match(desabilitado, /filter: grayscale\(1\) brightness\(0\.7\);/);
    assert.match(desabilitado, /opacity: 0\.35;/);
    assert.match(desabilitado, /cursor: not-allowed;/);
    assert.doesNotMatch(desabilitado, /--primary-color/);

    // O `:hover` cru deixava o dado usado dourado e maior, parecendo disponível.
    assert.match(css, /\.mini-button:not\(:disabled\):hover \{/);
    assert.doesNotMatch(css, /\n\s*\.mini-button:hover \{/);
    assert.match(css, /\.dice-button:disabled:hover \{\s*background-color: var\(--field-color\);\s*transform: none;/);
});

test('rollDice mostra a face sorteada sem overlay e o reset devolve o dado', () => {
    const fonte = fs.readFileSync(path.join(__dirname, '../../src/js/game.js'), 'utf8');
    const inicio = fonte.indexOf('const DICE_FACES');
    assert.notEqual(inicio, -1, 'const DICE_FACES não encontrada');

    // Face pelo ícone: `dice-face-N` + `data-face` (o "+N" flutuante é filho do
    // botão, então `textContent` leria "5+5").
    const faces = fonte.slice(inicio, fonte.indexOf('function animarResultadoDoDado'));
    assert.match(faces, /diceButton\.classList\.add\(`dice-face-\$\{valor\}`\);/);
    assert.match(faces, /diceButton\.dataset\.face = String\(valor\);/);
    assert.match(faces, /diceButton\.textContent = '🎲';/);
    // O giro das faces é por botão (WeakMap): os dois lados podem rolar em PvP.
    assert.match(faces, /const timer = setInterval\(sortearFace, 90\);/);
    assert.match(faces, /sortearFace\(\);/);
    assert.match(faces, /clearInterval\(timer\);/);
    assert.match(faces, /const girosDeFace = new WeakMap\(\);/);

    const animacao = fonte.slice(fonte.indexOf('function animarResultadoDoDado'), fonte.indexOf('function rollDice'));
    assert.match(animacao, /energyElement\.classList\.add\('energy-gain-dice'\);/);
    assert.match(animacao, /flutuante\.className = 'dice-result-floating';/);
    assert.match(animacao, /diceButton\.appendChild\(flutuante\);/);

    const roll = fonte.slice(fonte.indexOf('function rollDice', inicio), fonte.indexOf('function playSound'));
    assert.match(roll, /diceButton\.classList\.add\('dice-rolling'\);/);
    assert.match(roll, /iniciarGiroDeFaces\(diceButton\);/);
    assert.match(roll, /pararGiroDeFaces\(diceButton\);\s*diceButton\.classList\.remove\('dice-rolling'\);\s*diceButton\.classList\.add\('dice-settled'\);\s*marcarDadoComoUsado\(diceButton, player, diceResult\);/);
    assert.match(roll, /animarResultadoDoDado\(diceButton, player, diceResult\);/);
    // O estado "já jogado" é o `:disabled`: a classe do quique sai depois.
    assert.match(roll, /setTimeout\(\(\) => diceButton\.classList\.remove\('dice-settled'\), 500\);/);
    // Resultado local de uma partida reiniciada no meio do giro não aplica.
    assert.match(roll, /const generation = window\.matchGeneration;/);
    assert.match(roll, /if \(generation !== window\.matchGeneration\) return;/);
    // O feedback saiu do centro da tela para o próprio dado.
    assert.doesNotMatch(roll, /showMessage\(`🎲 Dado da Sorte/);

    // O visual do "já jogado" é idempotente e dirigido pelo estado: replay/F5 que
    // reaplicam o mesmo ROLL_DICE repintam a face e o `disabled` sem pagar de novo.
    const usado = fonte.slice(fonte.indexOf('function marcarDadoComoUsado'), fonte.indexOf('function animarResultadoDoDado'));
    assert.match(usado, /diceButton\.dataset\.diceRolled = '1';/);
    assert.match(usado, /diceButton\.disabled = true;/);
    assert.match(usado, /gameState\.diceUsed\[player\] = true;/);
    assert.match(usado, /if \(face !== null\) marcarFaceDoDado\(diceButton, face\);/);
    assert.match(roll, /if \(forcedValue !== null\) \{\s*marcarDadoComoUsado\(diceButton, player, Number\(forcedValue\)\);/);
    // A checagem de "já usado" é a primeira coisa depois da guarda de PvP: sem o
    // botão no DOM o resto do corpo não pode nem começar.
    assert.match(roll, /const diceButton = document\.getElementById\(`dice-\$\{player\}`\);\s*if \(!diceButton\) return;/);

    // Reset de partida: face, classes e os guards (o `dataset.diceRolled` e o
    // giro de faces sobreviviam ao reset). `resetGame` e o remount do PvP
    // (`montarPartida`) passam pelo mesmo `resetDiceUI`.
    const resetDice = fonte.slice(fonte.indexOf('function resetDiceUI'), fonte.indexOf('function animarResultadoDoDado'));
    assert.match(resetDice, /pararGiroDeFaces\(diceButton\);/);
    assert.match(resetDice, /delete diceButton\.dataset\.diceRolled;/);
    assert.match(resetDice, /diceButton\.classList\.remove\('dice-rolling', 'dice-settled'\);/);
    assert.match(resetDice, /limparFaceDoDado\(diceButton\);/);
    assert.match(resetDice, /diceButton\.disabled = false;/);
    assert.match(fonte, /window\.resetDiceUI = resetDiceUI;/);

    const reset = fonte.slice(fonte.indexOf('function resetGame'), fonte.indexOf('function renderHandsFromState'));
    assert.match(reset, /resetDiceUI\(\);/);
});

test('o bloqueio por turno do PvP não reabilita o dado já usado', () => {
    const pvp = fs.readFileSync(path.join(__dirname, '../../src/js/pvp-game.js'), 'utf8');
    const bloqueio = pvp.slice(pvp.indexOf('function atualizarBloqueioPorTurno'), pvp.indexOf('function mulberrySala'));

    // O `disabled` blanket não pode mais passar pelo dado: ele reacendia o dado
    // já jogado quando o turno voltava ao dono (o clique só mostrava o aviso).
    assert.doesNotMatch(bloqueio, /querySelectorAll\('\.phase-button, \.dice-button, \.action-button'\)/);
    assert.match(bloqueio, /document\.querySelectorAll\('\.phase-button, \.action-button'\)/);
    // O dado é decidido por assento + `diceUsed` do estado (a mesma verdade das
    // duas telas): oponente nunca clicável, "já usado" nunca reabilitado.
    assert.match(bloqueio, /const dono = botao\.id\.replace\('dice-', ''\);/);
    assert.match(bloqueio, /const usado = Boolean\(state\.diceUsed && state\.diceUsed\[dono\]\);/);
    assert.match(bloqueio, /botao\.disabled = usado \|\| !interagindo \|\| dono !== seatLocal;/);

    // Remount (MATCH_START repetido/F5) devolve o dado ao estado de partida nova
    // antes do replay do ledger: a face/`dataset.diceRolled` antigos engoliam o
    // ROLL_DICE e a energia divergia entre as telas.
    const montar = pvp.slice(pvp.indexOf('function montarPartida'), pvp.indexOf('function gerarDeckLocal'));
    assert.match(montar, /window\.resetDiceUI\?\.\(\);/);
    assert.ok(
        montar.indexOf('window.resetDiceUI?.();') < montar.indexOf('window.GameStateModel.resetMatchState'),
        'o reset do dado deve vir antes do reset canônico do estado'
    );
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
    // Stats zerados de propósito: o foco aqui é o limite/penalidade de ataque,
    // não a soma de ATK/DEF do catálogo (testada em "suportes somam ...").
    const equipment = GameStateModel.createCardInstance({
        id: definitionId,
        name: definitionId,
        type: 'suporte',
        cost: 1,
        attack: 0,
        defense: 0
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
    fixture.state.turn = 2; // Beluga requer turno >= 2 para ataque direto
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
    fixture.state.turn = 2; // Beluga requer turno >= 2 para ataque direto
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

test('Baltz descarta suporte do campo além do equipamento', () => {
    const state = GameStateModel.createInitialGameState();
    const engine = GameEngine.createEngine(state);
    CardRules.install(engine);
    const baltz = addFieldCreature(state, 'p1', 'card_016', 'baltz_campo', { cost: 3 });
    const equipado = GameStateModel.createCardInstance({
        id: 'suporte', name: 'Suporte', type: 'suporte', cost: 1, attack: 0, defense: 0
    }, 'p2', { instanceId: 'baltz_equip' });
    GameStateModel.registerCard(state, equipado, 'equipment', 'p2');
    const emCampo = GameStateModel.createCardInstance({
        id: 'suporte', name: 'Suporte', type: 'suporte', cost: 1, attack: 0, defense: 0
    }, 'p2', { instanceId: 'baltz_campo_sup' });
    GameStateModel.registerCard(state, emCampo, 'field', 'p2');
    state.currentPhase = 'combat';
    const result = CardRules.activateAbility(engine, baltz.instanceId);
    assert.equal(result.status, 'resolved');
    assert.equal(equipado.zone, 'discard');
    assert.equal(emCampo.zone, 'discard');
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

test('Tlantidu sorteia entre as aquáticas em vez do primeiro do deck', () => {
    const montar = (valor) => {
        const fixture = createCombatFixture({ attackerAttack: 30, targetDefense: 5, targetAttack: 0 });
        fixture.state.rng = () => valor;
        fixture.target.definitionId = 'card_038';
        CardRules.install(fixture.engine);
        ['a1', 'a2'].forEach((suffix, i) => {
            const aquatica = GameStateModel.createCardInstance({
                id: 'card_083', name: 'Hidra', type: 'criatura', cost: 12, attack: 59, defense: 59
            }, 'p2', { instanceId: `tlantidu_aqua_${suffix}_${i}` });
            aquatica.data.traits = ['aquatico', 'elite'];
            GameStateModel.registerCard(fixture.state, aquatica, 'deck', 'p2');
        });
        return fixture;
    };
    const primeira = montar(0);
    primeira.engine.resolveCombat({ attackerId: primeira.attacker.instanceId, targetId: primeira.target.instanceId });
    const maoPrimeira = primeira.state.players.p2.zones.hand.map(c => c.instanceId);
    assert.ok(maoPrimeira.includes('tlantidu_aqua_a1_0'));
    const ultima = montar(0.9999);
    ultima.engine.resolveCombat({ attackerId: ultima.attacker.instanceId, targetId: ultima.target.instanceId });
    const maoUltima = ultima.state.players.p2.zones.hand.map(c => c.instanceId);
    assert.ok(maoUltima.includes('tlantidu_aqua_a2_1'));
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
    // card_090 saiu daqui: a Bilugação Astral ganhou regra de equipamento.
    ['card_006', 'card_007', 'card_008'].forEach(definitionId => {
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
    const uiEngine = fakeWindow.gameEngine;

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
    assert.equal(uiEngine.getEffectiveStat(dragon.instanceId, 'attack'), 30, 'ATK 25 + 5 do Cajado');
    assert.equal(uiEngine.getEffectiveStat(dragon.instanceId, 'defense'), 35, 'DEF 30 + 5 do Cajado');
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

test('timers de fim de turno, de vitória e do dado respeitam a geração da partida', () => {
    const interfaceSource = fs.readFileSync(path.join(__dirname, '../../src/js/game.js'), 'utf8');
    const generationGuards = interfaceSource.match(/generation !== window\.matchGeneration/g) || [];
    // endGame (fim de turno/vitória), a compra do deck, o resultado do dado da
    // sorte, o relógio de turno e o retorno à mão do Fantom — um timer pendente
    // nunca pode cair na partida seguinte.
    assert.equal(generationGuards.length, 5);
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
    assert.throws(() => PvpProtocol.normalizeCommand(raw), /Ator inválido/);
});

test('normalizeCommand rejeita SUMMON sem handSlot', () => {
    const raw = { cmd: 'SUMMON', actor: 'p1', args: {} };
    assert.throws(() => PvpProtocol.normalizeCommand(raw), /Args ausente para SUMMON/);
});

test('normalizeCommand rejeita SET_PHASE fase inválida', () => {
    const raw = { cmd: 'SET_PHASE', actor: 'p1', args: { phase: 'xyz' } };
    assert.throws(() => PvpProtocol.normalizeCommand(raw), /SET_PHASE: fase inválida/);
});

test('normalizeCommand rejeita reveals malformado', () => {
    const raw = { cmd: 'DRAW', actor: 'p1', reveals: [{ bad: true }] };
    assert.throws(() => PvpProtocol.normalizeCommand(raw), /reveal inválido/);
});

test('normalizeCommand exige reveal para a carta oculta que sai da mão', () => {
    // SUMMON referencia o slot oculto da mão: sem reveal, a identidade não viaja.
    assert.throws(
        () => PvpProtocol.normalizeCommand({ cmd: 'SUMMON', actor: 'p1', args: { handSlot: 2 } }),
        /Reveals ausente/
    );
    assert.throws(
        () => PvpProtocol.normalizeCommand({
            cmd: 'EQUIP',
            actor: 'p1',
            args: { cardId: 'i_p1_abc', creatureId: 'i_p1_def' }
        }),
        /Reveals ausente para EQUIP/
    );

    const reveal = {
        instanceId: 'i_p1_abc',
        definitionId: 'card_001',
        ownerId: 'p1',
        fromZone: 'hand',
        slot: 2
    };
    const norm = PvpProtocol.normalizeCommand({
        cmd: 'SUMMON',
        actor: 'p1',
        args: { handSlot: 2 },
        reveals: [reveal]
    });
    assert.strictEqual(norm.reveals.length, 1);
    assert.strictEqual(norm.reveals[0].slot, 2);
});

test('normalizeCommand recusa reveal em posição que já tem identidade', () => {
    const state = GameStateModel.createInitialGameState();
    state.players.p2.zones.hand = [{ instanceId: 'real_1', definitionId: 'card_007' }];
    assert.throws(
        () => PvpProtocol.normalizeCommand({
            cmd: 'SUMMON',
            actor: 'p2',
            args: { handSlot: 0 },
            reveals: [{
                instanceId: 'i_p2_zzz',
                definitionId: 'card_001',
                ownerId: 'p2',
                fromZone: 'hand',
                slot: 0
            }]
        }, state),
        /posição já revelada/
    );
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

// Tests for PvP state and session
const PvpState = require('../../src/js/pvp-state.js');
const { PvpSession } = require('../../src/js/pvp-session.js');

// 1. createHiddenInstance returns placeholder with null definitionId
test('createHiddenInstance returns placeholder with correct instanceId and null definitionId', () => {
    const placeholder = PvpState.createHiddenInstance('p1', 3);
    assert.strictEqual(placeholder.instanceId, 'hidden_p1_3');
    assert.strictEqual(placeholder.definitionId, null);
    assert.strictEqual(placeholder.ownerId, 'p1');
});

// 2. createHiddenZone creates correct number of placeholders
test('createHiddenZone creates correct number of placeholders', () => {
    const zone = PvpState.createHiddenZone('p2', 'hand', 5);
    assert.strictEqual(zone.length, 5);
    assert.strictEqual(zone[0].instanceId, 'hidden_p2_0');
    assert.strictEqual(zone[4].instanceId, 'hidden_p2_4');
});

// 3. createHiddenSlots identifies hidden slots in opponent zones
test('createHiddenSlots identifies hidden slots', () => {
    const state = GameStateModel.createInitialGameState();
    // Replace opponent zones with placeholders
    const placeholderZone = PvpState.createHiddenZone('p2', 'hand', 2);
    state.players.p2.zones.hand = placeholderZone;
    const hidden = PvpState.createHiddenSlots(state, 'p2');
    assert.strictEqual(hidden.hand.length, 2);
    assert.strictEqual(hidden.hand[0], 0);
});

// 3b. placeholders nunca carregam identidade (auditoria de sigilo)
test('placeholder não expõe definitionId nem data', () => {
    const placeholder = PvpState.createHiddenInstance('p2', 0);
    assert.strictEqual(placeholder.definitionId, null);
    assert.strictEqual(placeholder.data, null);
    assert.strictEqual(PvpState.isHiddenInstance(placeholder), true);
    assert.strictEqual(PvpState.isHiddenInstance({ instanceId: 'i_p1_x', definitionId: 'card_001' }), false);
});

// 4. createPvpIdFactory: ids opacos, determinísticos e únicos
test('createPvpIdFactory produces deterministic ids', () => {
    const factory = PvpState.createPvpIdFactory(12345);
    const definition = { id: 'card_001' };
    const id1 = factory(definition, 'p1');
    const id2 = factory(definition, 'p2');

    assert.ok(id1.startsWith('i_p1_'));
    assert.ok(id2.startsWith('i_p2_'));
    assert.notStrictEqual(id1, id2);

    // Sem a definição nem a posição no deck dentro do id.
    assert.strictEqual(id1.includes('card_001'), false);
    assert.strictEqual(id1.includes('hidden'), false);

    // Mesma seed + mesma ordem de chamadas => mesmos ids (dois clientes batem).
    const factory2 = PvpState.createPvpIdFactory(12345);
    assert.strictEqual(factory2(definition, 'p1'), id1);
    assert.strictEqual(factory2(definition, 'p2'), id2);

    // Unicidade em todo o deck (o modelo lança em id duplicado).
    const ids = new Set();
    const factory3 = PvpState.createPvpIdFactory(999);
    for (let i = 0; i < 80; i += 1) {
        ids.add(factory3({ id: `card_${i}` }, 'p1'));
    }
    assert.strictEqual(ids.size, 80);
});

// 5. installHiddenZones: contagem correta e aliases legados coerentes
test('installHiddenZones mantém contagem, aliases e cardInstances', () => {
    const state = GameStateModel.createInitialGameState();
    PvpState.installHiddenZones(state, 'p2', { deck: 35, hand: 5, field: 1 });

    assert.strictEqual(state.players.p2.zones.deck.length, 35);
    assert.strictEqual(state.players.p2.zones.hand.length, 5);
    assert.strictEqual(state.cards.p2.hand.length, 5, 'alias legado aponta para a zona oculta');
    assert.strictEqual(state.decks.p2.length, 35);

    const placeholder = state.players.p2.zones.deck[0];
    assert.strictEqual(state.cardInstances[placeholder.instanceId], placeholder);
    assert.strictEqual(placeholder.definitionId, null);

    // Ids únicos entre zonas: o mesmo id em duas zonas quebraria o moveCard.
    const idsOcultos = Object.values(state.players.p2.zones)
        .flat()
        .map(carta => carta.instanceId);
    assert.strictEqual(new Set(idsOcultos).size, idsOcultos.length);
    assert.strictEqual(
        GameStateModel.findCardLocations(state, placeholder.instanceId).length,
        1
    );

    // A zona oculta continua movível pelo modelo (deck -> mão).
    const comprada = GameStateModel.drawCard(state, 'p2');
    assert.strictEqual(comprada.instanceId, placeholder.instanceId);
    assert.strictEqual(state.players.p2.zones.hand.length, 6);
});

// 6. revealInstance replaces placeholder correctly and is idempotent
test('revealInstance replaces placeholder correctly', () => {
    const state = GameStateModel.createInitialGameState();
    const placeholderZone = PvpState.createHiddenZone('p1', 'hand', 1);
    state.players.p1.zones.hand = placeholderZone;
    state.cardInstances[placeholderZone[0].instanceId] = placeholderZone[0];
    const reveal = {
        instanceId: 'inst_1',
        definitionId: 'card_001',
        ownerId: 'p1',
        fromZone: 'hand',
        slot: 0,
    };
    const real = PvpState.revealInstance(state, reveal, {
        resolveDefinition: id => ({ id, name: 'Definição de teste', type: 'criatura' })
    });
    assert.strictEqual(state.players.p1.zones.hand[0].instanceId, 'inst_1');
    assert.strictEqual(state.cardInstances['inst_1'].definitionId, 'card_001');
    assert.strictEqual(state.cardInstances[real.instanceId].data.name, 'Definição de teste');
    assert.strictEqual(state.cardInstances['hidden_p1_0'], undefined, 'placeholder sai do índice');
    // A posição continua sendo exatamente uma (o moveCard exige).
    assert.strictEqual(GameStateModel.findCardLocations(state, 'inst_1').length, 1);
    // Idempotente
    const real2 = PvpState.revealInstance(state, reveal);
    assert.strictEqual(real, real2);
});

// 7. pvp-session: ordenação por seq, gap pede COMMAND_LOG, duplicada é ignorada
test('replay duplicado de COMMAND_LOG não compra duas vezes', () => {
    const PvpSession = require('../../src/js/pvp-session.js').PvpSession;
    const aplicados = [];
    const sessao = new PvpSession({
        transportSend: () => {},
        applyCommand: (entry) => aplicados.push(entry.seq),
        onEvent: () => {}
    });
    const log = [
        { seq: 1, cmd: 'DRAW', actor: 'p1', args: { player: 'p1' }, reveals: [] },
        { seq: 2, cmd: 'DRAW', actor: 'p2', args: { player: 'p2' }, reveals: [] }
    ];
    sessao.handleCommandLog(log);
    sessao.handleCommandLog(log);
    assert.deepEqual(aplicados, [1, 2]);
});

test('pvp-session handles command order and seq gaps', () => {
    const state = GameStateModel.createInitialGameState();
    const sent = [];
    const aplicados = [];
    const session = new PvpSession({
        transportSend: cmd => sent.push(cmd),
        gameState: state,
        seat: 'p1',
        applyCommand: entry => aplicados.push(entry.seq),
    });

    // Chegou fora de ordem (seq 2 antes da 1): pede o log, não aplica.
    session.handleMessage({ type: 'COMMAND', seq: 2, cmd: 'DRAW', actor: 'p1', args: {}, reveals: [] });
    assert.ok(sent.some(c => c.type === 'COMMAND_LOG_REQUEST'), 'gap pede COMMAND_LOG');
    assert.deepStrictEqual(aplicados, []);

    // Agora na ordem: aplica e a próxima esperada é a 2.
    session.handleMessage({ type: 'COMMAND', seq: 1, cmd: 'DRAW', actor: 'p1', args: {}, reveals: [] });
    assert.deepStrictEqual(aplicados, [1]);
    assert.strictEqual(session.nextSeq, 2);

    // Reenvio da seq 1 (duplicada) não aplica de novo.
    session.handleMessage({ type: 'COMMAND', seq: 1, cmd: 'DRAW', actor: 'p1', args: {}, reveals: [] });
    assert.deepStrictEqual(aplicados, [1]);
});

// 8. pvp-session: intercept envia o comando e libera a aplicação remota
test('pvp-session intercept envia comando e libera a aplicação remota', () => {
    const state = GameStateModel.createInitialGameState();
    const sent = [];
    const session = new PvpSession({
        transportSend: cmd => sent.push(cmd),
        gameState: state,
        seat: 'p1',
        applyCommand: entry => {
            assert.strictEqual(session.isApplying(), true, 'aplicação remota é sinalizada');
            assert.strictEqual(session.intercept({ cmd: 'END_TURN', args: {} }), false,
                'handler local roda durante a aplicação remota (não reenvia)');
            assert.strictEqual(entry.seq, 1);
        },
    });

    assert.strictEqual(session.intercept({ cmd: 'END_TURN', args: {} }), true);
    assert.strictEqual(sent.length, 1);
    assert.strictEqual(sent[0].type, 'COMMAND');
    assert.strictEqual(sent[0].actor, 'p1', 'o ator é o assento local');

    session.handleMessage({ type: 'COMMAND', seq: 1, cmd: 'END_TURN', actor: 'p1', args: {}, reveals: [] });
    assert.strictEqual(session.isApplying(), false);
});

// 9. pvp-session does not mutate state on REJECTED
test('pvp-session does not mutate state on REJECTED', () => {
    const state = GameStateModel.createInitialGameState();
    const eventos = [];
    const session = new PvpSession({
        transportSend: () => {},
        gameState: state,
        seat: 'p1',
        onEvent: evento => eventos.push(evento),
    });
    const prevPV = state.players.p1.pv;
    session.handleMessage({ type: 'REJECTED', reason: 'teste' });
    assert.strictEqual(state.players.p1.pv, prevPV);
    assert.strictEqual(eventos[0].type, 'REJECTED');
});

// 10. pvp-session alimenta o dado a partir do DICE_RESULT
test('pvp-session alimenta o dado com DICE_RESULT', () => {
    const state = GameStateModel.createInitialGameState();
    const recebidos = [];
    const session = new PvpSession({
        transportSend: () => {},
        gameState: state,
        seat: 'p2',
        applyCommand: entry => {
            recebidos.push(entry);
            state.diceUsed[entry.actor] = true;
        },
    });
    session.handleMessage({ type: 'DICE_RESULT', seq: 1, actor: 'p2', value: 4 });
    assert.strictEqual(state.diceUsed.p2, true);
    assert.deepStrictEqual(recebidos[0].args, { value: 4 });
    assert.strictEqual(session.nextSeq, 2);
});

// 11. pvp-session replay: log em ordem, dedupe e hash convergente
test('pvp-session replay produces same stateHash', () => {
    const estadoA = GameStateModel.createInitialGameState();
    const estadoB = GameStateModel.createInitialGameState();
    let compras = 0;
    const aplicar = (estado) => (entry) => {
        if (entry.cmd === 'DRAW') {
            compras += 1;
            GameStateModel.changePlayerStat(estado, 'pv', entry.actor, -1);
        }
        if (entry.cmd === 'SET_PHASE') {
            estado.currentPhase = entry.args.phase;
        }
    };

    const log = [
        { seq: 1, cmd: 'DRAW', actor: 'p1', args: {}, reveals: [] },
        { seq: 2, cmd: 'SET_PHASE', actor: 'p1', args: { phase: 'combat' }, reveals: [] },
    ];

    const sessaoA = new PvpSession({
        transportSend: () => {}, gameState: estadoA, seat: 'p1', applyCommand: aplicar(estadoA)
    });
    sessaoA.handleMessage({ type: 'COMMAND_LOG', log });

    const sessaoB = new PvpSession({
        transportSend: () => {}, gameState: estadoB, seat: 'p1', applyCommand: aplicar(estadoB)
    });
    // Duplicata no meio do caminho: o replay não pode aplicar duas vezes.
    sessaoB.handleMessage({ type: 'COMMAND', seq: 1, cmd: 'DRAW', actor: 'p1', args: {}, reveals: [] });
    sessaoB.handleMessage({ type: 'COMMAND', seq: 1, cmd: 'DRAW', actor: 'p1', args: {}, reveals: [] });
    sessaoB.handleMessage({ type: 'COMMAND_LOG', log });

    assert.strictEqual(compras, 2, 'uma compra por cliente após o replay');
    assert.strictEqual(
        PvpProtocol.stateHash(estadoA),
        PvpProtocol.stateHash(estadoB),
        'os dois replays convergem'
    );
    assert.strictEqual(sessaoA.nextSeq, 3);
});

// 12. pvp-session: hash divergente pede o log de novo
test('pvp-session pede replay quando o hash do servidor diverge', () => {
    const state = GameStateModel.createInitialGameState();
    const sent = [];
    const eventos = [];
    const session = new PvpSession({
        transportSend: msg => sent.push(msg),
        gameState: state,
        seat: 'p1',
        onEvent: evento => eventos.push(evento),
    });

    session.handleMessage({ type: 'STATE_HASH', seq: 1, actor: 'p1', hash: 123456 });
    assert.ok(eventos.some(e => e.type === 'DIVERGENCE'));
    assert.ok(sent.some(m => m.type === 'COMMAND_LOG_REQUEST'));

    // O hash correto do próprio estado não dispara replay.
    const enviosAntes = sent.length;
    session.handleMessage({
        type: 'STATE_HASH',
        seq: 2,
        actor: 'p1',
        hash: PvpProtocol.stateHash(state)
    });
    assert.strictEqual(sent.length, enviosAntes);
});

// ── ponte de UI PvP (game.js + pvp-game.js), sem DOM ─────────────────────

/**
 * `pvp-game.js` referencia `window` no load e os seus helpers de UI tocam o DOM:
 * nos testes headless o global do Node faz o papel de `window` (window ===
 * globalThis) e um stub mínimo cobre `document`/`location`.
 */
function carregarPontePvp() {
    global.window = globalThis;
    if (typeof global.document === 'undefined') {
        // `pathname` fora de `/pvp/<sala>/<assento>`: o auto-bootstrap do board
        // online não dispara e o teste dirige o ledger comando a comando.
        global.location = { pathname: '/game.html' };
        global.document = {
            body: { dataset: {} },
            querySelectorAll: () => [],
            querySelector: () => null,
            getElementById: () => null,
            addEventListener: () => {}
        };
    }
    require('../../src/js/pvp-protocol.js');
    require('../../src/js/pvp-state.js');
    return require('../../src/js/pvp-game.js');
}

// 13. pvp-game: a compra do ledger é decidida pelo assento e pelo dedupe
test('pvp-game decide a compra por assento e ignora seq já aplicada', () => {
    const PvpGame = carregarPontePvp();
    const compra = { seq: 7, cmd: 'DRAW', actor: 'p2', args: { player: 'p2' }, reveals: [] };

    assert.strictEqual(PvpGame.decidirCompra(compra, { seat: 'p2' }), 'mao-local');
    assert.strictEqual(PvpGame.decidirCompra(compra, { seat: 'p1' }), 'contagem-oponente');
    // Replay/F5: a seq já está no log da sessão, então não compra de novo...
    assert.strictEqual(
        PvpGame.decidirCompra(compra, { seat: 'p2', commandLog: [{ seq: 7, cmd: 'DRAW' }] }),
        'ignorar'
    );
    // ...mas uma seq nova compra normalmente.
    assert.strictEqual(
        PvpGame.decidirCompra(compra, { seat: 'p2', commandLog: [{ seq: 6, cmd: 'DRAW' }] }),
        'mao-local'
    );
});

// 14. rodada completa: só os DRAW do ledger mudam a mão (e o replay não infla)
test('rodada completa em PvP: só os DRAW do ledger mudam a mão', () => {
    const PvpGame = carregarPontePvp();
    const PvpSession = require('../../src/js/pvp-session.js').PvpSession;
    const indice = player => (player === 'p1' ? 0 : 1);

    // Espelha a ponte de UI: o assento local compra por `addCardToHand` (que no
    // browser chama `drawCardFromDeck`); a mão alheia só avança a contagem.
    const montarPartidaDeTeste = () => {
        const state = GameStateModel.createInitialGameState();
        GameStateModel.resetMatchState(state, {
            p1: Array.from({ length: 8 }, () => ({ ...repeatedDefinition })),
            p2: Array.from({ length: 8 }, () => ({ ...repeatedDefinition }))
        }, { idFactory: createIdFactory() });

        const comprasLocais = [];
        window.gameState = state;
        window.GameStateModel = GameStateModel;
        window.renderHandsFromState = () => {};
        window.addCardToHand = player => {
            comprasLocais.push(player);
            GameStateModel.drawCard(state, player);
        };
        window.setPhase = phase => { state.currentPhase = phase; };
        window.endTurn = () => {
            state.currentPlayer = state.currentPlayer === 'p1' ? 'p2' : 'p1';
            state.currentPhase = 'energy';
        };

        return {
            state,
            comprasLocais,
            maos: () => [
                state.players.p1.zones.hand.length,
                state.players.p2.zones.hand.length
            ]
        };
    };

    PvpGame.setSeat('p2');

    const rodada = [
        { seq: 1, cmd: 'ROLL_DICE', actor: 'p1', args: { value: 3 }, reveals: [] },
        { seq: 2, cmd: 'SET_PHASE', actor: 'p1', args: { phase: 'invocation' }, reveals: [] },
        { seq: 3, cmd: 'END_TURN', actor: 'p1', args: {}, reveals: [] },
        // O assento que abre o turno envia o próprio DRAW; o servidor replica.
        { seq: 4, cmd: 'DRAW', actor: 'p2', args: { player: 'p2' }, reveals: [] },
        { seq: 5, cmd: 'SET_PHASE', actor: 'p2', args: { phase: 'invocation' }, reveals: [] },
        { seq: 6, cmd: 'END_TURN', actor: 'p2', args: {}, reveals: [] },
        { seq: 7, cmd: 'DRAW', actor: 'p1', args: { player: 'p1' }, reveals: [] },
        { seq: 8, cmd: 'SET_PHASE', actor: 'p1', args: { phase: 'invocation' }, reveals: [] }
    ];

    const aoVivo = montarPartidaDeTeste();
    rodada.forEach(entry => {
        const antes = aoVivo.maos();
        PvpGame.applyCommand(entry);
        if (entry.cmd === 'DRAW') {
            const esperado = antes.slice();
            esperado[indice(entry.actor)] += 1;
            assert.deepStrictEqual(aoVivo.maos(), esperado, `DRAW ${entry.seq} compra só para ${entry.actor}`);
        } else {
            assert.deepStrictEqual(aoVivo.maos(), antes, `${entry.cmd} ${entry.seq} não mexe na mão`);
        }
    });
    assert.deepStrictEqual(aoVivo.maos(), [1, 1], 'um DRAW por assento na rodada');
    assert.deepStrictEqual(aoVivo.comprasLocais, ['p2'], 'só o assento local rende a mão');

    // F5/reconexão: o estado é remontado e o `COMMAND_LOG` inteiro chega de novo
    // (duas vezes). Nenhum DRAW pode comprar duas vezes.
    const replay = montarPartidaDeTeste();
    const sessao = new PvpSession({
        transportSend: () => {},
        gameState: replay.state,
        seat: 'p2',
        applyCommand: entry => PvpGame.applyCommand(entry)
    });
    sessao.handleMessage({ type: 'COMMAND_LOG', log: rodada });
    sessao.handleMessage({ type: 'COMMAND_LOG', log: rodada });
    assert.deepStrictEqual(replay.maos(), [1, 1], 'replay do log não infla a mão');
    assert.deepStrictEqual(replay.comprasLocais, ['p2'], 'replay não compra de novo');
});

// 15. game.js: nenhuma compra automática de carta com a sessão PvP ativa
test('game.js não compra carta automática com a sessão PvP ativa', () => {
    const fonte = fs.readFileSync(path.join(__dirname, '../../src/js/game.js'), 'utf8');
    const functionBody = (name, nextName) => {
        const start = fonte.indexOf(`function ${name}`);
        const end = fonte.indexOf(`function ${nextName}`, start);
        assert.notEqual(start, -1, `Função ${name} não encontrada`);
        assert.notEqual(end, -1, `Limite ${nextName} não encontrado`);
        return fonte.slice(start, end);
    };

    // `endTurn` sai antes do timer que compra e troca a fase (isso é do ledger).
    const endTurnBody = functionBody('endTurn', 'setPhase');
    const saidaPvp = endTurnBody.indexOf('if (window.PvpSession) {');
    const compraAutomatica = endTurnBody.indexOf('addCardToHand(gameState.currentPlayer);');
    assert.notEqual(saidaPvp, -1, 'endTurn precisa sair cedo no PvP');
    assert.notEqual(compraAutomatica, -1, 'o hotseat continua comprando no fim do turno');
    assert.ok(saidaPvp < compraAutomatica, 'no PvP o timer de compra não pode rodar');

    // A abertura do hotseat (mão inicial + energia do 1º turno) também não roda
    // em PvP: `MATCH_START` monta o estado e o DRAW do servidor compra.
    const bootstrap = fonte.slice(fonte.indexOf("document.addEventListener('DOMContentLoaded'"));
    const guardaAbertura = bootstrap.indexOf('if (window.PvpSession) return;');
    assert.notEqual(guardaAbertura, -1, 'a abertura local precisa sair cedo no PvP');
    assert.ok(guardaAbertura < bootstrap.indexOf('initFirstTurn();'), 'initFirstTurn não roda em PvP');
    assert.ok(guardaAbertura < bootstrap.indexOf('startNewMatch(escolhaDeDeck)'),
        'startNewMatch local não roda em PvP');
    assert.ok(guardaAbertura < bootstrap.indexOf('window.DeckSelect.abrir()'),
        'o seletor de decks (modal bloqueante) nunca abre no PvP');

    // O clique no deck é comando: em PvP quem compra é o servidor.
    const addBody = functionBody('addCardToHand', 'toggleGearMenu');
    assert.match(addBody, /if \(pvpGuard\(\{ cmd: 'DRAW', args: \{ player \} \}\)\) return;/);
});

// 16. game.html é hotseat e pvp.html carrega a camada online
test('game.html não carrega a camada PvP; pvp.html carrega', () => {
    const lerPagina = arquivo => fs.readFileSync(path.join(__dirname, '../../', arquivo), 'utf8');
    const modulosPvp = fonte => fonte.match(/src="src\/js\/pvp-[^"]+\.js"/g) || [];

    assert.deepStrictEqual(modulosPvp(lerPagina('game.html')), [],
        'game.html é hotseat e nunca define window.PvpSession');
    assert.equal(modulosPvp(lerPagina('pvp.html')).length, 4,
        'pvp.html carrega protocol/session/state/game');
});

// 17. pvp-game: o replay do log não reenvia a abertura do turno local
test('pvp-game não reenvia DRAW no replay do COMMAND_LOG', () => {
    const PvpGame = carregarPontePvp();
    const PvpSession = require('../../src/js/pvp-session.js').PvpSession;

    const state = GameStateModel.createInitialGameState();
    GameStateModel.resetMatchState(state, {
        p1: Array.from({ length: 8 }, () => ({ ...repeatedDefinition })),
        p2: Array.from({ length: 8 }, () => ({ ...repeatedDefinition }))
    }, { idFactory: createIdFactory() });

    window.gameState = state;
    window.GameStateModel = GameStateModel;
    window.renderHandsFromState = () => {};
    window.addCardToHand = player => { GameStateModel.drawCard(state, player); };
    window.setPhase = phase => { state.currentPhase = phase; };
    window.endTurn = () => {
        state.currentPlayer = state.currentPlayer === 'p1' ? 'p2' : 'p1';
        state.currentPhase = 'energy';
    };
    PvpGame.setSeat('p2');

    const enviados = [];
    const sessao = new PvpSession({
        transportSend: mensagem => enviados.push(mensagem),
        gameState: state,
        seat: 'p2',
        applyCommand: entry => PvpGame.aplicarComandoDoLedger(entry)
    });
    PvpGame.setSession(sessao);

    // F5: o `COMMAND_LOG` inteiro chega de novo com a sessão em replay.
    sessao.handleMessage({ type: 'COMMAND_LOG', log: [
        { seq: 1, cmd: 'END_TURN', actor: 'p1', args: {}, reveals: [] },
        { seq: 2, cmd: 'DRAW', actor: 'p2', args: { player: 'p2' }, reveals: [] }
    ] });
    assert.deepStrictEqual(enviados, [], 'replay não reenvia a abertura do turno');
    assert.strictEqual(sessao.isReplaying(), false, 'o flag de replay volta ao normal');
    assert.strictEqual(state.players.p2.zones.hand.length, 1, 'o DRAW do log compra uma vez');

    // Ao vivo, a virada para o assento local abre o turno com DRAW + SET_PHASE.
    sessao.handleMessage({ type: 'COMMAND', seq: 3, cmd: 'END_TURN', actor: 'p1', args: {}, reveals: [] });
    assert.deepStrictEqual(enviados, [], 'turno ainda do oponente: nada é enviado');

    sessao.handleMessage({ type: 'COMMAND', seq: 4, cmd: 'END_TURN', actor: 'p2', args: {}, reveals: [] });
    assert.deepStrictEqual(enviados.map(mensagem => mensagem.cmd), ['DRAW', 'SET_PHASE']);
});

// 18. mão cheia: a compra para no limite nos dois lados do ledger
test('limite da mão corta a compra do dono e a contagem do oponente', () => {
    const PvpGame = carregarPontePvp();

    const state = GameStateModel.createInitialGameState();
    GameStateModel.resetMatchState(state, {
        p1: Array.from({ length: 12 }, () => ({ ...repeatedDefinition })),
        p2: Array.from({ length: 12 }, () => ({ ...repeatedDefinition }))
    }, { idFactory: createIdFactory() });

    // Mão do dono: a compra do assento local passa por este mesmo `drawCard`.
    for (let i = 0; i < GameStateModel.HAND_LIMIT; i += 1) {
        assert.ok(GameStateModel.drawCard(state, 'p2'), `compra ${i + 1} de p2`);
    }
    assert.strictEqual(GameStateModel.HAND_LIMIT, 7);
    assert.ok(GameStateModel.handLimitReached(state, 'p2'), 'a mão de p2 está cheia');
    assert.strictEqual(GameStateModel.drawCard(state, 'p2'), null, 'a 8ª compra é recusada');
    assert.strictEqual(state.players.p2.zones.hand.length, GameStateModel.HAND_LIMIT);
    assert.strictEqual(state.players.p2.zones.deck.length, 12 - GameStateModel.HAND_LIMIT);
    assert.strictEqual(GameStateModel.handLimitReached(state, 'p1'), false, 'a outra mão segue livre');

    // Mão alheia (só contagem): o DRAW replicado também para no limite, senão a
    // perspectiva do oponente mostraria uma carta que o dono nunca recebeu.
    window.gameState = state;
    window.GameStateModel = GameStateModel;
    window.renderHandsFromState = () => {};
    PvpGame.setSeat('p1');
    PvpGame.setSession(null);

    PvpGame.applyCommand({ seq: 1, cmd: 'DRAW', actor: 'p2', args: { player: 'p2' }, reveals: [] });
    assert.strictEqual(state.players.p2.zones.hand.length, GameStateModel.HAND_LIMIT,
        'a compra recusada não vira verso na mão do oponente');

    // Com espaço na mão, a mesma compra continua valendo para os dois lados.
    // (Aqui p1 é a mão alheia: o assento local passou a ser p2.)
    PvpGame.setSeat('p2');
    PvpGame.applyCommand({ seq: 2, cmd: 'DRAW', actor: 'p1', args: { player: 'p1' }, reveals: [] });
    assert.strictEqual(state.players.p1.zones.hand.length, 1,
        'com espaço na mão a compra do oponente avança a contagem');
});

// 19. contagem de mão: o servidor publica, o cliente exibe o que recebeu
test('sessão PvP publica e carrega a contagem de mão exibida', () => {
    const PvpSession = require('../../src/js/pvp-session.js').PvpSession;

    const state = GameStateModel.createInitialGameState();
    GameStateModel.resetMatchState(state, {
        p1: Array.from({ length: 6 }, () => ({ ...repeatedDefinition })),
        p2: Array.from({ length: 6 }, () => ({ ...repeatedDefinition }))
    }, { idFactory: createIdFactory() });
    for (let i = 0; i < 3; i += 1) GameStateModel.drawCard(state, 'p1');

    const enviados = [];
    const sessao = new PvpSession({
        transportSend: mensagem => enviados.push(mensagem),
        gameState: state,
        seat: 'p1',
        applyCommand: () => {}
    });

    assert.strictEqual(sessao.handSizeOf('p1'), null, 'sem servidor não há contagem publicada');

    // O MATCH_START já traz a contagem da abertura (`state.maos`).
    sessao.handleMessage({ type: 'MATCH_START', state: { maos: { p1: 5, p2: 5 } } });
    assert.strictEqual(sessao.handSizeOf('p1'), 5);
    assert.strictEqual(sessao.handSizeOf('p2'), 5, 'a mão alheia também vem do servidor');

    // O broadcast do comando e o log da reconexão reafirmam a contagem.
    sessao.handleMessage({
        type: 'COMMAND', seq: 1, cmd: 'DRAW', actor: 'p1', args: {}, reveals: [],
        handSizes: { p1: 6, p2: 5 }
    });
    assert.strictEqual(sessao.handSizeOf('p1'), 6, 'o COMMAND carrega a contagem');

    sessao.handleMessage({ type: 'HAND_SIZES', handSizes: { p1: 4, p2: 5 } });
    assert.strictEqual(sessao.handSizeOf('p1'), 4, 'HAND_SIZES do dono atualiza o contador');

    // Valor inválido nunca sobrescreve o que o servidor já publicou.
    sessao.handleMessage({ type: 'HAND_SIZES', handSizes: { p1: -1, p2: 'muitas' } });
    assert.strictEqual(sessao.handSizeOf('p1'), 4);
    assert.strictEqual(sessao.handSizeOf('p2'), 5);

    // Publicação do dono: só quando a contagem local muda de fato.
    enviados.length = 0;
    assert.strictEqual(sessao.publicarContagemDeMao(), true);
    assert.deepStrictEqual(enviados, [{ type: 'HAND_SIZE', hand: 3 }]);
    assert.strictEqual(sessao.publicarContagemDeMao(), false, 'repetir não gera tráfego');
    assert.strictEqual(enviados.length, 1);

    GameStateModel.drawCard(state, 'p1');
    assert.strictEqual(sessao.publicarContagemDeMao(), true);
    assert.deepStrictEqual(enviados[1], { type: 'HAND_SIZE', hand: 4 });
});

// 20. o contador exibido em PvP é a contagem publicada pelo servidor
test('contador de mão exibido usa a contagem publicada pelo servidor', () => {
    const gameSource = fs.readFileSync(path.join(__dirname, '../../src/js/game.js'), 'utf8');
    const attributes = new Map();
    const titulo = {
        id: 'hand-title-p2',
        innerText: '',
        setAttribute(nome, valor) { attributes.set(nome, String(valor)); },
        getAttribute(nome) { return attributes.has(nome) ? attributes.get(nome) : null; }
    };
    const publicacoes = [];
    let maosDoServidor = { p1: 4, p2: 6 };
    const fakeWindow = {
        GameStateModel,
        GameEngine,
        CardRules,
        cardAbilities: { attachEngine() {}, onCardSummoned() {}, onCardEquipped() {} },
        PvpSession: {
            PvpSession: {
                current: {
                    handSizeOf: player => maosDoServidor[player],
                    isApplying: () => false,
                    isReplaying: () => false,
                    publicarContagemDeMao: () => { publicacoes.push('publicou'); return true; }
                }
            }
        }
    };
    const fakeDocument = {
        addEventListener() {},
        getElementById: id => (id === titulo.id ? titulo : null),
        querySelector: () => null,
        querySelectorAll: () => [],
        createElement: () => ({
            style: {},
            dataset: {},
            classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
            appendChild() {},
            setAttribute() {},
            getAttribute: () => null,
            querySelector: () => null,
            querySelectorAll: () => [],
            addEventListener() {}
        }),
        body: { dataset: { seat: 'p2' }, appendChild() {}, removeChild() {} },
        documentElement: { style: {} }
    };

    new Function('window', 'document', gameSource)(fakeWindow, fakeDocument);
    const state = fakeWindow.gameState;
    GameStateModel.resetMatchState(state, {
        p1: Array.from({ length: 12 }, () => ({ ...repeatedDefinition })),
        p2: Array.from({ length: 12 }, () => ({ ...repeatedDefinition }))
    }, { idFactory: createIdFactory() });
    for (let i = 0; i < 6; i += 1) GameStateModel.drawCard(state, 'p2');

    fakeWindow.updateHandCounter('p2');
    assert.match(titulo.innerText, /\(6\)/, 'sem divergência exibe a contagem do servidor');
    assert.strictEqual(attributes.get('data-count'), '6', 'o badge "N cartas" segue o título');
    assert.deepStrictEqual(publicacoes, [], 'contagem igual não publica nada');

    // Efeito que o servidor não conhece tirou uma carta da mão local: o contador
    // segue mostrando o número do servidor e o dono publica a contagem nova.
    const descartada = state.players.p2.zones.hand[0];
    GameStateModel.moveCard(state, descartada.instanceId, 'discard', 'p2');
    fakeWindow.updateHandCounter('p2');
    assert.match(titulo.innerText, /\(6\)/, 'o número exibido é o do servidor, não a recontagem local');
    assert.strictEqual(publicacoes.length, 1, 'a divergência publica HAND_SIZE');

    // Fora do PvP (ou antes do MATCH_START) volta a valer o estado local.
    maosDoServidor = { p1: null, p2: null };
    fakeWindow.updateHandCounter('p2');
    assert.match(titulo.innerText, /\(5\)/, 'sem contagem do servidor a UI usa a local');
});

// 21. leque do oponente: a contagem publicada decide quantos versos desenhar
test('resizeHiddenZone ajusta o leque do oponente à contagem do servidor', () => {
    const PvpState = require('../../src/js/pvp-state.js');

    const state = GameStateModel.createInitialGameState();
    GameStateModel.resetMatchState(state, { p1: [], p2: [] }, { idFactory: createIdFactory() });
    PvpState.installHiddenZones(state, 'p1', { deck: 5, hand: 0 });
    const ids = () => state.players.p1.zones.hand.map(carta => carta.instanceId);

    assert.strictEqual(PvpState.resizeHiddenZone(state, 'p1', 'hand', 3), 3, 'cresce até a contagem');
    assert.strictEqual(state.players.p1.zones.hand.length, 3);
    assert.deepStrictEqual(ids(), ['hidden_p1_5', 'hidden_p1_6', 'hidden_p1_7'],
        'os placeholders novos não colidem com o deck oculto');
    assert.ok(state.players.p1.zones.hand.every(carta =>
        PvpState.isHiddenInstance(carta) && carta.definitionId === null),
    'o cliente nunca inventa identidade de carta');
    ids().forEach(id => assert.ok(state.cardInstances[id], `cardInstances registra ${id}`));

    assert.strictEqual(PvpState.resizeHiddenZone(state, 'p1', 'hand', 3), 0, 'contagem que já bate não mexe');
    assert.strictEqual(PvpState.resizeHiddenZone(state, 'p1', 'hand', 1), -2, 'encolhe até a contagem');
    assert.strictEqual(state.players.p1.zones.hand.length, 1);
    assert.strictEqual(state.cardInstances['hidden_p1_6'], undefined, 'o excesso sai de cardInstances');
    assert.strictEqual(state.cards.p1.hand, state.players.p1.zones.hand, 'o alias legado segue apontando');
    assert.strictEqual(PvpState.resizeHiddenZone(state, 'p1', 'hand', -1), 0, 'alvo inválido é ignorado');
});


/**
 * SELECAO DE DECKS — catalogo pre-montado (data/decks.json)
 */

const decksDatabase = require('../../data/decks.json');
const DeckSystem = require('../../src/js/deck_system.js');
const deckBuilderCatalogo = new DeckBuilder(cardsDatabase);
const catalogoDeCartas = cardsDatabase.cards;
const cartaPorId = id => catalogoDeCartas.find(carta => carta.id === id);

test('o catalogo de decks traz ao menos 3 presets de 40 cartas com ids do catalogo', () => {
    assert.ok(Array.isArray(decksDatabase.decks), 'data/decks.json tem a lista de decks');
    assert.ok(decksDatabase.decks.length >= 3, 'o pedido exige pelo menos 3 decks');

    decksDatabase.decks.forEach(deck => {
        assert.ok(deck.id && deck.nome && deck.emblema, `${deck.id}: identificacao completa`);
        assert.ok(deck.cores?.primaria && deck.cores?.secundaria, `${deck.id}: cores de identidade`);
        assert.equal(deck.cartas.length, DeckSystem.DECK_SIZE,
            `${deck.nome} tem exatamente ${DeckSystem.DECK_SIZE} cartas`);

        const copias = deck.cartas.reduce((contagem, id) => {
            contagem[id] = (contagem[id] || 0) + 1;
            return contagem;
        }, {});
        const maxCopias = Math.max(...Object.values(copias));
        assert.ok(maxCopias <= 3, `${deck.nome}: no maximo 3 copias por carta (achei ${maxCopias})`);
        Object.keys(copias).forEach(id => {
            assert.ok(cartaPorId(id), `${deck.nome}: ${id} existe em cards_database.json`);
        });
    });
});

test('todo deck respeita a curva de custo e a proporcao de criaturas', () => {
    decksDatabase.decks.forEach(deck => {
        const cartas = deck.cartas.map(cartaPorId);
        const custos = cartas.map(carta => carta.cost);
        const media = custos.reduce((soma, custo) => soma + custo, 0) / custos.length;
        const criaturas = cartas.filter(carta => carta.type === 'criatura' || carta.type === 'evolução').length;

        assert.ok(Math.max(...custos) <= 12, `${deck.nome}: nenhum custo acima de 12`);
        assert.ok(media >= 3.0 && media <= 4.8, `${deck.nome}: custo medio ${media.toFixed(2)} na faixa 3.0-4.8`);
        assert.ok(criaturas >= 24, `${deck.nome}: pelo menos 24 criaturas/evolucoes (achei ${criaturas})`);
        assert.ok(custos.filter(custo => custo <= 3).length >= 10,
            `${deck.nome}: base de custo baixo para abrir a partida`);
        assert.ok(custos.filter(custo => custo >= 4 && custo <= 6).length >= 8,
            `${deck.nome}: meio de curva consistente`);
    });
});

test('cada deck e coeso: a maioria das criaturas carrega as traits do tema', () => {
    decksDatabase.decks.forEach(deck => {
        const criaturas = deck.cartas.map(cartaPorId)
            .filter(carta => carta.type === 'criatura' || carta.type === 'evolução');
        const doTema = criaturas.filter(carta =>
            (carta.traits || []).some(trait => deck.traits.includes(trait)));

        assert.ok(doTema.length / criaturas.length >= 0.5,
            `${deck.nome}: ao menos metade das criaturas no tema (${doTema.length}/${criaturas.length})`);
        deck.traits.forEach(trait => {
            const portadoras = criaturas.filter(carta => (carta.traits || []).includes(trait));
            assert.ok(portadoras.length >= 1, `${deck.nome}: ${trait} precisa de portadora no deck`);
        });
    });
});

test('todo suporte com exigencia de trait acha hospedeiro no deck e a evolucao tem a base', () => {
    decksDatabase.decks.forEach(deck => {
        const cartas = deck.cartas.map(cartaPorId);
        const criaturas = cartas.filter(carta => carta.type === 'criatura' || carta.type === 'evolução');
        const elegivel = (carta, trait) => CardRules.hasTrait({ definitionId: carta.id, data: carta }, trait);

        cartas.filter(carta => carta.type === 'suporte').forEach(suporte => {
            const regra = CardRules.getEquipmentRule(suporte.id);
            if (!regra) return;
            const exigidas = regra.requiredTraitsAny || (regra.requiredTrait ? [regra.requiredTrait] : []);
            if (exigidas.length === 0) return;
            const hospedeiros = criaturas.filter(carta => exigidas.some(trait => elegivel(carta, trait)));
            assert.ok(hospedeiros.length >= 3,
                `${deck.nome}: ${suporte.name} exige ${exigidas.join('/')} e tem ${hospedeiros.length} hospedeiros`);
        });

        cartas.filter(carta => carta.type === 'evolução').forEach(evolucao => {
            const base = CardRules.EVOLUTION_BASE_IDS[evolucao.id];
            assert.ok(base, `${evolucao.name}: evolucao registrada em EVOLUTION_BASE_IDS`);
            assert.ok(deck.cartas.includes(base), `${deck.nome}: ${evolucao.name} vem com a base ${base}`);
        });
    });
});

test('definicoesDeDeck expande o preset em definicoes do catalogo (e recusa deck desconhecido)', () => {
    const definicoes = deckBuilderCatalogo.definicoesDeDeck('robotico', decksDatabase);
    assert.equal(definicoes.length, DeckSystem.DECK_SIZE);
    assert.deepStrictEqual(definicoes.map(c => c.id), decksDatabase.decks.find(d => d.id === 'robotico').cartas);
    definicoes.forEach(definicao => assert.ok(cartaPorId(definicao.id), `${definicao.id} veio do catalogo`));
    assert.throws(() => deckBuilderCatalogo.definicoesDeDeck('inexistente', decksDatabase), /Deck desconhecido/);
});

test('montarDecksDaEscolha entrega o preset embaralhado em p1 e um deck sorteado em p2', () => {
    const furia = decksDatabase.decks.find(d => d.id === 'furia');
    const comPreset = DeckSystem.montarDecksDaEscolha('furia', DeckSystem.DECK_SIZE, deckBuilderCatalogo, decksDatabase);

    assert.equal(comPreset.decks.player1.length, DeckSystem.DECK_SIZE);
    assert.deepStrictEqual(
        comPreset.decks.player1.map(c => c.id).sort(),
        [...furia.cartas].sort(),
        'p1 recebe exatamente as cartas do preset (o multiset, não a ordem do arquivo)'
    );
    assert.equal(comPreset.decks.player2.length, DeckSystem.DECK_SIZE, 'p2 segue com deck balanceado');
    assert.equal(comPreset.selecoes.p1.id, 'furia');
    assert.equal(comPreset.selecoes.p2, null);

    // O baralho é embaralhado na montagem: com o RNG da partida (seed fixa) a
    // ordem é reproduzível — é o que garante o F5 do PvP — e muda entre partidas.
    const comSeed = seed => DeckSystem.montarDecksDaEscolha(
        'furia',
        DeckSystem.DECK_SIZE,
        new DeckBuilder(cardsDatabase, { rng: mulberry32(seed) }),
        decksDatabase
    ).decks.player1.map(c => c.id);

    const primeira = comSeed(11);
    assert.deepStrictEqual(primeira, comSeed(11), 'mesma seed, mesma ordem de baralho');
    assert.notDeepStrictEqual(primeira, comSeed(12), 'seed diferente, ordem diferente');
    assert.notDeepStrictEqual(primeira, furia.cartas,
        'a ordem do JSON (agrupada por custo) nunca é a ordem do baralho');

    ['aleatorio', null, 'id-que-nao-existe'].forEach(escolha => {
        const sorteado = DeckSystem.montarDecksDaEscolha(escolha, DeckSystem.DECK_SIZE, deckBuilderCatalogo, decksDatabase);
        assert.equal(sorteado.selecoes.p1, null, `${escolha}: cai no deck aleatorio`);
        assert.equal(sorteado.decks.player1.length, DeckSystem.DECK_SIZE);
    });
});

test('embaralhar preserva as cartas, nao muta a entrada e depende so do RNG', () => {
    const entrada = ['card_011', 'card_013', 'card_014', 'card_017', 'card_019', 'card_036', 'card_059', 'card_077'];
    const copia = [...entrada];

    const a = DeckBuilder.embaralhar(entrada, mulberry32(5));
    const b = DeckBuilder.embaralhar(entrada, mulberry32(5));
    const c = DeckBuilder.embaralhar(entrada, mulberry32(6));

    assert.deepStrictEqual([...a].sort(), [...entrada].sort(), 'nao cria nem perde carta');
    assert.deepStrictEqual(a, b, 'mesmo RNG, mesma ordem');
    assert.notDeepStrictEqual(a, c, 'RNG diferente, ordem diferente');
    assert.notDeepStrictEqual(a, copia, 'a ordem de entrada nao sobrevive ao embaralhamento');
    assert.deepStrictEqual(entrada, copia, 'a entrada original fica intacta');
    assert.deepStrictEqual(DeckBuilder.embaralhar([], mulberry32(1)), [], 'baralho vazio nao quebra');

    // `shuffleArray` (usado pelo deck aleatorio) e o mesmo algoritmo do estatico.
    const builder = new DeckBuilder(cardsDatabase, { rng: mulberry32(7) });
    assert.deepStrictEqual(
        builder.shuffleArray(['a', 'b', 'c', 'd'], mulberry32(7)),
        DeckBuilder.embaralhar(['a', 'b', 'c', 'd'], mulberry32(7)),
        'shuffleArray delega para embaralhar (uma unica implementacao)'
    );
});

test('resumoDeDeck soma a curva de custo e as estatisticas do preset', () => {
    decksDatabase.decks.forEach(deck => {
        const resumo = DeckSystem.resumoDeDeck(deck.id, decksDatabase, deckBuilderCatalogo);
        assert.equal(resumo.nome, deck.nome);
        assert.equal(resumo.stats.total, DeckSystem.DECK_SIZE);
        assert.equal(resumo.faixas.baixo + resumo.faixas.medio + resumo.faixas.alto, DeckSystem.DECK_SIZE);
        assert.equal(resumo.cartasDistintas, new Set(deck.cartas).size);
        assert.equal(resumo.stats.criaturas + resumo.stats.suportes + resumo.stats.evolucoes, DeckSystem.DECK_SIZE);
    });
    assert.equal(DeckSystem.resumoDeDeck('inexistente', decksDatabase, deckBuilderCatalogo), null);
});

test('a escolha de deck vive no estado da partida (e o reset a preserva)', () => {
    const state = GameStateModel.createInitialGameState();
    assert.deepStrictEqual(state.deckSelections, { p1: null, p2: null });

    GameStateModel.resetMatchState(state, { p1: [], p2: [] }, {
        deckSelections: { p1: { id: 'robotico', nome: 'Legião Robótica', emblema: '🤖' } }
    });
    assert.equal(state.deckSelections.p1.id, 'robotico');
    assert.equal(state.deckSelections.p2, null, 'o oponente do hotseat segue sem preset');

    GameStateModel.resetMatchState(state, { p1: [], p2: [] });
    assert.deepStrictEqual(state.deckSelections, { p1: null, p2: null }, 'reset sem escolha limpa a selecao');
});

/**
 * GUARDA DE SINTAXE DOS CLASSIC SCRIPTS
 * Um `await` fora de função async derruba o arquivo inteiro no navegador (e o
 * resto da página fica sem `gameState`): os testes de unidade não pegam isso
 * sozinhos porque leem o texto, então o parse entra na suíte.
 */
test('todo script de src/js compila como classic script', () => {
    const vm = require('node:vm');
    const arquivos = fs.readdirSync(path.join(__dirname, '../../src/js'))
        .filter(arquivo => arquivo.endsWith('.js'));

    assert.ok(arquivos.length >= 10, 'a lista de runtime do cliente não pode encolher');
    arquivos.forEach(arquivo => {
        const fonte = readSourceText(`src/js/${arquivo}`);
        assert.doesNotThrow(() => new vm.Script(fonte, { filename: arquivo }),
            `${arquivo} precisa compilar (await só dentro de função async)`);
    });
});

/**
 * SELETOR DE DECKS — UI do hotseat, traits do modal de detalhes e PvP
 */

const DeckSelect = require('../../src/js/deck-select.js');

test('o tamanho do baralho e 40 no motor, no cliente PvP, no servidor e no CLI', () => {
    assert.strictEqual(DeckSystem.DECK_SIZE, 40, 'deck_system.js e a fonte da constante');
    assert.match(readSourceText('src/js/pvp-game.js'), /const DECK_SIZE = 40;/,
        'pvp-game.js precisa do mesmo tamanho para o fallback pela seed');
    assert.match(readSourceText('server.py'), /^DECK_SIZE = 40$/m,
        'server.py gera os decks no mesmo tamanho');
    assert.match(readSourceText('scripts/deck_factory.js'), /args\.size \|\| '40'/,
        'o CLI de decks deterministicos segue o teto de 40');
});

test('game.html traz o seletor de decks na ordem de scripts do runtime', () => {
    const html = readSourceText('game.html');
    assert.match(html, /<div class="deck-select-modal" id="deckSelectModal"/, 'o modal existe no markup');
    assert.match(html, /<link rel="stylesheet" href="src\/css\/deck-select\.css">/, 'o CSS do componente carrega');
    assert.match(html, /id="deckSelectConfirm"[\s\S]*?onclick="confirmarSelecaoDeDeck\(\)"/,
        'o botao de confirmar aponta para o handler do componente');
    assert.match(html, /onclick="trocarDeck\(\); toggleGearMenu\(\)"/, 'o gear tem "Trocar deck"');

    const ordem = ['deck_system.js', 'deck-select.js', 'manual_abilities.js', 'game.js']
        .map(arquivo => html.indexOf(`src/js/${arquivo}`));
    assert.ok(ordem.every(posicao => posicao !== -1), 'todos os módulos estão na página');
    assert.deepEqual(ordem, [...ordem].sort((a, b) => a - b),
        'deck-select.js carrega depois do catálogo e antes da UI');
});

test('o seletor rotula em pt-BR todas as traits que o catalogo usa', () => {
    const doCatalogo = [...new Set(cardsDatabase.cards.flatMap(carta => carta.traits || []))].sort();
    assert.ok(doCatalogo.length >= 16, 'o catalogo mantem as traits variadas');

    doCatalogo.forEach(trait => {
        const { rotulo, icone } = DeckSelect.rotuloDeTrait(trait);
        assert.ok(rotulo && icone, `trait ${trait} tem rótulo e ícone`);
    });
    assert.deepEqual(Object.keys(DeckSelect.TRAIT_LABELS).sort(), doCatalogo,
        'o mapa de rótulos e o catalogo nao divergem');

    const cartao = DeckSelect.chipsDeTraits(['besta', 'elite']);
    assert.equal((cartao.match(/trait-chip/g) || []).length, 4, 'dois chips com ícone cada');
    assert.deepEqual(DeckSelect.rotuloDeTrait('trait_nova'), { rotulo: 'Trait_nova', icone: '🔹' },
        'trait fora do mapa nao some da tela');
    assert.deepEqual(DeckSelect.traitsDaCarta({ id: 'card_011', traits: ['Besta'] }), ['besta'],
        'as traits do catalogo sao normalizadas em minusculas');
});

test('o modal de detalhes da carta apresenta os traits', () => {
    const fonte = readSourceText('src/js/game.js');
    const inicio = fonte.indexOf('function showCardModal');
    const modal = fonte.slice(inicio, fonte.indexOf('function closeCardModal', inicio));

    assert.match(modal, /window\.DeckSelect\?\.traitsDaCarta\?\.\(cardData\)/,
        'os traits vem do catalogo com fallback do motor');
    assert.match(modal, /traitsDaCarta\.length > 0 \?/, 'carta sem traits nao ganha bloco vazio');
    assert.match(modal, /class="modal-card-traits"/, 'a secao de traits entra no modal');
    assert.match(modal, /Características:/, 'com titulo em pt-BR');
    assert.match(modal, /chipsDeTraits\(traitsDaCarta\)/, 'rotulados pelo seletor de decks');

    const css = readSourceText('src/css/deck-select.css');
    assert.match(css, /\.modal-card-traits/, 'o bloco tem estilo proprio');
    assert.match(css, /\.trait-chip/, 'e o chip compartilhado com o resumo do deck');
});

test('o visual do seletor empilha cartas e usa a cor de cada deck', () => {
    const css = readSourceText('src/css/deck-select.css');
    assert.match(css, /\.deck-stack-card/, 'a pilha de versos existe');
    assert.match(css, /url\('\.\.\/\.\.\/assets\/verso\.jpeg'\)/, 'usa o verso real do jogo');
    assert.match(css, /var\(--deck-primaria\)/, 'a cor do deck vem de CSS var (dado do tema)');
    assert.match(css, /\.deck-option\.selected/, 'a opcao escolhida e destacada');
    assert.match(css, /\.deck-card-mini/, 'as cartas do deck aparecem em miniatura');

    const deckSelect = readSourceText('src/js/deck-select.js');
    assert.match(deckSelect, /--deck-primaria/, 'o componente escreve as cores do deck');
    assert.ok(!/function renderizar\(/.test(deckSelect),
        'não existe mais modo embutido: o deck se escolhe ao entrar na partida');
    assert.ok(!/\n\s+renderizar,/.test(deckSelect), 'e a API não expõe renderizar');

    // O lobby não escolhe deck: a escolha acontece na entrada da sala.
    const lobby = readSourceText('pvp-lobby.html');
    assert.ok(!lobby.includes('deck-picker') && !lobby.includes('deck-select'),
        'o lobby não carrega o seletor nem o CSS de decks');
    assert.ok(!lobby.includes('salvarPreferencia'), 'o lobby não grava preferência de deck');
});

test('os decks sao escolhidos na entrada da partida (o lobby nao monta seletor)', () => {
    // Regressão do pedido: o lobby só cria/compartilha a sala. Quem escolhe o
    // deck é a tela da partida (game.html ou o link da sala em pvp.html).
    const lobby = readSourceText('pvp-lobby.html');
    assert.ok(!lobby.includes('deck-select.js'), 'o lobby nao carrega o componente do seletor');
    assert.ok(!lobby.includes('deck-select.css'), 'nem o CSS do seletor');
    assert.ok(!lobby.includes('deck-picker'), 'nem o container da grade de decks');
    assert.ok(!lobby.includes('loadCardSystem'), 'nem o catalogo de cartas/decks');
    assert.ok(lobby.includes('Regras do Jogo'), 'o lobby continua com o que e dele');

    // As duas telas de partida montam o modal bloqueante.
    ['game.html', 'pvp.html'].forEach(arquivo => {
        const pagina = readSourceText(arquivo);
        assert.match(pagina, /<div class="deck-select-modal" id="deckSelectModal"/, `${arquivo} tem o modal`);
        assert.match(pagina, /<script src="src\/js\/deck-select\.js"><\/script>/, `${arquivo} carrega o seletor`);
    });
});

test('o HELLO do PvP leva o deck escolhido na entrada da sala', () => {
    const pvpGame = readSourceText('src/js/pvp-game.js');
    assert.match(pvpGame, /async function escolherDeckDeEntrada\(\)/,
        'a escolha acontece na entrada da sala, nao no lobby');
    assert.match(pvpGame, /deckEscolhido = await window\.DeckSelect\.abrir\(\);/,
        'o modal do seletor resolve a escolha');
    assert.match(pvpGame, /await loadCardSystem\(\);/,
        'o catalogo carrega para o resumo do deck (o tabuleiro PvP nao o tem)');
    assert.match(pvpGame, /deck: deckEscolhido/, 'o HELLO envia o deck confirmado');

    // Nenhum socket antes da escolha: o `HELLO` nasce com o id confirmado.
    const inicio = pvpGame.indexOf('async function bootstrap');
    const corpo = pvpGame.slice(inicio, pvpGame.indexOf('function enviarHello', inicio));
    assert.ok(corpo.indexOf('await escolherDeckDeEntrada()') < corpo.indexOf('new WebSocket('),
        'o bootstrap espera a escolha antes de conectar');

    const reset = pvpGame.slice(pvpGame.indexOf('window.GameStateModel.resetMatchState'),
        pvpGame.indexOf('window.PvpState.installHiddenZones'));
    assert.match(reset, /deckSelections: mensagem\.deckId/, 'o preset do dono entra no estado');
    assert.match(reset, /nome: mensagem\.deckNome \|\| mensagem\.deckId/, 'com nome para o gear "Decks"');

    // O tabuleiro PvP precisa do componente (seletor da entrada + chips de traits).
    const pvp = readSourceText('pvp.html');
    assert.match(pvp, /<script src="src\/js\/deck-select\.js"><\/script>/);
    assert.match(pvp, /<link rel="stylesheet" href="src\/css\/deck-select\.css">/);
    assert.match(pvp, /id="deckSelectModal"/, 'a entrada da sala abre o seletor bloqueante');
    assert.match(pvp, /quando os dois jogadores confirmarem/, 'o texto explica que a partida espera os dois');
});

test('o servidor resolve o preset do assento sem vazar o deck alheio', () => {
    const servidor = readSourceText('server.py');
    assert.match(servidor, /def deck_presets\(\)/, 'le data/decks.json com cache');
    assert.match(servidor, /def preset_deck\(deck_id\)/, 'expande os ids para definicoes');
    assert.match(servidor, /def resolver_decks\(room\)/, 'preset do assento ou deck pela seed');
    assert.match(servidor, /hello\.get\("deck"\) or parametro\("deck"\)/, 'o HELLO carrega a escolha');
    assert.match(servidor, /room\.deck_choices\[seat\] = escolha_deck/, 'a escolha fica na sala');
    assert.match(servidor, /room\.deck_ids\[seat\] = escolha if definicoes else None/,
        'so conta como resolvido o preset que existe de verdade');
    assert.match(servidor, /if escolha_deck and room\.decks is None and not room\.started:/,
        'trocar deck so antes da partida');

    const inicio = servidor.indexOf('def match_start_payload');
    const payload = servidor.slice(inicio, servidor.indexOf('def command_log_payload', inicio));
    assert.match(payload, /"deckId": deck_id,/, 'o dono recebe o id do proprio preset');
    assert.match(payload, /"deckNome": deck_presets\(\)\.get\(deck_id/, 'e o nome, para a UI');
    assert.ok(!payload.includes('other_seat(seat)]["deckId"]'), 'o deck alheio nao viaja');

    const publico = servidor.slice(servidor.indexOf('def public_state'), servidor.indexOf('def ledger_dict'));
    assert.ok(!publico.includes('deck_choices') && !publico.includes('deck_ids'),
        'o de deck alheio continua secreto: a escolha nao vai no estado publico');

    const espelho = servidor.slice(servidor.indexOf('def ledger_dict'), servidor.indexOf('def claim'));
    assert.match(espelho, /"escolhasDeck": dict\(self\.deck_choices\)/, 'o espelho audita a escolha');
    assert.match(espelho, /"decksResolvidos": dict\(self\.deck_ids\)/, 'e o que de fato valeu');

    const rematch = servidor.slice(servidor.indexOf('def reset_for_rematch'), servidor.indexOf('class RoomRegistry'));
    assert.match(rematch, /self\.decks = None/, 'a partida nova volta a resolver os decks');
});

test('o catalogo tem variedade: decks distintos, pouca repeticao e cartas baratas', () => {
    const decks = decksDatabase.decks;
    assert.ok(decks.length >= 9, 'o catalogo ja tem 9 arquetipos montados');

    // Nenhum deck é uma pilha de 3 cópias da mesma carta: a média de cópias por
    // carta distinta fica abaixo de 2,3 em todo o catálogo.
    decks.forEach(deck => {
        const distintas = new Set(deck.cartas).size;
        const media = deck.cartas.length / distintas;
        assert.ok(distintas >= 18, `${deck.nome}: ao menos 18 cartas distintas (tem ${distintas})`);
        assert.ok(media <= 2.3, `${deck.nome}: no máximo 2,3 cópias por carta distinta (${media.toFixed(2)})`);
    });

    // Pelo menos três arquétipos exploram variedade alta (>= 28 distintas, <= 1,5
    // cópias/carta) — é o que sustenta "sinergia sem repetir tantas cartas".
    const variados = decks.filter(deck =>
        new Set(deck.cartas).size >= 28 && deck.cartas.length / new Set(deck.cartas).size <= 1.5);
    assert.ok(variados.length >= 3,
        `esperava 3+ decks de variedade alta, achei ${variados.map(d => d.id).join(', ')}`);

    // Os arquétipos juntos cobrem TODO o catálogo: 110/110 cartas entram em pelo
    // menos um deck (a última a fechar foi a Bilugação Astral, que ganhou regra).
    const usadas = new Set(decks.flatMap(deck => deck.cartas));
    assert.equal(usadas.size, cardsDatabase.cards.length,
        `os decks usam todas as cartas do catálogo (cobrem ${usadas.size}/${cardsDatabase.cards.length})`);
    assert.deepEqual([...usadas].sort(), cardsDatabase.cards.map(c => c.id).sort(),
        'nenhuma carta do catálogo ficou fora dos decks');
});
test('o PvP embaralha o deck do servidor com o RNG da sala e o fallback local funciona', () => {
    const deckSystem = readSourceText('src/js/deck_system.js');
    assert.match(deckSystem, /static embaralhar\(definicoes, rng = Math\.random\)/,
        'o embaralhamento e um unico estatico do DeckBuilder');
    assert.match(deckSystem, /shuffleArray\(array, rng = this\.rng\) \{\n\s*return DeckBuilder\.embaralhar\(array, rng\);/,
        'shuffleArray delega (sem segunda implementacao de Fisher-Yates)');
    assert.match(deckSystem, /window\.DeckBuilder = DeckBuilder;/,
        'a classe e exposta: gerarDeckLocal e embaralharDeck dependem de window.DeckBuilder');

    const pvpGame = readSourceText('src/js/pvp-game.js');
    assert.match(pvpGame, /function embaralharDeck\(definicoes, seed\)/);
    assert.match(pvpGame, /const rng = mulberrySala\(seed\);/, 'o RNG e o da sala (seed)');
    assert.match(pvpGame, /window\.DeckBuilder\.embaralhar\(definicoes, rng\)/);
    assert.match(pvpGame, /embaralharDeck\(mensagem\.deck, mensagem\.seed\)/,
        'o deck privado recebido do servidor e embaralhado antes do reset');

    // O preset do hotseat tambem entra embaralhado na mesa.
    assert.match(deckSystem, /player1: DeckBuilder\.embaralhar\(definicoes, alvo\.rng\)/);
});
test('Bilugação Astral deixa a criatura intransponível por um turno', () => {
    const { state, attacker, target, engine } = createCombatFixture({ targetDefense: 100 });
    CardRules.install(engine);

    const regra = CardRules.getEquipmentRule('card_090');
    assert.ok(regra, 'card_090 tem regra de equipamento (era a única carta sem regra)');

    const bilugacao = GameStateModel.createCardInstance({
        id: 'card_090', name: 'Bilugação Astral', type: 'suporte', cost: 2, attack: 0, defense: 0
    }, 'p2', { instanceId: 'bilugacao_astral' });
    GameStateModel.registerCard(state, bilugacao, 'equipment', 'p2');
    bilugacao.attachedTo = target.instanceId;
    target.attachments.push(bilugacao.instanceId);

    assert.equal(engine.resolveAction({
        type: 'EQUIP_ASTRAL', actorId: 'p2', sourceId: bilugacao.instanceId,
        requiresControl: false,
        effects: CardRules.createEquipmentEffects(bilugacao, target.instanceId, state)
    }).status, 'resolved');

    const efeito = state.effects.find(candidato => candidato.effectType === 'IMPENETRABLE');
    assert.ok(efeito, 'o efeito intransponível entra no estado');
    assert.equal(efeito.duration.kind, GameEngine.DURATION_KINDS.UNTIL_END_OF_OPPONENT_TURN,
        '"por um turno" = até o fim do turno do oponente');
    assert.equal(efeito.duration.controllerId, 'p2');

    // A UI recusa o alvo e o combate em si é cancelado (sem dano).
    const validacao = CardRules.validateAttackTarget(state, attacker.instanceId, target.instanceId);
    assert.equal(validacao.valid, false);
    assert.match(validacao.reason, /intransponível/);

    const combate = engine.resolveCombat({ attackerId: attacker.instanceId, targetId: target.instanceId });
    assert.equal(combate.cancelled, true);
    assert.equal(target.damage, 0, 'nada atravessa enquanto o efeito dura');
    assert.ok(state.effects.some(candidato => candidato.effectType === 'IMPENETRABLE'),
        'o efeito NÃO é consumido pelo ataque: vale o turno inteiro');

    // O turno do OPONENTE (quem não é o dono do efeito) termina e a proteção cai
    // sozinha: é o que "por um turno" significa para esta carta.
    engine.emit(GameEngine.EVENT_TYPES.TURN_ENDED, { playerId: 'p1', turnNumber: state.turn });
    assert.equal(state.effects.some(candidato => candidato.effectType === 'IMPENETRABLE'), false,
        'dura um turno, não a partida');
    assert.equal(CardRules.validateAttackTarget(state, attacker.instanceId, target.instanceId).valid, true);
});
test('ninguem ataca direto no proprio primeiro turno (vale para os dois jogadores)', () => {
    const { state, attacker, target } = createCombatFixture();

    // p1 abre a partida em `turn 1`: o turno 2 já é o segundo de p1 e o primeiro de p2.
    assert.equal(CardRules.ehPrimeiroTurnoDoJogador(state, 'p1'), true);
    assert.equal(CardRules.ehPrimeiroTurnoDoJogador(state, 'p2'), false);
    assert.equal(CardRules.canDirectAttack(state, attacker.instanceId), false,
        'nem com defensor em campo, nem com campo vazio');

    // Campo vazio não libera a abertura (era a brecha: turno 2 liberava p2).
    GameStateModel.moveCard(state, target.instanceId, 'discard', 'p2');
    assert.equal(CardRules.canDirectAttack(state, attacker.instanceId), false);

    // Segundo turno de p1 (turn 3): liberado.
    state.turn = 3;
    assert.equal(CardRules.ehPrimeiroTurnoDoJogador(state, 'p1'), false);
    assert.equal(CardRules.canDirectAttack(state, attacker.instanceId), true);

    // p2 tem o seu próprio primeiro turno (turn 2).
    const diabreteP2 = GameStateModel.createCardInstance({
        id: 'card_010_1', name: 'Diabrete', type: 'criatura', cost: 2, attack: 10, defense: 8
    }, 'p2', { instanceId: 'diabrete_p2' });
    GameStateModel.registerCard(state, diabreteP2, 'field', 'p2');
    state.turn = 2;
    state.currentPlayer = 'p2';
    assert.equal(CardRules.ehPrimeiroTurnoDoJogador(state, 'p2'), true);
    assert.equal(CardRules.canDirectAttack(state, diabreteP2.instanceId), false,
        'ataque direto inerente (Diabrete) também não passa no primeiro turno de p2');

    // Segundo turno de p2 (turn 4): liberado.
    state.turn = 4;
    assert.equal(CardRules.canDirectAttack(state, diabreteP2.instanceId), true);

    // `startingPlayer` é explícito: se a partida começasse com p2, os turnos invertem.
    state.startingPlayer = 'p2';
    state.turn = 1;
    assert.equal(CardRules.ehPrimeiroTurnoDoJogador(state, 'p2'), true);
    assert.equal(CardRules.ehPrimeiroTurnoDoJogador(state, 'p1'), false);
});

test('a vida inicial (300) esta sincronizada entre telas, cliente e servidor', () => {
    assert.match(readSourceText('src/js/game.js'), /const INITIAL_PV = 300;/,
        'hotseat/PvP usam 300 no gameConfig');
    assert.match(readSourceText('server.py'),
        /DEFAULT_CONFIG = \{"initialPv": 300, "initialEnergy": 6, "turnSeconds": TURN_SECONDS\}/,
        'o servidor cria a sala com 300');
    assert.match(readSourceText('index.html'), /const INITIAL_PV = 300;/, 'o contador standalone tambem');

    // As regras (index.html e lobby PvP, textos idênticos) anunciam o novo valor.
    ['index.html', 'pvp-lobby.html'].forEach(arquivo => {
        assert.match(readSourceText(arquivo), /Cada jogador começa com 300 pontos de vida/,
            `${arquivo} explica a vida inicial`);
        assert.match(readSourceText(arquivo), /Ninguém ataca direto no próprio primeiro turno/,
            `${arquivo} explica a regra do ataque direto`);
    });

    // O número pintado no tabuleiro antes do primeiro render também é 300.
    ['game.html', 'pvp.html', 'index.html'].forEach(arquivo => {
        const mostrados = [...readSourceText(arquivo).matchAll(/id="pv-p[12]"[^>]*>\s*(\d+)/g)]
            .map(resultado => resultado[1]);
        assert.deepEqual(mostrados, ['300', '300'], `${arquivo} mostra 300 nos dois PV`);
    });
});
test('o relogio de turno (45s) esta no cliente, no servidor e nas duas telas', () => {
    const game = readSourceText('src/js/game.js');
    assert.match(game, /const TURN_SECONDS = 45;/, 'o hotseat usa 45s');
    assert.match(game, /turnSeconds: TURN_SECONDS/, 'e o valor viaja no gameConfig (PvP/hotseat)');
    assert.match(game, /window\.reiniciarTempoDeTurno = reiniciarTempoDeTurno;/,
        'o contador e reiniciavel (boot, virada de turno e sync do PvP)');
    assert.match(game, /generation !== window\.matchGeneration/,
        'o intervalo respeita a geracao da partida');

    const servidor = readSourceText('server.py');
    assert.match(servidor, /TURN_SECONDS = int\(os\.environ\.get\("XM_TURN_SECONDS", "45"\)\)/,
        'o servidor tem o mesmo limite (e permite desligar/afinar por env)');
    assert.match(servidor, /async def expirar_turno\(room\):/, 'quem passa a vez e o servidor');
    assert.match(servidor, /if not room\.both_connected\(\):\n\s*return False/,
        'com um assento fora, o jogo nao anda sozinho');
    assert.match(servidor, /entry = room\.add_command\(ator, "END_TURN", \{\}, \[\]\)/,
        'o estouro entra no ledger como END_TURN do assento da vez');
    assert.match(servidor, /await expirar_turno\(room\)/, 'o loop de limpeza confere o relogio');
    assert.match(servidor, /"prazoTurno": self\.prazo_turno\(\),/, 'o estado publica o prazo');
    assert.match(servidor, /"prazoTurno": room\.prazo_turno\(\),/, 'e o comando tambem (sync dos dois lados)');

    const pvpGame = readSourceText('src/js/pvp-game.js');
    assert.match(pvpGame, /window\.reiniciarTempoDeTurno\?\./, 'o board PvP desenha o relogio do servidor');

    ['game.html', 'pvp.html'].forEach(arquivo => {
        const pagina = readSourceText(arquivo);
        assert.match(pagina, /id="turn-timer" class="turn-timer">45s</, `${arquivo} tem o contador`);
    });
    const css = readSourceText('src/css/game.css');
    assert.match(css, /\.turn-timer \{/, 'o contador tem estilo proprio');
    assert.match(css, /\.turn-timer\.turn-timer-warning/, 'e aviso nos ultimos segundos');
});
test('o retorno à mão (Fantom) remove a carta do campo depois da animação', () => {
    const fonte = readSourceText('src/js/game.js');
    const inicio = fonte.indexOf('const returnedToHand');
    const fim = fonte.indexOf('// O Fantom não morre', inicio);
    const bloco = fonte.slice(inicio, fim !== -1 ? fim : inicio + 2000);

    assert.ok(inicio !== -1, 'o bloco de retorno à mão existe no combate');
    assert.match(bloco, /cardElement\.addEventListener\('animationend', aoTerminar, \{ once: true \}\)/,
        'a limpeza acontece quando a animação termina');
    assert.match(bloco, /cardElement\.remove\(\)/, 'o elemento sai do DOM');
    assert.match(bloco, /renderFieldsFromState\(\);/, 'e o campo é reprojetado');
    assert.match(bloco, /generation !== window\.matchGeneration/, 'com a guarda de geração da partida');
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