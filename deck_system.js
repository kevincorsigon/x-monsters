// Sistema de Deck Builder para X Monsters
class DeckBuilder {
    constructor(cardsDatabase) {
        this.allCards = cardsDatabase.cards;
        this.totalCards = cardsDatabase.total_cards;
        this.types = cardsDatabase.types;
    }

    // Criar deck balanceado para um jogador
    createBalancedDeck(deckSize = 30) {
        const deck = [];
        
        // Distribuição balanceada:
        // 60% criaturas, 30% suporte, 10% evoluções (se disponível)
        const criaturas = this.allCards.filter(card => card.type === 'criatura');
        const suportes = this.allCards.filter(card => card.type === 'suporte');
        const evolucoes = this.allCards.filter(card => card.type === 'evolução');
        
        const numCriaturas = Math.floor(deckSize * 0.6);
        const numSuportes = Math.floor(deckSize * 0.3);
        const numEvolucoes = Math.min(evolucoes.length, deckSize - numCriaturas - numSuportes);
        
        // Adicionar criaturas balanceadas por custo
        const criaturasSelecionadas = this.selectBalancedByMana(criaturas, numCriaturas);
        deck.push(...criaturasSelecionadas);
        
        // Adicionar suportes
        const suportesSelecionados = this.shuffleArray([...suportes]).slice(0, numSuportes);
        deck.push(...suportesSelecionados);
        
        // Adicionar evoluções (se houver)
        if (numEvolucoes > 0) {
            const evolucoesSelecionadas = this.shuffleArray([...evolucoes]).slice(0, numEvolucoes);
            deck.push(...evolucoesSelecionadas);
        }
        
        // Preencher o resto com criaturas se necessário
        while (deck.length < deckSize && criaturas.length > 0) {
            const cartaExtra = criaturas[Math.floor(Math.random() * criaturas.length)];
            if (!deck.find(c => c.id === cartaExtra.id)) {
                deck.push(cartaExtra);
            }
        }
        
        return this.shuffleArray(deck).slice(0, deckSize);
    }
    
    // Selecionar cartas balanceadas por custo de mana
    selectBalancedByMana(cards, count) {
        const cardsByCost = {
            low: cards.filter(c => c.cost <= 3),    // 40%
            mid: cards.filter(c => c.cost >= 4 && c.cost <= 6), // 40%
            high: cards.filter(c => c.cost >= 7)    // 20%
        };
        
        const lowCount = Math.floor(count * 0.4);
        const midCount = Math.floor(count * 0.4);
        const highCount = count - lowCount - midCount;
        
        const selected = [];
        selected.push(...this.shuffleArray(cardsByCost.low).slice(0, lowCount));
        selected.push(...this.shuffleArray(cardsByCost.mid).slice(0, midCount));
        selected.push(...this.shuffleArray(cardsByCost.high).slice(0, highCount));
        
        return selected;
    }
    
    // Embaralhar array
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    // Criar dois decks balanceados para uma partida
    createMatchDecks(deckSize = 30) {
        // Dividir cartas em dois pools para evitar repetição
        const allCardsShuffled = this.shuffleArray([...this.allCards]);
        const midPoint = Math.floor(allCardsShuffled.length / 2);
        
        const pool1 = allCardsShuffled.slice(0, midPoint);
        const pool2 = allCardsShuffled.slice(midPoint);
        
        // Criar DeckBuilder temporários para cada pool
        const deckBuilder1 = new DeckBuilder({ cards: pool1 });
        const deckBuilder2 = new DeckBuilder({ cards: pool2 });
        
        return {
            player1: deckBuilder1.createBalancedDeck(deckSize),
            player2: deckBuilder2.createBalancedDeck(deckSize)
        };
    }
    
    // Estatísticas do deck
    getDeckStats(deck) {
        const stats = {
            total: deck.length,
            criaturas: deck.filter(c => c.type === 'criatura').length,
            suportes: deck.filter(c => c.type === 'suporte').length,
            evolucoes: deck.filter(c => c.type === 'evolução').length,
            custoPorTipo: {},
            custoMedio: 0
        };
        
        // Calcular custo médio
        const custoTotal = deck.reduce((sum, card) => sum + card.cost, 0);
        stats.custoMedio = (custoTotal / deck.length).toFixed(1);
        
        // Agrupar por tipo e custo
        ['criatura', 'suporte', 'evolução'].forEach(tipo => {
            const cartasTipo = deck.filter(c => c.type === tipo);
            if (cartasTipo.length > 0) {
                const custoMedioTipo = cartasTipo.reduce((sum, c) => sum + c.cost, 0) / cartasTipo.length;
                stats.custoPorTipo[tipo] = custoMedioTipo.toFixed(1);
            }
        });
        
        return stats;
    }
}

// Função para carregar e inicializar o sistema de cartas
async function loadCardSystem() {
    try {
        // Tentar carregar via fetch primeiro (servidor)
        const response = await fetch('cards_database.json');
        const cardsData = await response.json();
        
        window.deckBuilder = new DeckBuilder(cardsData);
        window.cardsDatabase = cardsData;
        
        console.log('Sistema de cartas carregado via servidor:', {
            total: cardsData.total_cards,
            tipos: cardsData.types
        });
        
        return true;
    } catch (error) {
        console.warn('Erro ao carregar via fetch, usando dados embarcados:', error);
        
        // Fallback: usar dados embarcados diretamente no JavaScript
        const fallbackData = getFallbackCardData();
        
        window.deckBuilder = new DeckBuilder(fallbackData);
        window.cardsDatabase = fallbackData;
        
        console.log('Sistema de cartas carregado via fallback:', {
            total: fallbackData.total_cards,
            tipos: fallbackData.types
        });
        
        return true;
    }
}

// Dados de fallback embarcados no JavaScript
function getFallbackCardData() {
    return {
        "total_cards": 110,
        "types": {
            "criatura": 79,
            "suporte": 29,
            "evolução": 2
        },
        "cards": [
            {
                "name": "Dragão Sombrio",
                "type": "criatura",
                "cost": 5,
                "attack": 6,
                "defense": 4,
                "description": "Criatura dragão poderosa que domina os céus sombrios",
                "id": "card_001",
                "image": "cards/dragão_sombrio.png"
            },
            {
                "name": "Lobo Selvagem",
                "type": "criatura",
                "cost": 3,
                "attack": 4,
                "defense": 2,
                "description": "Predador ágil das florestas antigas",
                "id": "card_002",
                "image": "cards/lobo_selvagem.png"
            },
            {
                "name": "Golem de Pedra",
                "type": "criatura",
                "cost": 4,
                "attack": 3,
                "defense": 6,
                "description": "Guardião ancestral feito de pedra mágica",
                "id": "card_003",
                "image": "cards/golem_de_pedra.png"
            },
            {
                "name": "Fênix Ardente",
                "type": "criatura",
                "cost": 6,
                "attack": 7,
                "defense": 3,
                "description": "Ave lendária que renasce das cinzas",
                "id": "card_004",
                "image": "cards/fênix_ardente.png"
            },
            {
                "name": "Espada Flamejante",
                "type": "suporte",
                "cost": 2,
                "attack": 3,
                "defense": 0,
                "description": "Arma mágica que aumenta o poder de ataque",
                "id": "card_005",
                "image": "cards/espada_flamejante.png"
            },
            {
                "name": "Escudo Sagrado",
                "type": "suporte",
                "cost": 3,
                "attack": 0,
                "defense": 4,
                "description": "Proteção divina contra ataques",
                "id": "card_006",
                "image": "cards/escudo_sagrado.png"
            },
            {
                "name": "Mago Elemental",
                "type": "criatura",
                "cost": 4,
                "attack": 5,
                "defense": 3,
                "description": "Conjurador dos elementos primordiais",
                "id": "card_007",
                "image": "cards/mago_elemental.png"
            },
            {
                "name": "Cavaleiro Real",
                "type": "criatura",
                "cost": 5,
                "attack": 4,
                "defense": 5,
                "description": "Nobre guerreiro do reino dourado",
                "id": "card_008",
                "image": "cards/cavaleiro_real.png"
            },
            {
                "name": "Arqueiro Élfico",
                "type": "criatura",
                "cost": 3,
                "attack": 4,
                "defense": 2,
                "description": "Atirador preciso das florestas élficas",
                "id": "card_009",
                "image": "cards/arqueiro_élfico.png"
            },
            {
                "name": "Troll das Montanhas",
                "type": "criatura",
                "cost": 6,
                "attack": 7,
                "defense": 6,
                "description": "Gigante brutal dos picos gelados",
                "id": "card_010",
                "image": "cards/troll_das_montanhas.png"
            },
            {
                "name": "Necromante",
                "type": "criatura",
                "cost": 5,
                "attack": 3,
                "defense": 4,
                "description": "Mestre das artes sombrias da morte",
                "id": "card_011",
                "image": "cards/necromante.png"
            },
            {
                "name": "Poção de Cura",
                "type": "suporte",
                "cost": 1,
                "attack": 0,
                "defense": 0,
                "description": "Restaura pontos de vida",
                "id": "card_012",
                "image": "cards/poção_de_cura.png"
            },
            {
                "name": "Armadura de Ferro",
                "type": "suporte",
                "cost": 2,
                "attack": 0,
                "defense": 3,
                "description": "Proteção metálica resistente",
                "id": "card_013",
                "image": "cards/armadura_de_ferro.png"
            },
            {
                "name": "Orc Guerreiro",
                "type": "criatura",
                "cost": 2,
                "attack": 3,
                "defense": 2,
                "description": "Bárbaro feroz das terras devastadas",
                "id": "card_014",
                "image": "cards/orc_guerreiro.png"
            },
            {
                "name": "Fada Curadora",
                "type": "criatura",
                "cost": 2,
                "attack": 1,
                "defense": 2,
                "description": "Ser mágico com poderes de cura",
                "id": "card_015",
                "image": "cards/fada_curadora.png"
            },
            {
                "name": "Tempestade de Raios",
                "type": "suporte",
                "cost": 4,
                "attack": 5,
                "defense": 0,
                "description": "Magia devastadora dos céus",
                "id": "card_016",
                "image": "cards/tempestade_de_raios.png"
            },
            {
                "name": "Vampiro Sanguinário",
                "type": "criatura",
                "cost": 4,
                "attack": 4,
                "defense": 3,
                "description": "Morto-vivo sedento por sangue",
                "id": "card_017",
                "image": "cards/vampiro_sanguinário.png"
            },
            {
                "name": "Anjo Guardião",
                "type": "criatura",
                "cost": 7,
                "attack": 6,
                "defense": 6,
                "description": "Celestial protetor da luz divina",
                "id": "card_018",
                "image": "cards/anjo_guardião.png"
            },
            {
                "name": "Machado Bárbaro",
                "type": "suporte",
                "cost": 3,
                "attack": 4,
                "defense": 0,
                "description": "Arma brutal dos clãs selvagens",
                "id": "card_019",
                "image": "cards/machado_bárbaro.png"
            },
            {
                "name": "Esqueleto Guerreiro",
                "type": "criatura",
                "cost": 2,
                "attack": 2,
                "defense": 3,
                "description": "Soldado morto-vivo incansável",
                "id": "card_020",
                "image": "cards/esqueleto_guerreiro.png"
            },
            {
                "name": "Marik 2",
                "type": "evolução",
                "cost": 8,
                "attack": 8,
                "defense": 7,
                "description": "Evolução suprema do lendário Marik",
                "id": "card_021",
                "image": "cards/marik_2.png"
            },
            {
                "name": "Turtol Maximus",
                "type": "evolução",
                "cost": 9,
                "attack": 7,
                "defense": 9,
                "description": "Forma evoluída definitiva de Turtol",
                "id": "card_022",
                "image": "cards/turtol_maximus.png"
            },
            {
                "name": "Elemental de Fogo",
                "type": "criatura",
                "cost": 4,
                "attack": 5,
                "defense": 2,
                "description": "Espírito flamejante dos vulcões",
                "id": "card_023",
                "image": "cards/elemental_de_fogo.png"
            },
            {
                "name": "Elemental de Água",
                "type": "criatura",
                "cost": 4,
                "attack": 3,
                "defense": 5,
                "description": "Guardião dos oceanos profundos",
                "id": "card_024",
                "image": "cards/elemental_de_água.png"
            },
            {
                "name": "Báculo Mágico",
                "type": "suporte",
                "cost": 3,
                "attack": 2,
                "defense": 1,
                "description": "Amplifica poderes arcanos",
                "id": "card_025",
                "image": "cards/báculo_mágico.png"
            },
            {
                "name": "Centauro Caçador",
                "type": "criatura",
                "cost": 4,
                "attack": 4,
                "defense": 4,
                "description": "Arqueiro híbrido das planícies",
                "id": "card_026",
                "image": "cards/centauro_caçador.png"
            },
            {
                "name": "Dragão de Gelo",
                "type": "criatura",
                "cost": 6,
                "attack": 6,
                "defense": 5,
                "description": "Dragão das terras congeladas",
                "id": "card_027",
                "image": "cards/dragão_de_gelo.png"
            },
            {
                "name": "Capa da Invisibilidade",
                "type": "suporte",
                "cost": 2,
                "attack": 0,
                "defense": 2,
                "description": "Permite ataques furtivos",
                "id": "card_028",
                "image": "cards/capa_da_invisibilidade.png"
            },
            {
                "name": "Minotauro",
                "type": "criatura",
                "cost": 5,
                "attack": 6,
                "defense": 4,
                "description": "Guardião bestial do labirinto",
                "id": "card_029",
                "image": "cards/minotauro.png"
            },
            {
                "name": "Cristal de Energia",
                "type": "suporte",
                "cost": 1,
                "attack": 0,
                "defense": 0,
                "description": "Aumenta energia disponível",
                "id": "card_030",
                "image": "cards/cristal_de_energia.png"
            }
        ]
    };
}

// Função para inicializar uma nova partida com decks balanceados
function startNewMatch() {
    if (!window.deckBuilder) {
        console.error('Sistema de cartas não carregado!');
        return;
    }
    
    const matchDecks = window.deckBuilder.createMatchDecks(30);
    
    // Atualizar estado do jogo com os novos decks
    gameState.decks = {
        p1: matchDecks.player1,
        p2: matchDecks.player2
    };
    
    // Limpar mãos e campo
    gameState.cards = {
        p1: { hand: [], field: [] },
        p2: { hand: [], field: [] }
    };
    
    // Dar cartas iniciais (5 para cada jogador)
    for (let i = 0; i < 5; i++) {
        drawCardFromDeck('p1');
        drawCardFromDeck('p2');
    }
    
    // Estatísticas dos decks
    const stats1 = window.deckBuilder.getDeckStats(matchDecks.player1);
    const stats2 = window.deckBuilder.getDeckStats(matchDecks.player2);
    
    console.log('Nova partida iniciada!');
    console.log('Deck Player 1:', stats1);
    console.log('Deck Player 2:', stats2);
    
    updateUI();
    return matchDecks;
}

// Função para sacar carta do deck
function drawCardFromDeck(player) {
    if (!gameState.decks || !gameState.decks[player] || gameState.decks[player].length === 0) {
        console.log(`Deck do ${player} está vazio!`);
        return null;
    }
    
    // Sacar carta do topo do deck
    const drawnCard = gameState.decks[player].shift();
    
    // Criar cópia com ID único para esta instância
    const cardInstance = {
        ...drawnCard,
        instanceId: `${drawnCard.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    // Adicionar à mão
    gameState.cards[player].hand.push(cardInstance);
    
    console.log(`${player} sacou: ${cardInstance.name}`);
    return cardInstance;
}

// Exportar para uso global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DeckBuilder, loadCardSystem, startNewMatch, drawCardFromDeck };
}
