"""
SpeakPay  -  plot data efficiency learning curve.

Generates Figure 1 of the technical report: a dual-axis plot showing
WER (decreasing) and Transaction Success Rate (increasing) as a
function of training set size.

Usage:
    python analysis/plot_learning_curve.py \
        --data analysis/data_efficiency_results.json \
        --out report/figures/learning_curve.pdf
"""
import argparse
import json
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt


def main():
    ap = argparse.ArgumentParser(description="Plot data efficiency learning curve")
    ap.add_argument("--data", default="analysis/data_efficiency_results.json",
                    help="Path to data efficiency results JSON")
    ap.add_argument("--out", default="report/figures/learning_curve.pdf",
                    help="Output figure path (.pdf or .png)")
    args = ap.parse_args()

    with open(args.data, encoding="utf-8") as f:
        data = json.load(f)

    n_train = [0] + [d["n_train"] for d in data]
    wer = [129.95] + [d["WER"] for d in data]
    tsr = [1.67] + [d["Transaction_Success_Rate"] for d in data]

    fig, ax1 = plt.subplots(figsize=(7, 4.5))

    color_wer = "#2166ac"
    color_tsr = "#b2182b"

    ax1.set_xlabel("Training examples ($N$)", fontsize=12)
    ax1.set_ylabel("WER (%)", color=color_wer, fontsize=12)
    line1, = ax1.plot(n_train, wer, "o-", color=color_wer, linewidth=2,
                      markersize=7, label="WER")
    ax1.tick_params(axis="y", labelcolor=color_wer)
    ax1.set_ylim(0, 140)

    ax2 = ax1.twinx()
    ax2.set_ylabel("Transaction Success Rate (%)", color=color_tsr, fontsize=12)
    line2, = ax2.plot(n_train, tsr, "s--", color=color_tsr, linewidth=2,
                      markersize=7, label="TSR")
    ax2.tick_params(axis="y", labelcolor=color_tsr)
    ax2.set_ylim(0, 50)

    ax1.axhline(y=129.95, color=color_wer, linestyle=":", alpha=0.4, linewidth=1)
    ax1.text(210, 132, "Zero-shot WER", color=color_wer, fontsize=9, alpha=0.6)

    lines = [line1, line2]
    labels = [l.get_label() for l in lines]
    ax1.legend(lines, labels, loc="center right", fontsize=11)

    ax1.set_xticks(n_train)
    ax1.set_xticklabels(
        ["0\n(zero-shot)", "50", "100", "150", "200", "300", "403\n(full)"],
        fontsize=9,
    )

    ax1.grid(True, alpha=0.3)
    plt.title("Data Efficiency: Learning Curve", fontsize=13,
              fontweight="bold", pad=12)
    plt.tight_layout()
    plt.savefig(args.out, dpi=300, bbox_inches="tight")
    print(f"Saved {args.out}")


if __name__ == "__main__":
    main()
