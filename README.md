# SpeakPay

**Voice-first eWallet for visually impaired individuals**
*Research project, Tribhuvan University / Advanced College of Engineering and Management, 2026*

[![CI](https://github.com/subedibiraj/speakpay/actions/workflows/ci.yml/badge.svg)](https://github.com/subedibiraj/speakpay/actions)
[![arXiv](https://img.shields.io/badge/arXiv-2609.01737-b31b1b.svg)](https://arxiv.org/abs/2609.01737)
[![Live Demo](https://img.shields.io/badge/Live_Demo-speakpay.biraj--subedi.com.np-0F7173)](https://speakpay.biraj-subedi.com.np)
[![Dataset](https://img.shields.io/badge/🤗_Dataset-NepFinSpeech-yellow)](https://huggingface.co/datasets/birajsubedi/NepFinSpeech)
[![Model](https://img.shields.io/badge/🤗_Model-Whisper_LoRA-yellow)](https://huggingface.co/birajsubedi/whisper-large-v2-nepali-financial)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

SpeakPay lets visually impaired users manage a digital wallet entirely
through spoken Nepali. No screen reading, no visual navigation
required. The research contribution is **NepFinSpeech-403**, the first
domain-specific Nepali financial speech dataset, and a LoRA fine-tune
of Whisper large-v2 that significantly improves number recognition
accuracy on financial utterances over both the zero-shot baseline and
general-domain fine-tunes.

## Repository structure

```
speakpay/
├── app/         Next.js web application (frontend + API + Supabase schema)
├── training/    LoRA fine-tuning pipeline (5 sequential Python scripts)
├── data/        NepFinSpeech-403 dataset + reproducibility scripts
├── analysis/    Evaluation scripts (statistical tests, slot eval, robustness, plots)
├── report/      Paper (LaTeX source, figures, compiled PDF)
├── docs/        Architecture, deployment guide, dataset card
└── .github/     CI workflow
```

Each top-level folder has its own README with detailed instructions.
Start here, then drill into whichever part you need:

| I want to... | Go to |
|---|---|
| Run the live app | [speakpay.biraj-subedi.com.np](https://speakpay.biraj-subedi.com.np) |
| Understand the system design | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Deploy my own instance | [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) |
| Reproduce the model training | [`training/README.md`](training/README.md) |
| Inspect/rebuild the dataset | [`data/README.md`](data/README.md) |
| Read the paper | [arXiv:2609.01737](https://arxiv.org/abs/2609.01737) |
| See benchmark results | [`docs/DATASET_CARD.md`](docs/DATASET_CARD.md) |

## Research findings

| Model | WER%↓ | CER%↓ | NumAcc%↑ |
|---|---|---|---|
| Whisper large-v2 (zero-shot) | 129.95 | 92.32 | 0.0 |
| Whisper small (general Nepali FT) | 106.32 | 63.48 | 0.0 |
| **NepFinSpeech LoRA (ours)** | **42.58** | **16.95** | **73.9** |

**67.2% relative WER reduction**, improvement on **59/60** individual test utterances (sign test, p = 3.5×10⁻¹⁸). Transaction Success Rate improved from 1.67% to 33.33%. Model holds up under GSM phone band-limiting (46.70% WER). Data efficiency sweep shows usable adaptation with as few as 100 utterances. Full analysis in the paper and the `analysis/` directory.

## Tech stack

- **Frontend / Backend**: Next.js 14 (App Router) on Vercel
- **Database + Auth**: Supabase (Postgres + Row Level Security)
- **ASR**: Whisper large-v2 + LoRA, served via HF Inference API
- **NLP**: Two-stage rule + confidence-scored intent parser (no
  separate trained classifier; see `docs/ARCHITECTURE.md` for why)
- **Training**: PyTorch + 🤗 PEFT, runs on a single consumer GPU (RTX 3060 / Colab T4)

## Quick start

```bash
git clone https://github.com/subedibiraj/speakpay
cd speakpay/app
cp .env.local.example .env.local   # fill in Supabase + HF credentials
npm install
npm test                            # run NLP parser unit tests
npm run dev                         # http://localhost:3000
```

Full deployment instructions (Supabase setup, model training, Vercel
deploy): see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Dataset: NepFinSpeech-403

403 transcribed Nepali financial voice commands: 193 send-money
commands, 61 balance queries, 56 load commands, 93 other financial
utterances, spanning 237 unique Nepali numerals.

Source data and full reproducibility pipeline in [`data/`](data/).
Published dataset: [huggingface.co/datasets/birajsubedi/NepFinSpeech](https://huggingface.co/datasets/birajsubedi/NepFinSpeech)

## Citation

```bibtex
@misc{subedi2026speakpay,
  title         = {SpeakPay: Domain-Adaptive LoRA Fine-Tuning of Whisper for
                   Low-Resource Nepali Financial Speech Recognition},
  author        = {Subedi, Biraj},
  year          = {2026},
  eprint        = {2609.01737},
  archivePrefix = {arXiv},
  primaryClass  = {cs.CL},
  url           = {https://arxiv.org/abs/2609.01737}
}
```

## License

Code: [MIT](LICENSE). Dataset: CC-BY 4.0 (see [`data/README.md`](data/README.md)).
