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

    function renderizarCatalogo() {
        const grade = $('builderGrade');
        if (!grade) return;
        const limite = janela?.limiteDeCopias || (() => 3);
        grade.innerHTML = '';
        cartasFiltradas().forEach(carta => {
            const copias = draft.filter(id => id === carta.id).length;
            const noLimite = copias >= limite(carta.id);

            const wrapper = document.createElement('div');
            wrapper.className = 'builder-carta-wrap';

            const botao = document.createElement('button');
            botao.type = 'button';
            botao.className = 'builder-carta' + (noLimite ? ' no-limite' : '');
            botao.title = `${carta.name} — clique para adicionar ao deck (${copias}/${limite(carta.id)})`;

            const atkDef = carta.type === 'criatura' || carta.type === 'evolução'
                ? `<span class="builder-carta-atk">⚔${carta.attack ?? '?'}</span><span class="builder-carta-def">🛡${carta.defense ?? '?'}</span>`
                : '';
            botao.innerHTML = `
                ${carta.image ? `<img src="${carta.image}" alt="${carta.name}" loading="lazy">` : ''}
                <div class="builder-carta-nome" title="${carta.name}">${carta.name}</div>
                <div class="builder-carta-meta">
                    <span class="builder-carta-custo">C${carta.cost}</span>${atkDef}<span class="builder-carta-copias">${copias}x</span>
                </div>`;
            botao.addEventListener('click', () => adicionarCarta(carta.id));

            const btnInfo = document.createElement('button');
            btnInfo.type = 'button';
            btnInfo.className = 'builder-carta-info';
            btnInfo.title = 'Ver descrição';
            btnInfo.setAttribute('aria-label', `Ver descrição de ${carta.name}`);
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

    /** Abre o modal de detalhes/habilidade de uma carta. */
    function abrirModalCarta(carta) {
        let modal = $('builderCartaModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'builderCartaModal';
            modal.className = 'builder-carta-modal';
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.innerHTML = `
                <div class="builder-carta-modal-card">
                    <button class="builder-carta-modal-fechar" aria-label="Fechar">×</button>
                    <div id="builderCartaModalCorpo"></div>
                </div>`;
            modal.querySelector('.builder-carta-modal-fechar').addEventListener('click', () => fecharModalCarta());
            modal.addEventListener('click', e => { if (e.target === modal) fecharModalCarta(); });
            document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharModalCarta(); });
            document.body.appendChild(modal);
        }
        const corpo = $('builderCartaModalCorpo');
        if (!corpo) return;

        const limite = janela?.limiteDeCopias || (() => 3);
        const copias = draft.filter(id => id === carta.id).length;
        const noLimite = copias >= limite(carta.id);
        const tamanho = janela?.DECK_SIZE || 40;

        const atkDef = carta.type === 'criatura' || carta.type === 'evolução'
            ? `<div class="builder-cm-combate"><span>⚔ Ataque: <b>${carta.attack ?? '—'}</b></span><span>🛡 Defesa: <b>${carta.defense ?? '—'}</b></span></div>`
            : '';
        corpo.innerHTML = `
            <div class="builder-cm-layout">
                ${carta.image ? `<img class="builder-cm-img" src="${carta.image}" alt="${carta.name}">` : ''}
                <div class="builder-cm-info">
                    <h3 class="builder-cm-nome">${carta.name}</h3>
                    <div class="builder-cm-tags">
                        <span class="builder-cm-tipo">${carta.type}</span>
                        <span class="builder-cm-custo">Custo ${carta.cost}</span>
                        ${(carta.traits || []).map(t => `<span class="builder-cm-trait">${t}</span>`).join('')}
                    </div>
                    ${atkDef}
                    <p class="builder-cm-habilidade">${carta.hability || '<em>Sem habilidade especial.</em>'}</p>
                    <div class="builder-cm-acoes">
                        <button type="button" class="builder-cm-btn-add" ${noLimite || draft.length >= tamanho ? 'disabled' : ''}>
                            + Adicionar ao deck (${copias}/${limite(carta.id)})
                        </button>
                        ${copias > 0 ? `<button type="button" class="builder-cm-btn-rem">− Remover uma cópia</button>` : ''}
                    </div>
                </div>
            </div>`;
        corpo.querySelector('.builder-cm-btn-add')?.addEventListener('click', () => {
            adicionarCarta(carta.id);
            abrirModalCarta(carta);
        });
        corpo.querySelector('.builder-cm-btn-rem')?.addEventListener('click', () => {
            removerCarta(carta.id);
            abrirModalCarta(carta);
        });
        modal.classList.add('aberto');
        modal.querySelector('.builder-carta-modal-fechar')?.focus();
    }

    function fecharModalCarta() {
        $('builderCartaModal')?.classList.remove('aberto');
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
            statsEl.innerHTML = `
                <span class="builder-stat">Criaturas <b>${painel.stats.criaturas}</b></span>
                <span class="builder-stat">Suportes <b>${painel.stats.suportes}</b></span>
                <span class="builder-stat">Evolucoes <b>${painel.stats.evolucoes}</b></span>
                <span class="builder-stat">Custo medio <b>${painel.stats.custoMedio}</b></span>
                <span class="builder-stat">Curva <b>${painel.curva.baixo}/${painel.curva.medio}/${painel.curva.alto}</b></span>`;
        }
        const afEl = $('builderAfinidades');
        if (afEl) {
            const pct = valor => `${Math.round(valor * 100)}%`;
            afEl.innerHTML = `
                <span class="builder-afinidade">Dominancia <b>${painel.top ? painel.top[0] : '-'} ${pct(painel.dominancia)}</b></span>
                <span class="builder-afinidade">No tema <b>${pct(painel.adesao)}</b></span>
                <span class="builder-afinidade">Equipamentos <b>${pct(painel.sinergia)}</b></span>`;
        }
        const trEl = $('builderTraits');
        if (trEl) {
            trEl.innerHTML = Object.entries(painel.contagemTrait)
                .sort((a, b) => b[1] - a[1])
                .map(([trait, n]) => `<span class="builder-trait-chip">${trait} <b>${n}</b></span>`).join('')
                || '<span class="builder-trait-chip">Sem traits no deck</span>';
        }
        const lista = $('builderLista');
        if (lista) {
            lista.innerHTML = '';
            const porId = {};
            definicoesDoDraft().forEach(def => {
                porId[def.id] = porId[def.id] || { def, n: 0 };
                porId[def.id].n += 1;
            });
            Object.values(porId).forEach(({ def, n }) => {
                const item = document.createElement('div');
                item.className = 'builder-lista-item';
                item.innerHTML = `
                    ${def.image ? `<img src="${def.image}" alt="${def.name}">` : ''}
                    <div>${def.name} x${n}</div>
                    <div class="builder-lista-controles">
                        <button type="button" data-add="${def.id}">+</button>
                        <button type="button" data-remove="${def.id}">-</button>
                    </div>`;
                item.querySelector('[data-add]').addEventListener('click', () => adicionarCarta(def.id));
                item.querySelector('[data-remove]').addEventListener('click', () => removerCarta(def.id));
                lista.appendChild(item);
            });
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
                const pedir = janela?.DeckSelect?.pedirExclusaoDeDeck;
                if (pedir) await pedir(deck.id, deck.nome);
                else if (janela?.excluirDeckCustom) await janela.excluirDeckCustom(deck.id);
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
        renderizarTudo();
        await renderizarMeusDecks();
    }
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
        else iniciar();
    }
    return { adicionarCarta, removerCarta, calcularPainel, lerFormulario, renderizarPreview, salvar, iniciar };
});
