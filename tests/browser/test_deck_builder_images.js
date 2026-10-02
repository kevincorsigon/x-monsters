// Regressão: no Deck Builder (`deck-builder.html`) as miniaturas do catálogo e a
// carta do modal abrem com o LQIP (`assets/lqip/<nome>.png`) no `src` — o
// placeholder de baixa qualidade — e o WebP (`assets/webp/<nome>.webp`) só
// assume quando decodifica (`.card-carregada`). Nenhum <img> volta a apontar
// para o PNG de `assets/cards`. Roda via deck-builder.html.
(function runBuilderImagesTests() {
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

    // O boot do builder é assíncrono (catálogo + decks), então os asserts
    // esperam 700ms — dentro da janela de escuta do runner.
    setTimeout(() => {
        console.log('🧪 ===== TESTES DE IMAGENS DO DECK BUILDER (LQIP + WEBP) =====\n');

        const minis = [...document.querySelectorAll('#builderGrade img.deck-card-mini-img')];
        assert('o catálogo do builder renderiza miniaturas', minis.length > 0);
        if (!minis.length) {
            console.log(`\n📊 RESULTADO: ${passed} passaram, ${failed} falharam`);
            return;
        }

        const consistente = minis.every(img => {
            const src = img.getAttribute('src') || '';
            return img.classList.contains('card-carregada')
                ? /^assets\/webp\/.+\.webp$/.test(src)
                : /^assets\/lqip\/.+\.png$/.test(src);
        });
        assert('cada miniatura é LQIP (card-lqip) ou arte cheia (card-carregada + webp)', consistente);
        assert('o placeholder inicial aponta para assets/lqip/*.png',
            minis.some(img => /^assets\/lqip\/.+\.png$/.test(img.getAttribute('src') || '')));
        assert('a arte cheia troca para assets/webp/*.webp',
            minis.some(img => img.classList.contains('card-carregada')
                && /^assets\/webp\/.+\.webp$/.test(img.getAttribute('src') || '')));
        assert('a troca é sob demanda: cartas fora de vista seguem no LQIP',
            minis.some(img => img.classList.contains('card-lqip')));
        assert('as miniaturas usam loading="lazy"',
            minis.every(img => img.getAttribute('loading') === 'lazy'));
        assert('nenhuma miniatura aponta para assets/cards/*.png',
            minis.every(img => !/assets\/cards\/.*\.png$/.test(img.getAttribute('src') || '')));

        // O ℹ abre a carta cheia; a arte do modal segue o mesmo pipeline.
        document.querySelector('#builderGrade .builder-carta-info')?.click();
        const modalImg = document.querySelector('.card-modal.visible .card-image-real');
        assert('o modal do builder abre com a imagem real', Boolean(modalImg));
        if (modalImg) {
            const srcModal = modalImg.getAttribute('src') || '';
            assert('a imagem do modal é LQIP ou arte cheia (nunca o PNG original)',
                modalImg.classList.contains('card-carregada')
                    ? /^assets\/webp\/.+\.webp$/.test(srcModal)
                    : /^assets\/lqip\/.+\.png$/.test(srcModal));
        }

        const base = (minis[0].getAttribute('src') || '').split('/').pop().replace(/\.(png|webp)$/, '');
        assert(`WebP existe no servidor (${base}.webp)`, existeNaRede(`assets/webp/${base}.webp`));
        assert(`LQIP existe no servidor (${base}.png)`, existeNaRede(`assets/lqip/${base}.png`));

        console.log(`\n📊 RESULTADO: ${passed} passaram, ${failed} falharam`);
    }, 700);
})();