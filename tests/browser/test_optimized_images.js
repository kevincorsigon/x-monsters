// Regressão: as cartas renderizadas usam o pipeline otimizado de imagens —
// LQIP (`assets/lqip/<nome>.png`) como fundo do próprio <img> e WebP
// (`assets/webp/<nome>.webp`) como fonte real, com `loading="lazy"`.
// Nenhum <img> pode voltar a apontar para o PNG original de `assets/cards`.
// Roda contra game.html (game.js real), sem servidor próprio.
(function runOptimizedImagesTests() {
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

    // HEAD síncrono: prova que o arquivo existe no servidor estático, não só no
    // atributo. O aviso de depreciação do Chrome é `warning`, não `error`.
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

    console.log('🧪 ===== TESTES DE IMAGENS OTIMIZADAS (LQIP + WEBP) =====\n');

    if (!window.gameState || typeof window.renderHandsFromState !== 'function') {
        console.error('❌ game.js não carregado');
        return;
    }

    window.renderHandsFromState();
    const imagens = [...document.querySelectorAll('.card .card-image-real')];
    assert('cartas renderizadas têm imagem real', imagens.length > 0);

    const srcOk = imagens.every(img => /^assets\/webp\/.+\.webp$/.test(img.getAttribute('src') || ''));
    assert('src aponta para assets/webp/*.webp', srcOk);

    const fundoLqip = imagens.every(img => (img.style.backgroundImage || '').includes('assets/lqip/'));
    assert('fundo do <img> é o LQIP (assets/lqip)', fundoLqip);

    const lazyOk = imagens.every(img => img.getAttribute('loading') === 'lazy');
    assert('imagens usam loading="lazy"', lazyOk);

    const asyncOk = imagens.every(img => img.getAttribute('decoding') === 'async');
    assert('imagens usam decoding="async"', asyncOk);

    const srcsetOk = imagens.every(img => (img.getAttribute('srcset') || '').includes('assets/webp/'));
    assert('srcset presente apontando para os webp', srcsetOk);

    const sizesOk = imagens.every(img => Boolean(img.getAttribute('sizes')));
    assert('sizes presente (evita download grande na mão pequena)', sizesOk);

    const semPngOriginal = imagens.every(img => !/assets\/cards\/.*\.png$/.test(img.getAttribute('src') || ''));
    assert('nenhum <img> volta a apontar para assets/cards/*.png', semPngOriginal);

    // Existência real dos arquivos no servidor estático.
    const primeiro = imagens[0];
    if (primeiro) {
        const base = primeiro.getAttribute('src').split('/').pop().replace(/\.webp$/, '');
        assert(`WebP existe no servidor (${base}.webp)`, existeNaRede(`assets/webp/${base}.webp`));
        assert(`LQIP existe no servidor (${base}.png)`, existeNaRede(`assets/lqip/${base}.png`));
    }

    console.log(`\n📊 RESULTADO: ${passed} passaram, ${failed} falharam`);
})();