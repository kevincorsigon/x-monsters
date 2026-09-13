/**
 * Ponte de integração entre o motor determinístico (game-engine.js + card-rules.js)
 * e a UI legada de game.html. Todas as 110 cartas do catálogo são resolvidas
 * pelo motor via CardRules.install(); esta classe só encaminha os ganchos que
 * game.html ainda chama (invocação, equipar, combate, fim de turno, reset)
 * para o feedback visual já calculado pelo CardRules.
 */

class CardAbilitiesSystem {
    constructor() {
        this.engine = null;
        this.unregisterCardRules = null;
    }

    attachEngine(engine) {
        if (this.unregisterCardRules) this.unregisterCardRules();
        this.engine = engine;
        if (window.CardRules) {
            this.unregisterCardRules = window.CardRules.install(engine);
        }
    }

    reset() {
        // Nenhum estado local: todo o estado de efeitos vive no motor (game-engine.js).
    }

    onCombatDeclared(attackerId, targetId) {
        console.log('⚔️ Combate declarado:', { attackerId, targetId });
    }

    onCombatResolved(result) {
        console.log('⚔️ Combate resolvido:', result);
    }

    processTurnEffects() {
        // Ticks de efeito são resolvidos pelo motor via evento TURN_STARTED/TURN_ENDED.
    }

    onCardSummoned(cardId, cardData, playerId) {
        if (window.CardRules?.isMigrated(cardData.id)) {
            const feedback = window.CardRules.getFeedback(cardData.id);
            if (feedback) this.showAbilityFeedback(cardId, feedback);
        }
    }

    onCardEquipped(equipmentId, equipmentData, targetId) {
        const migratedRule = window.CardRules?.getEquipmentRule(equipmentData.id);
        if (migratedRule) {
            this.showAbilityFeedback(targetId, migratedRule.feedback);
        }
    }

    showAbilityFeedback(cardId, message) {
        console.log(`🎮 ${message}`);

        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(45deg, #c9a567, #f5c94a);
            color: #1a1e28;
            padding: 10px 15px;
            border-radius: 8px;
            font-weight: bold;
            z-index: 3000;
            animation: slideIn 0.3s ease-out;
            border: 2px solid #ffffff;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }, 3000);

        if (cardId) {
            const cardElement = document.getElementById(cardId);
            if (cardElement) {
                cardElement.style.filter = 'brightness(1.3) drop-shadow(0 0 10px #f5c94a)';
                setTimeout(() => cardElement.style.filter = '', 1000);
            }
        }
    }
}

window.cardAbilities = new CardAbilitiesSystem();

const abilityStyles = document.createElement('style');
abilityStyles.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }

    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(abilityStyles);

console.log('🎮 Ponte de habilidades (card-abilities.js) carregada — todas as cartas resolvidas pelo motor.');
