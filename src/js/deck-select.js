/**
 * deck-select.js - Seletor de decks pré-montados (data/decks.json).
 *
 * Usado como modal no boot das DUAS telas de partida: `GameDeckSelect.abrir()`
 * bloqueia o hotseat (`game.html`) e a entrada da sala PvP (`pvp.html`) até o
 * jogador confirmar — o deck do lobby não existe mais: a escolha é sempre feita
 * ao entrar na partida. `renderizar`/modo embutido foi removido junto.
 *
 * Nenhuma definição de carta mora aqui: o componente lê `window.deckCatalog`
 * (carregado por `deck_system.js`) e delega as estatísticas ao `DeckBuilder`.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    root.DeckSelect = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const RANDOM_ID = 'aleatorio';
    const PREFS_KEY = 'xmDeckPreferido';
    const VERSOS_NA_PILHA = 5;

    // Acesso tolerante ao escopo do browser: o módulo também é `require()`-ável
    // pelos testes de unidade (Node), onde `window` não existe.
    const janela = typeof window !== 'undefined' ? window : null;

    // Rótulos pt-BR das traits do catálogo. É exibição apenas: quem decide regra
    // continua sendo `CardRules` (nem toda trait daqui precisa de efeito).
    const TRAIT_LABELS = Object.freeze({
        humanoide: { rotulo: 'Humanoide', icone: '🧍' },
        besta: { rotulo: 'Besta', icone: '🐾' },
        dragao: { rotulo: 'Dragão', icone: '🐉' },
        lobisomem: { rotulo: 'Lobisomem', icone: '🌕' },
        voador: { rotulo: 'Voador', icone: '🕊️' },
        robotico: { rotulo: 'Robótico', icone: '🤖' },
        guerreiro: { rotulo: 'Guerreiro', icone: '⚔️' },
        aquatico: { rotulo: 'Aquático', icone: '🌊' },
        demonio: { rotulo: 'Demônio', icone: '😈' },
        magico: { rotulo: 'Mágico', icone: '✨' },
        vampiro: { rotulo: 'Vampiro', icone: '🧛' },
        planta: { rotulo: 'Planta', icone: '🌿' },
        fogo: { rotulo: 'Fogo', icone: '🔥' },
        paladino: { rotulo: 'Paladino', icone: '🛡️' },
        fantasma: { rotulo: 'Fantasma', icone: '👻' },
        elite: { rotulo: 'Elite', icone: '👑' }
    });

    let escolhidoId = null;
    let resolucaoPendente = null;

    // ── traits ───────────────────────────────────────────────────────────────

    /** Rótulo + ícone de uma trait (trait desconhecida cai no nome capitalizado). */
    function rotuloDeTrait(trait) {
        const chave = String(trait || '').toLowerCase();
        if (TRAIT_LABELS[chave]) return TRAIT_LABELS[chave];
        return {
            rotulo: chave ? chave.charAt(0).toUpperCase() + chave.slice(1) : '—',
            icone: '🔹'
        };
    }

    /** Traits efetivas de uma carta: catálogo primeiro, `CardRules` como fallback. */
    function traitsDaCarta(cardData) {
        if (!cardData) return [];
        if (Array.isArray(cardData.traits) && cardData.traits.length > 0) {
            return cardData.traits.map(t => String(t).toLowerCase());
        }
        const doMotor = janela?.CardRules?.getTraits?.({ definitionId: cardData.id, data: cardData });
        return Array.isArray(doMotor) ? [...doMotor] : [];
    }

    function chipsDeTraits(traits) {
        return (traits || []).map(trait => {
            const { rotulo, icone } = rotuloDeTrait(trait);
            return `<span class="trait-chip"><span class="trait-chip-icone">${icone}</span>${rotulo}</span>`;
        }).join('');
    }

    // ── catálogo / preferência ───────────────────────────────────────────────

    function decksDoCatalogo() {
        const decks = janela?.deckCatalog?.decks;
        return Array.isArray(decks) ? decks : [];
    }

    function deckAleatorio() {
        return {
            id: RANDOM_ID,
            nome: 'Deck Aleatório',
            tema: 'Sorte em cada partida',
            descricao: 'O balanceador sorteia 40 cartas respeitando a curva de custo — sempre uma mesa diferente. Sugestão para quem quer descobrir o catálogo.',
            emblema: '🎲',
            traits: [],
            cores: { primaria: '#a78bfa', secundaria: '#171233', acento: '#f1f5f9' },
            cartas: []
        };
    }

    function opcoes() {
        return [...decksDoCatalogo(), deckAleatorio()];
    }

    function tamanhoDoDeck() {
        return Number(janela?.DECK_SIZE) || 40;
    }

    function lerPreferencia() {
        try {
            const valor = janela?.localStorage?.getItem(PREFS_KEY);
            return valor && valor !== RANDOM_ID ? valor : null;
        } catch (error) {
            console.warn('DeckSelect: localStorage indisponível', error);
            return null;
        }
    }

    function salvarPreferencia(deckId) {
        try {
            janela?.localStorage?.setItem(PREFS_KEY, deckId || RANDOM_ID);
        } catch (error) {
            console.warn('DeckSelect: não foi possível salvar a preferência de deck', error);
        }
    }

    // ── render ───────────────────────────────────────────────────────────────

    function linhaDeStats(deck) {
        if (deck.id === RANDOM_ID) {
            return `${tamanhoDoDeck()} cartas • balanceado por custo • definido no sorteio`;
        }
        const resumo = window.resumoDeDeck?.(deck.id, null, window.deckBuilder);
        if (!resumo) return `${deck.cartas.length} cartas`;
        const { stats } = resumo;
        return `${stats.total} cartas • ${stats.criaturas} criaturas • ${stats.suportes} suportes` +
            (stats.evolucoes ? ` • ${stats.evolucoes} evolução` : '') +
            ` • custo médio ${stats.custoMedio}`;
    }

    function pilhaDeCartas() {
        let cartas = '';
        for (let i = 0; i < VERSOS_NA_PILHA; i++) {
            cartas += `<span class="deck-stack-card" style="--pilha:${i}"></span>`;
        }
        return cartas;
    }

    function criarOpcao(deck) {
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'deck-option';
        botao.dataset.deck = deck.id;
        botao.setAttribute('aria-pressed', 'false');
        botao.style.setProperty('--deck-primaria', deck.cores?.primaria || '#d4af37');
        botao.style.setProperty('--deck-secundaria', deck.cores?.secundaria || '#1a1e28');
        botao.style.setProperty('--deck-acento', deck.cores?.acento || '#f8fafc');
        botao.innerHTML = `
            <span class="deck-stack" aria-hidden="true">${pilhaDeCartas()}</span>
            <span class="deck-stack-emblema" aria-hidden="true">${deck.emblema || '🎴'}</span>
            <span class="deck-option-info">
                <span class="deck-option-nome">${deck.nome}</span>
                <span class="deck-option-tema">${deck.tema || ''}</span>
                <span class="deck-option-stats">${linhaDeStats(deck)}</span>
                <span class="deck-traits">${chipsDeTraits(deck.traits)}</span>
            </span>`;
        return botao;
    }

    function marcarSelecao(container, deckId) {
        (container || document).querySelectorAll('.deck-option').forEach(botao => {
            const ativo = botao.dataset.deck === deckId;
            botao.classList.toggle('selected', ativo);
            botao.setAttribute('aria-pressed', ativo ? 'true' : 'false');
        });
    }

    /**
     * Seleciona uma opção do seletor aberto e repinta o painel de detalhe.
     */
    function selecionar(id, alvo = null) {
        const raiz = alvo || document;
        const deck = opcoes().find(opcao => opcao.id === id);
        if (!deck) return null;

        escolhidoId = id;
        marcarSelecao(raiz, id);

        const detalhe = raiz.querySelector('#deckSelectDetail, .deck-select-detail');
        if (detalhe) {
            // A cor do deck também pinta o painel (barras de curva, chips), não só
            // o card da opção: os dois são elementos irmãos.
            detalhe.style.setProperty('--deck-primaria', deck.cores?.primaria || '#d4af37');
            detalhe.style.setProperty('--deck-acento', deck.cores?.acento || '#f8fafc');
            detalhe.innerHTML = detalheDoDeck(deck);
            ligarMiniCartas(detalhe);
        }

        const botao = raiz.querySelector('#deckSelectConfirm, .deck-select-confirm');
        if (botao) {
            botao.disabled = false;
            botao.textContent = `Jogar com ${deck.nome}`;
            botao.style.setProperty('--deck-primaria', deck.cores?.primaria || '#d4af37');
        }
        return deck;
    }

    // ── detalhe do deck ──────────────────────────────────────────────────────

    function linhaDeCurva(rotulo, valor, maximo) {
        const largura = Math.round((valor / Math.max(1, maximo)) * 100);
        return `
            <span class="deck-curva-linha">
                <span class="deck-curva-rotulo">${rotulo}</span>
                <span class="deck-curva-trilha"><span class="deck-curva-barra" style="width:${largura}%"></span></span>
                <span class="deck-curva-valor">${valor}</span>
            </span>`;
    }

    function miniCarta(definicao, copias, deck) {
        const imagem = definicao.image
            ? `<img class="deck-card-mini-img" src="${definicao.image}" alt="${definicao.name}" loading="lazy">`
            : '<span class="deck-card-mini-img is-vazia">🎴</span>';
        return `
            <button type="button" class="deck-card-mini" data-carta="${definicao.id}"
                    style="--deck-primaria:${deck.cores?.primaria || '#d4af37'}"
                    title="${definicao.name} — clique para ver a carta (com traits)">
                <span class="deck-card-mini-custo">${definicao.cost}</span>
                ${imagem}
                <span class="deck-card-mini-nome">${definicao.name}</span>
                <span class="deck-card-mini-copias">×${copias}</span>
            </button>`;
    }

    /** Painel de detalhe do deck selecionado (stats, curva, traits e cartas). */
    function detalheDoDeck(deck) {
        if (!deck) return '';
        const resumo = deck.id === RANDOM_ID
            ? null
            : window.resumoDeDeck?.(deck.id, null, window.deckBuilder);

        const curva = resumo
            ? `<div class="deck-detalhe-curva">
                   ${linhaDeCurva('1–3', resumo.faixas.baixo, tamanhoDoDeck())}
                   ${linhaDeCurva('4–6', resumo.faixas.medio, tamanhoDoDeck())}
                   ${linhaDeCurva('7+', resumo.faixas.alto, tamanhoDoDeck())}
               </div>`
            : '<div class="deck-detalhe-curva is-vazia">Curva de custo definida no sorteio</div>';

        const copiasPorCarta = resumo ? deck.cartas.reduce((contagem, id) => {
            contagem[id] = (contagem[id] || 0) + 1;
            return contagem;
        }, {}) : {};

        const grade = resumo ? `
            <div class="deck-cards-grid">
                ${Object.entries(copiasPorCarta).map(([id, copias]) => {
                    const definicao = window.cardsDatabase?.cards?.find(carta => carta.id === id);
                    return definicao ? miniCarta(definicao, copias, deck) : '';
                }).join('')}
            </div>` : '';

        return `
            <div class="deck-detalhe-cabecalho">
                <span class="deck-detalhe-emblema">${deck.emblema || '🎴'}</span>
                <span class="deck-detalhe-titulos">
                    <span class="deck-detalhe-nome">${deck.nome}</span>
                    <span class="deck-detalhe-tema">${deck.tema || ''}</span>
                </span>
            </div>
            <p class="deck-detalhe-descricao">${deck.descricao || ''}</p>
            <div class="deck-detalhe-stats">
                <span class="deck-detalhe-stat"><b>${resumo ? resumo.stats.total : tamanhoDoDeck()}</b> cartas</span>
                ${resumo ? `<span class="deck-detalhe-stat"><b>${resumo.cartasDistintas}</b> distintas</span>` : ''}
                ${resumo ? `<span class="deck-detalhe-stat"><b>${resumo.stats.criaturas}</b> criaturas</span>` : ''}
                ${resumo ? `<span class="deck-detalhe-stat"><b>${resumo.stats.suportes}</b> suportes</span>` : ''}
                ${resumo ? `<span class="deck-detalhe-stat"><b>${resumo.stats.custoMedio}</b> custo médio</span>` : ''}
            </div>
            ${curva}
            <div class="deck-traits deck-traits-detalhe">${chipsDeTraits(deck.traits)}</div>
            ${grade}`;
    }

    function ligarMiniCartas(container) {
        container.querySelectorAll('.deck-card-mini').forEach(mini => {
            mini.addEventListener('click', () => {
                const definicao = window.cardsDatabase?.cards?.find(carta => carta.id === mini.dataset.carta);
                if (definicao && window.showCardModal) window.showCardModal(definicao);
            });
        });
    }

    // ── modo modal (hotseat) ─────────────────────────────────────────────────

    /** Abre o seletor bloqueante; resolve com o id escolhido (`null` sem catálogo). */
    function abrir() {
        const modal = document.getElementById('deckSelectModal');
        const grade = document.getElementById('deckSelectGrid');
        if (!modal || !grade || decksDoCatalogo().length === 0) {
            console.info('DeckSelect: sem catálogo de decks — a partida segue com o deck aleatório');
            return Promise.resolve(null);
        }

        grade.innerHTML = '';
        opcoes().forEach(deck => {
            const botao = criarOpcao(deck);
            botao.addEventListener('click', () => selecionar(deck.id, modal));
            botao.addEventListener('dblclick', () => {
                selecionar(deck.id, modal);
                confirmar();
            });
            grade.appendChild(botao);
        });

        // Pré-seleção: a preferência salva no navegador (o lobby PvP usa a mesma
        // chave) ou o deck aleatório quando não há histórico.
        selecionar(lerPreferencia() || RANDOM_ID, modal);
        modal.classList.add('visible');
        document.body.classList.add('deck-select-aberto');

        return new Promise(resolve => {
            resolucaoPendente = resolve;
        });
    }

    /** Fecha o modal e resolve a promessa pendente com a escolha atual. */
    function confirmar() {
        const modal = document.getElementById('deckSelectModal');
        const escolha = escolhidoId;
        if (modal) modal.classList.remove('visible');
        document.body.classList.remove('deck-select-aberto');
        if (resolucaoPendente) {
            const resolver = resolucaoPendente;
            resolucaoPendente = null;
            salvarPreferencia(escolha);
            resolver(escolha);
        }
        return escolha;
    }

    /** Atalho de confirmação usado pelos testes de browser. */
    function confirmarAleatorio() {
        if (!resolucaoPendente) return null;
        selecionar(RANDOM_ID);
        return confirmar();
    }

    function aberto() {
        return resolucaoPendente !== null;
    }

    const api = {
        RANDOM_ID,
        PREFS_KEY,
        VERSOS_NA_PILHA,
        TRAIT_LABELS,
        rotuloDeTrait,
        traitsDaCarta,
        chipsDeTraits,
        detalheDoDeck,
        abrir,
        confirmar,
        confirmarAleatorio,
        aberto,
        selecionar,
        lerPreferencia,
        salvarPreferencia,
        deckAleatorio,
        atual: () => escolhidoId
    };

    // Handlers globais usados pelo markup (mesmo padrão de `showCardModal`).
    api.instalarGlobais = () => {
        window.confirmarSelecaoDeDeck = confirmar;
        window.selecionarDeck = id => selecionar(id);
    };
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', api.instalarGlobais);
        } else {
            api.instalarGlobais();
        }
    }

    return api;
});
