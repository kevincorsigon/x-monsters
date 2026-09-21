// Auditoria completa de todas as habilidades das cartas X-Monsters
function auditAllAbilities() {
    console.log('🔍 ===== AUDITORIA COMPLETA DE HABILIDADES =====');
    
    if (!window.cardsDatabase) {
        console.log('❌ Base de dados de cartas não carregada!');
        return;
    }
    
    // Categorias de habilidades
    const abilityCategories = {
        // HABILIDADES DE DANO DIRETO
        directDamage: {
            name: '💥 Dano Direto ao Jogador',
            cards: [],
            keywords: ['dano direto', 'pontos de vida', 'pv do oponente', 'vida do oponente']
        },
        
        // HABILIDADES DE BUFF/DEBUFF
        statModification: {
            name: '📊 Modificação de Atributos',
            cards: [],
            keywords: ['+', 'aumenta', 'reduz', 'ganha', 'perde', 'atk', 'def', 'ataque', 'defesa']
        },
        
        // HABILIDADES DE DRAW/DISCARD
        cardManipulation: {
            name: '🃏 Manipulação de Cartas',
            cards: [],
            keywords: ['compra', 'saca', 'descarta', 'carta', 'mão', 'deck']
        },
        
        // HABILIDADES DE DESTRUIÇÃO
        destruction: {
            name: '💀 Destruição de Cartas',
            cards: [],
            keywords: ['destrói', 'elimina', 'remove', 'mata']
        },
        
        // HABILIDADES DE INVOCAÇÃO
        summoning: {
            name: '✨ Invocação/Criação',
            cards: [],
            keywords: ['invoca', 'cria', 'gera', 'coloca no campo']
        },
        
        // HABILIDADES DE ENERGIA
        energyManipulation: {
            name: '⚡ Manipulação de Energia',
            cards: [],
            keywords: ['energia', 'mana', 'custo']
        },
        
        // HABILIDADES DE COMBATE ESPECIAL
        combatSpecial: {
            name: '⚔️ Modificações de Combate',
            cards: [],
            keywords: ['ignora', 'dobra', 'ataca duas vezes', 'primeiro ataque', 'não pode ser bloqueado']
        },
        
        // HABILIDADES DE PROTEÇÃO (já implementadas)
        protection: {
            name: '🛡️ Proteções e Imunidades',
            cards: [],
            keywords: ['imune', 'proteção', 'não pode ser atacado', 'bloqueia', 'evasão']
        },
        
        // HABILIDADES CONDICIONAIS
        conditional: {
            name: '🎯 Habilidades Condicionais',
            cards: [],
            keywords: ['se', 'caso', 'quando', 'enquanto', 'sozinho', 'único']
        },
        
        // HABILIDADES DE EQUIPAMENTO
        equipment: {
            name: '🔧 Equipamentos e Suporte',
            cards: [],
            keywords: ['equipa', 'equipado', 'suporte']
        }
    };
    
    // Analisar todas as cartas
    window.cardsDatabase.forEach(card => {
        if (card.hability && card.hability.trim()) {
            const habilityText = card.hability.toLowerCase();
            
            // Classificar habilidade em categorias
            Object.keys(abilityCategories).forEach(categoryKey => {
                const category = abilityCategories[categoryKey];
                const matches = category.keywords.some(keyword => 
                    habilityText.includes(keyword.toLowerCase())
                );
                
                if (matches) {
                    category.cards.push({
                        id: card.id,
                        name: card.name,
                        cost: card.cost,
                        type: card.type,
                        hability: card.hability
                    });
                }
            });
        }
    });
    
    // Relatório por categoria
    console.log('📋 RELATÓRIO POR CATEGORIA:');
    console.log('');
    
    Object.keys(abilityCategories).forEach(categoryKey => {
        const category = abilityCategories[categoryKey];
        console.log(`${category.name} (${category.cards.length} cartas)`);
        
        if (category.cards.length > 0) {
            category.cards.forEach(card => {
                console.log(`   📄 ${card.name} (${card.id}) - Custo: ${card.cost}`);
                console.log(`      💡 "${card.hability}"`);
            });
        } else {
            console.log('   (Nenhuma carta encontrada)');
        }
        console.log('');
    });
    
    return abilityCategories;
}

// Função para verificar implementação de habilidades específicas
function checkAbilityImplementation(cardId) {
    console.log(`🔍 Verificando implementação da carta: ${cardId}`);
    
    if (!window.cardAbilities) {
        console.log('❌ Sistema de habilidades não carregado!');
        return;
    }
    
    // Verificar se há implementação no sistema
    const hasImplementation = window.cardAbilities.onCardSummoned.toString().includes(cardId) ||
                             window.cardAbilities.onBeforeAttack.toString().includes(cardId) ||
                             window.cardAbilities.onAfterAttack.toString().includes(cardId);
    
    console.log(`Implementação encontrada: ${hasImplementation ? '✅' : '❌'}`);
    
    // Verificar efeitos permanentes se aplicável
    if (window.cardAbilities.permanentEffects) {
        const hasEffect = window.cardAbilities.permanentEffects.has(cardId);
        console.log(`Efeito permanente ativo: ${hasEffect ? '✅' : '❌'}`);
    }
    
    return hasImplementation;
}

// Função para testar habilidade específica
function testSpecificAbility(cardName) {
    console.log(`🧪 Testando habilidade: ${cardName}`);
    
    if (!window.cardsDatabase) {
        console.log('❌ Base de dados não carregada!');
        return;
    }
    
    const card = window.cardsDatabase.find(c => 
        c.name.toLowerCase().includes(cardName.toLowerCase())
    );
    
    if (!card) {
        console.log('❌ Carta não encontrada!');
        return;
    }
    
    console.log(`📄 Carta encontrada: ${card.name} (${card.id})`);
    console.log(`💡 Habilidade: "${card.hability}"`);
    
    // Verificar implementação
    checkAbilityImplementation(card.id);
    
    return card;
}

// Função para listar habilidades problemáticas conhecidas
function listKnownIssues() {
    console.log('⚠️ ===== PROBLEMAS CONHECIDOS =====');
    
    const knownIssues = [
        {
            card: 'Mago Arcano (card_055)',
            issue: 'Implementação duplicada - magoArcano_manaBlast vs magoArcano_directMana',
            status: '🔧 Precisa correção',
            solution: 'Usar apenas magoArcano_manaBlast que está funcionalmente correta'
        },
        {
            card: 'Habilidades de dano direto',
            issue: 'Podem não estar sendo ativadas manualmente durante o jogo',
            status: '🔍 Investigar',
            solution: 'Implementar interface para ativar habilidades manuais'
        },
        {
            card: 'Habilidades condicionais',
            issue: 'Podem não estar verificando condições corretamente',
            status: '🔍 Investigar',
            solution: 'Verificar lógica de condições em tempo real'
        }
    ];
    
    knownIssues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.status} ${issue.card}`);
        console.log(`   Problema: ${issue.issue}`);
        console.log(`   Solução: ${issue.solution}`);
        console.log('');
    });
}

// Função principal de auditoria
function fullAbilityAudit() {
    console.log('🎯 ===== AUDITORIA COMPLETA INICIADA =====');
    console.log('');
    
    // 1. Mapear todas as habilidades
    const categories = auditAllAbilities();
    
    // 2. Listar problemas conhecidos
    listKnownIssues();
    
    // 3. Verificar implementações críticas
    console.log('🔧 ===== VERIFICAÇÃO DE IMPLEMENTAÇÕES =====');
    
    const criticalCards = [
        'card_055', // Mago Arcano
        'card_048', // Turtol
        'card_065', // Iron Dragon
        'card_073', // Golem de Pedra
        'card_019', // Tobinha e Boguinha
    ];
    
    criticalCards.forEach(cardId => {
        checkAbilityImplementation(cardId);
    });
    
    console.log('');
    console.log('✅ Auditoria completa finalizada!');
    console.log('📋 Execute testSpecificAbility("nome") para testar cartas específicas');
    
    return categories;
}

console.log('🔍 Sistema de auditoria de habilidades carregado!');
console.log('📋 Comandos disponíveis:');
console.log('   • fullAbilityAudit() - Auditoria completa');
console.log('   • auditAllAbilities() - Mapear habilidades por categoria'); 
console.log('   • testSpecificAbility("Mago Arcano") - Testar carta específica');
console.log('   • checkAbilityImplementation("card_055") - Verificar implementação');
console.log('   • listKnownIssues() - Listar problemas conhecidos');