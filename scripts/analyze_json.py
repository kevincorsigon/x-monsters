# Executar da raiz do repo: python scripts/analyze_json.py
import json

def analyze_json_structure():
    """Analisa a estrutura do JSON para entender duplicações"""
    
    with open('data/cards_database.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
        cards = data['cards']
    
    print(f"📊 Total de entradas no JSON: {len(cards)}")
    
    # Verificar nomes únicos
    unique_names = set()
    name_counts = {}
    
    for card in cards:
        name = card['name']
        unique_names.add(name)
        if name in name_counts:
            name_counts[name] += 1
        else:
            name_counts[name] = 1
    
    print(f"📊 Nomes únicos de cartas: {len(unique_names)}")
    
    # Mostrar duplicações
    duplicates = {name: count for name, count in name_counts.items() if count > 1}
    if duplicates:
        print(f"\n⚠️  Cartas duplicadas:")
        for name, count in duplicates.items():
            print(f"   • {name}: {count}x")
    
    # Verificar images únicas
    unique_images = set()
    image_counts = {}
    
    for card in cards:
        image = card['image']
        unique_images.add(image)
        if image in image_counts:
            image_counts[image] += 1
        else:
            image_counts[image] = 1
    
    print(f"📊 Imagens únicas: {len(unique_images)}")
    
    # Mostrar duplicações de imagem
    image_duplicates = {image: count for image, count in image_counts.items() if count > 1}
    if image_duplicates:
        print(f"\n⚠️  Imagens duplicadas:")
        for image, count in image_duplicates.items():
            print(f"   • {image}: {count}x")

if __name__ == "__main__":
    analyze_json_structure()
