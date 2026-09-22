// Testes do modo PvM (jogador vs máquina). Roda contra game.html — a página já
// ativa o driver (`window.__pvm`/`window.PvmGame`) no boot, então este script
// valida a configuração de ocultação e a decisão/execução da IA no contexto real.
(function runPvmTests() {
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

    console.log('🧪 ===== TESTES PvM (jogador vs máquina) =====\n');

    const PvmAi = window.PvmAi;
    const PvmGame = window.PvmGame;
    const Model = window.GameStateModel;
    const CardRules = window.CardRules;
    const state = window.gameState;
    const engine = window.gameEngine;

    if (!PvmAi || !PvmGame || !Model || !CardRules || !state || !engine) {
        console.error('❌ Módulos PvM/estado não carregados');
        return;
    }

    const versos = player => document.querySelectorAll(`#hand-${player} .card-back`).length;
    const cartas = player => document.querySelectorAll(`#hand-${player} .card`).length;

    // 1. Configuração de modo e ocultação da máquina.
    assert('modo PvM marcado', window.__pvm === true);
    assert('assento local é p1 (humano)', document.body.dataset.seat === 'p1');
    assert('mão da máquina nasce toda em verso', versos('p2') === state.players.p2.zones.hand.length && cartas('p2') === versos('p2'));
    assert('mão do humano não tem verso', versos('p1') === 0);
    assert('espiar a mão da máquina foi removido', !document.querySelector('.player2-hand .peek-hand-btn'));
    assert('dado da máquina fica desabilitado', document.getElementById('dice-p2').disabled === true);
    assert('deck da máquina não tem onclick inline', document.querySelector('.player2-deck').getAttribute('onclick') === null);
    assert('máquina se chama "Computador" no estado', Model.getPlayerName(state, 'p2') === 'Computador');
    assert('rótulo da máquina mostra "Computador"', (document.querySelector('.player2-stats .player-name')?.textContent || '').trim() === 'Computador');
    const versoEl = document.querySelector('#hand-p2 .card-back');
    const bgVerso = versoEl ? getComputedStyle(versoEl).backgroundImage : '';
    assert('verso da máquina usa a arte X Monsters (verso.jpeg)', bgVerso.includes('verso.jpeg'));
    const opacidadeMao = getComputedStyle(document.getElementById('hand-p2')).opacity;
    assert('mão da máquina fica translúcida (não cobre o campo)', Number(opacidadeMao) < 1);

    // 2. Decisão da IA sobre estado determinístico (sem efeito colateral).
    function montar(phase) {
        Model.resetMatchState(state, { p1: [], p2: [] }, window.gameConfig);
        state.currentPlayer = 'p2';
        state.currentPhase = phase;
        state.players.p2.energy = 10;
        state.players.p2.maxEnergy = 10;
    }

    function criar(id, dono, options = {}, zona = 'hand') {
        const card = Model.createCardInstance({
            id,
            name: options.name || id,
            type: options.type || 'criatura',
            cost: options.cost ?? 3,
            attack: options.attack ?? 1,
            defense: options.defense ?? 1
        }, dono, { instanceId: `${id}_${dono}` });
        Model.registerCard(state, card, zona, dono);
        return card;
    }

    const opcoes = () => ({ rules: CardRules, rng: () => 0.5 });

    // 2a. invocação: escolhe a criatura de melhor custo-benefício.
    montar('invocation');
    const barata = criar('barata', 'p2', { cost: 2, attack: 2, defense: 3 });
    criar('cara', 'p2', { cost: 9, attack: 9, defense: 9 });
    const cmdInvoca = PvmAi.decidirJogada(state, engine, 'p2', opcoes());
    assert('IA decide invocar a carta barata', cmdInvoca && cmdInvoca.type === 'summon' && cmdInvoca.cardId === barata.instanceId);

    // 2b. equipar suporte na criatura própria.
    montar('invocation');
    const criatura = criar('criatura', 'p2', { attack: 5, defense: 5 }, 'field');
    const suporte = criar('suporte', 'p2', { type: 'suporte', cost: 1, attack: 2, defense: 0 });
    const cmdEquipa = PvmAi.decidirJogada(state, engine, 'p2', opcoes());
    assert('IA decide equipar o suporte', cmdEquipa && cmdEquipa.type === 'equip' && cmdEquipa.creatureId === criatura.instanceId);

    // 2c. ativar habilidade (sabotar_copo) no inimigo mais forte.
    montar('combat');
    const fonte = criar('card_026', 'p2', { attack: 10, defense: 10 }, 'field');
    criar('inimigo_fraco', 'p1', { attack: 2, defense: 2 }, 'field');
    const inimigoForte = criar('inimigo_forte', 'p1', { attack: 8, defense: 8 }, 'field');
    const cmdHabilidade = PvmAi.decidirJogada(state, engine, 'p2', opcoes());
    assert('IA decide ativar a habilidade no alvo mais forte',
        cmdHabilidade && cmdHabilidade.type === 'ability' && cmdHabilidade.cardId === fonte.instanceId &&
        cmdHabilidade.targetIds && cmdHabilidade.targetIds[0] === inimigoForte.instanceId);

    // 3. Execução real dos comandos (o caminho que o driver usa).
    montar('invocation');
    const invocada = criar('invocada', 'p2', { cost: 2, attack: 3, defense: 3 });
    PvmGame.executarComando({ type: 'summon', cardId: invocada.instanceId });
    assert('executarComando move a carta para o campo da máquina',
        state.players.p2.zones.field.some(c => c.instanceId === invocada.instanceId));
    assert('campo da máquina exibe a carta invocada',
        document.querySelectorAll('#field-p2 .card').length === 1);

    montar('invocation');
    const alvoEquip = criar('alvo', 'p2', { attack: 4, defense: 4 }, 'field');
    const suporteExec = criar('suporte_exec', 'p2', { type: 'suporte', cost: 1, attack: 1, defense: 0 });
    PvmGame.executarComando({ type: 'equip', cardId: suporteExec.instanceId, creatureId: alvoEquip.instanceId });
    assert('equipar suporte tira a carta da mão da máquina', state.players.p2.zones.hand.length === 0);
    assert('equipar suporte anexa ao equipamento da criatura',
        state.players.p2.zones.equipment.some(c => c.instanceId === suporteExec.instanceId));

    console.log(`\n🧪 Resultado PvM: ${passed}/${passed + failed} checks`);
    console.log(failed === 0 ? '✅ máquina decide e executa pelo motor compartilhado' : `❌ ${failed} falhas\n`);
})();
