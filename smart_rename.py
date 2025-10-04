import cv2
import pytesseract
import numpy as np
import os
import json
import shutil
from difflib import SequenceMatcher
import re

# Configurar caminho do Tesseract
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

class SmartCardRenamer:
    def __init__(self, images_folder="cards", cards_json="cards_database.json"):
        self.images_folder = images_folder
        self.cards_data = self.load_cards_database(cards_json)
        
    def load_cards_database(self, json_file):
        """Carrega base de dados das cartas"""
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, dict) and 'cards' in data:
                    return data['cards']
                return data
        except Exception as e:
            print(f"Erro ao carregar base de dados: {e}")
            return []
    
    def extract_text_multiple_methods(self, image_path):
        """Extrai texto usando múltiplos métodos e regiões"""
        img = cv2.imread(image_path)
        if img is None:
            return []
        
        results = []
        
        # Método 1: Região do título (topo)
        results.extend(self.try_region(img, 0.0, 0.25, "Título (topo)"))
        
        # Método 2: Região central superior
        results.extend(self.try_region(img, 0.15, 0.4, "Central superior"))
        
        # Método 3: Imagem completa com foco em texto grande
        results.extend(self.try_full_image(img, "Imagem completa"))
        
        # Método 4: Apenas área central (onde geralmente fica o nome)
        results.extend(self.try_region(img, 0.1, 0.3, "Central focado"))
        
        return results
    
    def try_region(self, img, start_ratio, end_ratio, region_name):
        """Tenta extrair texto de uma região específica"""
        results = []
        height, width = img.shape[:2]
        
        # Recortar região
        start_y = int(height * start_ratio)
        end_y = int(height * end_ratio)
        region = img[start_y:end_y, :]
        
        # Múltiplos preprocessamentos
        processed_images = self.preprocess_multiple_ways(region)
        
        for proc_name, proc_img in processed_images:
            texts = self.ocr_multiple_configs(proc_img)
            for config_name, text in texts:
                if text and len(text) >= 2:
                    results.append({
                        'text': text,
                        'method': f"{region_name} + {proc_name} + {config_name}",
                        'confidence': self.estimate_confidence(text)
                    })
        
        return results
    
    def try_full_image(self, img, region_name):
        """Tenta extrair de imagem completa com preprocessamento focado em títulos"""
        results = []
        
        # Redimensionar para facilitar OCR
        height, width = img.shape[:2]
        if height > 800:
            scale = 600 / height
            new_width = int(width * scale)
            img = cv2.resize(img, (new_width, 600))
        
        processed_images = self.preprocess_multiple_ways(img)
        
        for proc_name, proc_img in processed_images:
            texts = self.ocr_multiple_configs(proc_img)
            for config_name, text in texts:
                if text and len(text) >= 3:
                    results.append({
                        'text': text,
                        'method': f"{region_name} + {proc_name} + {config_name}",
                        'confidence': self.estimate_confidence(text)
                    })
        
        return results
    
    def preprocess_multiple_ways(self, img):
        """Aplica múltiplos tipos de preprocessamento"""
        processed = []
        
        # Converter para cinza
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Método 1: Alto contraste com threshold
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
        enhanced = clahe.apply(gray)
        _, thresh1 = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        # Redimensionar para OCR
        scale_factor = 4
        h, w = thresh1.shape
        resized1 = cv2.resize(thresh1, (w * scale_factor, h * scale_factor), interpolation=cv2.INTER_CUBIC)
        processed.append(("Alto contraste", resized1))
        
        # Método 2: Threshold adaptativo
        adaptive = cv2.adaptiveThreshold(enhanced, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 21, 10)
        resized2 = cv2.resize(adaptive, (w * scale_factor, h * scale_factor), interpolation=cv2.INTER_CUBIC)
        processed.append(("Adaptativo", resized2))
        
        # Método 3: Sem threshold, apenas melhorado
        blurred = cv2.GaussianBlur(enhanced, (3, 3), 0)
        resized3 = cv2.resize(blurred, (w * scale_factor, h * scale_factor), interpolation=cv2.INTER_CUBIC)
        processed.append(("Suavizado", resized3))
        
        # Método 4: Inversão (texto branco em fundo escuro)
        inverted = cv2.bitwise_not(thresh1)
        resized4 = cv2.resize(inverted, (w * scale_factor, h * scale_factor), interpolation=cv2.INTER_CUBIC)
        processed.append(("Invertido", resized4))
        
        return processed
    
    def ocr_multiple_configs(self, img):
        """Tenta OCR com múltiplas configurações"""
        configs = [
            ("PSM 8 POR", '--psm 8 -l por'),  # Palavra única, português
            ("PSM 7 POR", '--psm 7 -l por'),  # Linha de texto, português
            ("PSM 6 POR", '--psm 6 -l por'),  # Bloco uniforme, português
            ("PSM 13 POR", '--psm 13 -l por'), # Linha raw, português
            ("PSM 8 ENG", '--psm 8 -l eng'),  # Palavra única, inglês
            ("PSM 7 ENG", '--psm 7 -l eng'),  # Linha de texto, inglês
        ]
        
        results = []
        for name, config in configs:
            try:
                text = pytesseract.image_to_string(img, config=config).strip()
                text = self.clean_text(text)
                if text:
                    results.append((name, text))
            except:
                continue
        
        return results
    
    def clean_text(self, text):
        """Limpa texto extraído"""
        if not text:
            return ""
        
        # Remover quebras de linha e espaços extras
        text = ' '.join(text.split())
        
        # Remover caracteres muito estranhos
        text = re.sub(r'[^\w\sÀ-ÿ\-]', ' ', text)
        
        # Remover palavras muito pequenas ou muito grandes
        words = text.split()
        filtered_words = []
        for word in words:
            if 2 <= len(word) <= 20:  # Palavras entre 2 e 20 caracteres
                filtered_words.append(word)
        
        return ' '.join(filtered_words)
    
    def estimate_confidence(self, text):
        """Estima confiança do texto extraído"""
        if not text:
            return 0
        
        confidence = 50  # Base
        
        # Bônus por comprimento adequado
        if 5 <= len(text) <= 25:
            confidence += 20
        elif 3 <= len(text) <= 30:
            confidence += 10
        
        # Bônus por ter palavras completas
        words = text.split()
        if len(words) >= 2:
            confidence += 15
        
        # Penalidade por caracteres muito repetitivos
        if len(set(text.replace(' ', ''))) < len(text) // 3:
            confidence -= 20
        
        # Bônus por letras mais que números/símbolos
        letters = sum(1 for c in text if c.isalpha())
        if letters > len(text) * 0.7:
            confidence += 10
        
        return max(0, min(100, confidence))
    
    def find_best_match(self, extracted_results):
        """Encontra melhor correspondência considerando todos os resultados"""
        if not extracted_results:
            return None, 0
        
        # Ordenar por confiança
        sorted_results = sorted(extracted_results, key=lambda x: x['confidence'], reverse=True)
        
        best_match = None
        best_similarity = 0
        
        print(f"    🔍 Resultados do OCR ({len(sorted_results)} tentativas):")
        
        # Testar os 5 melhores resultados
        for i, result in enumerate(sorted_results[:5]):
            text = result['text']
            confidence = result['confidence']
            method = result['method']
            
            print(f"       {i+1}. '{text}' (conf: {confidence}%) [{method}]")
            
            if len(text) >= 2:  # Só testar textos minimamente válidos
                for card in self.cards_data:
                    similarity = self.calculate_similarity(text, card['name'])
                    if similarity > best_similarity and similarity >= 0.4:
                        best_match = card
                        best_similarity = similarity
        
        return best_match, best_similarity
    
    def calculate_similarity(self, text1, text2):
        """Calcula similaridade entre textos"""
        if not text1 or not text2:
            return 0
        
        # Normalizar textos
        norm1 = self.normalize_text(text1)
        norm2 = self.normalize_text(text2)
        
        if not norm1 or not norm2:
            return 0
        
        # Similaridade básica
        similarity = SequenceMatcher(None, norm1, norm2).ratio()
        
        # Bônus por conter palavras importantes
        words1 = set(norm1.split())
        words2 = set(norm2.split())
        
        if words1 and words2:
            word_overlap = len(words1.intersection(words2)) / max(len(words1), len(words2))
            similarity = max(similarity, word_overlap * 0.9)
        
        # Bônus por substring
        if norm2 in norm1 or norm1 in norm2:
            similarity = max(similarity, 0.8)
        
        return similarity
    
    def normalize_text(self, text):
        """Normaliza texto para comparação"""
        if not text:
            return ""
        
        text = text.lower()
        
        # Remover acentos
        replacements = {
            'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a', 'ä': 'a',
            'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
            'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
            'ó': 'o', 'ò': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
            'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
            'ç': 'c', 'ñ': 'n'
        }
        
        for old, new in replacements.items():
            text = text.replace(old, new)
        
        # Manter apenas letras e espaços
        text = re.sub(r'[^a-z\s]', ' ', text)
        text = ' '.join(text.split())
        
        return text
    
    def rename_images(self, dry_run=True):
        """Renomeia imagens usando o novo sistema inteligente"""
        image_files = self.get_image_files()
        
        if not image_files:
            print("❌ Nenhum arquivo de imagem encontrado")
            return
        
        print(f"📁 Encontrados {len(image_files)} arquivos de imagem")
        
        renamed_count = 0
        matches_found = []
        
        for i, image_file in enumerate(image_files, 1):
            print(f"\n🔍 [{i}/{len(image_files)}] Analisando: {image_file}")
            
            image_path = os.path.join(self.images_folder, image_file)
            
            # Extrair texto com múltiplos métodos
            extracted_results = self.extract_text_multiple_methods(image_path)
            
            if not extracted_results:
                print("⚠️  Nenhum texto extraído")
                continue
            
            # Encontrar melhor correspondência
            best_match, similarity = self.find_best_match(extracted_results)
            
            if best_match and similarity >= 0.4:
                base_filename = os.path.basename(best_match['image'])
                print(f"✅ Match encontrado: '{best_match['name']}' (similaridade: {similarity:.2f})")
                print(f"📄 Arquivo alvo: {base_filename}")
                
                if image_file != base_filename:
                    new_path = os.path.join(self.images_folder, base_filename)
                    
                    if dry_run:
                        if os.path.exists(new_path):
                            print(f"⚠️  [DRY RUN] Arquivo {base_filename} já existe, pularia...")
                        else:
                            print(f"🔄 [DRY RUN] Renomearia: {image_file} → {base_filename}")
                    else:
                        try:
                            if os.path.exists(new_path):
                                print(f"⚠️  Arquivo {base_filename} já existe, pulando...")
                                continue
                            
                            shutil.move(image_path, new_path)
                            print(f"✅ Renomeado: {image_file} → {base_filename}")
                            renamed_count += 1
                        except Exception as e:
                            print(f"❌ Erro ao renomear: {e}")
                else:
                    print(f"✅ Arquivo já tem nome correto: {image_file}")
                
                matches_found.append({
                    'original': image_file,
                    'target': base_filename,
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
    
    def get_image_files(self):
        """Obtém lista de arquivos de imagem"""
        extensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp']
        files = []
        
        for file in os.listdir(self.images_folder):
            if any(file.lower().endswith(ext) for ext in extensions):
                files.append(file)
        
        return sorted(files)

# Executar o programa
if __name__ == "__main__":
    print("🚀 Sistema Inteligente de Renomeação de Cartas")
    print("=" * 50)
    
    renamer = SmartCardRenamer()
    
    # Executar dry run primeiro
    print("\n🧪 Executando teste (dry run)...")
    matches = renamer.rename_images(dry_run=True)
    
    if matches:
        print(f"\n✅ Encontrados {len(matches)} matches!")
        response = input("\nDeseja prosseguir com a renomeação? (s/n): ").lower().strip()
        
        if response == 's':
            print("\n🔄 Executando renomeação...")
            renamer.rename_images(dry_run=False)
        else:
            print("❌ Renomeação cancelada")
    else:
        print("\n❌ Nenhum match encontrado")
    
    print("\n🎉 Processo concluído!")
