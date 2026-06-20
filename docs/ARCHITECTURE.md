# Architecture

## System overview

SpeakPay has three independent, loosely-coupled parts that share the
NepFinSpeech dataset as their common artifact:

```
data/           — the dataset (source of truth)
   │
   ├──→ training/   — produces the fine-tuned ASR model
   │                  (consumed by app/ via Hugging Face Inference API)
   │
   └──→ app/        — the production web application
                       (consumes the model, not the raw data)

paper/          — documents both training/ and app/ for academic use
```

## Data flow at runtime

```
User speaks (browser microphone)
        │
        ▼
MediaRecorder captures audio/webm
        │
        ▼
POST /api/transcribe  (Next.js API route)
        │
        ▼
Hugging Face Inference API
  (Whisper large-v2 + LoRA adapter, hosted)
        │
        ▼
Transcript (Nepali text)
        │
        ▼
parseIntent()  (src/lib/nlp.ts — two-stage rule + classifier parser)
        │
        ▼
ParsedIntent { action, amount, recipient, confidence }
        │
        ├── confidence < 0.4 → ask user to repeat
        │
        ▼
Confirmation prompt (TTS speaks it back)
        │
        ▼
User confirms (voice or tap)
        │
        ▼
POST /api/wallet/send | /api/wallet/load
        │
        ▼
Supabase transfer_funds() — atomic SQL transaction
        │
        ▼
TTS confirms result to user
```

## Why these technology choices

**Next.js (not separate frontend/backend)**: API routes and pages in
one deployable unit means one Vercel project, one domain, simpler
CORS-free fetch calls between frontend and backend.

**Supabase (not a custom Postgres + Express setup)**: free tier
includes Row Level Security, a SQL editor, and instant REST/RPC
access — removes the need to write and host a separate API server
for the database layer.

**Hugging Face Inference API for the model (not self-hosted)**: the
LoRA adapter is ~60MB; HF's free Inference API serves it without
requiring SpeakPay to run its own GPU server. Trade-off: cold-start
latency (~20-30s) on the first request after inactivity — handled
client-side with retry + backoff (`src/lib/asr.ts`).

**LoRA (not full fine-tuning)**: 403 training samples is too small
to safely full-fine-tune a 1.55B parameter model without overfitting
or catastrophic forgetting of general speech ability. LoRA keeps the
base model frozen and trains ~8M parameters (<0.6%), which is both
more data-efficient and produces a much smaller artifact to host.

**Two-stage NLP (rules + classifier, not a trained intent model)**:
with only 403 labeled utterances, training a separate intent
classifier risks overfitting to surface patterns. A rule-first
approach with documented confidence scoring is more interpretable,
easier to debug for a thesis defense, and the explicit confidence
threshold (0.4) is a tunable, explainable safety mechanism for a
financial application.

## Key files

| File | Role |
|---|---|
| `app/src/lib/nlp.ts` | Intent parser — the "brain" that turns transcripts into actions |
| `app/src/lib/asr.ts` | ASR client — handles cold starts, retries, browser fallback |
| `app/src/hooks/useVoiceCommand.ts` | State machine for the entire voice interaction loop |
| `app/supabase_schema.sql` | Database schema + atomic transfer function |
| `training/scripts/03_train.py` | The actual LoRA fine-tuning loop |
| `training/scripts/04_benchmark.py` | Produces the core research result table |
| `data/extract_xlsb.py` | Reproducibility — regenerates the dataset from source |
