"""
SpeakPay  -  duplicate-transcript leakage check.

403 utterances is small enough that a handful of exact-duplicate
transcripts (different audio takes of the same sentence) can leak across
train/test if the split is a plain random shuffle. This flags any case
where a transcript's occurrences land in more than one split, so you can
either move them into the same split or note it as negligible if the
audio is meaningfully different (e.g. different speakers reading the same
prompt is fine  -  that's the split unit that matters, once speaker IDs
exist; this catches the word-sequence-level version of the same problem).

Usage:
    python data/check_duplicate_leakage.py \
        --train data/train_split.json --val data/val_split.json --test data/test_split.json
(or point at whatever your current split files are named)
"""
import argparse
import json
from collections import defaultdict


def normalize(t):
    return " ".join(t.lower().split())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--train", required=True)
    ap.add_argument("--val", required=True)
    ap.add_argument("--test", required=True)
    args = ap.parse_args()

    splits = {}
    for name, path in [("train", args.train), ("val", args.val), ("test", args.test)]:
        data = json.load(open(path, encoding="utf-8"))
        key = "sentence" if "sentence" in data[0] else "transcript"
        splits[name] = [normalize(d[key]) for d in data]

    location = defaultdict(set)
    for split_name, transcripts in splits.items():
        for t in transcripts:
            location[t].add(split_name)

    leaked = {t: splits_seen for t, splits_seen in location.items() if len(splits_seen) > 1}

    print(f"Checked {sum(len(v) for v in splits.values())} utterances across "
          f"{', '.join(f'{k}={len(v)}' for k, v in splits.items())}")
    if not leaked:
        print("\nNo duplicate transcripts found across splits. Clean.")
    else:
        print(f"\n{len(leaked)} transcript(s) appear in more than one split:")
        for t, splits_seen in leaked.items():
            print(f"  {sorted(splits_seen)}: \"{t}\"")
        print("\nFix: move all occurrences of each flagged transcript into the same split")
        print("before retraining/re-benchmarking.")


if __name__ == "__main__":
    main()
