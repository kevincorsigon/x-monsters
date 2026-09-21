# Executar da raiz do repo: python scripts/rename_by_order.py
import json
import os
import shutil

def rename_by_json_order():
    """Renomeia imagens seguindo a ordem e nomes do JSON"""
    
    # Carregar database
    try:
        with open('data/cards_database.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
            cards = data['cards']
    except Exception as e:
        print(f"❌ Erro ao carregar JSON: {e}")
        return
    
    # Listar imagens atuais
    cards_folder = "assets/cards"
    if not os.path.exists(cards_folder):
        print(f"❌ Pasta {cards_folder} não encontrada")
        return
    
    # Obter lista de arquivos PNG atuais
    current_files = []
    for file in os.listdir(cards_folder):
        if file.lower().endswith('.png'):
            current_files.append(file)
    
    # Ordenar numericamente baseado no número no final do nome
    def extract_number(filename):
        """Extrai número do final do nome do arquivo"""
        import re
        # Procurar por número no final do nome (antes da extensão)
        match = re.search(r'-(\d+)\.png$', filename, re.IGNORECASE)
        if match:
            return int(match.group(1))
        # Se não encontrar número, procurar por número no final sem hífen
        match = re.search(r'(\d+)\.png$', filename, re.IGNORECASE)
        if match:
            return int(match.group(1))
        return 0  # Se não encontrar número, colocar no início
    
    current_files.sort(key=extract_number)  # Ordenar numericamente
    
    print(f"📁 Encontrados {len(current_files)} arquivos PNG")
    print(f"📊 Database tem {len(cards)} cartas")
    
    if len(current_files) != len(cards):
        print(f"⚠️  Aviso: Número de arquivos ({len(current_files)}) diferente do número de cartas ({len(cards)})")
    
    # Mostrar mapeamento
    print("\n🔄 Mapeamento proposto:")
    print("-" * 80)
    
    renames = []
    for i, card in enumerate(cards):
        if i < len(current_files):
            current_file = current_files[i]
            target_name = os.path.basename(card['image'])  # Remove "cards/" do início
            
            if current_file != target_name:
                print(f"{i+1:3d}. {current_file} → {target_name}")
                renames.append({
                    'from': current_file,
                    'to': target_name,
                    'card_name': card['name']
                })
            else:
                print(f"{i+1:3d}. {current_file} ✅ (já correto)")
        else:
            print(f"{i+1:3d}. ❌ Sem arquivo para: {card['name']}")
    
    if not renames:
        print("\n✅ Todos os arquivos já têm nomes corretos!")
        return
    
    print(f"\n📊 Resumo: {len(renames)} arquivos precisam ser renomeados")
    
    # Confirmar
    response = input("\nDeseja prosseguir com a renomeação? (s/n): ").lower().strip()
    
    if response != 's':
        print("❌ Operação cancelada")
        return
    
    # Executar renomeações
    print("\n🔄 Executando renomeações...")
    
    success_count = 0
    for rename_info in renames:
        old_path = os.path.join(cards_folder, rename_info['from'])
        new_path = os.path.join(cards_folder, rename_info['to'])
        
        try:
            # Verificar se arquivo de destino já existe
            if os.path.exists(new_path):
                print(f"⚠️  Pulando {rename_info['from']} → {rename_info['to']} (destino já existe)")
                continue
            
            shutil.move(old_path, new_path)
            print(f"✅ {rename_info['from']} → {rename_info['to']} ({rename_info['card_name']})")
            success_count += 1
            
        except Exception as e:
            print(f"❌ Erro ao renomear {rename_info['from']}: {e}")
    
    print(f"\n🎉 Concluído! {success_count} arquivos renomeados com sucesso")

if __name__ == "__main__":
    print("🚀 Renomeação por Ordem do JSON")
    print("=" * 50)
    rename_by_json_order()
