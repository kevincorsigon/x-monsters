# Spec: Ajustes de Mecânicas de Campo, Evolução, Retorno à Mão, Descarte, Dado da Sorte, Energia e Nome do Jogador

## Objective
Garantir a integridade entre o estado canônico do jogo (`gameState` / `GameEngine`) e a interface gráfica (`game.html`) para equipagem com alvo negado, retorno à mão com custo zero, descarte de campo, evolução com descarte de base/equipamentos, animação e sincronização do dado da sorte, automação de energia sem botões manuais e persistência de nome do jogador.

## Context
Atualmente, ocorrem divergências visuais e de sincronização entre o DOM e o estado:
1. Ao tentar jogar ou equipar cartas de suporte em alvos inválidos (ou soltá-las no campo vazio), a carta pode ser invocada erroneamente como criatura ou permanecer órfã no campo em vez de retornar à mão.
2. Efeitos de retorno à mão (como Trox e Gobra) ou de descarte em massa (como Baltz) alteram o estado canônico no motor, mas `renderFieldsFromState()` não expurga nós órfãos do DOM do campo e `renderHandsFromState()` não era invocado após ativações em `manual_abilities.js`.
3. Cartas que voltam para a mão com custo zero de reinvocação (Trox) precisam manter custo 0 garantido na UI e motor, sem descontar energia no summon.
4. Na evolução, a base e os equipamentos são descartados no estado, porém no DOM a carta base e os equipamentos permaneciam visíveis ao lado da evolução.
5. O dado da sorte aplicava valores via popup `alert()`, sem animação imersiva, e a energia não recalculava limpamente entre turnos.
6. Os botões manuais de `+` e `-` de energia permitiam alterações arbitrárias não reguladas pelo motor, quando a energia deve ser calculada automaticamente no turno 1 e incrementada/recarregada nas trocas de turno.
7. A edição de nome do jogador alterava apenas o texto do DOM, sem atualizar a propriedade `name` no `gameState.players`.

## Definition of Done
- [ ] 1. **Equipamento negado retorna à mão**: Cartas de suporte soltas no campo vazio ou com validação negada (ex: restrição de trait incompatível) retornam visualmente e estruturalmente para a mão, sem ficar no campo.
- [ ] 2. **Retorno à mão sincronizado e custo zero**: Efeitos de devolução à mão (Trox, Gobra, etc.) removem a carta do campo no DOM, renderizam-na na mão, e invocações de custo zero (como a reinvocação de Trox) entram em campo debitando 0 de energia.
- [ ] 3. **Efeitos de descarte limpam o campo**: Cartas descartadas por efeitos (Baltz, Adubaram, etc.) têm seus elementos removidos do campo no DOM (incluindo equipamentos anexados) e o contador do cemitério é atualizado.
- [ ] 4. **Evolução descarta base e equipamentos no DOM**: Ao invocar uma evolução sobre uma criatura base, a criatura base e seus equipamentos são removidos da tela e movidos para o descarte, ficando apenas a carta de evolução em campo.
- [ ] 5. **Dado da Sorte animado e sincronizado com o turno**: O dado possui animação visual de rolagem (sem depender de `alert()` bloqueante), registra o ganho de pontos no `gameState` e na UI, e ao trocar de turno a energia é recalculada/resetada sem acumular bônus indevidos.
- [ ] 6. **Automação de energia e remoção de botões +/-**: Os botões manuais de adicionar e diminuir energia são removidos do painel; no primeiro turno e nas trocas de turno, a energia é definida automaticamente baseada em `maxEnergy`.
- [ ] 7. **Nome no estado e zero regressão**: Alteração de nome persiste em `gameState.players[p].name` e reflete na interface; `node tests/unit/run-tests.js` executa com 100% de sucesso incluindo novos testes unitários.

## Scope
- `src/js/game-state.js`:
  - Adicionar suporte a `name` em `createPlayerState`, `getPlayerName` e `setPlayerName`.
- `src/js/card-rules.js`:
  - Consumir o modificador de custo zero de Trox após a invocação (evento `CREATURE_SUMMONED`).
- `src/js/manual_abilities.js`:
  - Após ativação de habilidade, invocar `renderHandsFromState()` e sincronizar o campo com `renderFieldsFromState()`, garantindo remoção de cartas que saíram do campo (seja a fonte ou os alvos).
- `game.html`:
  - Bloquear invocação de cartas do tipo `suporte` diretamente no campo em `dropCard`; devolver à mão com feedback quando a equipagem for inválida.
  - Na evolução em `dropCard`, remover a carta base e equipamentos anexados do DOM imediatamente, sincronizando descartes.
  - Reestruturar `renderFieldsFromState()` para sincronização estrita (remover elementos do DOM que não existem em `gameState.cards[player].field`).
  - Remover botões manuais `+` e `-` do bloco de energia dos jogadores.
  - Implementar animação visual do dado da sorte integrada ao tema visual (overlay ou efeito dinâmico) e garantir reset correto no `endTurn`.
  - Integrar `editName(player)` com `GameStateModel.setPlayerName` e atualizar textos dependentes (turno, título da mão/descarte).
- `tests/unit/run-tests.js`:
  - Testes para persistência de nome do jogador, consumo do custo zero de Trox, e rejeição de invocação direta de suporte.

## Anti-scope
- Não alterar as regras ou atributos das cartas em `data/cards_database.json`.
- Não remover os botões manuais de PV (Pontos de Vida).
- Não adicionar frameworks ou dependências externas (manter ES6 Vanilla e Node assert).

## Technical Decisions
- **Sincronização reativa do campo (`renderFieldsFromState`)**: Em vez de depender apenas de deleções pontuais no momento da ação, `renderFieldsFromState` removerá qualquer elemento filho do container `#field-${player}` cujo `instanceId` não esteja mais na lista canônica `gameState.cards[player].field`. Isso previne qualquer descompasso visual (fantasmas no campo).
- **Tratamento de drop de suporte**: Em `dropCard`, se `cardData.data.type === 'suporte'`, validar se o drop foi feito diretamente em uma criatura. Se foi no campo livre, cancelar a ação e emitir aviso via toast, mantendo a carta na mão.
- **Remoção de alert bloqueante no dado**: Criar modal/overlay leve de animação de dados com faces 1 a 6 rotacionando via CSS/JS e finalizando no número sorteado, disparando o feedback sem interromper o loop de eventos com `alert()`.
- **Nome no modelo**: Armazenar `name: 'Jogador 1' | 'Jogador 2'` em `createPlayerState`, permitindo que todo o sistema consulte o nome oficial do jogador sem recorrer a seletores de DOM.

## Applicable Patterns
- `patterns/game-state-management.md`: Estado único canônico em `GameStateModel`.
- `patterns/event-effect-engine.md`: Ações, eventos e efeitos atômicos via `GameEngine`.
- `patterns/card-dom-rendering.md`: Renderização baseada em classes CSS e sincronização com o modelo.
- `patterns/automated-unit-tests.md`: Testes automatizados em `tests/unit/run-tests.js`.

## Risks
- **Risco**: `renderFieldsFromState` re-renderizar cartas e perder listeners ou animações em andamento.
  - *Mitigação*: Atualizar elementos existentes in-place e remover apenas os nós filhos órfãos (que não estão mais na zona do campo).
- **Risco**: Cartas com custo modificado (Trox) perderem o modificador antes do summon.
  - *Mitigação*: Limpar o modificador `free_resummon` especificamente ao receber o evento `CREATURE_SUMMONED` da mesma instância.
