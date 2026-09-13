# Spec: Reorganização de Estrutura — Parte 3: Scripts de Geração de Folhas de Impressão

## Objetivo
Mover os scripts Python de geração de folhas/documentos de impressão de
carta para `scripts/`, atualizando os que leem `cards_database.json`/`cards`
para os novos caminhos `data/cards_database.json` e `assets/cards`.

## Contexto
`create_cards_front_back.py`, `create_cards_high_quality.py` e
`card_printing_advanced.py` leem `cards_database.json` e a pasta `cards`
(`cards_folder = './cards'` / `'cards'`) para montar folhas/documentos de
impressão (ver
[patterns/python-card-asset-scripts.md](../patterns/python-card-asset-scripts.md)).
`create_card_back.py` também é uma ferramenta de geração de imagem de carta,
mas **não lê** `cards_database.json` nem a pasta `cards` (gera apenas o
verso genérico da carta) — só precisa ser movido, sem edição de caminhos.

## Definição de Pronto (DoD)
1. Os 4 arquivos (`create_cards_front_back.py`,
   `create_cards_high_quality.py`, `card_printing_advanced.py`,
   `create_card_back.py`) estão em `scripts/`.
2. Em `create_cards_front_back.py`, `create_cards_high_quality.py` e
   `card_printing_advanced.py`: todo `open('cards_database.json', ...)`
   aponta para `data/cards_database.json`.
3. Nos mesmos 3 arquivos: todo `cards_folder` (`'./cards'`/`'cards'`) aponta
   para `assets/cards`.
4. `create_card_back.py` é movido sem nenhuma alteração de conteúdo —
   confirmado que ele não referencia `cards_database.json` nem a pasta
   `cards` (gate de artesanato: nenhuma mudança desnecessária).
5. Cada um dos 3 arquivos com caminhos alterados ganha o mesmo comentário de
   execução da Parte 2 (`# Executar da raiz do repo: python
   scripts/<nome>.py`).
6. Teste manual documentado: rodar cada um dos 3 scripts a partir da raiz
   do repo após a Parte 1 e confirmar que geram o documento/imagens de
   saída sem erro de arquivo não encontrado.

## Escopo
- Mover os 4 arquivos para `scripts/`.
- Atualizar os literais de caminho nos 3 que referenciam dados/imagens de
  carta.
- Adicionar o comentário de execução nos mesmos 3.

## Fora de Escopo
- Qualquer mudança nos formatos de saída (`.docx`, imagens de alta
  qualidade) ou no layout de impressão — fora do pedido.
- `create_card_back.py`: qualquer edição de conteúdo além da relocação.
- Unificar os 3 scripts de geração (têm sobreposição de propósito) — não é
  consequência desta reorganização, é uma decisão de produto separada.

## Decisões Técnicas
- Mesmas decisões da Parte 2: caminhos relativos à raiz do repo (não
  `__file__`-relativos), comentário inline em vez de novo arquivo de
  documentação.
- `create_card_back.py` entra neste grupo (e não no grupo de
  renomeação/OCR ou validação) porque é conceitualmente uma ferramenta de
  "geração de arte de carta para impressão", mesmo sem dependência de
  caminho — mantém os scripts de impressão juntos em `scripts/`.

## Padrões Aplicáveis
- [patterns/python-card-asset-scripts.md](../patterns/python-card-asset-scripts.md)
  — cada script continua autocontido; apenas caminhos e localização mudam.

## Riscos
- **Saída (`.docx`/imagens) escrita com caminho relativo** (`output_file`
  sem pasta) passa a ser criada dentro de `scripts/` em vez da raiz depois
  da mudança de diretório do script — isso é uma mudança de comportamento
  observável (onde o arquivo gerado aparece). Mitigação: documentar no DoD
  o teste manual (item 6) e, se o comportamento for indesejado, tratar como
  ajuste pontual dentro desta mesma parte (ainda dentro do arquivo já
  sendo editado, sem exceder o orçamento de arquivos).
- Mesmo risco de execução no diretório errado da Parte 2 — mesma mitigação
  (comentário no topo do arquivo).

## Dependências
- .vibeflow/specs/refactor-project-structure-part-1.md
