// Sistema de Deck Builder para X Monsters

// Tamanho oficial do baralho (deck aleatório e presets): 40 cartas é o teto do
// jogo. `server.py` e `pvp-game.js` mantêm a mesma constante — um teste de
// unidade trava a sincronia dos três.
const DECK_SIZE = 40;

// Teto de cópias por carta nos baralhos (o preset aceita até 3 no catálogo). As
// exceções vivem aqui e valem para TODO caminho que monta deck: presets de
// `data/decks.json`, o deck aleatório do hotseat (`createMatchDecks`), o deck
// pela seed do PvP (`scripts/deck_factory.js` usa este mesmo `DeckBuilder`) e o
// fallback `pvp-game.js#gerarDeckLocal`. `card_089` Apelino Pão e Vinho é única
// por deck — o ataque ilimitado não empilha.
const LIMITES_DE_COPIA = Object.freeze({ card_089: 1 });
const TETO_PADRAO_DE_COPIAS = 3;

/** Teto de cópias de uma carta (3 por padrão; `LIMITES_DE_COPIA` reduz casos). */
function limiteDeCopias(definitionId) {
    return LIMITES_DE_COPIA[definitionId] || TETO_PADRAO_DE_COPIAS;
}

// Catálogo de decks pré-montados (data/decks.json). O arquivo guarda só ids de
// carta: as definições continuam vindo exclusivamente de cards_database.json.
const DECKS_PATH = 'data/decks.json';
let decksCatalogCache = null;
let decksCatalogPromessa = null;

class DeckBuilder {
    constructor(cardsDatabase, options = {}) {
        this.allCards = cardsDatabase.cards;
        this.totalCards = cardsDatabase.total_cards;
        this.types = cardsDatabase.types;
        // rng injetavel: default Math.random mantém o comportamento atual
        this.rng = options.rng || Math.random;
    }

    // Criar deck balanceado para um jogador
    createBalancedDeck(deckSize = DECK_SIZE) {
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
        this.adicionarRespeitandoLimite(deck, criaturasSelecionadas);
        
        // Adicionar suportes
        const suportesSelecionados = this.shuffleArray([...suportes]).slice(0, numSuportes);
        this.adicionarRespeitandoLimite(deck, suportesSelecionados);
        
        // Adicionar evoluções (se houver)
        if (numEvolucoes > 0) {
            const evolucoesSelecionadas = this.shuffleArray([...evolucoes]).slice(0, numEvolucoes);
            this.adicionarRespeitandoLimite(deck, evolucoesSelecionadas);
        }
        
        // Preencher o resto com criaturas se necessário
        // (usamos uma cópia consumível do pool para garantir que o loop sempre termina:
        // cada iteração remove uma carta do pool de candidatos, então
        // criaturasDisponiveis.length sempre diminui ou o deck sempre cresce)
        const criaturasDisponiveis = this.shuffleArray(
            criaturas.filter(carta => !deck.find(c => c.id === carta.id))
        );
        while (deck.length < deckSize && criaturasDisponiveis.length > 0) {
            const cartaExtra = criaturasDisponiveis.pop();
            this.adicionarRespeitandoLimite(deck, [cartaExtra]);
        }
        
        return this.shuffleArray(deck).slice(0, deckSize);
    }

    /** Cópias de uma carta já presentes no deck em construção. */
    copiasNoDeck(deck, definitionId) {
        return deck.reduce((total, carta) => total + (carta.id === definitionId ? 1 : 0), 0);
    }

    /**
     * Uma carta só entra no baralho se ainda houver espaço no teto dela
     * (`LIMITES_DE_COPIA`, padrão 3). O sorteio atual não repete cartas, mas a
     * regra fica explícita e barra qualquer caminho que um dia queira repetir —
     * o Apelino Pão e Vinho nunca aparece duas vezes no mesmo deck.
     */
    podeIncluir(deck, carta) {
        return !carta || this.copiasNoDeck(deck, carta.id) < limiteDeCopias(carta.id);
    }

    /** Adiciona as cartas que respeitam o teto e devolve quantas entraram. */
    adicionarRespeitandoLimite(deck, cartas) {
        let adicionadas = 0;
        cartas.forEach(carta => {
            if (!this.podeIncluir(deck, carta)) return;
            deck.push(carta);
            adicionadas++;
        });
        return adicionadas;
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
    shuffleArray(array, rng = this.rng) {
        return DeckBuilder.embaralhar(array, rng);
    }

    /**
     * Embaralha definições de carta (Fisher-Yates) com um RNG injetado. É o único
     * embaralhamento do jogo: cada partida monta o baralho numa ordem nova —
     * inclusive os decks prontos, que chegam do JSON agrupados por custo e nunca
     * podem sair na mesma sequência em duas partidas. Em PvP o RNG é o mulberry32
     * da seed da sala, então o F5 reencontra exatamente a mesma ordem (o replay
     * dos DRAW do ledger depende do mesmo topo de baralho).
     */
    static embaralhar(definicoes, rng = Math.random) {
        const embaralhado = [...definicoes];
        for (let i = embaralhado.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [embaralhado[i], embaralhado[j]] = [embaralhado[j], embaralhado[i]];
        }
        return embaralhado;
    }
    
    // Criar dois decks balanceados para uma partida
    createMatchDecks(deckSize = DECK_SIZE) {
        // Dividir cartas em dois pools para evitar repetição
        const allCardsShuffled = this.shuffleArray([...this.allCards]);
        const midPoint = Math.floor(allCardsShuffled.length / 2);
        
        const pool1 = allCardsShuffled.slice(0, midPoint);
        const pool2 = allCardsShuffled.slice(midPoint);
        
        // Criar DeckBuilder temporários para cada pool
        const deckBuilder1 = new DeckBuilder({ cards: pool1 }, { rng: this.rng });
        const deckBuilder2 = new DeckBuilder({ cards: pool2 }, { rng: this.rng });
        
        return {
            player1: deckBuilder1.createBalancedDeck(deckSize),
            player2: deckBuilder2.createBalancedDeck(deckSize)
        };
    }
    
    // Estatísticas do deck
    getDeckStats(deck) {
        const cards = deck.map(card => card.data || card);
        const stats = {
            total: cards.length,
            criaturas: cards.filter(c => c.type === 'criatura').length,
            suportes: cards.filter(c => c.type === 'suporte').length,
            evolucoes: cards.filter(c => c.type === 'evolução').length,
            custoPorTipo: {},
            custoMedio: 0
        };
        
        // Calcular custo médio
        const custoTotal = cards.reduce((sum, card) => sum + card.cost, 0);
        stats.custoMedio = cards.length > 0 ? (custoTotal / cards.length).toFixed(1) : '0.0';
        
        // Agrupar por tipo e custo
        ['criatura', 'suporte', 'evolução'].forEach(tipo => {
            const cartasTipo = cards.filter(c => c.type === tipo);
            if (cartasTipo.length > 0) {
                const custoMedioTipo = cartasTipo.reduce((sum, c) => sum + c.cost, 0) / cartasTipo.length;
                stats.custoPorTipo[tipo] = custoMedioTipo.toFixed(1);
            }
        });
        
        return stats;
    }

    // Expande um deck pré-montado (data/decks.json) em definições completas do
    // catálogo. O JSON guarda só ids: nenhuma definição é duplicada aqui.
    definicoesDeDeck(deckId, catalogo = null) {
        const deck = encontrarDeckNoCatalogo(deckId, catalogo);
        if (!deck) {
            throw new Error(`Deck desconhecido: ${deckId}`);
        }
        return deck.cartas.map(definitionId => {
            const definicao = this.allCards.find(card => card.id === definitionId);
            if (!definicao) {
                throw new Error(`Carta ${definitionId} do deck ${deckId} não existe no catálogo`);
            }
            return definicao;
        });
    }
}

// ── Catálogo de decks pré-montados (data/decks.json) ─────────────────────────

function normalizarCatalogoDeDecks(dados) {
    if (!dados || !Array.isArray(dados.decks)) return null;
    const decks = dados.decks
        .filter(deck => deck && deck.id && Array.isArray(deck.cartas))
        .map(deck => ({
            ...deck,
            traits: Array.isArray(deck.traits) ? deck.traits.map(t => String(t).toLowerCase()) : [],
            cartas: deck.cartas.map(id => String(id))
        }));
    if (decks.length === 0) return null;
    return { version: dados.version || 1, decks };
}

/**
 * Carrega os decks pré-montados uma única vez por página. Sem `fetch` (Node) ou
 * com o arquivo indisponível, devolve `null` e a seleção cai no deck aleatório
 * — nunca existe um segundo dataset embarcado em JS.
 *
 * Chamadas concorrentes (o hotseat e o boot PvP pedem ao mesmo tempo) dividem a
 * mesma promessa: ninguém vê `deckCatalog` vazio por causa de uma corrida.
 */
async function loadDeckCatalog() {
    if (decksCatalogCache) return decksCatalogCache;
    if (decksCatalogPromessa) return decksCatalogPromessa;
    if (typeof window === 'undefined' || typeof fetch !== 'function') return null;

    decksCatalogPromessa = (async () => {
        try {
            const response = await fetch(DECKS_PATH);
            const dados = await response.json();
            decksCatalogCache = normalizarCatalogoDeDecks(dados);
            window.deckCatalog = decksCatalogCache;
            console.log('Catálogo de decks carregado:', decksCatalogCache
                ? decksCatalogCache.decks.map(d => `${d.nome} (${d.cartas.length})`)
                : 'vazio');
            return decksCatalogCache;
        } catch (error) {
            console.warn('Catálogo de decks indisponível — a seleção cai no deck aleatório:', error);
            return null;
        } finally {
            decksCatalogPromessa = null;
        }
    })();
    return decksCatalogPromessa;
}

function encontrarDeckNoCatalogo(deckId, catalogo = null) {
    const fonte = catalogo
        || (typeof window !== 'undefined' ? window.deckCatalog : null)
        || decksCatalogCache;
    if (!fonte || !Array.isArray(fonte.decks) || !deckId) return null;
    return fonte.decks.find(deck => deck.id === deckId) || null;
}

/** Resumo de um preset (metadados + curva de custo) usado pelo seletor de decks. */
function resumoDeDeck(deckId, catalogo = null, builder = null) {
    const deck = encontrarDeckNoCatalogo(deckId, catalogo);
    const alvo = builder || (typeof window !== 'undefined' ? window.deckBuilder : null);
    if (!deck || !alvo) return null;

    const definicoes = alvo.definicoesDeDeck(deck.id, catalogo);
    const custos = definicoes.map(card => card.cost);
    return {
        ...deck,
        cartasDistintas: [...new Set(deck.cartas)].length,
        stats: alvo.getDeckStats(definicoes),
        faixas: {
            baixo: custos.filter(c => c <= 3).length,
            medio: custos.filter(c => c >= 4 && c <= 6).length,
            alto: custos.filter(c => c >= 7).length
        }
    };
}
if (typeof window !== 'undefined') {
    window.resumoDeDeck = resumoDeDeck;
    // O seletor de decks (deck-select.js) exibe o tamanho do baralho antes da
    // partida existir: a constante precisa estar no escopo global.
    window.DECK_SIZE = DECK_SIZE;
    // Teto de cópias por carta (o Apelino Pão e Vinho é única por deck): a UI e os
    // testes de browser enxergam a mesma regra que o gerador de baralho.
    window.LIMITES_DE_COPIA = LIMITES_DE_COPIA;
    window.limiteDeCopias = limiteDeCopias;
    // `pvp-game.js` monta o deck privado e embaralha o deck do servidor pela
    // classe: sem esta exposição o fallback "cliente gera pela seed" avisava
    // "sem DeckBuilder" e devolvia null.
    window.DeckBuilder = DeckBuilder;
}

/** Id do deck escolhido na partida atual (o Reset reusa; `null` = aleatório). */
function selecaoAtual(player = 'p1') {
    const estado = typeof gameState !== 'undefined' ? gameState : null;
    return estado?.deckSelections?.[player]?.id || null;
}

/**
 * Monta os decks da partida a partir da escolha do jogador: p1 fica com o preset
 * escolhido (quando existe) e p2 recebe um deck balanceado sorteado.
 */
function montarDecksDaEscolha(escolha, deckSize = DECK_SIZE, builder = null, catalogo = null) {
    const alvo = builder || (typeof window !== 'undefined' ? window.deckBuilder : null);
    if (!alvo) {
        throw new Error('DeckBuilder não carregado');
    }

    const aleatorios = alvo.createMatchDecks(deckSize);
    const deckId = typeof escolha === 'string' && escolha !== 'aleatorio' ? escolha : null;
    const escolhido = deckId ? encontrarDeckNoCatalogo(deckId, catalogo) : null;

    if (!escolhido) {
        return { decks: aleatorios, selecoes: { p1: null, p2: null } };
    }

    // A ordem do JSON é só a receita: cada partida embaralha o baralho do preset
    // com o RNG do builder (Math.random no hotseat; seed da sala no PvP).
    const definicoes = alvo.definicoesDeDeck(escolhido.id, catalogo);

    return {
        decks: {
            player1: DeckBuilder.embaralhar(definicoes, alvo.rng),
            player2: aleatorios.player2
        },
        selecoes: {
            p1: { id: escolhido.id, nome: escolhido.nome, emblema: escolhido.emblema || null },
            p2: null
        }
    };
}

// Função para carregar e inicializar o sistema de cartas
async function loadCardSystem() {
    // Idempotente: o boot do hotseat e o da entrada da sala PvP chamam em
    // paralelo; quem chega depois usa o que já está no escopo global (e o
    // catálogo de decks vem junto, sem corrida entre as duas promessas).
    if (typeof window !== 'undefined' && window.cardsDatabase && window.deckCatalog) {
        return true;
    }

    try {
        // Tentar carregar via fetch primeiro (servidor)
        const response = await fetch('data/cards_database.json');
        const cardsData = await response.json();

        // Normaliza traits vindas do JSON para minúsculas (fonte única de traits).
        (cardsData.cards || []).forEach(carta => {
            if (Array.isArray(carta.traits)) {
                carta.traits = carta.traits.map(t => String(t).toLowerCase());
            }
        });

        window.deckBuilder = new DeckBuilder(cardsData);
        window.cardsDatabase = cardsData;
        
        console.log('Sistema de cartas carregado via servidor:', {
            total: cardsData.total_cards,
            tipos: cardsData.types
        });

        // Os decks pré-montados viajam junto: o seletor precisa dos dois catálogos
        // (cards_database define as cartas, decks.json só referencia ids).
        await loadDeckCatalog();

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

        // O fallback embarcado não tem o catálogo de decks: sem ele a seleção
        // fica apenas com o deck aleatório (nada é duplicado em JS).
        await loadDeckCatalog();
        
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
                "image": "assets/cards/dragão_sombrio.png"
            },
            {
                "name": "Lobo Selvagem",
                "type": "criatura",
                "cost": 3,
                "attack": 4,
                "defense": 2,
                "description": "Predador ágil das florestas antigas",
                "id": "card_002",
                "image": "assets/cards/lobo_selvagem.png"
            },
            {
                "name": "Golem de Pedra",
                "type": "criatura",
                "cost": 4,
                "attack": 3,
                "defense": 6,
                "description": "Guardião ancestral feito de pedra mágica",
                "id": "card_003",
                "image": "assets/cards/golem_de_pedra.png"
            },
            {
                "name": "Fênix Ardente",
                "type": "criatura",
                "cost": 6,
                "attack": 7,
                "defense": 3,
                "description": "Ave lendária que renasce das cinzas",
                "id": "card_004",
                "image": "assets/cards/fênix_ardente.png"
            },
            {
                "name": "Espada Flamejante",
                "type": "suporte",
                "cost": 2,
                "attack": 3,
                "defense": 0,
                "description": "Arma mágica que aumenta o poder de ataque",
                "id": "card_005",
                "image": "assets/cards/espada_flamejante.png"
            },
            {
                "name": "Escudo Sagrado",
                "type": "suporte",
                "cost": 3,
                "attack": 0,
                "defense": 4,
                "description": "Proteção divina contra ataques",
                "id": "card_006",
                "image": "assets/cards/escudo_sagrado.png"
            },
            {
                "name": "Mago Elemental",
                "type": "criatura",
                "cost": 4,
                "attack": 5,
                "defense": 3,
                "description": "Conjurador dos elementos primordiais",
                "id": "card_007",
                "image": "assets/cards/mago_elemental.png"
            },
            {
                "name": "Cavaleiro Real",
                "type": "criatura",
                "cost": 5,
                "attack": 4,
                "defense": 5,
                "description": "Nobre guerreiro do reino dourado",
                "id": "card_008",
                "image": "assets/cards/cavaleiro_real.png"
            },
            {
                "name": "Arqueiro Élfico",
                "type": "criatura",
                "cost": 3,
                "attack": 4,
                "defense": 2,
                "description": "Atirador preciso das florestas élficas",
                "id": "card_009",
                "image": "assets/cards/arqueiro_élfico.png"
            },
            {
                "name": "Troll das Montanhas",
                "type": "criatura",
                "cost": 6,
                "attack": 7,
                "defense": 6,
                "description": "Gigante brutal dos picos gelados",
                "id": "card_010",
                "image": "assets/cards/troll_das_montanhas.png"
            },
            {
                "name": "Necromante",
                "type": "criatura",
                "cost": 5,
                "attack": 3,
                "defense": 4,
                "description": "Mestre das artes sombrias da morte",
                "id": "card_011",
                "image": "assets/cards/necromante.png"
            },
            {
                "name": "Poção de Cura",
                "type": "suporte",
                "cost": 1,
                "attack": 0,
                "defense": 0,
                "description": "Restaura pontos de vida",
                "id": "card_012",
                "image": "assets/cards/poção_de_cura.png"
            },
            {
                "name": "Armadura de Ferro",
                "type": "suporte",
                "cost": 2,
                "attack": 0,
                "defense": 3,
                "description": "Proteção metálica resistente",
                "id": "card_013",
                "image": "assets/cards/armadura_de_ferro.png"
            },
            {
                "name": "Orc Guerreiro",
                "type": "criatura",
                "cost": 2,
                "attack": 3,
                "defense": 2,
                "description": "Bárbaro feroz das terras devastadas",
                "id": "card_014",
                "image": "assets/cards/orc_guerreiro.png"
            },
            {
                "name": "Fada Curadora",
                "type": "criatura",
                "cost": 2,
                "attack": 1,
                "defense": 2,
                "description": "Ser mágico com poderes de cura",
                "id": "card_015",
                "image": "assets/cards/fada_curadora.png"
            },
            {
                "name": "Tempestade de Raios",
                "type": "suporte",
                "cost": 4,
                "attack": 5,
                "defense": 0,
                "description": "Magia devastadora dos céus",
                "id": "card_016",
                "image": "assets/cards/tempestade_de_raios.png"
            },
            {
                "name": "Vampiro Sanguinário",
                "type": "criatura",
                "cost": 4,
                "attack": 4,
                "defense": 3,
                "description": "Morto-vivo sedento por sangue",
                "id": "card_017",
                "image": "assets/cards/vampiro_sanguinário.png"
            },
            {
                "name": "Anjo Guardião",
                "type": "criatura",
                "cost": 7,
                "attack": 6,
                "defense": 6,
                "description": "Celestial protetor da luz divina",
                "id": "card_018",
                "image": "assets/cards/anjo_guardião.png"
            },
            {
                "name": "Machado Bárbaro",
                "type": "suporte",
                "cost": 3,
                "attack": 4,
                "defense": 0,
                "description": "Arma brutal dos clãs selvagens",
                "id": "card_019",
                "image": "assets/cards/machado_bárbaro.png"
            },
            {
                "name": "Esqueleto Guerreiro",
                "type": "criatura",
                "cost": 2,
                "attack": 2,
                "defense": 3,
                "description": "Soldado morto-vivo incansável",
                "id": "card_020",
                "image": "assets/cards/esqueleto_guerreiro.png"
            },
            {
                "name": "Marik 2",
                "type": "evolução",
                "cost": 8,
                "attack": 8,
                "defense": 7,
                "description": "Evolução suprema do lendário Marik",
                "id": "card_021",
                "image": "assets/cards/marik_2.png"
            },
            {
                "name": "Turtol Maximus",
                "type": "evolução",
                "cost": 9,
                "attack": 7,
                "defense": 9,
                "description": "Forma evoluída definitiva de Turtol",
                "id": "card_022",
                "image": "assets/cards/turtol_maximus.png"
            },
            {
                "name": "Elemental de Fogo",
                "type": "criatura",
                "cost": 4,
                "attack": 5,
                "defense": 2,
                "description": "Espírito flamejante dos vulcões",
                "id": "card_023",
                "image": "assets/cards/elemental_de_fogo.png"
            },
            {
                "name": "Elemental de Água",
                "type": "criatura",
                "cost": 4,
                "attack": 3,
                "defense": 5,
                "description": "Guardião dos oceanos profundos",
                "id": "card_024",
                "image": "assets/cards/elemental_de_água.png"
            },
            {
                "name": "Báculo Mágico",
                "type": "suporte",
                "cost": 3,
                "attack": 2,
                "defense": 1,
                "description": "Amplifica poderes arcanos",
                "id": "card_025",
                "image": "assets/cards/báculo_mágico.png"
            },
            {
                "name": "Centauro Caçador",
                "type": "criatura",
                "cost": 4,
                "attack": 4,
                "defense": 4,
                "description": "Arqueiro híbrido das planícies",
                "id": "card_026",
                "image": "assets/cards/centauro_caçador.png"
            },
            {
                "name": "Dragão de Gelo",
                "type": "criatura",
                "cost": 6,
                "attack": 6,
                "defense": 5,
                "description": "Dragão das terras congeladas",
                "id": "card_027",
                "image": "assets/cards/dragão_de_gelo.png"
            },
            {
                "name": "Capa da Invisibilidade",
                "type": "suporte",
                "cost": 2,
                "attack": 0,
                "defense": 2,
                "description": "Permite ataques furtivos",
                "id": "card_028",
                "image": "assets/cards/capa_da_invisibilidade.png"
            },
            {
                "name": "Minotauro",
                "type": "criatura",
                "cost": 5,
                "attack": 6,
                "defense": 4,
                "description": "Guardião bestial do labirinto",
                "id": "card_029",
                "image": "assets/cards/minotauro.png"
            },
            {
                "name": "Cristal de Energia",
                "type": "suporte",
                "cost": 1,
                "attack": 0,
                "defense": 0,
                "description": "Aumenta energia disponível",
                "id": "card_030",
                "image": "assets/cards/cristal_de_energia.png"
            }
        ]
    };
}

// Função para inicializar uma nova partida com decks balanceados (ou com o deck
// escolhido pelo jogador no seletor). Sem argumento reaproveita a escolha da
// partida atual — é o que o Reset faz; `null`/`'aleatorio'` força o sorteio.
async function startNewMatch(escolha) {
    if (!window.deckBuilder || !window.GameStateModel) {
        console.error('Sistema de cartas não carregado!');
        return;
    }

    const selecionada = escolha === undefined ? selecaoAtual('p1') : escolha;
    const { decks, selecoes } = montarDecksDaEscolha(selecionada);

    window.GameStateModel.resetMatchState(gameState, {
        p1: decks.player1,
        p2: decks.player2
    }, { ...window.gameConfig, deckSelections: selecoes });
    
    // Baralho PvP/hotseat: 40 cartas (mão inicial segue 5 para cada jogador)
    for (let i = 0; i < 5; i++) {
        drawCardFromDeck('p1');
        drawCardFromDeck('p2');
    }

    if (window.renderHandsFromState) {
        window.renderHandsFromState();
    }
    if (window.renderPlayerStats) {
        window.renderPlayerStats();
    }
    
    // Estatísticas dos decks
    const stats1 = window.deckBuilder.getDeckStats(decks.player1);
    const stats2 = window.deckBuilder.getDeckStats(decks.player2);
    
    console.log('Nova partida iniciada!');
    console.log(selecoes.p1 ? `Deck do P1: ${selecoes.p1.nome} (${selecoes.p1.id})` : 'Deck do P1: sorteado');
    console.log('Deck Player 1:', stats1);
    console.log('Deck Player 2:', stats2);
    
    updateUI();
    return { decks, selecoes };
}

// Função para sacar carta do deck
function drawCardFromDeck(player) {
    if (!window.GameStateModel) {
        console.error('Modelo de estado não carregado!');
        return null;
    }

    const cardInstance = window.GameStateModel.drawCard(gameState, player);
    if (!cardInstance) {
        // Duas recusas possíveis: deck vazio ou mão no limite (`HAND_LIMIT`).
        console.log(window.GameStateModel.handLimitReached(gameState, player)
            ? `Mão do ${player} cheia (limite de ${window.GameStateModel.HAND_LIMIT} cartas)!`
            : `Deck do ${player} está vazio!`);
        return null;
    }

    console.log(`${player} sacou: ${cardInstance.data.name}`);
    return cardInstance;
}

// Exportar para uso global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        DECK_SIZE,
        DECKS_PATH,
        LIMITES_DE_COPIA,
        limiteDeCopias,
        DeckBuilder,
        loadCardSystem,
        loadDeckCatalog,
        encontrarDeckNoCatalogo,
        resumoDeDeck,
        montarDecksDaEscolha,
        startNewMatch,
        drawCardFromDeck
    };
}
