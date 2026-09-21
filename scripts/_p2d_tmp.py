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

# ============ A4. pvp.css: rede de seguranca p/ botoes espiar ============
patch("src/css/pvp.css",
    "/* Mao alheia no PvP: N versos + contagem, nunca identidade. */",
    "/* Botoes de espiar nunca aparecem no PvP (rede de seguranca). */\nbody[data-seat] .peek-hand-btn {\n    display: none !important;\n}\n\n/* Mao alheia no PvP: N versos + contagem, nunca identidade. */")

# ============ B. deck 40 -> 50 ============
# B1. server.py
patch("server.py", "INITIAL_HAND = 5\nDECK_SIZE = 40", "INITIAL_HAND = 5\nDECK_SIZE = 50")
# B2. pvp-game.js fallback
patch("src/js/pvp-game.js", "const DECK_SIZE = 40;", "const DECK_SIZE = 50;")
# B3. deck_system.js: hotseat acompanha (funcoes parametrizadas mantem default p/ testes)
patch("src/js/deck_system.js",
    "const matchDecks = window.deckBuilder.createMatchDecks(40);",
    "const matchDecks = window.deckBuilder.createMatchDecks(50);")
patch("src/js/deck_system.js",
    "    // Dar cartas iniciais (5 para cada jogador)",
    "    // Baralho PvP/hotseat: 50 cartas (m\u00e3o inicial segue 5 para cada jogador)")
# B4. deck_factory: default 50
patch("scripts/deck_factory.js",
    "  *   py -3 -c \"...\"  # ou:  node scripts/deck_factory.js --seed=123 --size=40",
    "  *   py -3 -c \"...\"  # ou:  node scripts/deck_factory.js --seed=123 --size=50")
patch("scripts/deck_factory.js",
    "    const size = parseInt(args.size || '40', 10);",
    "    const size = parseInt(args.size || '50', 10);")
patch("scripts/deck_factory.js",
    "        console.error('Uso: node scripts/deck_factory.js --seed=123 --size=40');",
    "        console.error('Uso: node scripts/deck_factory.js --seed=123 --size=50');")

print("step A4+B done")
