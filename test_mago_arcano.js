// Teste específico para verificar a correção do Mago Arcano
function testMagoArcanoFix() {
    console.log('🧙‍♂️ ===== TESTE MAGO ARCANO =====');
    
    if (!window.cardAbilities) {
        console.log('❌ Sistema de habilidades não carregado!');
        return;
    }
    
    // Simular estado inicial
    const initialPV = {
        p1: parseInt(document.getElementById('pv-p1')?.innerText || '100'),
        p2: parseInt(document.getElementById('pv-p2')?.innerText || '100')
    };
    
    console.log(`💚 PV inicial: P1=${initialPV.p1}, P2=${initialPV.p2}`);
    
    // Criar carta teste do Mago Arcano
    const magoCardId = 'test-mago-arcano';
    const playerId = 'p1';
    const opponentId = 'p2';
    
    console.log('🎯 Testando habilidade Rajada de Mana...');
    
    try {
        // Resetar estado de habilidades usadas (se existir)
        if (window.cardAbilities.usedAbilitiesThisTurn) {
            window.cardAbilities.usedAbilitiesThisTurn.clear();
        }
        
        // Ativar habilidade do Mago Arcano
        window.cardAbilities.magoArcano_manaBlast(magoCardId, playerId);
        
        // Verificar se o dano foi aplicado
        const finalPV = {
            p1: parseInt(document.getElementById('pv-p1')?.innerText || '100'),
            p2: parseInt(document.getElementById('pv-p2')?.innerText || '100')
        };
        
        console.log(`💖 PV final: P1=${finalPV.p1}, P2=${finalPV.p2}`);
        
        const expectedDamage = 5;
        const actualDamage = initialPV.p2 - finalPV.p2;
        
        console.log(`⚔️ Dano esperado: ${expectedDamage}`);
        console.log(`⚔️ Dano real: ${actualDamage}`);
        
        if (actualDamage === expectedDamage) {
            console.log('✅ SUCESSO: Rajada de Mana funcionou corretamente!');
            
            // Testar limitação de uma vez por turno
            console.log('🔄 Testando limitação "uma vez por turno"...');
            
            const pvBeforeSecond = parseInt(document.getElementById('pv-p2')?.innerText || '100');
            window.cardAbilities.magoArcano_manaBlast(magoCardId, playerId);
            const pvAfterSecond = parseInt(document.getElementById('pv-p2')?.innerText || '100');
            
            const secondDamage = pvBeforeSecond - pvAfterSecond;
            console.log(`🔄 Segunda tentativa - Dano: ${secondDamage}`);
            
            if (secondDamage === 0) {
                console.log('✅ SUCESSO: Limitação "uma vez por turno" funcionando!');
            } else {
                console.log('❌ ERRO: Habilidade pode ser usada múltiplas vezes!');
            }
            
        } else {
            console.log('❌ ERRO: Dano não foi aplicado corretamente!');
            
            // Diagnóstico
            console.log('🔍 Diagnóstico:');
            console.log('   - Função damagePlayer existe?', typeof window.cardAbilities.damagePlayer === 'function');
            console.log('   - Função changeStat existe?', typeof window.changeStat === 'function');
            console.log('   - Função hasUsedAbilityThisTurn existe?', typeof window.cardAbilities.hasUsedAbilityThisTurn === 'function');
        }
        
    } catch (error) {
        console.error('❌ ERRO durante teste:', error);
        console.log('🔍 Detalhes do erro:', error.message);
    }
    
    // Restaurar PV original (opcional)
    console.log('🔄 Restaurando PV original...');
    if (window.changeStat) {
        window.changeStat('pv', 'p1', initialPV.p1 - parseInt(document.getElementById('pv-p1')?.innerText || '100'));
        window.changeStat('pv', 'p2', initialPV.p2 - parseInt(document.getElementById('pv-p2')?.innerText || '100'));
    }
    
    console.log('🏁 Teste do Mago Arcano finalizado!');
}

// Teste completo de múltiplas habilidades de dano direto
function testDirectDamageAbilities() {
    console.log('💥 ===== TESTE HABILIDADES DE DANO DIRETO =====');
    
    const directDamageAbilities = [
        {
            name: 'Mago Arcano',
            cardId: 'test-mago',
            function: 'magoArcano_manaBlast',
            damage: 5,
            cooldown: 'mana_blast'
        },
        {
            name: 'Drako',
            cardId: 'test-drako', 
            function: 'drako_tripleBreath',
            damage: 15,
            cooldown: 'triple_breath'
        },
        {
            name: 'Shock',
            cardId: 'test-shock',
            function: 'shock_electroDischarge',
            damage: 10,
            cooldown: 'shock_discharge'
        }
    ];
    
    const initialPV = parseInt(document.getElementById('pv-p2')?.innerText || '100');
    let currentPV = initialPV;
    
    console.log(`💚 PV inicial do alvo: ${initialPV}`);
    
    directDamageAbilities.forEach((ability, index) => {
        console.log(`\n${index + 1}. Testando ${ability.name}...`);
        
        try {
            // Resetar cooldowns
            if (window.cardAbilities.usedAbilitiesThisTurn) {
                window.cardAbilities.usedAbilitiesThisTurn.clear();
            }
            
            const pvBefore = parseInt(document.getElementById('pv-p2')?.innerText || '100');
            
            // Ativar habilidade
            if (typeof window.cardAbilities[ability.function] === 'function') {
                window.cardAbilities[ability.function](ability.cardId, 'p1');
                
                const pvAfter = parseInt(document.getElementById('pv-p2')?.innerText || '100');
                const actualDamage = pvBefore - pvAfter;
                
                console.log(`   🎯 Dano esperado: ${ability.damage}`);
                console.log(`   🎯 Dano real: ${actualDamage}`);
                
                if (actualDamage === ability.damage) {
                    console.log(`   ✅ ${ability.name}: FUNCIONANDO`);
                } else {
                    console.log(`   ❌ ${ability.name}: ERRO (dano incorreto)`);
                }
            } else {
                console.log(`   ❌ ${ability.name}: Função não encontrada`);
            }
            
        } catch (error) {
            console.log(`   ❌ ${ability.name}: ERRO - ${error.message}`);
        }
    });
    
    // Restaurar PV
    const finalPV = parseInt(document.getElementById('pv-p2')?.innerText || '100');
    if (window.changeStat && finalPV !== initialPV) {
        window.changeStat('pv', 'p2', initialPV - finalPV);
        console.log(`🔄 PV restaurado de ${finalPV} para ${initialPV}`);
    }
    
    console.log('\n🏁 Teste de habilidades de dano direto finalizado!');
}

console.log('🧙‍♂️ Testes do Mago Arcano carregados!');
console.log('📋 Comandos disponíveis:');
console.log('   • testMagoArcanoFix() - Testar correção do Mago Arcano');
console.log('   • testDirectDamageAbilities() - Testar todas habilidades de dano direto');