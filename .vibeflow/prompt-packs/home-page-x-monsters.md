# Prompt Pack: Home X Monsters

## Objetivo e Definition of Done

Criar uma home responsiva para X Monsters, com identidade derivada do verso das cartas e acesso direto aos cinco destinos pedidos.

- [ ] A home apresenta CTAs funcionais para PvP, jogo contra CPU, Deck Builder, regras e contador físico.
- [ ] O CTA de regras abre o modal sobre a própria home sem navegar.
- [ ] O verso `assets/verso.jpeg` inspira a composição visual; a página funciona em viewport estreita.

## Anti-escopo

Não substituir o contador atual, alterar regras ou criar novas artes nesta entrega.

## Orçamento

Até três arquivos: home e este prompt pack. Sem novas dependências.

## Padrões

- HTML/CSS/JavaScript vanilla, textos pt-BR e links para páginas existentes.
- Paleta escura, dourado e tons de jogo existentes; nenhuma alteração nas regras ou no motor.
- `assets/verso.jpeg` é a arte de verso disponível e deve funcionar como elemento visual principal.

## Direção

Criar `home.html` como landing page acessível em `/home.html`, mantendo `index.html` como contador para cartas físicas. Use o verso existente no hero. O CTA de regras abre um modal local com o mesmo conteúdo do lobby, sem mudar de página.

## Verificação

Verificar manualmente os cinco destinos e o modal local, revisar responsividade e executar `node tests/unit/run-tests.js`.
