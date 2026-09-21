> You are only seeing this prompt; there is no context outside it.

# Motor de Habilidades - Fase 5B1: Reações e Abates

## Objetivo e Definition of Done

Migrar `029`, `030`, `036`, `042`, `052`, `054`, `071` e `108`.

1. Aladar recupera um ataque após abate; Rei das Feras e Dragão de Cobre causam
   10 PV ao controlador derrotado.
2. Cacton reflete metade do dano físico recebido, arredondada para baixo;
   Dragão de Jade causa 10 ao atacante quando vira alvo.
3. Fantom substitui morte por retorno à mão e limpa seu dano.
4. Lorde transfere até 10 PV uma vez por turno após abate.
5. Aura de Vingança causa ao PV o ATK efetivo pré-morte do equipado e valida
   alvo `elite`; não concede stats numéricos implícitos.
6. Morte simultânea, snapshots e rollback preservam ordem/estado; suíte e
   browser passam sem handlers legados.

## Anti-escopo

- Golem (imunidade) e Superior (escolha no descarte) ficam em outros lotes.
- Nenhuma reflexão genérica, UI nova ou dependência.

## Orçamento

Quatro arquivos: `src/js/game-engine.js`, `src/js/card-rules.js`,
`src/js/card-abilities.js`, `tests/unit/run-tests.js`.

## Como Validar

`node tests/unit/run-tests.js`, sintaxe/diff e smoke browser representativo.