> You are only seeing this prompt; there is no context outside it.

# Motor de Habilidades - Fase 4B1: Modificadores Simples

## Objetivo e Definition of Done

Migrar cinco habilidades sem seleção manual:

- `card_001` Espada Mágica: equipamento +5 ATK/+5 DEF.
- `card_004` Chocolicia: equipamento hostil -10 ATK/-10 DEF.
- `card_009` Abutuaram: equipamento hostil -15 DEF.
- `card_017` Bufaboi: primeiro ataque do turno causa +10 de dano.
- `card_019` Garras Afiadas: +10 ATK no ataque contra criatura invocada no
  turno atual.

DoD:

1. As cinco cartas possuem regras únicas no registry e não executam handlers
   legados duplicados.
2. Equipamentos aplicam exatamente os números do texto, não os campos numéricos
   do JSON, e removem seus modificadores quando a fonte sai de `equipment`.
3. Bufaboi aplica +10 somente no primeiro ataque de cada turno, normal ou
   direto, sem alterar ATK base.
4. Toda criatura invocada recebe marcador até o fim do próximo turno do
   adversário de seu controlador; Garras ganha +10 ATK/dano somente ao atacar
   alvo com marcador ativo.
5. Estado, combate e DOM exibem os mesmos stats; rollback remove modificadores
   e marcadores criados pela ação falha.
6. Suíte completa e smoke browser com os cinco IDs passam.

## Anti-escopo

- `card_026` fica no lote 4B2 por exigir ativação e seleção na UI.
- Não migrar outras cartas, traits, imunidades ou ataques especiais.
- Não alterar números do JSON; a regra estruturada é a fonte executável.
- Não adicionar dependências.

## Orçamento

Quatro arquivos: `src/js/card-rules.js`, `src/js/card-abilities.js`,
`game.html` e `tests/unit/run-tests.js`.

## Padrões a Seguir

- Regras retornam descritores; nenhum DOM no registry.
- Modificadores de equipamento usam `UNTIL_SOURCE_LEAVES`.
- Marcador de recém-invocada usa `UNTIL_END_OF_OPPONENT_TURN` a partir do
   controlador da criatura invocada.
- O engine permanece owner único; legado apresenta apenas feedback.
- Browser e CommonJS devem continuar funcionando.

## Como Validar

1. `node tests/unit/run-tests.js`.
2. Checks de sintaxe dos módulos e script inline.
3. Browser: equipar 001/004/009, atacar com 017/019 e conferir estado/DOM.
4. `git diff --check`.