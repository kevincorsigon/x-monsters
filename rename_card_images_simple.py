import json
import os
import shutil
from difflib import SequenceMatcher
import re
from collections import defaultdict

class CardImageRenamer:
    def __init__(self, json_path, images_folder):
        self.json_path = json_path
        self.images_folder = images_folder
        self.cards_data = []
        self.load_cards_data()
    
    def load_cards_data(self):
        """Carrega os dados das cartas do JSON"""
        try:
            with open(self.json_path, 'r', encoding='utf-8') as file:
                data = json.load(file)
                self.cards_data = data['cards']
                print(f"✅ Carregadas {len(self.cards_data)} cartas do JSON")
        except Exception as e:
            print(f"❌ Erro ao carregar JSON: {e}")
    
    def normalize_text(self, text):
        """Normaliza texto para comparação"""
        if not text:
            return ""
        
        # Converter para minúsculas
        text = text.lower()
        
        # Remover acentos e caracteres especiais
        replacements = {
            'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a',
            'é': 'e', 'ê': 'e',
            'í': 'i', 'î': 'i',
            'ó': 'o', 'ô': 'o', 'õ': 'o',
            'ú': 'u', 'û': 'u',
            'ç': 'c',
            'ñ': 'n'
        }
        
        for old, new in replacements.items():
            text = text.replace(old, new)
        
        # Remover caracteres especiais, manter apenas letras, números e espaços
        text = re.sub(r'[^\w\s]', '_', text)
        
        # Remover espaços extras e substituir por underscore
        text = re.sub(r'\s+', '_', text.strip())
        
        return text
    
    def extract_name_from_filename(self, filename):
        """Extrai o nome base do arquivo removendo extensão e números"""
        # Remover extensão
        name = os.path.splitext(filename)[0]
        
        # Remover números e underscores no final (como _1, _2, etc.)
        name = re.sub(r'_?\d+$', '', name)
        
        return name
    
    def calculate_similarity(self, text1, text2):
        """Calcula similaridade entre dois textos normalizados"""
        if not text1 or not text2:
            return 0.0
        
        # Normalizar ambos os textos
        norm1 = self.normalize_text(text1)
        norm2 = self.normalize_text(text2)
        
        # Calcular similaridade básica
        similarity = SequenceMatcher(None, norm1, norm2).ratio()
        
        # Verificar se um está contido no outro
        if norm1 in norm2 or norm2 in norm1:
            similarity = max(similarity, 0.9)
        
        # Verificar palavras-chave importantes
        words1 = set(norm1.split('_'))
        words2 = set(norm2.split('_'))
        
        if words1 and words2:
            word_overlap = len(words1.intersection(words2)) / max(len(words1), len(words2))
            similarity = max(similarity, word_overlap)
        
        return similarity
    
    def find_best_match_by_filename(self, image_filename):
        """Encontra a melhor correspondência baseada no nome do arquivo"""
        extracted_name = self.extract_name_from_filename(image_filename)
        
        best_match = None
        best_similarity = 0.0
        
        for card in self.cards_data:
            card_name = card['name']
            expected_filename = os.path.basename(card['image'])
            expected_name = self.extract_name_from_filename(expected_filename)
            
            # Calcular similaridade com o nome da carta
            similarity1 = self.calculate_similarity(extracted_name, card_name)
            
            # Calcular similaridade com o nome do arquivo esperado
            similarity2 = self.calculate_similarity(extracted_name, expected_name)
            
            # Usar a maior similaridade
            similarity = max(similarity1, similarity2)
            
            if similarity > best_similarity:
                best_similarity = similarity
                best_match = card
        
        return best_match, best_similarity
    
    def get_image_files(self):
        """Obtém lista de arquivos de imagem na pasta"""
        image_extensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp']
        image_files = []
        
        for file in os.listdir(self.images_folder):
            if any(file.lower().endswith(ext) for ext in image_extensions):
                image_files.append(file)
        
        return sorted(image_files)
    
    def analyze_naming_patterns(self):
        """Analisa padrões de nomenclatura das imagens"""
        image_files = self.get_image_files()
        
        print(f"📊 Análise de {len(image_files)} arquivos de imagem:")
        print(f"📊 Total de cartas no JSON: {len(self.cards_data)}")
        
        # Mapear arquivos de imagem esperados
        expected_files = set()
        for card in self.cards_data:
            expected_file = os.path.basename(card['image'])
            expected_files.add(expected_file)
        
        # Arquivos que já estão corretos
        correct_files = []
        missing_files = []
        extra_files = []
        
        for img_file in image_files:
            if img_file in expected_files:
                correct_files.append(img_file)
            else:
                extra_files.append(img_file)
        
        for expected in expected_files:
            if expected not in image_files:
                missing_files.append(expected)
        
        print(f"✅ Arquivos corretos: {len(correct_files)}")
        print(f"❌ Arquivos faltando: {len(missing_files)}")
        print(f"🔄 Arquivos para renomear: {len(extra_files)}")
        
        if missing_files[:5]:  # Mostrar apenas os primeiros 5
            print(f"\n📋 Exemplos de arquivos faltando:")
            for file in missing_files[:5]:
                print(f"   • {file}")
        
        if extra_files[:5]:  # Mostrar apenas os primeiros 5
            print(f"\n📋 Exemplos de arquivos para renomear:")
            for file in extra_files[:5]:
                print(f"   • {file}")
        
        return correct_files, missing_files, extra_files
    
    def rename_images(self, dry_run=True, min_similarity=0.5):
        """Renomeia as imagens baseado no matching de nomes"""
        correct_files, missing_files, extra_files = self.analyze_naming_patterns()
        
        if not extra_files:
            print("\n🎉 Todos os arquivos já estão com nomes corretos!")
            return []
        
        renamed_count = 0
        matches_found = []
        
        print(f"\n🔍 Analisando {len(extra_files)} arquivos para renomeação:")
        
        for i, image_file in enumerate(extra_files, 1):
            image_path = os.path.join(self.images_folder, image_file)
            print(f"\n🔍 [{i}/{len(extra_files)}] Analisando: {image_file}")
            
            # Encontrar melhor correspondência baseada no nome do arquivo
            best_match, similarity = self.find_best_match_by_filename(image_file)
            
            if best_match and similarity >= min_similarity:
                expected_filename = os.path.basename(best_match['image'])
                print(f"✅ Match encontrado: '{best_match['name']}' (similaridade: {similarity:.2f})")
                print(f"📄 Arquivo esperado: {expected_filename}")
                
                if image_file != expected_filename:
                    new_path = os.path.join(self.images_folder, expected_filename)
                    
                    # Verificar se o arquivo de destino já existe
                    if os.path.exists(new_path):
                        print(f"⚠️  Arquivo {expected_filename} já existe, pulando...")
                        continue
                    
                    if dry_run:
                        print(f"🔄 [DRY RUN] Renomearia: {image_file} → {expected_filename}")
                    else:
                        try:
                            shutil.move(image_path, new_path)
                            print(f"✅ Renomeado: {image_file} → {expected_filename}")
                            renamed_count += 1
                        except Exception as e:
                            print(f"❌ Erro ao renomear: {e}")
                
                matches_found.append({
                    'original': image_file,
                    'expected': expected_filename,
                    'card_name': best_match['name'],
                    'similarity': similarity
                })
            else:
                print(f"❌ Nenhuma correspondência encontrada (melhor similaridade: {similarity:.2f})")
        
        print(f"\n📊 Resumo:")
        print(f"   • Arquivos analisados: {len(extra_files)}")
        print(f"   • Matches encontrados: {len(matches_found)}")
        if not dry_run:
            print(f"   • Arquivos renomeados: {renamed_count}")
        
        return matches_found
    
    def show_detailed_matches(self, matches, limit=10):
        """Mostra detalhes dos matches encontrados"""
        if not matches:
            return
        
        print(f"\n📋 Detalhes dos matches (mostrando {min(limit, len(matches))}):")
        print("=" * 80)
        
        for i, match in enumerate(matches[:limit], 1):
            print(f"{i:2d}. {match['original']}")
            print(f"    → {match['expected']}")
            print(f"    📝 Carta: {match['card_name']}")
            print(f"    📊 Similaridade: {match['similarity']:.2f}")
            print()

def main():
    # Configurações
    json_path = "cards_database.json"
    images_folder = "cards"
    
    print("🎮 X-Monsters Card Image Renamer v2.0")
    print("📝 Renomeação baseada em análise de nomes de arquivos")
    print("=" * 60)
    
    # Verificar se os arquivos/pastas existem
    if not os.path.exists(json_path):
        print(f"❌ Arquivo JSON não encontrado: {json_path}")
        return
    
    if not os.path.exists(images_folder):
        print(f"❌ Pasta de imagens não encontrada: {images_folder}")
        return
    
    # Criar instância do renomeador
    renamer = CardImageRenamer(json_path, images_folder)
    
    if not renamer.cards_data:
        print("❌ Nenhuma carta carregada do JSON")
        return
    
    # Executar análise
    print(f"\n🔍 MODO DRY-RUN (apenas simulação):")
    matches = renamer.rename_images(dry_run=True, min_similarity=0.4)
    
    if matches:
        print(f"\n✅ Encontrados {len(matches)} matches!")
        renamer.show_detailed_matches(matches, limit=15)
        
        print("\nDeseja prosseguir com a renomeação? (s/n): ", end="")
        response = input().strip().lower()
        
        if response in ['s', 'sim', 'y', 'yes']:
            print("\n🔄 Executando renomeação...")
            final_matches = renamer.rename_images(dry_run=False, min_similarity=0.4)
            print("\n🎉 Processo concluído!")
            
            # Executar nova análise para ver o resultado
            print("\n📊 Status após renomeação:")
            renamer.analyze_naming_patterns()
        else:
            print("\n🚫 Renomeação cancelada")
    else:
        print("\n❌ Nenhuma correspondência encontrada com similaridade suficiente")

if __name__ == "__main__":
    main()
