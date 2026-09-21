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

# ============ A1. pvp.html: esconder Espiar + remover onclick de deck/stats ============
# p2 peek button -> hidden (CSS/JS remove o resto; HTML limpo p/ alheia)
patch("pvp.html",
    '''<div id="hand-p2"></div>
            <button class="peek-hand-btn" onclick="peekHand('p2')"''',
    '''<div id="hand-p2"></div>
            <button class="peek-hand-btn" style="display:none" data-pvp-hidden="1" onclick="peekHand('p2')"''')
# p1 peek button -> hidden (em PvP a propria mao fica sempre visivel; espiar so faria sentido no hotseat)
patch("pvp.html",
    '''<div id="hand-p1"></div>
            <button class="peek-hand-btn" onclick="peekHand('p1')"''',
    '''<div id="hand-p1"></div>
            <button class="peek-hand-btn" style="display:none" data-pvp-hidden="1" onclick="peekHand('p1')"''')
# decks: sem onclick direto; o clique vira listener JS so no assento local
patch("pvp.html",
    '<div class="player2-deck" onclick="addCardToHand(\'p2\')">',
    '<div class="player2-deck" data-deck="p2">')
patch("pvp.html",
    '<div class="player1-deck" onclick="addCardToHand(\'p1\')">',
    '<div class="player1-deck" data-deck="p1">')
# stats/nomes: sem onclick; bind via JS so no assento local
patch("pvp.html",
    '''<div class="player-name" onclick="editName('p2')"''',
    '''<div class="player-name" data-editname="p2"''')
patch("pvp.html",
    '''<div class="player-name" onclick="editName('p1')"''',
    '''<div class="player-name" data-editname="p1"''')
patch("pvp.html",
    '''id="pv-p2" onclick="editStatValue('pv', 'p2')"''',
    '''id="pv-p2" data-editstat="pv-p2"''')
patch("pvp.html",
    '''id="pv-p1" onclick="editStatValue('pv', 'p1')"''',
    '''id="pv-p1" data-editstat="pv-p1"''')
# engrenagem: Decks vira funcao PvP (so proprio deck); Reset vira aviso
patch("pvp.html",
    '<button onclick="showDeckInfo(); toggleGearMenu()">',
    '<button onclick="pvpDeckInfo(); toggleGearMenu()">')
patch("pvp.html",
    '<button onclick="resetGame(); toggleGearMenu()">',
    '<button onclick="pvpResetAviso(); toggleGearMenu()">')

print("step A1 done")
