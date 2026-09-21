> You are only seeing this prompt; there is no context outside it.

# Motor de Habilidades - Fase 5D1: Proveniência e Imunidades

## Objetivo e Definition of Done

Migrar `048`, `065`, `073` e `086`.

1. Efeitos ofensivos carregam proveniência canônica derivada da instância fonte.
2. Turtol bloqueia habilidade de criatura/evolução custo <4; combate passa.
3. Iron Dragon bloqueia efeitos de habilidades inimigas; combate/aliados passam.
4. Golem bloqueia apenas dano de habilidade de criatura/evolução inimiga.
5. Sentinela, até o fim do próximo turno adversário, bloqueia dano de criatura
   com ATK <=30 contra si ou seu controlador; ataque continua consumido.
6. Dino/Quimera/Cacton/Aura e lote misto compõem por alvo; rollback passa.
7. Suíte completa, sintaxe e smoke browser passam.

## Anti-escopo

- Nenhuma negação ativa, bypass defensivo ou UI nova.
- Nenhuma dependência.

## Orçamento

Três arquivos: `src/js/game-engine.js`, `src/js/card-rules.js`,
`tests/unit/run-tests.js`.

## Como Validar

`node tests/unit/run-tests.js`, sintaxe/diff e smoke browser.