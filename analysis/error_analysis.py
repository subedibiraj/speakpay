"""
SpeakPay — numeral/amount error analysis.

Identifies systematic digit confusion patterns in the domain-adapted
model's predictions by comparing predicted vs reference numerals in
each test utterance. Reports one-to-one confusions grouped by error type.

Usage:
    python analysis/error_analysis.py \
        --results training/benchmark_results.json \
        --refs training/data/test_split.json
"""
import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

NEP_NUM = re.compile(r"[०-९_]+")


def extract_numbers(text):
    return NEP_NUM.findall(text)


def main():
    ap = argparse.ArgumentParser(description="Numeral confusion analysis")
    ap.add_argument("--results", required=True, help="Path to benchmark_results.json")
    ap.add_argument("--refs", required=True, help="Path to test_split.json")
    ap.add_argument("--out", default="analysis/error_analysis_results.json",
                    help="Output JSON path")
    args = ap.parse_args()

    with open(args.results, encoding="utf-8") as f:
        results = json.load(f)

    ours = next(
        (r for r in results if "ours" in r["model"].lower() or "lora" in r["model"].lower()),
        None,
    )
    if not ours:
        print("Domain-adapted model not found in benchmark results.")
        sys.exit(1)

    with open(args.refs, encoding="utf-8") as f:
        refs = json.load(f)

    confusions = []
    for pred, ref_dict in zip(ours["predictions"], refs):
        ref_text = ref_dict["sentence"]
        ref_nums = extract_numbers(ref_text)
        pred_nums = extract_numbers(pred)

        if len(ref_nums) == 1 and len(pred_nums) == 1:
            if ref_nums[0] != pred_nums[0]:
                confusions.append((ref_nums[0], pred_nums[0]))

    print(f"=== Digit/Amount Error Analysis ===")
    print(f"Found {len(confusions)} one-to-one number confusions:")
    counter = Counter(confusions)
    for (ref_n, pred_n), count in counter.most_common():
        print(f"  {ref_n} -> {pred_n} ({count}x)")

    if not confusions:
        print("No simple one-to-one confusions found.")

    output = {
        "n_confusions": len(confusions),
        "confusions": [{"ref": r, "pred": p, "count": c}
                       for (r, p), c in counter.most_common()],
    }
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"\nSaved to {args.out}")


if __name__ == "__main__":
    main()
