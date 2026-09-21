"""Cruza `traits` do catálogo com evidências extraídas das artes e dos textos.

Uso: python scripts/analyze_card_art_features.py [--csv caminho]

Contexto: as artes em `assets/cards/*.png` são cartas **já renderizadas**
(768x1017, sem canal alfa): moldura + nome + painel de ilustração + texto. A
ilustração é uma cena pintada (fundo incluído), não um recorte do monstro — logo
geometria de silhueta (bípede x quadrúpede) **não é inferível** sem inspeção
visual humana. O que dá para medir com confiança:

1. **Paleta do painel de arte** (recorte fixo do template, medido em campo):
   fração de pixels por bucket HSV. Sustenta/confirma traits de cor e corpo
   (`planta`, `fogo`, `aquatico`, `robotico`) e detecta artes dominadas por
   gelo/eletricidade, que o catálogo não tem como trait.
2. **Pistas textuais** (nome + `hability`): palavras que implicam trait
   (`dragao`, `voador`, `vampiro`, `magico`, `aquatico`, `robotico`, `planta`,
   `fogo`, `paladino`, `guerreiro`, `fantasma`, `demonio`) — evidência textual,
   independente da arte.

Sinais emitidos (T = pista textual, N = nota de catálogo):
  T  pista textual de trait ausente no JSON
  N1 texto indica gelo/eletricidade — o catálogo não tem `gelo`/`eletrico`

**Sinais de cor foram testados e rejeitados.** A calibração contra a amostra
conferida à mão mostrou que a paleta do painel mede o **cenário pintado**, não a
criatura: não acusou a divergência confirmada de `card_012` (árvore de Natal,
paleta vermelha/dourada) e falsificou `card_016` (metal 61% = fundo),
`card_023` (metal 4% apesar da armadura), `card_010_*` (verde 45% = vegetação do
fundo) e `card_070` (vermelho 77% = céu). A paleta continua no CSV como dado
descritivo, sem gerar sinal.

Nada aqui decide: a arte continua sendo a autoridade. A saída é uma fila de
triagem priorizada para conferência humana nas folhas de contato.
"""

import argparse
import csv
import json
import os
import re
from PIL import Image

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATABASE = os.path.join(BASE_DIR, 'data', 'cards_database.json')
CSV_PADRAO = os.path.join(BASE_DIR, 'reports', 'trait-review', 'art_features.csv')

# Painel de ilustração medido no template 768x1017 (moldura/nome acima,
# texto/habilidade abaixo): x 55..715, y 110..785.
PAINEL = {
    'esquerda': 55 / 768,
    'topo': 110 / 1017,
    'direita': 715 / 768,
    'base': 785 / 1017,
}
MAX_SIDE = 260

BUCKETS = ('fogo', 'amarelo', 'planta', 'aqua', 'magico', 'metal', 'gelo', 'pele')

# Verdade apurada por inspeção visual humana nesta revisão (amostra de 19).
GROUND_TRUTH = {
    'card_012': 'arte é árvore de Natal -> paleta NÃO acusa (vermelho/dourado)',
    'card_016': 'arte é Shiba Inu quadrúpede -> nenhum sinal de cor',
    'card_011': 'esfera rosa (blob) -> nenhum sinal de cor',
    'card_013': 'blob -> nenhum sinal de cor',
    'card_003': 'humanoide em disco voador -> possível pista textual',
    'card_023': 'orgânico com armadura -> metal alto é nota, não conflito',
}

def carregar_criaturas():
    with open(DATABASE, encoding='utf-8') as arquivo:
        cartas = json.load(arquivo)['cards']
    return [c for c in cartas
            if c.get('type') in ('criatura', 'evolução') and c.get('traits')]


def recortar_painel(imagem):
    """Recorta o painel de ilustração e devolve (pixels, largura, altura, original)."""
    imagem = imagem.convert('RGB')
    largura, altura = imagem.size
    painel = imagem.crop((
        int(largura * PAINEL['esquerda']),
        int(altura * PAINEL['topo']),
        int(largura * PAINEL['direita']),
        int(altura * PAINEL['base']),
    ))
    painel.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    return painel.load(), painel.size[0], painel.size[1], f'{largura}x{altura}'


def hsv(r, g, b):
    mx, mn = max(r, g, b), min(r, g, b)
    v = mx / 255
    delta = mx - mn
    s = 0.0 if mx == 0 else delta / mx
    if delta == 0:
        h = 0.0
    elif mx == r:
        h = 60 * (((g - b) / delta) % 6)
    elif mx == g:
        h = 60 * ((b - r) / delta + 2)
    else:
        h = 60 * ((r - g) / delta + 4)
    return h % 360, s, v


def classificar_pixel(h, s, v):
    if s < 0.15 and v > 0.85:
        return 'gelo'
    if s < 0.18 and 0.22 < v <= 0.85:
        return 'metal'
    if s < 0.30:
        return None
    if h < 25 or h >= 340:
        return 'fogo'
    if h < 65:
        return 'pele' if (10 <= h < 40 and s < 0.62 and v > 0.40) else 'amarelo'
    if h < 170:
        return 'planta'
    if h < 265:
        return 'aqua'
    return 'magico'


def paleta(pixels, largura, altura):
    """Fração de pixels do painel por bucket + cor dominante cromática."""
    contagem = {b: 0 for b in BUCKETS}
    total = 0
    for y in range(altura):
        for x in range(largura):
            r, g, b = pixels[x, y]
            if max(r, g, b) < 24:
                continue
            total += 1
            bucket = classificar_pixel(*hsv(r, g, b))
            if bucket:
                contagem[bucket] += 1
    if not total:
        return {}, (None, 0.0), 0.0
    shares = {b: n / total for b, n in contagem.items()}
    cromaticos = {b: v for b, v in shares.items() if b not in ('metal', 'gelo')}
    dominante = max(cromaticos, key=cromaticos.get) if cromaticos else None
    return (
        {b: round(v, 2) for b, v in shares.items()},
        (dominante, round(cromaticos[dominante], 2)) if dominante else (None, 0.0),
        round(sum(shares.values()), 2),
    )


# Palavras em nome/hability que implicam trait (evidência textual, sem arte).
PISTAS = (
    (r'drag(ão|ao|on)', 'dragao'),
    (r'\balad(o|a)\b|\bvoo\b|\bvoa\b|céus|\bcéu\b|\bceus\b|\basas?\b|\bfly\b|'
     r'aére|aere|planar', 'voador'),
    (r'vampir|sanguinári|sanguinari', 'vampiro'),
    (r'mag(o|ia|ico)|feitiç|feiticeir|arcan|invocador|alquimist|místic|mistic', 'magico'),
    (r'aquátic|aquatic|peixe|beluga|sereia|tubar|hipopótam|hipopotam|baleia|'
     r'profundezas|\bágua\b|\bagua\b|\blama\b|marinh', 'aquatico'),
    (r'robô|\brobo\b|robótic|robotic|android|cyborg|máquina|maquina|cp-?\d', 'robotico'),
    (r'cact|\bplant|árvore|arvore|\bflor\b|folha|raiz|cipó|cipo|\bbrot', 'planta'),
    (r'\bfogo\b|chama|pyro|queimadura|vulcã|vulcao|incêndi|incendi', 'fogo'),
    (r'paladino', 'paladino'),
    (r'guerreir|espadachim|cavaleir|mestre de armas|lâmina|lamina', 'guerreiro'),
    (r'fantasma|espectro|assombraç', 'fantasma'),
    (r'demôni|demoni|diabr|infernal', 'demonio'),
    (r'gelo|freeze|congel|nevasc|eletri|lightning|raio|relâmpag|relampag', 'gelo/eletrico'),
)


def pistas_textuais(carta):
    texto = f"{carta.get('name', '')} {carta.get('hability', '')}".lower()
    return sorted({trait for padrao, trait in PISTAS if re.search(padrao, texto)})

# Pistas revisadas e descartadas — não re-sinalizar (motivo registrado).
EXCECOES = {
    ('card_087', 'voador'),   # decisions.md 63-66: dragão sem voo/ataque direto
    ('card_029', 'voador'),   # Aladar: habilidade é ataque extra, sem voo
    ('card_045', 'demonio'),  # "Diabrete Alado" é a criatura invocada, não ele
    ('card_045', 'voador'),   # idem — "Alado" pertence ao token invocado
    ('card_067', 'guerreiro'),  # paladino nunca leva guerreiro (idem card_068)
    ('card_068', 'guerreiro'),  # convenção do catálogo: paladino é ofício próprio
}

TRAITS_CORPO = ('dragao', 'robotico', 'aquatico', 'planta', 'fantasma')


def sinais(carta):
    """Somente evidência textual — ver docstring (sinais de cor rejeitados)."""
    traits = carta['traits']
    encontrados = []
    for pista in pistas_textuais(carta):
        if pista == 'gelo/eletrico':
            encontrados.append('N1 texto indica gelo/eletricidade '
                               '(catálogo sem essas traits)')
            continue
        if pista in traits or (carta['id'], pista) in EXCECOES:
            continue
        encontrados.append(f'T texto indica {pista}')
    return encontrados


def analisar(carta):
    linha = {
        'id': carta['id'],
        'name': carta['name'],
        'traits': ','.join(carta['traits']),
        'pistas': ','.join(pistas_textuais(carta)),
        'sinais': '',
        'paleta': '',
        'dominante': '',
        'share_dominante': 0.0,
        'original': '',
        'erro': '',
    }
    caminho = os.path.join(BASE_DIR, carta['image'].replace('/', os.sep))
    if not os.path.exists(caminho):
        linha['erro'] = 'arte ausente'
        return linha
    pixels, largura, altura, original = recortar_painel(Image.open(caminho))
    shares, (dominante, share), coberta = paleta(pixels, largura, altura)
    linha.update({
        'original': original,
        'dominante': dominante or '',
        'share_dominante': share,
        'coberta': coberta,
        'paleta': ' '.join(f'{b}={v:.2f}' for b, v in sorted(
            shares.items(), key=lambda item: -item[1]) if v >= 0.03),
        'sinais': ' | '.join(sinais(carta)),
    })
    return linha


def calibrar(linhas):
    print('\n=== Calibração contra a amostra conferida visualmente ===')
    por_id = {l['id']: l for l in linhas}
    for carta_id, esperado in GROUND_TRUTH.items():
        linha = por_id.get(carta_id)
        if not linha:
            continue
        print(f"  {carta_id} {linha['name'][:22]:<22} {esperado}")
        print(f"      sinais: {linha['sinais'] or '(nenhum)'}")
        print(f"      paleta: {linha['paleta'] or '(vazia)'}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--csv', default=CSV_PADRAO)
    args = parser.parse_args()

    criaturas = carregar_criaturas()
    linhas = [analisar(carta) for carta in criaturas]

    os.makedirs(os.path.dirname(args.csv), exist_ok=True)
    campos = ['id', 'name', 'traits', 'pistas', 'dominante', 'share_dominante',
              'paleta', 'sinais', 'original', 'erro']
    with open(args.csv, 'w', newline='', encoding='utf-8') as arquivo:
        escritor = csv.DictWriter(arquivo, fieldnames=campos, extrasaction='ignore')
        escritor.writeheader()
        escritor.writerows(linhas)

    com_sinal = [l for l in linhas if l['sinais']]
    print(f'Criaturas/evoluções com traits: {len(linhas)}')
    print(f'CSV: {os.path.abspath(args.csv)}')
    print(f'Cartas na fila de triagem: {len(com_sinal)}\n')
    for linha in com_sinal:
        print(f"{linha['id']} {linha['name'][:26]:<26} [{linha['traits']}]")
        print(f"    {linha['sinais']}")

    calibrar(linhas)


if __name__ == '__main__':
    main()


