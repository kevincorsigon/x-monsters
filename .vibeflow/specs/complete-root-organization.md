# Spec: Organização Completa da Raiz

## Objetivo
Deixar a raiz do repositório apenas com os entry points da aplicação,
documentação principal e arquivos de configuração, organizando código,
áudio, testes, ferramentas e documentação sem interromper o jogo estático.

## Estrutura Alvo
```text
/
├── game.html
├── index.html
├── README.md
├── AGENTS.md
├── requirements_ocr.txt
├── assets/
│   ├── audio/
│   └── cards/
├── data/
├── docs/
├── scripts/
├── src/
│   └── js/
└── tests/
    └── browser/
```

`requirements_ocr.txt` permanece na raiz por ser um arquivo de instalação
descoberto por convenção. Os HTMLs principais permanecem na raiz para que
as URLs continuem simples sob `py -3 -m http.server 8000`.

## Evidência Atual
- Dez arquivos Python na raiz são cópias SHA-256 idênticas dos equivalentes
  já existentes em `scripts/`; devem ser removidos, não movidos novamente.
- Os cinco MP3 são usados por `game.html` e `index.html`.
- `card-abilities.js`, `deck_system.js` e `manual_abilities.js` são runtime.
- `test_*.js`, `ability_audit.js` e `ability_guide.js` são ferramentas de
  desenvolvimento atualmente carregadas por `game.html`.
- `debug_*.png` são arquivos ignorados pelo Git, sem referência ativa; devem
  ser apagados do workspace e continuar ignorados.
- `embedded_cards.js` não tem consumidor ativo; seu destino exige uma decisão
  explícita de remoção, não apenas uma mudança de pasta.

## Definição de Pronto (DoD)
1. A raiz contém somente `game.html`, `index.html`, `README.md`, `AGENTS.md`,
   `requirements_ocr.txt` e arquivos/diretórios de configuração do projeto.
2. Os cinco sons estão em `assets/audio/` e ambos os HTMLs os carregam com
   HTTP 200.
3. O JavaScript de runtime está em `src/js/`; todas as referências HTML e
   leituras dos validadores Python apontam para os novos caminhos.
4. Testes e ferramentas JavaScript/HTML estão em `tests/browser/`, sem
   referências quebradas e sem alteração de sua lógica nesta iniciativa.
5. Os dez Python duplicados não existem mais na raiz; as cópias canônicas em
   `scripts/` continuam executando a partir da raiz do repositório.
6. Guias e relatórios secundários estão em `docs/`; links internos e menções
   de estrutura foram atualizados.
7. Sob servidor HTTP local, `game.html` e `index.html` abrem sem 404, os 110
   registros de cartas carregam e os scripts de validação mantêm os números
   observados antes da reorganização.

## Plano em Fases

### Fase A — Limpar Duplicatas Python e Artefatos
- Remover da raiz os dez `.py` que já têm cópia idêntica em `scripts/`.
- Mover `test_ocr.py` para `scripts/test_ocr.py`.
- Apagar os `debug_*.png` locais; manter a regra existente no `.gitignore`.
- Validar com comparação de inventário e execução de
  `py -3 scripts/check_cards.py`, `py -3 scripts/final_check.py` e
  `py -3 scripts/analyze_json.py` a partir da raiz.

Esta fase excede o orçamento nominal por remover dez duplicatas mecânicas e
idênticas. A exceção é aceitável porque existe um único comportamento
canônico em `scripts/` e nenhum chamador aponta para as cópias da raiz.

### Fase B — Mover Áudio
- Mover `punch.mp3`, `healing.mp3`, `energy.mp3`, `waste.mp3` e `victory.mp3`
  para `assets/audio/`.
- Atualizar somente os `src` de áudio em `game.html` e `index.html`.
- Validar HTTP 200 para os cinco arquivos nas duas páginas e ausência de 404
  no console/rede do navegador.

A fase toca sete arquivos porque os cinco assets são indivisíveis: os dois
entry points usam o mesmo conjunto completo.

### Fase C — Mover JavaScript de Runtime
- Mover `card-abilities.js`, `deck_system.js` e `manual_abilities.js` para
  `src/js/`, preservando os nomes atuais.
- Atualizar `game.html`, `test_abilities.html`, `test_fix.html`,
  `scripts/check_cards.py` e `scripts/final_check.py` onde aplicável.
- Não alterar APIs globais, ordem dos `<script>` ou lógica do jogo.
- Validar carregamento HTTP, 110 cartas e relatórios Python.

O orçamento desta fase pode chegar a oito arquivos porque um único movimento
de runtime possui cinco consumidores conhecidos; dividi-lo deixaria caminhos
temporariamente inconsistentes.

### Fase D — Isolar Testes e Ferramentas de Browser
- Mover `test_*.js`, `ability_audit.js`, `ability_guide.js`,
  `test_abilities.html` e `test_fix.html` para `tests/browser/`.
- Atualizar caminhos relativos dos HTMLs de teste.
- Nesta iniciativa, `game.html` continua carregando esses scripts pelos novos
  caminhos para preservar comportamento. Removê-los da página principal é
  uma otimização posterior com teste próprio.
- Validar que as funções globais de teste continuam disponíveis no console.

Esta fase excede o orçamento por ser uma relocação mecânica de uma suíte
manual acoplada por ordem de carregamento. Deve ser implementada em um único
commit para não deixar referências intermediárias quebradas.

### Fase E — Documentação e Código Morto
- Manter `README.md` como porta de entrada e mover os demais guias/relatórios
  Markdown para `docs/`.
- Consolidar em `README.md` as instruções atuais de execução e links para os
  documentos movidos; não fundir conteúdo editorial nesta iniciativa.
- Confirmar por busca global que `embedded_cards.js` não tem consumidor e,
  em tarefa separada, removê-lo com validação do fallback de
  `deck_system.js`. Código morto não deve ser escondido em uma pasta.

## Fora de Escopo
- Modularizar o bloco inline de aproximadamente 3900 linhas de `game.html`.
- Introduzir npm, bundler, framework, módulos ES ou novo test runner.
- Corrigir regras de jogo, cobertura de habilidades ou bugs dos geradores de
  impressão já registrados em `decisions.md`.
- Remover scripts de diagnóstico da página principal sem uma medição separada
  de impacto.

## Riscos e Mitigações
- **Caminhos relativos quebrados:** buscar todos os nomes antigos antes de
  cada fase e testar via HTTP depois da edição.
- **Ordem de globais JavaScript alterada:** preservar exatamente a ordem dos
  `<script>` de `game.html`.
- **Execução Python em diretório diferente:** manter caminhos CWD-relative e
  executar todos os comandos a partir da raiz.
- **Confundir limpeza com refatoração:** movimentos não alteram nomes públicos,
  lógica ou formato dos dados.

## Dependências
- As quatro partes de `refactor-project-structure` devem permanecer em PASS.
- Nenhuma dependência nova.