// Guia para Ativar e Verificar Habilidades das Cartas

console.log('🎮 GUIA DE HABILIDADES DAS CARTAS');
console.log('=====================================');

// 1. HABILIDADES QUE ATIVAM AUTOMATICAMENTE AO INVOCAR
console.log('\n📋 CARTAS COM HABILIDADES DE INVOCAÇÃO:');
console.log('• Natalino - Cura todos aliados ao ser invocado');
console.log('• Zol - Compra uma carta ao ser invocado');  
console.log('• Raylaser - Causa dano direto ao ser invocado');
console.log('• Tobinha e Boguinha - Fica fofo ao ser invocado');
console.log('• E mais 90+ outras cartas...');

// 2. COMO VERIFICAR SE HABILIDADES ESTÃO ATIVAS
function checkAbilitySystem() {
    console.log('\n🔍 VERIFICANDO SISTEMA DE HABILIDADES:');
    
    // Verificar se o sistema está carregado
    if (typeof window.cardAbilities !== 'undefined') {
        console.log('✅ Sistema de habilidades carregado!');
        console.log('🎯 Tipo:', typeof window.cardAbilities);
        console.log('📊 Métodos disponíveis:', Object.getOwnPropertyNames(Object.getPrototypeOf(window.cardAbilities)));
    } else {
        console.log('❌ Sistema de habilidades NÃO carregado!');
        return;
    }
    
    // Verificar efeitos ativos
    console.log('\n🌟 EFEITOS ATIVOS NO JOGO:');
    console.log('• Efeitos permanentes:', window.cardAbilities.permanentEffects.size);
    console.log('• Efeitos temporários:', window.cardAbilities.turnEffects.size);
    console.log('• Efeitos únicos usados:', window.cardAbilities.oneShotEffects.size);
}

// 3. COMO TESTAR HABILIDADES ESPECÍFICAS
function testSpecificAbilities() {
    console.log('\n🧪 TESTANDO HABILIDADES ESPECÍFICAS:');
    
    // Exemplo: Testar Natalino (cura aliados)
    console.log('\n💚 Teste: Natalino (Cura Aliados)');
    console.log('1. Invoque o Natalino no campo');
    console.log('2. Observe o console - deve aparecer: "👑 Ativando habilidade de invocação: Natalino"');
    console.log('3. Deve aparecer: "💚 Natalino: Curando aliados!"');
    
    // Exemplo: Testar Zol (compra carta)  
    console.log('\n🎴 Teste: Zol (Compra Carta)');
    console.log('1. Invoque o Zol no campo');
    console.log('2. Observe o console - deve aparecer: "👑 Ativando habilidade de invocação: Zol"');
    console.log('3. Deve aparecer: "📚 Zol: Comprando carta!"');
    
    // Exemplo: Testar carta de suporte
    console.log('\n⚔️ Teste: Espada Mágica (Equipamento)');
    console.log('1. Invoque uma criatura no campo');
    console.log('2. Invoque a Espada Mágica e arraste sobre a criatura');
    console.log('3. Deve aparecer: "🔧 Equipando: Espada Mágica em criatura"');
    console.log('4. A criatura deve ganhar +5 ATK/DEF');
}

// 4. DEPURAÇÃO DE PROBLEMAS
function debugAbilities() {
    console.log('\n🔧 DEPURAÇÃO DE PROBLEMAS:');
    
    // Verificar se cards_database está carregado
    if (typeof cardsDatabase !== 'undefined' && cardsDatabase) {
        console.log('✅ Database de cartas carregado!');
        console.log('📊 Total de cartas:', cardsDatabase.cards.length);
    } else {
        console.log('❌ Database de cartas NÃO carregado!');
    }
    
    // Verificar gameState
    if (typeof gameState !== 'undefined') {
        console.log('✅ GameState ativo!');
        console.log('👤 Jogador atual:', gameState.currentPlayer);
        console.log('🎯 Fase atual:', gameState.currentPhase);
    }
    
    // Ativar logs detalhados
    console.log('\n📝 Para ver logs detalhados das habilidades:');
    console.log('• Abra as ferramentas de desenvolvedor (F12)');
    console.log('• Vá para a aba Console'); 
    console.log('• Invoque cartas e observe as mensagens');
}

// 5. LISTA DE CARTAS COM HABILIDADES ESPECIAIS
function listSpecialCards() {
    console.log('\n🌟 CARTAS COM HABILIDADES MAIS INTERESSANTES:');
    
    const specialCards = [
        'Natalino - Cura todos aliados (+10 DEF)',
        'Zol - Compra uma carta extra',
        'Raylaser - 15 de dano direto no oponente',
        'Invocador das Trevas - Invoca Diabrete grátis',
        'Iron Dragon - Ataque duplo poderoso',
        'Superior - Ataque duplo + ressurreição',
        'Goblin Mestre - Ataque duplo',
        'Grifo Real - Voo alto (ignora defesas)',
        'Entola Guela - Escolhe alvo para destruir',
        'Shupáku - Paralisia permanente',
        'Dino Elétrico - Descarga em área'
    ];
    
    specialCards.forEach((card, index) => {
        console.log(`${index + 1}. ${card}`);
    });
    
    console.log('\n💡 DICA: Tente essas cartas para ver efeitos visuais!');
}

// 6. FUNÇÃO PRINCIPAL PARA EXECUTAR TUDO
function guideAbilities() {
    console.clear();
    console.log('🎮 === GUIA COMPLETO DE HABILIDADES ===\n');
    
    checkAbilitySystem();
    testSpecificAbilities();
    debugAbilities();
    listSpecialCards();
    
    console.log('\n🚀 RESUMO RÁPIDO:');
    console.log('1. Invoque qualquer carta no campo');
    console.log('2. Observe o console para feedback das habilidades');
    console.log('3. Habilidades são AUTOMÁTICAS - sem cliques extras!');
    console.log('4. Use F12 → Console para ver logs detalhados');
    
    console.log('\n💻 Execute "guideAbilities()" para ver este guia novamente');
}

// Exportar função principal
window.guideAbilities = guideAbilities;
window.checkAbilitySystem = checkAbilitySystem;
window.debugAbilities = debugAbilities;

// Executar automaticamente quando script carrega
console.log('📖 Guia de habilidades carregado!');
console.log('💻 Execute "guideAbilities()" no console para o guia completo');
console.log('🔍 Execute "checkAbilitySystem()" para verificar se está funcionando');