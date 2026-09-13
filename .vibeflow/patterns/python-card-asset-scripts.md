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
print-ready card sheets, and cross-check `cards_database.json` against
`card-abilities.js` coverage. None of this runs as part of the web game.

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

Consistency-check scripts read both data sources and diff them:
```python
with open('card-abilities.js', 'r', encoding='utf-8') as f:
    content = f.read()
implemented_cards = set(re.findall(r"case 'card_(\d+)':", content))

with open('cards_database.json', 'r', encoding='utf-8') as f:
    db = json.load(f)
all_cards = {c['id'].replace('card_', '') for c in db['cards']}

missing_cards = sorted(all_cards - implemented_cards, key=lambda x: int(x))
```

## Rules
- Each script is self-contained and run directly (`python script.py`) — no
  shared module, no `argparse`, no package structure between scripts.
- OCR-based renaming scripts follow: load `cards_database.json` → OpenCV
  preprocess (grayscale → CLAHE → adaptive threshold) → `pytesseract` →
  fuzzy match with `difflib.SequenceMatcher` against known card names.
- Cross-check scripts (`check_cards.py`, `final_check.py`) diff
  `card-abilities.js`'s `case 'card_(\d+)':` regex matches against
  `cards_database.json` ids to report ability-implementation coverage —
  reuse this approach rather than writing a new coverage checker.
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
