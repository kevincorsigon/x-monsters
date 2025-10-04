import cv2
import pytesseract
import numpy as np
import os

def test_ocr_on_image(image_path):
    """Testa OCR com diferentes configurações em uma imagem"""
    print(f"\n🔍 Testando: {os.path.basename(image_path)}")
    
    # Carregar imagem
    img = cv2.imread(image_path)
    if img is None:
        print("❌ Não foi possível carregar a imagem")
        return
    
    # Focar na região do título
    height, width = img.shape[:2]
    start_y = int(height * 0.10)
    end_y = int(height * 0.30) 
    start_x = int(width * 0.05)
    end_x = int(width * 0.95)
    title_region = img[start_y:end_y, start_x:end_x]
    
    # Converter para escala de cinza
    gray = cv2.cvtColor(title_region, cv2.COLOR_BGR2GRAY)
    
    # Aumentar contraste
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
    enhanced = clahe.apply(gray)
    
    # Redimensionar para melhor OCR
    scale_factor = 8
    height, width = enhanced.shape
    resized = cv2.resize(enhanced, (width * scale_factor, height * scale_factor), interpolation=cv2.INTER_CUBIC)
    
    # Aplicar threshold
    _, thresh = cv2.threshold(resized, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    # Diferentes configurações de OCR
    configs = [
        '--psm 8 -l por',  # Palavra única, português
        '--psm 7 -l por',  # Linha única de texto, português  
        '--psm 6 -l por',  # Bloco uniforme de texto, português
        '--psm 13 -l por', # Linha bruta, português
        '--psm 8 -l eng',  # Palavra única, inglês
        '--psm 7 -l eng',  # Linha única de texto, inglês
    ]
    
    for i, config in enumerate(configs, 1):
        try:
            text = pytesseract.image_to_string(thresh, config=config).strip()
            print(f"   {i}. {config}: '{text}' ({len(text)} chars)")
        except Exception as e:
            print(f"   {i}. {config}: ERRO - {e}")

# Testar em algumas imagens específicas
test_images = [
    "baltz.png",
    "cards_kevin-16.png", 
    "cards_kevin-24.png",
    "cards_kevin-48.png",
    "scoul.png"
]

print("🧪 Teste de OCR com diferentes configurações\n")

for img_name in test_images:
    img_path = f"C:\\Dev\\x-monsters\\x-monsters\\{img_name}"
    if os.path.exists(img_path):
        test_ocr_on_image(img_path)
    else:
        print(f"❌ Imagem não encontrada: {img_name}")

print("\n✅ Teste completo!")
