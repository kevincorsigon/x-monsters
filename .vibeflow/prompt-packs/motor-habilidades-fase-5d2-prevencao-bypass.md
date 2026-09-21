> You are only seeing this prompt; there is no context outside it.

# Motor de Habilidades - Fase 5D2: Prevenção e Bypass Defensivo

## Objetivo e Definition of Done

Migrar `092`, `097` e `101`.

1. Cajado da Ilusão (092): equipa somente em host com trait `magico`;
   1x/turno o controlador ativa e concede `UNTOUCHABLE_SHIELD` ao próprio
   hospedeiro (sem seleção de alvo); o escudo cancela e consome o próximo
   ataque contra o hospedeiro, igual em mecânica ao `MAGIC_SHIELD` (002).
2. Flecha de Prata (097): equipa somente em host com trait `humanoide` ou
   `besta`; enquanto equipada, os ataques do host ignoram as restrições de
   alvo migradas (014, 018, 025, 044, 058, 059, 060) e os escudos reativos
   migrados (002 `MAGIC_SHIELD`, 092 `UNTOUCHABLE_SHIELD`).
3. Olho de Águia (101): sem restrição de host; enquanto equipada, os
   ataques do host ignoram somente a evasão de 058 e o `UNTOUCHABLE_SHIELD`
   de 092 — nada além disso.
4. Nenhum equipamento aplica os campos numéricos brutos do JSON como bônus
   implícitos; nenhuma dependência nova.
5. A ação ativada de Cajado usa `sourceZone: 'equipment'`; o painel manual
   descobre habilidades ativáveis também nas zonas de equipamento dos
   jogadores, não somente no campo.
6. Estado, DOM, rollback e suíte completa passam; smoke browser real cobre
   os três IDs.

## Anti-escopo

- Bilugação Astral (090) e qualquer outra proteção/negação fora dos três IDs.
- Nenhum redesign do painel além da descoberta de fonte em `equipment`.
- Nenhuma dependência nova.

## Orçamento

Quatro arquivos: `src/js/game-engine.js`, `src/js/card-rules.js`,
`src/js/manual_abilities.js`, `tests/unit/run-tests.js`.

## Padrões a Seguir

- Ações ativadas continuam usando `resolveAction`/`resolveChoice` do motor;
  nenhuma regra de carta manipula DOM diretamente.
- Bypass de proteção é lido a partir dos `attachments` reais do atacante no
  momento da resolução, nunca de um campo declarado externamente (mesmo
  padrão de proveniência não forjável da Fase 5D1).
- `UNTOUCHABLE_SHIELD` segue o mesmo ciclo de vida de `MAGIC_SHIELD`:
  cria-se por `ADD_EFFECT`, consome-se por `MODIFY_COMBAT` + `REMOVE_EFFECT`
  na janela `BECAME_ATTACK_TARGET`.
- Traits continuam vindo exclusivamente de `TRAITS_BY_DEFINITION`.

## Como Validar

1. `node tests/unit/run-tests.js`.
2. `node --check` nos três módulos e no script inline de `game.html`.
3. Smoke browser: equipar Cajado, ativar, atacar (deve cancelar); equipar
   Flecha e atacar um alvo com proteção migrada (deve atravessar); equipar
   Olho e confirmar que atravessa evasão/intocável mas não Estrela Mágica.
4. `git diff --check`.

## Documentação

Salvar auditoria em
`.vibeflow/audits/motor-habilidades-fase-5d2-prevencao-bypass-audit.md`.
