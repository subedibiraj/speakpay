"""
SpeakPay — speaker-disjoint train/val/test split.

Drop-in replacement for the relevant part of
training/scripts/02_prepare_features.py, once you have a speaker/contributor
ID per utterance (from the original collection platform's backend, if
recoverable — see analysis note in this session).

Guarantees no speaker appears in more than one split, so WER improvements
can't be partly attributed to the model recognizing a specific voice it saw
in training. Falls back to a warning (not a silent no-op) if the input
lacks speaker IDs, so this can't be run by accident on data without them.

Expected input format — same as nepfinspeech_dataset.json but with an
added "speaker_id" field per entry:
    [{"audio_id": "audio1", "url": "...", "transcript": "...",
      "speaker_id": "contributor_07"}, ...]

Usage:
    python data/speaker_disjoint_split.py \
        --data data/nepfinspeech_dataset_with_speakers.json \
        --test-frac 0.15 --val-frac 0.10 --seed 42
"""
import argparse
import json
import random
import sys
from collections import defaultdict
from pathlib import Path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--test-frac", type=float, default=0.15)
    ap.add_argument("--val-frac", type=float, default=0.10)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out-dir", default="data")
    args = ap.parse_args()

    data = json.load(open(args.data, encoding="utf-8"))
    if not data or "speaker_id" not in data[0]:
        sys.exit(
            "ERROR: input has no 'speaker_id' field. This script only runs on "
            "speaker-annotated data — if you don't have speaker IDs, do NOT "
            "fake a random-split result; report the limitation in the paper instead."
        )

    by_speaker = defaultdict(list)
    for d in data:
        by_speaker[d["speaker_id"]].append(d)

    speakers = list(by_speaker.keys())
    rng = random.Random(args.seed)
    rng.shuffle(speakers)

    n_speakers = len(speakers)
    n_test_spk = max(1, int(n_speakers * args.test_frac))
    n_val_spk = max(1, int(n_speakers * args.val_frac))

    test_speakers = set(speakers[:n_test_spk])
    val_speakers = set(speakers[n_test_spk:n_test_spk + n_val_spk])
    train_speakers = set(speakers[n_test_spk + n_val_spk:])

    train = [d for d in data if d["speaker_id"] in train_speakers]
    val = [d for d in data if d["speaker_id"] in val_speakers]
    test = [d for d in data if d["speaker_id"] in test_speakers]

    assert not (set(d["speaker_id"] for d in train) & set(d["speaker_id"] for d in test))
    assert not (set(d["speaker_id"] for d in val) & set(d["speaker_id"] for d in test))

    print(f"Speakers: {n_speakers} total -> {len(train_speakers)} train / "
          f"{len(val_speakers)} val / {len(test_speakers)} test")
    print(f"Utterances: {len(train)} train / {len(val)} val / {len(test)} test")

    out_dir = Path(args.out_dir)
    for name, split in [("train", train), ("val", val), ("test", test)]:
        json.dump(split, open(out_dir / f"{name}_split_speaker_disjoint.json", "w", encoding="utf-8"),
                   ensure_ascii=False, indent=2)
    print(f"\nSaved to {out_dir}/{{train,val,test}}_split_speaker_disjoint.json")
    print("Point training/scripts/02_prepare_features.py at these instead of re-shuffling.")


if __name__ == "__main__":
    main()
