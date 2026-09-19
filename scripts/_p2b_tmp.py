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

# ============ A2. pvp-game.js: bind local + pvpDeckInfo + pvpResetAviso + aviso de compra alheia ============
patch("src/js/pvp-game.js",
    "        marcarAssento();\n        estadoDaPartida = 'em partida';",
    "        marcarAssento();\n        vincularControlesLocais(assento);\n        estadoDaPartida = 'em partida';")

patch("src/js/pvp-game.js",
    "    // -- rede, reconexao e fim de partida",
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
                    const [stat, player] = (el.getAttribute('data-editstat') || '').split('-');
                    window.editStatValue?.(stat, player);
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
        if (window.mostrarInfoDeckProprio) {
            window.mostrarInfoDeckProprio(assento);
            return;
        }
        window.showDeckInfo?.();
    }

    /** Gear "Reset" no PvP: nova partida = sala nova (spec parte 5, DoD 3). */
    function pvpResetAviso() {
        window.showMessage?.('Use "Nova partida" ao final da partida para criar uma sala nova.', 'warning');
    }

    // -- rede, reconexao e fim de partida""")

patch("src/js/pvp-game.js",
    "    api.buildReveal = buildReveal;",
    "    window.pvpDeckInfo = pvpDeckInfo;\n    window.pvpResetAviso = pvpResetAviso;\n    api.buildReveal = buildReveal;")

print("step A2 done")
