// Regressão: na tela de cartas (`cartas.html`) cada carta abre com o LQIP
// (`assets/lqip/<nome>.png`) no `src` — o placeholder de baixa qualidade — e o
// WebP (`assets/webp/<nome>.webp`) só assume o `src` quando decodifica, quando
// o <img> ganha `.card-carregada`. Nenhum <img> pode voltar a apontar para o
// PNG de `assets/cards`. Roda via cartas.html.
(function runGalleryImagesTests() {
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

    // HEAD síncrono: prova que o arquivo existe no servidor, não só no atributo.
    function existeNaRede(url) {
        try {
            const xhr = new XMLHttpRequest();
            xhr.open('HEAD', url, false);
            xhr.send();
            return xhr.status === 200 || xhr.status === 304;
        } catch (e) {
            return false;
        }
    }

    // O boot da galeria é assíncrono (`loadCardSystem` faz o fetch do catálogo),
    // então os asserts esperam 700ms — dentro da janela de escuta do runner.
    setTimeout(() => {
        console.log('🧪 ===== TESTES DE IMAGENS DA GALERIA (LQIP + WEBP) =====\n');

        const imagens = [...document.querySelectorAll('.galeria-carta img.card-image-real')];
        assert('a esteira renderiza as cartas com imagem', imagens.length > 0);
        if (!imagens.length) {
            console.log(`\n📊 RESULTADO: ${passed} passaram, ${failed} falharam`);
            return;
        }

        // Invariante: ou ainda é o LQIP (com `src` em lqip), ou já é a arte cheia
        // (com `src` em webp). Nunca um meio-termo nem o PNG original.
        const consistente = imagens.every(img => {
            const src = img.getAttribute('src') || '';
            return img.classList.contains('card-carregada')
                ? /^assets\/webp\/.+\.webp$/.test(src)
                : /^assets\/lqip\/.+\.png$/.test(src);
        });
        assert('cada <img> é LQIP (card-lqip) ou arte cheia (card-carregada + webp)', consistente);

        assert('o placeholder inicial aponta para assets/lqip/*.png',
            imagens.some(img => /^assets\/lqip\/.+\.png$/.test(img.getAttribute('src') || '')));
        assert('a arte cheia troca para assets/webp/*.webp',
            imagens.some(img => img.classList.contains('card-carregada')
                && /^assets\/webp\/.+\.webp$/.test(img.getAttribute('src') || '')));
        assert('a troca é sob demanda: cartas fora de vista seguem no LQIP',
            imagens.some(img => img.classList.contains('card-lqip')));
        assert('as imagens usam loading="lazy"',
            imagens.every(img => img.getAttribute('loading') === 'lazy'));
        assert('nenhum <img> aponta para assets/cards/*.png',
            imagens.every(img => !/assets\/cards\/.*\.png$/.test(img.getAttribute('src') || '')));

        const base = (imagens[0].getAttribute('src') || '').split('/').pop().replace(/\.(png|webp)$/, '');
        assert(`WebP existe no servidor (${base}.webp)`, existeNaRede(`assets/webp/${base}.webp`));
        assert(`LQIP existe no servidor (${base}.png)`, existeNaRede(`assets/lqip/${base}.png`));

        console.log(`\n📊 RESULTADO: ${passed} passaram, ${failed} falharam`);
    }, 700);
})();