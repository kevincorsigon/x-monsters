> You are only seeing this prompt; there is no context outside it.

# Motor de Habilidades - Fase 5C1: Ataques Adicionais

## Objetivo e Definition of Done

Migrar `047`, `063`, `084`, `089`, `096` e `100`.

1. Tobias, Imperial X, Machado e Botas permitem dois ataques por turno;
   Apelino permite ataques ilimitados enquanto equipado.
2. Tobias/Machado/Botas causam 50% no segundo ataque, arredondado para baixo;
   Machado exige alvo diferente.
3. Beluga permite ataque direto com 50% do ATK uma vez por turno.
4. Equipamentos limpam limites/permissões ao sair e não aplicam stats numéricos
   além do texto migrado.
5. UI usa orçamento e histórico canônicos; estado/DOM/rollback passam.

## Anti-escopo

- Ataques em área ficam no 5C2.
- Nenhuma dependência ou redesign.

## Orçamento

Quatro arquivos: `src/js/game-engine.js`, `src/js/card-rules.js`, `game.html`,
`tests/unit/run-tests.js`.

## Como Validar

`node tests/unit/run-tests.js`, sintaxe/diff e smoke browser.