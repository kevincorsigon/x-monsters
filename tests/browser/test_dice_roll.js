// Dado da Sorte: filho direto da pílula de energia (`.stat-energy`), na linha de
// baixo do `Energia: N`; o resultado aparece no próprio dado (face sorteada + "+N"
// subindo + pulso na energia), sem overlay no meio do tabuleiro e sem empurrar o
// layout — o "+N" era um div em fluxo dentro do `<button>` e quebrava a pílula.
// Roda em game.html.
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

    // 1. Linha de baixo: o dado é filho direto da pílula de energia e fica abaixo
    // do `Energia: N`, centralizado (CSS `.stat-energy`, grid).
    const pilula = botao('p1').parentElement;
    assert('o dado é filho direto da pílula de energia',
        pilula.classList.contains('stat') && pilula.classList.contains('stat-energy'));
    assert('o botão do dado não tem mais margem inline', !botao('p1').getAttribute('style'));

    const caixaPilula = pilula.getBoundingClientRect();
    const caixaBotao = botao('p1').getBoundingClientRect();
    const caixaValor = energia('p1').getBoundingClientRect();
    const caixaRotulo = pilula.querySelector('.stat-label').getBoundingClientRect();
    const centroX = caixa => caixa.left + caixa.width / 2;

    assert('o dado fica dentro da pílula de energia',
        caixaBotao.top >= caixaPilula.top - 0.5 && caixaBotao.bottom <= caixaPilula.bottom + 0.5);
    assert('o dado fica na linha de baixo, abaixo do valor de energia',
        caixaBotao.top >= caixaValor.bottom - 0.5);
    assert('o dado está centralizado na horizontal da pílula',
        Math.abs(centroX(caixaBotao) - centroX(caixaPilula)) <= 1.5);
    assert('rótulo e valor continuam na mesma linha',
        Math.abs((caixaRotulo.top + caixaRotulo.height / 2) - (caixaValor.top + caixaValor.height / 2)) <= 1);

    // 2. Resultado (valor do servidor em PvP): face do dado, "+N" e pulso na energia.
    state.diceUsed.p2 = false;
    const energiaAntes = valorEnergia('p2');
    const larguraBotao = botao('p2').offsetWidth;
    const alturaBotao = botao('p2').offsetHeight;
    const alturaPilula = pilula.getBoundingClientRect().height;

    window.rollDice('p2', 5);

    assert('o dado mostra o ícone da face sorteada',
        botao('p2').dataset.face === '5'
        && botao('p2').classList.contains('dice-face-5')
        && getComputedStyle(botao('p2')).backgroundImage.includes('dice-5.svg'));
    assert('só a face sorteada fica marcada no botão',
        [...botao('p2').classList].filter(c => c.startsWith('dice-face-')).length === 1);
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

    // 4. Dado já usado: o mesmo comando vindo do ledger (replay/F5/resync) não
    // cobra a energia de novo — o valor do servidor é a verdade da face.
    const energiaComDadoUsado = valorEnergia('p2');
    window.rollDice('p2', 6);
    assert('o dado já usado não cobra energia (o ledger só repinta a face)',
        valorEnergia('p2') === energiaComDadoUsado && botao('p2').dataset.face === '6');
    assert('o dado já usado segue desabilitado depois do repaint',
        botao('p2').disabled === true);
    // Volta para o valor da partida para as checagens de estado usadas adiante.
    window.rollDice('p2', 5);
    assert('o repaint do ledger mantém a energia intacta',
        valorEnergia('p2') === energiaComDadoUsado && botao('p2').dataset.face === '5');

    // 5. Rolagem local: a classe de rolagem entra no clique, as faces trocam (o
    // dado parece sendo sorteado) e o resultado só chega no timeout de 800ms.
    state.diceUsed.p1 = false;
    const energiaP1Antes = valorEnergia('p1');
    window.rollDice('p1');
    assert('o custo de 2 energia sai no clique', valorEnergia('p1') === energiaP1Antes - 2);
    assert('o dado entra em rolagem até o resultado chegar',
        botao('p1').classList.contains('dice-rolling') && !botao('p1').disabled);
    assert('a rolagem já mostra uma face de dado na tela',
        /^[1-6]$/.test(botao('p1').dataset.face || '')
        && [...botao('p1').classList].some(c => c.startsWith('dice-face-')));

    // 6. Nova partida: o dado volta a rolar — inclusive os guards (`diceRolled`) e
    // o giro de faces, que sobreviviam ao reset e engoliam a partida seguinte.
    window.resetGame();
    assert('o reset devolve o emoji do dado (sem face marcada)',
        botao('p2').textContent.trim() === '🎲' && botao('p2').dataset.face === undefined
        && ![...botao('p2').classList].some(c => c.startsWith('dice-face-')));
    assert('o reset limpa as classes de animação e os guards',
        !botao('p2').classList.contains('dice-settled')
        && !botao('p2').classList.contains('dice-rolling')
        && botao('p2').dataset.diceRolled === undefined);
    assert('o reset reabilita o dado', botao('p2').disabled === false);

    const energiaNaPartidaNova = valorEnergia('p2');
    const energiaP1NaPartidaNova = valorEnergia('p1');
    window.rollDice('p2', 3);
    assert('na partida seguinte o dado volta a dar energia',
        valorEnergia('p2') === energiaNaPartidaNova - 2 + 3 && botao('p2').dataset.face === '3');

    // 7. Depois do quique do resultado, quem manda na aparência é o `:disabled` do
    // CSS: sem anel dourado, dado dessaturado. Assíncrono de propósito — a classe
    // do quique só sai 500ms depois (o runner coleta os logs 1s depois).
    setTimeout(() => {
        assert('o quique do resultado sai depois da animação',
            !botao('p2').classList.contains('dice-settled'));

        const usado = getComputedStyle(botao('p2'));
        assert(`já jogado: o botão fica desativado pelo CSS`
            + ` [filter=${usado.filter} opacity=${usado.opacity} cursor=${usado.cursor} border=${usado.borderColor}]`,
            usado.filter === 'grayscale(1) brightness(0.7)'
            && Number(usado.opacity) <= 0.35
            && usado.cursor === 'not-allowed'
            && !usado.borderColor.includes('212, 175, 55'));

        // O hover não pode ressuscitar o visual de botão ativo (era o `:hover` cru
        // do `.mini-button`: dourado e `scale(1.1)` no dado já usado).
        const seletores = [...document.styleSheets].flatMap(sheet => {
            // Folha cross-origin (Google Fonts) nega `cssRules`.
            try { return [...sheet.cssRules].map(regra => regra.selectorText || ''); } catch (_) { return []; }
        });
        assert('o hover do botão só vale para botão disponível',
            seletores.includes('.mini-button:not(:disabled):hover')
            && !seletores.includes('.mini-button:hover'));

        // Clique desabilitado de verdade: nem custo, nem novo resultado, nem giro.
        const energiaAntesDoClique = valorEnergia('p2');
        botao('p2').click();
        assert('clicar no dado já usado não faz nada',
            valorEnergia('p2') === energiaAntesDoClique
            && botao('p2').dataset.face === '3'
            && !botao('p2').classList.contains('dice-rolling'));

        // A rolagem local de p1 (800ms) foi interrompida pelo reset: o resultado
        // pendente da partida antiga não pode cair na partida nova.
        assert('o resultado pendente da partida anterior não aplica na nova',
            !botao('p1').classList.contains('dice-rolling')
            && ![...botao('p1').classList].some(c => c.startsWith('dice-face-'))
            && valorEnergia('p1') === energiaP1NaPartidaNova
            && state.diceUsed.p1 === false);

        console.log(`\n🧪 Resultado dado da sorte: ${passed}/${passed + failed} checks`);
        console.log(failed === 0 ? '✅ o dado mostra o resultado sem quebrar o layout' : `❌ ${failed} falhas\n`);
    }, 800);
})();
