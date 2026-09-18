# X Monsters

Jogo de cartas PVP local para dois jogadores, desenvolvido com HTML, CSS e
JavaScript puros. O repositório também inclui um contador simplificado e
ferramentas Python para manutenção das cartas.

## Como executar

Na raiz do projeto, inicie um servidor HTTP local:

```powershell
py -3 -m http.server 8000
```

Acesse:

- Jogo completo: http://localhost:8000/game.html
- Contador simplificado: http://localhost:8000/index.html
- Testes manuais: http://localhost:8000/tests/browser/test_abilities.html

O servidor é necessário para que `game.html` carregue as 110 cartas de
`data/cards_database.json`. Abrir o arquivo diretamente por `file://` ativa
o fallback limitado do navegador.

### Partidas PvP online (1v1 em navegadores separados)

O `server.py` é um processo Python que substitui o `http.server` e soma
suporte a WebSocket para partidas PvP em tempo real. Ele serve os arquivos
estáticos na mesma porta (8000) e atua como intermediário de execução
lockstep: cria salas, ordena os comandos via WebSocket, é a única autoridade
de aleatoriedade (dado e decks) e grava um espelho da partida em
`matches/<roomId>.json`.

> **Nota de segurança:** o `server.py` não conhece as regras das 110 cartas
> — valida apenas assento, ordem, turno e fase. O conteúdo das ações é
> declarado pelos clientes. Não exponha na internet sem refletir sobre
> anti-cheat.

```powershell
py -3 server.py              # escuta em 127.0.0.1:8000
py -3 server.py --host 0.0.0.0   # acessível na rede local
```

Fluxo:

1. Abra o **lobby** em `http://localhost:8000/pvp` e clique em *"Criar partida"*.
2. Copie os dois links (`…/pvp/<roomId>/p1` e `…/pvp/<roomId>/p2`) e abra em
   navegadores separados — um para cada jogador.
3. Cada jogador vê o **seu** campo embaixo; a mão do oponente aparece como
   versos com apenas a contagem de cartas visível.
4. Ao final da partida, a página exibe um link para gerar uma nova partida.

Smoke test automatizado:

```powershell
py -3 tests/pvp/smoke_match.py
```

## Estrutura

```text
x-monsters/
├── assets/
│   ├── audio/          # Efeitos sonoros
│   └── cards/          # Imagens das 110 cartas
├── data/               # Base de dados JSON
├── docs/               # Guias e relatórios
├── scripts/            # Ferramentas Python executadas a partir da raiz
├── src/js/             # JavaScript de runtime
├── tests/browser/      # Testes e diagnósticos manuais
├── tests/pvp/          # Testes do servidor PvP (smoke)
├── matches/            # Espelho de partidas (gitignore, runtime apenas)
├── game.html           # Jogo completo
├── index.html          # Contador simplificado
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
