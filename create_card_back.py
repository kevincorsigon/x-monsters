from PIL import Image, ImageDraw, ImageFont
import os

def create_card_back():
    """Cria uma imagem de verso para as cartas X-MONSTERS"""
    
    # Dimensões da carta em pixels (alta resolução para impressão)
    # 63mm x 88mm a 300 DPI = 744 x 1039 pixels
    width = 744
    height = 1039
    
    # Criar imagem com fundo gradiente
    img = Image.new('RGB', (width, height), color='#2c3e50')
    draw = ImageDraw.Draw(img)
    
    # Criar gradiente de fundo
    for i in range(height):
        # Gradiente de azul escuro para azul médio
        ratio = i / height
        r = int(44 + (52 - 44) * ratio)    # 2c para 34
        g = int(62 + (73 - 62) * ratio)    # 3e para 49
        b = int(80 + (94 - 80) * ratio)    # 50 para 5e
        
        color = (r, g, b)
        draw.line([(0, i), (width, i)], fill=color)
    
    # Adicionar borda dourada
    border_width = 20
    border_color = '#c9a567'  # Cor dourada do tema
    
    # Borda externa
    draw.rectangle([0, 0, width-1, height-1], outline=border_color, width=border_width)
    
    # Borda interna decorativa
    inner_border = 40
    draw.rectangle([inner_border, inner_border, width-inner_border-1, height-inner_border-1], 
                  outline=border_color, width=8)
    
    # Tentar usar fontes do sistema
    try:
        # Título principal
        title_font = ImageFont.truetype("arial.ttf", 80)
        subtitle_font = ImageFont.truetype("arial.ttf", 40)
        small_font = ImageFont.truetype("arial.ttf", 30)
    except:
        # Fallback para fonte padrão se não encontrar Arial
        title_font = ImageFont.load_default()
        subtitle_font = ImageFont.load_default()
        small_font = ImageFont.load_default()
    
    # Texto principal
    title_text = "X-MONSTERS"
    title_bbox = draw.textbbox((0, 0), title_text, font=title_font)
    title_width = title_bbox[2] - title_bbox[0]
    title_x = (width - title_width) // 2
    title_y = height // 3
    
    # Desenhar título com sombra
    shadow_offset = 4
    draw.text((title_x + shadow_offset, title_y + shadow_offset), title_text, 
             fill='black', font=title_font)
    draw.text((title_x, title_y), title_text, fill='#c9a567', font=title_font)
    
    # Subtítulo
    subtitle_text = "CARD GAME"
    subtitle_bbox = draw.textbbox((0, 0), subtitle_text, font=subtitle_font)
    subtitle_width = subtitle_bbox[2] - subtitle_bbox[0]
    subtitle_x = (width - subtitle_width) // 2
    subtitle_y = title_y + 120
    
    draw.text((subtitle_x + 2, subtitle_y + 2), subtitle_text, fill='black', font=subtitle_font)
    draw.text((subtitle_x, subtitle_y), subtitle_text, fill='#e2e8f0', font=subtitle_font)
    
    # Decorações - símbolos nos cantos
    symbol_size = 60
    
    # Desenhar símbolos decorativos (estrelas)
    def draw_star(center_x, center_y, size, color):
        points = []
        for i in range(10):  # 5 pontas, 2 pontos por ponta
            angle = i * 36  # 360/10
            if i % 2 == 0:
                radius = size
            else:
                radius = size // 2
            
            import math
            x = center_x + radius * math.cos(math.radians(angle - 90))
            y = center_y + radius * math.sin(math.radians(angle - 90))
            points.append((x, y))
        
        draw.polygon(points, fill=color, outline='black', width=2)
    
    # Estrelas nos cantos
    corner_offset = 80
    star_size = 30
    star_color = '#c9a567'
    
    draw_star(corner_offset, corner_offset, star_size, star_color)
    draw_star(width - corner_offset, corner_offset, star_size, star_color)
    draw_star(corner_offset, height - corner_offset, star_size, star_color)
    draw_star(width - corner_offset, height - corner_offset, star_size, star_color)
    
    # Texto de copyright/info na parte inferior
    info_text = "© 2025"
    info_bbox = draw.textbbox((0, 0), info_text, font=small_font)
    info_width = info_bbox[2] - info_bbox[0]
    info_x = (width - info_width) // 2
    info_y = height - 100
    
    draw.text((info_x, info_y), info_text, fill='#a0a0a0', font=small_font)
    
    # Salvar imagem
    output_path = 'verso_card_kevao.png'
    img.save(output_path, 'PNG', quality=95, dpi=(300, 300))
    
    print(f"✅ Verso da carta criado: {output_path}")
    print(f"📐 Dimensões: {width}x{height} pixels (300 DPI)")
    print(f"🎨 Cores: Gradiente azul com detalhes dourados")
    
    return output_path

if __name__ == "__main__":
    create_card_back()