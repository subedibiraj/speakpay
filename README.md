# SpeakPay

**AI-assisted voice-first eWallet for visually impaired individuals**
*Research project — Tribhuvan University / Advanced College of Engineering and Management, 2025*

[![CI](https://github.com/YOUR_USERNAME/speakpay/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/speakpay/actions)
[![Live Demo](https://img.shields.io/badge/Live_Demo-speakpay.vercel.app-0F7173)](https://speakpay.vercel.app)
[![Dataset](https://img.shields.io/badge/🤗_Dataset-NepFinSpeech-yellow)](https://huggingface.co/datasets/YOUR_USERNAME/NepFinSpeech)
[![Model](https://img.shields.io/badge/🤗_Model-Whisper_LoRA-yellow)](https://huggingface.co/YOUR_USERNAME/whisper-large-v2-nepali-financial)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

SpeakPay lets visually impaired users manage a digital wallet entirely
through spoken Nepali — no screen reading, no visual navigation
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
├── paper/       LaTeX research paper (Interspeech format)
├── docs/        Architecture, deployment guide, dataset card
└── .github/     CI workflow
```

Each top-level folder has its own README with detailed instructions.
Start here, then drill into whichever part you need:

| I want to... | Go to |
|---|---|
| Run the live app | [speakpay.vercel.app](https://speakpay.vercel.app) |
| Understand the system design | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Deploy my own instance | [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) |
| Reproduce the model training | [`training/README.md`](training/README.md) |
| Inspect/rebuild the dataset | [`data/README.md`](data/README.md) |
| Read the research paper | [`paper/main.tex`](paper/main.tex) (compile in Overleaf) |
| See benchmark results | [`docs/DATASET_CARD.md`](docs/DATASET_CARD.md) |

## Research findings

| Model | WER↓ | NumAcc↑ |
|---|---|---|
| Whisper large-v2 (zero-shot) | 47.1% | — |
| General Nepali fine-tune | TBD | — |
| **NepFinSpeech LoRA (ours)** | **TBD** | **TBD** |

*Fill in after running `training/scripts/04_benchmark.py`.*

## Tech stack

- **Frontend / Backend**: Next.js 14 (App Router) on Vercel
- **Database + Auth**: Supabase (Postgres + Row Level Security)
- **ASR**: Whisper large-v2 + LoRA, served via HF Inference API
- **NLP**: Two-stage rule + confidence-scored intent parser (no
  separate trained classifier — see `docs/ARCHITECTURE.md` for why)
- **Training**: PyTorch + 🤗 PEFT, runs on a single consumer GPU (RTX 3060 / Colab T4)

## Quick start

```bash
git clone https://github.com/YOUR_USERNAME/speakpay
cd speakpay/app
cp .env.local.example .env.local   # fill in Supabase + HF credentials
npm install
npm test                            # run NLP parser unit tests
npm run dev                         # http://localhost:3000
```

Full deployment instructions (Supabase setup, model training, Vercel
deploy): see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Dataset: NepFinSpeech-403

403 transcribed Nepali financial voice commands — 193 send-money
commands, 61 balance queries, 56 load commands, 93 other financial
utterances, spanning 237 unique Nepali numerals.

Source data and full reproducibility pipeline in [`data/`](data/).
Published dataset: [huggingface.co/datasets/YOUR_USERNAME/NepFinSpeech](https://huggingface.co/datasets/YOUR_USERNAME/NepFinSpeech)

## Citation

```bibtex
@misc{speakpay2025,
  title   = {SpeakPay: Domain-Adaptive LoRA Fine-Tuning of Whisper for
             Low-Resource Nepali Financial Speech Recognition},
  author  = {YOUR NAME},
  year    = {2025},
  url     = {https://github.com/YOUR_USERNAME/speakpay}
}
```

## License

Code: [MIT](LICENSE). Dataset: CC-BY 4.0 (see [`data/README.md`](data/README.md)).
