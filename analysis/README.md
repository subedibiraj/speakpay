# Analysis

Evaluation and analysis scripts for the SpeakPay ASR experiments. All scripts use `argparse` and produce structured JSON output.

## Scripts

| Script | Purpose | Output |
|---|---|---|
| `paired_stats.py` | Bootstrap CI + sign test (per-utterance comparison) | `paired_stats_results.json` |
| `slot_eval.py` | Task-level evaluation: intent, amount, recipient accuracy, TSR | `slot_eval_results.json` |
| `noise_robustness.py` | WER under simulated acoustic degradations | `noise_robustness_results.json` |
| `error_analysis.py` | Numeral confusion pattern analysis | `error_analysis_results.json` |
| `plot_learning_curve.py` | Generate data efficiency learning curve figure | `../report/figures/learning_curve.pdf` |
| `iaa_agreement.py` | Inter-annotator agreement (requires second annotator) |  -  |

## Usage

```bash
# Statistical significance
python analysis/paired_stats.py --results training/benchmark_results.json

# Task-level slot evaluation
python analysis/slot_eval.py --results training/benchmark_results.json --refs training/data/test_split.json

# Acoustic robustness sweep
python analysis/noise_robustness.py --audio-dir data/audio/test --refs training/data/test_split.json

# Numeral error analysis
python analysis/error_analysis.py --results training/benchmark_results.json --refs training/data/test_split.json

# Learning curve plot
python analysis/plot_learning_curve.py --data analysis/data_efficiency_results.json
```
