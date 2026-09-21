# Spec: Reorganização de Estrutura — Parte 4: Scripts de Validação de Dados

## Objetivo
Mover os scripts Python de validação/análise de dados para `scripts/`,
atualizando suas leituras de `cards_database.json` para
`data/cards_database.json`.

## Contexto
`check_cards.py`, `final_check.py` e `analyze_json.py` são ferramentas de
diagnóstico que leem `cards_database.json` (e, no caso de `check_cards.py`,
também `card-abilities.js`, que **não muda de lugar nem de caminho** nesta
iniciativa) para checar cobertura de habilidades e consistência de dados
(ver
[patterns/python-card-asset-scripts.md](../patterns/python-card-asset-scripts.md)).
Nenhum dos três referencia a pasta de imagens `cards/`.

## Definição de Pronto (DoD)
1. Os 3 arquivos (`check_cards.py`, `final_check.py`, `analyze_json.py`)
   estão em `scripts/`.
2. Todo `open('cards_database.json', ...)` nos 3 arquivos aponta para
   `data/cards_database.json`.
3. Em `check_cards.py`: a leitura de `card-abilities.js` continua apontando
   para a raiz do repo (`../card-abilities.js` a partir de `scripts/`, ou
   equivalente) — este arquivo não muda de lugar nesta iniciativa.
4. Cada um dos 3 arquivos ganha o mesmo comentário de execução das Partes 2
   e 3 (`# Executar da raiz do repo: python scripts/<nome>.py`).
5. Nenhuma mudança na lógica de diff/relatório desses scripts (gate de
   artesanato: menor mudança possível).
6. Teste manual documentado: rodar `python scripts/check_cards.py` e
   `python scripts/final_check.py` a partir da raiz após a Parte 1 e
   confirmar que produzem o mesmo relatório de cobertura que produziam
   antes da reorganização (mesmos números de cartas implementadas/faltantes).

## Escopo
- Mover os 3 arquivos para `scripts/`.
- Atualizar o caminho de `cards_database.json` nos 3.
- Corrigir o caminho relativo de `card-abilities.js` em `check_cards.py`
  para continuar apontando para a raiz do repo a partir da nova localização
  em `scripts/`.
- Adicionar o comentário de execução.

## Fora de Escopo
- Mover `card-abilities.js` — fica na raiz, é código do jogo, não uma
  ferramenta offline.
- Qualquer mudança na lógica de categorização de habilidades em
  `check_cards.py`/`final_check.py`/`analyze_json.py`.

## Decisões Técnicas
- Mesmas decisões das Partes 2 e 3: caminhos relativos à raiz assumida de
  execução, comentário inline em vez de novo arquivo de documentação.
- `check_cards.py` é o único caso com uma segunda referência de caminho
  (`card-abilities.js`) que **não muda de valor absoluto de destino**, só
  precisa continuar resolvendo para a raiz do repo agora que o script mora
  em `scripts/` — por isso vira um item de DoD próprio (item 3), para não
  ser esquecido junto com a troca mecânica de `cards_database.json`.

## Padrões Aplicáveis
- [patterns/python-card-asset-scripts.md](../patterns/python-card-asset-scripts.md)
  — reutiliza a abordagem de diff via regex já documentada; nenhuma lógica
  nova é introduzida.

## Riscos
- **Esquecer de ajustar o caminho de `card-abilities.js` em
  `check_cards.py`** ao mover o script para `scripts/` quebra silenciosamente
  a checagem de cobertura (arquivo não encontrado ou encontrado vazio).
  Mitigação: DoD item 3 e teste manual item 6 comparam o número de cartas
  implementadas antes/depois da mudança.
- Mesmo risco de execução no diretório errado das Partes 2 e 3 — mesma
  mitigação (comentário no topo do arquivo).

## Dependências
- .vibeflow/specs/refactor-project-structure-part-1.md
