# Spec: PvP Online — Parte 5: Fim de Partida, Reconexão, Rematch e Habilidade Manual

> Depende de: [part-1](pvp-online-websocket-part-1.md),
> [part-2](pvp-online-websocket-part-2.md),
> [part-3](pvp-online-websocket-part-3.md),
> [part-4](pvp-online-websocket-part-4.md).
> PRD: [.vibeflow/prds/pvp-online-websocket.md](../prds/pvp-online-websocket.md)

## Objective

A partida fecha nos dois navegadores com um novo link para jogar outra, um F5 no
meio da partida reconecta sem perder o estado, e as habilidades ativadas
manualmente passam pelo servidor como qualquer outra jogada.

## Context

O fim de jogo hoje é local: `changeStat` detecta PV ≤ 0 e chama `endGame`
(`src/js/game.js:54-141`), que desenha um overlay com "Nova partida" chamando
`resetGame()` (`947-988`) — num fluxo PvP isso recomeçaria a partida apenas no
navegador de um jogador. As habilidades manuais têm painel próprio
(`src/js/manual_abilities.js:121`) chamando `activateMigratedAbility(cardId)`,
que muta estado direto pelo motor (`manual_abilities.js:180-203`) — sem comando,
o oponente nunca veria o efeito. E não existe nenhum mecanismo de retomada: a
parte 1 guarda o log de comandos por sala, mas ninguém o reproduz.

## Definition of Done

- [ ] 1. Ao zerar PV, os dois clientes exibem o mesmo vencedor e
      `matches/<roomId>.json` recebe `result` (`{winner, reason, turn, at}`); o
      arquivo permanece JSON válido.
- [ ] 2. F5 durante a partida reconecta pelo mesmo link, o servidor responde com
      `MATCH_START` + `COMMAND_LOG`, o cliente reaplica o log e o `stateHash`
      local passa a bater com o do servidor (evidência no audit).
- [ ] 3. "Nova partida" leva de volta ao lobby e cria uma sala nova com links
      novos; a sala anterior fica `finished` e rejeita novos comandos.
- [ ] 4. `ABILITY` manual funciona replicada: ativar uma habilidade de carta em
      campo (ex.: `card_039`/Trox, que devolve a carta à mão com custo 0) produz
      os mesmos PV, energia, mão e campo nos dois clientes
      (`node tests/unit/run-tests.js` cobre o builder do comando; o smoke test
      cobre o relay).
- [ ] 5. `py -3 tests/pvp/smoke_match.py` passa cobrindo, na mesma execução:
      partida até o fim, reconexão de um assento e criação de nova sala;
      `node tests/unit/run-tests.js` exit 0.
- [ ] 6. Craftsmanship Gate: salas `finished` são removidas da memória após um
      TTL (sem crescimento ilimitado); `COMMAND_LOG`, `GAME_OVER` e
      `matches/<roomId>.json` não contêm identidade de carta que nunca foi
      revelada; logs e mensagens em pt-BR.

## Scope

- `server.py` — `GAME_OVER` (registro do resultado já validado pelo ledger,
  escrita de `result`, estado `finished`), `COMMAND_LOG` no `HELLO` de
  reconexão, assento liberado para reconectar no mesmo assento, limpeza de salas
  finalizadas por TTL e `POST /api/matches` sempre criando sala nova.
- `src/js/pvp-game.js` — overlay de fim de partida PvP (vencedor + link novo),
  `GAME_OVER` recebido do servidor, retomada por replay (`COMMAND_LOG`),
  `SET_NAME` e bloqueio de interação após o fim.
- `src/js/manual_abilities.js` — `activateMigratedAbility` passa a enviar
  `ABILITY {cardId, abilityId, targetIds}` via `PvpSession` quando em modo PvP,
  mantendo o caminho local atual quando não há sessão.
- `pvp.html` — badge de estado da conexão ("reconectando…"), botão de nova
  partida e textos em pt-BR.

## Anti-scope

- Não criar torneio, placar, histórico de partidas, ranking ou replay visual.
- Não persistir salas entre reinícios do servidor: o log em memória morre com o
  processo; `matches/*.json` é auditoria.
- Não implementar anti-cheat de reconexão (roubo de assento está fora do escopo).
- Não alterar `game.html`, `index.html`, `card-rules.js`, `game-engine.js`,
  `game-state.js`.
- Não criar espectador nem permitir terceiro cliente assistindo.
- Não reenviar segredo de mão no `COMMAND_LOG` para "ajudar" o replay: o replay
  usa exatamente os `reveals` originais.

## Technical Decisions

1. **Replay do log como retomada**: a parte 1 já grava o ledger ordenado; a
   retomada é replay determinístico, sem snapshot — mesma técnica que valida o
   determinismo do motor nas partes 2 e 3. Trade-off: partida longa custa alguns
   milissegundos de replay em vez de um formato de snapshot duplicado.
2. **`GAME_OVER` registrado pelo servidor, decidido pelo motor**: quem detecta
   PV ≤ 0 é o motor de cada cliente (determinístico, `game.js:92-141`); o
   servidor apenas registra o primeiro `GAME_OVER` válido do ledger, evitando
   divergência de "quem ganhou".
3. **Sala nova em vez de reset na mesma sala**: mantém o log de cada partida
   auditável em arquivo próprio e atende literalmente "ao terminar, um link para
   a página de geração de partida é apresentado, criando um novo link".
4. **Habilidade manual como comando de primeira classe**: hoje ela é o único
   caminho que muta estado sem passar por `resolveAction` na UI
   (`manual_abilities.js:180-203`); roteá-la pelo mesmo protocolo elimina a
   última porta lateral de divergência.
5. **TTL de sala finalizada**: 30 minutos, suficiente para reconectar e abrir o
   JSON, sem manter memória indefinidamente.
6. **Token de assento em `sessionStorage`**: identifica a reconexão do mesmo
   navegador sem exigir login; não é credencial de segurança (anti-scope).

## Applicable Patterns

- `patterns/game-state-management.md` — `endGame`/`changeStat` seguem donos da
  detecção de vitória; o PvP apenas observa.
- `patterns/card-ability-system.md` — `manual_abilities.js` segue como ponte de
  UI de `ACTIVATED_RULES`; nenhuma lógica por carta é adicionada.
- `patterns/automated-unit-tests.md` — builder de `ABILITY` e replay cobertos em
  `tests/unit/run-tests.js`.
- `patterns/pvp-lockstep-sync.md` (criado ao final da parte 4) — protocolo,
  interceptação e estado oculto.

## Risks

- **Risco**: replay divergir de um estado que já evoluiu (efeitos com duração
  baseada em turno) e a reconexão mostrar tabuleiro errado.
  - *Mitigação*: o estado é função pura do log + decks + seed, o que a parte 3
    prova com dois clientes; a reconexão compara `stateHash` e, se divergir,
    recarrega a página em vez de seguir.
- **Risco**: ninguém envia `GAME_OVER` (cliente caiu no exato momento da vitória)
  e a sala fica pendurada.
  - *Mitigação*: TTL de sala finalizada e o lobby mostrando
    `finished`/`stale`.
- **Risco**: o overlay de vitória local disparar em apenas um lado.
  - *Mitigação*: `endGame` é determinístico nos dois clientes e o overlay PvP é
    renderizado a partir do `GAME_OVER` do servidor; o DoD 1 verifica os dois
    lados.
- **Risco**: `ABILITY` duplicar uso de habilidade (limite por turno) por replay
  parcial.
  - *Mitigação*: deduplicação por `seq` na sessão (parte 3) e o mesmo
    `markAbilityUse` do motor nos dois lados.
- **Risco**: memória crescer com salas abandonadas (nunca finalizadas).
  - *Mitigação*: TTL também para salas inativas (sem comando por 2h), registrado
    no `server.py`.

## References

- `src/js/game.js:54-141, 947-988` — `endGame`/`resetGame`, o fluxo local que o
  PvP substitui por "nova sala".
- `src/js/manual_abilities.js:180-203` — mutação direta que vira comando
  `ABILITY`.
- `tests/pvp/smoke_match.py` — smoke test (parte 1) a ser estendido.
- `.vibeflow/decisions.md` — Trox/Roller: caso de uso real do DoD 4.