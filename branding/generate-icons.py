from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = Path(__file__).resolve().parent / "logo-source.png"
PUBLIC = ROOT / "public"

# Replace branding/logo-source.png, then run: python branding/generate-icons.py
SIZES = {
    "icon-1024.png": 1024,
    "icon-512.png": 512,
    "icon-192.png": 192,
    "apple-touch-icon.png": 180,
    "apple-touch-icon-120.png": 120,
    "favicon.png": 32,
}


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"Source logo not found: {SOURCE}")

    PUBLIC.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert("RGB")
    master = source.resize((1024, 1024), Image.Resampling.LANCZOS)

    for filename, size in SIZES.items():
        icon = master if size == 1024 else master.resize((size, size), Image.Resampling.LANCZOS)
        dest = PUBLIC / filename
        icon.save(dest, format="PNG", optimize=True)
        print(f"Wrote {dest} ({size}x{size})")


if __name__ == "__main__":
    main()
