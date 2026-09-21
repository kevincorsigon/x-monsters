# Spec: Reorganização de Estrutura — Parte 2: Scripts de Renomeação (OCR)

## Objetivo
Mover os scripts Python de renomeação de imagens de carta para `scripts/`,
atualizando seus caminhos internos para `data/cards_database.json` e
`assets/cards/`.

## Contexto
`rename_card_images.py`, `rename_card_images_simple.py`, `smart_rename.py` e
`rename_by_order.py` são ferramentas offline (nunca executadas pelo jogo) que
usam OCR para renomear imagens de carta com base em
`cards_database.json` (ver
[patterns/python-card-asset-scripts.md](../patterns/python-card-asset-scripts.md)).
Cada uma hoje assume `cards_database.json` e a pasta `cards`/`./cards` na
raiz do repositório. Depois da Parte 1, esses caminhos mudam para
`data/cards_database.json` e `assets/cards/`.

## Definição de Pronto (DoD)
1. Os 4 arquivos (`rename_card_images.py`, `rename_card_images_simple.py`,
   `smart_rename.py`, `rename_by_order.py`) estão em `scripts/`.
2. Todo `open('cards_database.json', ...)` nesses 4 arquivos aponta para
   `data/cards_database.json` (caminho relativo à raiz do repo, assumindo
   execução a partir dela).
3. Todo valor de pasta de imagens (`images_folder = "cards"`,
   `cards_folder = "cards"` e equivalentes, incluindo o default do
   construtor de `smart_rename.py`) aponta para `assets/cards`.
4. Cada um dos 4 arquivos ganha um comentário de uma linha no topo indicando
   a forma correta de execução (`# Executar da raiz do repo: python
   scripts/<nome>.py`) — sem criar nenhum arquivo novo de documentação.
5. Nenhuma lógica de OCR/matching é alterada — apenas literais de caminho e
   o comentário do item 4 (gate de artesanato: menor mudança possível, sem
   refatorar as classes).
6. Teste manual documentado: rodar `python scripts/rename_by_order.py
   --help`-equivalente (ou revisão de código, já que os scripts não têm
   modo `--dry-run`) confirmando que os novos caminhos resolvem para
   arquivos existentes a partir da raiz do repo.

## Escopo
- Mover os 4 arquivos para `scripts/`.
- Atualizar os literais de caminho para `data/cards_database.json` e
  `assets/cards`.
- Adicionar o comentário de execução mencionado no DoD.

## Fora de Escopo
- Unificar a lógica de pré-processamento de OCR duplicada entre os 4
  scripts (já registrado como tech debt em
  [patterns/python-card-asset-scripts.md](../patterns/python-card-asset-scripts.md)
  → Anti-patterns) — não é consequência desta reorganização.
- Adicionar `argparse` ou qualquer CLI mais robusta.
- Criar `scripts/README.md` ou qualquer novo arquivo de documentação — o
  comentário inline no topo do script já cobre o risco de execução no
  diretório errado.
- Alterar o caminho hardcoded do binário do Tesseract
  (`pytesseract.pytesseract.tesseract_cmd`) — é específico da máquina de
  quem desenvolveu, não relacionado a esta reorganização.

## Decisões Técnicas
- **Caminhos continuam relativos à raiz do repo, não a `__file__`**: os
  scripts não recalculam o caminho com base em `os.path.dirname(__file__)`.
  Mover os arquivos para `scripts/` não quebra nada desde que continuem
  sendo executados a partir da raiz (`python scripts/foo.py`), que é como já
  são documentados/usados hoje. Introduzir resolução via `__file__` seria
  mudança de comportamento fora do pedido original.
- **Comentário em vez de novo arquivo de doc**: por instrução do projeto,
  não criar Markdown novo para documentar mudanças; o aviso de execução vai
  como comentário no próprio script, ponto de maior risco de erro do
  usuário.

## Padrões Aplicáveis
- [patterns/python-card-asset-scripts.md](../patterns/python-card-asset-scripts.md)
  — mantém cada script autocontido, sem módulo compartilhado; apenas os
  literais de caminho mudam.

## Riscos
- **Usuário executa o script de dentro de `scripts/`** (`cd scripts; python
  rename_by_order.py`) — os caminhos relativos quebram. Mitigação: o
  comentário de execução no topo do arquivo (DoD item 4).
- **Script já en cours de renomeação real quebra o dataset de imagens** se
  rodado com o JSON/pasta errados durante a transição. Mitigação: só
  iniciar esta parte depois que a Parte 1 estiver concluída e validada.

## Dependências
- .vibeflow/specs/refactor-project-structure-part-1.md
