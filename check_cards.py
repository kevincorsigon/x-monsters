import re
import json

# Ler o arquivo de habilidades
with open('card-abilities.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Encontrar todas as cartas implementadas
implemented_cards = set(re.findall(r"case 'card_(\d+)':", content))

# Ler o database
with open('cards_database.json', 'r', encoding='utf-8') as f:
    db = json.load(f)

# Extrair todas as cartas do database
all_cards = set()
for card in db['cards']:
    card_id = card['id'].replace('card_', '')
    all_cards.add(card_id)

# Encontrar cartas não implementadas
missing_cards = sorted(all_cards - implemented_cards, key=lambda x: int(x))

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