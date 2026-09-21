# Executar da raiz do repo: python scripts/generate_trait_review_sheets.py
"""
Gera folhas de contato para a revisão manual dos `traits` de cada carta
(`data/cards_database.json`) contra a arte impressa em `assets/cards/`.

Uso típico: revisar 9 cartas por folha em vez de abrir 79 PNGs um a um —
cada tile traz o id, o nome e os traits da carta acima da arte, então a
comparação "arte x traits" é feita sem consultar o JSON.

Saída: `reports/trait-review/folha_NN.jpg` (diretório ignorado pelo git).
Cada folha é 3x3 (9 cartas); o manifesto impresso no terminal mapeia
folha -> cartas na ordem dos tiles (esquerda->direita, topo->base).
"""

import json
import os
from PIL import Image, ImageDraw, ImageFont

JSON_PATH = 'data/cards_database.json'
IMAGES_ROOT = '.'
OUTPUT_DIR = os.path.join('reports', 'trait-review')

TILE_W, TILE_H = 320, 424
LABEL_H = 30
COLS, ROWS = 3, 3
CARDS_PER_SHEET = COLS * ROWS
FONT_PATH = r'C:\Windows\Fonts\arialbd.ttf'


def carregar_cartas_com_traits():
    """Cartas do catálogo que têm `traits` (criaturas e evoluções)."""
    with open(JSON_PATH, 'r', encoding='utf-8') as arquivo:
        cartas = json.load(arquivo)['cards']
    return [carta for carta in cartas if carta.get('traits')]


def carregar_fonte(tamanho):
    try:
        return ImageFont.truetype(FONT_PATH, tamanho)
    except OSError:
        # Fallback: a fonte bitmap padrão é menor, mas a folha continua legível.
        return ImageFont.load_default()


def montar_folha(cartas, fonte):
    """Folha 3x3 com id + nome + traits acima da arte de cada carta."""
    folha = Image.new('RGB', (COLS * TILE_W, ROWS * (TILE_H + LABEL_H)), (25, 25, 25))
    desenho = ImageDraw.Draw(folha)

    for indice, carta in enumerate(cartas):
        caminho = os.path.join(IMAGES_ROOT, carta['image'].replace('/', os.sep))
        arte = Image.open(caminho).convert('RGB').resize((TILE_W, TILE_H), Image.LANCZOS)

        linha, coluna = divmod(indice, COLS)
        x = coluna * TILE_W
        y = linha * (TILE_H + LABEL_H)

        desenho.rectangle([x, y, x + TILE_W, y + LABEL_H], fill=(0, 0, 0))
        desenho.text(
            (x + 5, y + 5),
            f"{carta['id']} {carta['name']} [{','.join(carta['traits'])}]",
            fill=(255, 230, 120),
            font=fonte
        )
        folha.paste(arte, (x, y + LABEL_H))

    return folha


def main():
    cartas = carregar_cartas_com_traits()
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    fonte = carregar_fonte(16)

    total_folhas = (len(cartas) + CARDS_PER_SHEET - 1) // CARDS_PER_SHEET
    print(f'Cartas com traits: {len(cartas)}')
    print(f'Folhas ({COLS}x{ROWS}): {total_folhas}')
    print(f'Saída: {os.path.abspath(OUTPUT_DIR)}\n')

    for numero in range(total_folhas):
        lote = cartas[numero * CARDS_PER_SHEET:(numero + 1) * CARDS_PER_SHEET]
        caminho = os.path.join(OUTPUT_DIR, f'folha_{numero:02d}.jpg')
        montar_folha(lote, fonte).save(caminho, quality=88)
        listagem = ' ;; '.join(
            f"{c['id']}|{c['name']}|{','.join(c['traits'])}" for c in lote
        )
        print(f'OK {os.path.basename(caminho)}: {listagem}')


if __name__ == '__main__':
    main()
