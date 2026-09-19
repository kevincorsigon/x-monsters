import pathlib
ROOT = pathlib.Path("c:/dev/x-monsters")

def patch(path, old, new, count=1):
    p = ROOT / path
    t = p.read_text(encoding="utf-8")
    if old not in t:
        print("SKIP:", path, repr(old[:80]))
        return False
    p.write_text(t.replace(old, new, count), encoding="utf-8")
    print("OK:", path)
    return True

# ============ A2b. inserir definicoes antes de neutralizarBootstrapLocal ============
patch("src/js/pvp-game.js",
    "    /**\n     * Em PvP o estado vem do MATCH_START: travamos o bootstrap local de",
    """    /**
     * Liga os controles clicaveis apenas no assento local: deck compra,
     * nome/PV editaveis e dado. O lado do oponente fica sem handler.
     */
    function vincularControlesLocais(assento) {
        const outro = outroAssento(assento);
        document.querySelectorAll('[data-deck]').forEach(el => {
            const dono = el.getAttribute('data-deck');
            el.onclick = null;
            if (dono === assento) {
                el.style.cursor = 'pointer';
                el.onclick = () => window.addCardToHand?.(dono);
            } else {
                el.style.cursor = 'default';
                el.onclick = () => window.showMessage?.('O deck do oponente e secreto nesta partida.', 'warning');
            }
        });
        document.querySelectorAll('[data-editname]').forEach(el => {
            const dono = el.getAttribute('data-editname');
            el.onclick = null;
            if (dono === assento) {
                el.style.cursor = 'pointer';
                el.onclick = () => window.editName?.(dono);
            } else {
                el.style.cursor = 'default';
                el.onclick = null;
            }
        });
        document.querySelectorAll('[data-editstat]').forEach(el => {
            const dono = (el.getAttribute('data-editstat') || '').split('-').pop();
            el.onclick = null;
            if (dono === assento) {
                el.style.cursor = 'pointer';
                el.onclick = () => {
                    const parts = (el.getAttribute('data-editstat') || '').split('-');
                    window.editStatValue?.(parts[0], parts[1]);
                };
            } else {
                el.style.cursor = 'default';
                el.onclick = null;
            }
        });
        const botaoDado = document.getElementById('dice-' + outro);
        if (botaoDado) botaoDado.disabled = true;
    }

    /** Gear "Decks" no PvP: mostra so o deck proprio (o alheio e segredo). */
    function pvpDeckInfo() {
        const assento = seatLocal || document.body?.dataset?.seat;
        window.mostrarInfoDeckProprio?.(assento);
    }

    /** Gear "Reset" no PvP: nova partida = sala nova (spec parte 5, DoD 3). */
    function pvpResetAviso() {
        window.showMessage?.('Use "Nova partida" ao final da partida para criar uma sala nova.', 'warning');
    }

    /**
     * Em PvP o estado vem do MATCH_START: travamos o bootstrap local de""")

# ============ A3. game.js: updateHandVisibility early-return + mostrarInfoDeckProprio ============
patch("src/js/game.js",
    "        function updateHandVisibility() {\n            const player1Hand = document.querySelector('.player1-hand');",
    "        function updateHandVisibility() {\n            // Em PvP a mao alheia e sempre N versos + contagem (renderHandsFromState):\n            // o esconderijo de hotseat por turno nao se aplica.\n            if (window.PvpSession) return;\n            const player1Hand = document.querySelector('.player1-hand');")

patch("src/js/game.js",
    "        // Função para mostrar informações dos decks\n        function showDeckInfo() {",
    """        // Gear "Decks" no PvP: estatistica so do proprio deck (spec parte 4, decisao 6).
        // O deck do oponente e segredo; exibir numeros dele seria vazamento.
        function mostrarInfoDeckProprio(assento) {
            const dono = assento || document.body?.dataset?.seat || 'p1';
            if (!gameState.decks || !window.deckBuilder) {
                showMessage('Sistema de deck não carregado!');
                return;
            }
            const stats = window.deckBuilder.getDeckStats(gameState.decks[dono]);
            const restantes = gameState.decks[dono].length;
            showMessage(
                `SEU DECK (${dono === 'p1' ? 'Jogador 1' : 'Jogador 2'}):\\n` +
                `• Total: ${stats.total} cartas\\n` +
                `• Criaturas: ${stats.criaturas}\\n` +
                `• Suportes: ${stats.suportes}\\n` +
                `• Evoluções: ${stats.evolucoes}\\n` +
                `• Custo médio: ${stats.custoMedio}\\n\\n` +
                `Cartas restantes: ${restantes}`
            );
        }
        window.mostrarInfoDeckProprio = mostrarInfoDeckProprio;

        // Função para mostrar informações dos decks
        function showDeckInfo() {""")

print("step A2b+A3 done")
