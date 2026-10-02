/**
 * card-images.js - Pipeline de imagem das cartas: placeholder de baixa qualidade
 * (LQIP) → arte cheia (WebP).
 *
 * O <img> nasce com o LQIP (`assets/lqip/<nome>.png`) no `src` — a primeira
 * pintura é barata e a carta nunca fica em branco. O WebP
 * (`assets/webp/<nome>.webp`) só assume o `src` quando decodifica (preload via
 * `new Image()`), então não há piscada; aí o <img> troca `card-lqip` por
 * `card-carregada` e o CSS tira o blur. O nome base sai do caminho canônico do
 * catálogo (`assets/cards/<nome>.png`), fonte de verdade.
 *
 * Consumido por `card-gallery.js`, `deck-select.js` e `deck-builder.js` (carregar
 * este primeiro, antes do consumidor). UMD: `require()`-ável nos testes de Node.
 */
(function (root, factory) {
    const api = factory(root);
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.CardImages = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
    'use strict';

    const MARGEM = '400px 800px';
    let observador = null;

    /** `assets/cards/<nome>.png` → `assets/lqip/<nome>.png` (mesmo nome base). */
    function caminhoLqip(carta) {
        const base = String(carta && carta.image ? carta.image : '').split('/').pop().replace(/\.[^.]+$/, '');
        return `assets/lqip/${base}.png`;
    }

    function esc(texto) {
        return String(texto ?? '').replace(/[&<>"']/g, caractere => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[caractere]));
    }

    /** `<img>` canônico da carta: LQIP no `src`, WebP trocado por `prepararImagens`. */
    function imagemDaCarta(carta, opcoes) {
        const opts = opcoes || {};
        if (!carta || !carta.image) return opts.fallback || '<div class="card-image"></div>';
        const classes = opts.classes || 'card-image-real';
        return `<img class="${classes} card-lqip" src="${caminhoLqip(carta)}" ` +
            `alt="${esc(carta.name)}" loading="lazy" decoding="async">`;
    }

    /** Troca o LQIP pelo WebP mantendo o placeholder à vista até a arte cheia estar pronta. */
    function carregarArteCheia(img) {
        if (!img || img.dataset.arteCheia === '1') return;
        img.dataset.arteCheia = '1';
        const lqip = img.getAttribute('src') || '';
        const cheia = lqip.replace('/lqip/', '/webp/').replace(/\.png$/, '.webp');
        const revelar = () => {
            img.classList.remove('card-lqip');
            img.classList.add('card-carregada');
        };
        if (!cheia || cheia === lqip) { revelar(); return; }
        const cevada = new root.Image();
        cevada.onload = () => { img.src = cheia; revelar(); };
        cevada.onerror = revelar;   // sem WebP o LQIP fica: nunca fica em branco
        cevada.src = cheia;
    }

    /**
     * Liga as imagens de um trecho recém-renderizado. `imediato` é para o que já
     * está à vista (modal/mão); no resto a arte cheia espera a carta chegar perto
     * da tela (IntersectionObserver), para a grade inteira não baixar de uma vez.
     */
    function prepararImagens(raiz, imediato) {
        if (!raiz) return;
        const alvos = raiz.querySelectorAll('img.card-lqip');
        if (imediato || !root.IntersectionObserver) {
            alvos.forEach(carregarArteCheia);
            return;
        }
        if (!observador) {
            observador = new root.IntersectionObserver((entradas, obs) => {
                entradas.forEach(entrada => {
                    if (!entrada.isIntersecting) return;
                    obs.unobserve(entrada.target);
                    carregarArteCheia(entrada.target);
                });
            }, { rootMargin: MARGEM, threshold: 0.01 });
        }
        alvos.forEach(alvo => observador.observe(alvo));
    }

    return { caminhoLqip, imagemDaCarta, carregarArteCheia, prepararImagens };
});