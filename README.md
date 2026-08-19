# SpeakPay — Research Strengthening Bundle

Start with `MASTER_CHECKLIST.md` — it's the ordered task list (Tier 0
through Tier 4) that everything else in this bundle supports.

## How to use this with the SpeakPay repo

Unzip this alongside (or merge into) the `speakpay-master` repo root. The
folder structure mirrors it:

```
analysis/                       ← new, doesn't exist in repo yet
  paired_stats.py
  slot_eval.py
  iaa_agreement.py
  noise_robustness.py
data/
  speaker_disjoint_split.py     ← new
  check_duplicate_leakage.py    ← new
training/scripts/
  05_data_efficiency_sweep.py   ← new, follows 04_benchmark.py
report/
  new_refs_to_add.bib           ← merge into existing report/refs.bib
  REPOSITIONING_NOTES.md        ← read before editing report intro/related-work
docs/
  USER_STUDY_PROTOCOL.md        ← new
ethics_statement_draft.md       ← fill in and fold into report/speakpay_report.tex
MASTER_CHECKLIST.md             ← the actual task list, read this first
```

## Suggested agent instructions

If you're handing this to an autonomous coding agent (e.g. to execute
Tier 0/1 items), a reasonable prompt is:

> Work through MASTER_CHECKLIST.md in order, starting at Tier 0. For each
> Python script, read its docstring for exact usage before running it —
> several depend on outputs of earlier steps (e.g. paired_stats.py and
> slot_eval.py both need benchmark_results.json from a working
> 04_benchmark.py run first). Do not skip Tier 0 (speaker-leakage check)
> even though it's not code you write — it determines whether Tier 1's
> results are valid. Flag anywhere a script's assumptions (file names,
> JSON field names) don't match the actual repo state rather than silently
> guessing.
