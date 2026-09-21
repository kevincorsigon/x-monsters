> You are only seeing this prompt; there is no context outside it.

# Motor de Habilidades - Fase 2: Ações, Eventos e Efeitos

## Objetivo e Definition of Done

Criar o resolvedor genérico que será usado pelas habilidades nas fases
seguintes, sem migrar regras específicas de cartas agora.

1. `resolveAction` valida turno, fase, fonte, custo, limite e alvos antes de
   alterar estado; falha durante a resolução restaura custo, zona, efeitos e
   uso da habilidade.
2. Eventos são processados por fila síncrona FIFO, com handlers ordenados por
   prioridade e ordem de registro, payload estável e proteção contra loops.
3. Escolhas headless pausam a ação sem pagar custos; seleção inválida e
   cancelamento não alteram estado; seleção válida retoma a mesma ação.
4. Modificadores derivados suportam substituição, soma e multiplicação em
   camadas; efeitos expiram por boundary, evento ou saída da fonte sem remover
   modificadores independentes.
5. Limites `PER_TURN` e `PER_MATCH` são consumidos somente após resolução bem
   sucedida e são consultáveis antes da ação.
6. Invocação, equipamento, fases e turnos do jogo usam o engine para custos,
   movimentos e eventos; `window.cardAbilities` recebe o engine como adaptador
   sem migrar suas habilidades legadas.
7. `node tests/unit/run-tests.js` passa cobrindo ordem, rollback, escolha,
   modificadores, expiração, cleanup e limites.

## Anti-escopo

- Não migrar habilidades individuais nem interpretar seus textos.
- Não substituir ainda o cálculo de combate; isso pertence à Fase 3.
- Não alterar balanceamento, regras de evolução, traits ou catálogo JSON.
- Não remover o motor legado nem seus mapas nesta fase.
- Não adicionar dependências, bundler, framework ou `package.json`.
- Não redesenhar a interface; o adaptador de escolha desta fase é headless.

## Orçamento

No máximo quatro arquivos de implementação:

- criar `src/js/game-engine.js`;
- modificar `game.html`;
- modificar `src/js/card-abilities.js`;
- modificar `tests/unit/run-tests.js`.

## Padrões a Seguir

### Estado único

O engine recebe o `gameState` criado por `GameStateModel`. Não cria outro
estado e não mantém cópias paralelas de PV, energia, cartas ou zonas.

### Compatibilidade

Expor `window.GameEngine` e `window.gameEngine` no browser e CommonJS no Node.
`window.cardAbilities` permanece disponível e recebe uma referência ao engine
por método explícito. Habilidades legadas continuam no caminho atual até sua
migração vertical.

### Transações

Toda mutação feita pelo resolvedor precisa possuir operação inversa. Custos,
movimentos, efeitos, modificadores e usos são confirmados juntos ou revertidos
em ordem inversa. Handlers de evento retornam descritores de efeito em vez de
manipular DOM.

### Eventos

Usar os nomes canônicos relevantes desta fase:

`TURN_STARTED`, `PHASE_STARTED`, `PHASE_ENDING`, `TURN_ENDING`, `TURN_ENDED`,
`CARD_PLAYED`, `CREATURE_SUMMONED`, `EQUIPMENT_ATTACHED`, `CARD_MOVED`,
`STATE_CHANGED` e `SOURCE_LEFT_FIELD`.

Eventos aninhados entram no fim da fila. A ordem entre handlers é prioridade
descendente e, em empate, ordem de registro.

### Modificadores e duração

Stats efetivos seguem base/substituição, soma e multiplicação. Cada modificador
tem ID, fonte, alvo, stat, operação, valor e duração. Suportar:

- `UNTIL_END_OF_TURN`;
- `UNTIL_END_OF_OPPONENT_TURN`;
- `FOR_CONTROLLER_TURNS`;
- `FOR_TARGET_CONTROLLER_TURNS`;
- `UNTIL_SOURCE_LEAVES`;
- `UNTIL_NEXT_MATCHING_EVENT`;
- `PERMANENT_ON_INSTANCE`.

### Convenções

- JavaScript ES6 sem build step.
- `camelCase` para funções/variáveis e `PascalCase` para classes/fábricas.
- APIs entre arquivos em `window`, com guards.
- Comentários e mensagens em português.
- Nenhum handler do engine usa DOM, `alert`, `prompt` ou timeout.

## Onde Trabalhar

### `src/js/game-engine.js`

Módulo puro browser/CommonJS. Implementar criação do engine, registro e emissão
de eventos, resolução/transação, descritores de efeito, escolha pendente,
limites, cálculo de stat efetivo e cleanup de duração.

### `game.html`

Carregar o engine depois de `game-state.js`; criar `window.gameEngine`; emitir
boundaries de turno/fase; resolver invocação e equipamento de modo atômico
antes de alterar o DOM. Renderizar energia depois do sucesso. Manter hooks
legados depois da resolução para não migrar habilidades nesta fase.

### `src/js/card-abilities.js`

Adicionar somente o adaptador explícito para receber o engine e um reset dos
stores legados. Não converter handlers individuais ainda.

### `tests/unit/run-tests.js`

Continuar usando `node:assert/strict`. Acrescentar cenários que falsifiquem
cada item do DoD, especialmente rollback após custo + movimento e ordem de
eventos aninhados.

## Direção

O engine deve ser declarativo e pequeno o bastante para auditar. Callbacks de
validação podem apenas ler; mutações ocorrem por descritores conhecidos. Não
oferecer um efeito `CUSTOM` irreversível. Uma ação resolvida devolve resultado
estruturado; erros esperados de regra não lançam para a UI.

## Como Validar

1. Executar `node tests/unit/run-tests.js`.
2. Executar `node --check src/js/game-engine.js` e os módulos existentes.
3. Validar o JavaScript inline de `game.html` com `node --check`.
4. Abrir `http://localhost:8765/game.html` e confirmar inicialização, mudança
   de fase/turno, invocação e equipamento sem erros de console.
5. Executar `git diff --check`.

## Documentação

Salvar auditoria em
`.vibeflow/audits/motor-habilidades-fase-2-acoes-eventos-efeitos-audit.md`.