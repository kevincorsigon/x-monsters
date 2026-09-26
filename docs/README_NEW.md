# X Monsters - Jogo de Cartas PVP

Um jogo de cartas multiplayer completo para 2 jogadores com sistema de deck balanceado e interface web responsiva.

## 🎮 Funcionalidades Principais

### Sistema de Cartas Real
- **110 cartas únicas** com imagens reais
- **3 tipos**: Criaturas, Suporte e Evoluções especiais
- **Sistema de deck balanceado** automaticamente para cada partida
- **Imagens reais das cartas** (pasta `/assets/cards/`)

### Sistema de Pontos
- **PV (Pontos de Vida)**: Começam com 100, reduzem com ataques
- **Energia**: Começa com 6, máximo de 20, aumenta 1 por turno
- **Sistema de Som**: Efeitos sonoros para todas as ações

### Controles Avançados
- **Botões +/-**: Ajustar PV e energia manualmente
- **Clique longo**: Auto-decremento de PV (5 por segundo)
- **Edição de nomes**: Clique no nome do jogador para editar
- **Drag & Drop**: Arraste cartas da mão para o campo
- **Sistema de combate**: Clique em suas cartas e depois no alvo

### Dado da Sorte
- **Custo**: 2 de energia
- **Efeito**: Ganha 1-6 energia aleatória
- **Uso**: Limitado a 1 vez por turno, por jogador

## 🃏 Sistema de Cartas

### Tipos de Cartas
1. **Criaturas** (79 cartas): Atacam e defendem
2. **Suporte** (29 cartas): Efeitos especiais e equipamentos  
3. **Evoluções** (2 cartas): Marik 2 e Turtol Maximus

### Características das Cartas
- **Nome**: Identificação única
- **Custo**: Energia necessária para invocar
- **Ataque**: Dano causado
- **Defesa**: Resistência a danos
- **Tipo**: Criatura, Suporte ou Evolução
- **Imagem**: Visual único de cada carta

### Sistema de Deck Balanceado
- **30 cartas por deck** (padrão)
- **Distribuição automática**: 60% criaturas, 30% suporte, 10% evoluções
- **Balanceamento por custo**: 40% baixo custo, 40% médio, 20% alto
- **Decks únicos**: Sem repetição de cartas entre jogadores

## 🎯 Regras do Jogo

### Fases do Turno  
1. **Energia**: Ganhe +1 energia automaticamente
2. **Invocação**: Coloque cartas em campo (custo em energia)
3. **Combate**: Ataque com suas criaturas

### Mecânicas de Combate
- **Ataque de criatura**: Clique na sua criatura, depois na criatura inimiga
- **Ataque direto**: Se o oponente não tem defesas, ataque os PV diretamente
- **Dano**: Ataque - Defesa = Dano final
- **Destruição**: Criaturas com defesa ≤ 0 são destruídas

### Condições de Vitória
- **Vitória**: Quando adversário chega a 0 PV
- **Derrota**: Quando seus PV chegam a 0
- **Som especial** de vitória quando alguém vence

## 📁 Estrutura de Arquivos

```
x-monsters/
├── game.html              # Jogo principal completo
├── index.html              # Home (landing page)
├── real-play.html          # Contador simples (legacy)
├── data/cards_database.json # Base de dados das cartas
├── src/js/deck_system.js   # Sistema de deck e balanceamento
├── scripts/                # Ferramentas Python
├── assets/cards/           # Pasta com imagens das cartas
│   ├── dragão_sombrio.png
│   ├── lobo_selvagem.png
│   └── ... (110 cartas)
└── assets/audio/           # Efeitos sonoros
```

## 🚀 Como Jogar

### Início Rápido
1. Abra `game.html` em um navegador moderno
2. O sistema carregará automaticamente 110 cartas reais
3. Cada jogador recebe um deck balanceado de 30 cartas
4. Comece com 5 cartas na mão

### Durante o Jogo
1. **Clique nos botões de fase** para avançar (Energia → Invocação → Combate)
2. **Arraste cartas** da mão para o campo na fase de Invocação
3. **Clique nas suas cartas** e depois no alvo na fase de Combate
4. **Use o dado da sorte** para energia extra (2 energia = 1-6 energia)
5. **Termine o turno** para passar para o próximo jogador

### Controles Especiais
- **Botão "Decks"**: Ver estatísticas dos decks
- **Botão "Reset"**: Reiniciar partida com novos decks
- **Clique no deck**: Sacar nova carta (se houver)
- **Campo piscando**: Indica o jogador da vez

## 🎨 Interface Responsiva

- **Layout grid flexível** que se adapta a qualquer tela
- **Cards em linha horizontal** para melhor visualização
- **Semáforo de fases** no centro da tela
- **Animações visuais** para feedback do jogador
- **Suporte mobile** completo

## 🔧 Desenvolvimento

### Tecnologias Usadas
- **HTML5** com semântica moderna
- **CSS3** com Grid, Flexbox e animações
- **JavaScript ES6+** com async/await
- **Python** para processamento de imagens
- **JSON** para base de dados

### Scripts Incluídos
- `analyze_cards.py`: Processa imagens e cria JSON
- `src/js/deck_system.js`: Gerencia decks e balanceamento
- Sistema de som integrado
- Sistema de combate avançado

Divirta-se jogando X Monsters! 🎮⚔️
