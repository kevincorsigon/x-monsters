# Spec: PvP Online — Parte 2: Protocolo de Comandos e Determinismo da Partida

> Depende de: [part-1](pvp-online-websocket-part-1.md).
> PRD: [.vibeflow/prds/pvp-online-websocket.md](../prds/pvp-online-websocket.md)

## Objective

Os dois clientes conseguem construir partidas idênticas a partir de uma seed do
servidor e existe um contrato único, validável e testável para todo comando que
trafega entre navegador e servidor.

## Context

O motor é determinístico, mas hoje há duas fontes de aleatoriedade no cliente:
`Math.random()` no `shuffleArray` de `DeckBuilder` (`src/js/deck_system.js:73-80`)
e `Math.floor(Math.random() * 6)` no dado (`src/js/game.js:203`). Sem seed
compartilhada, dois clientes jamais montariam o mesmo deck. Não existe ainda
nenhum formato de mensagem: os comandos precisam ser definidos uma única vez e
validados nos dois lados, sem depender do DOM.

## Definition of Done

- [ ] 1. `DeckBuilder` aceita um `rng` injetável (`new DeckBuilder(cardsData, {rng})`
      e `shuffleArray(array, rng = this.rng)`, com default `Math.random`); a mesma
      seed produz decks idênticos e o caminho sem seed permanece idêntico ao atual.
- [ ] 2. `node scripts/deck_factory.js --seed=123 --size=40` imprime
      `{"p1":[40 definições],"p2":[40 definições]}` em stdout e retorna exit 0,
      sem rede e sem DOM.
- [ ] 3. `src/js/pvp-protocol.js` (UMD) valida e normaliza os comandos da v1
      (`DRAW`, `ROLL_DICE`, `SET_PHASE`, `END_TURN`, `SUMMON`, `EQUIP`, `ATTACK`,
      `DIRECT_ATTACK`, `ABILITY`, `CHOICE`, `DESTROY`, `SET_NAME`) e rejeita, com
      motivo em pt-BR, comando desconhecido, ator inválido, argumentos faltando e
      `reveals` malformado.
- [ ] 4. `stateHash(state)` é determinístico para o mesmo estado e sensível a
      mudança em PV, energia, fase, turno, tamanho de zonas e `pendingChoice`.
- [ ] 5. Testes novos em `tests/unit/run-tests.js` (mínimo 6 casos) cobrindo 1–4,
      todos passando.
- [ ] 6. Zero regressão: `node tests/unit/run-tests.js` exit 0 (150 pré-existentes
      + novos) e `py -3 scripts/check_cards.py` exit 0.
- [ ] 7. Craftsmanship Gate: módulos UMD (`module.exports` + `window.*`) como
      `game-state.js`; camelCase/PascalCase conforme `conventions.md`; nenhum
      `Math.random` novo fora do default do `rng`; nenhum dado de carta duplicado
      em JS; nenhum `Date.now()` usado como id.

## Scope

- `src/js/pvp-protocol.js` (novo) — tabela de comandos com validador por comando,
  normalizador (`{cmd, args, reveals}`) e `stateHash` (projeção canônica: turno,
  jogador/fase atual, PV/energia/maxEnergy, `.length` das 5 zonas de cada jogador,
  nº de `cardInstances`, `.length` de `effects` e `pendingChoice.id`), hash
  FNV-1a estável, sem depender de ordem de chaves.
- `src/js/deck_system.js` — injetar `rng` em `DeckBuilder` e `shuffleArray`
  (parâmetro com default `Math.random`); sem outras mudanças.
- `scripts/deck_factory.js` (novo) — CLI Node (`--seed`, `--size`) que reusa
  `DeckBuilder` de `src/js/deck_system.js` com RNG determinístico (mulberry32) e
  imprime os dois decks; é o que o `server.py` chama na criação da sala.
- `tests/unit/run-tests.js` — casos novos descritos no DoD.

## Anti-scope

- Não criar a UI PvP, `pvp.html` ou hooks em `game.js` — parte 4.
- Não criar placeholders/`reveals` de estado oculto — parte 3 (aqui só o formato
  e a validação do campo `reveals`).
- Não implementar o servidor em Python nem o smoke test — parte 1.
- Não alterar `card-rules.js`, `game-engine.js`, `game-state.js`, `game.html`.
- Não criar um framework de validação genérica nem dependências npm.
- Não trocar o formato de id do `game.html` (o `idFactory` opaco é assunto da
  parte 3).

## Technical Decisions

1. **Comando semântico, não ação serializada**: as ações da UI carregam closures
   (`validators`, `effects` com `EFFECT_KINDS` — `src/js/game.js:2054-2104`),
   impossíveis de trafegar. O protocolo carrega só a intenção + parâmetros
   (`SUMMON {handSlot, cardId}`), e cada cliente remonta a ação com seu código.
2. **RNG injetável em vez de substituir `Math.random`**: manter o default
   `Math.random` garante zero mudança de comportamento em `game.html` e nos 150
   testes existentes; só o caminho PvP passa RNG determinístico.
3. **`deck_factory.js` em Node, não em Python**: duplicar o balanceamento de
   decks (60/30/10 + faixas de custo, `deck_system.js:54-99`) em Python criaria
   duas fontes de verdade. Node já é dependência de desenvolvimento do projeto.
4. **Hash FNV-1a em JS puro**: suficiente para detectar divergência entre
   clientes; criptografia não é requisito e não deve trazer dependência.
5. **`stateHash` como projeção pública**: o hash não pode incluir identidade de
   cartas ocultas, senão o próprio hash vaza informação (ex.: contagem de
   definições distintas). Por isso só contagens e campos públicos entram.

## Applicable Patterns

- `patterns/deck-loading-and-card-data.md` — `DeckBuilder` continua sendo a
  única fonte de composição de deck; a seed apenas troca a fonte de aleatoriedade.
- `patterns/automated-unit-tests.md` — testes em `tests/unit/run-tests.js` com
  `node:assert`, sem framework.
- `patterns/event-effect-engine.md` — módulos UMD (`module.exports` + `window.*`).

## Risks

- **Risco**: o `stateHash` não detectar divergência real (falso negativo) e o
  bug aparecer só no meio de uma partida.
  - *Mitigação*: a projeção cobre zonas, stats, fase, turno, efeitos e escolha
    pendente; o teste do DoD 4 exige sensibilidade a cada grupo.
- **Risco**: `mulberry32` no `deck_factory` divergir do `rng` usado no navegador
  e os decks não baterem.
  - *Mitigação*: `deck_factory.js` e o cliente usam a mesma implementação de RNG
    injetada em `DeckBuilder`; o cliente nunca gera decks — recebe-os prontos do
    servidor (parte 3), então a divergência só poderia existir no texto do deck.
- **Risco**: validação no cliente virar a única barreira e um comando malformado
  travar o `gameEngine`.
  - *Mitigação*: `pvp-protocol.js` é o único ponto de entrada de comando no
    cliente (parte 3) e rejeita antes de tocar no motor.
- **Risco**: `stateHash` divergir por campos de UI (`attackingCard`,
  `selectedCard`) que são cosméticos.
  - *Mitigação*: a projeção lista explicitamente os campos incluídos; campos de
    UI ficam de fora.

## References

- `src/js/deck_system.js:54-99` — `selectBalancedByMana` / `createMatchDecks`, o
  comportamento a preservar sob seed.
- `src/js/game.js:203` — dado atual via `Math.random`, a ser substituído por
  `DICE_RESULT` do servidor na parte 4.
- `tests/unit/run-tests.js` — suíte a estender (150 testes hoje).
- `src/js/game-state.js:132-161` — `resetMatchState`, chamado com os decks
  produzidos pela seed.