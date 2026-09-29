/**
 * card-gallery.js - Piloto da galeria de cartas (`cartas.html`).
 *
 * Lê o catálogo pelo caminho canônico (`loadCardSystem` → `window.cardsDatabase`,
 * nunca um re-fetch do JSON), esparrama as cartas numa esteira horizontal e
 * navega como carrossel: scroll nativo + `scroll-snap`, setas do teclado,
 * Primeira/Última e salto por posição digitada.
 *
 * O leque é calculado em CSS, não enumerado: o renderer escreve `--i` em cada
 * carta e o índice ativo vira `--galeria-ativo` na esteira — a mesma técnica do
 * leque da mão (`--i`/`--n` em `src/css/game.css`). JS nunca re-renderiza no
 * scroll: só troca a classe `.galeria-ativa` e o contador.
 *
 * A "carta na mão" é o mesmo princípio em 3D: segurar (arrastar para cima ou
 * ficar parado) tira a carta da esteira para um overlay com `perspective` +
 * `preserve-3d`, o arrasto vira `rotateX/rotateY` escrito em `--mao-x`/`--mao-y`
 * e passar de 90° mostra o verso (`.card-back` de `game.css`). Sem biblioteca de
 * tilt: o efeito precisa de hold, giro além de 90° e verso — nada disso existe
 * num tilt de hover.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.CardGallery = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const janela = typeof window !== 'undefined' ? window : null;
    const doc = typeof document !== 'undefined' ? document : null;
    const $ = id => (doc ? doc.getElementById(id) : null);

    /** Tipos do catálogo → classes CSS da carta canônica (mesmo mapa de `createCard`). */
    const CLASSE_DO_TIPO = Object.freeze({
        criatura: 'monster',
        monster: 'monster',
        evolucao: 'monster',
        suporte: 'support',
        support: 'support'
    });

    let cartas = [];
    let nodos = [];
    let esteira = null;
    let ativo = 0;
    let quadroPendente = 0;

    // ── carta na mão: limites do gesto ───────────────────────────────────────
    // O giro cruza 90° (o verso aparece no meio do movimento, como uma carta
    // virando de verdade) e a inclinação não passa do "deitada de lado".
    const LIMITE_GIRO_Y = 180;
    const LIMITE_GIRO_X = 90;
    const GANHO_GIRO = 0.5;        // px de arraste horizontal → graus
    const GANHO_INCLINACAO = 0.35; // px de arraste vertical → graus
    const LIMIAR_PEGAR_PX = 24;    // arraste para cima que pega a carta
    const LIMIAR_PEGAR_MS = 220;   // ...ou segurar parado por esse tempo
    const PASSO_TECLADO = 15;      // graus por toque de seta
    const PAUSA_POSE_MS = 760;     // quanto tempo a carta assentada fica à vista

    const mao = {
        indice: -1,
        giroY: 0,
        giroX: 0,
        virada: false,
        seguindo: false,
        devolvendo: false,
        ultimoX: 0,
        ultimoY: 0
    };
    let timerPegar = 0;
    let timerDevolver = 0;

    // ── utilidades ───────────────────────────────────────────────────────────

    function catalogo() {
        const base = janela?.cardsDatabase?.cards;
        return Array.isArray(base) ? base : [];
    }

    function esc(texto) {
        return String(texto ?? '').replace(/[&<>"']/g, caractere => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[caractere]));
    }

    /** `evolução` → `evolucao`: só para virar classe CSS. */
    function chaveDoTipo(tipo) {
        return String(tipo ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    }

    function classeDoTipo(tipo) {
        return CLASSE_DO_TIPO[chaveDoTipo(tipo)] || 'monster';
    }

    function reduzirMovimento() {
        return Boolean(janela?.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    }

    function limitar(valor, minimo, maximo) {
        return Math.min(Math.max(valor, minimo), maximo);
    }

    /** Pose de repouso: o giro encosta no múltiplo de 180° mais próximo (frente ou verso). */
    function poseDeRepouso(giroY) {
        return limitar(Math.round(giroY / 180) * 180, -LIMITE_GIRO_Y, LIMITE_GIRO_Y);
    }

    /** Arraste em pixels → graus, com o salto de um único movimento já limitado. */
    function grausDeArrasto(pixels, ganho, limite) {
        return limitar(pixels * ganho, -limite, limite);
    }

    function avisar(mensagem) {
        const aviso = $('galeriaAviso');
        if (!aviso) return;
        aviso.textContent = mensagem || '';
        aviso.hidden = !mensagem;
    }

    /** Chip de habilidade ativável: quem decide é o `CardRules`, aqui só se exibe. */
    function chipDeAtivacao(carta) {
        const regra = janela?.CardRules?.getActivatedRule?.(carta.id);
        if (!regra) return '';
        const zona = regra.sourceZone === 'hand' ? 'da mão'
            : regra.sourceZone === 'equipment' ? 'do equipamento'
                : 'do campo';
        return `<span class="galeria-chip galeria-chip-ativa" title="Habilidade ativável">⚡ Ativável ${zona}</span>`;
    }

    // ── renderização ─────────────────────────────────────────────────────────

    function criarCarta(carta, indice) {
        const botao = doc.createElement('button');
        botao.type = 'button';
        botao.className = 'galeria-carta';
        botao.dataset.indice = String(indice);
        botao.style.setProperty('--i', String(indice));
        // Roving tabindex: só a carta ativa é parada de Tab (110 botões na fila
        // tornariam a esteira inutilizável pelo teclado).
        botao.tabIndex = indice === 0 ? 0 : -1;
        botao.title = `${indice + 1}. ${carta.name} — clique para centralizar; clique de novo para ampliar`;
        // O carrossel mostra só a arte (o CSS esconde custo/nome/atributos), então
        // o leitor de tela recebe os números por aqui em vez do texto da face.
        botao.setAttribute('aria-label',
            `${indice + 1}. ${carta.name}, custo ${carta.cost ?? 0}, ataque ${carta.attack ?? 0}, defesa ${carta.defense ?? 0}`);
        botao.innerHTML = `
            <span class="card ${classeDoTipo(carta.type)}">
                <span class="card-cost">${carta.cost ?? 0}</span>
                ${carta.image
                    ? `<img class="card-image-real" src="${carta.image}" alt="${esc(carta.name)}" loading="lazy" decoding="async">`
                    : '<span class="card-image">🎴</span>'}
                <span class="card-name">${esc(carta.name)}</span>
                <span class="card-stats">
                    <span class="attack">${carta.attack ?? 0}</span>
                    <span>/</span>
                    <span class="defense">${carta.defense ?? 0}</span>
                </span>
            </span>`;
        botao.addEventListener('click', () => {
            if (indice === ativo) abrirZoom();
            else irPara(indice);
        });
        // Dois cliques = pegar na mão (mesmo caminho do botão ✋ do painel). O segundo
        // clique já abriu o zoom, então fecha ele primeiro: a mão fica sendo a única
        // camada aberta e, ao devolver a carta, a página volta limpa.
        botao.addEventListener('dblclick', evento => {
            evento.preventDefault();
            fecharZoom();
            pegarNaMao(indice);
        });
        return botao;
    }

    function detalhe(carta, indice) {
        if (!carta) return '<p class="galeria-detalhe-vazio">Nenhuma carta selecionada.</p>';
        const traits = janela?.DeckSelect?.traitsDaCarta?.(carta) || [];
        const chips = janela?.DeckSelect?.chipsDeTraits?.(traits) || '';
        return `
            <h2 class="galeria-detalhe-nome">${esc(carta.name)}</h2>
            <p class="galeria-detalhe-meta">
                <span class="galeria-chip galeria-tipo-${chaveDoTipo(carta.type)}">${esc(carta.type)}</span>
                <span class="galeria-chip">⚡ Custo ${carta.cost ?? 0}</span>
                <span class="galeria-chip galeria-atk">⚔ ${carta.attack ?? 0}</span>
                <span class="galeria-chip galeria-def">🛡 ${carta.defense ?? 0}</span>
                <span class="galeria-chip galeria-id">${esc(carta.id)}</span>
                <span class="galeria-chip galeria-pos">posição ${indice + 1}/${cartas.length}</span>
                ${chipDeAtivacao(carta)}
            </p>
            ${chips ? `<div class="deck-traits galeria-traits">${chips}</div>` : ''}
            <div class="galeria-habilidade">
                <h3>Habilidade</h3>
                <p>${esc(carta.hability) || 'Sem habilidade especial.'}</p>
            </div>
            <div class="galeria-detalhe-acoes">
                <button type="button" class="galeria-btn galeria-pegar" title="Segurar a carta na mão e girar">✋ Na mão</button>
                <button type="button" class="galeria-btn galeria-zoom">🔍 Ver carta inteira</button>
            </div>`;
    }

    function renderizar() {
        esteira = $('galeriaEsteira');
        if (!esteira) return;
        cartas = catalogo();
        nodos = [];
        esteira.innerHTML = '';

        const fragmento = doc.createDocumentFragment();
        cartas.forEach((carta, indice) => {
            const nodo = criarCarta(carta, indice);
            nodos.push(nodo);
            fragmento.appendChild(nodo);
        });
        esteira.appendChild(fragmento);

        const vazio = $('galeriaVazio');
        if (vazio) vazio.hidden = cartas.length > 0;
        const salto = $('galeriaIrPara');
        if (salto) {
            salto.max = String(Math.max(cartas.length, 1));
            salto.disabled = cartas.length === 0;
            salto.placeholder = cartas.length ? String(Math.min(37, cartas.length)) : '';
        }

        marcarAtivo(0);
        // Primeiro paint já centrado, sem animação.
        esteira.scrollLeft = offsetCentral(ativo);
    }

    // ── navegação ────────────────────────────────────────────────────────────

    /** Distância de rolagem que põe a carta no centro da esteira. */
    function offsetCentral(indice) {
        const nodo = nodos[indice];
        if (!nodo || !esteira) return 0;
        const centroCarta = nodo.offsetLeft + nodo.offsetWidth / 2;
        return Math.max(0, centroCarta - esteira.clientWidth / 2);
    }

    function rolarPara(indice, comportamento) {
        if (!esteira) return;
        const modo = comportamento || (reduzirMovimento() ? 'auto' : 'smooth');
        esteira.scrollTo({ left: offsetCentral(indice), behavior: modo });
    }

    /** Carta mais próxima do centro da esteira (o índice ativo depois do scroll). */
    function indiceMaisProximo() {
        if (!esteira || nodos.length === 0) return 0;
        const centro = esteira.scrollLeft + esteira.clientWidth / 2;
        let melhor = 0;
        let menor = Infinity;
        nodos.forEach((nodo, indice) => {
            const distancia = Math.abs(nodo.offsetLeft + nodo.offsetWidth / 2 - centro);
            if (distancia < menor) { menor = distancia; melhor = indice; }
        });
        return melhor;
    }

    function marcarAtivo(indice) {
        const total = cartas.length;
        if (!total) return;
        const limitado = Math.min(Math.max(Math.trunc(indice) || 0, 0), total - 1);
        ativo = limitado;

        nodos.forEach((nodo, i) => {
            const ehAtiva = i === limitado;
            nodo.classList.toggle('galeria-ativa', ehAtiva);
            nodo.tabIndex = ehAtiva ? 0 : -1;
            if (ehAtiva) nodo.setAttribute('aria-current', 'true');
            else nodo.removeAttribute('aria-current');
        });
        esteira?.style.setProperty('--galeria-ativo', String(limitado));

        const contador = $('galeriaContador');
        if (contador) contador.textContent = `${limitado + 1} / ${total}`;

        const salto = $('galeriaIrPara');
        if (salto && doc.activeElement !== salto) salto.value = String(limitado + 1);

        const painel = $('galeriaDetalhe');
        if (painel) {
            painel.innerHTML = detalhe(cartas[limitado], limitado);
            painel.querySelector('.galeria-zoom')?.addEventListener('click', () => abrirZoom());
            painel.querySelector('.galeria-pegar')?.addEventListener('click', () => pegarNaMao(ativo));
        }
    }

    function irPara(indice) {
        if (!cartas.length) return;
        const limitado = Math.min(Math.max(Math.trunc(indice) || 0, 0), cartas.length - 1);
        avisar('');
        marcarAtivo(limitado);
        rolarPara(limitado);
    }

    function anterior() { irPara(ativo - 1); }
    function proxima() { irPara(ativo + 1); }
    function primeira() { irPara(0); }
    function ultima() { irPara(cartas.length - 1); }

    /** Salto por posição digitada (1..N): clampado, sem mover nada quando inválido. */
    function saltarParaDigitado() {
        const salto = $('galeriaIrPara');
        if (!salto || !cartas.length) return;
        const valor = parseInt(salto.value, 10);
        if (!Number.isFinite(valor) || valor < 1) {
            avisar(`Digite uma posição entre 1 e ${cartas.length}.`);
            salto.focus();
            return;
        }
        const acima = valor > cartas.length;
        // `irPara` limpa o aviso: o recado de estouro tem que vir depois dele.
        irPara(valor - 1);
        if (acima) avisar(`O baralho tem ${cartas.length} cartas — indo para a última.`);
    }

    // ── modal de zoom ────────────────────────────────────────────────────────

    function zoomAberto() {
        return Boolean($('cardModal')?.classList.contains('visible'));
    }

    /** Miolo da carta canônica: o mesmo no modal de zoom e na carta na mão. */
    function frenteDaCarta(carta) {
        return `
            <div class="card-cost">${carta.cost ?? 0}</div>
            ${carta.image
                ? `<img src="${carta.image}" alt="${esc(carta.name)}" class="card-image-real">`
                : '<div class="card-image"></div>'}
            <div class="card-name">${esc(carta.name)}</div>
            <div class="card-stats">
                <span class="attack">${carta.attack ?? 0}</span>
                <span>/</span>
                <span class="defense">${carta.defense ?? 0}</span>
            </div>`;
    }

    /** Carta ampliada: mesmo markup do modal de `deck-builder.js`, sem CSS inline. */
    function abrirZoom(cartaOverride) {
        const carta = cartaOverride || cartas[ativo];
        const modal = $('cardModal');
        const corpo = $('modalCardContent');
        if (!modal || !corpo || !carta) return;
        const traits = janela?.DeckSelect?.traitsDaCarta?.(carta) || [];
        const chips = janela?.DeckSelect?.chipsDeTraits?.(traits) || '';
        corpo.innerHTML = `
            <div class="modal-card-content galeria-modal-content">
                <div class="card ${classeDoTipo(carta.type)} galeria-modal-carta">${frenteDaCarta(carta)}
                </div>
                ${chips ? `
                    <div class="modal-card-traits">
                        <h3 class="modal-card-section-title">Características:</h3>
                        <div class="deck-traits modal-traits">${chips}</div>
                    </div>` : ''}
                <div class="galeria-modal-habilidade">
                    <h3>Habilidade</h3>
                    <p>${esc(carta.hability) || 'Sem habilidade especial.'}</p>
                </div>
                <p class="galeria-modal-meta">
                    ${esc(carta.type)} · ${esc(carta.id)} · posição ${ativo + 1} de ${cartas.length}
                </p>
            </div>`;
        modal.classList.add('visible');
        modal.querySelector('.modal-close')?.focus();
    }

    function fecharZoom() {
        const modal = $('cardModal');
        if (!modal) return;
        modal.classList.remove('visible');
        nodos[ativo]?.focus();
    }

    // ── carta na mão: segurar, girar e ver o verso ───────────────────────────

    function maoAberta() {
        return mao.indice >= 0;
    }

    /** Escreve a pose nas variáveis CSS e anuncia o estado para o leitor de tela. */
    function marcarMao() {
        const camada = $('galeriaMao');
        const cartaMao = $('galeriaMaoCarta');
        if (!cartaMao) return;
        cartaMao.style.setProperty('--mao-x', `${mao.giroX.toFixed(2)}deg`);
        cartaMao.style.setProperty('--mao-y', `${mao.giroY.toFixed(2)}deg`);
        cartaMao.style.setProperty('--mao-escala', mao.devolvendo ? '1' : '1.06');
        camada?.classList.toggle('seguindo', mao.seguindo);

        const carta = cartas[mao.indice];
        const lado = mao.virada ? 'verso' : 'frente';
        camada?.setAttribute('aria-label', carta ? `${carta.name} na mão, ${lado} à vista` : 'Carta na mão');
        const estado = $('galeriaMaoEstado');
        if (estado) estado.textContent = carta ? `${carta.name} na mão — ${lado}` : '';
    }

    /**
     * Pega a carta na mão: ela sobe para o overlay e o lugar dela na esteira fica
     * vazio. O nó continua lá de propósito — removê-lo mudaria `offsetLeft` de
     * todas as outras cartas no meio do gesto (snap e centralização quebrariam).
     */
    function pegarNaMao(indice) {
        const camada = $('galeriaMao');
        const frente = $('galeriaMaoFrente');
        const carta = cartas[indice];
        if (!camada || !frente || !carta || maoAberta()) return false;

        marcarAtivo(indice);   // contador e painel acompanham a carta que subiu
        frente.className = `card ${classeDoTipo(carta.type)} galeria-mao-frente`;
        frente.innerHTML = frenteDaCarta(carta);

        mao.indice = indice;
        mao.giroX = 0;
        mao.giroY = 0;
        mao.virada = false;
        mao.seguindo = false;
        mao.devolvendo = false;

        nodos[indice]?.classList.add('galeria-segurada');
        camada.hidden = false;
        camada.classList.add('aberta');
        camada.setAttribute('aria-hidden', 'false');
        marcarMao();
        $('galeriaMaoVirar')?.focus();
        return true;
    }

    /** Gira com o ponteiro: deltas em pixels, sem transição (acompanha o dedo). */
    function girarMao(deltaX, deltaY) {
        if (!maoAberta() || mao.devolvendo) return;
        mao.seguindo = true;
        mao.giroY = limitar(mao.giroY + grausDeArrasto(deltaX, GANHO_GIRO, LIMITE_GIRO_Y), -LIMITE_GIRO_Y, LIMITE_GIRO_Y);
        mao.giroX = limitar(mao.giroX - grausDeArrasto(deltaY, GANHO_INCLINACAO, LIMITE_GIRO_X), -LIMITE_GIRO_X, LIMITE_GIRO_X);
        mao.virada = Math.abs(mao.giroY) > 90;
        marcarMao();
    }

    /** Gira por teclado: passo fixo com a transição ligada, para o giro ser visível. */
    function girarPorTecla(deltaGiroY, deltaGiroX) {
        if (!maoAberta() || mao.devolvendo) return;
        mao.seguindo = false;
        mao.giroY = limitar(mao.giroY + deltaGiroY, -LIMITE_GIRO_Y, LIMITE_GIRO_Y);
        mao.giroX = limitar(mao.giroX + deltaGiroX, -LIMITE_GIRO_X, LIMITE_GIRO_X);
        mao.virada = Math.abs(mao.giroY) > 90;
        marcarMao();
    }

    /** Vira a carta: 0° ↔ 180°, deixando a transição do CSS fazer o giro. */
    function virarMao() {
        if (!maoAberta() || mao.devolvendo) return;
        mao.seguindo = false;
        mao.virada = !mao.virada;
        mao.giroY = mao.virada ? LIMITE_GIRO_Y : 0;
        mao.giroX = 0;
        marcarMao();
    }

    function finalizarDevolucao() {
        const camada = $('galeriaMao');
        const indice = mao.indice;
        if (timerDevolver) { clearTimeout(timerDevolver); timerDevolver = 0; }
        mao.indice = -1;
        mao.giroX = 0;
        mao.giroY = 0;
        mao.virada = false;
        mao.seguindo = false;
        mao.devolvendo = false;
        nodos[indice]?.classList.remove('galeria-segurada');
        if (esteira) esteira.style.touchAction = '';
        if (camada) {
            camada.classList.remove('aberta', 'seguindo');
            camada.hidden = true;
            camada.setAttribute('aria-hidden', 'true');
        }
        const estado = $('galeriaMaoEstado');
        if (estado) estado.textContent = '';
        nodos[indice]?.focus();
    }

    /**
     * Solta a carta: ela assenta na pose mais próxima (frente ou verso à vista),
     * fica um instante assim e volta para o lugar na esteira. `imediato` pula a
     * pausa — é o que `Esc`, `R` e o clique no fundo fazem.
     */
    function devolverMao(imediato) {
        if (!maoAberta()) return;
        if (mao.devolvendo) {
            if (imediato) finalizarDevolucao();
            return;
        }
        mao.devolvendo = true;
        mao.seguindo = false;                 // a transição anima o assentamento
        mao.giroY = poseDeRepouso(mao.giroY); // 0° ou ±180°: frente ou verso
        mao.giroX = 0;
        marcarMao();
        if (imediato || reduzirMovimento()) { finalizarDevolucao(); return; }
        timerDevolver = setTimeout(finalizarDevolucao, PAUSA_POSE_MS);
    }

    // ── eventos ──────────────────────────────────────────────────────────────

    function aoRolar() {
        if (maoAberta() || quadroPendente || !janela?.requestAnimationFrame) return;
        quadroPendente = janela.requestAnimationFrame(() => {
            quadroPendente = 0;
            const indice = indiceMaisProximo();
            if (indice !== ativo) marcarAtivo(indice);
        });
    }

    /** Roda vertical vira rolagem horizontal: sem isso o mouse não passeia pela mesa. */
    function aoRoda(evento) {
        if (maoAberta() || !esteira || Math.abs(evento.deltaY) <= Math.abs(evento.deltaX)) return;
        evento.preventDefault();
        esteira.scrollLeft += evento.deltaY;
    }

    /**
     * Arraste com mouse (o touch já rola nativamente). O mesmo gesto decide entre
     * rolar a esteira e pegar a carta: para cima (ou parado por `LIMIAR_PEGAR_MS`)
     * pega; para os lados rola.
     */
    function instalarArraste() {
        let arrastando = false;
        let inicioX = 0;
        let inicioY = 0;
        let inicioScroll = 0;
        let movido = false;
        let candidato = -1;

        const cancelarPegar = () => {
            if (!timerPegar) return;
            clearTimeout(timerPegar);
            timerPegar = 0;
        };

        const soltarArraste = evento => {
            arrastando = false;
            esteira.classList.remove('galeria-arrastando');
            esteira.releasePointerCapture?.(evento?.pointerId);
        };

        const pegar = evento => {
            cancelarPegar();
            soltarArraste(evento);
            movido = true;   // o clique que vem depois não pode virar zoom/centralizar
            if (!pegarNaMao(candidato)) return;
            mao.ultimoX = evento.clientX;
            mao.ultimoY = evento.clientY;
            // No touch o navegador ainda pode querer rolar: corta o gesto padrão.
            esteira.style.touchAction = 'none';
        };

        esteira.addEventListener('pointerdown', evento => {
            if (evento.button !== 0 || maoAberta()) return;
            arrastando = true;
            movido = false;
            inicioX = evento.clientX;
            inicioY = evento.clientY;
            inicioScroll = esteira.scrollLeft;
            const nodo = evento.target?.closest?.('.galeria-carta');
            candidato = nodo ? parseInt(nodo.dataset.indice, 10) : -1;
            if (evento.pointerType !== 'touch') {
                esteira.classList.add('galeria-arrastando');
                esteira.setPointerCapture?.(evento.pointerId);
            }
            // Segurar parado também pega. No touch é best-effort: se o dedo andar
            // antes do limiar, o navegador rola e o timer é cancelado — o botão
            // "✋ Na mão" do painel é o caminho garantido ali.
            if (candidato >= 0) {
                timerPegar = setTimeout(() => { timerPegar = 0; pegar(evento); }, LIMIAR_PEGAR_MS);
            }
        });
        esteira.addEventListener('pointermove', evento => {
            if (!arrastando) return;
            const dx = evento.clientX - inicioX;
            const dy = evento.clientY - inicioY;
            // Arrastar para cima pega a carta; para os lados continua rolando.
            if (candidato >= 0 && dy < -LIMIAR_PEGAR_PX && Math.abs(dy) > Math.abs(dx)) {
                pegar(evento);
                return;
            }
            if (Math.abs(dx) > 4 || Math.abs(dy) > 4) cancelarPegar();
            if (Math.abs(dx) > 4) movido = true;
            if (!maoAberta()) esteira.scrollLeft = inicioScroll - dx;
        });
        const encerrar = evento => {
            cancelarPegar();
            if (maoAberta()) { devolverMao(); return; }
            if (!arrastando) return;
            soltarArraste(evento);
        };
        esteira.addEventListener('pointerup', encerrar);
        esteira.addEventListener('pointercancel', encerrar);
        // Arrastar não pode virar clique na carta: captura antes do handler dela.
        esteira.addEventListener('click', evento => {
            if (!movido) return;
            movido = false;
            evento.preventDefault();
            evento.stopPropagation();
        }, true);
    }

    function aoTeclado(evento) {
        if (evento.key === 'Escape') {
            if (maoAberta()) { evento.preventDefault(); devolverMao(true); return; }
            if (zoomAberto()) fecharZoom();
            return;
        }
        const nome = evento.target?.tagName;
        if (nome === 'INPUT' || nome === 'TEXTAREA' || nome === 'SELECT') return;

        // Com a carta na mão as setas giram a carta em vez de trocar de carta.
        if (maoAberta()) {
            switch (evento.key) {
                case 'ArrowLeft': evento.preventDefault(); girarPorTecla(-PASSO_TECLADO, 0); break;
                case 'ArrowRight': evento.preventDefault(); girarPorTecla(PASSO_TECLADO, 0); break;
                case 'ArrowUp': evento.preventDefault(); girarPorTecla(0, PASSO_TECLADO); break;
                case 'ArrowDown': evento.preventDefault(); girarPorTecla(0, -PASSO_TECLADO); break;
                case 'f': case 'F': evento.preventDefault(); virarMao(); break;
                case 'r': case 'R': evento.preventDefault(); devolverMao(true); break;
                default: break;
            }
            return;
        }
        if (zoomAberto()) return;
        switch (evento.key) {
            case 'ArrowLeft': evento.preventDefault(); anterior(); break;
            case 'ArrowRight': evento.preventDefault(); proxima(); break;
            case 'Home': evento.preventDefault(); primeira(); break;
            case 'End': evento.preventDefault(); ultima(); break;
            // Espaço pega a carta focada na mão; o preventDefault evita o clique/zoom.
            case ' ':
                if (evento.target?.classList?.contains('galeria-carta')) {
                    evento.preventDefault();
                    pegarNaMao(ativo);
                }
                break;
            case 'h': case 'H': evento.preventDefault(); pegarNaMao(ativo); break;
            default: break;
        }
    }

    function instalarEventos() {
        if (!esteira) return;
        esteira.addEventListener('scroll', aoRolar, { passive: true });
        esteira.addEventListener('wheel', aoRoda, { passive: false });
        instalarArraste();

        $('galeriaAnterior')?.addEventListener('click', anterior);
        $('galeriaProxima')?.addEventListener('click', proxima);
        $('galeriaPrimeira')?.addEventListener('click', primeira);
        $('galeriaUltima')?.addEventListener('click', ultima);
        $('galeriaIr')?.addEventListener('click', saltarParaDigitado);
        $('galeriaIrPara')?.addEventListener('keydown', evento => {
            if (evento.key !== 'Enter') return;
            evento.preventDefault();
            saltarParaDigitado();
        });

        const modal = $('cardModal');
        modal?.querySelector('.modal-close')?.addEventListener('click', fecharZoom);
        modal?.addEventListener('click', evento => {
            if (evento.target === modal) fecharZoom();
        });

        // Carta na mão: o giro vem do `document` (a esteira já soltou o capture),
        // e clicar no fundo devolve — mas nunca durante o assentamento, senão a
        // pausa que mostra a carta virada seria cortada pelo clique do soltar.
        doc?.addEventListener('pointermove', evento => {
            if (!maoAberta() || mao.devolvendo) return;
            const dx = evento.clientX - mao.ultimoX;
            const dy = evento.clientY - mao.ultimoY;
            mao.ultimoX = evento.clientX;
            mao.ultimoY = evento.clientY;
            if (dx || dy) girarMao(dx, dy);
        });
        $('galeriaMao')?.addEventListener('click', () => {
            if (!mao.devolvendo) devolverMao(true);
        });
        $('galeriaMaoVirar')?.addEventListener('click', evento => {
            evento.stopPropagation();
            virarMao();
        });
        $('galeriaMaoDevolver')?.addEventListener('click', evento => {
            evento.stopPropagation();
            devolverMao(true);
        });

        doc?.addEventListener('keydown', aoTeclado);
        janela?.addEventListener('resize', () => rolarPara(ativo, 'auto'));
    }

    // ── boot ─────────────────────────────────────────────────────────────────

    /**
     * Carrega o catálogo pelo caminho canônico (`deck_system.js`) e monta a mesa.
     * O catálogo é carregado uma única vez: `loadCardSystem` já é idempotente.
     */
    async function iniciar() {
        if (!janela) return;
        if (!janela.cardsDatabase && typeof janela.loadCardSystem === 'function') {
            try {
                await janela.loadCardSystem();
            } catch (erro) {
                console.warn('card-gallery: falha ao carregar o catálogo de cartas:', erro);
            }
        }
        renderizar();
        instalarEventos();
    }

    if (doc) {
        if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', iniciar);
        else iniciar();
    }

    return {
        iniciar,
        renderizar,
        irPara,
        anterior,
        proxima,
        primeira,
        ultima,
        saltarParaDigitado,
        marcarAtivo,
        indiceMaisProximo,
        offsetCentral,
        abrirZoom,
        fecharZoom,
        zoomAberto,
        pegarNaMao,
        girarMao,
        girarPorTecla,
        virarMao,
        devolverMao,
        maoAberta,
        poseDeRepouso,
        grausDeArrasto,
        poseDaMao: () => ({ ...mao }),
        indiceAtivo: () => ativo,
        cartas: () => cartas,
        cartaAtiva: () => cartas[ativo] || null
    };
});

