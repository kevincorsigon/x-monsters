// Sistema de ativação manual de habilidades
function createManualAbilityInterface() {
    console.log('🎮 Criando interface para habilidades manuais...');
    
    // Verificar se já existe
    if (document.getElementById('manual-abilities-panel')) {
        console.log('Interface já existe!');
        return;
    }
    
    // A BARRA DE COMANDO (`.controls`) é a âncora: o botão entra no slot do HUD,
    // colado no timer, e o painel pendura logo abaixo da barra. A barra é a
    // mesma nos dois assentos (o PvP troca quem mora nas faixas), então o
    // controle acompanha o jogador local sem o JS precisar saber o assento.
    const barra = document.querySelector('.controls')
        || document.querySelector('.game-container')
        || document.body;

    // Criar painel flutuante
    const panel = document.createElement('div');
    panel.id = 'manual-abilities-panel';
    panel.className = 'manual-abilities-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Habilidades manuais');
    panel.innerHTML = `
        <div class="manual-abilities-head">
            <h3 class="manual-abilities-title">🎯 Habilidades Manuais</h3>
            <button class="manual-abilities-close" onclick="toggleAbilityPanel()" title="Fechar">✕</button>
        </div>
        <div id="abilities-list" class="manual-abilities-list">
            <p class="manual-abilities-empty">Nenhuma carta com habilidade manual em campo</p>
        </div>
    `;

    barra.appendChild(panel);

    // Adicionar botão para abrir painel: pílula redonda do HUD, ao lado do timer
    const toggleButton = document.createElement('button');
    toggleButton.id = 'ability-panel-toggle';
    toggleButton.type = 'button';
    toggleButton.className = 'hud-toggle';
    toggleButton.innerHTML = '🎯';
    toggleButton.title = 'Ativar Habilidades Manuais';
    toggleButton.onclick = () => toggleAbilityPanel();

    // O slot vem do markup (`#abilities-slot`, dentro do HUD); em página sem o
    // slot, o botão cai no fim da barra.
    const slot = document.getElementById('abilities-slot');
    (slot || barra).appendChild(toggleButton);
    
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
        button.style.display = 'inline-flex';
    }
}

function updateManualAbilitiesList() {
    const listContainer = document.getElementById('abilities-list');
    if (!listContainer) return;
    
    const currentPlayer = gameState.currentPlayer;
    const playerCards = gameState.cards[currentPlayer].field;
    const playerEquipment = gameState.cards[currentPlayer].equipment;
    const playerHand = gameState.cards[currentPlayer].hand;

    let hasManualAbilities = false;
    let htmlContent = '';

    function renderMigratedAbilityCard(card, cardData, migratedRule) {
        const targetIds = window.CardRules.getActivatedTargets(window.gameState, card.id);
        const canUse = window.gameEngine.canUseAbility(
            card.id,
            migratedRule.abilityId,
            migratedRule.limit
        );
        const targetOptions = targetIds.map(targetId => {
            const target = window.gameState.cardInstances[targetId];
            return `<option value="${targetId}">${target.data.name}</option>`;
        }).join('');
        const needsTargets = migratedRule.maxTargets > 0;
        const canActivate = canUse && (!needsTargets || targetIds.length >= migratedRule.minTargets);
        const targetControl = needsTargets ? `
            <select id="ability-target-${card.id}" ${migratedRule.maxTargets > 1 ? 'multiple' : ''} ${targetIds.length === 0 ? 'disabled' : ''} style="width: 100%; margin: 5px 0;">
                ${targetOptions || '<option>Nenhum alvo válido</option>'}
            </select>
        ` : '';

        return `
            <div style="border: 1px solid #444; border-radius: 5px; padding: 8px; margin: 5px 0; ${canActivate ? 'background: rgba(0,100,0,0.2)' : 'background: rgba(100,0,0,0.2)'}">
                <div style="font-weight: bold; color: ${canActivate ? 'lightgreen' : 'lightcoral'}">${cardData.name}</div>
                <div style="font-size: 10px; color: #ccc; margin: 2px 0;">${migratedRule.feedback}</div>
                ${targetControl}
                <button onclick="activateMigratedAbility('${card.id}')"
                        ${!canActivate ? 'disabled' : ''}
                        style="background: ${canActivate ? 'var(--primary-color)' : '#666'}; color: white; border: none; border-radius: 3px; padding: 4px 8px; font-size: 10px; cursor: ${canActivate ? 'pointer' : 'not-allowed'}; width: 100%;">
                    ${canUse ? '⚡ Ativar' : '❌ Já usada'}
                </button>
            </div>
        `;
    }

    // Cartas com sourceZone: 'hand' são efeitos de uso único ativados direto
    // da mão (ex: Adubaram) — não pertencem aos loops de campo/equipamento.
    playerHand.forEach(card => {
        if (!card?.data) return;
        const cardData = window.cardsDatabase?.cards?.find(c => c.id === card.data.id);
        const migratedRule = window.CardRules?.getActivatedRule(card.data.id);
        if (migratedRule && cardData && migratedRule.sourceZone === 'hand') {
            hasManualAbilities = true;
            htmlContent += renderMigratedAbilityCard(card, cardData, migratedRule);
        }
    });

    playerEquipment.forEach(card => {
        if (!card?.data) return;
        const cardData = window.cardsDatabase?.cards?.find(c => c.id === card.data.id);
        const migratedRule = window.CardRules?.getActivatedRule(card.data.id);
        if (migratedRule && cardData && migratedRule.sourceZone !== 'hand') {
            hasManualAbilities = true;
            htmlContent += renderMigratedAbilityCard(card, cardData, migratedRule);
        }
    });

    playerCards.forEach(card => {
        if (!card?.data) return;
        const cardData = window.cardsDatabase?.cards?.find(c => c.id === card.data.id);
        const migratedRule = window.CardRules?.getActivatedRule(card.data.id);

        if (migratedRule && migratedRule.sourceZone !== 'hand') {
            hasManualAbilities = true;
            htmlContent += renderMigratedAbilityCard(card, cardData, migratedRule);
        }
    });
    
    if (!hasManualAbilities) {
        htmlContent = '<p class="manual-abilities-empty">Nenhuma carta com habilidade manual em campo</p>';
    }
    
    listContainer.innerHTML = htmlContent;
}

function activateMigratedAbility(cardId) {
    const targetSelect = document.getElementById(`ability-target-${cardId}`);
    const rule = window.CardRules?.getActivatedRule(
        window.gameState.cardInstances[cardId]?.definitionId
    );
    const legalTargetIds = window.CardRules?.getActivatedTargets(window.gameState, cardId) || [];
    const selectedTargetIds = targetSelect
        ? [...targetSelect.selectedOptions].map(option => option.value)
        : undefined;

    if (!rule || (rule.maxTargets > 0 && selectedTargetIds.length < rule.minTargets)) {
        showMessage('Nenhum alvo válido para esta habilidade.', 'warning');
        return;
    }

    if (window.PvpSession?.PvpSession) {
        // Em PvP a habilidade viaja como comando ABILITY: o autor também só
        // aplica o efeito quando o servidor replicar (evita divergência).
        // Habilidades de mão (sourceZone: 'hand', ex.: Adubaram) precisam
        // viajar com o reveal: no cliente do oponente a mão alheia são
        // placeholders e, sem identidade, o ABILITY seria ignorado lá
        // ('ABILITY sem regra') — o efeito saía só na tela do autor.
        const reveals = rule.sourceZone === 'hand'
            ? [window.PvpGame?.buildReveal?.(cardId, 'hand')].filter(Boolean)
            : [];
        window.PvpSession.PvpSession.sendCommand('ABILITY', {
            cardId,
            abilityId: rule.abilityId,
            targetIds: selectedTargetIds || []
        }, { reveals });
        return;
    }

    applyMigratedAbilityLocally(rule, cardId, selectedTargetIds, legalTargetIds);
}

/**
 * Aplica a habilidade manual no estado local.
 * Separado do handler de UI para que a sessão PvP possa reaplicar o comando
 * remoto sem reenviá-lo ao servidor.
 */
function applyMigratedAbilityLocally(rule, cardId, selectedTargetIds, legalTargetIds) {
    const result = window.CardRules.activateAbility(
        window.gameEngine,
        cardId,
        selectedTargetIds
    );
    if (result.status !== 'resolved') {
        showMessage(result.reason, 'warning');
        updateManualAbilitiesList();
        return;
    }

    const targets = legalTargetIds || window.CardRules?.getActivatedTargets(window.gameState, cardId) || [];
    const affectedTargetIds = rule.allEnemies ? targets : selectedTargetIds || [];
    affectedTargetIds.forEach(targetId => {
        const target = window.gameState.cardInstances[targetId];
        if (target?.zone !== 'field') {
            document.getElementById(targetId)?.remove();
        }
    });
    window.renderFieldsFromState?.();
    window.renderHandsFromState?.();
    ['p1', 'p2'].forEach(playerId => window.updateDiscardCount?.(playerId));
    window.cardAbilities?.showAbilityFeedback(affectedTargetIds[0] || cardId, rule.feedback);
    updateManualAbilitiesList();
}

window.applyMigratedAbilityLocally = applyMigratedAbilityLocally;

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
    console.log('🎯 Clique no botão do HUD (junto do turno/fase) para acessar');
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