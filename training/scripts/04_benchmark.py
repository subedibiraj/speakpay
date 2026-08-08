"""
SpeakPay — Step 4: Benchmark base vs general vs domain-adapted model
Run: python scripts/04_benchmark.py

Produces benchmark_results.json — the core research result table.
"""
import os
os.environ.setdefault("WANDB_DISABLED", "true")

import json, re
from pathlib import Path

import torch
import evaluate
from transformers import (
    pipeline,
    WhisperForConditionalGeneration,
    WhisperProcessor,
)
from peft import PeftModel

from config import BASE_MODEL, LANGUAGE, TASK

DEV = 0 if torch.cuda.is_available() else -1
DEV_STR = "cuda" if torch.cuda.is_available() else "cpu"

ROOT       = Path(__file__).resolve().parent.parent
TEST_FILE  = ROOT / "data" / "test_split.json"
FINAL_DIR  = ROOT / "checkpoints" / "final"
RESULTS_FILE = ROOT / "benchmark_results.json"

NEP_NUM = re.compile(r"[०-९]+")
wer_metric = evaluate.load("wer")
cer_metric = evaluate.load("cer")


def bench(pipe, paths, refs, name):
    import librosa
    preds = []
    for path in paths:
        audio, _ = librosa.load(path, sr=16000)
        out = pipe(audio, generate_kwargs={"language": "nepali", "task": "transcribe"})
        preds.append(out["text"].strip())

    pn = [" ".join(s.lower().split()) for s in preds]
    rn = [" ".join(s.lower().split()) for s in refs]
    wer = 100 * wer_metric.compute(predictions=pn, references=rn)
    cer = 100 * cer_metric.compute(predictions=pn, references=rn)

    tot, hit = 0, 0
    for p, r in zip(preds, refs):
        for n in NEP_NUM.findall(r):
            tot += 1
            if n in p:
                hit += 1
    num_acc = 100 * hit / tot if tot else 0

    print(f"  {name}")
    print(f"    WER={wer:.2f}%  CER={cer:.2f}%  NumAcc={num_acc:.1f}%")
    for i in range(min(2, len(preds))):
        print(f"    REF : {refs[i]}")
        print(f"    PRED: {preds[i]}")

    return {
        "model": name,
        "WER": round(wer, 2),
        "CER": round(cer, 2),
        "NumAcc": round(num_acc, 1),
        "predictions": preds,
    }


def main():
    if not TEST_FILE.exists():
        raise SystemExit(f"ERROR: {TEST_FILE} not found. Run scripts/02_prepare_features.py first.")
    if not FINAL_DIR.exists():
        raise SystemExit(f"ERROR: {FINAL_DIR} not found. Run scripts/03_train.py first.")

    with open(TEST_FILE, encoding="utf-8") as f:
        test_data = json.load(f)

    test_paths  = [d["path"] for d in test_data]
    test_labels = [d["sentence"] for d in test_data]
    print(f"Benchmarking on {len(test_paths)} held-out test samples\n")

    results = []

    # ── Model A: base Whisper large-v2 (zero-shot) ────────────────────
    print("[A] Base Whisper large-v2 (zero-shot)...")
    pipe_a = pipeline(
        "automatic-speech-recognition",
        model="openai/whisper-large-v2",
        device=DEV,
        torch_dtype=torch.float16 if DEV == 0 else torch.float32,
    )
    results.append(bench(pipe_a, test_paths, test_labels, "Whisper large-v2 (zero-shot)"))
    del pipe_a
    torch.cuda.empty_cache()

    # ── Model B: general Nepali fine-tune (small) ──────────────────────
    # Whisper small fine-tuned on OpenSLR54 (~154h general Nepali speech)
    print("\n[B] General Nepali fine-tune (small)...")
    try:
        pipe_b = pipeline(
            "automatic-speech-recognition",
            model="fnawaraj/whisper-small-nepali-openslr",
            device=DEV,
            torch_dtype=torch.float16 if DEV == 0 else torch.float32,
        )
        results.append(bench(pipe_b, test_paths, test_labels,
                             "Whisper small (general Nepali FT)"))
        del pipe_b
        torch.cuda.empty_cache()
    except Exception as e:
        print(f"  Could not load model: {e}")
        results.append({"model": "Whisper small (general Nepali FT)",
                        "WER": "N/A", "CER": "N/A", "NumAcc": "N/A"})

    # ── Model B2: general Nepali fine-tune (large) ────────────────────
    # Whisper large-v3 fine-tuned on OpenSLR54 (~154h general Nepali speech)
    print("\n[B2] General Nepali fine-tune (large-v3)...")
    try:
        pipe_b2 = pipeline(
            "automatic-speech-recognition",
            model="Dragneel/whisper-large-v3-nepali-openslr",
            device=DEV,
            torch_dtype=torch.float16 if DEV == 0 else torch.float32,
        )
        results.append(bench(pipe_b2, test_paths, test_labels,
                             "Whisper large-v3 (general Nepali FT)"))
        del pipe_b2
        torch.cuda.empty_cache()
    except Exception as e:
        print(f"  Could not load model: {e}")
        results.append({"model": "Whisper large-v3 (general Nepali FT)",
                        "WER": "N/A", "CER": "N/A", "NumAcc": "N/A"})

    # ── Model C: our domain LoRA ───────────────────────────────────────
    print("\n[C] Domain LoRA (NepFinSpeech — ours)...")
    base_c = WhisperForConditionalGeneration.from_pretrained(
        BASE_MODEL, torch_dtype=torch.float16 if DEV == 0 else torch.float32
    ).to(DEV_STR)
    our_model = PeftModel.from_pretrained(base_c, str(FINAL_DIR))
    proc_c = WhisperProcessor.from_pretrained(BASE_MODEL, language=LANGUAGE, task=TASK)
    pipe_c = pipeline(
        "automatic-speech-recognition",
        model=our_model,
        tokenizer=proc_c.tokenizer,
        feature_extractor=proc_c.feature_extractor,
        torch_dtype=torch.float16 if DEV == 0 else torch.float32,
        device=DEV,
    )
    results.append(bench(pipe_c, test_paths, test_labels, "Whisper + LoRA (NepFinSpeech — ours)"))

    # ── Final table ─────────────────────────────────────────────────
    print("\n" + "=" * 65)
    print("BENCHMARK — NepFinSpeech Test Set")
    print("=" * 65)
    print(f"{'Model':<42} {'WER%':>6} {'CER%':>6} {'NumAcc%':>8}")
    print("-" * 65)
    for r in results:
        print(f"{r['model']:<42} {str(r['WER']):>6} {str(r['CER']):>6} {str(r['NumAcc']):>8}")
    print("=" * 65)

    with open(RESULTS_FILE, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n✓ Saved {RESULTS_FILE}")
    print("\nNext: python scripts/05_push_to_hub.py")


if __name__ == "__main__":
    main()
