"""
SpeakPay — noise robustness evaluation.

Your test set is presumably clean/read speech. A real blind user calling
this from a phone, on a street, over a spotty mic, will not sound like that.
This script synthetically degrades the test audio in controlled ways and
reruns benchmarking, so you can report a robustness curve rather than a
single clean-condition WER — this directly strengthens the "real-world
accessibility tool" framing over a "lab benchmark" framing.

Requires: the actual test-set WAV files (not included in the repo zip —
pull them from wherever the NepFinSpeech audio is hosted, e.g. your HF
dataset repo) and `audiomentations` (pip install audiomentations).

Degradations applied (each independently, so you get a per-condition row):
  - Clean (baseline, no augmentation)
  - Additive background noise (street/market-like, various SNR)
  - Phone-codec simulation (band-pass filter approximating GSM bandwidth)
  - Reverb (simulating a room/street rather than a close mic)

Usage:
    python analysis/noise_robustness.py \
        --test-audio-dir /path/to/wavs \
        --refs data/test_split.json \
        --checkpoint-dir checkpoints/final
"""
import argparse
import json
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
import torch
import evaluate
from transformers import pipeline, WhisperForConditionalGeneration, WhisperProcessor
from peft import PeftModel

wer_metric = evaluate.load("wer")


def add_noise(audio, snr_db, rng):
    noise = rng.normal(0, 1, len(audio))
    sig_power = np.mean(audio ** 2)
    noise_power = sig_power / (10 ** (snr_db / 10))
    noise = noise * np.sqrt(noise_power / (np.mean(noise ** 2) + 1e-10))
    return audio + noise


def phone_bandlimit(audio, sr):
    # crude GSM-like band-limit: 300Hz–3400Hz
    from scipy.signal import butter, sosfilt
    sos = butter(4, [300, 3400], btype="band", fs=sr, output="sos")
    return sosfilt(sos, audio)


def simple_reverb(audio, sr, decay=0.3, delay_ms=50):
    delay_samples = int(sr * delay_ms / 1000)
    ir = np.zeros(delay_samples + 1)
    ir[0] = 1.0
    ir[-1] = decay
    return np.convolve(audio, ir, mode="full")[: len(audio)]


CONDITIONS = {
    "clean": lambda a, sr, rng: a,
    "noise_snr10": lambda a, sr, rng: add_noise(a, 10, rng),
    "noise_snr0": lambda a, sr, rng: add_noise(a, 0, rng),
    "phone_bandlimit": lambda a, sr, rng: phone_bandlimit(a, sr),
    "reverb": lambda a, sr, rng: simple_reverb(a, sr),
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--test-audio-dir", required=True)
    ap.add_argument("--refs", required=True)
    ap.add_argument("--checkpoint-dir", required=True)
    ap.add_argument("--base-model", default="openai/whisper-large-v2")
    ap.add_argument("--out", default="analysis/noise_robustness_results.json")
    args = ap.parse_args()

    dev = 0 if torch.cuda.is_available() else -1
    dtype = torch.float16 if dev == 0 else torch.float32

    base = WhisperForConditionalGeneration.from_pretrained(args.base_model, torch_dtype=dtype)
    model = PeftModel.from_pretrained(base, args.checkpoint_dir).to("cuda" if dev == 0 else "cpu")
    proc = WhisperProcessor.from_pretrained(args.base_model, language="nepali", task="transcribe")
    pipe = pipeline("automatic-speech-recognition", model=model, tokenizer=proc.tokenizer,
                     feature_extractor=proc.feature_extractor, torch_dtype=dtype, device=dev)

    test_data = json.load(open(args.refs, encoding="utf-8"))
    audio_dir = Path(args.test_audio_dir)
    rng = np.random.default_rng(42)

    results = {}
    for cond_name, fn in CONDITIONS.items():
        preds, refs = [], []
        for d in test_data:
            wav_path = audio_dir / Path(d["path"]).name
            audio, sr = librosa.load(wav_path, sr=16000)
            degraded = fn(audio, sr, rng).astype(np.float32)
            out = pipe(degraded, generate_kwargs={"language": "nepali", "task": "transcribe"})
            preds.append(out["text"].strip())
            refs.append(d["sentence"])

        pn = [" ".join(p.lower().split()) for p in preds]
        rn = [" ".join(r.lower().split()) for r in refs]
        wer = 100 * wer_metric.compute(predictions=pn, references=rn)
        results[cond_name] = {"WER": round(wer, 2)}
        print(f"{cond_name:20s} WER={wer:.2f}%")

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    json.dump(results, open(args.out, "w", encoding="utf-8"), indent=2)
    print(f"\nSaved to {args.out}")
    print("This table is your robustness section — report degradation relative to")
    print("'clean' rather than absolute numbers, since absolute WER under heavy noise")
    print("is expected to be high for any model.")


if __name__ == "__main__":
    main()
