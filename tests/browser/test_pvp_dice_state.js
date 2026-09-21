// Dado da sorte nas duas telas do PvP: o "já jogado" é estado (`diceUsed`) e o
// bloqueio por turno não pode reabilitar o botão. Antes disso o dado usado
// acendia de novo quando o turno voltava ao dono (o botão parecia disponível e
// o clique só mostrava o aviso), enquanto a outra tela o mostrava apagado.
// Roda contra pvp.html, sem servidor: o ledger é dirigido aqui.
(function runPvpDiceStateTests() {
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

    console.log('🧪 ===== TESTES DO DADO NO PVP (estado igual nas duas telas) =====\n');

    const PvpGame = window.PvpGame;
    const SessionClass = window.PvpSession?.PvpSession;
    const Model = window.GameStateModel;
    const state = window.gameState;
    if (!PvpGame || !SessionClass || !Model || !window.deckBuilder || !PvpGame.atualizarBloqueioPorTurno) {
        console.error('❌ Ponte PvP/estado/decks não carregados');
        return;
    }

    const botao = player => document.getElementById(`dice-${player}`);
    const energia = player => Model.getPlayerStat(state, 'energy', player);
    const apagado = player => {
        const cs = getComputedStyle(botao(player));
        return cs.opacity === '0.35' && cs.filter.includes('grayscale(1)');
    };

    const decks = window.deckBuilder.createMatchDecks(50);
    const sessao = new SessionClass({
        transportSend: () => {},
        gameState: state,
        seat: 'p1',
        applyCommand: () => {},
        onEvent: () => {}
    });
    PvpGame.setSession(sessao);
    PvpGame.setSeat('p1');
    document.body.dataset.seat = 'p1';

    const abertura = () => ({
        type: 'MATCH_START',
        seat: 'p1',
        opponentSeat: 'p2',
        seed: 707,
        deck: decks.player1,
        opponentDeckSize: 50,
        config: { initialPv: 200, initialEnergy: 6 },
        state: { maos: { p1: 4, p2: 4 }, assentos: {} }
    });

    PvpGame.montarPartida(abertura());
    PvpGame.atualizarBloqueioPorTurno();

    // 1. Partida nova: o dado do oponente nunca é clicável por este jogador.
    assert('o dado do oponente fica bloqueado para mim', botao('p2').disabled === true);
    assert('o meu dado nasce disponível no meu turno', botao('p1').disabled === false);
    assert('nenhum dado nasce com face sorteada',
        botao('p1').dataset.face === undefined && botao('p2').dataset.face === undefined);

    // 2. O ledger roda nos dois clientes: o ROLL_DICE do oponente aplica energia e
    //    marca o dado dele como usado (mesma verdade que a outra tela mostra).
    const energiaP2 = energia('p2');
    window.rollDice('p2', 4);
    assert('o dado do oponente mostra a face sorteada', botao('p2').dataset.face === '4');
    assert('o dado do oponente fica desabilitado', botao('p2').disabled === true);
    assert('a energia do oponente paga 2 e soma o valor', energia('p2') === energiaP2 - 2 + 4);
    assert('o estado marca o dado do oponente como usado', state.diceUsed.p2 === true);

    // 3. Repaint do bloqueio por turno (SYNCED/END_TURN): o oponente NÃO pode
    //    voltar a parecer disponível — era o bug relatado.
    PvpGame.atualizarBloqueioPorTurno();
    assert('repaint não reabilita o dado usado do oponente', botao('p2').disabled === true);

    // 4. Meu dado: usado pelo ledger, apagado e sem clique.
    const energiaP1 = energia('p1');
    window.rollDice('p1', 6);
    assert('o meu dado mostra a face sorteada', botao('p1').dataset.face === '6');
    assert('a minha energia paga 2 e soma o valor', energia('p1') === energiaP1 - 2 + 6);

    state.currentPlayer = 'p2';
    PvpGame.atualizarBloqueioPorTurno();
    assert('no turno do oponente os dois dados ficam bloqueados',
        botao('p1').disabled === true && botao('p2').disabled === true);

    // 5. O turno volta para mim: o dado já jogado continua desabilitado e apagado
    //    (era aqui que ele "acendia" e chamava atenção ao lado da energia).
    state.currentPlayer = 'p1';
    PvpGame.atualizarBloqueioPorTurno();
    assert('o meu dado usado não reabilita quando o turno volta', botao('p1').disabled === true);
    assert('o meu dado usado mantém a face', botao('p1').dataset.face === '6');

    // 6. Clique no dado já usado não faz nada (nem energia, nem novo sorteio).
    const energiaAntesDoClique = energia('p1');
    botao('p1').click();
    assert('clicar no dado já usado não gasta nem sorteia',
        energia('p1') === energiaAntesDoClique && state.diceUsed.p1 === true);

    // 7. Idempotência do applier: o mesmo ROLL_DICE reaplicado (replay/resync) só
    //    repinta — a energia não é paga duas vezes (divergência entre as telas).
    const energiaAntesDoReplay = energia('p1');
    window.rollDice('p1', 6);
    assert('reaplicar o ROLL_DICE não paga a energia de novo', energia('p1') === energiaAntesDoReplay);
    assert('reaplicar mantém a face e o botão desabilitado',
        botao('p1').dataset.face === '6' && botao('p1').disabled === true);

    // 8. MATCH_START repetido (F5/reconexão): o dado volta ao estado de partida
    //    nova, para o replay do ledger poder recontabilizar a energia do zero.
    PvpGame.montarPartida(abertura());
    assert('o remount limpa a face e o "já usado"',
        botao('p1').dataset.face === undefined
        && botao('p1').dataset.diceRolled === undefined
        && botao('p1').classList.contains('dice-rolling') === false);
    assert('o estado do remount nasce com os dados livres',
        state.diceUsed.p1 === false && state.diceUsed.p2 === false);

    const energiaRemontada = energia('p1');
    window.rollDice('p1', 3);
    assert('o replay após remount recontabiliza o dado', energia('p1') === energiaRemontada - 2 + 3);

    PvpGame.atualizarBloqueioPorTurno();
    assert('depois do replay o dado do remount fica desabilitado', botao('p1').disabled === true);

    // 9. O visual do "já jogado" vem do CSS (`:disabled`): a regra é conferida na
    //    folha (imediato) e o valor computado depois da transição de 300ms.
    const regras = [...document.styleSheets].flatMap(sheet => {
        try { return [...sheet.cssRules].map(regra => regra.selectorText || ''); } catch (_) { return []; }
    });
    assert('o "já jogado" é desenhado pelo :disabled do CSS',
        regras.includes('.dice-button:disabled') && regras.includes('.dice-button:disabled:hover'));

    setTimeout(() => {
        const meu = getComputedStyle(botao('p1'));
        assert(`meu dado usado: apagado [filter=${meu.filter} opacity=${meu.opacity} cursor=${meu.cursor}]`,
            meu.filter === 'grayscale(1) brightness(0.7)'
            && Number(meu.opacity) <= 0.35
            && meu.cursor === 'not-allowed'
            && !meu.borderColor.includes('212, 175, 55'));
        const doOponente = getComputedStyle(botao('p2'));
        assert('o dado do oponente tem o mesmo visual apagado',
            doOponente.filter === 'grayscale(1) brightness(0.7)' && Number(doOponente.opacity) <= 0.35);

        console.log(`\n🧪 Resultado dado no PvP: ${passed}/${passed + failed} checks`);
        console.log(failed === 0 ? '✅ o dado é igual nas duas telas (usado = desabilitado)' : `❌ ${failed} falhas\n`);
    }, 900);
})();
