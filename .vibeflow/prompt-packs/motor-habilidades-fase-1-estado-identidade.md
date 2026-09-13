> You are only seeing this prompt; there is no context outside it.

# Motor de Habilidades - Fase 1: Estado e Identidade

## Objetivo e Definition of Done

Criar a fundação de estado canônico necessária ao futuro motor de habilidades,
sem migrar regras de cartas nesta fase.

1. Cada carta da partida possui `instanceId` único, `definitionId`, `ownerId`,
   `controllerId` e `zone`.
2. Cada instância ocupa exatamente uma zona e sacar move a mesma instância do
   deck para a mão, sem wrapper ou inserção duplicada.
3. Mão, campo, descarte e deck permanecem acessíveis pelos caminhos legados de
   `gameState`, mas são aliases das zonas canônicas.
4. PV, energia e energia máxima vivem em `gameState`; toda alteração muda o
   estado antes de atualizar o DOM.
5. Reiniciar a partida limpa zonas e estado transitório, recria decks e mãos e
   não deixa referências da partida anterior.
6. `node tests/unit/run-tests.js` passa com cenários de identidade, movimento,
   compra, stats, aliases e reset.

## Anti-escopo

- Não implementar ou reinterpretar habilidades de cartas.
- Não alterar regras de combate, balanceamento ou composição dos decks.
- Não redesenhar a interface.
- Não adicionar biblioteca, bundler, framework ou `package.json`.
- Não corrigir o fallback desatualizado nesta fase.
- Não remover ainda o motor de habilidades ou os diagnósticos legados.

## Orçamento

No máximo 4 arquivos de implementação:

- criar `src/js/game-state.js`;
- criar `tests/unit/run-tests.js`;
- modificar `game.html`;
- modificar `src/js/deck_system.js`.

Este prompt pack é artefato da etapa anterior da metodologia e não integra o
orçamento de implementação.

## Padrões a Seguir

### Estado global e compatibilidade

O jogo existente usa um único `gameState` e APIs globais. Não criar um segundo
estado concorrente. O novo módulo deve construir e operar o mesmo objeto,
publicado como `window.gameState`, e manter temporariamente:

```javascript
gameState.cards.p1.hand
gameState.cards.p1.field
gameState.cards.p1.discard
gameState.decks.p1
```

Esses arrays devem referenciar as mesmas zonas em
`gameState.players.p1.zones`. A compatibilidade é uma ponte de migração, não
uma cópia de dados.

### Dados e instâncias

O catálogo contém definições imutáveis com:

```javascript
{ name, type, cost, attack, defense, hability, id, image }
```

Uma definição não é uma carta em partida. Ao criar o deck da partida, gerar
uma instância com identidade e cópia própria dos dados. O ID usado pelo DOM e
pelos lookups é o `instanceId`; `definitionId` preserva o ID do catálogo.

### Renderização

O DOM é projeção. Funções de regra alteram o estado primeiro e então atualizam
o elemento correspondente. O `id` do elemento de carta deve ser igual ao
`instanceId`. Manter o HTML/CSS e o drag-and-drop atuais.

### Convenções

- JavaScript ES6 sem build step e sem módulos ES.
- `camelCase` para funções/variáveis e `PascalCase` apenas para classes.
- APIs entre arquivos expostas em `window` com existência verificada.
- Textos de UI, comentários e logs em português.
- Não duplicar o catálogo JSON.

## Onde Trabalhar

### `src/js/game-state.js`

Novo módulo puro, utilizável no navegador e via CommonJS no Node. Deve expor
operações para criar estado, criar instâncias, iniciar/resetar zonas, mover
cartas, sacar e ler/alterar stats dos jogadores. Aceitar fábrica de IDs
injetável para testes determinísticos.

### `src/js/deck_system.js`

`startNewMatch` recebe definições do `DeckBuilder`, cria instâncias no deck e
distribui as cinco cartas iniciais. `drawCardFromDeck` apenas move e devolve a
mesma instância; não cria nem reinsere wrappers.

### `game.html`

Carregar `game-state.js` antes dos consumidores. Criar `gameState` pelo módulo,
publicá-lo em `window`, usar stats canônicos em `changeStat`, edição, custos,
fim de turno e reset, e fazer `createCard` preservar a identidade recebida.
Movimentos mão/campo/descarte devem passar pela operação canônica.

### `tests/unit/run-tests.js`

Usar `node:assert/strict`, sem runner externo. Falhar com código diferente de
zero e cobrir cada item da DoD que não depende do browser.

## Direção

Entregue apenas a fundação descrita. Faça julgamentos rotineiros mantendo a
compatibilidade do código existente. Quando um caminho legado precisar
continuar acessível, use alias para o dado canônico em vez de sincronização
manual entre cópias. Não tome decisões sobre textos de habilidades.

## Como Validar

1. Executar `node tests/unit/run-tests.js`.
2. Executar `node --check src/js/game-state.js` e
   `node --check src/js/deck_system.js`.
3. Servir com `py -3 -m http.server 8000`, abrir `game.html` e confirmar que
   mãos, PV e energia aparecem sem erros de console.
4. Executar `git diff --check`.

## Documentação

Não atualizar guias antigos nesta fase. O resultado será auditado contra
`.vibeflow/specs/motor-habilidades-eventos-e-efeitos.md` e este prompt pack.