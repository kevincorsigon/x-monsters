#!/usr/bin/env python3
"""
Gera os assets otimizados das cartas do X Monsters:
- Converte todos os PNGs de `assets/cards/` em WebP (80%) em `assets/webp/`
- Gera os placeholders LQIP (50x75) em `assets/lqip/`

A fiação no cliente (WebP + LQIP + lazy) NÃO acontece aqui: já está versionada
em `src/js/game.js` (helper `montarImagemDaCarta`) e `src/css/game.css`. Para o
pipeline completo (converter + verificar) use `setup_optimized_assets.sh`.

Usage:
    python generate_optimized_assets.py
"""
import os
import json
from pathlib import Path

# Paths relative to the project root
BASE_DIR = Path(__file__).resolve().parent

cards_db_path = BASE_DIR / "data" / "cards_database.json"
lqip_dir = BASE_DIR / "assets" / "lqip"
webp_dir = BASE_DIR / "assets" / "webp"


def load_cards():
    with open(cards_db_path, encoding="utf-8-sig") as f:
        return json.load(f)


def generate_assets():
    cards = load_cards()

    # Create output directories
    lqip_dir.mkdir(exist_ok=True)
    webp_dir.mkdir(exist_ok=True)

    print("Converting images...")
    for card in cards["cards"]:
        img_name = card["image"]  # e.g., "assets/cards/espada_mágica.png"
        name_no_ext = os.path.splitext(os.path.basename(img_name))[0]

        try:
            from PIL import Image

            src_path = BASE_DIR / "assets" / "cards" / os.path.basename(img_name)
            if not src_path.exists():
                print(f"  Skipping {img_name} (file not found)")
                continue

            img = Image.open(src_path).convert("RGBA")

            # WebP (quality 80%)
            webp_path = webp_dir / f"{name_no_ext}.webp"
            img.save(webp_path, format="WebP", quality=80, optimize=True)

            # LQIP placeholder (50x75px, ~2:3 ratio for card aspect ratio)
            lqip_path = lqip_dir / f"{name_no_ext}.png"
            lqip_img = img.resize((50, 75), Image.LANCZOS)
            lqip_img.save(lqip_path, format="PNG", optimize=True)

            print(f"  OK {img_name}")
        except Exception as e:
            print(f"  FAIL {img_name}: {e}")


generate_assets()
print("\nAssets generated successfully!")