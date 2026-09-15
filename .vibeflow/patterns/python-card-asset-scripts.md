---
tags: [python, ocr, image-processing, offline-tooling, cli]
modules: [scripts/rename_card_images.py, scripts/smart_rename.py, scripts/rename_by_order.py, scripts/create_cards_front_back.py, scripts/create_cards_high_quality.py, scripts/create_card_back.py, scripts/card_printing_advanced.py, scripts/check_cards.py, scripts/final_check.py, scripts/analyze_json.py]
applies_to: [commands]
confidence: inferred
---
# Pattern: Standalone Python Asset/Data Scripts

<!-- vibeflow:auto:start -->
## What
A set of independent, manually-run Python scripts (no shared package, no
CLI framework) used offline to rename card images via OCR, generate
print-ready card sheets, and cross-check `data/cards_database.json` against
`src/js/card-rules.js` coverage. None of this runs as part of the web game.

## Where
Canonical tools under `scripts/` (`rename_card_images.py`, `smart_rename.py`,
`rename_by_order.py`, `create_cards_*.py`, `card_printing_advanced.py`,
`check_cards.py`, `final_check.py`, `analyze_json.py`).

## The Pattern
```python
import json, os, cv2, pytesseract
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

class CardImageRenamer:
    def __init__(self, json_path, images_folder):
        self.json_path = json_path
        self.images_folder = images_folder
        self.cards_data = []
        self.load_cards_data()

    def load_cards_data(self):
        with open(self.json_path, 'r', encoding='utf-8') as file:
            data = json.load(file)
            self.cards_data = data['cards']

    def preprocess_image(self, image_path, focus_on_title=True):
        img = cv2.imread(image_path)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        thresh = cv2.adaptiveThreshold(enhanced, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 15, 8)
        return thresh
```

Coverage scripts scan `card-rules.js` for each catalog id (tables *and*
inline `definitionId === 'card_XXX'` handlers):
```python
with open('src/js/card-rules.js', 'r', encoding='utf-8') as f:
    rules_source = f.read()
with open('data/cards_database.json', 'r', encoding='utf-8') as f:
    db = json.load(f)

all_ids = {card['id'] for card in db['cards']}
implemented_ids = {
    card_id for card_id in all_ids
    if re.search(rf'\b{re.escape(card_id)}\b', rules_source)
}
```

## Rules
- Each script is self-contained and run from the repo root
  (`py -3 scripts/check_cards.py`) — no shared module, no `argparse`.
- OCR-based renaming scripts follow: load `data/cards_database.json` → OpenCV
  preprocess (grayscale → CLAHE → adaptive threshold) → `pytesseract` →
  fuzzy match with `difflib.SequenceMatcher` against known card names.
- `check_cards.py` reports coverage by substring presence of `card_XXX` in
  `src/js/card-rules.js`. Do not go back to parsing `case 'card_N':` in
  `card-abilities.js`, and do not use `CardRules.isMigrated()`.
- Hardcoded local paths (e.g. the Tesseract binary path) are acceptable in
  these scripts — they are personal/offline tools, not deployed code, and
  are not loaded by `game.html`.

## Examples from this codebase
File: [rename_card_images.py](../../scripts/rename_card_images.py#L1)
`CardImageRenamer` — see "The Pattern" above.

File: [check_cards.py](../../scripts/check_cards.py#L1)
Coverage diff — see "The Pattern" above.
<!-- vibeflow:auto:end -->

## Anti-patterns
- OCR preprocessing logic is duplicated with small variations across
  `rename_card_images.py`, `smart_rename.py`, and `rename_by_order.py`
  instead of being shared — expect drift between them.
- No automated tests for any of these scripts; correctness is verified by
  manually inspecting renamed files/output images.
