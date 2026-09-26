// Avisos de acontecimento (toasts) e Ataque Direto: os avisos entram empilhados
// no canto direito, com entrada deslizando de cima, e o botão de ataque direto
// flutua abaixo do menu central, centrado sob o botão de Invocação. Roda contra
// game.html (game.js real), sem servidor.
(function runToastAndDirectAttackTests() {
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
        console.log(`\n🧪 Resultado toasts/ataque direto: ${passed}/${passed + failed} checks`);
        console.log(failed === 0
            ? '✅ avisos no canto direito e ataque direto flutuando sob Invocação'
            : `❌ ${failed} falhas\n`);
    }

    console.log('🧪 ===== TESTES DE TOASTS E DO ATAQUE DIRETO =====\n');

    if (typeof window.showMessage !== 'function' || typeof window.showTurnNotification !== 'function') {
        console.error('❌ núcleo do jogo não carregado');
        return;
    }

    const container = document.getElementById('message-toasts');
    assert('a tela declara o container de toasts', Boolean(container));
    if (!container) {
        relatorio();
        return;
    }

    const caixaContainer = container.getBoundingClientRect();
    assert('o container fica no canto direito da tela',
        caixaContainer.right >= window.innerWidth - 40 && caixaContainer.left > window.innerWidth / 2);
    assert('o container não intercepta cliques no tabuleiro',
        getComputedStyle(container).pointerEvents === 'none');

    container.querySelectorAll('.message-toast').forEach(el => el.remove());

    // 1. Avisos de regra: empilham de cima para baixo, sem atropelo no meio da tela
    window.showMessage('Primeiro aviso de teste');
    window.showMessage('Segundo aviso de teste', 'warning');

    const toasts = container.querySelectorAll('.message-toast');
    assert('os dois avisos entram na mesma pilha', toasts.length === 2);
    if (toasts.length === 2) {
        const primeiro = toasts[0].getBoundingClientRect();
        const segundo = toasts[1].getBoundingClientRect();
        assert('o aviso novo entra abaixo do anterior', segundo.top >= primeiro.bottom - 1);
        assert('o aviso fica na coluna do canto direito (não no centro)',
            primeiro.left > window.innerWidth / 2);
        assert('o tipo do aviso vira classe (cor de alerta)',
            toasts[1].classList.contains('message-toast-warning'));
        assert('o aviso é filho do container de toasts', toasts[0].parentElement === container);
    }

    // 2. Notificação de turno entra na mesma pilha, mantendo as duas linhas do <br/>
    window.showTurnNotification('⚡ Teste<br/>Energia: 8', 1000);
    const turno = container.querySelector('.message-toast-turn');
    assert('a notificação de turno entra na pilha', Boolean(turno));
    assert('a notificação mantém as duas linhas', Boolean(turno && turno.querySelector('br')));
    assert('a notificação também fica no canto direito',
        Boolean(turno) && turno.getBoundingClientRect().left > window.innerWidth / 2);

    // 3. Ataque Direto: flutua abaixo do menu central, centrado sob Invocação
    const botao = document.getElementById('direct-attack-btn');
    const float = document.getElementById('direct-attack-float');
    const invocacao = document.getElementById('invocation-phase');
    assert('o botão de ataque direto vive no float', Boolean(botao && float) && float.contains(botao));

    if (botao && float && invocacao) {
        botao.style.display = 'inline-block';
        const caixaBotao = botao.getBoundingClientRect();
        const caixaInvocacao = invocacao.getBoundingClientRect();
        assert('o botão aparece abaixo do menu central',
            caixaBotao.top >= caixaInvocacao.bottom - 1);
        assert('o botão fica centrado sob o botão de Invocação',
            Math.abs((caixaBotao.left + caixaBotao.width / 2) - (caixaInvocacao.left + caixaInvocacao.width / 2)) <= 6);
        assert('o botão fica visível sobre o tabuleiro',
            caixaBotao.width > 0 && caixaBotao.height > 0);
        botao.style.display = 'none';
    }

    // 4. Os avisos não somem no meio da leitura (antes eram removidos em 2s)
    setTimeout(() => {
        assert('os avisos continuam na tela depois de 900ms',
            document.querySelectorAll('#message-toasts .message-toast').length >= 2);
        assert('o toast ganhou o estado visível (entrada em fade)',
            document.querySelector('#message-toasts .message-toast').classList.contains('visible'));
        relatorio();
    }, 900);
})();
