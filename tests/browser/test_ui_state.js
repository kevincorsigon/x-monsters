(function runUiStateTests() {
    let passed = 0;
    let failed = 0;

    function assert(label, condition) {
        if (condition) {
            console.log(`✅ ${label}`);
            passed++;
        } else {
            console.error(`❌ FALHOU: ${label}`);
            failed++;
        }
    }

    // 1. Energia de p1 começa em 7 (fase de energia aplicada no init)
    const energyEl = document.getElementById('energy-p1');
    assert('Energia p1 inicial = 7', energyEl && parseInt(energyEl.textContent) === 7);

    // 2. Energia de p2 começa em 6 (p2 ainda não jogou)
    const energyP2El = document.getElementById('energy-p2');
    assert('Energia p2 inicial = 6', energyP2El && parseInt(energyP2El.textContent) === 6);

    // 3. Sem botões +/- de PV para p1
    const pvP1Buttons = document.querySelectorAll('.player1-stats button.mini-button:not(.dice-button)');
    assert('Sem botões +/- de PV para p1', pvP1Buttons.length === 0);

    // 4. Sem botões +/- de PV para p2
    const pvP2Buttons = document.querySelectorAll('.player2-stats button.mini-button:not(.dice-button)');
    assert('Sem botões +/- de PV para p2', pvP2Buttons.length === 0);

    // 5. Botão ⚙️ existe
    const gearBtn = document.querySelector('.gear-btn');
    assert('Botão flutuante ⚙️ existe', gearBtn !== null);

    // 6. Dropdown de opções existe e está fechado
    const dropdown = document.getElementById('gearDropdown');
    assert('Dropdown existe', dropdown !== null);
    assert('Dropdown começa fechado', dropdown && !dropdown.classList.contains('open'));

    // 7. Reset e Decks não estão no .control-section
    const controlSection = document.querySelector('.control-section');
    const resetInControl = controlSection && Array.from(controlSection.querySelectorAll('button'))
        .some(b => b.textContent.includes('Reset'));
    const decksInControl = controlSection && Array.from(controlSection.querySelectorAll('button'))
        .some(b => b.textContent.includes('Decks'));
    assert('Reset não está no menu central', !resetInControl);
    assert('Decks não está no menu central', !decksInControl);

    // 8. Reset e Decks estão no dropdown do ⚙️
    const resetInDropdown = dropdown && Array.from(dropdown.querySelectorAll('button'))
        .some(b => b.textContent.includes('Reset'));
    const decksInDropdown = dropdown && Array.from(dropdown.querySelectorAll('button'))
        .some(b => b.textContent.includes('Decks'));
    assert('Reset está no dropdown ⚙️', resetInDropdown);
    assert('Decks está no dropdown ⚙️', decksInDropdown);

    // 9. Saque automático ao trocar turno
    const handCountBefore = (window.gameState?.players?.p2?.zones?.hand || []).length;
    const phaseBefore = window.gameState?.currentPhase;

    if (typeof endTurn === 'function') {
        // Colocar em fase de combate para endTurn não bloquear
        if (window.gameState) window.gameState.currentPhase = 'combat';
        endTurn();
        setTimeout(() => {
            const handCountAfter = (window.gameState?.players?.p2?.zones?.hand || []).length;
            assert(
                `Mão de p2 cresceu após endTurn (${handCountBefore} → ${handCountAfter})`,
                handCountAfter > handCountBefore
            );
            console.log(`\n🧪 Resultado UI State: ${passed + 1}/${passed + failed + 1} checks`);
        }, 1500);
    } else {
        assert('endTurn disponível como global', false);
        console.log(`\n🧪 Resultado UI State: ${passed}/${passed + failed} checks`);
    }
})();
