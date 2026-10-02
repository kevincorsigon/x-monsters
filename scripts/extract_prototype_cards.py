#!/usr/bin/env python3
"""Extrai a carta das fotos-protótipo de `assets/original-cards/`.

O que faz, por foto:
1. Acha a carta (papel claro e dessaturado sobre a mesa) e os 4 cantos do papel.
2. Endireita com warp de perspectiva para o formato canônico da carta (768x1017,
   o mesmo de `assets/cards/`).
3. Apara o fundo que sobra nas bordas (papel rasgado: a hull fecha as
   concavidades com retas e o retângulo do warp inclui mesa).
4. Comprime (JPEG q92 por padrão: visualmente sem perda, ~8 MB -> ~180 KB).

Correlação com `data/cards_database.json`: cada protótipo é uma carta que já
existe; `DE_PARA` guarda o nome lido à mão -> arquivo final. Se o Tesseract
estiver instalado, o título também é lido por OCR e casado por similaridade
(`difflib`), servindo de conferência do `DE_PARA`.

Uso (nada é sobrescrito sem `--in-place`):
    python scripts/extract_prototype_cards.py                       # previews
    python scripts/extract_prototype_cards.py --write               # recortadas/
    python scripts/extract_prototype_cards.py --write --in-place    # SUBSTITUI originais
Opções: --width 768 --quality 92 --format jpeg|png|webp
"""
import argparse
import json
import os
import sys
from difflib import SequenceMatcher

import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.spatial import ConvexHull

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGINAIS = os.path.join(RAIZ, 'assets', 'original-cards')
RECORTADAS = os.path.join(ORIGINAIS, 'recortadas')
PREVIEW = os.path.join(ORIGINAIS, '_preview')
CATALOGO = os.path.join(RAIZ, 'data', 'cards_database.json')
RELATORIO = os.path.join(ORIGINAIS, '_de_para.json')

LARGURA_CARTA = 768
ALTURA_CARTA = 1017

# Nome lido à mão na foto -> arquivo da carta final (`assets/cards/`).
DE_PARA = {
    'card_078_lobo_alfa_fly.jpg': 'lobo_alfa_fly.png',
    'card_003_etc.jpg': 'etc.png',
    'card_037_scoul.jpg': 'scoul.png',
    'card_065_iron_dragon.jpg': 'iron_dragon.png',
    'card_081_latex.jpg': 'latex.png',
    'card_085_marik_2.jpg': 'marik_2.png',
    'card_062_alucard.jpg': 'alucard.png',
    'card_018_cp-2.jpg': 'cp-2.png',
    'card_069_roller.jpg': 'roller.png',
    'card_074_nucles.jpg': 'nucles.png',
    'card_029_aladar.jpg': 'aladar.png',
    'card_035_ptera.jpg': 'ptera.png',
    'card_011_kirb.jpg': 'kirb.png',
    'card_039_trox.jpg': 'trox.png',
    'card_048_turtol.jpg': 'turtol.png',
}


def catalogo():
    with open(CATALOGO, encoding='utf-8-sig') as f:
        return json.load(f)['cards']


def mascara_do_papel(rgb):
    """Papel = claro (valor alto) e dessaturado; a madeira é quente/saturada."""
    a = rgb.astype(np.float32)
    mx = a.max(2)
    mn = a.min(2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1) * 255.0, 0.0)
    m = (sat < 50) & (mx > 130)
    m = ndimage.binary_closing(m, structure=np.ones((7, 7)), iterations=2)
    m = ndimage.binary_fill_holes(m)
    m = ndimage.binary_opening(m, structure=np.ones((5, 5)), iterations=1)
    return m


def cantos_da_carta(mask):
    """4 cantos (TL, TR, BR, BL) do maior componente — o papel é convexo."""
    lab, n = ndimage.label(mask)
    if n == 0:
        return None
    tamanhos = ndimage.sum(np.ones_like(lab), lab, index=range(1, n + 1))
    comp = lab == int(np.argmax(tamanhos)) + 1
    ys, xs = np.where(comp)
    pts = np.column_stack([xs, ys]).astype(float)
    hull = pts[ConvexHull(pts).vertices]
    soma = hull[:, 0] + hull[:, 1]
    dif = hull[:, 0] - hull[:, 1]
    return {
        'tl': hull[np.argmin(soma)], 'br': hull[np.argmax(soma)],
        'tr': hull[np.argmax(dif)], 'bl': hull[np.argmin(dif)],
    }


def encolher(cantos, fator=0.985):
    """Puxa cada canto para o centro: descarta a beirada do papel."""
    centro = np.mean(list(cantos.values()), axis=0)
    return {k: centro + (v - centro) * fator for k, v in cantos.items()}


def coefs_perspectiva(destino, origem):
    """Coeficientes (destino -> origem) do PIL, resolvidos por 4 pontos."""
    linhas, termos = [], []
    for (x, y), (u, v) in zip(destino, origem):
        linhas.append([x, y, 1, 0, 0, 0, -x * u, -y * u]); termos.append(u)
        linhas.append([0, 0, 0, x, y, 1, -x * v, -y * v]); termos.append(v)
    return np.linalg.solve(np.array(linhas, dtype=float), np.array(termos, dtype=float))


def endireitar(imagem, cantos, largura=LARGURA_CARTA, altura=ALTURA_CARTA):
    destino = [(0, 0), (largura, 0), (largura, altura), (0, altura)]
    origem = [cantos['tl'], cantos['tr'], cantos['br'], cantos['bl']]
    coefs = coefs_perspectiva(destino, origem)
    return imagem.transform((largura, altura), Image.PERSPECTIVE, coefs, Image.BICUBIC)


def _bordas_do_papel(mask):
    """Onde o papel começa/termina em cada linha e coluna (NaN quando vazio)."""
    h, w = mask.shape
    esq, dr, cima, baixo = (np.full(h, np.nan), np.full(h, np.nan),
                            np.full(w, np.nan), np.full(w, np.nan))
    for y in range(h):
        x = np.nonzero(mask[y])[0]
        if x.size:
            esq[y], dr[y] = x[0], x[-1]
    for x in range(w):
        y = np.nonzero(mask[:, x])[0]
        if y.size:
            cima[x], baixo[x] = y[0], y[-1]
    return esq, dr, cima, baixo


def aparar_fundo(imagem, percentil=90, maximo=0.08):
    """Corta o fundo que o warp trouxe para as bordas.

    O papel é rasgado/ondulado: a hull fecha as concavidades com retas e o
    retângulo do warp inclui mesa nessas beiradas. Para cada borda, corta até
    onde `percentil`% das linhas/colunas já têm papel.
    """
    mask = mascara_do_papel(np.asarray(imagem))
    if mask.mean() < 0.5:
        return imagem
    h, w = mask.shape
    esq, dr, cima, baixo = _bordas_do_papel(mask)

    def pct(valores, p):
        v = float(np.nanpercentile(valores, p))
        return 0 if np.isnan(v) else int(round(v))

    e = min(pct(esq, percentil), int(w * maximo))
    d = min(w - 1 - pct(dr, 100 - percentil), int(w * maximo))
    t = min(pct(cima, percentil), int(h * maximo))
    b = min(h - 1 - pct(baixo, 100 - percentil), int(h * maximo))
    if max(e, d, t, b) <= 1:
        return imagem
    caixa = (e, t, w - d, h - b)
    if caixa[2] - caixa[0] < w * 0.6 or caixa[3] - caixa[1] < h * 0.6:
        return imagem
    return imagem.crop(caixa).resize((w, h), Image.LANCZOS)


def recortar_carta(caminho, largura=LARGURA_CARTA, altura=ALTURA_CARTA):
    """Devolve (imagem endireitada, nota) ou (None, motivo)."""
    original = Image.open(caminho).convert('RGB')
    escala = 600.0 / max(original.size)
    pequena = original.resize((int(original.width * escala), int(original.height * escala)))
    mask = mascara_do_papel(np.asarray(pequena))
    cantos = cantos_da_carta(mask)
    if cantos is None:
        return None, 'papel não encontrado'
    cobertura = mask.mean()
    if cobertura < 0.05:
        return None, f'papel pequeno demais ({cobertura:.1%})'
    cantos_orig = {k: v / escala for k, v in cantos.items()}
    retificada = endireitar(original, encolher(cantos_orig), largura, altura)
    retificada = aparar_fundo(retificada)
    return retificada, f'papel {cobertura:.1%}'


def titulo_por_ocr(imagem):
    """Título por OCR, se o Tesseract existir (handwriting é irregular: só conferência)."""
    try:
        import pytesseract
        exe = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
        if os.path.exists(exe):
            pytesseract.pytesseract.tesseract_cmd = exe
        faixa = imagem.crop((0, 0, imagem.width, int(imagem.height * 0.18)))
        faixa = faixa.resize((faixa.width * 3, faixa.height * 3))
        return pytesseract.image_to_string(faixa, config='--psm 7 -l por').strip()
    except Exception:
        return ''


def casar_por_nome(texto, cartas):
    """Melhor carta do catálogo para um título OCR (similaridade >= 0.55)."""
    alvo = ''.join(c for c in (texto or '').lower() if c.isalnum())
    melhor, nota = None, 0.0
    for carta in cartas:
        nome = ''.join(c for c in (carta['name'] + ' ' + carta['image'].split('/')[-1])
                       if c.isalnum())
        r = SequenceMatcher(None, alvo, nome).ratio()
        if r > nota:
            melhor, nota = carta, r
    return (melhor, nota) if melhor and nota >= 0.55 else (None, nota)


def salvar(imagem, caminho, args):
    if args.format == 'jpeg':
        imagem.save(caminho, 'JPEG', quality=args.quality, optimize=True, progressive=True)
    elif args.format == 'png':
        imagem.save(caminho, 'PNG', optimize=True)
    else:
        imagem.save(caminho, 'WEBP', quality=args.quality, method=6)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--write', action='store_true', help='grava os recortes (padrão: só preview)')
    ap.add_argument('--in-place', action='store_true', help='SUBSTITUI os .jpg originais (destrutivo)')
    ap.add_argument('--width', type=int, default=LARGURA_CARTA)
    ap.add_argument('--quality', type=int, default=92)
    ap.add_argument('--format', default='jpeg', choices=['jpeg', 'png', 'webp'])
    args = ap.parse_args()

    cartas = catalogo()
    por_arquivo = {c['image'].split('/')[-1]: c for c in cartas}
    os.makedirs(PREVIEW, exist_ok=True)
    if args.write:
        os.makedirs(RECORTADAS, exist_ok=True)

    altura = int(args.width * ALTURA_CARTA / LARGURA_CARTA)
    extensao = {'jpeg': '.jpg', 'png': '.png', 'webp': '.webp'}[args.format]
    relatorio = []

    fotos = sorted(f for f in os.listdir(ORIGINAIS) if f.lower().endswith('.jpg'))
    for foto in fotos:
        caminho = os.path.join(ORIGINAIS, foto)
        recorte, nota = recortar_carta(caminho, args.width, altura)
        if recorte is None:
            print(f'  x {foto}: {nota}')
            continue

        carta = por_arquivo.get(DE_PARA.get(foto, ''))
        ocr, similaridade, confianca = '', 1.0, 'manual'
        if carta is None:
            ocr = titulo_por_ocr(recorte)
            carta, similaridade = casar_por_nome(ocr, cartas)
            confianca = 'ocr' if carta else 'revisar'

        base = (carta['id'] + '_' + os.path.splitext(carta['image'].split('/')[-1])[0]
                if carta else os.path.splitext(foto)[0])
        if args.in_place:
            saida = os.path.join(ORIGINAIS, os.path.splitext(foto)[0] + extensao)
        elif args.write:
            saida = os.path.join(RECORTADAS, base + extensao)
        else:
            saida = os.path.join(PREVIEW, 'corte_' + os.path.splitext(foto)[0] + extensao)

        salvar(recorte, saida, args)
        kb = os.path.getsize(saida) / 1024
        rotulo = f"{carta['id']} {carta['name']}" if carta else 'REVISAR'
        print(f'  ok {foto} -> {os.path.basename(saida)} [{rotulo}] {kb:.0f} KB ({nota})')
        relatorio.append({
            'foto': foto, 'saida': os.path.relpath(saida, RAIZ).replace('\\', '/'),
            'cartaId': carta['id'] if carta else None,
            'cartaNome': carta['name'] if carta else None,
            'image': carta['image'] if carta else None,
            'confianca': confianca, 'ocr': ocr,
            'similaridade': round(similaridade, 2), 'tamanhoKB': round(kb),
            'candidatos': None,
        })

    with open(RELATORIO, 'w', encoding='utf-8') as f:
        json.dump(relatorio, f, ensure_ascii=False, indent=2)
    revisar = [r['foto'] for r in relatorio if r['confianca'] == 'revisar']
    print(f'\n{len(relatorio)} recortes. Relatório: {os.path.relpath(RELATORIO, RAIZ)}')
    if revisar:
        print('Revisar (nome ilegível): ' + ', '.join(revisar))
    if not args.write:
        print('Preview em _preview/. --write grava em recortadas/ '
              '(--write --in-place substitui os originais).')
    return 0


if __name__ == '__main__':
    sys.exit(main())