const assert = require('node:assert/strict');
const GameStateModel = require('../../src/js/game-state.js');

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