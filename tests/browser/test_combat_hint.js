// Instrução de combate (#combat-info): hint flutuante preso ACIMA do bloco de
// stats do assento local — nunca no fluxo (não empurra faixa/palco/barra) e só
// visível na fase de combate E no turno de quem está jogando. Roda contra
// game.html (game.js real).
(function runCombatHintTests() {
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

    function relatorio() {
        console.log(`\n🧪 Resultado hint de combate: ${passed}/${passed + failed} checks`);
        console.log(failed === 0
            ? '✅ hint flutuante acima do bloco de stats, só no seu turno'
            : `❌ ${failed} falhas\n`);
    }

    console.log('🧪 ===== TESTES DO HINT DE COMBATE =====\n');

    const state = window.gameState;
    const hint = document.getElementById('combat-info');
    if (!state || !hint || typeof window.updateUI !== 'function') {
        console.error('❌ núcleo do jogo não carregado');
        return;
    }

    const statsP1 = document.querySelector('.player1-stats');
    const statsP2 = document.querySelector('.player2-stats');
    const caixa = el => el.getBoundingClientRect();
    const visivel = () => getComputedStyle(hint).display === 'block';
    const marcado = () => hint.classList.contains('visible');

    // 1. Âncora: o hint vive no bloco de stats do ASSENTO LOCAL (a faixa espelha
    // no PvP, então o JS reancora; aqui o assento do PvM é o p1).
    assert('o hint é filho do bloco de stats do assento local', hint.parentElement === statsP1);
    assert('o bloco de stats é a âncora posicionada',
        getComputedStyle(statsP1).position === 'relative');
    assert('o hint nunca captura clique nas cartas',
        getComputedStyle(hint).pointerEvents === 'none');

    // 2. Fase de combate no SEU turno: o JS marca `.visible`.
    state.currentPlayer = 'p1';
    state.currentPhase = 'combat';
    window.updateUI();
    assert('o hint é marcado no combate do assento local', marcado());

    // O runner usa o viewport default do Chrome headless (800×600), então a regra
    // de tela estreita (`@media (max-width: 900px)`) esconde o hint DE PROPÓSITO.
    // Isso é comportamento real e é assertado aqui; para medir a GEOMETRIA de
    // desktop o teste libera a pílula com um override temporário — a caixa é a
    // mesma, só o `display` muda.
    const telaEstreita = window.innerWidth <= 900;
    if (telaEstreita) {
        assert(`em tela estreita (${window.innerWidth}px) o CSS esconde o hint`,
            visivel() === false);
    }
    const override = document.createElement('style');
    override.textContent =
        '@media (max-width: 900px) { #combat-info.visible { display: block !important; } }';
    document.head.appendChild(override);

    const caixaStats = caixa(statsP1);
    const caixaHint = caixa(hint);
    const caixaMao = caixa(document.querySelector('.player1-hand'));
    const caixaBarra = caixa(document.querySelector('.controls'));

    assert('o hint acende no combate do assento local', visivel());
    assert(`o hint fica ACIMA do bloco de stats (${Math.round(caixaHint.bottom)} ≤ ${Math.round(caixaStats.top)})`,
        caixaHint.bottom <= caixaStats.top + 1);
    assert(`o hint nasce ABAIXO da barra central (hint.top=${Math.round(caixaHint.top)} barra.bottom=${Math.round(caixaBarra.bottom)})`,
        caixaHint.top >= caixaBarra.bottom - 1);
    assert(`o hint não sai da tela (${Math.round(caixaHint.left)}…${Math.round(caixaHint.right)} em ${window.innerWidth})`,
        caixaHint.left >= 0 && caixaHint.right <= window.innerWidth);
    assert(`o hint fica na coluna do bloco de stats (hint.cx=${Math.round(caixaHint.left + caixaHint.width / 2)} stats.cx=${Math.round(caixaStats.left + caixaStats.width / 2)})`,
        Math.abs((caixaHint.left + caixaHint.width / 2) - (caixaStats.left + caixaStats.width / 2)) <= 1);

    // 3. Fora do fluxo: mostrar o hint não mexe em NADA da faixa.
    const antes = { stats: caixaStats.top, mao: caixaMao.top, barra: caixaBarra.top };
    window.updateUI();
    assert('repintar com o hint visível não move o bloco de stats', caixa(statsP1).top === antes.stats);
    assert('nem a mão local', caixa(document.querySelector('.player1-hand')).top === antes.mao);
    assert('nem a barra central', caixa(document.querySelector('.controls')).top === antes.barra);

    // 4. Turno do oponente: a instrução é de quem joga, então não aparece.
    state.currentPlayer = 'p2';
    window.updateUI();
    assert('no turno do adversário o hint não aparece', marcado() === false && visivel() === false);

    // 5. Fase que não é combate: fora também (com o turno de volta ao dono).
    state.currentPlayer = 'p1';
    state.currentPhase = 'invocation';
    window.updateUI();
    assert('fora da fase de combate o hint não aparece', marcado() === false && visivel() === false);

    // 6. Assento p2 (PvP espelhado): o hint migra para o bloco do p2 e pende
    // acima dele, mantendo a regra "acima do bloco do jogador local".
    document.body.dataset.seat = 'p2';
    state.currentPlayer = 'p2';
    state.currentPhase = 'combat';
    window.updateUI();
    assert('no assento p2 o hint é ancorado no bloco do p2', hint.parentElement === statsP2);
    assert('e aparece no turno do p2 (o assento local)', marcado() && visivel());
    assert('seguindo acima do bloco do p2',
        caixa(hint).bottom <= caixa(statsP2).top + 1);

    // 7. Turno do p1 no assento p2 = turno alheio: esconde de novo.
    state.currentPlayer = 'p1';
    window.updateUI();
    assert('no assento p2 o turno do p1 não mostra o hint', marcado() === false && visivel() === false);

    // Volta o tabuleiro ao estado do assento p1 para não contaminar os testes
    // seguintes da suíte (a página é reaproveitada pelo runner).
    override.remove();
    document.body.dataset.seat = 'p1';
    state.currentPlayer = 'p1';
    state.currentPhase = 'energy';
    window.updateUI();

    relatorio();
})();
