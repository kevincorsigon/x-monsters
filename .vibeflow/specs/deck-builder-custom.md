# Spec: Deck Builder — Criação, Edição e Exclusão de Decks Customizados

## Objective
Criar a página `deck-builder.html` para montar decks customizados (40 cartas), com seleção de cartas, visualização do deck, stats em tempo real (afinidade, traits, custo), metadados (nome, tema, descrição, cores, emblema emoji) e persistência em `data/decks.json` com `custom:true`, listados no seletor após os decks oficiais e o aleatório, com exclusão mediante confirmação.

## Context
Hoje `data/decks.json` guarda só presets oficiais (só ids de `cards_database.json`); `DeckSelect.opcoes()` retorna `[...catalogo, aleatorio]`; `loadDeckCatalog()` lê via `fetch`; `server.py:deck_presets()` resolve a escolha PvP; `resumoDeDeck`/`getDeckStats` calculam curva/custo; não há escrita de decks nem UI de construção.

## Definition of Done
- [ ] 1. `deck-builder.html` abre sem servidor de jogo, lista as 110 cartas com busca/filtro (nome, tipo, custo, trait) e adiciona ao deck respeitando `DECK_SIZE=40` e `limiteDeCopias()` (card_089 x1, resto x3).
- [ ] 2. Painel do deck agrupa cópias (miniatura `deck-card-mini` + ×N, +/-/remover) e recalcula em tempo real: total, criaturas/suportes/evoluções, custo médio, curva 1–3/4–6/7+, contagem por trait e 3 afinidades (dominância da trait principal, % criaturas no tema, sinergia de equipamento via `CardRules.getEquipmentRule` + `hasTrait` com ≥3 hospedeiros).
- [ ] 3. Formulário valida: nome (1–40), tema, descrição, 3 `<input type=color>` (primaria/secundaria/acento), traits do tema (checkboxes de `TRAIT_LABELS`), emblema (grade ~20 emojis + texto livre de 1 emoji); salvar exige 40 cartas e bloqueia com mensagem pt-BR caso contrário.
- [ ] 4. Salvo persiste em `data/decks.json` com `{id:"custom-*", custom:true, criadoEm}` via `POST /api/decks` (validação: 40 cartas, ids existem, teto de cópias, id único) com fallback `localStorage xmDecksCustom` sob `http.server`; `loadDeckCatalog()` faz merge JSON+local.
- [ ] 5. Seletor (`game.html`, entrada `pvp.html`) ordena `[...oficiais, aleatorio, ...customs]` com separador "Meus decks" + badge custom; customs jogáveis em hotseat e PvP (`deck_presets()` inclui customs).
- [ ] 6. Listagem "Meus decks" no builder e no seletor tem Excluir só em `custom:true`, com confirmação obrigatória em `gameDialogModal` ("Excluir «Nome»?" + Confirmar/Cancelar); confirmar faz `DELETE /api/decks/<id>` (ou remove do localStorage), invalida caches, re-renderiza; cancelar mantém.
- [ ] 7. `node tests/unit/run-tests.js` 100% + `node scripts/deck_synergy_audit.js --check` verde (ignora `custom:true`).

## Scope
- `deck-builder.html` (novo): layout catálogo + deck + formulário; carrega `game-state.js, game-engine.js, card-rules.js, deck_system.js, deck-select.js, deck-builder.js`.
- `src/js/deck-builder.js` (novo): estado draft, filtros, add/remove, stats/afinidades, form, save/delete, merge localStorage.
- `src/css/deck-builder.css` (novo): reuso das vars `--deck-primaria/secundaria/acento`, grid catálogo/deck, `color-picker` nativo, grade de emojis.
- `src/js/deck_system.js`: `normalizarCatalogoDeDecks` preserva `custom/criadoEm`; `loadDeckCatalog()` merge + `recarregarCatalogo()`; `validarDeckCustom()`; `salvarDeckCustom()`/`excluirDeckCustom()` (fetch + localStorage).
- `src/js/deck-select.js`: `opcoes()` ordena oficiais→aleatório→customs; separador + badge; botão excluir com `gameDialogModal`; `pedirConfirmacao()` genérico (usa `#gameDialogModal` quando existe, senão `confirm()`).
- `src/js/game.js`: implementa `closeGameDialog()`/`confirmGameDialog()`/`showGameConfirm()` globais (hoje o markup chama funções inexistentes).
- `server.py`: `POST /api/decks` + `DELETE /api/decks/<id>` em `handle_api`, escrita atômica em `data/decks.json`, invalida `_DECK_PRESETS`.
- `scripts/deck_synergy_audit.js`: `--check` pula `custom:true` (cobertura 110/110 só oficiais).
- `tests/unit/run-tests.js`: validação custom, ordenação, DELETE remove, oficiais sem excluir.

## Anti-scope
- Não duplicar definições de carta fora de `cards_database.json`; não alterar regras em `card-rules.js`/`game-engine.js`; não mudar balanceamento dos oficiais; não adicionar npm/framework; não permitir excluir preset oficial ou aleatório; não expor deck alheio no PvP.

## Technical Decisions
- **Afinidade = 3 indicadores**: dominância (`max trait/criaturas`), adesão ao tema (`criaturas com trait do tema/criaturas`), sinergia de equipamento (`suportes com regra que têm ≥3 hospedeiros/suportes com regra`); reuso de `getEquipmentRule/hasTrait`, mesma lógica do audit.
- **Escrita via servidor**: `fetch` estático não escreve arquivo; `POST/DELETE /api/decks` segue `handle_api`, escrita tmp+replace como `write_ledger_sync`; fallback localStorage mantém o builder utilizável sob `py -m http.server`.
- **Confirmação padrão**: reutilizar `gameDialogModal` (Confirmar/Cancelar), nunca `alert()`/`confirm()` nativo como primeira opção.
- **IDs**: `custom-<slug>-<rand4>`; edição futura via `PUT` só em `custom:true` (fora deste escopo).

## Applicable Patterns
- `patterns/deck-loading-and-card-data.md`, `patterns/card-dom-rendering.md`, `patterns/pvp-online-server.md`, `patterns/automated-unit-tests.md`.

## Risks
- **Risco**: `decks.json` editado à mão com custom inválido quebra o seletor. *Mitigação*: `normalizarCatalogoDeDecks` filtra inválidos + warn.
- **Risco**: corrida entre boots paralelos em `loadDeckCatalog`. *Mitigação*: reusar `decksCatalogPromessa` existente.
