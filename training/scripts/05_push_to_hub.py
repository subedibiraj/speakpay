"""
SpeakPay — Step 5: Push dataset, model, and benchmark results to Hugging Face
Run: python scripts/05_push_to_hub.py

Requires: huggingface-cli login   (run once, paste your HF write token)
"""
import json
from pathlib import Path

from datasets import DatasetDict, Dataset, Audio
from huggingface_hub import HfApi, login

from config import DATASET_REPO, MODEL_REPO, BASE_MODEL, LANGUAGE, TASK, TARGET_SR

ROOT         = Path(__file__).resolve().parent.parent
MANIFEST     = ROOT / "data" / "manifest.json"
TEST_FILE    = ROOT / "data" / "test_split.json"
FINAL_DIR    = ROOT / "checkpoints" / "final"
RESULTS_FILE = ROOT / "benchmark_results.json"


def to_hf_dataset(data):
    return Dataset.from_dict({
        "audio":    [d["path"]     for d in data],
        "sentence": [d["sentence"] for d in data],
    }).cast_column("audio", Audio(sampling_rate=TARGET_SR))


def main():
    print("Checking Hugging Face login...")
    try:
        api = HfApi()
        user = api.whoami()
        print(f"✓ Logged in as: {user['name']}")
    except Exception:
        print("Not logged in. Run: huggingface-cli login")
        return

    if "YOUR_HF_USERNAME" in DATASET_REPO:
        raise SystemExit("ERROR: Edit scripts/config.py and set HF_USERNAME first.")

    # ── Rebuild full dataset with splits ──────────────────────────────
    with open(MANIFEST, encoding="utf-8") as f:
        all_data = json.load(f)
    with open(TEST_FILE, encoding="utf-8") as f:
        test_data = json.load(f)

    test_paths = {d["path"] for d in test_data}
    remaining  = [d for d in all_data if d["path"] not in test_paths]
    n_val      = int(len(all_data) * 0.10)
    val_data   = remaining[:n_val]
    train_data = remaining[n_val:]

    print(f"\nPushing dataset → {DATASET_REPO}")
    ds = DatasetDict({
        "train":      to_hf_dataset(train_data),
        "validation": to_hf_dataset(val_data),
        "test":       to_hf_dataset(test_data),
    })
    ds.push_to_hub(DATASET_REPO)
    print(f"✓ https://huggingface.co/datasets/{DATASET_REPO}")

    # ── Push model ─────────────────────────────────────────────────
    print(f"\nPushing LoRA adapter → {MODEL_REPO}")
    from transformers import WhisperForConditionalGeneration, WhisperProcessor
    from peft import PeftModel
    import torch

    base = WhisperForConditionalGeneration.from_pretrained(BASE_MODEL, torch_dtype=torch.float16)
    model = PeftModel.from_pretrained(base, str(FINAL_DIR))
    proc  = WhisperProcessor.from_pretrained(BASE_MODEL, language=LANGUAGE, task=TASK)

    model.push_to_hub(MODEL_REPO)
    proc.push_to_hub(MODEL_REPO)
    print(f"✓ https://huggingface.co/{MODEL_REPO}")

    # ── Push benchmark results ────────────────────────────────────
    if RESULTS_FILE.exists():
        api.upload_file(
            path_or_fileobj=str(RESULTS_FILE),
            path_in_repo="benchmark_results.json",
            repo_id=MODEL_REPO,
        )
        print("✓ benchmark_results.json uploaded")

    print("\n=== All done ===")
    print(f"Dataset : https://huggingface.co/datasets/{DATASET_REPO}")
    print(f"Model   : https://huggingface.co/{MODEL_REPO}")


if __name__ == "__main__":
    main()
