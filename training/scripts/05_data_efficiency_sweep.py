"""
SpeakPay — Step 5: Data-efficiency sweep.

Answers a question that matters to every low-resource-language practitioner,
not just Nepali/finance: "how much domain data do you actually need before
LoRA domain adaptation pays off?" Retrains at increasing dataset sizes and
records WER + Transaction Success Rate at each point, producing a learning
curve instead of a single number.

THIS IS A LONG-RUNNING SCRIPT — budget for N_SIZES x normal training time.
Run it as its own session; it's independent of everything else in Tier 1/2.

Requires: training/scripts/03_train.py and 04_benchmark.py already working
(i.e. the general-baseline fix from Tier 1 is not a prerequisite for this,
they're independent).

Usage:
    python training/scripts/05_data_efficiency_sweep.py \
        --full-data data/dataset_pairs.json \
        --sizes 50 100 150 200 300 403 \
        --seed 42
"""
import argparse
import json
import random
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sizes", type=int, nargs="+", default=[50, 100, 150, 200, 300, 403])
    ap.add_argument("--out", default="analysis/data_efficiency_results.json")
    args = ap.parse_args()

    results = []

    for n in args.sizes:
        print(f"\n{'=' * 60}\nTraining on {n} examples\n{'=' * 60}")
        checkpoint_dir = ROOT / "checkpoints" / f"sweep_n{n}"

        subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "03_train.py"),
             "--n-train", str(n),
             "--output-dir", str(checkpoint_dir)],
            check=True,
        )
        subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "04_benchmark.py"),
             "--checkpoint-dir", str(checkpoint_dir),
             "--out", str(ROOT / f"benchmark_results_n{n}.json")],
            check=True,
        )

        bench = json.load(open(ROOT / f"benchmark_results_n{n}.json", encoding="utf-8"))
        ours = next(r for r in bench if "ours" in r["model"].lower() or "lora" in r["model"].lower())
        results.append({"n_train": n, "WER": ours["WER"], "CER": ours["CER"]})
        print(f"  n={n}: WER={ours['WER']}%  CER={ours['CER']}%")

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    json.dump(results, open(args.out, "w", encoding="utf-8"), indent=2)
    print(f"\nSaved learning curve to {args.out}")
    print("\nPlot n_train (x) vs WER (y) — this figure is the paper's second headline result.")
    print("Also worth running slot_eval.py on each benchmark_results_n{N}.json for a")
    print("second curve: n_train vs Transaction Success Rate.")


if __name__ == "__main__":
    main()
