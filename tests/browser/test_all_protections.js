// Teste abrangente para todas as proteções de criaturas
function testAllProtections() {
    console.log('🧪 ===== TESTE DE TODAS AS PROTEÇÕES =====');
    
    // Dados das cartas para teste
    const testCards = {
        // Atacantes com diferentes custos
        baixoCusto: { id: 'test-low', data: { name: 'Atacante Fraco', cost: 2, attack: 5, defense: 5 }, player: 'p1' },
        custoDois: { id: 'test-cost2', data: { name: 'Atacante Custo 2', cost: 2, attack: 8, defense: 8 }, player: 'p1' },
        custoTres: { id: 'test-cost3', data: { name: 'Atacante Custo 3', cost: 3, attack: 10, defense: 10 }, player: 'p1' },
        custoQuatro: { id: 'test-cost4', data: { name: 'Ptera', cost: 4, attack: 15, defense: 8 }, player: 'p1' },
        custoAlto: { id: 'test-high', data: { name: 'Dragão Poderoso', cost: 8, attack: 40, defense: 30 }, player: 'p1' },
        
        // Alvos protegidos
        tobinha: { id: 'test-tobinha', data: { name: 'Tobinha e Boguinha', cost: 2, attack: 5, defense: 10 }, player: 'p2' },
        turtol: { id: 'test-turtol', data: { name: 'Turtol', cost: 5, attack: 20, defense: 39 }, player: 'p2' },
        ironDragon: { id: 'test-iron', data: { name: 'Iron Dragon', cost: 7, attack: 35, defense: 40 }, player: 'p2' },
        golem: { id: 'test-golem', data: { name: 'Golem de Pedra', cost: 8, attack: 40, defense: 50 }, player: 'p2' },
        sabio: { id: 'test-sabio', data: { name: 'Sábio da Montanha', cost: 6, attack: 30, defense: 25 }, player: 'p2' },
        oLica: { id: 'test-olica', data: { name: 'O Lica', cost: 6, attack: 35, defense: 30 }, player: 'p2' }
    };
    
    // Função temporária para simular findCardData
    const originalFindCardData = window.findCardData;
    window.findCardData = function(cardId) {
        for (const card of Object.values(testCards)) {
            if (card.id === cardId) {
                return card;
            }
        }
        return null;
    };
    
    // Simular sistema de habilidades se não existir
    if (!window.cardAbilities) {
        window.cardAbilities = {
            permanentEffects: new Map()
        };
    }
    
    console.log('🔧 Configurando proteções...');
    
    // 1. Configurar proteção Tobinha (Fofura)
    const tobinhaProtections = new Map();
    tobinhaProtections.set('cuteness_protection', {
        immuneToHighCostAttacks: true,
        maxAttackerCost: 3
    });
    window.cardAbilities.permanentEffects.set('test-tobinha', tobinhaProtections);
    
    // 2. Configurar proteção Turtol (Imunidade a habilidades fracas)
    const turtolProtections = new Map();
    turtolProtections.set('ability_immunity', {
        immuneToLowCostAbilities: true,
        maxAbilityCost: 4
    });
    window.cardAbilities.permanentEffects.set('test-turtol', turtolProtections);
    
    // 3. Configurar proteção Iron Dragon (Imunidade total)
    const ironProtections = new Map();
    ironProtections.set('total_ability_immunity', {
        immuneToAllAbilities: true
    });
    window.cardAbilities.permanentEffects.set('test-iron', ironProtections);
    
    // 4. Configurar proteção Golem de Pedra (Pele de Pedra)
    const golemProtections = new Map();
    golemProtections.set('stone_immunity', {
        immuneToAbilityDamage: true
    });
    window.cardAbilities.permanentEffects.set('test-golem', golemProtections);
    
    // 5. Configurar proteção Sábio da Montanha (Evasão)
    const sabioProtections = new Map();
    sabioProtections.set('mountain_evasion', {
        immuneToLowCostAttacks: true,
        maxAttackerCost: 4
    });
    window.cardAbilities.permanentEffects.set('test-sabio', sabioProtections);
    
    // 6. Configurar proteção O Lica (Licantropia)
    const licaProtections = new Map();
    licaProtections.set('lycanthropy_protection', {
        cannotBeTargeted: true
    });
    window.cardAbilities.permanentEffects.set('test-olica', licaProtections);
    
    console.log('✅ Proteções configuradas com sucesso!');
    console.log('');
    
    // Testes estruturados
    const tests = [
        // TESTE 1: Tobinha e Boguinha (Fofura - não pode ser atacado por custo > 3)
        {
            name: '🐱 TESTE TOBINHA E BOGUINHA (Fofura)',
            target: 'test-tobinha',
            targetName: 'Tobinha e Boguinha',
            protection: 'Fofura: não pode ser atacado por criaturas com custo > 3',
            attacks: [
                { attacker: 'test-cost2', name: 'Atacante Custo 2', shouldPass: true },
                { attacker: 'test-cost3', name: 'Atacante Custo 3', shouldPass: true },
                { attacker: 'test-cost4', name: 'Ptera (custo 4)', shouldPass: false },
                { attacker: 'test-high', name: 'Dragão Poderoso (custo 8)', shouldPass: false }
            ]
        },
        
        // TESTE 2: Turtol (Imune a habilidades de custo < 4)
        {
            name: '🐢 TESTE TURTOL (Imunidade a Habilidades Fracas)',
            target: 'test-turtol',
            targetName: 'Turtol',
            protection: 'Imune a habilidades de criaturas com custo < 4',
            attacks: [
                { attacker: 'test-low', name: 'Atacante Fraco (custo 2)', shouldPass: false },
                { attacker: 'test-cost3', name: 'Atacante Custo 3', shouldPass: false },
                { attacker: 'test-cost4', name: 'Ptera (custo 4)', shouldPass: true },
                { attacker: 'test-high', name: 'Dragão Poderoso (custo 8)', shouldPass: true }
            ]
        },
        
        // TESTE 3: Iron Dragon (Imunidade total)
        {
            name: '🐉 TESTE IRON DRAGON (Imunidade Total)',
            target: 'test-iron',
            targetName: 'Iron Dragon',
            protection: 'Imune a todas as habilidades inimigas',
            attacks: [
                { attacker: 'test-low', name: 'Atacante Fraco (custo 2)', shouldPass: false },
                { attacker: 'test-cost3', name: 'Atacante Custo 3', shouldPass: false },
                { attacker: 'test-cost4', name: 'Ptera (custo 4)', shouldPass: false },
                { attacker: 'test-high', name: 'Dragão Poderoso (custo 8)', shouldPass: false }
            ]
        },
        
        // TESTE 4: Golem de Pedra (Pele de Pedra)
        {
            name: '🗿 TESTE GOLEM DE PEDRA (Pele de Pedra)',
            target: 'test-golem',
            targetName: 'Golem de Pedra',
            protection: 'Imune a danos de habilidades especiais',
            attacks: [
                { attacker: 'test-low', name: 'Atacante Fraco (custo 2)', shouldPass: false },
                { attacker: 'test-cost3', name: 'Atacante Custo 3', shouldPass: false },
                { attacker: 'test-cost4', name: 'Ptera (custo 4)', shouldPass: false },
                { attacker: 'test-high', name: 'Dragão Poderoso (custo 8)', shouldPass: false }
            ]
        },
        
        // TESTE 5: Sábio da Montanha (Evasão da Montanha)
        {
            name: '🏔️ TESTE SÁBIO DA MONTANHA (Evasão)',
            target: 'test-sabio',
            targetName: 'Sábio da Montanha',
            protection: 'Evasão contra criaturas com custo ≤ 4 (quando sozinho)',
            attacks: [
                { attacker: 'test-low', name: 'Atacante Fraco (custo 2)', shouldPass: false },
                { attacker: 'test-cost3', name: 'Atacante Custo 3', shouldPass: false },
                { attacker: 'test-cost4', name: 'Ptera (custo 4)', shouldPass: false },
                { attacker: 'test-high', name: 'Dragão Poderoso (custo 8)', shouldPass: true }
            ]
        },
        
        // TESTE 6: O Lica (Licantropia das Trevas)
        {
            name: '🌙 TESTE O LICA (Licantropia das Trevas)',
            target: 'test-olica',
            targetName: 'O Lica',
            protection: 'Não pode ser atacado quando oponente tem apenas 1 criatura',
            attacks: [
                { attacker: 'test-low', name: 'Atacante Fraco (custo 2)', shouldPass: false },
                { attacker: 'test-cost3', name: 'Atacante Custo 3', shouldPass: false },
                { attacker: 'test-cost4', name: 'Ptera (custo 4)', shouldPass: false },
                { attacker: 'test-high', name: 'Dragão Poderoso (custo 8)', shouldPass: false }
            ]
        }
    ];
    
    // Executar todos os testes
    let totalTests = 0;
    let passedTests = 0;
    
    tests.forEach(test => {
        console.log(`${test.name}`);
        console.log(`🛡️ Proteção: ${test.protection}`);
        console.log('');
        
        test.attacks.forEach(attack => {
            totalTests++;
            const result = canAttackTarget(attack.attacker, test.target);
            const passed = (result.canAttack && attack.shouldPass) || (!result.canAttack && !attack.shouldPass);
            
            if (passed) {
                passedTests++;
                console.log(`✅ ${attack.name} → ${test.targetName}: ${attack.shouldPass ? 'PODE ATACAR' : 'BLOQUEADO'}`);
                if (!attack.shouldPass) {
                    console.log(`   📝 Razão: ${result.reason}`);
                }
            } else {
                console.log(`❌ ${attack.name} → ${test.targetName}: FALHOU!`);
                console.log(`   📝 Esperado: ${attack.shouldPass ? 'Pode atacar' : 'Bloqueado'}`);
                console.log(`   📝 Obtido: ${result.canAttack ? 'Pode atacar' : 'Bloqueado'}`);
                console.log(`   📝 Razão: ${result.reason}`);
            }
        });
        
        console.log('');
    });
    
    // Resultado final
    console.log('🏆 ===== RESULTADO FINAL =====');
    console.log(`✅ Testes Passados: ${passedTests}/${totalTests}`);
    console.log(`📊 Taxa de Sucesso: ${((passedTests/totalTests)*100).toFixed(1)}%`);
    
    if (passedTests === totalTests) {
        console.log('🎉 TODOS OS TESTES PASSARAM! Sistema de proteções funcionando perfeitamente!');
    } else {
        console.log('⚠️ Alguns testes falharam. Verificar implementação.');
    }
    
    // Limpeza
    window.findCardData = originalFindCardData;
    
    // Limpar proteções de teste
    ['test-tobinha', 'test-turtol', 'test-iron', 'test-golem', 'test-sabio', 'test-olica'].forEach(cardId => {
        if (window.cardAbilities && window.cardAbilities.permanentEffects) {
            window.cardAbilities.permanentEffects.delete(cardId);
        }
    });
    
    console.log('🧹 Limpeza concluída.');
}

// Teste específico para verificar se uma proteção específica está funcionando
function testSpecificProtection(protectionType) {
    console.log(`🔍 Testando proteção específica: ${protectionType}`);
    
    switch(protectionType) {
        case 'fofura':
            console.log('🐱 Testando proteção Fofura (Tobinha)...');
            // Simular apenas o teste da Tobinha
            break;
        case 'turtol':
            console.log('🐢 Testando imunidade Turtol...');
            break;
        case 'iron':
            console.log('🐉 Testando imunidade total Iron Dragon...');
            break;
        case 'golem':
            console.log('🗿 Testando Pele de Pedra...');
            break;
        default:
            console.log('❌ Tipo de proteção não reconhecido');
            return;
    }
    
    // Implementar teste específico se necessário
}

console.log('🧪 Sistema de testes de proteção carregado!');
console.log('📋 Comandos disponíveis:');
console.log('   • testAllProtections() - Testa todas as proteções');
console.log('   • testSpecificProtection("fofura") - Testa proteção específica');