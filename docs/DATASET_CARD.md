---
language:
- ne
license: cc-by-4.0
task_categories:
- automatic-speech-recognition
tags:
- nepali
- financial
- asr
- low-resource
- ewallet
pretty_name: NepFinSpeech
size_categories:
- n<1K
---

# NepFinSpeech — Nepali Financial Speech Dataset

## Dataset Description

**NepFinSpeech** is a domain-specific Automatic Speech Recognition (ASR)
dataset of **403 transcribed Nepali financial voice commands**, built as
part of the SpeakPay project — an AI-assisted eWallet for visually
impaired individuals.

This fills a gap in Nepali ASR resources: while general-purpose corpora
(OpenSLR, Common Voice) exist, none focus on the financial domain
specifically — the number-heavy utterances required for mobile payment
applications.

### Statistics

| Split | Samples | % |
|---|---|---|
| Train | 282 | 70% |
| Validation | 40 | 10% |
| Test | 61 | 15% |
| **Total** | **403** | **100%** |

| Intent | Count | % |
|---|---|---|
| Send money | 193 | 47.9% |
| Check balance | 61 | 15.1% |
| Load wallet | 56 | 13.9% |
| Other financial | 93 | 23.1% |

- **237 unique Nepali numerals** (Devanagari script)
- Amount range: single digits to 6-digit values

## Usage

```python
from datasets import load_dataset
ds = load_dataset("birajsubedi/NepFinSpeech")
# { 'audio': Audio, 'sentence': str }
```

## Source data

Audio collected via a purpose-built web data-collection platform.
Contributors recorded prompted financial phrases; transcripts were
manually verified. Contributors consented to release under CC-BY 4.0.

## Reproducibility

See `data/extract_xlsb.py` and `data/build_dataset.py` in the source
repository for the full extraction pipeline from the original
transcription spreadsheet.

## Citation

```bibtex
@misc{nepfinspeech2025,
  title   = {NepFinSpeech: A Domain-Specific Nepali Financial Speech Dataset},
  author  = {Biraj Subedi},
  year    = {2025},
  url     = {https://huggingface.co/datasets/birajsubedi/NepFinSpeech},
  license = {cc-by-4.0}
}
```
