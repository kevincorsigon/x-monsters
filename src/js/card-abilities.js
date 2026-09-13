/**
 * Sistema de H    onCardSummoned(cardId, cardData, playerId) {
        console.log(`👑 Ativando habilidade de invocação: ${cardData.name}`);
        
        switch(cardData.id) {
            case 'card_012': // Natalino
                this.natalino_healAllies(playerId);
                break;
            case 'card_013': // Zol
                this.zol_drawCard(playerId);
                break;
            case 'card_023': // Raylaser
                this.raylaser_directDamage(playerId);
                break;
            case 'card_014': // Tobinha e Boguinha
                this.tobinhaBoguinha_cuteness(cardId);
                break;
            case 'card_016': // Baltz
                this.baltz_removeSupport(playerId);
                break;
            case 'card_018': // CP-2
                this.cp2_taunt(cardId);
                break;
            case 'card_025': // Zé Mulherzinha
                this.zeMulherzinha_protection(cardId, playerId);
                break;
            case 'card_040': // Little Big Shimbard
                this.littleBigShimbard_soloDefense(cardId, playerId);
                break;
            case 'card_043': // Goblin Mestre de Armas
                this.goblinMestre_doubleAttack(cardId, playerId);
                break;
            case 'card_044': // Grifo Real
                this.grifoReal_flyHigh(cardId);
                break;
            case 'card_045': // Invocador das Trevas
                this.invocadorTrevas_summonDiabrete(playerId);
                break;
            case 'card_048': // Turtol
                this.turtol_abilityImmunity(cardId);
                break;
            case 'card_049': // Entola Guela
                this.entolaGuela_chooseTarget(cardId, null);
                break;
            case 'card_050': // Shupáku
                this.shupaku_permanentParalyze(cardId, null);
                break;
            case 'card_051': // Dino Elétrico
                this.dinoEletrico_shockDischarge(cardId, playerId);
                break;
            case 'card_053': // Gárgula de Rocha
                this.gargulaRocha_immunity(cardId);
                break;
            case 'card_058': // Sábio da Montanha
                this.sabioMontanha_evasion(cardId, playerId);
                break;
            case 'card_059': // O Lica
                this.oLica_lycanthropyProtection(cardId, playerId);
                break;
            case 'card_060': // Tranca Rua
                this.trancaRua_forceTarget(cardId, playerId);
                break;
            case 'card_062': // Alucard
                this.alucard_resurrect(cardId, null, playerId);
                break;
            case 'card_065': // Iron Dragon
                this.ironDragon_abilityImmunity(cardId);
                break;
            case 'card_068': // Paladino Crepuscular
                this.paladinoCrepuscular_shadowShield(cardId, playerId);
                break;
            case 'card_072': // Gigante da Marreta
                this.gigante_earthquake(cardId, playerId);
                break;
            case 'card_073': // Golem de Pedra
                this.golemPedra_stoneSkin(cardId);
                break;
            case 'card_074': // Nucles
                this.nucles_attackReduction(cardId);
                break;
            case 'card_075': // Turtol Maximus
                this.turtolMaximus_soloDefenseBonus(cardId, playerId);
                break;
            case 'card_077': // Marik
                this.marik_enemyBonus(cardId, playerId);
                break;
            case 'card_078': // Lobo Alfa Fly
                this.loboAlfaFly_aerialDominance(cardId);
                break;
            case 'card_079': // Lobo Beta Lightning
                this.loboBetaLightning_electricStrike(playerId);
                break;
            case 'card_084': // Imperial X
                this.imperialX_doubleStrike(cardId);
                break;
            case 'card_086': // Sentinela Solar
                this.sentinelaSolar_lightBarrier(cardId, playerId);
                break;
            case 'card_087': // Superior
                this.superior_doubleAttackRevive(cardId, null);
                break;
            case 'card_003': // ETC
                this.etc_returnLowCostCreatures(playerId);
                break;
            case 'card_010_1': // Diabrete Alado
            case 'card_010_2':
            case 'card_010_3':
                this.diableteAlado_directFlight(cardId);
                break;
            case 'card_011': // Kirb
                this.kirb_copyAbilities(cardId, playerId);
                break;
            case 'card_024': // Slipul
                this.slipul_soloBonus(cardId, playerId);
                break;
            case 'card_026': // Sabota Copos
                this.sabotaCopos_weakenOnce(cardId);
                break;
            case 'card_027': // Bilugatron
                this.bilugatron_attachDamage(cardId);
                break;
            case 'card_030': // Cacton
                this.cacton_reflectDamage(cardId);
                break;
            case 'card_031': // Duende
                this.duende_magicLuck(cardId, playerId);
                break;
            case 'card_032': // Hipool
                this.hipool_bonusDamage(cardId);
                break;
            case 'card_033': // K-023
                this.k023_robotSynergy(cardId, playerId);
                break;
            case 'card_034': // Medusa de Lama
                this.medusaLama_paralyze(cardId);
                break;
            case 'card_035': // Ptera
                this.ptera_directAttack(cardId);
                break;
            case 'card_037': // Scoul
                this.scoul_dragonBonus(cardId, playerId);
                break;
            case 'card_038': // Tlantidu
                this.tlantidu_searchAquatic(cardId, playerId);
                break;
            case 'card_039': // Trox
                this.trox_freeReturn(cardId, playerId);
                break;
            case 'card_041': // Gulosinho
                this.gulosinho_skipAttackBonus(cardId, playerId);
                break;
            case 'card_042': // Fantom
                this.fantom_ghostEvasion(cardId);
                break;
            case 'card_046': // Salatiel
                this.salatiel_ignoreDefense(cardId, playerId);
                break;
            case 'card_047': // Tobias
                this.tobias_doubleAttackWeakened(cardId);
                break;
            case 'card_052': // Dragão de Cobre
                this.dragaoCobre_damageOnKill(cardId);
                break;
            case 'card_054': // Lorde Sanguinário
                this.lordeSanguinario_lifeSteal(cardId);
                break;
            case 'card_055': // Mago Arcano
                this.magoArcano_manaBlast(cardId, playerId);
                break;
            case 'card_056': // Minotauro Guerreiro
                this.minotauroGuerreiro_ignorDefenseFirst(cardId);
                break;
            case 'card_057': // Quimera de Fogo
                this.quimeraFogo_tripleBreath(cardId, playerId);
                break;
            case 'card_061': // Alquimista Guardião
                this.alquimistaGuardiao_protectiveElixir(cardId, playerId);
                break;
            case 'card_063': // Beluga de Terracota
                this.belugaTerracota_halfDirectAttack(cardId);
                break;
            case 'card_064': // Gamaa
                this.gamaa_robotDefenseIgnore(cardId, playerId);
                break;
            case 'card_066': // Mexica
                this.mexica_doubleDamageFirst(cardId);
                break;
            case 'card_067': // Paladino Alvorada
                this.paladinoAlvorada_nullifyAbilities(cardId, playerId);
                break;
            case 'card_069': // Roller
                this.roller_returnOnDeath(cardId);
                break;
            case 'card_070': // Tiranossauro
                this.tiranossauro_frighteningRoar(cardId);
                break;
            case 'card_071': // Dragão de Jade
                this.dragaoJade_acidSkin(cardId);
                break;
            case 'card_076': // Condessa Carmilla
                this.condessaCarmilla_vampireAttack(cardId);
                break;
            case 'card_080': // Lobo Omega Pyro
                this.loboOmegaPyro_continuousBurn(cardId);
                break;
            case 'card_081': // Latex
                this.latex_attackAll(cardId);
                break;
            case 'card_082': // Lobo Gamma Freeze
                this.loboGammaFreeze_paralizeMultiple(cardId);
                break;
            case 'card_083': // Hidra das Profundezas
                this.hidraProfundezas_causticBreath(cardId);
                break;
            case 'card_085': // Marik 2
                this.marik2_attackAllLoseDefense(cardId);
                break;
            case 'card_020': // Gobra
                this.gobra_handReturnAbility(cardId, playerId);
                break;
            // Adicionar outras cartas que ativam ao serem invocadas
        }

        this.applyPassiveAbilities(cardId, cardData, playerId);
    }tas - X Monsters
 * 
 * Este arquivo contém todas as habilidades programáticas das cartas
 * Organizado por tipos de habilidades e momentos de ativação
 */

class CardAbilitiesSystem {
    constructor() {
        this.activeEffects = new Map(); // Efeitos ativos no jogo
        this.turnEffects = new Map(); // Efeitos que duram X turnos
        this.permanentEffects = new Map(); // Efeitos permanentes
        this.oneShotEffects = new Set(); // Efeitos únicos usados
    }

    // ========================================
    // SISTEMA DE TRIGGERS - QUANDO ATIVAR HABILIDADES
    // ========================================

    // Quando uma carta é invocada no campo
    onCardSummoned(cardId, cardData, playerId) {
        console.log(`🎴 Ativando habilidades de invocação: ${cardData.name}`);
        
        switch(cardData.id) {
            case 'card_012': // Natalino
                this.natalino_healAllies(playerId);
                break;
            case 'card_013': // Zol
                this.zol_drawCard(playerId);
                break;
            case 'card_023': // Raylaser
                this.raylaser_directDamage(playerId);
                break;
            // Adicionar outras cartas que ativam ao serem invocadas
        }

        this.applyPassiveAbilities(cardId, cardData, playerId);
    }

    // Quando uma carta de suporte é jogada (não equipada)
    onSupportCardPlayed(cardId, cardData, playerId, targetId = null) {
        console.log(`⚡ Ativando habilidade de suporte: ${cardData.name}`);
        
        switch(cardData.id) {
            case 'card_004': // Chocolicia
                this.chocolicia_weakenCreature(targetId);
                break;
            case 'card_006': // Adubaram
                this.adubaram_destroyAndDraw(playerId, targetId);
                break;
            case 'card_008': // Cara de cu estourado
                this.paralyzeCrea(targetId, 2);
                break;
            case 'card_009': // Abutuaram
                this.abutuaram_reduceDefense(targetId);
                break;
            case 'card_015': // 11 de setembro
                this.september11_devastate(targetId);
                break;
            case 'card_028': // Atravessava
                this.atravessava_pierce(playerId, targetId);
                break;
            // Adicionar outras cartas de suporte
        }
    }

    // Quando uma carta equipa outra
    onCardEquipped(equipmentId, equipmentData, targetId) {
        console.log(`🔧 Equipando: ${equipmentData.name} em criatura`);
        
        switch(equipmentData.id) {
            case 'card_001': // Espada Mágica
                this.espadaMagica_boost(targetId);
                break;
            case 'card_002': // Estrela Mágica
                this.estrelaMagica_shield(targetId);
                break;
            case 'card_005': // Zica do pantano
                this.zicaPantano_poison(targetId);
                break;
            case 'card_007': // Camisa 14 do América
                this.camisa14_boostAndSteal(targetId);
                break;
            case 'card_088': // Rego Freitas
                this.regoFreitas_flightRide(targetId);
                break;
            case 'card_089': // Apelino Pão e Vinho
                this.apelinoPaoVinho_multipleAttacks(targetId);
                break;
            case 'card_090': // Bilugação Astral
                this.bilugacaoAstral_intangible(targetId);
                break;
            case 'card_091': // Feitiço de Teletransporte
                this.feiticoTeletransporte_returnHand(targetId);
                break;
            case 'card_092': // Cajado da Ilusão
                this.cajadoIlusao_untouchable(targetId);
                break;
            case 'card_093': // Medalhão de Cura
                this.medalhaoCura_heal(targetId);
                break;
            case 'card_094': // Pena do Gigante
                this.penaGigante_blockAttack(targetId);
                break;
            case 'card_095': // Manto da Luz Solar
                this.mantoLuzSolar_vampireDamage(targetId);
                break;
            case 'card_096': // Machado do Vento
                this.machadoVento_doubleAttack(targetId);
                break;
            case 'card_097': // Flecha de Prata
                this.flechaPrata_ignoreDefenses(targetId);
                break;
            case 'card_098': // Dispositivo de Sincronia
                this.dispositivoSincronia_robotBoost(targetId);
                break;
            case 'card_099': // Tomo de Feitiços Ancestrais
                this.tomoFeiticos_drawCard(targetId);
                break;
            case 'card_100': // Botas da Rapidez
                this.botasRapidez_doubleAttack(targetId);
                break;
            case 'card_101': // Olho de Águia
                this.olhoAguia_ignoreEvasion(targetId);
                break;
            case 'card_102': // Estaca do Caçador
                this.estacaCacador_vampireBonus(targetId);
                break;
            case 'card_103': // Couraça de Nano-Carbono
                this.couracaNanoCarbono_damageReduction(targetId);
                break;
            case 'card_104': // Núcleo de Energia Pura
                this.nucleoEnergia_eliteBoost(targetId);
                break;
            case 'card_105': // Manoplas de Gelo
                this.manoplasGelo_fireDamage(targetId);
                break;
            case 'card_106': // Escudo de Energia Estável
                this.escudoEnergiaEstavel_energyGain(targetId);
                break;
            case 'card_107': // Lâmina Sagrada
                this.laminaSagrada_vampireIgnore(targetId);
                break;
            case 'card_108': // Aura de Vingança
                this.auraVinganca_revengeOnDeath(targetId);
                break;
            // Adicionar outros equipamentos
        }
    }

    // Durante fase de combate - antes do ataque
    onBeforeAttack(attackerId, defenderId) {
        const attacker = this.getCardById(attackerId);
        
        switch(attacker.data.id) {
            case 'card_017': // Bufaboi
                return this.bufaboi_firstAttackBonus(attackerId);
            case 'card_019': // Garras Afiadas
                return this.garrasAfiadas_sneakAttack(attackerId, defenderId);
            case 'card_021': // Paladar
                return this.paladar_doubleAgainstHighDefense(attackerId, defenderId);
            case 'card_022': // Puma da Selva
                return this.pumaSelva_ignoreDefense(attackerId, defenderId);
        }
        
        return { modifyAttack: 0, modifyDefense: 0, specialEffects: [] };
    }

    // Durante fase de combate - após o ataque
    onAfterAttack(attackerId, defenderId, damage, destroyed) {
        const attacker = this.getCardById(attackerId);
        
        if (destroyed) {
            switch(attacker.data.id) {
                case 'card_029': // Aladar
                    this.aladar_attackAgain(attackerId);
                    break;
                case 'card_036': // Rei das Feras
                    this.reiFeras_damagePlayer(attackerId, defenderId, damage);
                    break;
            }
        }
    }

    // ========================================
    // HABILIDADES ESPECÍFICAS DAS CARTAS
    // ========================================

    // === CARTAS DE SUPORTE (NÃO EQUIPÁVEIS) ===

    // Chocolicia - Aplica -10 ataque e defesa
    chocolicia_weakenCreature(targetId) {
        if (!targetId) return;
        
        const target = this.getCardById(targetId);
        if (target) {
            this.modifyCardStats(targetId, -10, -10);
            this.showAbilityFeedback(targetId, "💫 Chocolicia: -10 ATK/DEF");
        }
    }

    // Adubaram - Remove criatura e compra carta
    adubaram_destroyAndDraw(playerId, targetId) {
        if (targetId) {
            this.destroyCard(targetId);
            this.drawCard(playerId);
            this.showAbilityFeedback(targetId, "🗑️ Adubaram: Criatura destruída!");
        }
    }

    // Cara de cu estourado - Paralisa por 2 turnos
    paralyzeCrea(targetId, turns) {
        if (!targetId) return;
        
        this.addTurnEffect(targetId, 'paralyzed', turns, {
            canAttack: false,
            canDefend: false
        });
        this.showAbilityFeedback(targetId, `😵 Paralisado por ${turns} turnos`);
    }

    // Abutuaram - Reduz 15 de defesa
    abutuaram_reduceDefense(targetId) {
        if (!targetId) return;
        
        this.modifyCardStats(targetId, 0, -15);
        this.showAbilityFeedback(targetId, "🔻 Abutuaram: -15 DEF");
    }

    // 11 de setembro - Efeito devastador
    september11_devastate(targetId) {
        if (!targetId) return;
        
        this.addTurnEffect(targetId, 'devastated', 5, {
            canAttack: false,
            modifyAttack: -10,
            modifyDefense: -25
        });
        this.showAbilityFeedback(targetId, "🏢 11/09: Devastado por 5 turnos!");
    }

    // Atravessava - Permite ataque direto
    atravessava_pierce(playerId, targetId) {
        if (!targetId) return;
        
        this.addPermanentEffect(targetId, 'pierce_attack', {
            canAttackDirectly: true
        });
        this.showAbilityFeedback(targetId, "⚔️ Pode atacar diretamente!");
    }

    // === CARTAS DE SUPORTE (EQUIPÁVEIS) ===

    // Espada Mágica - +5 ATK/DEF
    espadaMagica_boost(targetId) {
        this.modifyCardStats(targetId, 5, 5);
        this.showAbilityFeedback(targetId, "⚔️ Espada Mágica: +5 ATK/DEF");
    }

    // Estrela Mágica - Anula próximo ataque
    estrelaMagica_shield(targetId) {
        this.addOneShotEffect(targetId, 'magic_shield', {
            nullifyNextAttack: true
        });
        this.showAbilityFeedback(targetId, "✨ Protegido contra próximo ataque!");
    }

    // Zica do pantano - Veneno por 3 turnos
    zicaPantano_poison(targetId) {
        this.addTurnEffect(targetId, 'poisoned', 3, {
            canMove: false,
            defenseReduction: 5 // Por turno
        });
        this.showAbilityFeedback(targetId, "☠️ Envenenado por 3 turnos!");
    }

    // Camisa 14 do América - Boost temporário + roubo
    camisa14_boostAndSteal(targetId) {
        // Boost temporário
        this.addTurnEffect(targetId, 'america_boost', 2, {
            modifyAttack: 10
        });
        
        // Permitir roubar criatura inimiga
        this.addOneShotEffect(targetId, 'steal_creature', {
            canStealMaxCost: 3
        });
        
        this.showAbilityFeedback(targetId, "🏆 América: +10 ATK por 2 turnos + poder de roubo!");
    }

    // === CRIATURAS COM HABILIDADES PASSIVAS ===

    // Natalino - Cura aliados ao ser invocado
    natalino_healAllies(playerId) {
        const allies = this.getAllyCreatures(playerId);
        allies.forEach(ally => {
            this.modifyCardStats(ally.id, 0, 10);
        });
        this.showAbilityFeedback(null, "🎄 Natalino: Todos os aliados +10 DEF!");
    }

    // Zol - Compra carta extra ao ser invocado
    zol_drawCard(playerId) {
        this.drawCard(playerId);
        this.showAbilityFeedback(null, "📚 Zol: Carta extra comprada!");
    }

    // Raylaser - 15 de dano direto ao ser invocado
    raylaser_directDamage(playerId) {
        const opponent = playerId === 'p1' ? 'p2' : 'p1';
        this.damagePlayer(opponent, 15);
        this.showAbilityFeedback(null, "⚡ Raylaser: 15 de dano direto!");
    }

    // === MAIS HABILIDADES DE CRIATURAS ===

    // Tobinha e Boguinha - Fofura: não podem ser atacados por criaturas com custo > 3
    tobinhaBoguinha_cuteness(cardId) {
        this.addPermanentEffect(cardId, 'cuteness_protection', {
            immuneToHighCostAttacks: true,
            maxAttackerCost: 3
        });
        this.showAbilityFeedback(cardId, "🐰 Fofura: Imune a criaturas caras!");
    }

    // Baltz - Remove cartas de suporte do oponente
    baltz_removeSupport(playerId) {
        const opponent = playerId === 'p1' ? 'p2' : 'p1';
        const enemyCreatures = this.getEnemyCreatures(playerId);
        
        enemyCreatures.forEach(creature => {
            if (creature.data.equipment && creature.data.equipment.length > 0) {
                // Remover equipamentos
                creature.data.equipment = [];
                // Reset stats (simplificado)
                this.showAbilityFeedback(creature.id, "💥 Suporte removido!");
            }
        });
        this.showAbilityFeedback(null, "🔧 Baltz: Suportes inimigos removidos!");
    }

    // Bufaboi - Primeiro ataque do turno causa +10 dano
    bufaboi_firstAttackBonus(cardId) {
        if (!this.hasUsedAbilityThisTurn(cardId, 'first_attack_bonus')) {
            this.addOneShotEffect(cardId, 'attack_bonus', {
                bonusAttack: 10
            });
            this.markAbilityUsed(cardId, 'first_attack_bonus');
            this.showAbilityFeedback(cardId, "🔥 Bufaboi: +10 ATK no primeiro ataque!");
        }
    }

    // CP-2 - Impede ataque de inimigos (taunt)
    cp2_taunt(cardId) {
        this.addPermanentEffect(cardId, 'taunt', {
            mustBeAttackedFirst: true
        });
        this.showAbilityFeedback(cardId, "🛡️ CP-2: Inimigos devem me atacar primeiro!");
    }

    // Garras Afiadas - Ataque furtivo (+10 ATK contra recém invocados)
    garrasAfiadas_sneakAttack(attackerId, targetId) {
        if (this.wasRecentlySummoned(targetId)) {
            this.modifyCardStats(attackerId, 10, 0);
            this.showAbilityFeedback(attackerId, "🗡️ Ataque Furtivo: +10 ATK!");
        }
    }

    // Gobra - Pode sair e voltar da mão 1x/turno  
    gobra_bounceAbility(cardId) {
        if (!this.hasUsedAbilityThisTurn(cardId, 'bounce')) {
            this.returnCardToHand(cardId);
            this.markAbilityUsed(cardId, 'bounce');
            this.showAbilityFeedback(null, "🔄 Gobra: Retornou à mão!");
        }
    }

    // Paladar - Dobra ataque contra monstros com defesa superior
    paladar_doubleDamage(attackerId, targetId) {
        const attacker = this.findCardById(attackerId);
        const target = this.findCardById(targetId);
        
        if (attacker && target && target.data.defense > attacker.data.defense) {
            this.addOneShotEffect(attackerId, 'double_attack', {
                doubleAttack: true
            });
            this.showAbilityFeedback(attackerId, "⚡ Paladar: Ataque dobrado!");
        }
    }

    // Puma da Selva - Ignora defesa e causa dano direto
    pumaSelva_pierceDefense(attackerId, targetId, playerId) {
        const attacker = this.findCardById(attackerId);
        const opponent = playerId === 'p1' ? 'p2' : 'p1';
        
        if (attacker) {
            // Causar dano direto ao jogador
            this.damagePlayer(opponent, attacker.data.attack);
            this.showAbilityFeedback(attackerId, "🐆 Puma: Ignora defesa - dano direto!");
        }
    }

    // Slipul - Se sozinho, ganha +5 ATK/DEF por criatura inimiga
    slipul_aloneBonus(cardId, playerId) {
        const allies = this.getAllyCreatures(playerId);
        const enemies = this.getEnemyCreatures(playerId);
        
        if (allies.length === 1) { // Apenas ele no campo
            const bonus = enemies.length * 5;
            this.modifyCardStats(cardId, bonus, bonus);
            this.showAbilityFeedback(cardId, `💪 Slipul: +${bonus} ATK/DEF (sozinho)!`);
        }
    }

    // Zé Mulherzinha - Não pode ser alvo direto enquanto houver aliados
    zeMulherzinha_protection(cardId, playerId) {
        const allies = this.getAllyCreatures(playerId);
        
        if (allies.length > 1) { // Tem outros aliados
            this.addPermanentEffect(cardId, 'ally_protection', {
                cannotBeTargeted: true
            });
            this.showAbilityFeedback(cardId, "🛡️ Zé Mulherzinha: Protegido por aliados!");
        }
    }

    // Sabota Copos - 1x/turno: -5 ATK/DEF em criatura oponente
    sabotaCopos_weaken(targetId, sourceCardId) {
        if (!this.hasUsedAbilityThisTurn(sourceCardId, 'sabota_weaken')) {
            this.modifyCardStats(targetId, -5, -5);
            this.markAbilityUsed(sourceCardId, 'sabota_weaken');
            this.showAbilityFeedback(targetId, "🍺 Sabota Copos: -5 ATK/DEF!");
        }
    }

    // Bilugatron - Gruda em criatura inimiga (10 dano/turno, mas não ataca)
    bilugatron_attach(sourceCardId, targetId) {
        this.addTurnEffect(targetId, 'biluga_attached', 99, {
            damagePerTurn: 10
        });
        
        this.addPermanentEffect(sourceCardId, 'attached_state', {
            canAttack: false,
            canDefend: false
        });
        
        this.showAbilityFeedback(sourceCardId, "🪱 Bilugatron: Grudado! 10 dano/turno!");
    }

    // === HABILIDADES DE CARTAS DE CUSTO MÉDIO/ALTO ===

    // Trox - Pode voltar à mão e ser invocado sem custo 1x/partida
    trox_freeReturn(cardId) {
        if (!this.hasUsedAbilityThisTurn(cardId, 'free_return_ever')) {
            this.returnCardToHand(cardId);
            this.addPermanentEffect(cardId, 'free_summon', {
                nextSummonFree: true
            });
            this.markAbilityUsed(cardId, 'free_return_ever');
            this.showAbilityFeedback(null, "🔄 Trox: Próxima invocação gratuita!");
        }
    }

    // Little Big Shimbard - Dobra defesa se sozinho no campo
    littleBigShimbard_soloDefense(cardId, playerId) {
        const allies = this.getAllyCreatures(playerId);
        
        if (allies.length === 1) { // Apenas ele
            const card = this.findCardById(cardId);
            if (card) {
                this.modifyCardStats(cardId, 0, card.data.defense); // Dobra defesa
                this.showAbilityFeedback(cardId, "🏰 Rolha de Poço: Defesa dobrada!");
            }
        }
    }

    // Gulosinho - Se não atacar no turno, ganha +5 ATK/DEF
    gulosinho_passiveBuff(cardId) {
        if (!this.hasUsedAbilityThisTurn(cardId, 'attacked_this_turn')) {
            this.modifyCardStats(cardId, 5, 5);
            this.showAbilityFeedback(cardId, "🍯 Gulosinho: +5 ATK/DEF por não atacar!");
        }
    }

    // Fantom - Evasão fantasmagórica (volta à mão se defesa = 0)
    fantom_ghostEvasion(cardId) {
        const card = this.findCardById(cardId);
        if (card && card.data.defense <= 0) {
            this.returnCardToHand(cardId);
            this.showAbilityFeedback(null, "👻 Fantom: Evasão fantasmagórica!");
            return true; // Evitou destruição
        }
        return false;
    }

    // Goblin Mestre de Armas - Dobra ataque se tem aliados baratos
    goblinMestre_doubleAttack(cardId, playerId) {
        const allies = this.getAllyCreatures(playerId);
        const hasLowCostAllies = allies.some(ally => ally.data.cost < 3);
        
        if (hasLowCostAllies) {
            const card = this.findCardById(cardId);
            if (card) {
                this.modifyCardStats(cardId, card.data.attack, 0); // Dobra ataque
                this.showAbilityFeedback(cardId, "⚔️ Mestre: Ataque dobrado!");
            }
        }
    }

    // Grifo Real - Voar Alto: imune a criaturas custo ≤ 4
    grifoReal_flyHigh(cardId) {
        this.addPermanentEffect(cardId, 'fly_high', {
            immuneToLowCostAttacks: true,
            maxAttackerCost: 4
        });
        this.showAbilityFeedback(cardId, "🦅 Grifo Real: Voa alto - imune a ataques fracos!");
    }

    // Invocador das Trevas - Invoca Diabrete Alado por 1 energia
    invocadorTrevas_summonDiabrete(playerId) {
        // Adicionar Diabrete Alado à mão por 1 energia
        this.showAbilityFeedback(null, "👹 Invocador: Diabrete Alado disponível por 1 energia!");
        // Implementação simplificada - na prática adicionaria carta à mão
    }

    // Salatiel - Paga 3 energia para ignorar defesa
    salatiel_ignoreDefense(cardId, playerId) {
        const currentEnergy = this.getPlayerEnergy(playerId);
        if (currentEnergy >= 3) {
            this.addOneShotEffect(cardId, 'ignore_defense', {
                ignoreDefense: true
            });
            this.changePlayerEnergy(playerId, -3);
            this.showAbilityFeedback(cardId, "💰 Salatiel: Defesa ignorada (-3 energia)!");
        }
    }

    // Tobias - Ataca duas vezes (segundo com metade do dano)
    tobias_doubleAttack(cardId) {
        this.addOneShotEffect(cardId, 'double_strike', {
            attacksThisTurn: 2,
            secondAttackHalfDamage: true
        });
        this.showAbilityFeedback(cardId, "⚡⚡ Tobias: Ataque duplo!");
    }

    // Turtol - Imune a habilidades de monstros com custo < 4
    turtol_abilityImmunity(cardId) {
        this.addPermanentEffect(cardId, 'ability_immunity', {
            immuneToLowCostAbilities: true,
            maxAbilityCost: 4
        });
        this.showAbilityFeedback(cardId, "🛡️ Turtol: Imune a habilidades fracas!");
    }

    // === MAIS CARTAS DE SUPORTE ===

    // Adubaram - Joga fora criatura do oponente e saca carta
    adubaram_destroyAndDraw(targetId, playerId) {
        this.destroyCard(targetId);
        this.drawCard(playerId);
        this.showAbilityFeedback(null, "🌱 Adubaram: Criatura destruída + carta sacada!");
    }

    // === CRIATURAS DE CUSTO ALTO (5-7) ===

    // Entola Guela - Escolhe uma criatura oponente por turno que não pode atacar
    entolaGuela_chooseTarget(sourceCardId, targetId) {
        if (!this.hasUsedAbilityThisTurn(sourceCardId, 'guela_atolada')) {
            this.addTurnEffect(targetId, 'guela_atolada', 1, {
                canAttack: false
            });
            this.markAbilityUsed(sourceCardId, 'guela_atolada');
            this.showAbilityFeedback(targetId, "🕳️ Guela Atolada: Não pode atacar!");
        }
    }

    // Shupáku - Paralisa uma criatura ao entrar (enquanto estiver em campo)
    shupaku_permanentParalyze(sourceCardId, targetId) {
        this.addPermanentEffect(targetId, 'linguadex_paralysis', {
            canAttack: false,
            dependsOn: sourceCardId // Se Shupáku sair, efeito acaba
        });
        this.showAbilityFeedback(targetId, "👅 Linguadex: Paralisia permanente!");
    }

    // Dino Elétrico - 10 dano a todos os monstros oponentes (1x/turno)
    dinoEletrico_shockDischarge(sourceCardId, playerId) {
        if (!this.hasUsedAbilityThisTurn(sourceCardId, 'shock_discharge')) {
            const enemies = this.getEnemyCreatures(playerId);
            enemies.forEach(enemy => {
                this.modifyCardStats(enemy.id, 0, -10);
            });
            this.markAbilityUsed(sourceCardId, 'shock_discharge');
            this.showAbilityFeedback(null, "⚡ Descarga: 10 dano a todos os inimigos!");
        }
    }

    // Dragão de Cobre - 10 dano ao jogador ao derrotar monstro
    dragaoCobre_defeatDamage(sourceCardId, defeatedEnemyId) {
        const defeatedCard = this.findCardById(defeatedEnemyId);
        if (defeatedCard) {
            const opponent = defeatedCard.player;
            this.damagePlayer(opponent, 10);
            this.showAbilityFeedback(sourceCardId, "🐲 Dragão: 10 dano ao jogador!");
        }
    }

    // Gárgula de Rocha - Imune a custo < 5 + troca ATK/DEF ao atacar
    gargulaRocha_immunity(cardId) {
        this.addPermanentEffect(cardId, 'rock_immunity', {
            immuneToLowCostAttacks: true,
            maxAttackerCost: 4,
            canSwapStats: true
        });
        this.showAbilityFeedback(cardId, "🗿 Gárgula: Imune a ataques fracos!");
    }

    // Lorde Sanguinário - Drena vida ao derrotar monstro
    lordeSanguinario_lifeDrain(sourceCardId, defeatedEnemyId, sourcePlayer) {
        const defeatedCard = this.findCardById(defeatedEnemyId);
        if (defeatedCard) {
            const opponent = defeatedCard.player;
            // Drena 10 PV do oponente e dá ao jogador
            this.damagePlayer(opponent, 10);
            this.damagePlayer(sourcePlayer, -10); // Cura o jogador
            this.showAbilityFeedback(sourceCardId, "🩸 Drenagem Vital: 10 PV roubados!");
        }
    }

    // Mago Arcano - 5 dano direto (1x/turno)
    magoArcano_manaBlast(sourceCardId, playerId) {
        if (!this.hasUsedAbilityThisTurn(sourceCardId, 'mana_blast')) {
            const opponent = playerId === 'p1' ? 'p2' : 'p1';
            this.damagePlayer(opponent, 5);
            this.markAbilityUsed(sourceCardId, 'mana_blast');
            this.showAbilityFeedback(sourceCardId, "🔮 Rajada de Mana: 5 dano direto!");
        }
    }

    // Minotauro Guerreiro - Primeiro ataque ignora defesa
    minotauroGuerreiro_furiousCharge(cardId) {
        if (!this.hasUsedAbilityThisTurn(cardId, 'furious_charge')) {
            this.addOneShotEffect(cardId, 'ignore_defense_attack', {
                ignoreDefense: true
            });
            this.markAbilityUsed(cardId, 'furious_charge');
            this.showAbilityFeedback(cardId, "🐂 Carga Furiosa: Próximo ataque ignora defesa!");
        }
    }

    // Quimera de Fogo - 5 dano a até 3 monstros (1x/turno)
    quimeraFogo_tripleBreath(sourceCardId, targets) {
        if (!this.hasUsedAbilityThisTurn(sourceCardId, 'triple_breath')) {
            targets.slice(0, 3).forEach(targetId => {
                this.modifyCardStats(targetId, 0, -5);
            });
            this.markAbilityUsed(sourceCardId, 'triple_breath');
            this.showAbilityFeedback(sourceCardId, "🔥 Sopro Triplo: 5 dano a até 3 alvos!");
        }
    }

    // Sábio da Montanha - Se sozinho, imune a custo ≤ 4
    sabioMontanha_evasion(cardId, playerId) {
        const allies = this.getAllyCreatures(playerId);
        if (allies.length === 1) {
            this.addPermanentEffect(cardId, 'mountain_evasion', {
                immuneToLowCostAttacks: true,
                maxAttackerCost: 4
            });
            this.showAbilityFeedback(cardId, "🏔️ Evasão: Imune a ataques fracos!");
        }
    }

    // O Lica - Se oponente tem só 1 criatura, não pode ser atacado
    oLica_lycanthropyProtection(cardId, playerId) {
        const enemies = this.getEnemyCreatures(playerId);
        if (enemies.length === 1) {
            this.addPermanentEffect(cardId, 'lycanthropy_protection', {
                cannotBeTargeted: true
            });
            this.showAbilityFeedback(cardId, "🌙 Licantropia: Não pode ser atacado!");
        }
    }

    // Tranca Rua - Se há outras criaturas, só ele pode ser atacado
    trancaRua_forceTarget(cardId, playerId) {
        const allies = this.getAllyCreatures(playerId);
        if (allies.length > 1) {
            this.addPermanentEffect(cardId, 'force_target', {
                mustBeAttackedFirst: true
            });
            this.showAbilityFeedback(cardId, "🚧 Tranca Rua: Inimigos devem me atacar!");
        }
    }

    // === CRIATURAS DE CUSTO MUITO ALTO (7+) ===

    // Alquimista Guardião - +10 DEF a aliado (1x/turno)
    alquimistaGuardiao_protectiveElixir(sourceCardId, targetId) {
        if (!this.hasUsedAbilityThisTurn(sourceCardId, 'protective_elixir')) {
            this.addTurnEffect(targetId, 'elixir_protection', 2, {
                modifyDefense: 10
            });
            this.markAbilityUsed(sourceCardId, 'protective_elixir');
            this.showAbilityFeedback(targetId, "🧪 Elixir Protetor: +10 DEF por 2 turnos!");
        }
    }

    // Alucard - Ressuscita aliado ao derrotar inimigo
    alucard_resurrect(sourceCardId, defeatedEnemyId, playerId) {
        // Implementação simplificada - escolher aliado morto para ressuscitar
        this.showAbilityFeedback(sourceCardId, "🧛 Alucard: Aliado pode ser ressuscitado!");
        // Na implementação real, permitiria escolher carta do cemitério
    }

    // Beluga de Terracota - Ataque direto com metade do dano (1x/turno)
    belugaTerracota_halfDirectAttack(sourceCardId, playerId) {
        if (!this.hasUsedAbilityThisTurn(sourceCardId, 'half_direct')) {
            const card = this.findCardById(sourceCardId);
            if (card) {
                const opponent = playerId === 'p1' ? 'p2' : 'p1';
                const damage = Math.floor(card.data.attack / 2);
                this.damagePlayer(opponent, damage);
                this.markAbilityUsed(sourceCardId, 'half_direct');
                this.showAbilityFeedback(sourceCardId, `🐋 Beluga: ${damage} dano direto!`);
            }
        }
    }

    // Gamaa - Ignora 10 DEF para cada robô aliado
    gamaa_roboticSynergy(cardId, playerId) {
        const allies = this.getAllyCreatures(playerId);
        const robots = allies.filter(ally => ally.data.name.toLowerCase().includes('robot') || 
                                            ally.data.name.toLowerCase().includes('mecha') ||
                                            ally.data.name.toLowerCase().includes('cp-'));
        
        if (robots.length > 0) {
            const defenseIgnore = robots.length * 10;
            this.addPermanentEffect(cardId, 'robotic_synergy', {
                ignoreDefense: defenseIgnore
            });
            this.showAbilityFeedback(cardId, `🤖 Gamaa: Ignora ${defenseIgnore} DEF!`);
        }
    }

    // Iron Dragon - Imune a habilidades inimigas
    ironDragon_abilityImmunity(cardId) {
        this.addPermanentEffect(cardId, 'total_ability_immunity', {
            immuneToAllAbilities: true
        });
        this.showAbilityFeedback(cardId, "🛡️ Iron Dragon: Imune a todas habilidades!");
    }

    // Mexica - Primeiro ataque causa dano dobrado
    mexica_doubleFirstAttack(cardId) {
        if (!this.hasUsedAbilityThisTurn(cardId, 'double_first_attack')) {
            this.addOneShotEffect(cardId, 'double_damage', {
                doubleAttack: true
            });
            this.markAbilityUsed(cardId, 'double_first_attack');
            this.showAbilityFeedback(cardId, "🗿 Mexica: Próximo ataque dobrado!");
        }
    }

    // Paladino Alvorada - Anula habilidades de inimigo (1x/turno)
    paladinoAlvorada_holyBlade(sourceCardId, targetId) {
        if (!this.hasUsedAbilityThisTurn(sourceCardId, 'holy_blade')) {
            this.addTurnEffect(targetId, 'ability_nullified', 2, {
                abilitiesDisabled: true
            });
            this.markAbilityUsed(sourceCardId, 'holy_blade');
            this.showAbilityFeedback(targetId, "⚔️ Lâmina Sagrada: Habilidades anuladas!");
        }
    }

    // Paladino Crepuscular - Se sozinho, +10 DEF
    paladinoCrepuscular_shadowShield(cardId, playerId) {
        const allies = this.getAllyCreatures(playerId);
        if (allies.length === 1) {
            this.modifyCardStats(cardId, 0, 10);
            this.showAbilityFeedback(cardId, "🌑 Escudo das Sombras: +10 DEF!");
        }
    }

    // === CRIATURAS DE CUSTO ÉPICO (7-12) ===

    // Roller - Retorna à mão ao morrer com custo +1
    roller_returnWithIncreasedCost(cardId) {
        const card = this.findCardById(cardId);
        if (card && card.data.defense <= 0) {
            // Aumentar custo e retornar à mão
            card.data.cost += 1;
            this.returnCardToHand(cardId);
            this.showAbilityFeedback(null, `🔄 Roller: Retorna à mão (custo ${card.data.cost})!`);
            return true; // Evitou destruição
        }
        return false;
    }

    // Tiranossauro - Primeiro ataque ignora 10 DEF
    tiranossauro_frighteningRoar(cardId) {
        if (!this.hasUsedAbilityThisTurn(cardId, 'frightening_roar')) {
            this.addOneShotEffect(cardId, 'ignore_defense', {
                ignoreDefense: 10
            });
            this.markAbilityUsed(cardId, 'frightening_roar');
            this.showAbilityFeedback(cardId, "🦕 Rugido: Ignora 10 DEF!");
        }
    }

    // Dragão de Jade - Reflete 10 dano ao atacante
    dragaoJade_acidSkin(cardId, attackerId) {
        // Quando atacado, causa dano ao atacante
        this.modifyCardStats(attackerId, 0, -10);
        this.showAbilityFeedback(cardId, "🐲 Pele Ácida: 10 dano refletido!");
    }

    // Gigante da Marreta - Terremoto 10 dano a todos inimigos
    gigante_earthquake(cardId, playerId) {
        const enemies = this.getEnemyCreatures(playerId);
        enemies.forEach(enemy => {
            this.modifyCardStats(enemy.id, 0, -10);
        });
        this.showAbilityFeedback(cardId, "⚒️ Terremoto: 10 dano a todos inimigos!");
    }

    // Golem de Pedra - Imune a habilidades especiais
    golemPedra_stoneSkin(cardId) {
        this.addPermanentEffect(cardId, 'stone_immunity', {
            immuneToAbilityDamage: true
        });
        this.showAbilityFeedback(cardId, "🗿 Pele de Pedra: Imune a habilidades!");
    }

    // Nucles - Ignora 10 ATK inimigo
    nucles_attackReduction(cardId) {
        this.addPermanentEffect(cardId, 'attack_reduction', {
            reduceIncomingAttack: 10
        });
        this.showAbilityFeedback(cardId, "☢️ Nucles: Reduz 10 ATK dos ataques!");
    }

    // Turtol Maximus - +10 DEF se oponente tem 1 monstro
    turtolMaximus_soloDefenseBonus(cardId, playerId) {
        const enemies = this.getEnemyCreatures(playerId);
        if (enemies.length === 1) {
            this.modifyCardStats(cardId, 0, 10);
            this.showAbilityFeedback(cardId, "🛡️ Turtol Max: +10 DEF vs 1 inimigo!");
        }
    }

    // Condessa Carmilla - ATK-15 mas ganha +10 ATK se derrotar
    condessCarmilla_vampiricAttack(cardId, targetDefeated = false) {
        if (targetDefeated) {
            this.modifyCardStats(cardId, 10, 0);
            this.showAbilityFeedback(cardId, "🧛‍♀️ Carmilla: +10 ATK por vitória!");
        }
        // Dano reduzido é implementado no sistema de combate
        this.addPermanentEffect(cardId, 'vampiric_attack', {
            attackReduction: 15,
            gainAttackOnKill: true
        });
    }

    // Marik - +5 ATK por monstro inimigo
    marik_enemyBonus(cardId, playerId) {
        const enemies = this.getEnemyCreatures(playerId);
        const bonus = enemies.length * 5;
        if (bonus > 0) {
            this.modifyCardStats(cardId, bonus, 0);
            this.showAbilityFeedback(cardId, `👹 Marik: +${bonus} ATK por inimigos!`);
        }
    }

    // === LOBOS LENDÁRIOS (CUSTO 10-11) ===

    // Lobo Alfa Fly - Ignora 20 DEF
    loboAlfaFly_aerialDominance(cardId) {
        this.addPermanentEffect(cardId, 'aerial_dominance', {
            ignoreDefense: 20
        });
        this.showAbilityFeedback(cardId, "🐺 Domínio Aéreo: Ignora 20 DEF!");
    }

    // Lobo Beta Lightning - 20 dano direto ao ser invocado
    loboBetaLightning_electricStrike(playerId) {
        const opponent = playerId === 'p1' ? 'p2' : 'p1';
        this.damagePlayer(opponent, 20);
        this.showAbilityFeedback(null, "⚡ Lobo Beta: 20 dano elétrico!");
    }

    // Lobo Omega Pyro - Queimadura contínua
    loboOmegaPyro_continuousBurn(sourceCardId, targetId) {
        this.addTurnEffect(targetId, 'continuous_burn', 99, {
            defenseReduction: 5 // Por turno
        });
        this.showAbilityFeedback(targetId, "🔥 Queimadura: -5 DEF por turno!");
    }

    // Lobo Gamma Freeze - Paralisa por 3 turnos
    loboGammaFreeze_deepFreeze(sourceCardId, targetId) {
        this.addTurnEffect(targetId, 'deep_freeze', 3, {
            canAttack: false,
            canDefend: false
        });
        this.showAbilityFeedback(targetId, "❄️ Congelamento: 3 turnos paralisado!");
    }

    // === CRIATURAS SUPREMAS (CUSTO 12) ===

    // Latex - Ataca todos com metade do ATK
    latex_multiAttack(cardId, playerId) {
        const card = this.findCardById(cardId);
        if (card) {
            const damage = Math.floor(card.data.attack / 2);
            const enemies = this.getEnemyCreatures(playerId);
            enemies.forEach(enemy => {
                this.modifyCardStats(enemy.id, 0, -damage);
            });
            this.showAbilityFeedback(cardId, `🦾 Latex: ${damage} dano a todos!`);
        }
    }

    // Hidra das Profundezas - 20 dano a TODOS (aliados e inimigos)
    hidraProfundezas_causticBreath(cardId) {
        const allCreatures = this.getAllCreaturesOnField();
        allCreatures.forEach(creature => {
            if (creature.id !== cardId) { // Não se ataca
                this.modifyCardStats(creature.id, 0, -20);
            }
        });
        this.showAbilityFeedback(cardId, "🐍 Respiração Cáustica: 20 dano a todos!");
    }

    // Imperial X - Ataca duas vezes por turno
    imperialX_doubleStrike(cardId) {
        this.addPermanentEffect(cardId, 'double_strike', {
            attacksPerTurn: 2
        });
        this.showAbilityFeedback(cardId, "⚔️ Imperial X: Ataque duplo!");
    }

    // Marik 2 - Ataca todos mas perde DEF
    marik2_sacrificialAttack(cardId, playerId) {
        const enemies = this.getEnemyCreatures(playerId);
        const card = this.findCardById(cardId);
        
        if (card) {
            enemies.forEach(enemy => {
                this.modifyCardStats(enemy.id, 0, -card.data.attack);
            });
            
            // Perde toda defesa
            this.modifyCardStats(cardId, 0, -card.data.defense);
            this.showAbilityFeedback(cardId, "💀 Marik 2: Ataque suicida a todos!");
        }
    }

    // Sentinela Solar - Barreira contra ATK ≤ 30
    sentinelaSolar_lightBarrier(cardId, playerId) {
        this.addTurnEffect(cardId, 'light_barrier', 1, {
            immuneToWeakAttacks: 30
        });
        // Protege jogador também
        this.addTurnEffect(`player_${playerId}`, 'player_light_barrier', 1, {
            immuneToWeakAttacks: 30
        });
        this.showAbilityFeedback(cardId, "☀️ Barreira Solar: Imune a ATK ≤ 30!");
    }

    // Superior - Ataque duplo + ressurreição
    superior_doubleAttackRevive(cardId, defeatedEnemyId) {
        // Ataque duplo
        this.addPermanentEffect(cardId, 'superior_double', {
            attacksPerTurn: 2
        });
        
        // Se derrotou inimigo, ressuscita aliado
        if (defeatedEnemyId) {
            this.showAbilityFeedback(cardId, "👑 Superior: Aliado pode ser ressuscitado!");
            // Na implementação real permitiria escolher do cemitério
        }
    }

    // === EQUIPAMENTOS ESPECIAIS ===

    // Flecha de Prata - Ignora habilidades defensivas
    flechaPrata_ignoreDefenses(targetId) {
        this.addPermanentEffect(targetId, 'silver_arrow', {
            ignoreDefensiveAbilities: true
        });
        this.showAbilityFeedback(targetId, "🏹 Flecha de Prata: Ignora defesas especiais!");
    }

    // Dispositivo de Sincronia - +5 ATK/DEF se tem outro robô
    dispositivoSincronia_roboticSync(targetId, playerId) {
        const allies = this.getAllyCreatures(playerId);
        const robots = allies.filter(ally => 
            ally.data.name.toLowerCase().includes('robot') || 
            ally.data.name.toLowerCase().includes('cp-') ||
            ally.data.name.toLowerCase().includes('mecha')
        );
        
        if (robots.length >= 2) { // Equipado + outro
            this.modifyCardStats(targetId, 5, 5);
            robots.forEach(robot => {
                if (robot.id !== targetId) {
                    this.modifyCardStats(robot.id, 5, 5);
                }
            });
            this.showAbilityFeedback(targetId, "🔗 Sincronia: +5 ATK/DEF para robôs!");
        }
    }

    // Tomo de Feitiços - Compra carta no início do turno
    tomoFeiticos_extraCard(playerId) {
        this.drawCard(playerId);
        this.showAbilityFeedback(null, "📚 Tomo: Carta extra comprada!");
    }

    // Botas da Rapidez - Ataque duplo (segundo com metade)
    botasRapidez_doubleAttack(targetId) {
        this.addPermanentEffect(targetId, 'speed_boots', {
            attacksPerTurn: 2,
            secondAttackHalfDamage: true
        });
        this.showAbilityFeedback(targetId, "👢 Botas: Ataque duplo!");
    }

    // Olho de Águia - Ignora evasão
    olhoAguia_trueStrike(targetId) {
        this.addPermanentEffect(targetId, 'eagle_eye', {
            ignoreEvasion: true,
            cannotMiss: true
        });
        this.showAbilityFeedback(targetId, "👁️ Olho de Águia: Golpes certeiros!");
    }

    // Estaca do Caçador - +10 ATK vs vampiros/lobos
    estacaCacador_vampireSlayer(targetId) {
        this.addPermanentEffect(targetId, 'vampire_slayer', {
            bonusVsVampires: 10,
            bonusVsWerewolves: 10
        });
        this.showAbilityFeedback(targetId, "🔨 Estaca: +10 ATK vs vampiros/lobos!");
    }

    // Couraça de Nano-Carbono - Reduz dano de criaturas caras
    couracaNanoCarbono_highCostReduction(targetId) {
        this.addPermanentEffect(targetId, 'nano_armor', {
            reduceDamageFromHighCost: 10,
            minAttackerCost: 8
        });
        this.showAbilityFeedback(targetId, "🛡️ Nano-Couraça: -10 dano de criaturas caras!");
    }

    // Núcleo de Energia Pura - +5 ATK/DEF para dragões/elite
    nucleoEnergia_pureBoost(targetId) {
        this.modifyCardStats(targetId, 5, 5);
        this.showAbilityFeedback(targetId, "⚡ Núcleo: +5 ATK/DEF puro!");
    }

    // Manoplas de Gelo - +15 dano vs criaturas de fogo
    manoplasGelo_fireBane(targetId) {
        this.addPermanentEffect(targetId, 'ice_gauntlets', {
            bonusVsFire: 15
        });
        this.showAbilityFeedback(targetId, "🧊 Manoplas: +15 dano vs fogo!");
    }

    // Escudo de Energia Estável - Ganha energia ao receber dano
    escudoEnergia_stableEnergy(targetId, playerId) {
        this.addPermanentEffect(targetId, 'stable_energy', {
            gainEnergyOnDamage: 1,
            ownerId: playerId
        });
        this.showAbilityFeedback(targetId, "🔋 Escudo: +1 energia por dano!");
    }

    // Lâmina Sagrada - Ignora habilidade de vampiro/lobo 1x/turno
    laminaSagrada_holyStrike(sourceId, targetId) {
        if (!this.hasUsedAbilityThisTurn(sourceId, 'holy_strike')) {
            this.addOneShotEffect(targetId, 'abilities_disabled', {
                disableAbilities: true
            });
            this.markAbilityUsed(sourceId, 'holy_strike');
            this.showAbilityFeedback(targetId, "⚔️ Lâmina Sagrada: Habilidades anuladas!");
        }
    }

    // Aura de Vingança - Dano ao jogador se derrotado
    auraVinganca_vengeance(targetId, playerId) {
        this.addPermanentEffect(targetId, 'vengeance_aura', {
            damageOnDeath: true,
            ownerId: playerId
        });
        this.showAbilityFeedback(targetId, "💀 Aura: Vingança após morte!");
    }

    // === SUPORTES ESPECIAIS ===

    // Rego Freitas - Voo por um turno
    regoFreitas_temporaryFlight(targetId) {
        this.addTurnEffect(targetId, 'rego_flight', 1, {
            canAttackDirectly: true
        });
        this.showAbilityFeedback(targetId, "🚗 Rego Freitas: Voo por 1 turno!");
    }

    // Apelino Pão e Vinho - Ataques ilimitados por turno
    apelinoPaoVinho_unlimitedAttacks(targetId) {
        this.addPermanentEffect(targetId, 'apelino_power', {
            unlimitedAttacks: true
        });
        this.showAbilityFeedback(targetId, "🍞🍷 Apelino: Ataques ilimitados!");
    }

    // Bilugação Astral - Intransponível por um turno
    bilugacaoAstral_untouchable(targetId) {
        this.addTurnEffect(targetId, 'astral_bilugation', 1, {
            cannotBeTargeted: true,
            cannotBeAttacked: true
        });
        this.showAbilityFeedback(targetId, "✨ Bilugação Astral: Intransponível!");
    }

    // === IMPLEMENTAÇÕES DAS CARTAS FALTANTES ===
    
    // ETC - Remove monstros com custo abaixo de 3 do campo inimigo para sua mão
    etc_returnLowCostCreatures(playerId) {
        const enemies = this.getEnemyCreatures(playerId);
        const lowCostEnemies = enemies.filter(enemy => {
            const card = this.getCardById(enemy);
            return card && card.data.cost < 3;
        });
        
        lowCostEnemies.forEach(enemyId => {
            // Retorna carta para a mão do oponente
            this.showAbilityFeedback(enemyId, "🎴 ETC: Criatura retornada à mão!");
        });
    }

    // Diabrete Alado - Voo Veloz: Pode atacar diretamente os pontos de vida do oponente
    diableteAlado_directFlight(cardId) {
        this.addPermanentEffect(cardId, 'direct_flight', {
            canAttackDirectly: true
        });
        this.showAbilityFeedback(cardId, "👹 Diabrete: Voo direto aos pontos!");
    }

    // Kirb - Copia habilidades de monstros com menos de 4 de custo
    kirb_copyAbilities(cardId, playerId) {
        const allies = this.getAllyCreatures(playerId);
        const lowCostAllies = allies.filter(ally => {
            const card = this.getCardById(ally);
            return card && card.data.cost < 4;
        });
        
        if (lowCostAllies.length > 0) {
            // Na implementação real permitiria escolher qual habilidade copiar
            this.showAbilityFeedback(cardId, "🎭 Kirb: Copiando habilidades!");
        }
    }

    // Gobra - Pode sair e voltar da mão 1x/turno
    gobra_handReturnAbility(cardId, playerId) {
        this.addPermanentEffect(cardId, 'gobra_return', {
            returnToHandOnce: true,
            usedThisTurn: false
        });
        this.showAbilityFeedback(cardId, "🐍 Gobra: Retorno à mão disponível!");
    }

    // Slipul - Caso sozinho em campo, ganha 5 de ataque e defesa para cada criatura do oponente
    slipul_soloBonus(cardId, playerId) {
        const allies = this.getAllyCreatures(playerId);
        if (allies.length === 1) { // Sozinho em campo
            const enemies = this.getEnemyCreatures(playerId);
            const bonusPerEnemy = 5;
            const totalBonus = enemies.length * bonusPerEnemy;
            
            this.modifyCardStats(cardId, totalBonus, totalBonus);
            this.showAbilityFeedback(cardId, `⚡ Slipul sozinho: +${totalBonus} ATK/DEF!`);
        }
    }

    // Sabota Copos - Uma vez por turno pode tirar 5 pontos de defesa e ataque de uma criatura oponente
    sabotaCopos_weakenOnce(cardId) {
        this.addPermanentEffect(cardId, 'sabota_weaken', {
            usesPerTurn: 1,
            usedThisTurn: false
        });
        this.showAbilityFeedback(cardId, "💔 Sabota Copos: Enfraquecimento disponível!");
    }

    // Bilugatron - pode se grudar a uma criatura oponente e infringir 10 de dano a cada turno
    bilugatron_attachDamage(cardId) {
        this.addPermanentEffect(cardId, 'bilugatron_attach', {
            attachedTarget: null,
            damagePerTurn: 10,
            cannotAttackWhileAttached: true
        });
        this.showAbilityFeedback(cardId, "🔗 Bilugatron: Modo grudento ativo!");
    }

    // Cacton - Devolve metade do dano ao atacante
    cacton_reflectDamage(cardId) {
        this.addPermanentEffect(cardId, 'cacton_reflect', {
            reflectPercentage: 0.5
        });
        this.showAbilityFeedback(cardId, "🌵 Cacton: Espinhos refletores!");
    }

    // Duende - Uma vez por turno, você pode usar uma habilidade mágica adicional
    duende_magicLuck(cardId, playerId) {
        this.addPermanentEffect(cardId, 'duende_luck', {
            bonusMagicUse: true,
            usedThisTurn: false
        });
        this.showAbilityFeedback(cardId, "🍀 Duende: Sorte mágica ativa!");
    }

    // Hipool - Caso a defesa da criatura for menor que esta carta causa 10 pontos extras de dano
    hipool_bonusDamage(cardId) {
        this.addPermanentEffect(cardId, 'hipool_bonus', {
            bonusDamageIfLowerDefense: 10
        });
        this.showAbilityFeedback(cardId, "💥 Hipool: Dano extra vs. defesa baixa!");
    }

    // K-023 - Quando está em campo com outro monstro robô, ambos os monstros ganham +5 de Ataque
    k023_robotSynergy(cardId, playerId) {
        const allies = this.getAllyCreatures(playerId);
        const robots = allies.filter(ally => {
            const card = this.getCardById(ally);
            return card && card.data.name.includes('robô') || card.data.name.includes('K-') || card.data.name.includes('CP-');
        });
        
        if (robots.length > 1) {
            robots.forEach(robotId => {
                this.modifyCardStats(robotId, 5, 0);
            });
            this.showAbilityFeedback(cardId, "🤖 K-023: Sincronia robótica ativa!");
        }
    }

    // Medusa de Lama - Paralisa um inimigo por 1 turno
    medusaLama_paralyze(cardId) {
        this.addPermanentEffect(cardId, 'medusa_paralyze', {
            canParalyze: true,
            usesPerTurn: 1,
            usedThisTurn: false
        });
        this.showAbilityFeedback(cardId, "🐍 Medusa: Paralisia disponível!");
    }

    // Ptera - Ataca diretamente jogadores, ignorando monstros
    ptera_directAttack(cardId) {
        this.addPermanentEffect(cardId, 'ptera_direct', {
            canAttackDirectly: true,
            ignoreMonsters: true
        });
        this.showAbilityFeedback(cardId, "🦕 Ptera: Ataque direto ativo!");
    }

    // Scoul - Fica mais forte em 10 pontos de ataque e defesa com dragões em campo
    scoul_dragonBonus(cardId, playerId) {
        const allies = this.getAllyCreatures(playerId);
        const dragons = allies.filter(ally => {
            const card = this.getCardById(ally);
            return card && card.data.name.toLowerCase().includes('dragão');
        });
        
        if (dragons.length > 0) {
            this.modifyCardStats(cardId, 10, 10);
            this.showAbilityFeedback(cardId, "🐲 Scoul: Fortalecido por dragões!");
        }
    }

    // Tlantidu - Ao morrer pode procurar um monstro aquático no deck
    tlantidu_searchAquatic(cardId, playerId) {
        this.addPermanentEffect(cardId, 'tlantidu_search', {
            searchOnDeath: 'aquatico'
        });
        this.showAbilityFeedback(cardId, "🌊 Tlantidu: Busca aquática na morte!");
    }

    // Trox - Pode voltar a mão e depois ser invocado sem custo uma vez por partida
    trox_freeReturn(cardId, playerId) {
        this.addPermanentEffect(cardId, 'trox_free', {
            canReturnForFree: true,
            usedInGame: false
        });
        this.showAbilityFeedback(cardId, "🔄 Trox: Retorno gratuito disponível!");
    }

    // Gulosinho - uma vez por turno caso o jogador abdique de atacar ganha 5 pontos de ataque e defesa
    gulosinho_skipAttackBonus(cardId, playerId) {
        this.addPermanentEffect(cardId, 'gulosinho_hungry', {
            bonusIfSkipAttack: 5,
            canUseThisTurn: true
        });
        this.showAbilityFeedback(cardId, "😋 Gulosinho: Fome por poder!");
    }

    // Fantom - Se Fantom for alvo de um ataque e a Defesa dele for 0, ele não é derrotado e pode se teletransportar para a sua mão
    fantom_ghostEvasion(cardId) {
        this.addPermanentEffect(cardId, 'fantom_evasion', {
            teleportIfZeroDefense: true
        });
        this.showAbilityFeedback(cardId, "👻 Fantom: Evasão fantasma ativa!");
    }

    // Salatiel - Pode pagar 3 pontos de energia para ignorar a defesa de uma criatura
    salatiel_ignoreDefense(cardId, playerId) {
        this.addPermanentEffect(cardId, 'salatiel_pierce', {
            energyCostToIgnoreDefense: 3,
            canUsePerTurn: true
        });
        this.showAbilityFeedback(cardId, "⚔️ Salatiel: Perfuração disponível!");
    }

    // Tobias - Ataca duas vezes, mas com dano reduzido pela metade no segundo ataque
    tobias_doubleAttackWeakened(cardId) {
        this.addPermanentEffect(cardId, 'tobias_double', {
            attacksPerTurn: 2,
            secondAttackHalf: true
        });
        this.showAbilityFeedback(cardId, "⚡ Tobias: Ataque duplo ativo!");
    }

    // Dragão de Cobre - Ao derrotar um monstro, causa 10 de dano ao jogador inimigo
    dragaoCobre_damageOnKill(cardId) {
        this.addPermanentEffect(cardId, 'dragon_copper', {
            damageToPlayerOnKill: 10
        });
        this.showAbilityFeedback(cardId, "🔥 Dragão de Cobre: Fúria ardente!");
    }

    // Lorde Sanguinário - ao derrotar um monstro em combate, pode roubar 10 pontos de vida dos pontos de vida do seu oponente
    lordeSanguinario_lifeSteal(cardId) {
        this.addPermanentEffect(cardId, 'vampire_lord', {
            lifeStealOnKill: 10,
            usesPerTurn: 1
        });
        this.showAbilityFeedback(cardId, "🩸 Lorde: Drenagem vital!");
    }

    // Implementação removida - usar magoArcano_manaBlast

    // Minotauro Guerreiro - O primeiro ataque em cada turno ignora a Defesa do monstro alvo
    minotauroGuerreiro_ignorDefenseFirst(cardId) {
        this.addPermanentEffect(cardId, 'minotaur_charge', {
            firstAttackIgnoreDefense: true,
            usedThisTurn: false
        });
        this.showAbilityFeedback(cardId, "🐂 Minotauro: Carga furiosa!");
    }

    // Quimera de Fogo - Uma vez por turno, pode escolher até três monstros do oponente. Cada um deles recebe 5 de dano direto
    quimeraFogo_tripleBreath(cardId, playerId) {
        this.addPermanentEffect(cardId, 'chimera_fire', {
            breathDamage: 5,
            maxTargets: 3,
            usesPerTurn: 1,
            usedThisTurn: false
        });
        this.showAbilityFeedback(cardId, "🔥 Quimera: Sopro triplo!");
    }

    // Alquimista Guardião - Uma vez por turno, pode escolher um monstro aliado. Esse monstro ganha +10 de Defesa até o final do próximo turno do oponente
    alquimistaGuardiao_protectiveElixir(cardId, playerId) {
        this.addPermanentEffect(cardId, 'alchemist_guard', {
            defenseBuff: 10,
            usesPerTurn: 1,
            usedThisTurn: false
        });
        this.showAbilityFeedback(cardId, "⚗️ Alquimista: Elixir protetor!");
    }

    // Beluga de Terracota - Uma vez por turno, pode atacar diretamente os pontos de vida do seu oponente, mas causando apenas metade do seu dano de Ataque
    belugaTerracota_halfDirectAttack(cardId) {
        this.addPermanentEffect(cardId, 'beluga_terra', {
            canDirectAttackHalf: true,
            usesPerTurn: 1,
            usedThisTurn: false
        });
        this.showAbilityFeedback(cardId, "🏺 Beluga: Ataque direto reduzido!");
    }

    // Gamaa - Ignora 10 pontos da defesa inimiga para cada criatura robotica que você controlar
    gamaa_robotDefenseIgnore(cardId, playerId) {
        const allies = this.getAllyCreatures(playerId);
        const robots = allies.filter(ally => {
            const card = this.getCardById(ally);
            return card && (card.data.name.includes('robô') || card.data.name.includes('K-') || card.data.name.includes('CP-'));
        });
        
        const defenseIgnore = robots.length * 10;
        this.addPermanentEffect(cardId, 'gamaa_robot', {
            ignoreDefenseAmount: defenseIgnore
        });
        this.showAbilityFeedback(cardId, `🤖 Gamaa: Ignora ${defenseIgnore} de defesa!`);
    }

    // Mexica - Primeiro ataque causa o dobro de pontos
    mexica_doubleDamageFirst(cardId) {
        this.addPermanentEffect(cardId, 'mexica_double', {
            firstAttackDouble: true,
            usedThisTurn: false
        });
        this.showAbilityFeedback(cardId, "⚔️ Mexica: Primeiro ataque duplo!");
    }

    // Paladino Alvorada - Uma vez por turno, anula as habilidades de um monstro adversário até o final do turno do oponente
    paladinoAlvorada_nullifyAbilities(cardId, playerId) {
        this.addPermanentEffect(cardId, 'paladin_dawn', {
            nullifyAbility: true,
            usesPerTurn: 1,
            usedThisTurn: false
        });
        this.showAbilityFeedback(cardId, "🗡️ Paladino: Lâmina sagrada!");
    }

    // Roller - Retorna à mão ao morrer, mas custando um ponto a mais de custo toda vez que retornar
    roller_returnOnDeath(cardId) {
        this.addPermanentEffect(cardId, 'roller_return', {
            returnOnDeath: true,
            costIncreasePerReturn: 1,
            timesReturned: 0
        });
        this.showAbilityFeedback(cardId, "🎲 Roller: Retorno custoso!");
    }

    // Tiranossauro - O primeiro ataque de Tiranossauro ignora 10 de Defesa do monstro adversário
    tiranossauro_frighteningRoar(cardId) {
        this.addPermanentEffect(cardId, 'trex_roar', {
            firstAttackIgnoreDefense: 10,
            usedThisTurn: false
        });
        this.showAbilityFeedback(cardId, "🦖 T-Rex: Rugido assustador!");
    }

    // Dragão de Jade - Ao ser atacado, causa 10 de dano direto ao monstro que o atacou
    dragaoJade_acidSkin(cardId) {
        this.addPermanentEffect(cardId, 'jade_dragon', {
            reflectDamageOnAttack: 10
        });
        this.showAbilityFeedback(cardId, "🐉 Dragão de Jade: Pele ácida!");
    }

    // Condessa Carmilla - Quando ataca, o dano causado é igual ao Ataque dela menos 15. Se o monstro for derrotado, ganha 10 de Ataque extra
    condessaCarmilla_vampireAttack(cardId) {
        this.addPermanentEffect(cardId, 'countess_carmilla', {
            attackReduction: 15,
            bonusOnKill: 10
        });
        this.showAbilityFeedback(cardId, "🧛‍♀️ Condessa: Ataque vampíresco!");
    }

    // Lobo Omega Pyro - Aplica queimadura contínua a uma criatura do oponente - 5 de defesa a cada turno
    loboOmegaPyro_continuousBurn(cardId) {
        this.addPermanentEffect(cardId, 'omega_pyro', {
            burnDamagePerTurn: 5,
            canApplyBurn: true,
            usesPerTurn: 1
        });
        this.showAbilityFeedback(cardId, "🔥 Lobo Omega: Queimadura contínua!");
    }

    // Latex - Ataca todos os monstros adversários, causando metade do ATK
    latex_attackAll(cardId) {
        this.addPermanentEffect(cardId, 'latex_spread', {
            attackAllEnemies: true,
            damageToAll: 0.5 // metade do ataque
        });
        this.showAbilityFeedback(cardId, "🏀 Latex: Ataque disperso!");
    }

    // Lobo Gamma Freeze - Paralisa monstros do oponente por 3 turnos
    loboGammaFreeze_paralizeMultiple(cardId) {
        this.addPermanentEffect(cardId, 'gamma_freeze', {
            paralyzeTurns: 3,
            canParalyze: true,
            usesPerTurn: 1
        });
        this.showAbilityFeedback(cardId, "❄️ Lobo Gamma: Congelamento!");
    }

    // Hidra das Profundezas - Ao atacar, causa 20 de dano adicional a todos os outros monstros em campo
    hidraProfundezas_causticBreath(cardId) {
        this.addPermanentEffect(cardId, 'hydra_depths', {
            damageToAllOnAttack: 20,
            includesAllies: true
        });
        this.showAbilityFeedback(cardId, "🐍 Hidra: Respiração cáustica!");
    }

    // Marik 2 - Ataca todos os monstros inimigos, mas perde toda sua defesa depois de usada a habilidade
    marik2_attackAllLoseDefense(cardId) {
        this.addPermanentEffect(cardId, 'marik_evolution', {
            attackAllEnemies: true,
            loseAllDefenseAfter: true,
            abilityUsed: false
        });
        this.showAbilityFeedback(cardId, "👑 Marik 2: Ataque total sacrificial!");
    }

    // === IMPLEMENTAÇÕES DOS SUPORTES FALTANTES ===

    // Rego Freitas - Pegue uma carona com o Rego Freitas e ganhe habilidade de voo por um turno
    regoFreitas_flightRide(targetId) {
        this.addTurnEffect(targetId, 'rego_ride', 1, {
            canAttackDirectly: true,
            hasFlying: true
        });
        this.showAbilityFeedback(targetId, "🚗 Rego Freitas: Carona voadora!");
    }

    // Apelino Pão e Vinho - Ataque com a criatura equipada quantas vezes quiser por turno
    apelinoPaoVinho_multipleAttacks(targetId) {
        this.addPermanentEffect(targetId, 'apelino_feast', {
            unlimitedAttacksPerTurn: true
        });
        this.showAbilityFeedback(targetId, "🍞🍷 Apelino: Ataques infinitos!");
    }

    // Bilugação Astral - A criatura que souber as artes da bilugação astral ficará intransponível por um turno
    bilugacaoAstral_intangible(targetId) {
        this.addTurnEffect(targetId, 'astral_arts', 1, {
            intangible: true,
            cannotBeTargeted: true
        });
        this.showAbilityFeedback(targetId, "✨ Bilugação: Intransponível!");
    }

    // Feitiço de Teletransporte - Uma vez por turno, no final do seu turno, você pode devolver o monstro equipado para a sua mão
    feiticoTeletransporte_returnHand(targetId) {
        this.addPermanentEffect(targetId, 'teleport_spell', {
            canReturnToHand: true,
            usesPerTurn: 1,
            usedThisTurn: false
        });
        this.showAbilityFeedback(targetId, "🌀 Teletransporte: Retorno mágico!");
    }

    // Cajado da Ilusão - Uma vez por turno, o monstro pode se tornar "intocável" para o próximo ataque do oponente
    cajadoIlusao_untouchable(targetId) {
        this.addPermanentEffect(targetId, 'illusion_staff', {
            canBecomeUntouchable: true,
            usesPerTurn: 1,
            usedThisTurn: false
        });
        this.showAbilityFeedback(targetId, "🪄 Cajado: Ilusão defensiva!");
    }

    // Medalhão de Cura - Uma vez por turno, no final da sua Fase de Combate, cura 15 de Defesa do monstro equipado
    medalhaoCura_heal(targetId) {
        this.addPermanentEffect(targetId, 'healing_medallion', {
            healPerTurn: 15,
            healsAtEndOfCombat: true
        });
        this.showAbilityFeedback(targetId, "💚 Medalhão: Cura contínua!");
    }

    // Pena do Gigante - Pode bloquear um ataque de um monstro, mesmo que ele seja "Imune a habilidades especiais"
    penaGigante_blockAttack(targetId) {
        this.addPermanentEffect(targetId, 'giant_feather', {
            canBlockAnyAttack: true,
            ignoresImmunity: true,
            usesPerTurn: 1
        });
        this.showAbilityFeedback(targetId, "🪶 Pena: Bloqueio absoluto!");
    }

    // Manto da Luz Solar - Causa 15 de dano de volta quando atacado por um Vampiro ou Lobisomem
    mantoLuzSolar_vampireDamage(targetId) {
        this.addPermanentEffect(targetId, 'sunlight_mantle', {
            reflectDamageToVampire: 15,
            reflectDamageToWerewolf: 15
        });
        this.showAbilityFeedback(targetId, "☀️ Manto: Proteção solar!");
    }

    // Machado do Vento - Permite um segundo ataque a um monstro diferente, mas o dano desse segundo ataque é reduzido pela metade
    machadoVento_doubleAttack(targetId) {
        this.addPermanentEffect(targetId, 'wind_axe', {
            canAttackTwoDifferentTargets: true,
            secondAttackHalfDamage: true
        });
        this.showAbilityFeedback(targetId, "🪓 Machado: Rajada dupla!");
    }

    // Flecha de Prata - Ao atacar, ignora todas as habilidades especiais defensivas do monstro alvo
    flechaPrata_ignoreDefenses(targetId) {
        this.addPermanentEffect(targetId, 'silver_arrow', {
            ignoreAllDefensiveAbilities: true
        });
        this.showAbilityFeedback(targetId, "🏹 Flecha: Penetração total!");
    }

    // Dispositivo de Sincronia - Se você tiver outro monstro robótico em campo, o monstro equipado e o outro monstro robótico ganham +5 de Ataque e Defesa
    dispositivoSincronia_robotBoost(targetId) {
        this.addPermanentEffect(targetId, 'sync_device', {
            robotSynergy: true,
            boostAmount: 5
        });
        this.showAbilityFeedback(targetId, "🔧 Dispositivo: Sincronia robótica!");
    }

    // Tomo de Feitiços Ancestrais - No início de cada turno, o monstro equipado permite que você compre uma carta adicional
    tomoFeiticos_drawCard(targetId) {
        this.addPermanentEffect(targetId, 'ancient_tome', {
            drawCardPerTurn: true
        });
        this.showAbilityFeedback(targetId, "📚 Tomo: Conhecimento ancestral!");
    }

    // Botas da Rapidez - Permite atacar duas vezes por turno, com o segundo ataque causando metade do dano
    botasRapidez_doubleAttack(targetId) {
        this.addPermanentEffect(targetId, 'speed_boots', {
            attacksPerTurn: 2,
            secondAttackHalfDamage: true
        });
        this.showAbilityFeedback(targetId, "👟 Botas: Velocidade dupla!");
    }

    // Olho de Águia - Ignora habilidades de "Evasão" ou "Intocável" do monstro adversário
    olhoAguia_ignoreEvasion(targetId) {
        this.addPermanentEffect(targetId, 'eagle_eye', {
            ignoreEvasion: true,
            ignoreUntouchable: true
        });
        this.showAbilityFeedback(targetId, "👁️ Olho de Águia: Visão aguçada!");
    }

    // Estaca do Caçador - Ganha +10 de Ataque contra Vampiros ou Lobisomens
    estacaCacador_vampireBonus(targetId) {
        this.addPermanentEffect(targetId, 'hunter_stake', {
            bonusVsVampire: 10,
            bonusVsWerewolf: 10
        });
        this.showAbilityFeedback(targetId, "🔨 Estaca: Caçador especializado!");
    }

    // Couraça de Nano-Carbono - Se o monstro equipado for atacado por um monstro de Custo 8 ou mais, o dano recebido é reduzido em 10
    couracaNanoCarbono_damageReduction(targetId) {
        this.addPermanentEffect(targetId, 'nano_armor', {
            damageReductionVsHighCost: 10,
            minimumCostForReduction: 8
        });
        this.showAbilityFeedback(targetId, "🛡️ Couraça: Proteção avançada!");
    }

    // Núcleo de Energia Pura - Aumenta o Ataque e a Defesa do monstro em 5
    nucleoEnergia_eliteBoost(targetId) {
        this.modifyCardStats(targetId, 5, 5);
        this.showAbilityFeedback(targetId, "⚡ Núcleo: Energia pura!");
    }

    // Manoplas de Gelo - Causa 15 de dano adicional a monstros com habilidade de fogo
    manoplasGelo_fireDamage(targetId) {
        this.addPermanentEffect(targetId, 'ice_gauntlets', {
            bonusVsFireMonsters: 15
        });
        this.showAbilityFeedback(targetId, "🧊 Manoplas: Gelo vs. Fogo!");
    }

    // Escudo de Energia Estável - A cada dano recebido, a energia do jogador aumenta em 1
    escudoEnergiaEstavel_energyGain(targetId) {
        this.addPermanentEffect(targetId, 'stable_shield', {
            energyGainOnDamage: 1
        });
        this.showAbilityFeedback(targetId, "🛡️ Escudo: Conversão energética!");
    }

    // Lâmina Sagrada - Pode ignorar a habilidade especial de um Vampiro ou Lobisomem por turno
    laminaSagrada_vampireIgnore(targetId) {
        this.addPermanentEffect(targetId, 'sacred_blade', {
            ignoreVampireAbility: true,
            ignoreWerewolfAbility: true,
            usesPerTurn: 1
        });
        this.showAbilityFeedback(targetId, "🗡️ Lâmina: Poder sagrado!");
    }

    // Aura de Vingança - Se o monstro equipado for derrotado, ele causa dano igual ao seu Ataque total aos pontos de vida do oponente
    auraVinganca_revengeOnDeath(targetId) {
        this.addPermanentEffect(targetId, 'vengeance_aura', {
            revengeOnDeath: true,
            damageEqualsAttack: true
        });
        this.showAbilityFeedback(targetId, "💀 Aura: Vingança mortal!");
    }

    // === FUNÇÕES AUXILIARES PARA CARTAS RESTANTES ===
    
    // Sistema para cartas sem habilidades implementadas ainda
    placeholderAbility(cardId, cardName) {
        this.showAbilityFeedback(cardId, `⚠️ ${cardName}: Habilidade em desenvolvimento!`);
        console.log(`🚧 Habilidade placeholder para ${cardName} - implementar futuramente`);
    }

    // Bufaboi - Primeiro ataque +10 de dano
    bufaboi_firstAttackBonus(attackerId) {
        if (!this.hasUsedAbilityThisTurn(attackerId, 'first_attack')) {
            this.markAbilityUsed(attackerId, 'first_attack');
            return { modifyAttack: 10, specialEffects: ['first_strike'] };
        }
        return { modifyAttack: 0, specialEffects: [] };
    }

    // Garras Afiadas - Ataque furtivo contra recém-invocados
    garrasAfiadas_sneakAttack(attackerId, defenderId) {
        const defender = this.getCardById(defenderId);
        if (defender && this.wasRecentlySummoned(defenderId)) {
            return { modifyAttack: 10, specialEffects: ['sneak_attack'] };
        }
        return { modifyAttack: 0, specialEffects: [] };
    }

    // Paladar - Dobra ataque contra defesa superior
    paladar_doubleAgainstHighDefense(attackerId, defenderId) {
        const attacker = this.getCardById(attackerId);
        const defender = this.getCardById(defenderId);
        
        if (attacker && defender && defender.data.defense > attacker.data.attack) {
            return { modifyAttack: attacker.data.attack, specialEffects: ['double_damage'] };
        }
        return { modifyAttack: 0, specialEffects: [] };
    }

    // Puma da Selva - Ignora defesa
    pumaSelva_ignoreDefense(attackerId, defenderId) {
        return { 
            modifyAttack: 0, 
            modifyDefense: -999, // Ignora toda defesa
            specialEffects: ['ignore_defense'] 
        };
    }

    // Aladar - Ataca novamente se destruir
    aladar_attackAgain(attackerId) {
        this.addOneShotEffect(attackerId, 'extra_attack', {
            canAttackAgain: true
        });
        this.showAbilityFeedback(attackerId, "🔥 Aladar: Pode atacar novamente!");
    }

    // Rei das Feras - Dano ao jogador ao destruir
    reiFeras_damagePlayer(attackerId, defenderId, damage) {
        const defender = this.getCardById(defenderId);
        if (defender) {
            const opponentPlayer = defender.player === 'p1' ? 'p2' : 'p1';
            this.damagePlayer(opponentPlayer, 10);
            this.showAbilityFeedback(attackerId, "👑 Rei das Feras: 10 de dano ao jogador!");
        }
    }

    // ========================================
    // SISTEMA DE HABILIDADES PASSIVAS
    // ========================================

    applyPassiveAbilities(cardId, cardData, playerId) {
        switch(cardData.id) {
            case 'card_010_1': // Diabrete Alado
            case 'card_010_2':
            case 'card_010_3':
                this.addPermanentEffect(cardId, 'flying', {
                    canAttackDirectly: true
                });
                break;
                
            case 'card_014': // Tobinha e Boguinha
                this.addPermanentEffect(cardId, 'cute', {
                    immuneToHighCostAttacks: 3
                });
                break;
                
            case 'card_018': // CP-2
                this.addPermanentEffect(cardId, 'taunt', {
                    forcedTarget: true
                });
                break;
                
            case 'card_025': // Zé Mulherzinha
                this.addPermanentEffect(cardId, 'protected', {
                    cannotBeTargeted: 'has_allies'
                });
                break;
        }
    }

    // ========================================
    // FUNÇÕES UTILITÁRIAS DO SISTEMA
    // ========================================

    // Modifica stats de uma carta
    modifyCardStats(cardId, attackMod, defenseMod) {
        const cardElement = document.getElementById(cardId);
        if (!cardElement) return;

        const attackSpan = cardElement.querySelector('.attack');
        const defenseSpan = cardElement.querySelector('.defense');
        
        if (attackSpan && attackMod !== 0) {
            const currentAttack = parseInt(attackSpan.textContent) || 0;
            const newAttack = Math.max(0, currentAttack + attackMod);
            attackSpan.textContent = newAttack;
            
            // Efeito visual de mudança
            attackSpan.style.color = attackMod > 0 ? '#00ff00' : '#ff6b6b';
            setTimeout(() => attackSpan.style.color = '', 2000);
        }
        
        if (defenseSpan && defenseMod !== 0) {
            const currentDefense = parseInt(defenseSpan.textContent) || 0;
            const newDefense = Math.max(0, currentDefense + defenseMod);
            defenseSpan.textContent = newDefense;
            
            // Efeito visual de mudança
            defenseSpan.style.color = defenseMod > 0 ? '#00ff00' : '#ff6b6b';
            setTimeout(() => defenseSpan.style.color = '', 2000);
        }
    }

    // Adiciona efeito que dura X turnos
    addTurnEffect(cardId, effectName, turns, effectData) {
        if (!this.turnEffects.has(cardId)) {
            this.turnEffects.set(cardId, new Map());
        }
        
        this.turnEffects.get(cardId).set(effectName, {
            turnsRemaining: turns,
            data: effectData,
            startTurn: window.gameState?.turn || 1
        });
    }

    // Adiciona efeito permanente
    addPermanentEffect(cardId, effectName, effectData) {
        if (!this.permanentEffects.has(cardId)) {
            this.permanentEffects.set(cardId, new Map());
        }
        
        this.permanentEffects.get(cardId).set(effectName, effectData);
    }

    // Adiciona efeito único (usa uma vez)
    addOneShotEffect(cardId, effectName, effectData) {
        if (!this.activeEffects.has(cardId)) {
            this.activeEffects.set(cardId, new Map());
        }
        
        this.activeEffects.get(cardId).set(effectName, effectData);
    }

    // Processa efeitos por turno
    processTurnEffects() {
        for (const [cardId, effects] of this.turnEffects.entries()) {
            for (const [effectName, effectInfo] of effects.entries()) {
                effectInfo.turnsRemaining--;
                
                // Aplicar efeitos contínuos (como veneno)
                if (effectName === 'poisoned' && effectInfo.data.defenseReduction) {
                    this.modifyCardStats(cardId, 0, -effectInfo.data.defenseReduction);
                    this.showAbilityFeedback(cardId, "☠️ Veneno: -5 DEF");
                }
                
                // Remover efeito se acabou
                if (effectInfo.turnsRemaining <= 0) {
                    effects.delete(effectName);
                    this.showAbilityFeedback(cardId, `✅ Efeito ${effectName} terminou`);
                }
            }
            
            // Limpar carta se não tem mais efeitos
            if (effects.size === 0) {
                this.turnEffects.delete(cardId);
            }
        }
    }

    // Feedback visual para habilidades
    showAbilityFeedback(cardId, message) {
        console.log(`🎮 ${message}`);
        
        // Criar notificação visual
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
        
        // Efeito na carta se especificada
        if (cardId) {
            const cardElement = document.getElementById(cardId);
            if (cardElement) {
                cardElement.style.filter = 'brightness(1.3) drop-shadow(0 0 10px #f5c94a)';
                setTimeout(() => cardElement.style.filter = '', 1000);
            }
        }
    }

    // Funções auxiliares
    getCardById(cardId) {
        return this.findCardById(cardId);
    }

    getAllyCreatures(playerId) {
        if (!window.gameState) return [];
        return window.gameState.cards[playerId].field.filter(card => 
            card.data.type === 'criatura'
        );
    }

    getEnemyCreatures(playerId) {
        if (!window.gameState) return [];
        const opponent = playerId === 'p1' ? 'p2' : 'p1';
        return window.gameState.cards[opponent].field.filter(card => 
            card.data.type === 'criatura'
        );
    }

    drawCard(playerId) {
        // Integrar com sistema existente
        if (window.addCardToHand) {
            window.addCardToHand(playerId);
        }
    }

    damagePlayer(playerId, damage) {
        // Integrar com sistema existente
        if (window.changeStat) {
            window.changeStat('pv', playerId, -damage);
        }
    }

    destroyCard(cardId) {
        // Implementar destruição de carta
        const cardElement = document.getElementById(cardId);
        if (cardElement) {
            cardElement.style.animation = 'cardDestroy 0.8s ease-in-out';
            setTimeout(() => cardElement.remove(), 800);
        }
    }

    hasUsedAbilityThisTurn(cardId, abilityName) {
        const key = `${cardId}_${abilityName}_turn_${window.gameState?.turn || 1}`;
        return this.oneShotEffects.has(key);
    }

    markAbilityUsed(cardId, abilityName) {
        const key = `${cardId}_${abilityName}_turn_${window.gameState?.turn || 1}`;
        this.oneShotEffects.add(key);
    }

    wasRecentlySummoned(cardId) {
        // Verificar se foi invocada neste turno
        return window.gameState?.recentlySummoned?.includes(cardId) || false;
    }

    // === FUNÇÕES AUXILIARES ADICIONAIS ===
    
    findCardById(cardId) {
        // Usar a função existente do jogo se disponível
        if (window.findCardData) {
            return window.findCardData(cardId);
        }
        
        // Fallback: buscar manualmente
        if (!window.gameState) return null;
        
        for (const player of ['p1', 'p2']) {
            // Campo
            const fieldCard = window.gameState.cards[player].field.find(c => c.id === cardId);
            if (fieldCard) return { ...fieldCard, player };
            
            // Mão
            const handCard = window.gameState.cards[player].hand.find(c => c.id === cardId);
            if (handCard) return { ...handCard, player };
        }
        return null;
    }
    
    returnCardToHand(cardId) {
        const card = this.findCardById(cardId);
        if (!card) return;
        
        // Remover do campo
        const fieldIndex = window.gameState.cards[card.player].field.findIndex(c => c.id === cardId);
        if (fieldIndex !== -1) {
            const removedCard = window.gameState.cards[card.player].field.splice(fieldIndex, 1)[0];
            
            // Adicionar de volta à mão
            window.gameState.cards[card.player].hand.push(removedCard);
            
            // Remover do DOM
            const cardElement = document.getElementById(cardId);
            if (cardElement) {
                cardElement.remove();
            }
            
            // Atualizar UI
            if (window.updateUI) {
                window.updateUI();
            }
        }
    }

    stealCard(cardId, newOwner) {
        const card = this.findCardById(cardId);
        if (!card) return;
        
        const oldOwner = card.player;
        
        // Remover do campo do jogador anterior
        const fieldIndex = window.gameState.cards[oldOwner].field.findIndex(c => c.id === cardId);
        if (fieldIndex !== -1) {
            const stolenCard = window.gameState.cards[oldOwner].field.splice(fieldIndex, 1)[0];
            
            // Adicionar ao campo do novo dono
            window.gameState.cards[newOwner].field.push(stolenCard);
            
            // Atualizar visualmente
            const cardElement = document.getElementById(cardId);
            if (cardElement) {
                // Mover para área do novo dono
                const newPlayerArea = document.querySelector(`#field-${newOwner}`);
                if (newPlayerArea) {
                    newPlayerArea.appendChild(cardElement);
                }
            }
            
            this.showAbilityFeedback(cardId, `🔄 Carta roubada para ${newOwner}!`);
            
            if (window.updateUI) {
                window.updateUI();
            }
        }
    }

    getPlayerEnergy(playerId) {
        const energyElement = document.getElementById(`energy-${playerId}`);
        return energyElement ? parseInt(energyElement.innerText) : 0;
    }

    changePlayerEnergy(playerId, amount) {
        if (window.changeStat) {
            window.changeStat('energy', playerId, amount);
        }
    }

    // Removida função duplicada - usar a implementação anterior

    getAllCreaturesOnField() {
        const allCreatures = [];
        for (const player of ['p1', 'p2']) {
            const creatures = window.gameState.cards[player].field.filter(c => c.data.type === 'criatura');
            allCreatures.push(...creatures.map(c => ({ ...c, player })));
        }
        return allCreatures;
    }

    canCreatureAttack(cardId) {
        const effects = this.temporaryEffects.get(cardId);
        const permanentEffects = this.permanentEffects.get(cardId);
        
        // Verificar se está paralizada ou grudada
        if (effects?.paralyzed || effects?.attached_state || 
            permanentEffects?.attached_state) {
            return false;
        }
        
        return true;
    }

    // Função para testar habilidades
    testAbility(cardName, targetId = null) {
        console.log(`🧪 Testando habilidade de ${cardName}`);
        
        // Simular invocação
        const testCardId = 'test_' + Date.now();
        
        switch(cardName.toLowerCase()) {
            case 'chocolicia':
                if (targetId) this.chocolicia_weaken(targetId);
                break;
            case 'natalino':
                this.natalino_healAllies('p1');
                break;
            case 'diabrete alado':
                this.diabrete_directAttack(testCardId);
                break;
            case 'espada mágica':
                if (targetId) this.espadaMagica_boost(targetId);
                break;
            case 'estrela mágica':
                if (targetId) this.estrelaMagica_shield(targetId);
                break;
            default:
                console.log('❌ Habilidade não implementada:', cardName);
        }
    }
}

// ========================================
// INICIALIZAÇÃO E INTEGRAÇÃO
// ========================================

// Criar instância global
window.cardAbilities = new CardAbilitiesSystem();

// CSS para animações das notificações
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

console.log('🎮 Sistema de Habilidades das Cartas carregado!');