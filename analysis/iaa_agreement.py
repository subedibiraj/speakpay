"""
SpeakPay — inter-annotator agreement (IAA) for the transcript dataset.

Addresses the "single annotator" reviewer objection: have a second person
independently transcribe a random subset (50 utterances is a reasonable
minimum for a paper this size), then run this script.

Two complementary numbers are reported, because plain Cohen's kappa doesn't
translate cleanly to free-text transcription:
  1. Exact-match agreement rate (normalized: lowercased, whitespace-collapsed)
  2. Mean WER between the two annotators' transcripts (annotator-vs-annotator,
     same metric used for model evaluation, so it's directly comparable to
     model WER — e.g. "human WER" gives a rough upper bound on achievable
     ASR performance)

Input format (JSON list), one file per annotator, aligned by index or by
a shared "audio" id:
    [{"audio": "audio1", "transcript": "..."}, ...]

Usage:
    python analysis/iaa_agreement.py \
        --annotator-a data/iaa_subset_annotator_a.json \
        --annotator-b data/iaa_subset_annotator_b.json
"""
import argparse
import json

import evaluate

wer_metric = evaluate.load("wer")


def normalize(s):
    return " ".join(s.lower().split())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--annotator-a", required=True)
    ap.add_argument("--annotator-b", required=True)
    ap.add_argument("--out", default="analysis/iaa_results.json")
    args = ap.parse_args()

    a = {d["audio"]: d["transcript"] for d in json.load(open(args.annotator_a, encoding="utf-8"))}
    b = {d["audio"]: d["transcript"] for d in json.load(open(args.annotator_b, encoding="utf-8"))}

    shared = sorted(set(a) & set(b))
    if not shared:
        raise SystemExit("No overlapping audio IDs between the two annotator files — check alignment.")
    if len(shared) < len(a) or len(shared) < len(b):
        print(f"Warning: only {len(shared)} of {len(a)}/{len(b)} utterances overlap; scoring the overlap only.")

    exact_matches = 0
    wers = []
    mismatches = []
    for audio_id in shared:
        ta, tb = normalize(a[audio_id]), normalize(b[audio_id])
        if ta == tb:
            exact_matches += 1
        else:
            mismatches.append({"audio": audio_id, "annotator_a": a[audio_id], "annotator_b": b[audio_id]})
        wers.append(100 * wer_metric.compute(predictions=[ta], references=[tb]))

    out = {
        "n_compared": len(shared),
        "exact_match_rate_pct": round(100 * exact_matches / len(shared), 2),
        "mean_inter_annotator_wer_pct": round(sum(wers) / len(wers), 2),
        "n_mismatches": len(mismatches),
        "sample_mismatches": mismatches[:10],
    }

    json.dump(out, open(args.out, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    print(json.dumps({k: v for k, v in out.items() if k != "sample_mismatches"}, indent=2, ensure_ascii=False))
    print(f"\nSaved full results (incl. mismatch examples) to {args.out}")
    print("\nSuggested report sentence:")
    print(f'  "On a {out[\"n_compared\"]}-utterance double-annotated subset, exact-match agreement was '
          f'{out[\"exact_match_rate_pct\"]}% (inter-annotator WER {out[\"mean_inter_annotator_wer_pct\"]}%)."')


if __name__ == "__main__":
    main()
