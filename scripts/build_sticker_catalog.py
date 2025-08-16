#!/usr/bin/env python3
"""
build_sticker_catalog.py – one‑pass manifest + Shopify CSV generator
–––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––––

• Root path fixed at /mnt/c/icon
• ONE folder per sticker image (auto‑created if missing)
• Generates 128×128 PNG thumbnail, manifest.json and Shopify CSV
"""

# ── stdlib ──────────────────────────────────────────────────────────────
import csv, json, logging, os, re, sys, time, shutil          # ❶ shutil added
from pathlib import Path
from typing import Dict, List, Tuple

# ── third‑party ─────────────────────────────────────────────────────────
from PIL import Image                                          # Pillow ≥10.0
from rembg import remove

import google.cloud.vision as vision
import google.generativeai as genai

# ── configuration ───────────────────────────────────────────────────────
ROOT   = Path("/mnt/c/icon")            # ❷ absolute repo root
PACKS  = ROOT / "packages" / "stickers"
LOGDIR = ROOT / "logs"; LOGDIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    filename=str(LOGDIR / "sticker_build.log"),     # ← keyword arg
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(message)s"
)

os.environ.setdefault("GOOGLE_APPLICATION_CREDENTIALS", "svc-key.json")
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

CSV_PATH = ROOT / "product_catalog.csv"

# ── helpers (unchanged) ────────────────────────────────────────────────
def slug(text: str) -> str:
    return re.sub(r"[^0-9A-Za-z._-]+", "-", text.lower()).strip("-")[:60]

def is_animated_webp(img: Image.Image) -> bool:
    return getattr(img, "is_animated", False) and getattr(img, "n_frames", 1) > 1

def smart_thumbnail(src: Path, dest: Path, size: Tuple[int,int]=(128,128)) -> None:
    with Image.open(src).convert("RGBA") as im:
        bbox = im.split()[3].getbbox() or (0,0)+im.size
        im.crop(bbox).thumbnail(size, Image.LANCZOS)
        dest.parent.mkdir(parents=True, exist_ok=True)
        im.save(dest, "PNG")

# ── virality & pricing (unchanged) ─────────────────────────────────────
vision_client = vision.ImageAnnotatorClient()
GEM_PROMPT = (
    "Rate the internet popularity of this sticker image on a 1‑4 integer scale "
    "(1 = niche, 4 = extremely viral). Respond with just the number.")
gem_model = genai.GenerativeModel("gemini-1.5-pro-latest")

def vision_score(img: Path) -> int|None:
    try:
        with img.open("rb") as f:
            content = f.read()
        resp = vision_client.web_detection({"content": content}, max_results=1)
        return len(resp.web_detection.pages_with_matching_images)
    except Exception as e:
        logging.warning("Vision error %s", e)
        return None

def gemini_fallback(img: Path) -> int:
    try:
        rsp = gem_model.generate_content(
            [GEM_PROMPT, img.read_bytes()],
            generation_config={"response_mime_type": "text/plain"})
        return int(re.search(r"[1-4]", rsp.text).group())
    except Exception:
        return 1

def virality_to_tier(matches: int|None) -> int:
    if matches is None: return 1
    if matches >= 1000: return 4
    if matches >= 500:  return 3
    if matches >= 100:  return 2
    return 1

PRICE_MAP = {1: 1.00, 2: 3.00, 3: 5.00, 4: 10.00}

# ── CSV helpers (unchanged) ────────────────────────────────────────────
CSV_HEADER = [
    "Handle", "Title", "Body (HTML)", "Vendor", "Type", "Tags", "Published",
    "Option1 Name", "Option1 Value",
    "Variant SKU", "Variant Price", "Variant Requires Shipping",
    "Variant Taxable", "Image Src"
]

def init_csv() -> None:
    if not CSV_PATH.exists():
        CSV_PATH.write_text(",".join(CSV_HEADER) + "\n", encoding="utf-8")

def append_or_update_csv(row: List[str]) -> None:
    rows: List[List[str]] = []
    if CSV_PATH.exists():
        rows = list(csv.reader(CSV_PATH.open(encoding="utf-8")))
    header = rows[0] if rows else CSV_HEADER
    body   = rows[1:] if rows else []
    # replace or append
    replaced = False
    for r in body:
        if r and r[0] == row[0]:
            r[:] = row; replaced = True; break
    if not replaced:
        body.append(row)
    with CSV_PATH.open("w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerows([header] + body)

# ── NEW: ensure each sticker has its own folder ────────────────────────
def ensure_foldered(webp: Path) -> Path:
    """
    If `sticker.webp` is at packages/stickers/, move it to
    packages/stickers/sticker/sticker.webp  and return new path.
    """
    if webp.parent != PACKS:               # already in a subfolder
        return webp
    target_dir = PACKS / webp.stem
    target_dir.mkdir(parents=True, exist_ok=True)
    dest = target_dir / webp.name
    if not dest.exists():
        shutil.move(str(webp), str(dest))   # ❸ uses shutil.move
    return dest

# ── core processing ────────────────────────────────────────────────────
def process_webp(webp: Path) -> Dict:
    with Image.open(webp) as im:
        w, h = im.size
        animated = is_animated_webp(im)

    thumb = webp.with_name(f"{webp.stem}-thumb.png")
    if not thumb.exists():
        smart_thumbnail(webp, thumb)

    matches = vision_score(webp)
    tier    = virality_to_tier(matches)
    if tier == 1:
        tier = gemini_fallback(webp)
    price = PRICE_MAP[tier]

    entry = {
        "id": webp.stem,
        "name": webp.stem.replace("-", " ").title(),
        "file": webp.name,
        "width": w, "height": h, "animated": animated,
        "defaultPosition": {"x": 0.5, "y": 0.5},
        "thumb": thumb.name,
        "viralityTier": tier, "priceUSD": price
    }

    csv_row = [
        slug(webp.stem),
        entry["name"], "", "CBB", "Sticker", "sticker", "TRUE",
        "Title", "Default", slug(webp.stem).upper(),
        f"{price:.2f}", "FALSE", "FALSE",
        f"https://store.cbb.homes/images/{webp.name}"
    ]
    append_or_update_csv(csv_row)
    return entry

def main() -> None:
    init_csv()

    # walk every .webp, foldering on the fly
    for raw in PACKS.rglob("*.webp"):
        fixed = ensure_foldered(raw)
        pack_manifest = fixed.parent / "manifest.json"

        existing: List[Dict] = []
        if pack_manifest.exists():
            existing = json.loads(pack_manifest.read_text())

        # keep other entries, drop the one we’ll regenerate
        existing = [e for e in existing if e["id"] != fixed.stem]
        existing.append(process_webp(fixed))
        existing.sort(key=lambda x: x["id"])

        pack_manifest.write_text(json.dumps(existing, indent=2, ensure_ascii=False))
        logging.info("Updated %s", pack_manifest)

    print("✅  All manifests and product_catalog.csv up to date.")

if __name__ == "__main__":
    if not PACKS.exists():
        sys.exit("❌  /mnt/c/icon/packages/stickers/ not found")
    main()
