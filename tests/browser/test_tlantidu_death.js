// Tlantidu (card_038): "Ao morrer pode procurar um monstro aquático no deck."
// A busca é do motor (determinística), mas a mão e o contador da UI precisam ser
// reprojetados — e o jogador precisa do disclaimer do que aconteceu. Roda em
// game.html com o combate real da UI.
(function runTlantiduDeathTests() {
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

    console.log('🧪 ===== TESTES DA MORTE DO TLANTIDU =====\n');

    const Model = window.GameStateModel;
    const state = window.gameState;
    if (!Model || !state || !window.deckBuilder || typeof window.performAttack !== 'function') {
        console.error('❌ Estado/decks/performAttack não carregados');
        return;
    }

    // Carta no deck do dono + ao menos uma não aquática para provar que a busca
    // escolhe pelo trait, e não a primeira do deck. O deck de p2 é montado à mão
    // (o `createMatchDecks` sorteia cartas reais e poderia trazer uma aquática).
    const montar = (comAquatica) => {
        const decks = window.deckBuilder.createMatchDecks(50);
        Model.resetMatchState(state, { p1: decks.player1, p2: [] }, window.gameConfig);
        document.body.dataset.seat = 'p1';
        state.currentPlayer = 'p1';
        state.currentPhase = 'combat';
        state.turn = 3;
        state.diceUsed = { p1: false, p2: false };

        const atacante = Model.createCardInstance({
            id: 'card_tlantidu_atk', name: 'Atacante', type: 'criatura', cost: 1, attack: 40, defense: 40
        }, 'p1', { instanceId: 'tlantidu_atk_1' });
        Model.registerCard(state, atacante, 'field', 'p1');

        const tlantidu = Model.createCardInstance({
            id: 'card_038', name: 'Tlantidu', type: 'criatura', cost: 4, attack: 25, defense: 18,
            traits: ['aquatico']
        }, 'p2', { instanceId: 'tlantidu_alvo_1' });
        Model.registerCard(state, tlantidu, 'field', 'p2');

        const naoAquatica = Model.createCardInstance({
            id: 'card_tlantidu_outra', name: 'Besta Comum', type: 'criatura', cost: 1, attack: 1, defense: 1,
            traits: ['besta']
        }, 'p2', { instanceId: 'tlantidu_outra_1' });
        Model.registerCard(state, naoAquatica, 'deck', 'p2');

        let aquatica = null;
        if (comAquatica) {
            aquatica = Model.createCardInstance({
                id: 'card_083', name: 'Hidra das Profundezas', type: 'criatura', cost: 12, attack: 59, defense: 59,
                traits: ['aquatico', 'elite']
            }, 'p2', { instanceId: 'tlantidu_aqua_1' });
            Model.registerCard(state, aquatica, 'deck', 'p2');
        }

        window.renderHandsFromState();
        window.renderFieldsFromState();
        window.renderPlayerStats();

        return { tlantidu, aquatica, naoAquatica };
    };

    const avisos = () => [...document.querySelectorAll('body > div')]
        .map(el => el.textContent || '')
        .filter(texto => texto.includes('Tlantidu'));
    const cartaNaMaoDom = id => Boolean(document.querySelector(`#hand-p2 .card#${id}`));
    const contadorMaoP2 = () => Number(document.getElementById('hand-title-p2').getAttribute('data-count'));

    // 1. Com aquática no deck: a carta vai para a mão e a UI mostra.
    const comAquatica = montar(true);
    window.performAttack('tlantidu_atk_1', 'tlantidu_alvo_1');

    assert('o Tlantidu morreu e foi para o descarte',
        comAquatica.tlantidu.zone === 'discard');
    assert('a não aquática continua no deck (a busca é pelo trait)',
        comAquatica.naoAquatica.zone === 'deck');
    assert('o motor levou a aquática para a mão',
        comAquatica.aquatica.zone === 'hand');
    assert('a mão renderizada mostra a carta buscada', cartaNaMaoDom('tlantidu_aqua_1'));
    assert('o contador da mão do dono acompanhou',
        contadorMaoP2() === state.players.p2.zones.hand.length && contadorMaoP2() >= 1);
    assert('o disclaimer diz qual carta o Tlantidu trouxe',
        avisos().some(texto => texto.includes('Hidra das Profundezas')));

    // 2. Sem aquática no deck: nada muda na mão e o disclaimer avisa o jogador.
    const semAquatica = montar(false);
    window.performAttack('tlantidu_atk_1', 'tlantidu_alvo_1');

    assert('sem aquática o Tlantidu ainda morre',
        semAquatica.tlantidu.zone === 'discard');
    assert('sem aquática nada entra na mão do dono',
        state.players.p2.zones.hand.length === 0);
    assert('sem aquática o contador da mão fica em 0', contadorMaoP2() === 0);
    assert('o disclaimer avisa que não havia monstro aquático',
        avisos().some(texto => texto.includes('não havia monstro aquático')));

    console.log(`\n🧪 Resultado morte do Tlantidu: ${passed}/${passed + failed} checks`);
    console.log(failed === 0 ? '✅ Tlantidu trouxe a aquática e avisou o jogador' : `❌ ${failed} falhas\n`);
})();
