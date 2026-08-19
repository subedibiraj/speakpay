"""
SpeakPay — paired statistical analysis for the zero-shot vs. domain-adapted
comparison. Fills the reproducibility gap: this is the script that SHOULD
have produced data/intent_breakdown_analysis.json, so the sign test and
per-utterance numbers in the report can be independently re-run.

Input:  benchmark_results.json produced by training/scripts/04_benchmark.py
        (must contain "predictions" list for the zero-shot and LoRA runs,
        in the same order as data/test_split.json references)
Output: analysis/paired_stats_results.json — sign test + bootstrap CIs,
        ready to cite directly in the report.

Usage:
    python analysis/paired_stats.py \
        --results training/benchmark_results.json \
        --refs data/test_split.json \
        --n-boot 10000
"""
import argparse
import json
import random
import sys
from pathlib import Path

if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

import evaluate
from scipy.stats import binomtest

wer_metric = evaluate.load("wer")


def per_utterance_wer(preds, refs):
    """WER computed independently per utterance (not corpus-level)."""
    out = []
    for p, r in zip(preds, refs):
        p_n = " ".join(p.lower().split())
        r_n = " ".join(r.lower().split())
        out.append(100 * wer_metric.compute(predictions=[p_n], references=[r_n]))
    return out


def sign_test(wer_zs, wer_ours):
    improved = sum(1 for a, b in zip(wer_zs, wer_ours) if b < a)
    worse = sum(1 for a, b in zip(wer_zs, wer_ours) if b > a)
    tied = len(wer_zs) - improved - worse
    n = improved + worse
    p = binomtest(improved, n, 0.5, alternative="two-sided").pvalue if n else float("nan")
    return {"improved": improved, "worse": worse, "tied": tied, "n_nontied": n, "p_value": p}


def bootstrap_ci(values, n_boot=10000, alpha=0.05, seed=42):
    """Percentile bootstrap CI on the mean of per-utterance values."""
    rng = random.Random(seed)
    n = len(values)
    means = []
    for _ in range(n_boot):
        sample = [values[rng.randrange(n)] for _ in range(n)]
        means.append(sum(sample) / n)
    means.sort()
    lo = means[int((alpha / 2) * n_boot)]
    hi = means[int((1 - alpha / 2) * n_boot)]
    return {"mean": sum(values) / n, "ci_lower": lo, "ci_upper": hi, "n_boot": n_boot}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--results", required=True, help="benchmark_results.json from 04_benchmark.py")
    ap.add_argument("--refs", required=True, help="test_split.json with ground-truth 'sentence' field")
    ap.add_argument("--zs-name", default="Whisper large-v2 (zero-shot)")
    ap.add_argument("--ours-name", default="Whisper + LoRA (NepFinSpeech — ours)")
    ap.add_argument("--n-boot", type=int, default=10000)
    ap.add_argument("--out", default="analysis/paired_stats_results.json")
    args = ap.parse_args()

    results = {r["model"]: r for r in json.load(open(args.results, encoding="utf-8"))}
    refs = [d["sentence"] for d in json.load(open(args.refs, encoding="utf-8"))]

    preds_zs = results[args.zs_name]["predictions"]
    preds_ours = results[args.ours_name]["predictions"]
    assert len(preds_zs) == len(preds_ours) == len(refs), "length mismatch — check test split alignment"

    wer_zs = per_utterance_wer(preds_zs, refs)
    wer_ours = per_utterance_wer(preds_ours, refs)
    diffs = [a - b for a, b in zip(wer_zs, wer_ours)]  # positive = improvement

    out = {
        "sign_test": sign_test(wer_zs, wer_ours),
        "wer_reduction_bootstrap_ci": bootstrap_ci(diffs, args.n_boot),
        "zero_shot_wer_bootstrap_ci": bootstrap_ci(wer_zs, args.n_boot),
        "domain_adapted_wer_bootstrap_ci": bootstrap_ci(wer_ours, args.n_boot),
    }

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)

    print(json.dumps(out, indent=2, ensure_ascii=False))
    print(f"\nSaved to {args.out}")
    print("\nSuggested report sentence:")
    ci = out["domain_adapted_wer_bootstrap_ci"]
    print(f'  "...WER of {ci["mean"]:.2f}% (95% bootstrap CI [{ci["ci_lower"]:.2f}, {ci["ci_upper"]:.2f}])..."')


if __name__ == "__main__":
    main()
