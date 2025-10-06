// Teste específico para Tobinha e Boguinha vs Ptera
// Execute no console do navegador quando o jogo estiver carregado

function testTobinhaProtection() {
    console.log('🧪 === TESTE: TOBINHA E BOGUINHA vs PTERA ===');
    
    // Dados das cartas para teste
    const tobinhaData = {
        id: 'card_014',
        name: 'Tobinha e Boguinha',
        type: 'criatura',
        cost: 2,
        attack: 10,
        defense: 12,
        hability: 'Fofura: não podem ser atacados por criaturas com custo superior a 3.'
    };
    
    const pteraData = {
        id: 'card_035',
        name: 'Ptera',
        type: 'criatura', 
        cost: 4,
        attack: 35,
        defense: 2,
        hability: 'Ataca diretamente jogadores, ignorando monstros.'
    };
    
    console.log('📋 Verificando dados das cartas:');
    console.log(`• Tobinha: Custo ${tobinhaData.cost} - Protegido contra custo > 3`);
    console.log(`• Ptera: Custo ${pteraData.cost} - Deveria ser bloqueado!`);
    
    // Verificar se sistema de habilidades está ativo
    if (!window.cardAbilities) {
        console.error('❌ Sistema de habilidades não carregado!');
        return;
    }
    
    console.log('✅ Sistema de habilidades ativo');
    
    // Simular cartas no campo
    const tobinhaId = 'test-tobinha-' + Date.now();
    const pteraId = 'test-ptera-' + Date.now();
    
    // Simular ativação da habilidade do Tobinha
    console.log('\n🐰 Simulando ativação da habilidade de Tobinha...');
    window.cardAbilities.tobinhaBoguinha_cuteness(tobinhaId);
    
    // Verificar se efeito foi aplicado
    const effects = window.cardAbilities.permanentEffects.get(tobinhaId);
    if (effects && effects.has('cuteness_protection')) {
        console.log('✅ Habilidade ativada com sucesso!');
        const protection = effects.get('cuteness_protection');
        console.log('🛡️ Proteção:', protection);
    } else {
        console.log('❌ Habilidade NÃO foi ativada!');
        return;
    }
    
    // Simular dados das cartas para teste de canAttackTarget
    window.testTobinhaData = { 
        id: tobinhaId, 
        data: tobinhaData, 
        player: 'p2' 
    };
    window.testPteraData = { 
        id: pteraId, 
        data: pteraData, 
        player: 'p1' 
    };
    
    // Sobrescrever temporariamente findCardData para usar dados de teste
    const originalFindCardData = window.findCardData;
    window.findCardData = function(cardId) {
        if (cardId === tobinhaId) return window.testTobinhaData;
        if (cardId === pteraId) return window.testPteraData;
        return originalFindCardData(cardId);
    };
    
    // Testar se Ptera pode atacar Tobinha
    console.log('\n⚔️ Testando ataque Ptera → Tobinha...');
    
    if (typeof canAttackTarget !== 'undefined') {
        const attackCheck = canAttackTarget(pteraId, tobinhaId);
        
        console.log('🎯 Resultado do teste:');
        console.log('• Pode atacar?', attackCheck.canAttack);
        console.log('• Motivo:', attackCheck.reason);
        
        if (!attackCheck.canAttack) {
            console.log('✅ SUCESSO! Proteção funcionou corretamente!');
            console.log('🛡️ Tobinha está protegido contra Ptera!');
        } else {
            console.log('❌ FALHOU! Proteção não funcionou!');
            console.log('🐛 Bug confirmado - sistema precisa de correção');
        }
    } else {
        console.log('❌ Função canAttackTarget não encontrada!');
    }
    
    // Restaurar função original
    window.findCardData = originalFindCardData;
    
    console.log('\n📝 RESUMO:');
    console.log('• Sistema implementado:', !!window.cardAbilities);
    console.log('• Habilidade ativa:', !!effects);
    console.log('• Função de verificação:', typeof canAttackTarget !== 'undefined');
    
    console.log('\n💡 Para testar no jogo:');
    console.log('1. Invoque Tobinha e Boguinha no campo');
    console.log('2. Invoque Ptera no campo oposto');
    console.log('3. Entre na fase de combate');
    console.log('4. Selecione Ptera para atacar');
    console.log('5. Tobinha deve aparecer acinzentado com 🛡️');
    console.log('6. Clique em Tobinha deve mostrar mensagem de proteção');
    
    // Limpar dados de teste
    delete window.testTobinhaData;
    delete window.testPteraData;
}

// Exportar para uso global
window.testTobinhaProtection = testTobinhaProtection;

console.log('🧪 Teste Tobinha vs Ptera carregado!');
console.log('💻 Execute "testTobinhaProtection()" para testar a correção.');