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
    const CUSTOM_SEPARADOR = 'Meus decks';

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
        // Ordem fixa: oficiais → aleatório → customs ("Meus decks" por último).
        const oficiais = decksDoCatalogo().filter(deck => deck.custom !== true);
        const customs = decksDoCatalogo().filter(deck => deck.custom === true);
        return [...oficiais, deckAleatorio(), ...customs];
    }

    /** Customs (`custom: true`): sempre após os oficiais e o aleatório. */
    function decksCustom() {
        return decksDoCatalogo().filter(deck => deck.custom === true);
    }

    function ehDeckCustom(deck) {
        const id = typeof deck === 'string' ? deck : deck?.id;
        return typeof id === 'string' && id.startsWith('custom-');
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
        const resumo = window.resumoDeDeck?.(deck, null, window.deckBuilder);
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
        // Customs ganham badge + lixeira; oficiais/aleatório nunca têm excluir.
        const selo = deck.custom === true ? '<span class="deck-custom-badge">✨ Meu deck</span>' : '';
        const lixeira = deck.custom === true
            ? `<span class="deck-option-excluir" role="button" tabindex="0" title="Excluir deck" data-excluir-deck="${deck.id}">🗑️</span>`
            : '';
        botao.innerHTML = `
            ${lixeira}
            <span class="deck-stack" aria-hidden="true">${pilhaDeCartas()}</span>
            <span class="deck-stack-emblema" aria-hidden="true">${deck.emblema || '🎴'}</span>
            ${selo}
            <span class="deck-option-info">
                <span class="deck-option-nome">${deck.nome}</span>
                <span class="deck-option-tema">${deck.tema || ''}</span>
                <span class="deck-option-stats">${linhaDeStats(deck)}</span>
                <span class="deck-traits">${chipsDeTraits(deck.traits)}</span>
            </span>`;
        const alvoLixeira = botao.querySelector('[data-excluir-deck]');
        if (alvoLixeira) {
            const pedir = evento => {
                evento.stopPropagation();
                evento.preventDefault();
                pedirExclusaoDeDeck(deck.id, deck.nome);
            };
            alvoLixeira.addEventListener('click', pedir);
            alvoLixeira.addEventListener('keydown', evento => {
                if (evento.key === 'Enter' || evento.key === ' ') pedir(evento);
            });
        }
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
            : window.resumoDeDeck?.(deck, null, window.deckBuilder);

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

    function montarGrade(modal, grade) {
        grade.innerHTML = '';
        opcoes().forEach((deck, indice, lista) => {
            // Separador "Meus decks" antes do primeiro custom (após o aleatório).
            const anterior = lista[indice - 1];
            if (deck.custom === true && !(anterior && anterior.custom === true)) {
                const separador = document.createElement('div');
                separador.className = 'deck-select-separador';
                separador.textContent = CUSTOM_SEPARADOR;
                grade.appendChild(separador);
            }
            const botao = criarOpcao(deck);
            botao.addEventListener('click', () => selecionar(deck.id, modal));
            botao.addEventListener('dblclick', () => {
                selecionar(deck.id, modal);
                confirmar();
            });
            grade.appendChild(botao);
        });
    }

    /** Re-renderiza a grade sem mexer na promessa pendente (pós-exclusão). */
    function redesenhar() {
        const modal = document.getElementById('deckSelectModal');
        const grade = document.getElementById('deckSelectGrid');
        if (!modal || !grade || !modal.classList.contains('visible')) return false;
        montarGrade(modal, grade);
        // A seleção pode ter sumido (deck excluído): volta ao aleatório.
        if (!opcoes().some(deck => deck.id === escolhidoId)) selecionar(RANDOM_ID, modal);
        else selecionar(escolhidoId, modal);
        return true;
    }

    /** Abre o seletor bloqueante; resolve com o id escolhido (`null` sem catálogo). */
    function abrir() {
        const modal = document.getElementById('deckSelectModal');
        const grade = document.getElementById('deckSelectGrid');
        if (!modal || !grade || decksDoCatalogo().length === 0) {
            console.info('DeckSelect: sem catálogo de decks — a partida segue com o deck aleatório');
            return Promise.resolve(null);
        }

        montarGrade(modal, grade);

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

    // ── exclusão de custom ───────────────────────────────────────────────────

    /**
     * Confirmação genérica: usa o `#gameDialogModal` quando existe (game.html,
     * pvp.html, deck-builder.html) e cai no `confirm()` nativo fora deles.
     */
    function pedirConfirmacao({ titulo, mensagem, confirmarRotulo }) {
        if (typeof document !== 'undefined' && typeof window !== 'undefined'
            && typeof window.showGameConfirm === 'function'
            && document.getElementById('gameDialogModal')) {
            return window.showGameConfirm(titulo, mensagem, confirmarRotulo);
        }
        const nativo = typeof confirm === 'function' ? confirm(`${titulo}\n${mensagem}`) : false;
        return Promise.resolve(nativo);
    }

    /**
     * Exclusão de deck custom com confirmação obrigatória. Oficiais e o
     * aleatório nunca chegam aqui (nem têm botão de lixeira).
     */
    async function pedirExclusaoDeDeck(deckId, deckNome) {
        if (!ehDeckCustom(deckId)) return { ok: false };
        const nome = deckNome || deckId;
        const confirmado = await pedirConfirmacao({
            titulo: 'Excluir deck',
            mensagem: `Excluir "${nome}"? Esta ação não pode ser desfeita.`,
            confirmarRotulo: 'Excluir'
        });
        if (!confirmado) return { ok: false, cancelado: true };
        const excluir = (typeof window !== 'undefined' && window.excluirDeckCustom)
            || (typeof excluirDeckCustom === 'function' ? excluirDeckCustom : null);
        if (typeof excluir !== 'function') return { ok: false };
        const resultado = await excluir(deckId);
        if (resultado && resultado.ok && typeof document !== 'undefined') {
            // Re-render preservando a promessa do `abrir()` (o boot/hotseat
            // espera nela): reabrir criaria uma promessa nova e órfã.
            if (!redesenhar()) window.location?.reload?.();
        }
        return resultado;
    }

    const api = {
        RANDOM_ID,
        PREFS_KEY,
        VERSOS_NA_PILHA,
        CUSTOM_SEPARADOR,
        TRAIT_LABELS,
        rotuloDeTrait,
        traitsDaCarta,
        chipsDeTraits,
        detalheDoDeck,
        criarOpcao,
        decksCustom,
        ehDeckCustom,
        pedirConfirmacao,
        pedirExclusaoDeDeck,
        redesenhar,
        abrir,
        confirmar,
        confirmarAleatorio,
        aberto,
        selecionar,
        lerPreferencia,
        salvarPreferencia,
        deckAleatorio,
        opcoes,
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
