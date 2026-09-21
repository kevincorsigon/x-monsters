> You are only seeing this prompt; there is no context outside it.

# Motor de Habilidades - Fase 4C: Proteções e Ataque Direto

## Objetivo e Definition of Done

Migrar `002`, `010_1/2/3`, `014`, `018`, `025`, `028`, `035`, `044` e `088`.

1. Ataque direto básico exige campo inimigo sem criaturas; Diabrete, Ptera,
   Atravessava e Rego concedem bypass conforme suas durações.
2. Tobinha bloqueia atacante custo >3; Grifo bloqueia custo <=4; Zé Mulherzinha
   não pode ser alvo enquanto houver outro aliado; CP-2 força o alvo.
3. Estrela Mágica anula e consome o próximo ataque contra o aliado equipado;
   o ataque é gasto, mas nenhum dano/morte/penetração ocorre.
4. Atravessava e proteções ligadas limpam ao sair a fonte; Rego expira no fim
   do turno e também deixa de valer se a fonte sair antes.
5. Equipamentos migrados validam lado do alvo e não aplicam stats numéricos do
   JSON quando o texto não os concede.
6. UI destaca somente alvos/ataque direto legais; estado e DOM permanecem
   consistentes; suíte e smoke browser passam.

## Anti-escopo

- Não migrar imunidades a habilidade, evasão avançada ou cartas da Fase 5.
- Não implementar redesign ou dependência.
- Não remover código legado ainda.

## Orçamento

Quatro arquivos: `src/js/card-rules.js`, `src/js/card-abilities.js`,
`game.html`, `tests/unit/run-tests.js`.

## Como Validar

1. `node tests/unit/run-tests.js`.
2. Checks de sintaxe e diff.
3. Browser: proteções de alvo, escudo consumido e permissões de ataque direto.