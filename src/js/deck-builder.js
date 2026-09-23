/**
 * deck-builder.js - Página de construção de decks customizados.
 * Lê o catálogo de cartas (`loadCardSystem`) e o catálogo de decks
 * (`loadDeckCatalog`), monta o draft de 40 cartas e calcula tudo em tempo
 * real com `DeckBuilder.getDeckStats` + regras de `CardRules`.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.DeckBuilderUI = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const EMOJIS_EMBLEMA = ['🃏', '🐉', '🤖', '🐾', '🔥', '🌊', '🌿', '⚔️', '🛡️', '👑', '🧛', '😈', '👻', '✨', '🌕', '🕊️', '🧍', '🌑', '🔮', '🎲'];

    let cartas = [];
    let draft = [];
    let emblema = '🃏';

    const janela = typeof window !== 'undefined' ? window : null;
    const $ = id => (typeof document !== 'undefined' ? document.getElementById(id) : null);

    /** Cartas filtradas por busca/tipo/custo/trait. */
    function cartasFiltradas() {
        const busca = ($('builderBusca')?.value || '').toLowerCase();
        const tipo = $('builderFiltroTipo')?.value || '';
        const custo = $('builderFiltroCusto')?.value || '';
        const trait = $('builderFiltroTrait')?.value || '';
        return cartas.filter(carta => {
            if (busca && !(carta.name || '').toLowerCase().includes(busca)) return false;
            if (tipo && carta.type !== tipo) return false;
            if (custo === 'baixo' && carta.cost > 3) return false;
            if (custo === 'medio' && (carta.cost < 4 || carta.cost > 6)) return false;
            if (custo === 'alto' && carta.cost < 7) return false;
            if (trait && !(carta.traits || []).map(t => String(t).toLowerCase()).includes(trait)) return false;
            return true;
        });
    }

    let acaoDeDialogoPendente = null;

    function fecharDialogoDoJogo() {
        const modal = $('gameDialogModal');
        if (modal) modal.classList.remove('visible');
        if (acaoDeDialogoPendente?.resolver) {
            acaoDeDialogoPendente.resolver(false);
            acaoDeDialogoPendente = null;
        }
    }

    function confirmarDialogoDoJogo() {
        const modal = $('gameDialogModal');
        if (modal) modal.classList.remove('visible');
        if (acaoDeDialogoPendente?.resolver) {
            acaoDeDialogoPendente.resolver(true);
            acaoDeDialogoPendente = null;
        }
    }

    function mostrarConfirmacaoDoJogo(titulo, mensagem, rotuloConfirmar = 'OK') {
        return new Promise(resolve => {
            const modal = $('gameDialogModal');
            if (!modal) {
                resolve(typeof confirm === 'function' ? confirm(`${titulo}\n${mensagem}`) : false);
                return;
            }
            const icone = $('gameDialogIcon');
            const tituloEl = $('gameDialogTitle');
            const mensagemEl = $('gameDialogMessage');
            const confirmarBtn = $('gameDialogConfirmBtn');
            const cancelarBtn = $('gameDialogCancelBtn');
            if (icone) icone.textContent = '🗑️';
            if (tituloEl) tituloEl.textContent = titulo;
            if (mensagemEl) mensagemEl.textContent = mensagem;
            if (confirmarBtn) confirmarBtn.textContent = rotuloConfirmar;
            if (cancelarBtn) {
                cancelarBtn.style.display = '';
                cancelarBtn.onclick = () => {
                    fecharDialogoDoJogo();
                    resolve(false);
                };
            }
            acaoDeDialogoPendente = { resolver: resolve };
            modal.classList.add('visible');
        });
    }

    if (janela) {
        janela.closeGameDialog = fecharDialogoDoJogo;
        janela.confirmGameDialog = confirmarDialogoDoJogo;
        janela.showGameConfirm = mostrarConfirmacaoDoJogo;
        janela.fecharModalCarta = fecharModalCarta;
        janela.closeCardModal = fecharModalCarta;
    }

    function renderizarCatalogo() {
        const grade = $('builderGrade');
        if (!grade) return;
        const limite = janela?.limiteDeCopias || (() => 3);
        grade.innerHTML = '';
        const filtradas = cartasFiltradas();
        if (filtradas.length === 0) {
            grade.innerHTML = '<div class="builder-catalogo-vazio">Nenhuma carta encontrada com esses filtros.</div>';
            return;
        }
        filtradas.forEach(carta => {
            const copias = draft.filter(id => id === carta.id).length;
            const maxCopias = limite(carta.id);
            const noLimite = copias >= maxCopias;

            const wrapper = document.createElement('div');
            wrapper.className = 'builder-carta-wrap';

            const botao = document.createElement('button');
            botao.type = 'button';
            botao.className = 'deck-card-mini builder-catalogo-card' + (noLimite ? ' no-limite' : '') + (copias > 0 ? ' no-deck' : '');
            botao.title = `${carta.name} (${carta.type}) — Clique para adicionar (${copias}/${maxCopias})`;

            const atkDef = carta.type === 'criatura' || carta.type === 'evolução'
                ? `<span class="attack" title="Ataque">⚔ ${carta.attack ?? 0}</span> <span class="defense" title="Defesa">🛡 ${carta.defense ?? 0}</span>`
                : `<span class="builder-carta-tipo-tag">${carta.type}</span>`;

            botao.innerHTML = `
                <span class="deck-card-mini-custo" title="Custo: ${carta.cost} de energia">${carta.cost}</span>
                ${carta.image ? `<img class="deck-card-mini-img" src="${carta.image}" alt="${carta.name}" loading="lazy">` : '<span class="deck-card-mini-img is-vazia">🎴</span>'}
                <span class="deck-card-mini-nome" title="${carta.name}">${carta.name}</span>
                <div class="builder-carta-combate">${atkDef}</div>
                <span class="deck-card-mini-copias ${copias > 0 ? 'ativa' : ''}" title="Cópias no deck">${copias}/${maxCopias}</span>`;
            botao.addEventListener('click', () => adicionarCarta(carta.id));

            const btnInfo = document.createElement('button');
            btnInfo.type = 'button';
            btnInfo.className = 'builder-carta-info';
            btnInfo.title = 'Ver detalhes e habilidade da carta';
            btnInfo.setAttribute('aria-label', `Ver detalhes de ${carta.name}`);
            btnInfo.textContent = 'ℹ';
            btnInfo.addEventListener('click', e => {
                e.stopPropagation();
                abrirModalCarta(carta);
            });

            wrapper.appendChild(botao);
            wrapper.appendChild(btnInfo);
            grade.appendChild(wrapper);
        });
    }

    /** Abre o modal de detalhes/habilidade com a mesmíssima estética de showCardModal do jogo. */
    function abrirModalCarta(carta) {
        let modal = $('cardModal') || $('builderCartaModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'cardModal';
            modal.className = 'card-modal';
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.innerHTML = `
                <div class="modal-card">
                    <button class="modal-close" aria-label="Fechar">&times;</button>
                    <div id="modalCardContent"></div>
                </div>`;
            modal.querySelector('.modal-close').addEventListener('click', () => fecharModalCarta());
            modal.addEventListener('click', e => { if (e.target === modal) fecharModalCarta(); });
            document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharModalCarta(); });
            document.body.appendChild(modal);
        }
        const corpo = modal.querySelector('#modalCardContent') || modal.querySelector('.modal-card');
        if (!corpo) return;

        const limite = janela?.limiteDeCopias || (() => 3);
        const copias = draft.filter(id => id === carta.id).length;
        const noLimite = copias >= limite(carta.id);
        const tamanho = janela?.DECK_SIZE || 40;

        const typeMapping = { 'suporte': 'support', 'criatura': 'monster', 'evolução': 'monster' };
        const cssType = typeMapping[carta.type] || carta.type;

        const traitsDaCarta = janela?.DeckSelect?.traitsDaCarta?.(carta) || carta.traits || [];
        const chipsTraits = janela?.DeckSelect?.chipsDeTraits
            ? janela.DeckSelect.chipsDeTraits(traitsDaCarta)
            : traitsDaCarta.map(t => `<span class="trait-chip">${t}</span>`).join('');
        const blocoDeTraits = traitsDaCarta.length > 0 ? `
            <div class="modal-card-traits">
                <h3 class="modal-card-section-title">Características:</h3>
                <div class="deck-traits modal-traits">${chipsTraits}</div>
            </div>` : '';

        const atkDef = carta.type === 'criatura' || carta.type === 'evolução' ? `
            <div class="card-stats">
                <span class="attack">${carta.attack ?? 0}</span>
                <span>/</span>
                <span class="defense">${carta.defense ?? 0}</span>
            </div>` : '';

        corpo.innerHTML = `
            <div class="modal-card-content">
                <div class="card ${cssType}" style="width: 280px; height: 390px; margin: 0 auto; position: relative;">
                    <div class="card-cost">${carta.cost}</div>
                    ${carta.image ? `<img src="${carta.image}" alt="${carta.name}" class="card-image-real">` : '<div class="card-image"></div>'}
                    <div class="card-name">${carta.name}</div>
                    ${atkDef}
                </div>
                ${blocoDeTraits}
                <div style="margin-top: 14px; padding: 12px; background: rgba(0,0,0,0.35); border-radius: 8px; width: 100%; box-sizing: border-box;">
                    <h3 style="color: var(--primary-color, #d4af37); margin-bottom: 8px; text-align: center; font-size: 1rem;">Habilidade:</h3>
                    <p style="font-size: 0.9rem; line-height: 1.45; text-align: center; color: var(--text-color, #f1f5f9); margin: 0;">${carta.hability || 'Sem habilidade especial.'}</p>
                </div>
                <div class="builder-modal-acoes" style="display: flex; gap: 10px; margin-top: 14px; justify-content: center; flex-wrap: wrap; width: 100%;">
                    <button type="button" class="deck-select-confirm builder-modal-btn-add" ${noLimite || draft.length >= tamanho ? 'disabled' : ''}>
                        + Adicionar ao deck (${copias}/${limite(carta.id)})
                    </button>
                    ${copias > 0 ? `<button type="button" class="deck-select-confirm builder-modal-btn-rem" style="border-color: #ef4444; color: #ef4444;">− Remover uma cópia</button>` : ''}
                </div>
            </div>`;

        corpo.querySelector('.builder-modal-btn-add')?.addEventListener('click', () => {
            adicionarCarta(carta.id);
            abrirModalCarta(carta);
        });
        corpo.querySelector('.builder-modal-btn-rem')?.addEventListener('click', () => {
            removerCarta(carta.id);
            abrirModalCarta(carta);
        });
        modal.classList.add('visible');
    }

    function fecharModalCarta() {
        const modal = $('cardModal') || $('builderCartaModal');
        if (modal) modal.classList.remove('visible');
    }


    function adicionarCarta(cartaId) {
        const limite = janela?.limiteDeCopias || (() => 3);
        const tamanho = janela?.DECK_SIZE || 40;
        const copias = draft.filter(id => id === cartaId).length;
        if (copias >= limite(cartaId) || draft.length >= tamanho) return;
        draft.push(cartaId);
        renderizarTudo();
    }
    function removerCarta(cartaId) {
        const indice = draft.indexOf(cartaId);
        if (indice >= 0) draft.splice(indice, 1);
        renderizarTudo();
    }
    function definicoesDoDraft() {
        const porId = {};
        cartas.forEach(carta => { porId[carta.id] = carta; });
        return draft.map(id => porId[id]).filter(Boolean);
    }
    // Stats + 3 afinidades: dominancia, adesao ao tema, sinergia de equipamento.
    function calcularPainel() {
        const defs = definicoesDoDraft();
        const tamanho = janela?.DECK_SIZE || 40;
        const builder = janela?.deckBuilder;
        const stats = builder ? builder.getDeckStats(defs)
            : { total: defs.length, criaturas: 0, suportes: 0, evolucoes: 0, custoMedio: '0.0' };
        const criaturas = defs.filter(c => c.type === 'criatura' || c.type === 'evolução');
        const traitsTema = new Set(
            [...document.querySelectorAll('#builderTraitsForm input:checked')].map(el => el.value)
        );
        const contagemTrait = {};
        criaturas.forEach(c => (c.traits || []).forEach(t => {
            const chave = String(t).toLowerCase();
            contagemTrait[chave] = (contagemTrait[chave] || 0) + 1;
        }));
        const top = Object.entries(contagemTrait).sort((a, b) => b[1] - a[1])[0];
        const dominancia = top && criaturas.length > 0 ? top[1] / criaturas.length : 0;
        const noTema = traitsTema.size === 0 ? criaturas.length
            : criaturas.filter(c => (c.traits || []).some(t => traitsTema.has(String(t).toLowerCase()))).length;
        const adesao = criaturas.length > 0 ? noTema / criaturas.length : 0;
        const regras = janela?.CardRules;
        const suportes = defs.filter(c => c.type === 'suporte');
        const comRegra = suportes.filter(s => regras?.getEquipmentRule?.(s.id));
        const comHosts = comRegra.filter(s => {
            const regra = regras.getEquipmentRule(s.id);
            const exigidas = regra.requiredTraitsAny || (regra.requiredTrait ? [regra.requiredTrait] : []);
            if (!exigidas.length) return false;
            const hosts = criaturas.filter(c => exigidas.some(t =>
                regras.hasTrait({ definitionId: c.id, data: c }, t)));
            return hosts.length >= 3;
        });
        const sinergia = comRegra.length > 0 ? comHosts.length / comRegra.length : 1;
        const curva = {
            baixo: defs.filter(c => c.cost <= 3).length,
            medio: defs.filter(c => c.cost >= 4 && c.cost <= 6).length,
            alto: defs.filter(c => c.cost >= 7).length
        };
        return { stats, contagemTrait, dominancia, top, adesao, sinergia, curva, total: defs.length, tamanho };
    }
    function renderizarPainel() {
        const painel = calcularPainel();
        const totalEl = $('builderTotal');
        if (totalEl) totalEl.textContent = `(${painel.total}/${painel.tamanho})`;

        const statsEl = $('builderStats');
        if (statsEl) {
            statsEl.className = 'deck-detalhe-stats builder-stats';
            statsEl.innerHTML = `
                <span class="deck-detalhe-stat"><b>${painel.total}</b>/<b>${painel.tamanho}</b> cartas</span>
                <span class="deck-detalhe-stat"><b>${painel.stats.criaturas}</b> criaturas</span>
                <span class="deck-detalhe-stat"><b>${painel.stats.suportes}</b> suportes</span>
                ${painel.stats.evolucoes ? `<span class="deck-detalhe-stat"><b>${painel.stats.evolucoes}</b> evolução</span>` : ''}
                <span class="deck-detalhe-stat"><b>${painel.stats.custoMedio}</b> custo médio</span>`;
        }

        const afEl = $('builderAfinidades');
        if (afEl) {
            const pct = valor => `${Math.round(valor * 100)}%`;
            const maximo = Math.max(1, painel.curva.baixo, painel.curva.medio, painel.curva.alto);
            const linhaDeCurva = (rotulo, valor) => {
                const largura = Math.round((valor / maximo) * 100);
                return `
                    <span class="deck-curva-linha">
                        <span class="deck-curva-rotulo">${rotulo}</span>
                        <span class="deck-curva-trilha"><span class="deck-curva-barra" style="width:${largura}%"></span></span>
                        <span class="deck-curva-valor">${valor}</span>
                    </span>`;
            };
            afEl.innerHTML = `
                <div class="deck-detalhe-curva">
                    ${linhaDeCurva('1–3', painel.curva.baixo)}
                    ${linhaDeCurva('4–6', painel.curva.medio)}
                    ${linhaDeCurva('7+', painel.curva.alto)}
                </div>
                <div class="deck-detalhe-stats" style="margin-top: 6px;">
                    <span class="deck-detalhe-stat">Dominância: <b>${painel.top ? painel.top[0] : '-'} (${pct(painel.dominancia)})</b></span>
                    <span class="deck-detalhe-stat">No tema: <b>${pct(painel.adesao)}</b></span>
                    <span class="deck-detalhe-stat">Sinergia: <b>${pct(painel.sinergia)}</b></span>
                </div>`;
        }

        const trEl = $('builderTraits');
        if (trEl) {
            trEl.className = 'deck-traits deck-traits-detalhe builder-traits';
            const traitsDoDeck = Object.keys(painel.contagemTrait);
            trEl.innerHTML = traitsDoDeck.length > 0 && janela?.DeckSelect?.chipsDeTraits
                ? janela.DeckSelect.chipsDeTraits(traitsDoDeck)
                : '<span class="trait-chip">Sem traits no deck</span>';
        }

        const lista = $('builderLista');
        if (lista) {
            lista.innerHTML = '';
            lista.className = 'deck-cards-grid builder-lista';
            const porId = {};
            definicoesDoDraft().forEach(def => {
                porId[def.id] = porId[def.id] || { def, n: 0 };
                porId[def.id].n += 1;
            });
            const itens = Object.values(porId).sort((a, b) => (a.def.cost - b.def.cost) || a.def.name.localeCompare(b.def.name));
            if (itens.length === 0) {
                lista.innerHTML = '<div class="builder-lista-vazia">Seu deck está vazio.<br>Clique nas cartas do catálogo para adicioná-las.</div>';
            } else {
                const limite = janela?.limiteDeCopias || (() => 3);
                itens.forEach(({ def, n }) => {
                    const cardBtn = document.createElement('div');
                    cardBtn.className = 'deck-card-mini builder-mini-item';
                    const noLimite = n >= limite(def.id) || draft.length >= (janela?.DECK_SIZE || 40);
                    cardBtn.innerHTML = `
                        <span class="deck-card-mini-custo">${def.cost}</span>
                        ${def.image ? `<img class="deck-card-mini-img" src="${def.image}" alt="${def.name}" loading="lazy">` : '<span class="deck-card-mini-img is-vazia">🎴</span>'}
                        <span class="deck-card-mini-nome">${def.name}</span>
                        <span class="deck-card-mini-copias">×${n}</span>
                        <div class="builder-card-mini-overlay-acoes">
                            <button type="button" class="builder-mini-btn-add" data-add="${def.id}" title="Adicionar cópia" ${noLimite ? 'disabled' : ''}>+</button>
                            <button type="button" class="builder-mini-btn-rem" data-remove="${def.id}" title="Remover cópia">−</button>
                            <button type="button" class="builder-mini-btn-info" data-info="${def.id}" title="Ver detalhes">ℹ</button>
                        </div>`;
                    cardBtn.querySelector('.deck-card-mini-img')?.addEventListener('click', () => abrirModalCarta(def));
                    cardBtn.querySelector('.deck-card-mini-nome')?.addEventListener('click', () => abrirModalCarta(def));
                    cardBtn.querySelector('[data-add]').addEventListener('click', e => { e.stopPropagation(); adicionarCarta(def.id); });
                    cardBtn.querySelector('[data-remove]').addEventListener('click', e => { e.stopPropagation(); removerCarta(def.id); });
                    cardBtn.querySelector('[data-info]').addEventListener('click', e => { e.stopPropagation(); abrirModalCarta(def); });
                    lista.appendChild(cardBtn);
                });
            }
        }

        const barra = $('builderProgressoBarra');
        if (barra) {
            const pct = Math.min(100, Math.round((painel.total / painel.tamanho) * 100));
            barra.style.width = `${pct}%`;
            barra.classList.toggle('completa', painel.total === painel.tamanho);
            $('builderProgresso')?.setAttribute('aria-valuenow', String(painel.total));
        }
        const salvar = $('builderSalvar');
        if (salvar) salvar.disabled = painel.total !== painel.tamanho;
    }
    function montarForm() {
        const filtroTrait = $('builderFiltroTrait');
        const formTraits = $('builderTraitsForm');
        const rotulos = janela?.DeckSelect?.TRAIT_LABELS || {};
        if (filtroTrait && filtroTrait.options.length <= 1) {
            Object.keys(rotulos).sort().forEach(trait => {
                const opt = document.createElement('option');
                opt.value = trait;
                opt.textContent = `${rotulos[trait].icone} ${rotulos[trait].rotulo}`;
                filtroTrait.appendChild(opt);
            });
        }
        if (formTraits && formTraits.children.length === 0) {
            Object.keys(rotulos).sort().forEach(trait => {
                const label = document.createElement('label');
                label.innerHTML = `<input type="checkbox" value="${trait}"> ${rotulos[trait].icone} ${rotulos[trait].rotulo}`;
                label.querySelector('input').addEventListener('change', () => {
                    renderizarPainel();
                    renderizarPreview();
                });
                formTraits.appendChild(label);
            });
        }
        const grade = $('builderEmojiGrade');
        if (grade && grade.children.length === 0) {
            EMOJIS_EMBLEMA.forEach(emoji => {
                const botao = document.createElement('button');
                botao.type = 'button';
                botao.className = 'builder-emoji' + (emoji === emblema ? ' selecionado' : '');
                botao.textContent = emoji;
                botao.addEventListener('click', () => {
                    emblema = emoji;
                    const campo = $('builderEmblema');
                    if (campo) campo.value = emoji;
                    grade.querySelectorAll('.builder-emoji').forEach(el =>
                        el.classList.toggle('selecionado', el.textContent === emoji));
                    renderizarPreview();
                });
                grade.appendChild(botao);
            });
        }
    }

    function lerFormulario() {
        return {
            nome: ($('builderNome')?.value || '').trim(),
            tema: ($('builderTema')?.value || '').trim(),
            descricao: ($('builderDescricao')?.value || '').trim(),
            emblema: ($('builderEmblema')?.value || emblema || '🃏').trim() || '🃏',
            traits: [...document.querySelectorAll('#builderTraitsForm input:checked')].map(el => el.value),
            cores: {
                primaria: $('builderCorPrimaria')?.value || '#d4af37',
                secundaria: $('builderCorSecundaria')?.value || '#1a1e28',
                acento: $('builderCorAcento')?.value || '#f8fafc'
            },
            cartas: [...draft]
        };
    }

    /** Rascunho atual no formato de um deck do catálogo (alimenta a prévia). */
    function deckEmPrevia() {
        const form = lerFormulario();
        return {
            id: 'builder-preview',
            custom: false,
            nome: form.nome || 'Meu deck',
            tema: form.tema,
            descricao: form.descricao,
            emblema: form.emblema,
            traits: form.traits,
            cores: form.cores,
            cartas: form.cartas
        };
    }

    /**
     * Prévia à direita: mostra apenas o card de listagem do seletor
     * (como o deck vai aparecer em "Meus decks"), sem a grade de miniaturas.
     */
    function renderizarPreview() {
        const listagem = $('builderPreviewListagem');
        const ds = janela?.DeckSelect;
        if (!listagem || !ds?.criarOpcao) return;
        const deck = deckEmPrevia();
        listagem.innerHTML = '';
        listagem.appendChild(ds.criarOpcao(deck));
    }

    function mostrarErro(msg) {
        const el = $('builderErro');
        if (!el) return;
        el.textContent = msg;
        el.hidden = !msg;
    }
    function mostrarOk(msg) {
        const el = $('builderOk');
        if (!el) return;
        el.textContent = msg;
        el.hidden = !msg;
        mostrarErro('');
    }
    async function salvar() {
        const deck = lerFormulario();
        const acao = janela?.salvarDeckCustom;
        const resultado = acao ? await acao(deck) : { ok: false, erros: ['Sistema indisponivel.'] };
        if (!resultado.ok) {
            mostrarErro((resultado.erros || ['Nao foi possivel salvar.']).join(' '));
            return;
        }
        mostrarOk(`Deck "${resultado.deck.nome}" salvo.`);
        await renderizarMeusDecks();
    }
    async function renderizarMeusDecks() {
        const lista = $('builderMeusLista');
        const contador = $('builderCustomCount');
        const customs = (janela?.listarDecksCustom?.() || []).slice().reverse();
        if (contador) contador.textContent = `(${customs.length})`;
        if (!lista) return;
        lista.innerHTML = customs.length === 0 ? '<p class="builder-subtitulo">Nenhum deck ainda.</p>' : '';
        customs.forEach(deck => {
            const card = document.createElement('div');
            card.className = 'builder-meus-card';
            card.innerHTML = `
                <div><b>${deck.emblema || '🃏'} ${deck.nome}</b></div>
                <div class="builder-subtitulo">${deck.tema || ''} - ${deck.cartas.length} cartas</div>
                <div class="builder-meus-acoes">
                    <button type="button" data-editar>Carregar</button>
                    <button type="button" data-excluir>Excluir</button>
                </div>`;
            card.querySelector('[data-editar]').addEventListener('click', () => {
                draft = [...deck.cartas];
                if ($('builderNome')) $('builderNome').value = deck.nome || '';
                if ($('builderTema')) $('builderTema').value = deck.tema || '';
                if ($('builderDescricao')) $('builderDescricao').value = deck.descricao || '';
                if ($('builderEmblema')) $('builderEmblema').value = deck.emblema || '🃏';
                renderizarTudo();
                trocarAba('construir');
            });
            card.querySelector('[data-excluir]').addEventListener('click', async () => {
                const confirmado = await mostrarConfirmacaoDoJogo(
                    'Excluir deck',
                    `Excluir "${deck.nome}"? Esta ação não pode ser desfeita.`,
                    'Excluir'
                );
                if (!confirmado) return;
                const excluir = janela?.excluirDeckCustom || (typeof excluirDeckCustom === 'function' ? excluirDeckCustom : null);
                if (excluir) await excluir(deck.id);
                await renderizarMeusDecks();
                renderizarCatalogo();
            });
            lista.appendChild(card);
        });
    }
    /**
     * Colapsa um fieldset do form (traits / emblema) pelo botão da legend:
     * alterna `.fechado`, chevron ▾/▸ e `aria-expanded`.
     */
    function ligarCollapse(seletor, botaoId, rotulo) {
        const campo = document.querySelector(seletor);
        const botao = $(botaoId);
        if (!campo || !botao) return;
        botao.addEventListener('click', () => {
            const fechado = campo.classList.toggle('fechado');
            botao.setAttribute('aria-expanded', fechado ? 'false' : 'true');
            botao.textContent = fechado ? `${rotulo} ▸` : `${rotulo} ▾`;
        });
    }

    function trocarAba(nome) {
        document.querySelectorAll('.builder-aba').forEach(el =>
            el.classList.toggle('ativa', el.dataset.aba === nome));
        document.querySelectorAll('[data-painel]').forEach(el => {
            el.hidden = el.dataset.painel !== nome;
        });
    }
    function renderizarTudo() {
        renderizarCatalogo();
        renderizarPainel();
        renderizarPreview();
    }

    async function iniciar() {
        if (typeof loadCardSystem === 'function') await loadCardSystem();
        if (typeof loadDeckCatalog === 'function') await loadDeckCatalog();
        cartas = (janela?.cardsDatabase?.cards || []).slice();
        montarForm();
        ['builderBusca', 'builderFiltroTipo', 'builderFiltroCusto', 'builderFiltroTrait'].forEach(id => {
            $(id)?.addEventListener('input', renderizarCatalogo);
            $(id)?.addEventListener('change', renderizarCatalogo);
        });
        $('builderLimpar')?.addEventListener('click', () => { draft = []; renderizarTudo(); });
        $('builderSalvar')?.addEventListener('click', salvar);
        // Identidade (nome, tema, cores, emblema) alimenta a prévia em tempo real.
        $('builderForm')?.addEventListener('input', renderizarPreview);
        // Collapses do formulário nascem fechados; ligarCollapse cuida do toggle.
        [
            ['.builder-traits-form', 'builderTraitsToggle', 'Traits do tema'],
            ['.builder-emblema',     'builderEmblemaToggle', 'Emblema']
        ].forEach(([seletor, botaoId, rotulo]) => {
            const campo = document.querySelector(seletor);
            const botao = $(botaoId);
            if (campo && botao) {
                campo.classList.add('fechado');
                botao.setAttribute('aria-expanded', 'false');
                botao.textContent = `${rotulo} ▸`;
            }
            ligarCollapse(seletor, botaoId, rotulo);
        });
        document.querySelectorAll('.builder-aba').forEach(el =>
            el.addEventListener('click', () => trocarAba(el.dataset.aba)));
        const modalCarta = $('cardModal');
        if (modalCarta) {
            modalCarta.addEventListener('click', e => { if (e.target === modalCarta) fecharModalCarta(); });
            document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharModalCarta(); });
        }
        const modalDialog = $('gameDialogModal');
        if (modalDialog) {
            modalDialog.addEventListener('click', e => { if (e.target === modalDialog) fecharDialogoDoJogo(); });
            document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharDialogoDoJogo(); });
        }
        renderizarTudo();
        await renderizarMeusDecks();
    }
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
        else iniciar();
    }
    return { adicionarCarta, removerCarta, calcularPainel, lerFormulario, renderizarPreview, salvar, iniciar };
});
