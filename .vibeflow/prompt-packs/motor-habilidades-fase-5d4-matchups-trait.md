> You are only seeing this prompt; there is no context outside it.

# Motor de Habilidades - Fase 5D4: Matchups por Trait

## Objetivo e Definition of Done

Migrar `095`, `102` e `105`.

1. Manto causa 15 de dano de habilidade ao atacante Vampiro/Lobisomem quando o
   host vira alvo; Iron bloqueia, Golem não.
2. Estaca equipa somente Guerreiro/Humanoide e concede +10 ATK/dano apenas
   contra Vampiro/Lobisomem.
3. Manoplas concede +15 dano apenas contra criatura com trait fogo.
4. Equipamentos não aplicam stats numéricos implícitos e limpam ao sair.
5. Traits vêm do mapa explícito; estado/DOM/rollback/testes passam.

## Anti-escopo

- Nenhuma negação ativa ou bypass defensivo.
- Nenhuma dependência.

## Orçamento

Dois arquivos: `src/js/card-rules.js`, `tests/unit/run-tests.js`.

## Como Validar

`node tests/unit/run-tests.js`, sintaxe/diff e smoke browser.