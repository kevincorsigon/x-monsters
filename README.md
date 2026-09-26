# X Monsters

Jogo de cartas PVP local para dois jogadores, desenvolvido com HTML, CSS e
JavaScript puros. O repositório também inclui um contador simplificado e
ferramentas Python para manutenção das cartas.

## Como executar

Na raiz do projeto, inicie um servidor HTTP local:

```powershell
py -3 server.py              # recomendado: estáticos com cache (ETag/304) + gzip
# ou, só para abrir as páginas:
py -3 -m http.server 8080
```

Acesse:

- Home: http://localhost:8080/
- Jogo completo: http://localhost:8080/game.html
- Contador para cartas físicas: http://localhost:8080/real-play.html
- Testes manuais: http://localhost:8080/tests/browser/test_abilities.html

O `server.py` serve os estáticos com `ETag`/`Last-Modified` (revalidação por
`304` sem corpo) e `Cache-Control` por classe: HTML revalida sempre, JS/CSS/JSON
valem 5 min e `assets/` (as 110 cartas, ~151 MB) vale 1 dia — o baralho é
baixado uma vez. Ele também comprime com gzip o que realmente ganha coisa
(HTML/JS/CSS/JSON/SVG); PNG/MP3 já nascem comprimidos, então o ganho de imagem é
o cache. O `python -m http.server` entrega tudo sem `Cache-Control`.

O servidor é necessário para que `game.html` carregue as 110 cartas de
`data/cards_database.json`. Abrir o arquivo diretamente por `file://` ativa
o fallback limitado do navegador.

### Partidas PvP online (1v1 em navegadores separados)

O `server.py` é um processo Python que substitui o `http.server` e soma
suporte a WebSocket para partidas PvP em tempo real. Ele serve os arquivos
estáticos na mesma porta (8080) e atua como intermediário de execução
lockstep: cria salas, ordena os comandos via WebSocket, é a única autoridade
de aleatoriedade (dado e decks) e grava um espelho da partida em
`matches/<roomId>.json`.

> **Nota de segurança:** o `server.py` não conhece as regras das 110 cartas
> — valida apenas assento, ordem, turno e fase. O conteúdo das ações é
> declarado pelos clientes. Não exponha na internet sem refletir sobre
> anti-cheat.

> **Pré-requisitos locais:** Python 3 (com o módulo `websockets`) e Node.js.
> O `deck_factory.js` (Node) é o balanceador oficial dos decks; sem ele o
> servidor fallback para "cada cliente monta o próprio deck a partir da seed"
> (resultado idêntico, já que o RNG é o mesmo).

### Via local

Instale a dependência Python do servidor (um vez por máquina):

```powershell
py -3 -m pip install websockets
```

Inicie o servidor:

```powershell
py -3 server.py              # escuta em 127.0.0.1:8080
py -3 server.py --host 0.0.0.0   # acessível na rede local
```

Fluxo:

1. Abra o **lobby** em `http://localhost:8080/pvp` e clique em *"Criar partida"*.
2. Copie os dois links (`…/pvp/<roomId>/p1` e `…/pvp/<roomId>/p2`) e abra em
   navegadores separados — um para cada jogador.
3. Cada jogador vê o **seu** campo embaixo; a mão do oponente aparece como
   versos com apenas a contagem de cartas visível.
4. Ao final da partida, a página exibe um link para gerar uma nova partida.

Smoke test automatizado (server + 2 clientes WebSocket):

```powershell
py -3 tests/pvp/smoke_match.py
```

### Via Docker Compose (recomendado)

O `docker-compose.yml` empacota o servidor (Python 3 + Node + `websockets`) e
prexa a porta `8000`. O diretório `matches/` é persistido em um **volume
gerenciado pelo Docker**, de modo que os JSON das partidas sobrevivem a
paradas e reinicializações do container.

Build e início (uma vez por máquina):

```powershell
docker compose up -d
```

Acesso:

- Lobby: `http://localhost:8080/pvp`
- Jogo completo (local): `http://localhost:8080/game.html`
- Partida PvP: abra `…/pvp/<roomId>/p1` e `…/pvp/<roomId>/p2` em navegadores separados

Parar o serviço:

```powershell
docker compose down
```

Parar e remover o volume de matches (apaga todos os JSON das partidas):

```powershell
docker compose down -v
```

Variantes úteis:

```powershell
# Alterar porta (ex: 9000 no host):
HOST_PORT=9000 docker compose up -d

# Acompanhar logs em tempo real:
docker compose logs -f

# Inspecionar os JSON das partidas sem parar o container:
docker run --rm -v xmonsters_matches:/matches -w /matches busybox ls -lh

# Executar testes dentro do container (usa os arquivos locais via bind mount):
docker compose run --rm --no-deps -v ${PWD}:/app -w /app x-monsters python3 tests/pvp/smoke_match.py
docker compose run --rm --no-deps -v ${PWD}:/app -w /app x-monsters node tests/unit/run-tests.js
```

> Nota: o volume `xmonsters_matches` é criado automaticamente pelo Docker Compose
> na primeira execução. Ele persiste independentemente do ciclo de vida do
> container — parar/remover o container **não** apaga os dados. Use `down -v`
> explicitamente apenas quando quiser limpar todas as partidas salvas.

### Via Docker (imagem standalone)

Se preferir rodar sem Docker Compose, a mesma imagem pode ser usada com
`docker run`. Porém, sem volume mapeado, os JSON das partidas serão perdidos
a cada reinicialização:

```powershell
docker build -t x-monsters .
docker run --rm -p 8000:8000 x-monsters
```

Para persistência via `docker run`, monte um diretório host em `/app/matches`:

```powershell
docker run --rm -p 8000:8000 -v ${PWD}/matches:/app/matches x-monsters
```

### Regras de mesa (constantes travadas por teste)

- **Vida inicial: 300 PV** para cada jogador (era 200). O valor aparece em
  `src/js/game.js` (`INITIAL_PV`), `server.py` (`DEFAULT_CONFIG`), no contador
  `real-play.html` e nos spans de `game.html`/`pvp.html`, além das duas telas de
  regras. O ajuste veio da análise dos decks: ATK médio 27,1 / DEF média 24,2 /
  top‑3 de ATK 47,7 — com campo aberto, 3 atacantes passam de 100 PV por turno,
  então 300 dá 2–3 turnos de cerco depois do atrito em vez de decidir a partida
  em 1–2.
- **Limite de turno: 45s** — ao estourar, a vez passa sozinha. Em PvP quem decide é
  o servidor (ele grava um `END_TURN` normal no ledger e replica aos dois
  clientes); no hotseat é o próprio cliente. O contador (`⏱ Turno`) fica no painel
  central, com aviso nos últimos 10s. O `server.py` aceita `XM_TURN_SECONDS` para
  afinar/desligar (0) o relógio em execuções de teste.
- **Ninguém ataca direto no próprio primeiro turno** (vale para ataque direto
  inerente, campo vazio e permissão de carta/equipamento). A regra vive em
  `CardRules.canDirectAttack` + `ehPrimeiroTurnoDoJogador` (apoiada em
  `state.startingPlayer`).

### Escolha de decks

Existem nove decks prontos em `data/decks.json` — Legião Robótica, Fúria
Selvagem, Corte Dracônica, Ordem dos Caçadores, Alcateia Lunar, Banquete de
Apelino, Maré Profunda, Círculo Arcano e Lua de Sangue — todos com 40 cartas,
balanceados por curva de custo e montados por sinergia de traits (cada um usa no
máximo 3 cópias da mesma carta, e a maioria no máximo 2), além do **deck
aleatório**. Juntos, os nove usam **todas as 110 cartas** do catálogo. Apenas dois
presets guardam cartas fora do tema, por decisão de design — o Banquete de Apelino
(as elites de facções diferentes) e a Maré Profunda (a única carta `planta`); a
Legião Robótica virou "máquinas e mecha-dragões" (`robotico` + `dragao`) e está
100% no tema. Um teste de unidade trava o teto de três.

O **Apelino Pão e Vinho** (`card_089`) é **única por deck** — o ataque ilimitado
não empilha. O teto mora em `deck_system.js` (`LIMITES_DE_COPIA`, padrão 3 para
as demais cartas) e vale para todo caminho que monta baralho: presets, deck
aleatório do hotseat, sorteio pela seed no PvP e o fallback local
(`DeckBuilder.podeIncluir`).

- **Hotseat (`game.html`)**: um modal abre assim que a partida carrega e a mesa
  só é montada depois da escolha (o oponente local entra com um deck sorteado).
  O gear ⚙️ → **🎴 Trocar deck** reabre o seletor; **🔄 Reset** mantém o deck
  atual.
- **PvP online**: o **lobby só cria/compartilha a sala** — não há escolha de deck
  lá. Cada jogador confirma o deck **ao entrar na sala**: o modal abre no link
  `/pvp/<sala>/<assento>` antes de qualquer conexão, e o `HELLO` já leva o id
  escolhido (a partida só começa quando os dois assentos confirmam). O
  `server.py` resolve o preset daquele assento e o deck do oponente continua
  secreto.

Os presets referenciam apenas ids de `data/cards_database.json`: nenhuma
definição de carta é duplicada — e a ordem do arquivo é só a **receita**: o
baralho de cada partida é embaralhado na hora de montar a mesa (no PvP com a seed
da sala, então um F5 mantém o mesmo baralho). Clicar numa carta do resumo abre o
modal de detalhes, que lista custo, ATK/DEF, **características** (traits, com
rótulo em pt-BR) e a habilidade.

### Gerar decks determinísticos

O `scripts/deck_factory.js` (Node, RNG mulberry32) gera dois decks idênticos a
partir de uma seed — usado pelo servidor ao criar a sala (para quem não escolheu
preset) e útil para auditoria/rastreabilidade:

```powershell
node scripts/deck_factory.js --seed=123 --size=40
# {"p1":[...40 defs...],"p2":[...40 defs...]}
```

## Estrutura

```text
x-monsters/
├── assets/
│   ├── audio/          # Efeitos sonoros
│   └── cards/          # Imagens das 110 cartas
├── data/               # Base de dados JSON (cartas + decks pré-montados)
├── docs/               # Guias e relatórios
├── scripts/            # Ferramentas Python executadas a partir da raiz
├── src/js/             # JavaScript de runtime
├── tests/browser/      # Testes e diagnósticos manuais
├── tests/pvp/          # Testes do servidor PvP (smoke)
├── matches/            # Espelho de partidas (gitignore, runtime apenas)
├── game.html           # Jogo completo
├── index.html          # Home (landing page)
├── real-play.html      # Contador simplificado (cartas físicas)
├── pvp-lobby.html      # Lobby PvP online
├── pvp.html            # Tabuleiro PvP (fork de game.html)
├── server.py           # Servidor HTTP + WebSocket (PvP)
└── requirements_ocr.txt
```

## Ferramentas Python

Instale as dependências quando precisar executar os utilitários de OCR e
impressão:

```powershell
py -3 -m pip install -r requirements_ocr.txt
```

Execute os scripts sempre a partir da raiz do repositório, por exemplo:

```powershell
py -3 scripts/check_cards.py
py -3 scripts/final_check.py
```

## Documentação

- [Visão detalhada do jogo](docs/README_NEW.md)
- [Sistema de habilidades](docs/SISTEMA_HABILIDADES_README.md)
- [Guia de impressão](docs/GUIA_IMPRESSAO.md)
- [Guia de impressão frente e verso](docs/GUIA_IMPRESSAO_FRENTE_VERSO.md)
- [Progresso das habilidades](docs/PROGRESSO_HABILIDADES.md)
- [Relatório final das habilidades](docs/RELATORIO_FINAL_HABILIDADES.md)
