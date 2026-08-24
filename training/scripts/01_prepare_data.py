"""
SpeakPay  -  Step 1: Download and prepare NepFinSpeech-403
Run: python scripts/01_prepare_data.py
"""
import json, os, sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
import librosa
import soundfile as sf
import numpy as np

ROOT       = Path(__file__).resolve().parent.parent
DATA_FILE  = ROOT / "data" / "nepfinspeech_dataset.json"
AUDIO_DIR  = ROOT / "data" / "audio"
TARGET_SR  = 16000
MIN_DUR, MAX_DUR = 0.5, 30.0


def download_audio(dataset: list[dict]) -> tuple[int, list]:
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    def fetch(item):
        path = AUDIO_DIR / f"{item['audio_id']}.wav"
        if path.exists() and path.stat().st_size > 1000:
            return item["audio_id"], True, "cached"
        try:
            r = requests.get(item["url"], timeout=20)
            r.raise_for_status()
            path.write_bytes(r.content)
            return item["audio_id"], True, "ok"
        except Exception as e:
            return item["audio_id"], False, str(e)[:80]

    print(f"Downloading {len(dataset)} audio files from Cloudinary...")
    ok, failed = 0, []
    with ThreadPoolExecutor(max_workers=16) as ex:
        futures = {ex.submit(fetch, item): item for item in dataset}
        for i, fut in enumerate(as_completed(futures)):
            aid, success, msg = fut.result()
            if success:
                ok += 1
            else:
                failed.append((aid, msg))
            if (i + 1) % 80 == 0 or i + 1 == len(dataset):
                print(f"  {i+1}/{len(dataset)}  -  {ok} ok, {len(failed)} failed")
    return ok, failed


def validate_and_resample(dataset: list[dict]) -> list[dict]:
    valid = []
    for item in dataset:
        path = AUDIO_DIR / f"{item['audio_id']}.wav"
        if not path.exists():
            continue
        try:
            audio, sr = librosa.load(str(path), sr=TARGET_SR, mono=True)
            dur = len(audio) / TARGET_SR
            if not (MIN_DUR <= dur <= MAX_DUR):
                continue
            clean_path = AUDIO_DIR / f"{item['audio_id']}_16k.wav"
            sf.write(str(clean_path), audio, TARGET_SR)
            valid.append({
                "path": str(clean_path),
                "sentence": item["transcript"].strip(),
                "duration": round(dur, 2),
            })
        except Exception:
            continue
    return valid


def main():
    if not DATA_FILE.exists():
        sys.exit(f"ERROR: {DATA_FILE} not found. Make sure data/nepfinspeech_dataset.json exists.")

    with open(DATA_FILE, encoding="utf-8") as f:
        dataset = json.load(f)
    print(f"✓ Loaded {len(dataset)} audio-transcript pairs\n")

    ok, failed = download_audio(dataset)
    print(f"\n✓ {ok} downloaded, {len(failed)} failed")
    if failed:
        print("  Failed samples:", failed[:5])

    print("\nValidating and resampling to 16kHz mono...")
    valid = validate_and_resample(dataset)

    total_sec = sum(v["duration"] for v in valid)
    durs = [v["duration"] for v in valid]
    print(f"\n✓ {len(valid)} valid samples ready for training")
    print(f"  Total audio : {total_sec/60:.1f} min ({total_sec/3600:.3f} hr)")
    print(f"  Duration    : {min(durs):.1f}s – {max(durs):.1f}s (mean {np.mean(durs):.1f}s)")

    # Save the prepared manifest for the next script
    manifest_path = ROOT / "data" / "manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(valid, f, ensure_ascii=False, indent=2)
    print(f"\n✓ Saved manifest: {manifest_path}")
    print("\nNext: python scripts/02_train.py")


if __name__ == "__main__":
    main()
