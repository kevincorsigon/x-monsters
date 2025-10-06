// Sistema de ativação manual de habilidades
function createManualAbilityInterface() {
    console.log('🎮 Criando interface para habilidades manuais...');
    
    // Verificar se já existe
    if (document.getElementById('manual-abilities-panel')) {
        console.log('Interface já existe!');
        return;
    }
    
    // Criar painel flutuante
    const panel = document.createElement('div');
    panel.id = 'manual-abilities-panel';
    panel.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 300px;
        max-height: 400px;
        background: rgba(0, 0, 0, 0.9);
        border: 2px solid var(--primary-color);
        border-radius: 10px;
        padding: 15px;
        color: white;
        font-family: Arial, sans-serif;
        font-size: 12px;
        z-index: 1000;
        overflow-y: auto;
        display: none;
    `;
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h3 style="margin: 0; color: var(--primary-color);">🎯 Habilidades Manuais</h3>
            <button onclick="toggleAbilityPanel()" style="background: var(--pv-zero-color); color: white; border: none; border-radius: 3px; padding: 2px 6px; cursor: pointer;">✕</button>
        </div>
        <div id="abilities-list" style="max-height: 300px; overflow-y: auto;">
            <p style="text-align: center; color: #888;">Nenhuma carta com habilidade manual em campo</p>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Adicionar botão para abrir painel
    const toggleButton = document.createElement('button');
    toggleButton.id = 'ability-panel-toggle';
    toggleButton.innerHTML = '🎯';
    toggleButton.title = 'Ativar Habilidades Manuais';
    toggleButton.onclick = () => toggleAbilityPanel();
    toggleButton.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: var(--primary-color);
        color: white;
        border: 2px solid white;
        font-size: 20px;
        cursor: pointer;
        z-index: 999;
        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
    `;
    
    document.body.appendChild(toggleButton);
    
    console.log('✅ Interface criada com sucesso!');
}

function toggleAbilityPanel() {
    const panel = document.getElementById('manual-abilities-panel');
    const button = document.getElementById('ability-panel-toggle');
    
    if (panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'block';
        button.style.display = 'none';
        updateManualAbilitiesList();
    } else {
        panel.style.display = 'none';
        button.style.display = 'block';
    }
}

function updateManualAbilitiesList() {
    const listContainer = document.getElementById('abilities-list');
    if (!listContainer) return;
    
    const currentPlayer = gameState.currentPlayer;
    const playerCards = gameState.cards[currentPlayer].field;
    
    // Cartas com habilidades manuais conhecidas
    const manualAbilities = {
        'card_055': { // Mago Arcano
            name: 'Mago Arcano',
            ability: 'Rajada de Mana',
            description: 'Causa 5 de dano direto (1x por turno)',
            action: 'magoArcano_manaBlast',
            cooldown: 'mana_blast'
        },
        'card_009': { // Rei das Feras
            name: 'Rei das Feras',
            ability: 'Comando das Feras',
            description: 'Causa dano baseado no ataque',
            action: 'reiFeras_beastCommand',
            cooldown: 'beast_command'
        },
        'card_034': { // Drako
            name: 'Drako',
            ability: 'Sopro Triplo',
            description: 'Causa 15 de dano direto (1x por turno)',
            action: 'drako_tripleBreath',
            cooldown: 'triple_breath'
        }
        // Adicionar mais conforme necessário
    };
    
    let hasManualAbilities = false;
    let htmlContent = '';
    
    playerCards.forEach(card => {
        const cardData = window.cardsDatabase?.find(c => c.id === card.data.id);
        if (cardData && manualAbilities[cardData.id]) {
            hasManualAbilities = true;
            const ability = manualAbilities[cardData.id];
            
            // Verificar se já foi usada neste turno
            const canUse = !window.cardAbilities?.hasUsedAbilityThisTurn(card.id, ability.cooldown);
            
            htmlContent += `
                <div style="border: 1px solid #444; border-radius: 5px; padding: 8px; margin: 5px 0; ${canUse ? 'background: rgba(0,100,0,0.2)' : 'background: rgba(100,0,0,0.2)'}">
                    <div style="font-weight: bold; color: ${canUse ? 'lightgreen' : 'lightcoral'}">${ability.name}</div>
                    <div style="font-size: 10px; color: #ccc; margin: 2px 0;">${ability.ability}: ${ability.description}</div>
                    <button onclick="activateManualAbility('${card.id}', '${ability.action}', '${currentPlayer}')" 
                            ${!canUse ? 'disabled' : ''} 
                            style="background: ${canUse ? 'var(--primary-color)' : '#666'}; color: white; border: none; border-radius: 3px; padding: 4px 8px; font-size: 10px; cursor: ${canUse ? 'pointer' : 'not-allowed'}; width: 100%; margin-top: 5px;">
                        ${canUse ? '⚡ Ativar' : '❌ Já usada'}
                    </button>
                </div>
            `;
        }
    });
    
    if (!hasManualAbilities) {
        htmlContent = '<p style="text-align: center; color: #888;">Nenhuma carta com habilidade manual em campo</p>';
    }
    
    listContainer.innerHTML = htmlContent;
}

function activateManualAbility(cardId, abilityFunction, playerId) {
    console.log(`🎯 Ativando habilidade: ${abilityFunction} para carta ${cardId}`);
    
    if (!window.cardAbilities) {
        alert('Sistema de habilidades não carregado!');
        return;
    }
    
    try {
        // Chamar a função de habilidade
        if (typeof window.cardAbilities[abilityFunction] === 'function') {
            window.cardAbilities[abilityFunction](cardId, playerId);
            
            // Atualizar interface
            updateManualAbilitiesList();
            
            // Feedback visual
            showMessage(`Habilidade ativada com sucesso!`, 'success');
            
            console.log('✅ Habilidade ativada com sucesso!');
        } else {
            console.log('❌ Função de habilidade não encontrada:', abilityFunction);
            alert('Erro: Habilidade não implementada!');
        }
    } catch (error) {
        console.error('❌ Erro ao ativar habilidade:', error);
        alert('Erro ao ativar habilidade: ' + error.message);
    }
}

// Integrar com mudanças de turno
function setupAbilitySystemIntegration() {
    // Escutar mudanças no gameState
    const originalEndTurn = window.endTurn;
    window.endTurn = function() {
        originalEndTurn.call(this);
        // Atualizar lista quando turno muda
        setTimeout(() => {
            updateManualAbilitiesList();
        }, 100);
    };
    
    // Escutar mudanças de fase
    const originalSetPhase = window.setPhase;
    window.setPhase = function(phase) {
        originalSetPhase.call(this, phase);
        // Atualizar lista quando fase muda
        setTimeout(() => {
            updateManualAbilitiesList();
        }, 100);
    };
    
    console.log('🔗 Integração com sistema de turnos configurada');
}

// Função para inicializar tudo
function initManualAbilitySystem() {
    console.log('🚀 Inicializando sistema de habilidades manuais...');
    
    createManualAbilityInterface();
    setupAbilitySystemIntegration();
    
    console.log('✅ Sistema de habilidades manuais ativo!');
    console.log('🎯 Clique no botão no canto superior direito para acessar');
}

// Auto-inicializar quando carregado
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        initManualAbilitySystem();
    }, 1000);
});

console.log('🎮 Sistema de habilidades manuais carregado!');
console.log('📋 Comandos disponíveis:');
console.log('   • initManualAbilitySystem() - Inicializar interface');
console.log('   • toggleAbilityPanel() - Mostrar/ocultar painel');
console.log('   • updateManualAbilitiesList() - Atualizar lista');