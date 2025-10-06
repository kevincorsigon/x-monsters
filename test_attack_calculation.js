// Teste para verificar cálculos de ataque e destruição de cartas
function testAttackCalculation() {
    console.log('🧪 ===== TESTE DE CÁLCULOS DE ATAQUE =====');
    
    // Simular duas cartas para teste
    const testCards = {
        attacker: { 
            id: 'test-attacker', 
            data: { name: 'Atacante', cost: 3, attack: 15, defense: 10 }, 
            player: 'p1' 
        },
        defender: { 
            id: 'test-defender', 
            data: { name: 'Defensor', cost: 2, attack: 8, defense: 12 }, 
            player: 'p2' 
        }
    };
    
    // Função temporária para simular findCardData
    const originalFindCardData = window.findCardData;
    window.findCardData = function(cardId) {
        return testCards[cardId.replace('test-', '')];
    };
    
    console.log('📊 Estado inicial:');
    console.log(`   Atacante: ${testCards.attacker.data.attack}/${testCards.attacker.data.defense}`);
    console.log(`   Defensor: ${testCards.defender.data.attack}/${testCards.defender.data.defense}`);
    
    // Simular o ataque
    console.log('⚔️ Executando ataque...');
    
    const attackPower = testCards.attacker.data.attack; // 15
    const defenderDefenseOriginal = testCards.defender.data.defense; // 12
    const defenderAttack = testCards.defender.data.attack; // 8
    const attackerDefenseOriginal = testCards.attacker.data.defense; // 10
    
    // Aplicar dano
    testCards.defender.data.defense -= attackPower; // 12 - 15 = -3
    testCards.attacker.data.defense -= defenderAttack; // 10 - 8 = 2
    
    console.log('📊 Estado após dano:');
    console.log(`   Atacante: ${testCards.attacker.data.attack}/${testCards.attacker.data.defense}`);
    console.log(`   Defensor: ${testCards.defender.data.attack}/${testCards.defender.data.defense}`);
    
    // Verificar destruição
    const defenderDestroyed = testCards.defender.data.defense <= 0;
    const attackerDestroyed = testCards.attacker.data.defense <= 0;
    
    console.log('💥 Verificação de destruição:');
    console.log(`   Defensor destruído: ${defenderDestroyed} (DEF: ${testCards.defender.data.defense})`);
    console.log(`   Atacante destruído: ${attackerDestroyed} (DEF: ${testCards.attacker.data.defense})`);
    
    // Calcular dano penetrante
    const penetratingDamage = Math.max(0, attackPower - defenderDefenseOriginal);
    console.log(`🗡️ Dano penetrante: ${penetratingDamage} (${attackPower} ATK - ${defenderDefenseOriginal} DEF original)`);
    
    // Resultado esperado
    console.log('✅ Resultado esperado:');
    console.log('   - Defensor deveria ser destruído (DEF = -3)');
    console.log('   - Atacante deveria sobreviver (DEF = 2)');
    console.log('   - Dano penetrante = 3 (15 - 12)');
    
    // Testar se valores negativos são exibidos corretamente
    const defenderDisplayDefense = Math.max(0, testCards.defender.data.defense);
    const attackerDisplayDefense = Math.max(0, testCards.attacker.data.defense);
    
    console.log('🎮 Valores de exibição:');
    console.log(`   Defensor exibido: ${defenderDisplayDefense} (original: ${testCards.defender.data.defense})`);
    console.log(`   Atacante exibido: ${attackerDisplayDefense} (original: ${testCards.attacker.data.defense})`);
    
    // Restaurar função original
    window.findCardData = originalFindCardData;
    
    console.log('🏆 Teste concluído!');
}

// Teste específico para cartas com defesa baixa
function testLowDefenseAttack() {
    console.log('🧪 ===== TESTE DEFESA BAIXA =====');
    
    const testCards = {
        strongAttacker: { 
            id: 'test-strong', 
            data: { name: 'Dragão Poderoso', cost: 8, attack: 40, defense: 30 }, 
            player: 'p1' 
        },
        weakDefender: { 
            id: 'test-weak', 
            data: { name: 'Goblin Fraco', cost: 1, attack: 2, defense: 3 }, 
            player: 'p2' 
        }
    };
    
    console.log('📊 Cenário: Ataque massivo vs defesa fraca');
    console.log(`   Atacante: ${testCards.strongAttacker.data.attack}/${testCards.strongAttacker.data.defense}`);
    console.log(`   Defensor: ${testCards.weakDefender.data.attack}/${testCards.weakDefender.data.defense}`);
    
    // Aplicar dano
    const attackPower = testCards.strongAttacker.data.attack; // 40
    const defenderDefenseOriginal = testCards.weakDefender.data.defense; // 3
    
    testCards.weakDefender.data.defense -= attackPower; // 3 - 40 = -37
    testCards.strongAttacker.data.defense -= testCards.weakDefender.data.attack; // 30 - 2 = 28
    
    console.log('📊 Resultado:');
    console.log(`   Atacante final: ${testCards.strongAttacker.data.defense} DEF`);
    console.log(`   Defensor final: ${testCards.weakDefender.data.defense} DEF`);
    
    const defenderDestroyed = testCards.weakDefender.data.defense <= 0;
    const penetratingDamage = Math.max(0, attackPower - defenderDefenseOriginal); // 40 - 3 = 37
    
    console.log('💥 Análise:');
    console.log(`   Defensor destruído: ${defenderDestroyed}`);
    console.log(`   Dano penetrante: ${penetratingDamage}`);
    console.log(`   Defesa exibida: ${Math.max(0, testCards.weakDefender.data.defense)}`);
    
    console.log('✅ Este caso deveria funcionar perfeitamente após a correção!');
}

console.log('🧪 Testes de ataque carregados!');
console.log('📋 Comandos disponíveis:');
console.log('   • testAttackCalculation() - Teste básico de ataque');
console.log('   • testLowDefenseAttack() - Teste com defesa baixa');