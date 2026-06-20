"""
SpeakPay — Merge transcript pairs with Cloudinary audio URLs

Combines dataset_pairs.json (from extract_xlsb.py) with the audio
hosting URLs to produce the final nepfinspeech_dataset.json consumed
by training/scripts/01_prepare_data.py.

The Cloudinary URL list is fetched live from the original collection
API. If that API is unavailable (it runs on Render's free tier, which
sleeps after inactivity and can be slow to wake), this script falls
back to the bundled url_map.json snapshot.

Run: python build_dataset.py
"""
import json
import re
import sys
import time
from pathlib import Path

import requests

API_URL      = "https://bolanepal-api.onrender.com/api/v1/audios/getaudios"
PAIRS_FILE   = Path("dataset_pairs.json")
URLMAP_FILE  = Path("url_map.json")          # fallback snapshot
OUTPUT_FILE  = Path("nepfinspeech_dataset.json")


def fetch_url_map_from_api(retries: int = 3, timeout: int = 45) -> dict:
    """The Render free-tier API sleeps after inactivity — first request
    can take 30-50s to wake it up. We retry with a longer timeout."""
    for attempt in range(1, retries + 1):
        try:
            print(f"  Attempt {attempt}/{retries} (timeout={timeout}s)...")
            resp = requests.get(API_URL, headers={"accept": "*/*"}, timeout=timeout)
            resp.raise_for_status()
            urls = resp.json()["data"]
            url_map = {}
            for url in urls:
                m = re.search(r"audio(\d+)\.wav", url)
                if m:
                    url_map[f"audio{m.group(1)}"] = url
            return url_map
        except requests.exceptions.RequestException as e:
            print(f"  Failed: {e}")
            if attempt < retries:
                time.sleep(5)
    return {}


def load_url_map_fallback() -> dict:
    if not URLMAP_FILE.exists():
        return {}
    with open(URLMAP_FILE, encoding="utf-8") as f:
        return json.load(f)


def main():
    if not PAIRS_FILE.exists():
        sys.exit(
            f"ERROR: {PAIRS_FILE} not found.\n"
            f"Run: python extract_xlsb.py path/to/audio-edit1.xlsb -o {PAIRS_FILE}"
        )

    with open(PAIRS_FILE, encoding="utf-8") as f:
        pairs = json.load(f)
    print(f"Loaded {len(pairs)} transcript pairs")

    print("\nFetching audio URLs from collection API...")
    url_map = fetch_url_map_from_api()

    if not url_map:
        print("\nAPI unavailable — falling back to bundled url_map.json snapshot")
        url_map = load_url_map_fallback()

    if not url_map:
        sys.exit(
            "ERROR: Could not obtain audio URLs from API or fallback file.\n"
            "Either retry later (API may be cold-starting) or use the bundled "
            "nepfinspeech_dataset.json directly without rebuilding."
        )

    print(f"  {len(url_map)} URLs available")

    merged = []
    missing = []
    for pair in pairs:
        aid = pair["audio"]
        if aid in url_map:
            merged.append({
                "audio_id":   aid,
                "url":        url_map[aid],
                "transcript": pair["transcript"],
            })
        else:
            missing.append(aid)

    print(f"\n✓ Merged {len(merged)} samples")
    if missing:
        print(f"  ⚠ {len(missing)} samples had no matching URL: {missing[:5]}")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)
    print(f"✓ Saved {OUTPUT_FILE}")

    # Refresh the fallback snapshot for next time
    with open(URLMAP_FILE, "w", encoding="utf-8") as f:
        json.dump(url_map, f, ensure_ascii=False, indent=2)
    print(f"✓ Updated {URLMAP_FILE} (fallback snapshot)")


if __name__ == "__main__":
    main()
