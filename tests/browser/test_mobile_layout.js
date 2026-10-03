// Regressão: o palco precisa ser jogável em telefone. O `.game-container`
// declara só `grid-template-rows`: a coluna implícita (`auto`) assumia o
// min-content dos filhos, somava ~480px (faixa da mão alheia + stats + pilhas)
// e o `overflow: hidden` do body recortava a direita. Como `.controls` é
// `justify-self: center`, a barra nascia fora de centro e "Combate" / "Fim
// Turno" ficavam fora de alcance — o print 390x844 do relato.
// A camada `src/css/mobile.css` entra por media query no <link>; aqui a métrica
// de celular é aplicada pelo runner (`Emulation.setDeviceMetricsOverride`).
// Roda contra game.html.
(function runMobileLayoutTests() {
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

    console.log('🧪 ===== TESTES DE LAYOUT DE CELULAR =====\n');

    const retrato = window.innerWidth < window.innerHeight;
    const largura = window.innerWidth;
    const altura = window.innerHeight;

    assert(`o runner aplicou a métrica de celular (janela ${largura}x${altura})`,
        largura === 390 && altura === 844);

    const raiz = document.documentElement;
    const palco = document.querySelector('.game-container');
    const colunas = getComputedStyle(palco).gridTemplateColumns.trim();
    assert(`o palco tem uma coluna só de célula (colunas: ${colunas})`,
        !colunas.includes(' '));
    assert(`o palco cabe na janela (${colunas})`,
        parseFloat(colunas) <= largura);

    // O estouro lateral era a causa raiz: nada pode passar da janela.
    assert(`sem rolagem horizontal no documento (scrollWidth ${raiz.scrollWidth} <= ${largura})`,
        raiz.scrollWidth <= largura + 1);
    assert(`sem rolagem horizontal no body (scrollWidth ${document.body.scrollWidth})`,
        document.body.scrollWidth <= largura + 1);

    const tokenMao = getComputedStyle(document.body).getPropertyValue('--hand-card-w');
    assert(`os tokens de celular estão ativos (--hand-card-w: ${tokenMao.trim()})`,
        tokenMao.includes('min('));
    const tokenSlot = getComputedStyle(document.body).getPropertyValue('--field-slot-w');
    assert(`o slot do campo tem teto de celular (--field-slot-w: ${tokenSlot.trim()})`,
        tokenSlot.includes('min('));

    // ── Barra de comando: fases e Fim Turno alcançáveis ──────────────────
    const dentro = el => {
        const r = el.getBoundingClientRect();
        return r.left >= -0.5 && r.right <= largura + 0.5 && r.top >= -0.5 && r.bottom <= altura + 0.5;
    };
    const clicavel = el => {
        const r = el.getBoundingClientRect();
        const noPonto = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
        return noPonto === el || (noPonto && el.contains(noPonto));
    };

    const barra = document.querySelector('.controls');
    const caixaBarra = barra.getBoundingClientRect();
    assert(`a barra de comando ocupa a largura do palco (${Math.round(caixaBarra.width)}px)`,
        caixaBarra.width >= largura - 20);
    assert('a barra de comando está inteira na tela', dentro(barra));

    document.querySelectorAll('.phase-button').forEach(botao => {
        const r = botao.getBoundingClientRect();
        assert(`fase "${botao.textContent.trim()}" na tela com alvo de toque (${Math.round(r.width)}x${Math.round(r.height)})`,
            dentro(botao) && r.height >= 44 && r.width >= 40 && clicavel(botao));
    });

    const fimTurno = [...document.querySelectorAll('.controls .action-button')]
        .find(b => b.textContent.includes('Fim Turno'));
    assert('o botão "Fim Turno" existe na barra', Boolean(fimTurno));
    if (fimTurno) {
        const r = fimTurno.getBoundingClientRect();
        assert(`"Fim Turno" na tela, com 44px de alvo e recebendo o toque (${Math.round(r.width)}x${Math.round(r.height)})`,
            dentro(fimTurno) && r.height >= 44 && clicavel(fimTurno));
    }

    const engrenagem = document.querySelector('.gear-btn');
    const rEngrenagem = engrenagem.getBoundingClientRect();
    assert(`o menu de opções continua alcançável (${Math.round(rEngrenagem.width)}x${Math.round(rEngrenagem.height)})`,
        dentro(engrenagem) && rEngrenagem.width >= 40 && clicavel(engrenagem));

    // ── Mão local: tira reta, contida e com rolagem quando enche ─────────
    const assento = document.body.dataset.seat;
    const local = document.getElementById(`hand-${assento === 'p2' ? 'p2' : 'p1'}`);
    const faixaLocal = local && local.closest('.player1-hand, .player2-hand');
    assert('a tira da mão local foi encontrada', Boolean(local && faixaLocal));

    if (local && faixaLocal) {
        const estilo = getComputedStyle(local);
        assert(`a mão local rola de lado em vez de vazar (overflow-x: ${estilo.overflowX})`,
            estilo.overflowX === 'auto');
        assert('a faixa da mão local está inteira na tela', dentro(faixaLocal));
        assert('as cartas da mão local estão em fila reta (sem arco)',
            [...local.querySelectorAll(':scope > .card')].every(carta =>
                getComputedStyle(carta).transform === 'none'));
        if (retrato) {
            assert(`em retrato a mão ocupa a largura da tela (${Math.round(faixaLocal.getBoundingClientRect().width)}px)`,
                faixaLocal.getBoundingClientRect().width >= largura - 20);
        }
    }

    // ── Mão alheia: pílula discreta, sem estourar a faixa ────────────────
    const alheio = document.getElementById(`hand-${assento === 'p2' ? 'p1' : 'p2'}`);
    if (alheio && alheio.children.length) {
        const faixaAlheia = alheio.closest('.player1-hand, .player2-hand');
        assert(`a mão alheia fica contida na faixa (client ${alheio.clientWidth} / scroll ${alheio.scrollWidth})`,
            alheio.scrollWidth <= alheio.clientWidth + 1 && dentro(faixaAlheia));
        assert('os versos do oponente viram textura (até 24px por carta)',
            [...alheio.querySelectorAll(':scope > .card')].every(carta =>
                carta.getBoundingClientRect().width <= 24));
    }

    // ── Campos: sobra altura para as cartas nos dois assentos ────────────
    ['p1', 'p2'].forEach(jogador => {
        const campo = document.getElementById(`field-${jogador}`);
        const r = campo.getBoundingClientRect();
        const minimo = retrato ? 150 : 70;
        assert(`campo ${jogador} na tela e com altura útil (${Math.round(r.height)}px)`,
            dentro(campo) && r.height >= minimo);
    });

    // ── Assento p2: a armadilha das áreas do grid do pvp.css ────────────
    // No assento p2 o `pvp.css` troca as ÁREAS e `.zone-opponent` passa a ser a
    // faixa do PRÓPRIO jogador: a mão local é `#hand-p2`. A camada escolhe a mão
    // pela CLASSE por assento — se ela escorregasse para `.zone-*`, aqui a mão do
    // jogador viraria a pílula de 20px dos versos do oponente.
    document.body.dataset.seat = 'p2';
    const localP2 = document.getElementById('hand-p2');
    const alheioP1 = document.getElementById('hand-p1');
    const faixaP2 = localP2.closest('.player2-hand');
    assert('no assento p2 a mão do nó #hand-p2 é a mão local (rola de lado)',
        getComputedStyle(localP2).overflowX === 'auto');
    assert('no assento p2 a mão local ocupa a largura da faixa',
        faixaP2.getBoundingClientRect().width >= largura - 20);
    assert('no assento p2 as cartas da mão local ficam em fila reta e no tamanho de mão',
        [...localP2.querySelectorAll(':scope > .card')].every(carta =>
            getComputedStyle(carta).transform === 'none' &&
            carta.getBoundingClientRect().width >= 40));
    assert('no assento p2 a mão alheia (#hand-p1) é que vira textura de versos',
        [...alheioP1.querySelectorAll(':scope > .card')].every(carta =>
            carta.getBoundingClientRect().width <= 24));
    document.body.dataset.seat = 'p1';

    // O botão de espiar não cabe na faixa de 40px do celular (e no PvP já é
    // escondido): ele não pode reaparecer por cima da mão.
    assert('o botão "Espiar Mão" não ocupa a faixa do celular',
        [...document.querySelectorAll('.peek-hand-btn')].every(b => getComputedStyle(b).display === 'none'));

    // ── Toasts vetados no celular ────────────────────────────────────────
    // A coluna de avisos do canto direito comia ~1/3 da tela retrato e cobria a
    // mão. O veto é de APRESENTAÇÃO, não do núcleo: o container continua no HTML e
    // `mostrarToast` continua criando o toast (só não é pintado). É esse contrato
    // que permite reexibir avisos no celular depois, com outro container, sem
    // tocar em game.js.
    const avisos = document.getElementById('message-toasts');
    assert('a tela continua declarando o container de avisos (núcleo intacto)',
        Boolean(avisos));
    assert('o container de avisos não é apresentado no celular',
        Boolean(avisos) && getComputedStyle(avisos).display === 'none');

    if (avisos && typeof window.showMessage === 'function') {
        const antes = avisos.querySelectorAll('.message-toast').length;
        window.showMessage('Aviso de teste do celular');
        const criados = avisos.querySelectorAll('.message-toast');
        assert('o aviso continua entrando no container (só não é pintado)',
            criados.length === antes + 1);
        const novo = criados[criados.length - 1];
        const caixaNovo = novo.getBoundingClientRect();
        assert('o aviso criado no celular não ocupa pixel nenhum',
            Boolean(novo) && caixaNovo.width === 0 && caixaNovo.height === 0);
        assert('o aviso não intercepta toque nem com o container vetado',
            getComputedStyle(avisos).pointerEvents === 'none' ||
            getComputedStyle(avisos).display === 'none');
        criados.forEach(el => el.remove());
    }

    console.log(`\n🧪 Resultado layout de celular: ${passed}/${passed + failed} checks`);
    console.log(failed === 0 ? '✅ o palco é jogável em 390x844' : `❌ ${failed} falhas\n`);
})();
