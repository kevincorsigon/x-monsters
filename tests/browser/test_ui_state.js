(function runUiStateTests() {
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

    // 1. Energia de p1 começa em 7 (fase de energia aplicada no init)
    const energyEl = document.getElementById('energy-p1');
    assert('Energia p1 inicial = 7', energyEl && parseInt(energyEl.textContent) === 7);

    // 2. Energia de p2 começa em 6 (p2 ainda não jogou)
    const energyP2El = document.getElementById('energy-p2');
    assert('Energia p2 inicial = 6', energyP2El && parseInt(energyP2El.textContent) === 6);

    // 3. Sem botões +/- de PV para p1
    const pvP1Buttons = document.querySelectorAll('.player1-stats button.mini-button:not(.dice-button)');
    assert('Sem botões +/- de PV para p1', pvP1Buttons.length === 0);

    // 4. Sem botões +/- de PV para p2
    const pvP2Buttons = document.querySelectorAll('.player2-stats button.mini-button:not(.dice-button)');
    assert('Sem botões +/- de PV para p2', pvP2Buttons.length === 0);

    // 5. Gear ⚙️ no canto esquerdo extremo da barra de comando, na altura do HUD
    const gearBtn = document.querySelector('.gear-btn');
    const controls = document.querySelector('.controls');
    const hud = document.querySelector('.hud');
    assert('Botão do gear ⚙️ existe', gearBtn !== null);
    assert('Gear vive dentro da barra de comando', gearBtn && gearBtn.closest('.controls') === controls);

    if (gearBtn && controls && hud) {
        const caixa = el => el.getBoundingClientRect();
        const bGear = caixa(gearBtn);
        const bBarra = caixa(controls);
        const bHud = caixa(hud);
        const borda = parseFloat(getComputedStyle(controls).borderLeftWidth) || 0;
        const respiro = parseFloat(getComputedStyle(controls).paddingLeft) || 0;

        assert('Gear é o primeiro elemento da barra',
            controls.firstElementChild === gearBtn.closest('.gear-menu'));
        assert(
            `Gear colado no canto esquerdo da barra (${Math.round(bGear.left - bBarra.left - borda - respiro)}px do padding)`,
            Math.abs(bGear.left - bBarra.left - borda - respiro) <= 1
        );
        assert(
            `Gear na MESMA altura do HUD (centros ${Math.round(bGear.top + bGear.height / 2)} vs ${Math.round(bHud.top + bHud.height / 2)})`,
            Math.abs((bGear.top + bGear.height / 2) - (bHud.top + bHud.height / 2)) <= 1
        );
        const pilulaHud = document.querySelector('.hud-toggle');
        const linhaHud = pilulaHud ? caixa(pilulaHud).height : bGear.height;
        assert(
            `Gear tem a altura da pílula do HUD (${Math.round(bGear.height)}px vs ${Math.round(linhaHud)}px)`,
            Math.abs(bGear.height - linhaHud) <= 1
        );
        assert('Gear dentro dos limites da barra',
            bGear.top >= bBarra.top - 1 && bGear.bottom <= bBarra.bottom + 1);
    }

    // 6. Dropdown de opções existe e está fechado
    const dropdown = document.getElementById('gearDropdown');
    assert('Dropdown existe', dropdown !== null);
    assert('Dropdown começa fechado', dropdown && !dropdown.classList.contains('open'));
    assert('Dropdown é ancorado dentro da barra', dropdown && dropdown.closest('.controls') === controls);

    // 6b. Aberto: pendura abaixo do botão, no canto esquerdo, sem ser coberto
    if (gearBtn && dropdown) {
        gearBtn.click();
        const bGear = gearBtn.getBoundingClientRect();
        const bMenu = dropdown.getBoundingClientRect();
        const alvo = dropdown.querySelector('button');
        const bAlvo = alvo.getBoundingClientRect();
        const noTopo = document.elementFromPoint(
            bAlvo.left + bAlvo.width / 2,
            bAlvo.top + bAlvo.height / 2
        );
        assert('Gear abre o dropdown', dropdown.classList.contains('open'));
        assert(
            `Dropdown abre abaixo do botão (${Math.round(bMenu.top - bGear.bottom)}px)`,
            bMenu.top >= bGear.bottom
        );
        assert(
            `Dropdown alinhado ao canto esquerdo do gear (${Math.round(bMenu.left - bGear.left)}px)`,
            Math.abs(bMenu.left - bGear.left) <= 1
        );
        assert('Dropdown fica clicável, acima do resto da barra',
            noTopo !== null && !!noTopo.closest('.gear-dropdown'));
        assert('Dropdown cabe na tela',
            bMenu.bottom <= window.innerHeight && bMenu.right <= window.innerWidth);

        // Preenchido: o painel abre sobre o campo e não pode ser vazado.
        const alfaDe = el => {
            const cor = getComputedStyle(el).backgroundColor;
            const canais = cor.match(/rgba?\(([^)]+)\)/);
            if (!canais) return 0;
            const partes = canais[1].split(',').map(v => parseFloat(v));
            return partes.length === 4 ? partes[3] : 1;
        };
        assert(`Painel preenchido, sem transparência (${getComputedStyle(dropdown).backgroundColor})`,
            alfaDe(dropdown) >= 0.99);
        assert(`Botão do gear preenchido (${getComputedStyle(gearBtn).backgroundColor})`,
            alfaDe(gearBtn) >= 0.99);

        gearBtn.click();
        assert('Gear fecha o dropdown', !dropdown.classList.contains('open'));
    }

    // 7. Reset e Decks não estão no .control-section
    const controlSection = document.querySelector('.control-section');
    const resetInControl = controlSection && Array.from(controlSection.querySelectorAll('button'))
        .some(b => b.textContent.includes('Reset'));
    const decksInControl = controlSection && Array.from(controlSection.querySelectorAll('button'))
        .some(b => b.textContent.includes('Decks'));
    assert('Reset não está no menu central', !resetInControl);
    assert('Decks não está no menu central', !decksInControl);

    // 8. Reset e Decks estão no dropdown do ⚙️
    const resetInDropdown = dropdown && Array.from(dropdown.querySelectorAll('button'))
        .some(b => b.textContent.includes('Reset'));
    const decksInDropdown = dropdown && Array.from(dropdown.querySelectorAll('button'))
        .some(b => b.textContent.includes('Decks'));
    assert('Reset está no dropdown ⚙️', resetInDropdown);
    assert('Decks está no dropdown ⚙️', decksInDropdown);

    // 9. Faixas do palco: a faixa da mão do jogador 1 encolheu 15% — a sobra é
    //    altura de campo (os dois campos vivem no board).
    const faixas = ['.zone-opponent', '.board', '.zone-player']
        .map(sel => document.querySelector(sel))
        .filter(Boolean);
    assert('As três faixas do palco existem', faixas.length === 3);

    if (faixas.length === 3) {
        const [altOponente, altBoard, altMao] = faixas.map(el => el.getBoundingClientRect().height);
        const soma = altOponente + altBoard + altMao;
        const pct = v => (v / soma * 100).toFixed(1);
        const resumo = `mão ${pct(altMao)}% | board ${pct(altBoard)}% | oponente ${pct(altOponente)}%`;

        assert(`A faixa da mão fica com no máximo 30% do palco (${resumo})`,
            altMao / soma <= 0.30);
        assert(`O board (os dois campos) é a maior faixa (${resumo})`,
            altBoard > altMao && altBoard > altOponente);
        assert(`O board sozinho tem mais altura que as outras duas faixas juntas (${resumo})`,
            altBoard > altMao + altOponente);
        assert(`A faixa do oponente segue compacta (${resumo})`, altOponente / soma <= 0.20);

        // O leque acompanha a faixa: se a carta vazar, ela invade o campo e o
        // clique nas criaturas fica disputado com a mão.
        const cartaMao = document.querySelector('.zone-player .player1-hand .card');
        if (cartaMao) {
            const bCarta = cartaMao.getBoundingClientRect();
            const bFaixa = document.querySelector('.zone-player').getBoundingClientRect();
            assert(
                `O leque cabe dentro da faixa da mão (topo ${Math.round(bCarta.top - bFaixa.top)}px, base ${Math.round(bCarta.bottom - bFaixa.bottom)}px)`,
                bCarta.top >= bFaixa.top - 2 && bCarta.bottom <= bFaixa.bottom + 2
            );
        }
    }

    // 9b. Redesenho da mão do oponente: tira reta e compacta AO LADO do título —
    //     sem leque (nenhuma rotação) e sem o texto por cima das cartas.
    const maoAlheia = document.querySelector('.zone-opponent .player2-hand');
    if (maoAlheia) {
        const bMao = maoAlheia.getBoundingClientRect();
        const bFaixaOpo = document.querySelector('.zone-opponent').getBoundingClientRect();
        const estMao = getComputedStyle(maoAlheia);
        assert('A mão do oponente vira linha (título ao lado dos versos)',
            estMao.flexDirection === 'row');
        assert(`A tira da mão alheia é mais estreita que a faixa (${Math.round(bMao.width)}px de ${Math.round(bFaixaOpo.width)}px)`,
            bMao.width < bFaixaOpo.width * 0.9);
        assert('A mão do oponente segue sem capturar ponteiro (versos ilustrativos)',
            estMao.pointerEvents === 'none');
        assert('A mão do oponente recorta a própria área', estMao.overflow === 'hidden');

        // Centralização: o desvio da mão em relação ao meio da faixa não pode
        // passar de metade da diferença entre os blocos das pontas (stats vs
        // pilhas) — em janela larga os dois são iguais e o desvio vai a zero.
        const bStatsOpo = document.querySelector('.zone-opponent .stats-block');
        const bPilhasOpo = document.querySelector('.zone-opponent .pile-rail');
        if (bStatsOpo && bPilhasOpo) {
            const desvio = (bMao.left + bMao.width / 2) - (bFaixaOpo.left + bFaixaOpo.width / 2);
            const limite = Math.abs(bStatsOpo.getBoundingClientRect().width -
                bPilhasOpo.getBoundingClientRect().width) / 2 + 12;
            assert(`A mão do oponente fica no meio da faixa (desvio ${Math.round(desvio)}px de ${Math.round(bFaixaOpo.width)}px, limite ${Math.round(limite)}px)`,
                Math.abs(desvio) <= limite);
            assert('A mão do oponente é centrada na coluna do meio (justify-self: center)',
                estMao.justifySelf === 'center');
        }

        const tituloOpo = maoAlheia.querySelector('.hand-title');
        const cartaOpo = maoAlheia.querySelector('.card');
        if (tituloOpo && cartaOpo) {
            const bTitulo = tituloOpo.getBoundingClientRect();
            const bCartaOpo = cartaOpo.getBoundingClientRect();
            const sobrepoe = bTitulo.left < bCartaOpo.right && bCartaOpo.left < bTitulo.right &&
                bTitulo.top < bCartaOpo.bottom && bCartaOpo.top < bTitulo.bottom;
            assert(`O título da mão alheia não fica sobre as cartas (título ${Math.round(bTitulo.width)}x${Math.round(bTitulo.height)})`,
                !sobrepoe);

            // O MESMO efeito da mão própria: a faixa dourada em degradê sob o nome
            // (a pílula sólida saiu) e o chip de contagem no canto direito da
            // CAIXA — para isso o título é `static` e o badge é `absolute`.
            const estTitulo = getComputedStyle(tituloOpo);
            const estBadge = getComputedStyle(tituloOpo, '::after');
            assert('O título da mão alheia usa a faixa dourada em degradê (como a mão própria)',
                estTitulo.backgroundImage.includes('linear-gradient') &&
                estTitulo.backgroundColor === 'rgba(0, 0, 0, 0)');
            assert('O título é `static`: o badge ancora na caixa, não no nome',
                estTitulo.position === 'static');
            assert('O contador "N cartas" fica opaco', estBadge.opacity === '1');
            assert(`O contador "N cartas" mora no canto direito da caixa (${estBadge.position}, right ${estBadge.right})`,
                estBadge.position === 'absolute' && estBadge.right === '10px');
            assert(`O contador traz a quantidade de cartas (${estBadge.content})`,
                (estBadge.content || '').includes('cartas'));

            // Canto reservado: nenhum verso invade a área do badge.
            const reserva = parseFloat(estMao.paddingRight) || 0;
            const ultimaCarta = maoAlheia.querySelector('.card:last-child');
            if (ultimaCarta) {
                const bUltima = ultimaCarta.getBoundingClientRect();
                const limite = bMao.right - (parseFloat(estMao.borderRightWidth) || 0) - reserva;
                assert(`O canto direito fica livre para a contagem (verso termina em ${Math.round(bUltima.right)}px, reserva em ${Math.round(limite)}px)`,
                    bUltima.right <= limite + 1);
            }

            assert('Os versos do oponente ficam em fila reta (sem rotação)',
                getComputedStyle(cartaOpo).transform === 'none');
            assert(`Os versos do oponente ficam dentro da faixa de cima (topo ${Math.round(bCartaOpo.top - bFaixaOpo.top)}px, base ${Math.round(bCartaOpo.bottom - bFaixaOpo.bottom)}px)`,
                bCartaOpo.top >= bFaixaOpo.top - 2 && bCartaOpo.bottom <= bFaixaOpo.bottom + 2);
        }

        // Largura FIXA: encher a mão alheia até o limite (7) não pode alargar a
        // caixa. O estado é devolvido depois do teste — o bloco 10 conta o saque
        // do fim de turno e uma mão cheia bloquearia a compra.
        const maoP2 = window.gameState?.players?.p2?.zones?.hand;
        if (Array.isArray(maoP2)) {
            const antes = maoP2.length;
            const larguraAntes = bMao.width;
            while (maoP2.length < 7) {
                maoP2.push({ instanceId: `teste_largura_${maoP2.length}`, definitionId: null, ownerId: 'p2' });
            }
            window.renderHandsFromState();
            const larguraDepois = document.querySelector('.zone-opponent .player2-hand')
                .getBoundingClientRect().width;
            assert(`A largura da mão do oponente é fixa (${antes} cartas: ${Math.round(larguraAntes)}px, 7 cartas: ${Math.round(larguraDepois)}px)`,
                Math.abs(larguraDepois - larguraAntes) <= 1);
            while (maoP2.length > antes) maoP2.pop();
            window.renderHandsFromState();
        }
    }

    // 10. Saque automático ao trocar turno
    const handCountBefore = (window.gameState?.players?.p2?.zones?.hand || []).length;
    const phaseBefore = window.gameState?.currentPhase;

    if (typeof endTurn === 'function') {
        // Colocar em fase de combate para endTurn não bloquear
        if (window.gameState) window.gameState.currentPhase = 'combat';
        endTurn();
        setTimeout(() => {
            const handCountAfter = (window.gameState?.players?.p2?.zones?.hand || []).length;
            assert(
                `Mão de p2 cresceu após endTurn (${handCountBefore} → ${handCountAfter})`,
                handCountAfter > handCountBefore
            );
            console.log(`\n🧪 Resultado UI State: ${passed + 1}/${passed + failed + 1} checks`);
        }, 1500);
    } else {
        assert('endTurn disponível como global', false);
        console.log(`\n🧪 Resultado UI State: ${passed}/${passed + failed} checks`);
    }
})();
