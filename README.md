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
├── game.html           # Jogo completo
└── index.html          # Contador simplificado
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
