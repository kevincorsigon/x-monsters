# Executar da raiz do repo: python scripts/check_cards.py
#
# Desde a Fase 7 (remoção do legado), as habilidades das cartas não vivem mais
# em card-abilities.js (switch-case) — são resolvidas por src/js/card-rules.js
# (motor determinístico). Muitas cartas são registradas em tabelas
# declarativas (SUMMON_RULES, EQUIPMENT_RULES etc.), mas várias outras são
# resolvidas por checagens `definitionId === 'card_XXX'` embutidas em
# handlers de evento compartilhados (ex.: validação de alvo de ataque,
# handlers de combate) — por isso o sinal mais confiável de "carta com
# alguma regra própria no motor" é a própria carta ser mencionada em
# card-rules.js, não a presença em uma tabela específica.
import json
import re

with open('src/js/card-rules.js', 'r', encoding='utf-8') as f:
    rules_source = f.read()

with open('data/cards_database.json', 'r', encoding='utf-8') as f:
    db = json.load(f)

all_ids = {card['id'] for card in db['cards']}
implemented_ids = {
    card_id for card_id in all_ids
    if re.search(rf'\b{re.escape(card_id)}\b', rules_source)
}
implemented_cards = {card_id.replace('card_', '') for card_id in implemented_ids}

# Extrair todas as cartas do database
all_cards = {card_id.replace('card_', '') for card_id in all_ids}

# Encontrar cartas não implementadas
missing_cards = sorted(all_cards - implemented_cards, key=lambda x: int(x.split('_')[0]))

print(f'Total de cartas no database: {len(all_cards)}')
print(f'Cartas implementadas: {len(implemented_cards)}')
print(f'Cartas faltantes: {len(missing_cards)}')
print(f'Porcentagem implementada: {len(implemented_cards)/len(all_cards)*100:.1f}%')
print(f'\nCartas faltantes: {missing_cards}')

# Criar lista das cartas faltantes com suas habilidades
print('\n=== DETALHES DAS CARTAS FALTANTES ===')
for card in db['cards']:
    card_num = card['id'].replace('card_', '')
    if card_num in missing_cards:
        print(f"ID: {card['id']} - {card['name']} ({card['type']})")
        print(f"  Habilidade: {card['hability']}")
        print()