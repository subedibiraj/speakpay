"""
SpeakPay  -  Step 2: Build train/val/test splits and extract Whisper features
Run: python scripts/02_prepare_features.py

This is separated from training so feature extraction (slow, CPU-bound)
only needs to run once, even if you restart training with different
hyperparameters.
"""
import json, random
from pathlib import Path

from datasets import Dataset, DatasetDict, Audio
from transformers import WhisperProcessor

from config import (
    BASE_MODEL, LANGUAGE, TASK, TARGET_SR, TEST_SPLIT, VAL_SPLIT, SEED,
)

ROOT          = Path(__file__).resolve().parent.parent
MANIFEST_FILE = ROOT / "data" / "manifest.json"
FEATURES_DIR  = ROOT / "data" / "features"


def to_hf_dataset(data: list[dict]) -> Dataset:
    return Dataset.from_dict({
        "audio":    [d["path"]     for d in data],
        "sentence": [d["sentence"] for d in data],
    }).cast_column("audio", Audio(sampling_rate=TARGET_SR))


def main():
    if not MANIFEST_FILE.exists():
        raise SystemExit(
            f"ERROR: {MANIFEST_FILE} not found. Run scripts/01_prepare_data.py first."
        )

    with open(MANIFEST_FILE, encoding="utf-8") as f:
        valid = json.load(f)

    random.seed(SEED)
    random.shuffle(valid)

    n       = len(valid)
    n_test  = int(n * TEST_SPLIT)
    n_val   = int(n * VAL_SPLIT)
    n_train = n - n_test - n_val

    test_data  = valid[:n_test]
    val_data   = valid[n_test:n_test + n_val]
    train_data = valid[n_test + n_val:]

    print("=== Split ===")
    print(f"  Train      : {len(train_data):4d}  ({n_train/n*100:.0f}%)")
    print(f"  Validation : {len(val_data):4d}  ({n_val/n*100:.0f}%)")
    print(f"  Test       : {len(test_data):4d}  ({n_test/n*100:.0f}%)  ← held-out benchmark")

    # Save raw splits (paths + transcripts) for the benchmark script later
    with open(ROOT / "data" / "test_split.json", "w", encoding="utf-8") as f:
        json.dump(test_data, f, ensure_ascii=False, indent=2)

    ds = DatasetDict({
        "train":      to_hf_dataset(train_data),
        "validation": to_hf_dataset(val_data),
        "test":       to_hf_dataset(test_data),
    })

    print(f"\nLoading Whisper processor ({BASE_MODEL})...")
    processor = WhisperProcessor.from_pretrained(BASE_MODEL, language=LANGUAGE, task=TASK)

    def prepare(batch):
        audio = batch["audio"]
        batch["input_features"] = processor.feature_extractor(
            audio["array"], sampling_rate=audio["sampling_rate"]
        ).input_features[0]
        batch["labels"] = processor.tokenizer(batch["sentence"]).input_ids
        return batch

    print("Extracting features (this may take a few minutes on CPU)...")
    ds = ds.map(prepare, remove_columns=["audio"], num_proc=1)

    FEATURES_DIR.mkdir(parents=True, exist_ok=True)
    ds.save_to_disk(str(FEATURES_DIR))
    print(f"\n✓ Features saved to {FEATURES_DIR}")
    print(f"  {ds}")
    print("\nNext: python scripts/03_train.py")


if __name__ == "__main__":
    main()
