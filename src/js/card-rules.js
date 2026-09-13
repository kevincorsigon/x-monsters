(function(root, factory) {
    let gameEngineApi = root.GameEngine;

    if (!gameEngineApi && typeof require === 'function') {
        gameEngineApi = require('./game-engine.js');
    }

    const cardRulesApi = factory(gameEngineApi);

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = cardRulesApi;
    }

    root.CardRules = cardRulesApi;
})(typeof window !== 'undefined' ? window : globalThis, function(GameEngine) {
    const SUMMON_RULES = Object.freeze({
        card_012: {
            feedback: 'Natalino: outras criaturas aliadas recuperaram 10 DEF.',
            resolve(event, context) {
                return context.state.players[event.payload.playerId].zones.field
                    .filter(card =>
                        card.instanceId !== event.payload.cardId &&
                        card.data.type === 'criatura'
                    )
                    .map(card => ({
                        kind: GameEngine.EFFECT_KINDS.APPLY_CARD_DAMAGE,
                        targetId: card.instanceId,
                        amount: -10
                    }));
            }
        },
        card_013: {
            feedback: 'Zol: uma carta adicional foi comprada.',
            resolve(event, context) {
                const deck = context.state.players[event.payload.playerId].zones.deck;
                if (deck.length === 0) return [];
                return [{
                    kind: GameEngine.EFFECT_KINDS.MOVE_CARD,
                    instanceId: deck[0].instanceId,
                    destinationZone: 'hand',
                    destinationPlayerId: event.payload.playerId
                }];
            }
        },
        card_023: {
            feedback: 'Raylaser: 15 de dano direto ao oponente.',
            resolve(event) {
                return [{
                    kind: GameEngine.EFFECT_KINDS.CHANGE_PLAYER_STAT,
                    stat: 'pv',
                    playerId: event.payload.playerId === 'p1' ? 'p2' : 'p1',
                    amount: -15,
                    changeType: 'damage',
                    provenance: {
                        kind: 'ability',
                        sourceId: event.payload.cardId,
                        abilityId: 'raylaser_direct_damage'
                    }
                }];
            }
        },
        card_079: {
            feedback: 'Lobo Beta Lightning: 20 de dano direto ao oponente.',
            resolve(event) {
                return [{
                    kind: GameEngine.EFFECT_KINDS.CHANGE_PLAYER_STAT,
                    stat: 'pv',
                    playerId: event.payload.playerId === 'p1' ? 'p2' : 'p1',
                    amount: -20,
                    changeType: 'damage',
                    provenance: {
                        kind: 'ability',
                        sourceId: event.payload.cardId,
                        abilityId: 'lightning_direct_damage'
                    }
                }];
            }
        }
    });

    const EQUIPMENT_RULES = Object.freeze({
        card_001: {
            feedback: 'Espada Mágica: +5 ATK/+5 DEF enquanto equipada.',
            targetSide: 'ALLY',
            modifiers: { attack: 5, defense: 5 }
        },
        card_002: {
            feedback: 'Estrela Mágica: o próximo ataque será anulado.',
            targetSide: 'ALLY',
            modifiers: {},
            effects(equipment, targetId) {
                return [{
                    kind: GameEngine.EFFECT_KINDS.ADD_EFFECT,
                    effect: {
                        id: `${equipment.instanceId}:magic_shield`,
                        effectType: 'MAGIC_SHIELD',
                        sourceId: equipment.instanceId,
                        targetId,
                        duration: {
                            kind: GameEngine.DURATION_KINDS.UNTIL_SOURCE_LEAVES,
                            sourceId: equipment.instanceId
                        }
                    }
                }];
            }
        },
        card_004: {
            feedback: 'Chocolicia: -10 ATK/-10 DEF enquanto equipada.',
            targetSide: 'ENEMY',
            modifiers: { attack: -10, defense: -10 }
        },
        card_009: {
            feedback: 'Abutuaram: -15 DEF enquanto equipada.',
            targetSide: 'ENEMY',
            modifiers: { defense: -15 }
        },
        card_028: {
            feedback: 'Atravessava: ataque direto enquanto equipada.',
            targetSide: 'ALLY',
            modifiers: {},
            effects(equipment, targetId) {
                return [{
                    kind: GameEngine.EFFECT_KINDS.ADD_EFFECT,
                    effect: {
                        id: `${equipment.instanceId}:direct_attack`,
                        effectType: 'DIRECT_ATTACK_PERMISSION',
                        sourceId: equipment.instanceId,
                        targetId,
                        duration: {
                            kind: GameEngine.DURATION_KINDS.UNTIL_SOURCE_LEAVES,
                            sourceId: equipment.instanceId
                        }
                    }
                }];
            }
        },
        card_088: {
            feedback: 'Rego Freitas: ataque direto até o fim do turno.',
            targetSide: 'ALLY',
            modifiers: {},
            effects(equipment, targetId, state) {
                return [{
                    kind: GameEngine.EFFECT_KINDS.ADD_EFFECT,
                    effect: {
                        id: `${equipment.instanceId}:temporary_flight`,
                        effectType: 'DIRECT_ATTACK_PERMISSION',
                        sourceId: equipment.instanceId,
                        targetId,
                        expiresPlayerId: equipment.controllerId,
                        expiresTurnNumber: state.turn,
                        duration: {
                            kind: GameEngine.DURATION_KINDS.UNTIL_SOURCE_LEAVES,
                            sourceId: equipment.instanceId
                        }
                    }
                }];
            }
        },
        card_098: {
            feedback: 'Dispositivo de Sincronia: robôs aliados recebem +5/+5.',
            targetSide: 'ALLY',
            requiredTrait: 'robotico',
            modifiers: {},
            effects(equipment, targetId, state) {
                return createRobotSynergyEffects(state, equipment, targetId);
            }
        },
        card_104: {
            feedback: 'Núcleo de Energia Pura: +5 ATK/+5 DEF.',
            targetSide: 'ALLY',
            requiredTraitsAny: ['dragao', 'elite'],
            modifiers: { attack: 5, defense: 5 }
        },
        card_103: {
            feedback: 'Couraça de Nano-Carbono: reduz 10 de dano de atacantes custo 8+.',
            targetSide: 'ALLY',
            requiredTrait: 'robotico',
            modifiers: {},
            effects(equipment, targetId) {
                return [{
                    kind: GameEngine.EFFECT_KINDS.ADD_EFFECT,
                    effect: {
                        id: `${equipment.instanceId}:nano_armor`,
                        effectType: 'NANO_ARMOR',
                        sourceId: equipment.instanceId,
                        targetId,
                        duration: {
                            kind: GameEngine.DURATION_KINDS.UNTIL_SOURCE_LEAVES,
                            sourceId: equipment.instanceId
                        }
                    }
                }];
            }
        },
        card_108: {
            feedback: 'Aura de Vingança: ATK efetivo será causado ao PV após a morte.',
            targetSide: 'ALLY',
            requiredTrait: 'elite',
            modifiers: {}
        },
        card_089: {
            feedback: 'Apelino: ataques ilimitados enquanto equipado.',
            targetSide: 'ALLY',
            modifiers: { attackLimit: Number.MAX_SAFE_INTEGER },
            modifierOperations: { attackLimit: GameEngine.MODIFIER_OPERATIONS.SET }
        },
        card_096: {
            feedback: 'Machado do Vento: segundo ataque em alvo diferente pela metade.',
            targetSide: 'ALLY',
            modifiers: { attackLimit: 2 },
            modifierOperations: { attackLimit: GameEngine.MODIFIER_OPERATIONS.SET }
        },
        card_100: {
            feedback: 'Botas da Rapidez: segundo ataque pela metade.',
            targetSide: 'ALLY',
            modifiers: { attackLimit: 2 },
            modifierOperations: { attackLimit: GameEngine.MODIFIER_OPERATIONS.SET }
        },
        card_095: {
            feedback: 'Manto da Luz Solar: 15 de dano contra Vampiro/Lobisomem.',
            targetSide: 'ALLY',
            modifiers: {}
        },
        card_102: {
            feedback: 'Estaca do Caçador: +10 ATK contra Vampiro/Lobisomem.',
            targetSide: 'ALLY',
            requiredTraitsAny: ['guerreiro', 'humanoide'],
            modifiers: {}
        },
        card_105: {
            feedback: 'Manoplas de Gelo: +15 dano contra criaturas de fogo.',
            targetSide: 'ALLY',
            modifiers: {}
        },
        card_092: {
            feedback: 'Cajado da Ilusão: 1x/turno o hospedeiro pode ficar intocável.',
            targetSide: 'ALLY',
            requiredTrait: 'magico',
            modifiers: {}
        },
        card_097: {
            feedback: 'Flecha de Prata: ataques ignoram habilidades defensivas do alvo.',
            targetSide: 'ALLY',
            requiredTraitsAny: ['humanoide', 'besta'],
            modifiers: {}
        },
        card_101: {
            feedback: 'Olho de Águia: ataques ignoram Evasão e Intocável do alvo.',
            targetSide: 'ALLY',
            modifiers: {}
        }
    });

    const COMBAT_RULES = Object.freeze({
        card_017: { feedback: 'Bufaboi: +10 de dano no primeiro ataque do turno.' },
        card_019: { feedback: 'Garras Afiadas: +10 ATK contra criatura recém-invocada.' },
        card_021: { feedback: 'Paladar dobra o ataque contra DEF superior.' },
        card_022: { feedback: 'Puma da Selva faz seu ATK completo penetrar.' },
        card_032: { feedback: 'Hipool causa +10 dano contra DEF menor.' },
        card_056: { feedback: 'Minotauro ignora toda DEF no primeiro ataque.' },
        card_064: { feedback: 'Gamaa ignora 10 DEF por robô aliado.' },
        card_066: { feedback: 'Mexica dobra o primeiro ataque do turno.' },
        card_070: { feedback: 'Tiranossauro ignora 10 DEF no primeiro ataque.' },
        card_074: { feedback: 'Nucles reduz em 10 o dano físico recebido.' },
        card_076: { feedback: 'Condessa ataca com ATK-15 e cresce após abates.' },
        card_078: { feedback: 'Lobo Alfa Fly ignora 20 DEF.' },
        card_029: { feedback: 'Aladar recupera um ataque após derrotar.' },
        card_030: { feedback: 'Cacton reflete metade do dano físico recebido.' },
        card_036: { feedback: 'Rei das Feras causa 10 PV após derrotar.' },
        card_042: { feedback: 'Fantom retorna à mão em vez de morrer.' },
        card_052: { feedback: 'Dragão de Cobre causa 10 PV após derrotar.' },
        card_054: { feedback: 'Lorde Sanguinário transfere até 10 PV após derrotar.' },
        card_071: { feedback: 'Dragão de Jade causa 10 de dano ao atacante.' },
        card_047: { feedback: 'Tobias: segundo ataque pela metade.' },
        card_063: { feedback: 'Beluga: ataque direto pela metade.' },
        card_084: { feedback: 'Imperial X: dois ataques por turno.' }
    });

    const ACTIVATED_RULES = Object.freeze({
        card_026: {
            abilityId: 'sabotar_copo',
            feedback: 'Sabota Copos: -5 ATK/-5 DEF.',
            limit: { kind: GameEngine.LIMIT_KINDS.PER_TURN, count: 1 },
            minTargets: 1,
            maxTargets: 1,
            damage: null
        },
        card_051: {
            abilityId: 'descarga_choque',
            feedback: 'Dino Elétrico: 10 de dano a todos os inimigos.',
            limit: { kind: GameEngine.LIMIT_KINDS.PER_TURN, count: 1 },
            minTargets: 0,
            maxTargets: 0,
            damage: 10,
            allEnemies: true
        },
        card_057: {
            abilityId: 'sopro_triplo',
            feedback: 'Quimera de Fogo: 5 de dano em até três inimigos.',
            limit: { kind: GameEngine.LIMIT_KINDS.PER_TURN, count: 1 },
            minTargets: 1,
            maxTargets: 3,
            damage: 5
        },
        card_092: {
            abilityId: 'cajado_intocavel',
            feedback: 'Cajado da Ilusão: o hospedeiro fica intocável até o próximo ataque.',
            limit: { kind: GameEngine.LIMIT_KINDS.PER_TURN, count: 1 },
            minTargets: 0,
            maxTargets: 0,
            sourceZone: 'equipment',
            buildEffects(sourceId, context) {
                const equipment = context.state.cardInstances[sourceId];
                const hostId = equipment?.attachedTo;
                if (!hostId) return [];
                return [{
                    kind: GameEngine.EFFECT_KINDS.ADD_EFFECT,
                    effect: {
                        id: `${sourceId}:untouchable_shield:${context.state.turn}`,
                        effectType: 'UNTOUCHABLE_SHIELD',
                        sourceId,
                        targetId: hostId,
                        duration: {
                            kind: GameEngine.DURATION_KINDS.UNTIL_SOURCE_LEAVES,
                            sourceId
                        }
                    }
                }];
            }
        }
    });

    const TARGET_RULES = Object.freeze({
        card_014: { feedback: 'Fofura: não pode ser atacado por custo maior que 3.' },
        card_018: { feedback: 'CP-2: inimigos devem atacá-lo primeiro.' },
        card_025: { feedback: 'Protegido enquanto houver outro aliado.' },
        card_044: { feedback: 'Voar Alto: não pode ser atacado por custo 4 ou menor.' },
        card_058: { feedback: 'Evasão ativa enquanto for a única criatura aliada.' },
        card_059: { feedback: 'O Lica não pode ser atacado por um campo inimigo solitário.' },
        card_060: { feedback: 'Tranca Rua deve ser atacado enquanto houver outro aliado.' }
    });

    const PROTECTION_RULES = Object.freeze({
        card_048: { feedback: 'Turtol ignora habilidades de criaturas com custo menor que 4.' },
        card_065: { feedback: 'Iron Dragon ignora habilidades inimigas.' },
        card_073: { feedback: 'Golem de Pedra ignora dano de habilidade de criaturas inimigas.' },
        card_086: { feedback: 'Sentinela Solar ergue uma barreira por um turno adversário.' }
    });

    const STATE_RULES = Object.freeze({
        card_024: {
            feedback: 'Slipul recalcula seu bônus conforme o campo inimigo.',
            modifiers: [
                dynamicModifier('attack', GameEngine.MODIFIER_OPERATIONS.ADD,
                    (state, card) => enemyCreatures(state, card).length * 5,
                    (state, card) => allyCreatures(state, card).length === 1),
                dynamicModifier('defense', GameEngine.MODIFIER_OPERATIONS.ADD,
                    (state, card) => enemyCreatures(state, card).length * 5,
                    (state, card) => allyCreatures(state, card).length === 1)
            ]
        },
        card_033: {
            feedback: 'Sincronia Robótica: robôs aliados recebem +5 ATK.',
            modifiers: []
        },
        card_037: {
            feedback: 'Scoul recebe +10/+10 enquanto houver um dragão em campo.',
            modifiers: [
                dynamicModifier('attack', GameEngine.MODIFIER_OPERATIONS.ADD,
                    () => 10,
                    state => allFieldCreatures(state).some(card => hasTrait(card, 'dragao'))),
                dynamicModifier('defense', GameEngine.MODIFIER_OPERATIONS.ADD,
                    () => 10,
                    state => allFieldCreatures(state).some(card => hasTrait(card, 'dragao')))
            ]
        },
        card_040: {
            feedback: 'Little Big Shimbard dobra a DEF enquanto estiver sozinho.',
            modifiers: [dynamicModifier(
                'defense',
                GameEngine.MODIFIER_OPERATIONS.MULTIPLY,
                () => 2,
                (state, card) => allyCreatures(state, card).length === 1
            )]
        },
        card_043: {
            feedback: 'Goblin Mestre dobra o ATK com aliado de custo menor que 3.',
            modifiers: [dynamicModifier(
                'attack',
                GameEngine.MODIFIER_OPERATIONS.MULTIPLY,
                () => 2,
                (state, card) => allyCreatures(state, card)
                    .some(ally => ally.instanceId !== card.instanceId && ally.data.cost < 3)
            )]
        },
        card_068: {
            feedback: 'Paladino Crepuscular recebe +10 DEF enquanto estiver sozinho.',
            modifiers: [dynamicModifier(
                'defense',
                GameEngine.MODIFIER_OPERATIONS.ADD,
                () => 10,
                (state, card) => allyCreatures(state, card).length === 1
            )]
        },
        card_075: {
            feedback: 'Turtol Maximus recebe +10 DEF contra um campo com uma criatura.',
            modifiers: [dynamicModifier(
                'defense',
                GameEngine.MODIFIER_OPERATIONS.ADD,
                () => 10,
                (state, card) => enemyCreatures(state, card).length === 1
            )]
        },
        card_077: {
            feedback: 'Marik recebe +5 ATK por criatura inimiga.',
            modifiers: [dynamicModifier(
                'attack',
                GameEngine.MODIFIER_OPERATIONS.ADD,
                (state, card) => enemyCreatures(state, card).length * 5,
                () => true
            )]
        },
        card_047: {
            feedback: 'Tobias: dois ataques por turno.',
            modifiers: [dynamicModifier(
                'attackLimit', GameEngine.MODIFIER_OPERATIONS.SET, () => 2, () => true
            )]
        },
        card_084: {
            feedback: 'Imperial X: dois ataques por turno.',
            modifiers: [dynamicModifier(
                'attackLimit', GameEngine.MODIFIER_OPERATIONS.SET, () => 2, () => true
            )]
        }
    });

    const DIRECT_ATTACK_DEFINITION_IDS = Object.freeze([
        'card_010_1',
        'card_010_2',
        'card_010_3',
        'card_022',
        'card_063',
        'card_035'
    ]);

    const TRAITS_BY_DEFINITION = Object.freeze({
        card_018: Object.freeze(['robotico']),
        card_023: Object.freeze(['robotico']),
        card_027: Object.freeze(['robotico']),
        card_033: Object.freeze(['robotico']),
        card_036: Object.freeze(['elite']),
        card_043: Object.freeze(['humanoide', 'guerreiro']),
        card_052: Object.freeze(['dragao']),
        card_054: Object.freeze(['elite', 'vampiro']),
        card_055: Object.freeze(['magico']),
        card_056: Object.freeze(['guerreiro', 'humanoide']),
        card_057: Object.freeze(['fogo']),
        card_059: Object.freeze(['lobisomem']),
        card_061: Object.freeze(['elite']),
        card_062: Object.freeze(['vampiro']),
        card_065: Object.freeze(['dragao', 'robotico']),
        card_067: Object.freeze(['elite', 'paladino', 'humanoide']),
        card_068: Object.freeze(['elite', 'paladino', 'humanoide']),
        card_071: Object.freeze(['dragao']),
        card_076: Object.freeze(['elite', 'vampiro']),
        card_078: Object.freeze(['lobisomem']),
        card_079: Object.freeze(['lobisomem']),
        card_080: Object.freeze(['lobisomem', 'fogo']),
        card_081: Object.freeze(['lobisomem']),
        card_082: Object.freeze(['lobisomem']),
        card_084: Object.freeze(['elite', 'robotico']),
        card_086: Object.freeze(['elite']),
        card_087: Object.freeze(['elite', 'guerreiro', 'humanoide'])
    });

    function isCreatureCard(card) {
        return card && ['criatura', 'evolução'].includes(card.data.type);
    }

    function hasTrait(card, trait) {
        return (TRAITS_BY_DEFINITION[card?.definitionId] || []).includes(trait);
    }

    function allFieldCreatures(state) {
        return ['p1', 'p2'].flatMap(playerId =>
            state.players[playerId].zones.field.filter(isCreatureCard)
        );
    }

    function allyCreatures(state, card) {
        return state.players[card.controllerId].zones.field.filter(isCreatureCard);
    }

    function enemyCreatures(state, card) {
        const opponentId = card.controllerId === 'p1' ? 'p2' : 'p1';
        return state.players[opponentId].zones.field.filter(isCreatureCard);
    }

    function dynamicModifier(stat, operation, value, condition) {
        return { stat, operation, value, condition };
    }

    function getRule(definitionId) {
        return SUMMON_RULES[definitionId] || null;
    }

    function getEquipmentRule(definitionId) {
        return EQUIPMENT_RULES[definitionId] || null;
    }

    function getCombatRule(definitionId) {
        return COMBAT_RULES[definitionId] || null;
    }

    function getActivatedRule(definitionId) {
        return ACTIVATED_RULES[definitionId] || null;
    }

    function getTargetRule(definitionId) {
        return TARGET_RULES[definitionId] || null;
    }

    function getStateRule(definitionId) {
        return STATE_RULES[definitionId] || null;
    }

    function getProtectionRule(definitionId) {
        return PROTECTION_RULES[definitionId] || null;
    }

    function getFeedback(definitionId) {
        return getRule(definitionId)?.feedback ||
            getEquipmentRule(definitionId)?.feedback ||
            getCombatRule(definitionId)?.feedback ||
            getActivatedRule(definitionId)?.feedback ||
            getTargetRule(definitionId)?.feedback ||
            getStateRule(definitionId)?.feedback ||
            getProtectionRule(definitionId)?.feedback ||
            null;
    }

    function isMigrated(definitionId) {
        return migratedDefinitionIds.includes(definitionId);
    }

    function validateEquipmentTarget(equipment, target) {
        const rule = equipment ? getEquipmentRule(equipment.definitionId) : null;
        if (!equipment || !target || !rule) return { valid: true };
        if (rule.targetSide === 'ALLY' && target.controllerId !== equipment.controllerId) {
            return { valid: false, reason: 'Este suporte exige uma criatura aliada.' };
        }
        if (rule.targetSide === 'ENEMY' && target.controllerId === equipment.controllerId) {
            return { valid: false, reason: 'Este suporte exige uma criatura inimiga.' };
        }
        if (rule.requiredTrait && !hasTrait(target, rule.requiredTrait)) {
            return { valid: false, reason: `Este suporte exige a trait ${rule.requiredTrait}.` };
        }
        if (
            rule.requiredTraitsAny &&
            !rule.requiredTraitsAny.some(trait => hasTrait(target, trait))
        ) {
            return {
                valid: false,
                reason: `Este suporte exige uma das traits: ${rule.requiredTraitsAny.join(' ou ')}.`
            };
        }
        return { valid: true };
    }

    function validateAttackTarget(state, attackerId, targetId) {
        const attacker = state.cardInstances[attackerId];
        const target = state.cardInstances[targetId];
        if (!attacker || !target) return { valid: false, reason: 'Cartas não encontradas' };
        const attachedDefinitions = attacker.attachments
            .map(instanceId => state.cardInstances[instanceId]?.definitionId)
            .filter(Boolean);
        const bypassesAllDefenses = attachedDefinitions.includes('card_097');
        const bypassesEvasion = bypassesAllDefenses || attachedDefinitions.includes('card_101');
        const attackedTargets = attacker.usage?.combatAttacks?.turnNumber === state.turn
            ? attacker.usage.combatAttacks.targets || []
            : [];
        if (attachedDefinitions.includes('card_096') && attackedTargets.includes(targetId)) {
            return { valid: false, reason: 'Machado do Vento exige um alvo diferente.' };
        }
        const defendingField = state.players[target.controllerId].zones.field;
        const taunts = defendingField.filter(card => card.definitionId === 'card_018');

        if (!bypassesAllDefenses && taunts.length > 0 && target.definitionId !== 'card_018') {
            return { valid: false, reason: 'CP-2 deve ser atacado primeiro.' };
        }
        if (!bypassesAllDefenses && target.definitionId === 'card_014' && attacker.data.cost > 3) {
            return { valid: false, reason: 'Fofura bloqueia criaturas de custo maior que 3.' };
        }
        if (!bypassesAllDefenses && target.definitionId === 'card_025') {
            const hasOtherAlly = defendingField.some(card =>
                card.instanceId !== target.instanceId &&
                ['criatura', 'evolução'].includes(card.data.type)
            );
            if (hasOtherAlly) {
                return { valid: false, reason: 'Esta criatura está protegida por outro aliado.' };
            }
        }
        if (!bypassesAllDefenses && target.definitionId === 'card_044' && attacker.data.cost <= 4) {
            return { valid: false, reason: 'Voar Alto bloqueia criaturas de custo 4 ou menor.' };
        }
        if (target.definitionId === 'card_058') {
            const isAlone = defendingField.filter(isCreatureCard).length === 1;
            if (!bypassesEvasion && isAlone && attacker.data.cost <= 4) {
                return { valid: false, reason: 'Evasão bloqueia criaturas de custo 4 ou menor.' };
            }
        }
        if (!bypassesAllDefenses && target.definitionId === 'card_059') {
            const attackingField = state.players[attacker.controllerId].zones.field
                .filter(isCreatureCard);
            if (attackingField.length === 1) {
                return { valid: false, reason: 'Licantropia impede o ataque de um campo solitário.' };
            }
        }
        const trancaRua = defendingField.find(card => card.definitionId === 'card_060');
        if (
            !bypassesAllDefenses &&
            trancaRua &&
            target.instanceId !== trancaRua.instanceId &&
            defendingField.filter(isCreatureCard).length > 1
        ) {
            return { valid: false, reason: 'Tranca Rua deve ser atacado primeiro.' };
        }
        return { valid: true };
    }

    function canDirectAttack(state, attackerId) {
        const attacker = state.cardInstances[attackerId];
        if (!attacker) return false;
        const opponentId = attacker.controllerId === 'p1' ? 'p2' : 'p1';
        const hasDefenders = state.players[opponentId].zones.field
            .some(card => ['criatura', 'evolução'].includes(card.data.type));
        if (!hasDefenders) return true;
        if (attacker.definitionId === 'card_063') {
            const usage = attacker.usage?.combatAttacks;
            const directAttacks = usage?.turnNumber === state.turn
                ? usage.directAttacks || 0
                : 0;
            return directAttacks < 1;
        }
        if (DIRECT_ATTACK_DEFINITION_IDS.includes(attacker.definitionId)) return true;
        return state.effects.some(effect =>
            effect.effectType === 'DIRECT_ATTACK_PERMISSION' &&
            effect.targetId === attackerId
        );
    }

    function getActivatedTargets(state, sourceId) {
        const source = state.cardInstances[sourceId];
        if (!source || !getActivatedRule(source.definitionId)) return [];
        const opponentId = source.controllerId === 'p1' ? 'p2' : 'p1';
        return state.players[opponentId].zones.field
            .filter(card => ['criatura', 'evolução'].includes(card.data.type))
            .map(card => card.instanceId);
    }

    function createActivatedAbilityAction(state, sourceId) {
        const source = state.cardInstances[sourceId];
        const rule = source ? getActivatedRule(source.definitionId) : null;
        if (!source || !rule) return null;

        const action = {
            type: 'ACTIVATE_CARD_ABILITY',
            actorId: source.controllerId,
            sourceId,
            sourceZone: rule.sourceZone || 'field',
            requiredPhase: ['invocation', 'combat'],
            requiresTurn: true,
            abilityId: rule.abilityId,
            limit: rule.limit,
            choice: rule.maxTargets > 0 ? {
                options: context => getActivatedTargets(context.state, sourceId),
                min: rule.minTargets,
                max: rule.maxTargets
            } : null,
            effects: context => {
                if (rule.buildEffects) {
                    return rule.buildEffects(sourceId, context);
                }
                const legalTargets = getActivatedTargets(context.state, sourceId);
                const selectedTargets = rule.allEnemies ? legalTargets : context.selection;
                if (rule.damage !== null) {
                    return [{
                        kind: GameEngine.EFFECT_KINDS.APPLY_DAMAGE_BATCH,
                        sourceId,
                        targetIds: selectedTargets,
                        amount: rule.damage,
                        damageType: 'ability',
                        abilityId: rule.abilityId,
                        provenance: { kind: 'ability', sourceId, abilityId: rule.abilityId }
                    }];
                }

                const targetId = selectedTargets[0];
                const effectPrefix = `${sourceId}:${rule.abilityId}:${context.state.turn}:${targetId}`;
                return ['attack', 'defense'].map(stat => ({
                    kind: GameEngine.EFFECT_KINDS.ADD_MODIFIER,
                    targetId,
                    modifier: {
                        id: `${effectPrefix}:${stat}`,
                        sourceId,
                        stat,
                        operation: GameEngine.MODIFIER_OPERATIONS.ADD,
                        value: -5,
                        duration: {
                            kind: GameEngine.DURATION_KINDS.PERMANENT_ON_INSTANCE
                        }
                    }
                }));
            }
        };
        if (!action.choice) delete action.choice;
        return action;
    }

    function activateAbility(engine, sourceId, targetIds) {
        const action = createActivatedAbilityAction(engine.state, sourceId);
        if (!action) return { status: 'rejected', reason: 'Habilidade não registrada' };
        if (action.choice && targetIds !== undefined) {
            const selectedTargets = Array.isArray(targetIds) ? targetIds : [targetIds];
            const legalTargets = getActivatedTargets(engine.state, sourceId);
            if (
                selectedTargets.length < action.choice.min ||
                selectedTargets.length > action.choice.max
            ) {
                return {
                    status: 'rejected',
                    reason: `Escolha exige entre ${action.choice.min} e ${action.choice.max} alvo(s)`
                };
            }
            if (new Set(selectedTargets).size !== selectedTargets.length) {
                return { status: 'rejected', reason: 'A escolha contém alvos repetidos' };
            }
            if (selectedTargets.some(targetId => !legalTargets.includes(targetId))) {
                return { status: 'rejected', reason: 'A escolha contém alvo inválido' };
            }
        }
        const pending = engine.resolveAction(action);
        if (!action.choice) return pending;
        if (pending.status !== 'pending_choice') return pending;
        if (targetIds === undefined) return pending;
        return engine.resolveChoice(pending.choiceId, targetIds);
    }

    function createEquipmentEffects(equipment, targetId, state) {
        const rule = getEquipmentRule(equipment.definitionId);
        if (!rule) return null;

        const modifierEffects = Object.entries(rule.modifiers).map(([stat, value]) => ({
            kind: GameEngine.EFFECT_KINDS.ADD_MODIFIER,
            targetId,
            modifier: {
                id: `${equipment.instanceId}:${stat}`,
                sourceId: equipment.instanceId,
                stat,
                operation: rule.modifierOperations?.[stat] || GameEngine.MODIFIER_OPERATIONS.ADD,
                value,
                duration: {
                    kind: GameEngine.DURATION_KINDS.UNTIL_SOURCE_LEAVES,
                    sourceId: equipment.instanceId
                }
            }
        }));
        const additionalEffects = rule.effects ? rule.effects(equipment, targetId, state) : [];
        return [...modifierEffects, ...additionalEffects];
    }

    function createRecentlySummonedEffect(event, context) {
        const effectId = `recently_summoned:${event.payload.cardId}:${context.state.turn}`;
        if (context.state.effects.some(effect => effect.id === effectId)) return [];

        return [{
            kind: GameEngine.EFFECT_KINDS.ADD_EFFECT,
            effect: {
                id: effectId,
                effectType: 'RECENTLY_SUMMONED',
                targetId: event.payload.cardId,
                duration: {
                    kind: GameEngine.DURATION_KINDS.UNTIL_END_OF_OPPONENT_TURN,
                    controllerId: event.payload.playerId
                }
            }
        }];
    }

    function createProtectionEffects(event, context) {
        const card = context.state.cardInstances[event.payload.cardId];
        if (card?.definitionId !== 'card_086') return [];
        return [{
            kind: GameEngine.EFFECT_KINDS.ADD_EFFECT,
            effect: {
                id: `solar_barrier:${card.instanceId}:${context.state.turn}`,
                effectType: 'SOLAR_BARRIER',
                sourceId: card.instanceId,
                targetId: card.instanceId,
                playerId: card.controllerId,
                duration: {
                    kind: GameEngine.DURATION_KINDS.UNTIL_END_OF_OPPONENT_TURN,
                    controllerId: card.controllerId
                }
            }
        }];
    }

    function preventMigratedEffect(context) {
        const { state, effect, provenance, target, playerId } = context;
        if (provenance.kind === 'system') return null;
        const sourceIsCreature = ['criatura', 'evolução'].includes(provenance.sourceType);
        const isAbility = provenance.kind === 'ability';
        const isCardDamage = effect.kind === GameEngine.EFFECT_KINDS.APPLY_CARD_DAMAGE &&
            effect.amount > 0;
        const isPlayerDamage = effect.kind === GameEngine.EFFECT_KINDS.CHANGE_PLAYER_STAT &&
            effect.stat === 'pv' && effect.amount < 0 && effect.changeType === 'damage';

        if (
            target?.definitionId === 'card_048' &&
            isAbility &&
            sourceIsCreature &&
            provenance.sourceCost < 4
        ) {
            return { prevented: true, preventionId: `turtol:${target.instanceId}` };
        }

        if (
            target?.definitionId === 'card_065' &&
            isAbility &&
            provenance.sourceControllerId !== target.controllerId
        ) {
            return { prevented: true, preventionId: `iron_dragon:${target.instanceId}` };
        }

        if (
            target?.definitionId === 'card_073' &&
            isAbility &&
            isCardDamage &&
            sourceIsCreature &&
            provenance.sourceControllerId !== target.controllerId
        ) {
            return { prevented: true, preventionId: `stone_skin:${target.instanceId}` };
        }

        const barrier = state.effects.find(activeEffect =>
            activeEffect.effectType === 'SOLAR_BARRIER' &&
            (activeEffect.targetId === target?.instanceId || activeEffect.playerId === playerId)
        );
        if (
            barrier &&
            (isCardDamage || isPlayerDamage) &&
            sourceIsCreature &&
            provenance.sourceAttack <= 30
        ) {
            return { prevented: true, preventionId: barrier.id };
        }

        return null;
    }

    function createStateRuleEffects(card) {
        const rule = getStateRule(card.definitionId);
        if (!rule) return [];

        return rule.modifiers
            .filter(modifier => !card.modifiers.some(existing =>
                existing.id === `state:${card.instanceId}:${modifier.stat}`
            ))
            .map(modifier => ({
                kind: GameEngine.EFFECT_KINDS.ADD_MODIFIER,
                targetId: card.instanceId,
                modifier: {
                    id: `state:${card.instanceId}:${modifier.stat}`,
                    sourceId: card.instanceId,
                    stat: modifier.stat,
                    operation: modifier.operation,
                    value: (context, state, source) => modifier.value(state, source),
                    condition: (context, state, source) =>
                        source.zone === 'field' && modifier.condition(state, source),
                    duration: {
                        kind: GameEngine.DURATION_KINDS.PERMANENT_ON_INSTANCE
                    }
                }
            }));
    }

    function createRobotModifier(source, target, stat, value, prefix) {
        const modifierId = `${prefix}:${source.instanceId}:${target.instanceId}:${stat}`;
        if (target.modifiers.some(modifier => modifier.id === modifierId)) return null;
        const requiredSourceZone = source.definitionId === 'card_098' ? 'equipment' : 'field';

        return {
            kind: GameEngine.EFFECT_KINDS.ADD_MODIFIER,
            targetId: target.instanceId,
            modifier: {
                id: modifierId,
                sourceId: source.instanceId,
                stat,
                operation: GameEngine.MODIFIER_OPERATIONS.ADD,
                value,
                condition: (context, state, currentTarget) => {
                    const currentSource = state.cardInstances[source.instanceId];
                    const robots = allyCreatures(state, currentTarget)
                        .filter(card => hasTrait(card, 'robotico'));
                    return currentSource?.zone === requiredSourceZone &&
                        currentTarget.zone === 'field' &&
                        hasTrait(currentTarget, 'robotico') &&
                        robots.length >= 2;
                },
                duration: {
                    kind: GameEngine.DURATION_KINDS.UNTIL_SOURCE_LEAVES,
                    sourceId: source.instanceId
                }
            }
        };
    }

    function createRobotSynergyEffects(state, equipment = null, equipmentTargetId = null) {
        const effects = [];
        const k023Sources = allFieldCreatures(state)
            .filter(card => card.definitionId === 'card_033');

        k023Sources.forEach(source => {
            allyCreatures(state, source)
                .filter(card => hasTrait(card, 'robotico'))
                .forEach(target => {
                    const effect = createRobotModifier(source, target, 'attack', 5, 'k023');
                    if (effect) effects.push(effect);
                });
        });

        const devices = equipment
            ? [equipment]
            : ['p1', 'p2'].flatMap(playerId => state.players[playerId].zones.equipment)
                .filter(card => card.definitionId === 'card_098');
        devices.forEach(device => {
            const host = state.cardInstances[equipmentTargetId || device.attachedTo];
            if (!host || !hasTrait(host, 'robotico')) return;
            allyCreatures(state, host)
                .filter(card => hasTrait(card, 'robotico'))
                .forEach(target => {
                    ['attack', 'defense'].forEach(stat => {
                        const effect = createRobotModifier(
                            device,
                            target,
                            stat,
                            5,
                            'sync_device'
                        );
                        if (effect) effects.push(effect);
                    });
                });
        });

        return effects;
    }

    function modifyCombat(combatId, field, operation, value) {
        return {
            kind: GameEngine.EFFECT_KINDS.MODIFY_COMBAT,
            combatId,
            field,
            operation,
            value
        };
    }

    function install(engine) {
        if (!engine?.registerEventHandler) {
            throw new Error('Engine inválido para registro de habilidades');
        }

        const unregisterSummon = engine.registerEventHandler(
            GameEngine.EVENT_TYPES.CREATURE_SUMMONED,
            (event, context) => {
                const card = context.state.cardInstances[event.payload.cardId];
                const rule = card ? getRule(card.definitionId) : null;
                return [
                    ...createRecentlySummonedEffect(event, context),
                    ...createProtectionEffects(event, context),
                    ...(card ? createStateRuleEffects(card) : []),
                    ...createRobotSynergyEffects(context.state),
                    ...(rule ? rule.resolve(event, context) : [])
                ];
            }
        );

        const unregisterCombat = engine.registerEventHandler(
            GameEngine.EVENT_TYPES.BEFORE_DAMAGE,
            (event, context) => {
                const attacker = context.state.cardInstances[event.payload.attackerId];
                if (!attacker) return [];
                const effects = [];
                const combatId = event.payload.combatId;
                const target = context.state.cardInstances[event.payload.targetId];
                const damageField = event.payload.isDirect ? 'directDamage' : 'damageToTarget';
                let ignoredDefense = null;

                if (attacker.definitionId === 'card_017' && event.payload.attackOrdinal === 1) {
                    effects.push(modifyCombat(
                        combatId,
                        damageField,
                        GameEngine.MODIFIER_OPERATIONS.ADD,
                        10
                    ));
                }

                if (attacker.definitionId === 'card_019' && event.payload.targetId) {
                    const targetIsRecent = context.state.effects.some(effect =>
                        effect.effectType === 'RECENTLY_SUMMONED' &&
                        effect.targetId === event.payload.targetId
                    );
                    if (targetIsRecent) {
                        effects.push(
                            {
                                kind: GameEngine.EFFECT_KINDS.MODIFY_COMBAT,
                                combatId,
                                field: 'attackPower',
                                operation: GameEngine.MODIFIER_OPERATIONS.ADD,
                                value: 10
                            },
                            {
                                kind: GameEngine.EFFECT_KINDS.MODIFY_COMBAT,
                                combatId,
                                field: 'damageToTarget',
                                operation: GameEngine.MODIFIER_OPERATIONS.ADD,
                                value: 10
                            }
                        );
                    }
                }

                if (
                    attacker.definitionId === 'card_021' &&
                    target &&
                    event.payload.targetDefenseBefore > event.payload.attackPower
                ) {
                    effects.push(
                        modifyCombat(combatId, 'attackPower', GameEngine.MODIFIER_OPERATIONS.MULTIPLY, 2),
                        modifyCombat(combatId, 'damageToTarget', GameEngine.MODIFIER_OPERATIONS.MULTIPLY, 2)
                    );
                }

                if (attacker.definitionId === 'card_022' && target) {
                    ignoredDefense = Number.POSITIVE_INFINITY;
                }

                if (attacker.definitionId === 'card_032' && target) {
                    const attackerDefense = Math.max(
                        0,
                        context.getEffectiveStat(attacker.instanceId, 'defense') - attacker.damage
                    );
                    if (event.payload.targetDefenseBefore < attackerDefense) {
                        effects.push(modifyCombat(
                            combatId,
                            'damageToTarget',
                            GameEngine.MODIFIER_OPERATIONS.ADD,
                            10
                        ));
                    }
                }

                if (
                    attacker.definitionId === 'card_056' &&
                    target &&
                    event.payload.attackOrdinal === 1
                ) {
                    ignoredDefense = Number.POSITIVE_INFINITY;
                }

                if (attacker.definitionId === 'card_064' && target) {
                    const robots = allyCreatures(context.state, attacker)
                        .filter(card => hasTrait(card, 'robotico')).length;
                    ignoredDefense = robots * 10;
                }

                if (attacker.definitionId === 'card_066' && event.payload.attackOrdinal === 1) {
                    effects.push(
                        modifyCombat(combatId, 'attackPower', GameEngine.MODIFIER_OPERATIONS.MULTIPLY, 2),
                        modifyCombat(combatId, damageField, GameEngine.MODIFIER_OPERATIONS.MULTIPLY, 2)
                    );
                }

                if (
                    attacker.definitionId === 'card_070' &&
                    target &&
                    event.payload.attackOrdinal === 1
                ) {
                    ignoredDefense = 10;
                }

                if (attacker.definitionId === 'card_076') {
                    const reducedAttack = Math.max(0, event.payload.attackPower - 15);
                    effects.push(
                        modifyCombat(combatId, 'attackPower', GameEngine.MODIFIER_OPERATIONS.SET, reducedAttack),
                        modifyCombat(combatId, damageField, GameEngine.MODIFIER_OPERATIONS.SET, reducedAttack)
                    );
                }

                const attachedDefinitions = attacker.attachments
                    .map(instanceId => context.state.cardInstances[instanceId])
                    .filter(attachment =>
                        attachment?.zone === 'equipment' &&
                        attachment.attachedTo === attacker.instanceId
                    )
                    .map(attachment => attachment.definitionId)
                    .filter(Boolean);
                const halfSecondAttack = event.payload.attackOrdinal === 2 && (
                    attacker.definitionId === 'card_047' ||
                    attachedDefinitions.includes('card_096') ||
                    attachedDefinitions.includes('card_100')
                );
                if (halfSecondAttack) {
                    effects.push(
                        modifyCombat(
                            combatId,
                            'attackPower',
                            GameEngine.MODIFIER_OPERATIONS.SET,
                            combat => Math.floor(combat.attackPower / 2)
                        ),
                        modifyCombat(
                            combatId,
                            damageField,
                            GameEngine.MODIFIER_OPERATIONS.SET,
                            combat => Math.floor(combat[damageField] / 2)
                        )
                    );
                }

                if (attacker.definitionId === 'card_063' && event.payload.isDirect) {
                    effects.push(
                        modifyCombat(
                            combatId,
                            'attackPower',
                            GameEngine.MODIFIER_OPERATIONS.SET,
                            combat => Math.floor(combat.attackPower / 2)
                        ),
                        modifyCombat(
                            combatId,
                            'directDamage',
                            GameEngine.MODIFIER_OPERATIONS.SET,
                            combat => Math.floor(combat.directDamage / 2)
                        )
                    );
                }

                const targetIsHunterMatchup = target && (
                    hasTrait(target, 'vampiro') || hasTrait(target, 'lobisomem')
                );
                if (targetIsHunterMatchup && attachedDefinitions.includes('card_102')) {
                    effects.push(
                        modifyCombat(combatId, 'attackPower', GameEngine.MODIFIER_OPERATIONS.ADD, 10),
                        modifyCombat(combatId, 'damageToTarget', GameEngine.MODIFIER_OPERATIONS.ADD, 10)
                    );
                }
                if (target && hasTrait(target, 'fogo') && attachedDefinitions.includes('card_105')) {
                    effects.push(modifyCombat(
                        combatId,
                        'damageToTarget',
                        GameEngine.MODIFIER_OPERATIONS.ADD,
                        15
                    ));
                }

                if (attacker.definitionId === 'card_078' && target) {
                    ignoredDefense = 20;
                }

                if (target?.definitionId === 'card_074') {
                    effects.push(modifyCombat(
                        combatId,
                        'damageToTarget',
                        GameEngine.MODIFIER_OPERATIONS.ADD,
                        -10
                    ));
                }
                const hasNanoArmor = target && context.state.effects.some(effect =>
                    effect.effectType === 'NANO_ARMOR' && effect.targetId === target.instanceId
                );
                if (hasNanoArmor && attacker.data.cost >= 8) {
                    effects.push(modifyCombat(
                        combatId,
                        'damageToTarget',
                        GameEngine.MODIFIER_OPERATIONS.ADD,
                        -10
                    ));
                }

                if (ignoredDefense !== null && target) {
                    effects.push(modifyCombat(
                        combatId,
                        'penetratingDamage',
                        GameEngine.MODIFIER_OPERATIONS.SET,
                        combat => {
                            if (ignoredDefense === Number.POSITIVE_INFINITY) {
                                return Math.max(0, combat.damageToTarget);
                            }
                            const effectiveDefense = Math.max(
                                0,
                                combat.targetDefenseBefore - ignoredDefense
                            );
                            return Math.max(0, combat.damageToTarget - effectiveDefense);
                        }
                    ));
                }

                return effects;
            }
        );

        const unregisterProtection = engine.registerEffectInterceptor(
            preventMigratedEffect,
            100
        );

        const unregisterAfterAttack = engine.registerEventHandler(
            GameEngine.EVENT_TYPES.AFTER_ATTACK,
            (event, context) => {
                const attacker = context.state.cardInstances[event.payload.attackerId];
                if (
                    attacker?.definitionId !== 'card_076' ||
                    !event.payload.defeated?.includes(event.payload.targetId)
                ) {
                    return [];
                }
                return [{
                    kind: GameEngine.EFFECT_KINDS.ADD_MODIFIER,
                    targetId: attacker.instanceId,
                    modifier: {
                        id: `carmilla_kill:${event.payload.combatId}`,
                        sourceId: attacker.instanceId,
                        stat: 'attack',
                        operation: GameEngine.MODIFIER_OPERATIONS.ADD,
                        value: 10,
                        duration: { kind: GameEngine.DURATION_KINDS.PERMANENT_ON_INSTANCE }
                    }
                }];
            }
        );

        const unregisterTargetReaction = engine.registerEventHandler(
            GameEngine.EVENT_TYPES.BECAME_ATTACK_TARGET,
            (event, context) => {
                const effects = [];
                const target = context.state.cardInstances[event.payload.targetId];
                if (target?.definitionId === 'card_071') {
                    effects.push({
                        kind: GameEngine.EFFECT_KINDS.APPLY_CARD_DAMAGE,
                        targetId: event.payload.attackerId,
                        amount: 10,
                        provenance: {
                            kind: 'ability',
                            sourceId: target.instanceId,
                            abilityId: 'acid_skin'
                        }
                    });
                }
                const attacker = context.state.cardInstances[event.payload.attackerId];
                const solarMantleId = target?.attachments.find(attachmentId => {
                    const attachment = context.state.cardInstances[attachmentId];
                    return attachment?.definitionId === 'card_095' &&
                        attachment.zone === 'equipment' &&
                        attachment.attachedTo === target.instanceId;
                });
                if (
                    solarMantleId &&
                    attacker &&
                    (hasTrait(attacker, 'vampiro') || hasTrait(attacker, 'lobisomem'))
                ) {
                    effects.push({
                        kind: GameEngine.EFFECT_KINDS.APPLY_CARD_DAMAGE,
                        targetId: attacker.instanceId,
                        amount: 15,
                        provenance: {
                            kind: 'ability',
                            sourceId: solarMantleId,
                            abilityId: 'solar_mantle_reflection'
                        }
                    });
                }
                const shield = context.state.effects.find(effect =>
                    effect.effectType === 'MAGIC_SHIELD' &&
                    effect.targetId === event.payload.targetId
                );
                const attackerAttachments = (attacker?.attachments || [])
                    .map(instanceId => context.state.cardInstances[instanceId])
                    .filter(attachment =>
                        attachment?.zone === 'equipment' &&
                        attachment.attachedTo === attacker.instanceId
                    )
                    .map(attachment => attachment.definitionId)
                    .filter(Boolean);
                const bypassesAllShields = attackerAttachments.includes('card_097');
                const bypassesUntouchableShield = bypassesAllShields || attackerAttachments.includes('card_101');
                if (shield && !bypassesAllShields) {
                    effects.push({
                        kind: GameEngine.EFFECT_KINDS.MODIFY_COMBAT,
                        combatId: event.payload.combatId,
                        field: 'cancelled',
                        value: true
                    }, {
                        kind: GameEngine.EFFECT_KINDS.REMOVE_EFFECT,
                        effectId: shield.id
                    });
                }
                const untouchableShield = context.state.effects.find(effect =>
                    effect.effectType === 'UNTOUCHABLE_SHIELD' &&
                    effect.targetId === event.payload.targetId
                );
                if (untouchableShield && !bypassesUntouchableShield) {
                    effects.push({
                        kind: GameEngine.EFFECT_KINDS.MODIFY_COMBAT,
                        combatId: event.payload.combatId,
                        field: 'cancelled',
                        value: true
                    }, {
                        kind: GameEngine.EFFECT_KINDS.REMOVE_EFFECT,
                        effectId: untouchableShield.id
                    });
                }
                return effects;
            },
            100
        );

        const unregisterDamageReaction = engine.registerEventHandler(
            GameEngine.EVENT_TYPES.DAMAGE_DEALT,
            (event, context) => {
                const damaged = context.state.cardInstances[event.payload.damagedId];
                if (
                    damaged?.definitionId !== 'card_030' ||
                    event.payload.damageType !== 'physical' ||
                    event.payload.amount <= 0 ||
                    !event.payload.sourceId
                ) {
                    return [];
                }
                return [{
                    kind: GameEngine.EFFECT_KINDS.APPLY_CARD_DAMAGE,
                    targetId: event.payload.sourceId,
                    amount: Math.floor(event.payload.amount / 2),
                    provenance: {
                        kind: 'ability',
                        sourceId: damaged.instanceId,
                        abilityId: 'reflect_half_damage'
                    }
                }];
            }
        );

        const unregisterDeathReplacement = engine.registerEventHandler(
            GameEngine.EVENT_TYPES.CREATURE_WOULD_DIE,
            (event, context) => {
                const card = context.state.cardInstances[event.payload.cardId];
                if (card?.definitionId !== 'card_042' || card.zone !== 'field') return [];
                const preventionField = card.instanceId === event.payload.attackerId
                    ? 'preventAttackerDeath'
                    : 'preventTargetDeath';
                return [
                    modifyCombat(
                        event.payload.combatId,
                        preventionField,
                        GameEngine.MODIFIER_OPERATIONS.SET,
                        true
                    ),
                    {
                        kind: GameEngine.EFFECT_KINDS.APPLY_CARD_DAMAGE,
                        targetId: card.instanceId,
                        amount: -card.damage,
                        provenance: {
                            kind: 'ability',
                            sourceId: card.instanceId,
                            abilityId: 'ghost_evasion'
                        }
                    },
                    {
                        kind: GameEngine.EFFECT_KINDS.MOVE_CARD,
                        instanceId: card.instanceId,
                        destinationZone: 'hand',
                        destinationPlayerId: card.ownerId
                    }
                ];
            },
            100
        );

        const unregisterDefeatReaction = engine.registerEventHandler(
            GameEngine.EVENT_TYPES.CREATURE_DEFEATED,
            (event, context) => {
                const source = context.state.cardInstances[event.payload.sourceId];
                if (!source) return [];
                const effects = [];

                if (source.definitionId === 'card_029' && source.zone === 'field') {
                    effects.push({
                        kind: GameEngine.EFFECT_KINDS.ADD_MODIFIER,
                        targetId: source.instanceId,
                        modifier: {
                            id: `aladar_extra_attack:${event.payload.combatId}`,
                            sourceId: source.instanceId,
                            stat: 'attackLimit',
                            operation: GameEngine.MODIFIER_OPERATIONS.ADD,
                            value: 1,
                            duration: {
                                kind: GameEngine.DURATION_KINDS.UNTIL_END_OF_TURN,
                                playerId: source.controllerId,
                                turnNumber: context.state.turn
                            }
                        }
                    });
                }

                if (['card_036', 'card_052'].includes(source.definitionId)) {
                    effects.push({
                        kind: GameEngine.EFFECT_KINDS.CHANGE_PLAYER_STAT,
                        stat: 'pv',
                        playerId: event.payload.defeatedControllerId,
                        amount: -10,
                        changeType: 'damage',
                        provenance: {
                            kind: 'ability',
                            sourceId: source.instanceId,
                            abilityId: 'damage_after_defeat'
                        }
                    });
                }

                if (source.definitionId === 'card_054') {
                    const limit = { kind: GameEngine.LIMIT_KINDS.PER_TURN, count: 1 };
                    if (context.canUseAbility(source.instanceId, 'life_drain', limit)) {
                        const amount = Math.min(
                            10,
                            context.getPlayerStat(event.payload.defeatedControllerId, 'pv')
                        );
                        if (amount > 0) {
                            effects.push(
                                {
                                    kind: GameEngine.EFFECT_KINDS.CHANGE_PLAYER_STAT,
                                    stat: 'pv',
                                    playerId: event.payload.defeatedControllerId,
                                    amount: -amount,
                                    changeType: 'damage',
                                    provenance: {
                                        kind: 'ability',
                                        sourceId: source.instanceId,
                                        abilityId: 'life_drain'
                                    }
                                },
                                {
                                    kind: GameEngine.EFFECT_KINDS.CHANGE_PLAYER_STAT,
                                    stat: 'pv',
                                    playerId: event.payload.sourceControllerId,
                                    amount
                                },
                                {
                                    kind: GameEngine.EFFECT_KINDS.RECORD_ABILITY_USE,
                                    sourceId: source.instanceId,
                                    abilityId: 'life_drain',
                                    limit
                                }
                            );
                        }
                    }
                }

                return effects;
            }
        );

        const unregisterDestroyedReaction = engine.registerEventHandler(
            GameEngine.EVENT_TYPES.CREATURE_DESTROYED,
            (event, context) => {
                const auraId = event.payload.attachmentsSnapshot?.find(attachmentId =>
                    context.state.cardInstances[attachmentId]?.definitionId === 'card_108'
                );
                if (!auraId) return [];
                const opponentId = event.payload.controllerId === 'p1' ? 'p2' : 'p1';
                return [{
                    kind: GameEngine.EFFECT_KINDS.CHANGE_PLAYER_STAT,
                    stat: 'pv',
                    playerId: opponentId,
                    amount: -event.payload.attackSnapshot,
                    changeType: 'damage',
                    provenance: {
                        kind: 'ability',
                        sourceId: auraId,
                        abilityId: 'vengeance_aura'
                    }
                }];
            }
        );

        const unregisterTurnCleanup = engine.registerEventHandler(
            GameEngine.EVENT_TYPES.TURN_ENDED,
            (event, context) => context.state.effects
                .filter(effect =>
                    effect.effectType === 'DIRECT_ATTACK_PERMISSION' &&
                    effect.expiresPlayerId === event.payload.playerId &&
                    event.payload.turnNumber >= effect.expiresTurnNumber
                )
                .map(effect => ({
                    kind: GameEngine.EFFECT_KINDS.REMOVE_EFFECT,
                    effectId: effect.id
                }))
        );

        return function uninstall() {
            unregisterSummon();
            unregisterCombat();
            unregisterProtection();
            unregisterAfterAttack();
            unregisterTargetReaction();
            unregisterDamageReaction();
            unregisterDeathReplacement();
            unregisterDefeatReaction();
            unregisterDestroyedReaction();
            unregisterTurnCleanup();
        };
    }

    const migratedDefinitionIds = [
        ...Object.keys(SUMMON_RULES),
        ...Object.keys(EQUIPMENT_RULES),
        ...Object.keys(COMBAT_RULES),
        ...Object.keys(ACTIVATED_RULES),
        ...Object.keys(TARGET_RULES),
        ...Object.keys(STATE_RULES),
        ...Object.keys(PROTECTION_RULES),
        ...DIRECT_ATTACK_DEFINITION_IDS
    ];

    return {
        SUMMON_RULES,
        EQUIPMENT_RULES,
        COMBAT_RULES,
        ACTIVATED_RULES,
        TARGET_RULES,
        STATE_RULES,
        PROTECTION_RULES,
        DIRECT_ATTACK_DEFINITION_IDS,
        TRAITS_BY_DEFINITION,
        MIGRATED_DEFINITION_IDS: Object.freeze(migratedDefinitionIds),
        getRule,
        getEquipmentRule,
        getCombatRule,
        getActivatedRule,
        getTargetRule,
        getStateRule,
        getProtectionRule,
        getFeedback,
        isMigrated,
        validateEquipmentTarget,
        validateAttackTarget,
        canDirectAttack,
        hasTrait,
        getActivatedTargets,
        createActivatedAbilityAction,
        activateAbility,
        createEquipmentEffects,
        install
    };
});