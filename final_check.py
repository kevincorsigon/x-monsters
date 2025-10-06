import re
import json

def count_implemented_abilities():
    # Ler o arquivo de habilidades
    with open('card-abilities.js', 'r', encoding='utf-8') as f:
        content = f.read()

    # Encontrar todas as cartas implementadas usando regex mais preciso
    patterns = [
        r"case 'card_(\d+)':",          # Cartas básicas como card_001
        r"case 'card_(\d+_\d+)':",      # Cartas com underscore como card_010_1
    ]
    
    implemented_cards = set()
    for pattern in patterns:
        matches = re.findall(pattern, content)
        implemented_cards.update(matches)

    # Ler o database
    with open('cards_database.json', 'r', encoding='utf-8') as f:
        db = json.load(f)

    # Extrair todas as cartas do database
    all_cards = set()
    card_details = {}
    for card in db['cards']:
        card_num = card['id'].replace('card_', '')
        all_cards.add(card_num)
        card_details[card_num] = {
            'name': card['name'],
            'type': card['type'],
            'hability': card['hability']
        }

    # Encontrar cartas não implementadas
    missing_cards = sorted(all_cards - implemented_cards, key=lambda x: int(x.split('_')[0]))

    print("=" * 60)
    print("🎮 RELATÓRIO FINAL DE IMPLEMENTAÇÃO DE HABILIDADES")
    print("=" * 60)
    print(f'📊 Total de cartas no database: {len(all_cards)}')
    print(f'✅ Cartas implementadas: {len(implemented_cards)}')
    print(f'❌ Cartas faltantes: {len(missing_cards)}')
    print(f'📈 Porcentagem implementada: {len(implemented_cards)/len(all_cards)*100:.1f}%')
    
    if missing_cards:
        print(f'\n🔍 Cartas ainda não implementadas:')
        for card_num in missing_cards:
            if card_num in card_details:
                detail = card_details[card_num]
                print(f"  • card_{card_num} - {detail['name']} ({detail['type']})")
                print(f"    Habilidade: {detail['hability'][:80]}...")
    else:
        print('\n🎉 PARABÉNS! TODAS AS CARTAS FORAM IMPLEMENTADAS!')
        print('🚀 Sistema de habilidades 100% completo!')

    # Verificar funções implementadas
    print(f'\n📋 Funções de habilidades encontradas no código:')
    function_pattern = r'(\w+_\w+)\([^)]*\)\s*{'
    functions = re.findall(function_pattern, content)
    unique_functions = sorted(set(functions))
    
    print(f'🔧 Total de funções únicas implementadas: {len(unique_functions)}')
    
    # Agrupar por categoria
    categories = {
        'Criaturas': [f for f in unique_functions if not any(x in f.lower() for x in ['equip', 'suporte', 'magica', 'buff', 'boost'])],
        'Suportes': [f for f in unique_functions if any(x in f.lower() for x in ['equip', 'suporte', 'boost', 'buff'])]
    }
    
    for category, funcs in categories.items():
        if funcs:
            print(f'\n{category} ({len(funcs)} funções):')
            for i, func in enumerate(funcs[:10]):  # Mostrar apenas primeiras 10
                print(f'  {i+1:2d}. {func}')
            if len(funcs) > 10:
                print(f'     ... e mais {len(funcs)-10} funções')

if __name__ == "__main__":
    count_implemented_abilities()