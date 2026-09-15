# Spec: Correção de Stats de Equipamento (Flecha de Prata), Botão de Fechar e Padronização de Diálogos/Alerts

## Objective
1. Corrigir a regra de equipamento da carta **Flecha de Prata (`card_097`)** em `src/js/card-rules.js` para aplicar o bônus canônico de **+8 de Ataque** ao hospedeiro equipado (ex.: Paladino Crepuscular).
2. Ajustar o posicionamento do botão de fechar (`.modal-close`) para `top: 12px; right: 12px;` e garantir que não seja cortado pelo `overflow: hidden` do container `.modal-card` e `.discard-modal-content`.
3. Padronizar todas as notificações, alerts nativos (`window.alert`) e popups com ações para um componente de diálogo modal e toasts consistentes com o tema visual TCG do jogo.

## Context
- **Flecha de Prata**: Definida no catálogo `data/cards_database.json` com `attack: 8, defense: 0` e texto *"Equipa em qualquer monstro humanoide ou besta. Ao atacar, ignora todas as habilidades especiais defensivas do monstro alvo."*. Em `src/js/card-rules.js`, a entrada `card_097` em `EQUIPMENT_RULES` estava com `modifiers: {}`, fazendo com que o bônus de +8 não fosse somado ao monstro equipado.
- **Botão de Fechar**: O botão `.modal-close` estava com `position: absolute; top: -10px; right: -10px;` dentro de um container com `overflow: hidden; border-radius: 20px;`, fazendo com que o botão ficasse cortado/invisível para fora do container.
- **Alerts e Popups**: Atualmente existem 16 chamadas de `alert()` nativo do navegador convivendo com `showMessage(...)` e modais, gerando inconsistência visual e quebrando a imersão de jogo de cartas.

## Definition of Done
- [ ] 1. **Zero regressão**: `node tests/unit/run-tests.js` continua 100% passando (com novo teste adicionado).
- [ ] 2. **Flecha de Prata com +8 ATK**: Teste unitário confirmando que equipar `card_097` em um hospedeiro humanoide/besta concede +8 de ataque efetivo.
- [ ] 3. **Botão de Fechar Totalmente Visível**: `.modal-close` reposicionado internamente (`top: 12px; right: 12px;`), estilizado e sem corte por `overflow`.
- [ ] 4. **Padronização de Diálogos e Alertas**: Sistema `showGameAlert(...)` e `showGameConfirm(...)` no padrão visual TCG (borda dourada, Cinzel, botões com ação), interceptando ou substituindo os alerts nativos.
- [ ] 5. **Toast `showMessage` Refinado**: Padronizado para mensagens rápidas durante a partida sem interromper o fluxo de drag-and-drop.

## Scope
- `src/js/card-rules.js`: Atualizar `card_097` em `EQUIPMENT_RULES` para `modifiers: { attack: 8 }`.
- `tests/unit/run-tests.js`: Adicionar teste unitário de verificação de stat de equipamento para a Flecha de Prata.
- `game.html`:
  - CSS: Ajustar `.modal-close`, adicionar estilos para `.game-dialog-modal`, `.game-dialog-card`, `.game-dialog-btn`.
  - HTML: Inserir a estrutura do `#gameDialogModal`.
  - JS: Adicionar funções `showGameDialog`, `showGameAlert`, `showGameConfirm`, redirecionar `window.alert` e substituir `alert(...)` diretos.

## Anti-scope
- Não alterar lógica de combate de outras cartas.
- Não alterar banco de dados `data/cards_database.json`.
- Não introduzir frameworks externos.
