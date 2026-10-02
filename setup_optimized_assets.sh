#!/usr/bin/env bash
# setup_optimized_assets.sh — pipeline de assets otimizados do X Monsters.
#
# Diferenças em relação ao rascunho original (que NÃO roda aqui):
#  - Conversão NÃO usa `convert`/ImageMagick: neste Windows `convert` resolve
#    para o utilitário de NTFS (C:\Windows\System32\convert.exe), não para o
#    ImageMagick. Usamos `python` + Pillow, a mesma lib do gerador existente.
#  - NÃO faz `sed`/append em `src/js/game.js`: a renderização otimizada (LQIP +
#    WebP + lazy) já está versionada em `src/js/game.js` (helper
#    `montarImagemDaCarta`) e em `src/css/game.css` (`.card-image-real.card-lazy`).
#    Editar JS com regex destrói o arquivo; aqui apenas verificamos a fiação.
#
# Uso:  bash setup_optimized_assets.sh [--force]
#   --force   reconverte mesmo que os assets já existam.
set -euo pipefail

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FORCE=0
[[ "${1:-}" == "--force" ]] && FORCE=1

CARD_DIR="$BASE_DIR/assets/cards"
WEBP_DIR="$BASE_DIR/assets/webp"
LQIP_DIR="$BASE_DIR/assets/lqip"
JS_FILE="$BASE_DIR/src/js/game.js"
CSS_FILE="$BASE_DIR/src/css/game.css"

mkdir -p "$WEBP_DIR" "$LQIP_DIR"

echo "=========================================="
echo "X Monsters: Optimized Asset Pipeline"
echo "=========================================="

count_png() { find "$CARD_DIR" -maxdepth 1 -name '*.png' 2>/dev/null | wc -l | tr -d ' '; }
count_ext() { find "$1" -maxdepth 1 -name "*.$2" 2>/dev/null | wc -l | tr -d ' '; }
sum_bytes() { # dir + argumentos extras de find; soma bytes sem depender de `du`
    find "$1" -maxdepth 1 -type f "${@:2}" -printf '%s\n' 2>/dev/null | awk '{s+=$1} END {print s+0}'
}
to_mb() { awk "BEGIN {printf \"%.2f\", $1/1048576}"; }

TOTAL="$(count_png)"
WEBP="$(count_ext "$WEBP_DIR" webp)"
LQIP="$(count_ext "$LQIP_DIR" png)"

echo ""
echo "[1/3] Conversão PNG -> WebP (80%) + LQIP (50x75)..."
if [[ "$FORCE" -eq 1 || "$WEBP" -ne "$TOTAL" || "$LQIP" -ne "$TOTAL" ]]; then
    if command -v python >/dev/null 2>&1; then PY_RUN=(python); else PY_RUN=(py -3); fi
    "${PY_RUN[@]}" - "$CARD_DIR" "$WEBP_DIR" "$LQIP_DIR" <<'PY'
import os, sys
from PIL import Image  # Pillow; mesma lib do gerador existente do projeto
cards_dir, webp_dir, lqip_dir = sys.argv[1], sys.argv[2], sys.argv[3]
ok = 0
for fn in sorted(os.listdir(cards_dir)):
    if not fn.lower().endswith(".png"):
        continue
    base = os.path.splitext(fn)[0]
    src = os.path.join(cards_dir, fn)
    img = Image.open(src).convert("RGBA")
    img.save(os.path.join(webp_dir, base + ".webp"), format="WebP", quality=80, optimize=True)
    img.resize((50, 75), Image.LANCZOS).save(
        os.path.join(lqip_dir, base + ".png"), format="PNG", optimize=True
    )
    ok += 1
print(f"   convertidas: {ok}")
PY
else
    echo "   já em dia ($WEBP webp / $LQIP lqip) — use --force para reconverter."
fi

echo ""
echo "[2/3] Verificando a fiação no cliente..."
if grep -q "montarImagemDaCarta" "$JS_FILE"; then
    echo "   game.js: helper montarImagemDaCarta OK"
else
    echo "   game.js: FALTANDO helper montarImagemDaCarta" >&2
fi
if grep -q "card-lazy" "$CSS_FILE"; then
    echo "   game.css: regra .card-image-real.card-lazy OK"
else
    echo "   game.css: FALTANDO regra .card-lazy" >&2
fi

echo ""
echo "[3/3] Balanço de tamanho..."
WEBP="$(count_ext "$WEBP_DIR" webp)"
LQIP="$(count_ext "$LQIP_DIR" png)"
ORIG="$(sum_bytes "$CARD_DIR" -name '*.png')"
WP="$(sum_bytes "$WEBP_DIR" -name '*.webp')"
LQ="$(sum_bytes "$LQIP_DIR" -name '*.png')"
echo "   cards .png : $(to_mb "$ORIG") MB ($TOTAL arquivos)"
echo "   webp       : $(to_mb "$WP") MB ($WEBP arquivos)"
echo "   lqip       : $(to_mb "$LQ") MB ($LQIP arquivos)"
if [[ "$ORIG" -gt 0 ]]; then
    awk "BEGIN {printf \"   redução webp: %.1f%%  (economia ~%.2f MB)\n\", ($ORIG-$WP)/$ORIG*100, ($ORIG-$WP)/1048576}"
fi

echo ""
echo "=========================================="
echo "Pronto. Sirva com: py -3 server.py"
echo "DevTools > Network: .webp (lazy) + assets/lqip/*.png (instantâneo)."
echo "=========================================="