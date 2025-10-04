// Dados completos das cartas embarcados
const EMBEDDED_CARDS_DATA = {
    "total_cards": 30,
    "types": {
        "criatura": 22,
        "suporte": 6,
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
            "name": "Minotauro",
            "type": "criatura",
            "cost": 5,
            "attack": 6,
            "defense": 4,
            "description": "Guardião bestial do labirinto",
            "id": "card_028",
            "image": "cards/minotauro.png"
        },
        {
            "name": "Kobold Ladino",
            "type": "criatura",
            "cost": 3,
            "attack": 4,
            "defense": 2,
            "description": "Criatura ladina e ágil",
            "id": "card_029",
            "image": "cards/kobold_ladino.png"
        },
        {
            "name": "Harpia Voadora", 
            "type": "criatura",
            "cost": 4,
            "attack": 5,
            "defense": 3,
            "description": "Criatura alada dos céus tempestuosos",
            "id": "card_030",
            "image": "cards/harpia_voadora.png"
        }
    ]
};

// Função simplificada que usa dados embarcados
function loadCardSystemEmbedded() {
    try {
        window.deckBuilder = new DeckBuilder(EMBEDDED_CARDS_DATA);
        window.cardsDatabase = EMBEDDED_CARDS_DATA;
        
        console.log('Sistema de cartas carregado (dados embarcados):', {
            total: EMBEDDED_CARDS_DATA.total_cards,
            tipos: EMBEDDED_CARDS_DATA.types
        });
        
        return true;
    } catch (error) {
        console.error('Erro ao carregar dados embarcados:', error);
        return false;
    }
}
