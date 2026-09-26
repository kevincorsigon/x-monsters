# Regras de Energia

A energia é o recurso principal do jogo, usado para invocar monstros e equipar cartas de suporte.

**Energia Inicial:** Cada jogador começa com 6 pontos de energia. No primeiro turno, o jogador 1 (que joga primeiro) recebe +1 ponto ao entrar na Fase de Energia, começando com 7.

**Aumento de Energia (máximo):** A cada troca de turno, quando o jogo volta para a Fase de Energia do jogador, o `maxEnergy` desse jogador sobe em 1 ponto (até o limite de 20).

**Mecânica de Gasto — Reset total:** Dentro do seu turno, você pode gastar toda a energia disponível. No turno seguinte, a energia **volta cheia** para o novo `maxEnergy`, independente de quanto sobrou no turno anterior.

```
novaEnergia = maxEnergy
```

**Exemplo:** você tinha 5 de energia máxima, invocou uma carta de custo 4 e sobrou 1. No turno seguinte seu `maxEnergy` sobe para 6, e sua energia volta a 6 (não fica em 2).

**Progressão do máximo:** turno 1 (máx. 6 ou 7 para quem começa), turno 2 (máx. 7 ou 8), turno 3 (máx. 8 ou 9), e assim por diante até o limite máximo de 20.

**Limite Máximo:** a energia máxima acumulável é de 20 pontos.

**Dado da Sorte:** uma vez por jogo, cada jogador pode gastar 2 pontos de energia para rolar um dado da sorte e ganhar de 1 a 6 pontos de energia adicionais (sem ultrapassar o limite de 20).

**Botões manuais:** os botões de `+`/`-` de energia existem apenas em `real-play.html` (modo livre/contador). Em `game.html` a energia é 100% automática — sem controle manual, sem duplicação via botões de fase.

## `real-play.html` vs `game.html`

Ambos seguem a mesma regra de energia (reset total ao `maxEnergy` por turno). A única diferença é que `real-play.html` expõe botões manuais de `+`/`-` de energia (modo contador livre), enquanto `game.html` calcula tudo automaticamente, sem controle manual.
