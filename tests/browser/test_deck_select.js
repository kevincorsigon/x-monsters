// Seletor de decks do hotseat: modal bloqueante no boot, opções em pilha de
// versos com a identidade (cor/emblema) de cada deck, detalhe com curva de custo
// e traits no modal de detalhes da carta. Roda contra game.html, sem servidor.
(function runDeckSelectTests() {
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

    console.log('🧪 ===== TESTES DO SELETOR DE DECKS (hotseat) =====\n');

    const DeckSelect = window.DeckSelect;
    const modal = document.getElementById('deckSelectModal');
    const grade = document.getElementById('deckSelectGrid');
    const detalhe = document.getElementById('deckSelectDetail');
    const confirmar = document.getElementById('deckSelectConfirm');
    if (!DeckSelect || !modal || !grade || !detalhe || !confirmar) {
        console.error('❌ Seletor de decks não carregado no game.html');
        return;
    }

    const opcoes = () => [...document.querySelectorAll('#deckSelectGrid .deck-option')];
    const ids = () => opcoes().map(botao => botao.dataset.deck);
    const opcao = id => document.querySelector(`#deckSelectGrid .deck-option[data-deck="${id}"]`);
    const presets = () => window.deckCatalog?.decks || [];
    const maoOuDeck = player => [
        ...window.gameState.players[player].zones.hand,
        ...window.gameState.players[player].zones.deck
    ];

    // 1. O boot já passou pelo seletor: a mesa existe e o modal ficou fechado.
    assert('o harness confirmou o deck e montou a mesa com 40 cartas por lado',
        maoOuDeck('p1').length === window.DECK_SIZE && maoOuDeck('p2').length === window.DECK_SIZE);
    assert('o modal do seletor ficou fechado depois da escolha',
        !modal.classList.contains('visible') && !DeckSelect.aberto());
    assert('a partida aleatória não registra preset no estado',
        window.gameState.deckSelections.p1 === null);

    // 2. Reabrir (gear "Trocar deck"): 4 presets + deck aleatório, todos em pilha.
    DeckSelect.abrir();
    assert('o seletor abre com o modal visível', modal.classList.contains('visible'));
    assert('cada deck do catálogo vira uma opção, mais o deck aleatório',
        presets().length >= 3 && ids().length === presets().length + 1
        && ids().includes(DeckSelect.RANDOM_ID));
    assert('toda opção traz a pilha de versos (cara de deck empilhado)',
        opcoes().every(botao => botao.querySelectorAll('.deck-stack-card').length === 5
            && botao.querySelector('.deck-stack-emblema')));
    assert('cada deck carrega a própria identidade de cor (CSS vars)',
        presets().every(deck => {
            const botao = opcao(deck.id);
            return botao
                && botao.style.getPropertyValue('--deck-primaria') === deck.cores.primaria
                && botao.style.getPropertyValue('--deck-secundaria') === deck.cores.secundaria;
        }));
    assert('a opção de deck aleatório fica marcada por padrão (sem preferência prévia)',
        opcao(DeckSelect.RANDOM_ID).classList.contains('selected'));
    assert('o detalhe do aleatório não inventa curva de custo',
        detalhe.textContent.includes('sorteio') && !detalhe.querySelector('.deck-cards-grid'));

    // 3. Selecionar um preset: detalhe com stats, curva, traits e cartas.
    const robotico = presets().find(deck => deck.id === 'robotico');
    opcao('robotico').click();
    assert('clicar seleciona a opção clicada', opcao('robotico').classList.contains('selected'));
    assert('o detalhe lista as cartas distintas do deck',
        detalhe.querySelectorAll('.deck-card-mini').length === new Set(robotico.cartas).size);
    assert('o detalhe mostra as três faixas de custo',
        detalhe.querySelectorAll('.deck-curva-linha').length === 3);
    assert('o detalhe mostra os traits do tema em chips',
        [...detalhe.querySelectorAll('.trait-chip')].map(chip => chip.textContent.toLowerCase())
            .some(texto => texto.includes('robótico')));
    assert('o botão de confirmação anuncia o deck escolhido',
        confirmar.disabled === false && confirmar.textContent.includes(robotico.nome));

    // 4. Traits no modal de detalhes da carta (criatura com traits e suporte sem).
    detalhe.querySelector('.deck-card-mini').click();
    const cardModal = document.getElementById('cardModal');
    assert('a miniatura do deck abre o modal de detalhes da carta',
        cardModal.classList.contains('visible'));
    assert('o modal de detalhes apresenta os traits da carta',
        Boolean(cardModal.querySelector('.modal-card-traits'))
        && cardModal.querySelectorAll('.modal-card-traits .trait-chip').length >= 1);
    window.closeCardModal();
    window.showCardModal(window.cardsDatabase.cards.find(carta => carta.id === 'card_001'));
    assert('suporte sem traits no catálogo não exibe a seção de traits',
        cardModal.classList.contains('visible') && !cardModal.querySelector('.modal-card-traits'));
    window.closeCardModal();

    // 5. Confirmar fecha o modal e resolve a escolha.
    window.confirmarSelecaoDeDeck();
    assert('confirmar fecha o seletor', !modal.classList.contains('visible') && !DeckSelect.aberto());

    // 6. "Trocar deck" no meio da partida: reabre, escolhe um preset e remonta a
    //    mesa com ele (a parte assíncrona é checada alguns instantes depois).
    window.trocarDeck();
    assert('trocarDeck reabre o seletor', modal.classList.contains('visible'));

    const furia = presets().find(deck => deck.id === 'furia');
    opcao('furia').click();
    window.confirmarSelecaoDeDeck();

    setTimeout(() => {
        const naMesa = maoOuDeck('p1').map(carta => carta.definitionId);
        assert('a nova partida abre com o preset escolhido e 40 cartas',
            naMesa.length === window.DECK_SIZE && naMesa.every(id => furia.cartas.includes(id)));
        assert('o baralho do preset vem embaralhado, com as cartas exatas (multiset)',
            [...naMesa].sort().join() === [...furia.cartas].sort().join());
        assert('o oponente do hotseat entra com deck aleatório',
            maoOuDeck('p2').length === window.DECK_SIZE);
        assert('o estado guarda a seleção do P1',
            window.gameState.deckSelections.p1?.id === 'furia');
        assert('a preferência fica salva no navegador (mesma chave do PvP)',
            DeckSelect.lerPreferencia() === 'furia');

        console.log(`\n🧪 Resultado seletor de decks: ${passed}/${passed + failed} checks`);
        console.log(failed === 0 ? '✅ o seletor de decks funciona ponta a ponta' : `❌ ${failed} falhas\n`);
    }, 600);
})();
