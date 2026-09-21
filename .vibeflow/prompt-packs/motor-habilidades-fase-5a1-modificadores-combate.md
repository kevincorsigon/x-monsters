> You are only seeing this prompt; there is no context outside it.

# Motor de Habilidades - Fase 5A1: Modificadores de Combate

## Objetivo e Definition of Done

Migrar `021`, `022`, `032`, `056`, `064`, `066`, `070`, `074`, `076`, `078`
e `103` para as janelas canônicas de combate.

1. Paladar dobra ATK/dano na condição; Hipool adiciona 10 dano na condição.
2. Puma e Minotauro fazem ATK completo penetrar; Gamaa ignora 10 DEF por robô;
   Tiranossauro ignora 10 e Lobo Alfa ignora 20 para penetração.
3. Mexica dobra o primeiro ataque por turno; Condessa usa ATK-15 e recebe +10
   ATK permanente/cumulativo por abate.
4. Nucles reduz dano físico recebido em 10; Couraça reduz 10 contra atacante de
   custo >=8 enquanto equipada.
5. Modificadores não alteram base, respeitam ataque normal/direto declarado e
   participam de rollback.
6. Estado/DOM, testes e browser passam sem handlers legados duplicados.

## Anti-escopo

- Gárgula (troca opcional) e equipamentos com seleção ficam em lotes próprios.
- Não implementar ataques em área, reflexão ou imunidades.
- Nenhuma dependência.

## Orçamento

Quatro arquivos: `src/js/game-engine.js`, `src/js/card-rules.js`,
`src/js/card-abilities.js`, `tests/unit/run-tests.js`.

## Como Validar

`node tests/unit/run-tests.js`, sintaxe/diff e smoke browser representativo.