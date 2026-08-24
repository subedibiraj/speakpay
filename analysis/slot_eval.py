"""
SpeakPay  -  task-level evaluation: Transaction Success Rate (TSR).

Core idea: WER treats every word error equally, but in a financial voice
transaction a wrong filler word is harmless and a wrong amount digit is a
real-money failure. This script ports the rule-based slot parser from
app/src/lib/nlp.ts to Python and uses it to score ASR output at the task
level, not the word level.

NOTE ON NOVELTY (read before writing this up as a contribution): this is
NOT a new metric. "Transaction Success Rate" below is, by construction,
Interpretation Error Rate (IRER) as defined in the SLU literature  -  an
utterance-level, no-partial-credit metric for joint intent+slot correctness
(Fu et al. 2022, arXiv:2204.00558; see also Kim et al. 2021 "SemDist",
Interspeech). Cite that work and use their terminology (report "1 - IRER"
or rename this variable to match) rather than presenting TSR as invented.
The actual contribution is applying task-level SLU evaluation to a
low-resource-language, accessibility-focused, financial-safety context
where nobody has done this measurement before  -  quantifying the WER-vs-IRER
gap for THIS system is the finding, not the existence of the metric.

Ground truth is derived by parsing the REFERENCE transcript with the same
parser (state this assumption explicitly in the paper  -  it measures whether
ASR errors change the parsed outcome, not absolute parser correctness).

Metrics reported, for each model:
  - Intent accuracy       (predicted action == reference action)
  - Amount exact-match    (only where reference has an amount)
  - Recipient match       (only where reference has a recipient; normalized)
  - Transaction Success Rate (ALL applicable slots correct  -  the headline
    number: "would this transcript have executed the intended transaction")

Usage:
    python analysis/slot_eval.py \
        --results training/benchmark_results.json \
        --refs data/test_split.json
"""
import argparse
import json
import re
import sys
from pathlib import Path

if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

NEP_DIGIT = {c: str(i) for i, c in enumerate("०१२३४५६७८९")}
NEP_WORD_DIGIT = {
    "शून्य": "0", "सुन्ना": "0",
    "एक": "1", "एउटा": "1",
    "दुई": "2", "दुइ": "2",
    "तीन": "3", "तिन": "3",
    "चार": "4",
    "पाँच": "5", "पांच": "5",
    "छ": "6",
    "सात": "7",
    "आठ": "8",
    "नौ": "9", "नऊ": "9",
}
FEATURES = {
    "send": ["पठाउ", "पठाउनुहोस्", "पठा", "ट्रान्सफर", "transfer", "send", "लाई", "को खातामा"],
    "load": ["लोड", "load", "जम्मा", "थप", "हाल", "deposit", "topup", "खातामा हाल"],
    "balance": ["ब्यालेन्स", "balance", "बाँकी", "कति छ", "खाता हेर", "जाँच", "check"],
}


def normalize_for_digits(text):
    s = "".join(NEP_DIGIT.get(c, c) for c in text)
    for word, digit in NEP_WORD_DIGIT.items():
        s = s.replace(word, digit)
    return re.sub(r"\s+", "", s)


def extract_amount(text):
    normalized = normalize_for_digits(text)
    nums = [int(m) for m in re.findall(r"\d+", normalized)]
    nums = [n for n in nums if 0 < n <= 10_000_000]
    return max(nums) if nums else None


def extract_recipient(text):
    m = re.search(r"9[6-9]\d{8}", normalize_for_digits(text))
    if m:
        return m.group(0)
    for pattern in [r"(\S+(?:\s+\S+)?)\s*लाई", r"(\S+(?:\s+\S+)?)\s*को\s+(?:खाता|इसेवा|ईसेवा|खल्ती)"]:
        m = re.search(pattern, text)
        if m and len(m.group(1)) > 1 and not re.match(r"^[0-9]+$", m.group(1)):
            return m.group(1).strip()
    return None


def classify(text):
    t = text.lower()
    scores = {k: 0.0 for k in FEATURES}
    for action, kws in FEATURES.items():
        for kw in kws:
            if kw.lower() in t:
                scores[action] += 2 if len(kw) > 4 else 1
    if extract_recipient(text):
        scores["send"] += 1.5
    if extract_amount(text) and not extract_recipient(text):
        scores["load"] += 0.5
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "unknown"


def parse_intent(transcript):
    t = transcript.strip()
    if re.search(r"ब्यालेन्स|बाँकी\s*कति|खाता\s*हेर", t):
        return {"action": "balance"}
    if re.search(r"(?:लोड|जम्मा|हाल|थप|deposit|topup)", t):
        amount = extract_amount(t)
        if amount:
            return {"action": "load", "amount": amount}
    if re.search(r"पठाउ|पठाइ|ट्रान्सफर|transfer|send", t):
        amount, recipient = extract_amount(t), extract_recipient(t)
        if amount:
            return {"action": "send", "amount": amount, "recipient": recipient or "unknown"}
    return {"action": classify(t), "amount": extract_amount(t), "recipient": extract_recipient(t)}


def score_pair(pred_text, ref_text):
    pred, ref = parse_intent(pred_text), parse_intent(ref_text)
    intent_ok = pred["action"] == ref["action"]
    amount_ok = ref.get("amount") is None or pred.get("amount") == ref.get("amount")
    recipient_ok = ref.get("recipient") is None or pred.get("recipient") == ref.get("recipient")
    return {
        "intent_ok": intent_ok,
        "amount_ok": amount_ok if ref.get("amount") is not None else None,
        "recipient_ok": recipient_ok if ref.get("recipient") is not None else None,
        "transaction_success": intent_ok and amount_ok and recipient_ok,
    }


def evaluate_model(preds, refs):
    scored = [score_pair(p, r) for p, r in zip(preds, refs)]
    n = len(scored)
    amt_relevant = [s for s in scored if s["amount_ok"] is not None]
    rcp_relevant = [s for s in scored if s["recipient_ok"] is not None]
    return {
        "n": n,
        "intent_accuracy_pct": round(100 * sum(s["intent_ok"] for s in scored) / n, 2),
        "amount_exact_match_pct": round(100 * sum(s["amount_ok"] for s in amt_relevant) / len(amt_relevant), 2) if amt_relevant else None,
        "recipient_match_pct": round(100 * sum(s["recipient_ok"] for s in rcp_relevant) / len(rcp_relevant), 2) if rcp_relevant else None,
        "transaction_success_rate_pct": round(100 * sum(s["transaction_success"] for s in scored) / n, 2),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--results", required=True)
    ap.add_argument("--refs", required=True)
    ap.add_argument("--out", default="analysis/slot_eval_results.json")
    args = ap.parse_args()

    results = json.load(open(args.results, encoding="utf-8"))
    refs = [d["sentence"] for d in json.load(open(args.refs, encoding="utf-8"))]

    out = {}
    for r in results:
        if "predictions" not in r:
            continue
        out[r["model"]] = {"WER": r.get("WER"), **evaluate_model(r["predictions"], refs)}

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    json.dump(out, open(args.out, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    print(json.dumps(out, indent=2, ensure_ascii=False))
    print(f"\nSaved to {args.out}")
    print("\nThe headline comparison to put in the paper: WER delta vs. TSR delta between")
    print("zero-shot and domain-adapted rows above. If TSR improves proportionally more")
    print("than WER improves, that's your core finding: word-level metrics understate")
    print("task-level impact for slot-critical applications.")


if __name__ == "__main__":
    main()
