> You are only seeing this prompt; there is no context outside it.

# Motor de Habilidades - Fase 4E: Núcleo de Energia Pura

## Objetivo e Definition of Done

Migrar `card_104`: equipar somente em criatura aliada com trait `dragao` ou
`elite`, concedendo exatamente +5 ATK/+5 DEF enquanto a fonte estiver equipada.

1. Traits são consultadas no mapa explícito aprovado.
2. Alvos sem `dragao|elite` são rejeitados antes de custo/movimento.
3. Bônus textual +5/+5 substitui os campos 10/10 do JSON.
4. Saída do equipamento remove somente seus modificadores.
5. Estado e DOM coincidem; testes e browser passam.

## Anti-escopo

- Nenhum outro equipamento, trait ou redesign.
- Nenhuma dependência.

## Orçamento

Até três arquivos: `src/js/card-rules.js`, `game.html` se necessário e
`tests/unit/run-tests.js`.

## Como Validar

`node tests/unit/run-tests.js`, checks de sintaxe/diff e smoke browser.