/**
 * pvm-ai.js - Inteligência do modo PvM (jogador vs máquina).
 *
 * UMD (module.exports + window.PvmAi). Sem DOM: decide a próxima jogada da
 * máquina a partir do estado canônico + engine + regras. É uma função pura de
 * decisão — devolve UM comando por chamada e o driver (`pvm-game.js`) executa e
 * chama de novo. Nenhuma regra de carta é reimplementada aqui: toda validação
 * (alvos, limite de uso, custo, evolução, equipamento, ataque direto) vem do
 * `GameEngine` e de `CardRules`.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    root.PvmAi = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const TIPOS_DE_CAMPO = ['criatura', 'evolução'];

    function outro(playerId) {
        return playerId === 'p1' ? 'p2' : 'p1';
    }

    function ehCriatura(card) {
        return Boolean(card && card.data && TIPOS_DE_CAMPO.includes(card.data.type));
    }

    function campo(state, playerId) {
        return (state?.players?.[playerId]?.zones?.field || []).filter(ehCriatura);
    }

    function criaturasDoOponente(state, playerId) {
        return campo(state, outro(playerId));
    }

    function valorDaCriatura(card) {
        const atk = Number(card?.baseStats?.attack) || Number(card?.data?.attack) || 0;
        const def = Number(card?.baseStats?.defense) || Number(card?.data?.defense) || 0;
        return atk + def;
    }

    function ataqueEfetivo(engine, cardId, bruto) {
        try {
            return engine.getEffectiveStat(cardId, 'attack');
        } catch (error) {
            return Number(bruto) || 0;
        }
    }

    function defesaRestante(engine, cardId) {
        try {
            return engine.getRemainingDefense(cardId);
        } catch (error) {
            return 0;
        }
    }

    function custoEfetivo(engine, cardId, bruto) {
        try {
            return engine.getEffectiveStat(cardId, 'cost');
        } catch (error) {
            return Number(bruto) || 0;
        }
    }

    function energiaDoJogador(state, playerId) {
        return Number(state?.players?.[playerId]?.energy) || 0;
    }

    function cartasDaMao(state, playerId) {
        return state?.players?.[playerId]?.zones?.hand || [];
    }


    // ── habilidade ativada ──────────────────────────────────────────────────

    function cartasComHabilidade(state, playerId, rules) {
        if (!rules?.getActivatedRule) return [];
        const cartas = [];
        const jogador = state.players[playerId];
        const zonas = [
            ...jogador.zones.field,
            ...jogador.zones.equipment,
            ...jogador.zones.hand
        ];
        zonas.forEach(card => {
            if (!card?.definitionId) return;
            const rule = rules.getActivatedRule(card.definitionId);
            if (!rule) return;
            // Só habilidade de mão vale para cartas que ainda estão na mão.
            if (card.zone === 'hand' && rule.sourceZone !== 'hand') return;
            cartas.push({ cardId: card.instanceId, rule });
        });
        return cartas;
    }

    function alvosDaHabilidade(state, rules, cardId) {
        if (!rules?.getActivatedTargets) return [];
        try {
            return rules.getActivatedTargets(state, cardId) || [];
        } catch (error) {
            return [];
        }
    }

    /**
     * Devolve a melhor habilidade utilizável ou null.
     * Escopo v1: habilidades ofensivas — dano em área (`maxTargets === 0` com
     * `damage`/`allEnemies`) e dano/debuff com alvo inimigo. Habilidades de
     * aliado/combo (`targetsAllies`, `targetsFn`) ficam de fora.
     */
    function melhorHabilidade(state, engine, playerId, rules) {
        const candidatas = cartasComHabilidade(state, playerId, rules)
            .filter(c => engine.canUseAbility(c.cardId, c.rule.abilityId, c.rule.limit))
            .map(c => ({ ...c, targets: alvosDaHabilidade(state, rules, c.cardId) }))
            .filter(c => {
                if (c.rule.targetsAllies || c.rule.targetsFn) return false;
                if (c.rule.maxTargets === 0) {
                    const ofensiva = Number(c.rule.damage) > 0 || c.rule.allEnemies === true;
                    return ofensiva && c.targets.length > 0;
                }
                return c.targets.length >= (c.rule.minTargets || 1);
            });

        if (candidatas.length === 0) return null;

        const pontuadas = candidatas.map(c => {
            const alvos = c.targets.slice().sort((a, b) => {
                const defA = defesaRestante(engine, a);
                const defB = defesaRestante(engine, b);
                const dano = Number(c.rule.damage) || 0;
                if (dano > 0) {
                    const mataA = defA <= dano ? 0 : 1;
                    const mataB = defB <= dano ? 0 : 1;
                    if (mataA !== mataB) return mataA - mataB;
                }
                return valorDaCriatura(state.cardInstances[b]) - valorDaCriatura(state.cardInstances[a]);
            });

            let targetIds;
            let pontuacao;
            if (c.rule.maxTargets === 0) {
                targetIds = [];
                pontuacao = (Number(c.rule.damage) || 0) * c.targets.length;
            } else {
                targetIds = alvos.slice(0, c.rule.maxTargets);
                const dano = Number(c.rule.damage) || 0;
                pontuacao = dano > 0
                    ? dano * targetIds.length
                    : valorDaCriatura(state.cardInstances[targetIds[0]]) || 0;
            }
            return { cardId: c.cardId, targetIds, pontuacao };
        });

        pontuadas.sort((a, b) => b.pontuacao - a.pontuacao);
        const escolhida = pontuadas[0];
        return { type: 'ability', cardId: escolhida.cardId, targetIds: escolhida.targetIds };
    }

    // ── equipar suporte ─────────────────────────────────────────────────────

    function melhorEquipamento(state, engine, playerId, rules) {
        const energia = energiaDoJogador(state, playerId);
        const criaturasProprias = campo(state, playerId);
        if (criaturasProprias.length === 0) return null;

        const opcoes = [];
        cartasDaMao(state, playerId).forEach(suporte => {
            if (suporte?.data?.type !== 'suporte') return;
            const custo = custoEfetivo(engine, suporte.instanceId, suporte.data.cost);
            if (custo > energia) return;
            const buff = Number(suporte.data.attack || 0) + Number(suporte.data.defense || 0);
            if (buff <= 0) return;

            criaturasProprias.forEach(alvo => {
                const valido = rules?.validateEquipmentTarget
                    ? rules.validateEquipmentTarget(suporte, alvo)
                    : { valid: true };
                if (!valido?.valid) return;
                opcoes.push({
                    supportId: suporte.instanceId,
                    creatureId: alvo.instanceId,
                    buff,
                    ataqueAlvo: ataqueEfetivo(engine, alvo.instanceId, alvo.data.attack)
                });
            });
        });

        if (opcoes.length === 0) return null;
        opcoes.sort((a, b) =>
            b.buff - a.buff ||
            b.ataqueAlvo - a.ataqueAlvo
        );
        const escolhida = opcoes[0];
        return { type: 'equip', cardId: escolhida.supportId, creatureId: escolhida.creatureId };
    }

    // ── invocação ───────────────────────────────────────────────────────────

    function melhorInvocacao(state, engine, playerId, rules, rng) {
        const energia = energiaDoJogador(state, playerId);
        const opcoes = [];
        cartasDaMao(state, playerId).forEach(card => {
            if (!card?.data || !TIPOS_DE_CAMPO.includes(card.data.type)) return;
            const custo = custoEfetivo(engine, card.instanceId, card.data.cost);
            if (custo > energia) return;
            if (card.data.type === 'evolução') {
                const check = rules?.validateEvolutionSummon
                    ? rules.validateEvolutionSummon(state, card.definitionId, playerId)
                    : { valid: true };
                if (!check?.valid) return;
            }
            const atk = Number(card.data.attack) || 0;
            const def = Number(card.data.defense) || 0;
            opcoes.push({ cardId: card.instanceId, valor: atk + def, custo, atk });
        });

        if (opcoes.length === 0) return null;
        opcoes.sort((a, b) =>
            (b.valor / b.custo) - (a.valor / a.custo) ||
            b.atk - a.atk ||
            (rng() - 0.5)
        );
        return { type: 'summon', cardId: opcoes[0].cardId };
    }


    // ── combate ─────────────────────────────────────────────────────────────

    function ataqueLegal(state, engine, rules, attackerId, targetId) {
        const base = engine.validateCombat({ attackerId, targetId });
        if (!base?.valid) return false;
        const migrado = rules?.validateAttackTarget
            ? rules.validateAttackTarget(state, attackerId, targetId)
            : { valid: true };
        return migrado?.valid === true;
    }

    function melhorAtaque(state, engine, playerId, rules, rng) {
        const atacantes = campo(state, playerId)
            .filter(card => engine.canAttack(card.instanceId)?.canAttack);
        if (atacantes.length === 0) return null;

        const inimigos = criaturasDoOponente(state, playerId);

        // 1) mata sem morrer: alvo de maior valor entre os que a criatura derruba
        //    e sobrevive à retaliação.
        let melhor = null;
        atacantes.forEach(atacante => {
            const atq = ataqueEfetivo(engine, atacante.instanceId, atacante.data.attack);
            const defPropria = defesaRestante(engine, atacante.instanceId);
            inimigos.forEach(alvo => {
                if (!ataqueLegal(state, engine, rules, atacante.instanceId, alvo.instanceId)) return;
                const defAlvo = defesaRestante(engine, alvo.instanceId);
                const atqAlvo = ataqueEfetivo(engine, alvo.instanceId, alvo.data.attack);
                const mata = defAlvo <= atq;
                const sobrevive = defPropria > atqAlvo;
                if (!mata || !sobrevive) return;
                const valor = valorDaCriatura(alvo);
                if (!melhor || valor > melhor.valor) {
                    melhor = { attackerId: atacante.instanceId, targetId: alvo.instanceId, valor };
                }
            });
        });
        if (melhor) {
            return { type: 'attack', attackerId: melhor.attackerId, targetId: melhor.targetId };
        }

        // 2) troca favorável: mata um alvo de valor maior mesmo que a criatura morra.
        let troca = null;
        atacantes.forEach(atacante => {
            const atq = ataqueEfetivo(engine, atacante.instanceId, atacante.data.attack);
            const valorAtacante = valorDaCriatura(atacante);
            inimigos.forEach(alvo => {
                if (!ataqueLegal(state, engine, rules, atacante.instanceId, alvo.instanceId)) return;
                const defAlvo = defesaRestante(engine, alvo.instanceId);
                if (defAlvo > atq) return;
                const valorAlvo = valorDaCriatura(alvo);
                if (valorAlvo <= valorAtacante) return;
                if (!troca || valorAlvo > troca.valor) {
                    troca = { attackerId: atacante.instanceId, targetId: alvo.instanceId, valor: valorAlvo };
                }
            });
        });
        if (troca) {
            return { type: 'attack', attackerId: troca.attackerId, targetId: troca.targetId };
        }

        // 3) ataque direto com o atacante de maior ataque disponível.
        const diretos = atacantes
            .filter(card => rules?.canDirectAttack ? rules.canDirectAttack(state, card.instanceId) : false)
            .sort((a, b) =>
                ataqueEfetivo(engine, b.instanceId, b.data.attack) -
                ataqueEfetivo(engine, a.instanceId, a.data.attack) ||
                (rng() - 0.5)
            );
        if (diretos.length > 0) {
            return { type: 'direct_attack', attackerId: diretos[0].instanceId };
        }

        return null;
    }

    // ── API ─────────────────────────────────────────────────────────────────

    /**
     * Decide a próxima jogada da máquina. Devolve um comando ou null.
     *
     * Comandos:
     *   { type: 'ability', cardId, targetIds }
     *   { type: 'equip', cardId, creatureId }
     *   { type: 'summon', cardId }
     *   { type: 'attack', attackerId, targetId }
     *   { type: 'direct_attack', attackerId }
     */
    function decidirJogada(state, engine, playerId, options = {}) {
        if (!state || !engine) return null;
        if (state.currentPlayer !== playerId) return null;

        const rules = options.rules || (typeof window !== 'undefined' ? window.CardRules : null);
        const rng = options.rng || Math.random;
        if (!rules) return null;

        const phase = state.currentPhase;

        const habilidade = melhorHabilidade(state, engine, playerId, rules);
        if (habilidade) return habilidade;

        if (phase === 'invocation') {
            return melhorEquipamento(state, engine, playerId, rules)
                || melhorInvocacao(state, engine, playerId, rules, rng)
                || null;
        }

        if (phase === 'combat') {
            return melhorAtaque(state, engine, playerId, rules, rng) || null;
        }

        return null;
    }

    return { decidirJogada };
});

