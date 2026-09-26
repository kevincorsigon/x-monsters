// Regras do jogo no lobby PvP: o botão abre o modal (mesmo conteúdo do
// real-play.html), que fecha no ×, no fundo escuro e no Esc. Roda em pvp-lobby.html.
(function runLobbyRulesTests() {
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

    console.log('🧪 ===== TESTES DAS REGRAS NO LOBBY PVP =====\n');

    const botao = document.getElementById('rules-button');
    const modal = document.getElementById('rules-modal');
    const conteudo = modal?.querySelector('.modal-content');
    const fechar = modal?.querySelector('.modal-close');

    if (!botao || !modal || !conteudo || !fechar) {
        console.error('❌ Botão/modal de regras ausente no lobby');
        return;
    }

    const visivel = () => modal.classList.contains('visible');
    const estilo = () => getComputedStyle(modal);

    // 1. Fechado por padrão e o botão abre.
    assert('o modal de regras começa fechado', !visivel() && estilo().visibility === 'hidden');
    botao.click();
    assert('o botão "Regras do Jogo" abre o modal', visivel() && estilo().visibility === 'visible');

    // 2. O modal cobre a tela e o conteúdo cabe na viewport. A área visível é
    //    `clientWidth`/`clientHeight` (sem a barra de rolagem): desde que o lobby
    //    ganhou o seletor de decks a página rola, e o `innerWidth` inclui a barra.
    const raiz = document.documentElement;
    const caixaModal = modal.getBoundingClientRect();
    const caixaConteudo = conteudo.getBoundingClientRect();
    assert(`o modal cobre a viewport (${Math.round(caixaModal.width)}x${Math.round(caixaModal.height)} ` +
        `vs ${raiz.clientWidth}x${raiz.clientHeight})`,
        caixaModal.top <= 0.5 && caixaModal.left <= 0.5
        && caixaModal.width >= raiz.clientWidth - 1 && caixaModal.height >= raiz.clientHeight - 1);
    assert('o conteúdo fica dentro da tela e rola por dentro',
        caixaConteudo.top >= -0.5
        && caixaConteudo.bottom <= raiz.clientHeight + 0.5
        && caixaConteudo.height <= raiz.clientHeight);

    // 3. Conteúdo das regras: as cinco seções do real-play.html.
    const secoes = [...conteudo.querySelectorAll('.rules-text h3')].map(h => h.textContent.trim());
    assert('traz o título das regras', conteudo.querySelector('.rules-text h2')?.textContent.includes('Regras do Jogo X Monsters'));
    assert('traz as cinco seções de regras', secoes.length === 5);
    assert('as seções são as do real-play.html',
        secoes[0].startsWith('1. Objetivo') && secoes[1].startsWith('2. Sistema de Energia')
        && secoes[2].startsWith('3. Fases do Turno') && secoes[3].startsWith('4. Combate e Dano')
        && secoes[4].startsWith('5. Mecânicas Adicionais'));
    assert('explica o dado da sorte e o limite de energia',
        conteudo.textContent.includes('Dado da Sorte') && conteudo.textContent.includes('20 pontos'));

    // 4. Três caminhos de fechar: ×, fundo escuro e Esc.
    fechar.click();
    assert('o × fecha o modal', !visivel());
    botao.click();
    modal.click();
    assert('clicar no fundo escuro fecha o modal', !visivel());
    botao.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    assert('Esc fecha o modal', !visivel());

    // 5. O clique dentro do conteúdo não fecha (não é o fundo).
    botao.click();
    conteudo.click();
    assert('clicar dentro do conteúdo não fecha o modal', visivel());
    fechar.click();
    assert('o botão volta a abrir depois de fechado', (botao.click(), visivel()));

    console.log(`\n🧪 Resultado regras no lobby: ${passed}/${passed + failed} checks`);
    console.log(failed === 0 ? '✅ o lobby tem o modal de regras como o real-play.html' : `❌ ${failed} falhas\n`);
})();
