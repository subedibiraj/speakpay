import json
import re
from collections import Counter
from pathlib import Path
import sys

if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

RESULTS_FILE = Path("training/benchmark_results.json")
if not RESULTS_FILE.exists():
    print("Benchmark results not found.")
    sys.exit(1)

with open(RESULTS_FILE, encoding="utf-8") as f:
    results = json.load(f)

ours = next((r for r in results if "ours" in r["model"].lower() or "lora" in r["model"].lower()), None)
if not ours:
    print("Ours model not found in benchmark.")
    sys.exit(1)

TEST_FILE = Path("training/data/test_split.json")
with open(TEST_FILE, encoding="utf-8") as f:
    refs = json.load(f)

NEP_NUM = re.compile(r"[०-९_]+")

def extract_numbers(text):
    return NEP_NUM.findall(text)

print("=== Digit/Amount Error Analysis ===")
confusions = []
for p, ref_dict in zip(ours["predictions"], refs):
    r = ref_dict["sentence"]
    ref_nums = extract_numbers(r)
    pred_nums = extract_numbers(p)
    
    if len(ref_nums) == 1 and len(pred_nums) == 1:
        if ref_nums[0] != pred_nums[0]:
            confusions.append((ref_nums[0], pred_nums[0]))

print(f"Found {len(confusions)} straightforward 1-to-1 number confusions:")
counter = Counter(confusions)
for (ref_n, pred_n), count in counter.most_common():
    print(f"  {ref_n} was transcribed as {pred_n} ({count} times)")

if not confusions:
    print("No simple 1-to-1 confusions found.")
