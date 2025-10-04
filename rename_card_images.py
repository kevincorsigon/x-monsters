import json
import os
import cv2
import pytesseract
from PIL import Image
import numpy as np
import shutil
from difflib import SequenceMatcher
import re

# Configurar o caminho do tesseract
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

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
    
    def preprocess_image(self, image_path, focus_on_title=True):
        """Pré-processa a imagem para melhorar OCR, focando no título se especificado"""
        try:
            # Carregar imagem
            img = cv2.imread(image_path)
            if img is None:
                return None
            
            # Se focar no título, cortar apenas a parte superior da imagem
            if focus_on_title:
                height, width = img.shape[:2]
                # Pegar região mais ampla do título: 10-30% da altura, margem lateral
                start_y = int(height * 0.10)
                end_y = int(height * 0.30) 
                start_x = int(width * 0.05)
                end_x = int(width * 0.95)
                img = img[start_y:end_y, start_x:end_x]
            
            # Converter para escala de cinza
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            
            # Melhorar contraste especificamente para texto
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
            enhanced = clahe.apply(gray)
            
            # Aplicar blur leve para suavizar ruído
            blurred = cv2.GaussianBlur(enhanced, (3, 3), 0)
            
            # Threshold adaptativo otimizado para texto em cartas
            thresh = cv2.adaptiveThreshold(
                blurred, 255, 
                cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                cv2.THRESH_BINARY, 
                15, 8
            )
            
            # Operações morfológicas para limpar o texto
            kernel = np.ones((2,2), np.uint8)
            cleaned = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
            
            # Redimensionar significativamente para melhor OCR
            height, width = cleaned.shape
            scale_factor = 6  # Aumentar ainda mais
            new_width = width * scale_factor
            new_height = height * scale_factor
            resized = cv2.resize(cleaned, (new_width, new_height), interpolation=cv2.INTER_CUBIC)
            
            # Aplicar sharpening para melhorar definição do texto
            kernel_sharp = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])
            sharpened = cv2.filter2D(resized, -1, kernel_sharp)
            
            return sharpened
        except Exception as e:
            print(f"❌ Erro no pré-processamento de {image_path}: {e}")
            return None
    
    def extract_title_from_image(self, image_path):
        """Extrai especificamente o título da carta usando OCR focado em português"""
        try:
            # Método 1: Imagem focada no título com português
            title_img = self.preprocess_image(image_path, focus_on_title=True)
            title_text = ""
            
            if title_img is not None:
                # Tentar primeiro com português
                try:
                    title_config = r'--oem 3 --psm 8'
                    title_text = pytesseract.image_to_string(title_img, config=title_config, lang='por').strip()
                except:
                    # Fallback para inglês se português não funcionar
                    title_text = pytesseract.image_to_string(title_img, config=title_config, lang='eng').strip()
            
            # Método 2: Área do título mais precisa
            if not title_text or len(title_text) < 3:
                img_original = Image.open(image_path)
                width, height = img_original.size
                
                # Cortar uma área mais específica para o título (primeiros 15% da altura)
                title_area = img_original.crop((0, 0, width, int(height * 0.15)))
                
                try:
                    # PSM 7 para linha única de texto
                    single_line_config = r'--oem 3 --psm 7'
                    title_text = pytesseract.image_to_string(title_area, config=single_line_config, lang='por').strip()
                except:
                    title_text = pytesseract.image_to_string(title_area, config=single_line_config, lang='eng').strip()
            
            # Método 3: Área um pouco maior e PSM diferente
            if not title_text or len(title_text) < 3:
                img_original = Image.open(image_path)
                width, height = img_original.size
                title_area = img_original.crop((0, 0, width, int(height * 0.20)))
                
                try:
                    # PSM 6 para bloco uniforme
                    block_config = r'--oem 3 --psm 6'
                    title_text = pytesseract.image_to_string(title_area, config=block_config, lang='por').strip()
                except:
                    title_text = pytesseract.image_to_string(title_area, config=block_config, lang='eng').strip()
            
            # Método 4: PSM 13 para linha única (último recurso)
            if not title_text or len(title_text) < 3:
                img_original = Image.open(image_path)
                width, height = img_original.size
                title_area = img_original.crop((0, 0, width, int(height * 0.18)))
                
                try:
                    single_config = r'--oem 3 --psm 13'
                    title_text = pytesseract.image_to_string(title_area, config=single_config, lang='por').strip()
                except:
                    title_text = pytesseract.image_to_string(title_area, config=single_config, lang='eng').strip()
            
            # Processar o texto extraído
            if title_text:
                # Dividir em linhas e pegar a que parece ser o título
                lines = [line.strip() for line in title_text.split('\n') if line.strip()]
                
                if lines:
                    # Pegar a linha mais longa que tenha pelo menos 3 caracteres
                    potential_titles = [line for line in lines if len(line) >= 3]
                    if potential_titles:
                        # Escolher a primeira linha válida
                        title_text = potential_titles[0]
                    else:
                        title_text = lines[0] if lines else ""
            
            # Limpar e normalizar o texto do título
            cleaned_title = self.normalize_extracted_text(title_text)
            
            return cleaned_title
            
        except Exception as e:
            print(f"❌ Erro no OCR do título de {image_path}: {e}")
            return ""
    
    def extract_text_from_image(self, image_path):
        """Extrai texto da imagem usando OCR - mantido para compatibilidade"""
        # Usar o método focado no título como principal
        title = self.extract_title_from_image(image_path)
        if title:
            return title
        
        # Fallback para texto completo se necessário
        try:
            img_original = Image.open(image_path)
            full_text = pytesseract.image_to_string(img_original, lang='eng').strip()
            return self.normalize_extracted_text(full_text)
        except Exception as e:
            print(f"❌ Erro no OCR completo de {image_path}: {e}")
            return ""
    
    def normalize_extracted_text(self, text):
        """Normaliza texto extraído do OCR removendo acentos e caracteres especiais"""
        if not text:
            return ""
        
        # Converter para minúsculas
        text = text.lower()
        
        # Remover acentos e caracteres especiais
        replacements = {
            'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a', 'ä': 'a',
            'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
            'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
            'ó': 'o', 'ò': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
            'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
            'ç': 'c',
            'ñ': 'n'
        }
        
        for old, new in replacements.items():
            text = text.replace(old, new)
        
        # Remover números e caracteres especiais, manter apenas letras e espaços
        text = re.sub(r'[^a-z\s]', ' ', text)
        
        # Remover espaços extras
        text = ' '.join(text.split())
        
        return text
    
    def normalize_card_name(self, card_name):
        """Normaliza nome da carta do JSON para comparação"""
        if not card_name:
            return ""
        
        # Converter para minúsculas
        name = card_name.lower()
        
        # Remover acentos e caracteres especiais
        replacements = {
            'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a', 'ä': 'a',
            'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
            'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
            'ó': 'o', 'ò': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
            'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
            'ç': 'c',
            'ñ': 'n'
        }
        
        for old, new in replacements.items():
            name = name.replace(old, new)
        
        # Remover números e caracteres especiais, manter apenas letras e espaços
        name = re.sub(r'[^a-z\s]', ' ', name)
        
        # Remover espaços extras
        name = ' '.join(name.split())
        
        return name
    
    def calculate_similarity(self, extracted_text, card_name):
        """Calcula similaridade entre texto extraído e nome da carta"""
        if not extracted_text or not card_name:
            return 0.0
        
        # Normalizar ambos os textos
        text_normalized = self.normalize_extracted_text(extracted_text)
        card_normalized = self.normalize_card_name(card_name)
        
        if not text_normalized or not card_normalized:
            return 0.0
        
        # Calcular similaridade usando SequenceMatcher
        similarity = SequenceMatcher(None, text_normalized, card_normalized).ratio()
        
        # Verificar se o nome da carta está contido no texto extraído
        if card_normalized in text_normalized:
            similarity = max(similarity, 0.9)
        elif text_normalized in card_normalized:
            similarity = max(similarity, 0.8)
        
        # Verificar palavras-chave importantes
        words_extracted = set(text_normalized.split())
        words_card = set(card_normalized.split())
        
        if words_extracted and words_card:
            word_overlap = len(words_extracted.intersection(words_card)) / max(len(words_extracted), len(words_card))
            similarity = max(similarity, word_overlap)
        
        # Bônus para matches exatos de palavras importantes
        important_words = []
        for word in words_card:
            if len(word) >= 3:  # Palavras com 3 ou mais caracteres
                important_words.append(word)
        
        if important_words:
            exact_matches = sum(1 for word in important_words if word in words_extracted)
            if exact_matches > 0:
                word_bonus = (exact_matches / len(important_words)) * 0.3
                similarity = min(1.0, similarity + word_bonus)
        
        return similarity
    
    def find_best_match(self, extracted_text, min_similarity=0.4):
        """Encontra a melhor correspondência entre texto extraído e nomes das cartas"""
        best_match = None
        best_similarity = 0.0
        best_matches = []  # Para debug
        
        for card in self.cards_data:
            card_name = card['name']
            similarity = self.calculate_similarity(extracted_text, card_name)
            
            if similarity >= min_similarity:
                best_matches.append((card_name, similarity))
                
                if similarity > best_similarity:
                    best_similarity = similarity
                    best_match = card
        
        # Ordenar matches para debug (mostra top 3)
        best_matches.sort(key=lambda x: x[1], reverse=True)
        if len(best_matches) > 1:
            top_matches = best_matches[:3]
            print(f"    🔍 Top matches: {', '.join([f'{name}({sim:.2f})' for name, sim in top_matches])}")
        
        return best_match, best_similarity
    

    
    def get_image_files(self):
        """Obtém lista de arquivos de imagem na pasta"""
        image_extensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp']
        image_files = []
        
        for file in os.listdir(self.images_folder):
            if any(file.lower().endswith(ext) for ext in image_extensions):
                image_files.append(file)
        
        return sorted(image_files)
    
    def rename_images(self, dry_run=True):
        """Renomeia as imagens baseado no OCR e matching"""
        image_files = self.get_image_files()
        print(f"📁 Encontrados {len(image_files)} arquivos de imagem")
        
        renamed_count = 0
        matches_found = []
        
        # Manter registro de arquivos já renomeados para gerar sufixos
        renamed_files = set()
        
        for i, image_file in enumerate(image_files, 1):
            image_path = os.path.join(self.images_folder, image_file)
            print(f"\n🔍 [{i}/{len(image_files)}] Analisando: {image_file}")
            
            # Extrair título da imagem (foco na parte superior)
            extracted_title = self.extract_title_from_image(image_path)
            print(f"📝 Título extraído: '{extracted_title}' ({len(extracted_title)} chars)")
            
            if not extracted_title:
                print("⚠️  Nenhum título extraído")
                continue
            
            # Encontrar melhor correspondência
            best_match, similarity = self.find_best_match(extracted_title)
            
            if best_match:
                base_filename = os.path.basename(best_match['image'])
                print(f"✅ Match encontrado: '{best_match['name']}' (similaridade: {similarity:.2f})")
                print(f"📄 Arquivo alvo: {base_filename}")
                
                if image_file != base_filename:
                    new_path = os.path.join(self.images_folder, base_filename)
                    
                    if dry_run:
                        # Verificar se já existe para dry run
                        if os.path.exists(new_path) or base_filename in renamed_files:
                            print(f"⚠️  [DRY RUN] Arquivo {base_filename} já existe, pularia...")
                        else:
                            print(f"🔄 [DRY RUN] Renomearia: {image_file} → {base_filename}")
                            renamed_files.add(base_filename)  # Simular para dry run
                    else:
                        try:
                            # Verificar se o arquivo de destino já existe
                            if os.path.exists(new_path):
                                print(f"⚠️  Arquivo {base_filename} já existe, pulando...")
                                continue
                            
                            shutil.move(image_path, new_path)
                            print(f"✅ Renomeado: {image_file} → {base_filename}")
                            renamed_files.add(base_filename)
                            renamed_count += 1
                        except Exception as e:
                            print(f"❌ Erro ao renomear: {e}")
                else:
                    print(f"✅ Arquivo já tem nome correto: {image_file}")
                    renamed_files.add(base_filename)
                
                matches_found.append({
                    'original': image_file,
                    'expected': base_filename,
                    'card_name': best_match['name'],
                    'similarity': similarity
                })
            else:
                print("❌ Nenhuma correspondência encontrada")
        
        print(f"\n📊 Resumo:")
        print(f"   • Imagens analisadas: {len(image_files)}")
        print(f"   • Matches encontrados: {len(matches_found)}")
        if not dry_run:
            print(f"   • Arquivos renomeados: {renamed_count}")
        
        return matches_found

def main():
    # Configurações
    json_path = "cards_database.json"
    images_folder = "cards"
    
    print("🎮 X-Monsters Card Image Renamer")
    print("=" * 50)
    
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
    
    print(f"\n🎯 Iniciando análise OCR...")
    print("⏳ Isso pode demorar alguns minutos...")
    
    # Executar em modo dry-run primeiro
    print("\n🔍 MODO DRY-RUN (apenas simulação):")
    matches = renamer.rename_images(dry_run=True)
    
    if matches:
        print(f"\n✅ Encontrados {len(matches)} matches!")
        print("\nDeseja prosseguir com a renomeação? (s/n): ", end="")
        response = input().strip().lower()
        
        if response in ['s', 'sim', 'y', 'yes']:
            print("\n🔄 Executando renomeação...")
            renamer.rename_images(dry_run=False)
            print("\n🎉 Processo concluído!")
        else:
            print("\n🚫 Renomeação cancelada")
    else:
        print("\n❌ Nenhuma correspondência encontrada")

if __name__ == "__main__":
    main()
