# Executar da raiz do repo: python scripts/check_cards.py
#
# Desde a Fase 7 (remoção do legado), as habilidades das cartas não vivem mais
# em card-abilities.js (switch-case) — são resolvidas por src/js/card-rules.js
# (motor determinístico). Este script chama o Node para consultar
# `CardRules.isMigrated()` por carta, em vez de fazer regex no arquivo antigo.
import json
import subprocess

NODE_SNIPPET = """
const CardRules = require('./src/js/card-rules.js');
const db = require('./data/cards_database.json');
const ids = db.cards.map(c => c.id.replace('card_', ''));
const migrated = ids.filter(id => CardRules.isMigrated(`card_${id}`));
console.log(JSON.stringify(migrated));
"""

result = subprocess.run(
    ['node', '-e', NODE_SNIPPET],
    capture_output=True, text=True, check=True, cwd='.'
)
implemented_cards = set(json.loads(result.stdout.strip()))

# Ler o database
with open('data/cards_database.json', 'r', encoding='utf-8') as f:
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