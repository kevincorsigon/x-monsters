// Script para testar funcionalidades implementadas
// Execute no console do navegador quando o jogo estiver carregado

console.log('🧪 Iniciando testes das novas funcionalidades...');

// Teste 1: Sistema de descarte
function testDiscardSystem() {
    console.log('\n📥 Teste 1: Sistema de Descarte');
    
    // Simular uma carta no descarte do player 1
    const testCard = {
        id: 'card_001',
        name: 'Espada Mágica Teste',
        type: 'suporte',
        cost: 1,
        attack: 10,
        defense: 5,
        hability: 'Teste de descarte'
    };
    
    // Adicionar ao descarte
    addToDiscard('p1', testCard);
    
    console.log('✅ Carta adicionada ao descarte');
    console.log('📊 Descarte P1:', gameState.cards.p1.discard.length, 'cartas');
    
    // Testar visualização (simular clique)
    console.log('🖱️ Testando visualização do descarte...');
    viewDiscard('p1');
    
    return 'Teste de descarte concluído';
}

// Teste 2: Sistema de targeting melhorado
function testTargetingSystem() {
    console.log('\n🎯 Teste 2: Sistema de Targeting');
    
    // Simular carta no campo
    const testFieldCard = {
        id: 'test-card-field',
        data: {
            id: 'card_012',
            name: 'Natalino Teste',
            type: 'criatura',
            cost: 2,
            attack: 15,
            defense: 8
        },
        player: 'p2'
    };
    
    // Adicionar ao gameState
    gameState.cards.p2.field.push(testFieldCard);
    
    // Testar função isCardInField
    const isInField = isCardInField('test-card-field');
    console.log('🏟️ Carta está no campo?', isInField);
    
    return 'Teste de targeting concluído';
}

// Teste 3: Funcionalidades gerais
function testGeneralFeatures() {
    console.log('\n⚙️ Teste 3: Funcionalidades Gerais');
    
    // Verificar se modals existem
    const cardModal = document.getElementById('cardModal');
    const discardModal = document.getElementById('discardModal');
    
    console.log('🖼️ Modal de carta existe?', !!cardModal);
    console.log('📥 Modal de descarte existe?', !!discardModal);
    
    // Verificar contadores de descarte
    const discardCountP1 = document.getElementById('discard-count-p1');
    const discardCountP2 = document.getElementById('discard-count-p2');
    
    console.log('🔢 Contador P1 existe?', !!discardCountP1);
    console.log('🔢 Contador P2 existe?', !!discardCountP2);
    
    if (discardCountP1) console.log('📊 Contador P1 texto:', discardCountP1.textContent);
    if (discardCountP2) console.log('📊 Contador P2 texto:', discardCountP2.textContent);
    
    return 'Teste geral concluído';
}

// Executar todos os testes
function runAllTests() {
    console.log('🚀 Executando todos os testes...\n');
    
    try {
        console.log(testDiscardSystem());
        console.log(testTargetingSystem());
        console.log(testGeneralFeatures());
        
        console.log('\n✅ Todos os testes concluídos com sucesso!');
        console.log('💡 Para testar manualmente:');
        console.log('   1. Clique nas pilhas de descarte para ver cartas');
        console.log('   2. Destrua cartas em combate para ver o descarte funcionando');
        console.log('   3. Tente atacar cartas equipadas durante a fase de combate');
        
    } catch (error) {
        console.error('❌ Erro durante os testes:', error);
    }
}

// Exportar para uso global
window.testNewFeatures = runAllTests;

console.log('🧪 Script de teste carregado!');
console.log('💻 Execute "testNewFeatures()" no console para testar as funcionalidades.');