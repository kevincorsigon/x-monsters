// Fantom (card_042): ao ser alvo de um ataque letal, substitui a morte por retorno
// à mão. O estado (motor) já era coberto por teste unitário; este teste cobre a UI:
// o elemento do campo precisa SAIR depois da animação — regressão de um bug em que
// a carta ficava presa em campo com a classe `destroying`. Roda em game.html.
(function runFantomReturnTests() {
    let passed = 0;
    let failed = 0;

    function assert(label, condition) {
        if (condition) {
            console.log(`✅ ${label}`);
            passed++;
        } else {
            console.error(`❌ FALHOU: ${label}`);
            failed++;
        }
    }

    console.log('🧪 ===== TESTES DO RETORNO DO FANTOM À MÃO =====\n');

    const Model = window.GameStateModel;
    const state = window.gameState;
    if (!Model || !state || !window.deckBuilder || typeof window.performAttack !== 'function') {
        console.error('❌ Estado/decks/performAttack não carregados');
        return;
    }

    const decks = window.deckBuilder.createMatchDecks(50);
    Model.resetMatchState(state, { p1: decks.player1, p2: [] }, window.gameConfig);
    document.body.dataset.seat = 'p1';
    state.currentPlayer = 'p1';
    state.currentPhase = 'combat';
    state.turn = 3;
    state.diceUsed = { p1: false, p2: false };

    const atacante = Model.createCardInstance({
        id: 'card_fantom_atk', name: 'Atacante', type: 'criatura', cost: 1, attack: 40, defense: 40
    }, 'p1', { instanceId: 'fantom_atk_1' });
    Model.registerCard(state, atacante, 'field', 'p1');

    const fantom = Model.createCardInstance({
        id: 'card_042', name: 'Fantom', type: 'criatura', cost: 5, attack: 27, defense: 20,
        traits: ['fantasma']
    }, 'p2', { instanceId: 'fantom_alvo_1' });
    Model.registerCard(state, fantom, 'field', 'p2');

    window.renderHandsFromState();
    window.renderFieldsFromState();
    window.renderPlayerStats();

    assert('o Fantom está em campo antes do ataque',
        Boolean(document.getElementById('fantom_alvo_1')) && fantom.zone === 'field');

    // 1. O ataque letal devolve o Fantom à mão (motor) em vez de matá-lo.
    window.performAttack('fantom_atk_1', 'fantom_alvo_1');
    assert('o Fantom voltou para a mão (não foi para o descarte)',
        fantom.zone === 'hand' && state.players.p2.zones.discard.length === 0);

    // 2. A mão renderizada mostra a carta (hotseat: as duas mãos são visíveis).
    assert('a carta reaparece renderizada na mão do dono',
        Boolean(document.querySelector(`#hand-p2 .card#fantom_alvo_1`)));

    // 3. Regressão do bug: o elemento do campo some depois da animação (a cópia na
    //    mão mantém o mesmo id, então a checagem precisa olhar só o campo).
    const noCampo = () => !document.querySelector('#field-p2 .card#fantom_alvo_1');
    setTimeout(() => {
        assert('o Fantom SAI do campo depois da animação', noCampo());

        // Reprojeta o campo: não pode ressuscitar a carta removida.
        window.renderFieldsFromState();
        assert('reprojetar o campo mantém o Fantom fora', noCampo());
        assert('a carta continua (corretamente) na mão',
            Boolean(document.querySelector('#hand-p2 .card#fantom_alvo_1')));

        console.log(`\n🧪 Resultado retorno do Fantom: ${passed}/${passed + failed} checks`);
        console.log(failed === 0 ? '✅ o Fantom volta à mão e sai do campo' : `❌ ${failed} falhas\n`);
    }, 700);
})();
