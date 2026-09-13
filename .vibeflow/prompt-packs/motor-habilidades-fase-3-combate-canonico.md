> You are only seeing this prompt; there is no context outside it.

# Motor de Habilidades - Fase 3: Combate Canônico

## Objetivo e Definition of Done

Migrar o combate-base para o engine transacional, usando o estado canônico e
oferecendo janelas determinísticas para as habilidades que serão migradas nos
lotes seguintes.

1. Ataques validam fase, controlador, zona, tipo de carta, adversário, alvo e
   orçamento de ataques antes de alterar estado; ataque inválido não consome
   uso nem causa dano.
2. Combate contra criatura aplica dano físico mútuo simultâneo sobre `damage`
   acumulado, usa stats efetivos e calcula DEF restante sem alterar stats base.
3. As janelas `ATTACK_DECLARED`, `BECAME_ATTACK_TARGET`, `BEFORE_DAMAGE`,
   `DAMAGE_DEALT`, `CREATURE_WOULD_DIE`, `CREATURE_DESTROYED`,
   `CREATURE_DEFEATED` e `AFTER_ATTACK` são ordenadas e permitem modificar ou
   prevenir o contexto por descritores reversíveis.
4. Morte simples e simultânea move criatura e equipamentos aos descartes de
   seus owners, preserva identidade/controller e executa cleanup ligado à fonte.
5. Dano penetrante mantém a fórmula atual e ataque direto altera PV pelo estado;
   ambos participam da mesma transação e rollback.
6. Orçamento de ataques é contado por instância e turno, aceita limite derivado
   para ataques adicionais e substitui `attackedThisTurn` nas decisões de UI.
7. `node tests/unit/run-tests.js` passa com matriz de ataque normal, direto,
   inválido, prevenção, modificação, penetração, morte simultânea, attachments,
   ataques adicionais e rollback.

## Anti-escopo

- Não migrar habilidades individuais nem consumir flags dos mapas legados.
- Não decidir se ataque direto deve exigir campo inimigo vazio; preservar nesta
  fase a disponibilidade atual e manter a decisão registrada na spec mãe.
- Não implementar ainda ataques em área, reflexão, bypass, imunidades ou
  ataques adicionais de cartas específicas.
- Não alterar catálogo, traits, evolução, balanceamento ou construção de deck.
- Não adicionar dependências ou redesenhar a interface.

## Orçamento

No máximo quatro arquivos de implementação:

- modificar `src/js/game-engine.js`;
- modificar `game.html`;
- modificar `src/js/card-abilities.js`;
- modificar `tests/unit/run-tests.js`.

## Padrões a Seguir

### Regra-base preservada

No ataque contra criatura, atacante e defensor causam dano simultâneo. Se o
alvo for derrotado, o dano penetrante ao PV de seu controlador é:

$$
\max(0, danoDoAtacante - defesaRestanteDoAlvoAntesDoAtaque)
$$

Ataque direto causa o ATK efetivo ao PV adversário. Nesta fase ele continua
permitido como no jogo atual; permissões/restrições por carta serão migradas
depois da decisão de produto.

### Estado canônico

- Dano recebido acumula em `card.damage`.
- ATK/DEF base e modificadores não são sobrescritos pelo combate.
- DEF restante é `max(0, effectiveDefense - damage)`.
- Mortes usam movimento canônico de zona, nunca remoção de DOM como regra.
- O renderer lê o resultado do engine e pode atrasar apenas animação.

### Eventos e transação

O contexto de combate é alterado somente por `MODIFY_COMBAT`; dano, uso e
movimentos têm undo. Qualquer handler inválido reverte todo o ataque. Eventos
de morte recebem snapshot suficiente mesmo depois da mudança de zona.

### Compatibilidade

`canAttackTarget` pode continuar consultando proteções legadas como validator
temporário. `window.cardAbilities` recebe o resultado completo depois da
resolução, mas seus retornos antigos não decidem o combate nesta fase.

### Convenções

- JavaScript ES6, browser + CommonJS, sem build.
- Nenhum acesso a DOM no engine.
- Feedback visual acontece depois do resultado confirmado.
- Preferir `showMessage` a novos `alert` no combate.

## Onde Trabalhar

### `src/js/game-engine.js`

Adicionar `resolveCombat`, validação, contexto ativo, efeitos de modificação de
combate/dano/uso, stats restantes, limite e contagem de ataques, morte e eventos.

### `game.html`

Substituir cálculos e mutações de `performAttack`/`directAttack` pelo resultado
do engine. Renderizar stats/PV, animar mortos já movidos e usar orçamento do
engine nos highlights e seleção.

### `src/js/card-abilities.js`

Adicionar somente wrappers de compatibilidade para declaração/resultado do
combate. Não converter métodos de cartas.

### `tests/unit/run-tests.js`

Adicionar matriz determinística de combate e regressões de rollback/eventos.

## Como Validar

1. Executar `node tests/unit/run-tests.js`.
2. Executar `node --check` nos módulos e no script inline de `game.html`.
3. No browser, invocar duas criaturas, atacar e confirmar dano, descarte, PV,
   eventos e DOM; testar também ataque direto e bloqueio do segundo ataque.
4. Executar `git diff --check`.

## Documentação

Salvar auditoria em
`.vibeflow/audits/motor-habilidades-fase-3-combate-canonico-audit.md`.