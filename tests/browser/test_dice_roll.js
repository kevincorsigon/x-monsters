// Dado da Sorte: o botão é filho direto da pílula de energia (centralizado) e o
// resultado aparece no próprio dado (face sorteada + "+N" subindo + pulso na
// energia), sem overlay no meio do tabuleiro e sem empurrar o layout — o "+N" era
// um div em fluxo dentro do `<button>` e quebrava a pílula. Roda em game.html.
(function runDiceRollTests() {
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

    console.log('🧪 ===== TESTES DO DADO DA SORTE =====\n');

    const state = window.gameState;
    const Model = window.GameStateModel;
    if (!state || !Model) {
        console.error('❌ Estado do jogo não carregado');
        return;
    }

    const botao = player => document.getElementById(`dice-${player}`);
    const energia = player => document.getElementById(`energy-${player}`);
    const valorEnergia = player => Model.getPlayerStat(state, 'energy', player);

    // 1. Centralização: o dado é filho direto da pílula, sem margem inline.
    const pilula = botao('p1').parentElement;
    assert('o dado é filho direto da pílula de energia',
        pilula.classList.contains('stat'));
    assert('o botão do dado não tem mais margem inline', !botao('p1').getAttribute('style'));

    const caixaPilula = pilula.getBoundingClientRect();
    const caixaBotao = botao('p1').getBoundingClientRect();
    assert('o dado fica dentro da pílula de energia',
        caixaBotao.top >= caixaPilula.top - 0.5 && caixaBotao.bottom <= caixaPilula.bottom + 0.5);
    assert('o dado está centralizado na vertical da pílula',
        Math.abs((caixaPilula.top + caixaPilula.height / 2) - (caixaBotao.top + caixaBotao.height / 2)) <= 1);

    // 2. Resultado (valor do servidor em PvP): face, "+N" e pulso na energia.
    state.diceUsed.p2 = false;
    const energiaAntes = valorEnergia('p2');
    const larguraBotao = botao('p2').offsetWidth;
    const alturaBotao = botao('p2').offsetHeight;
    const alturaPilula = pilula.getBoundingClientRect().height;

    window.rollDice('p2', 5);

    assert('o dado mostra a face sorteada', botao('p2').textContent.trim() === '5');
    assert('o dado sai da rolagem e entra no resultado',
        !botao('p2').classList.contains('dice-rolling') && botao('p2').classList.contains('dice-settled'));
    assert('a energia ganha é debitada do custo e creditada do resultado',
        valorEnergia('p2') === energiaAntes - 2 + 5);
    assert('o valor de energia exibido acompanha o estado',
        Number(energia('p2').textContent) === valorEnergia('p2'));
    assert('o dado fica marcado como usado', botao('p2').disabled === true
        && botao('p2').title.includes('5'));

    const flutuante = botao('p2').querySelector('.dice-result-floating');
    assert('o "+N" aparece ancorado no dado', Boolean(flutuante) && flutuante.textContent === '+5');
    const estiloFlutuante = flutuante ? getComputedStyle(flutuante) : null;
    assert('o "+N" é absoluto e não intercepta cliques',
        estiloFlutuante && estiloFlutuante.position === 'absolute' && estiloFlutuante.pointerEvents === 'none');
    assert('a energia ganha pulsa com a classe do dado',
        energia('p2').classList.contains('energy-gain-dice'));

    // 3. Layout: nada disso pode mover a pílula nem estourar a caixa (a regressão
    // era justamente o "+N" empurrando o conteúdo do botão).
    assert('o botão mantém a caixa de layout com o "+N" na tela',
        botao('p2').offsetWidth === larguraBotao && botao('p2').offsetHeight === alturaBotao);
    assert('a pílula de energia não cresce com o "+N" na tela',
        Math.abs(pilula.getBoundingClientRect().height - alturaPilula) < 0.5);
    assert('a pílula não estoura conteúdo',
        pilula.scrollWidth <= pilula.clientWidth + 1 && pilula.scrollHeight <= pilula.clientHeight + 1);
    assert('o "+N" não gera rolagem horizontal na página',
        document.documentElement.scrollWidth <= window.innerWidth + 1);

    // 4. Dado já usado: nem custo, nem segundo resultado.
    const energiaComDadoUsado = valorEnergia('p2');
    window.rollDice('p2', 6);
    assert('o dado já usado não cobra energia nem aplica outro resultado',
        valorEnergia('p2') === energiaComDadoUsado && botao('p2').textContent.trim() === '5');

    // 5. Rolagem local: a classe de rolagem entra no clique e o resultado só chega
    // depois (o valor aleatório vem no timeout de 800ms).
    state.diceUsed.p1 = false;
    const energiaP1Antes = valorEnergia('p1');
    window.rollDice('p1');
    assert('o custo de 2 energia sai no clique', valorEnergia('p1') === energiaP1Antes - 2);
    assert('o dado entra em rolagem até o resultado chegar',
        botao('p1').classList.contains('dice-rolling') && !botao('p1').disabled);

    // 6. Nova partida: o dado volta a rolar — inclusive o guard `diceRolled`, que
    // sobrevivia ao reset e engolia o resultado da partida seguinte.
    window.resetGame();
    assert('o reset devolve a face original do dado', botao('p2').textContent.trim() === '🎲');
    assert('o reset limpa as classes de animação e o guard',
        !botao('p2').classList.contains('dice-settled')
        && !botao('p2').classList.contains('dice-rolling')
        && botao('p2').dataset.diceRolled === undefined);
    assert('o reset reabilita o dado', botao('p2').disabled === false);

    const energiaNaPartidaNova = valorEnergia('p2');
    window.rollDice('p2', 3);
    assert('na partida seguinte o dado volta a dar energia',
        valorEnergia('p2') === energiaNaPartidaNova - 2 + 3 && botao('p2').textContent.trim() === '3');

    console.log(`\n🧪 Resultado dado da sorte: ${passed}/${passed + failed} checks`);
    console.log(failed === 0 ? '✅ o dado mostra o resultado sem quebrar o layout' : `❌ ${failed} falhas\n`);
})();
