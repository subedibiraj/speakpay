# Deployment Guide

Step-by-step to get SpeakPay fully live: trained model on Hugging Face,
database on Supabase, app on Vercel.

## Prerequisites

- GitHub account (to host this repo and connect to Vercel)
- Hugging Face account with a **Write**-permission access token
- Supabase account
- Vercel account
- Either a CUDA GPU locally, or Google Colab (free T4)

## 1. Train the model

See `training/README.md` for full detail. Summary:

```bash
cd training
python -m venv venv && source venv/bin/activate   # or venv\Scripts\activate on Windows
pip install -r requirements.txt
# Edit scripts/config.py  -  set HF_USERNAME
huggingface-cli login
cd scripts
python 01_prepare_data.py
python 02_prepare_features.py
python 03_train.py
python 04_benchmark.py
python 05_push_to_hub.py
```

At the end you'll have a model live at:
`https://huggingface.co/birajsubedi/whisper-large-v2-nepali-financial`

**Verify it's accessible**: visit the model page and confirm it shows
"Inference API" as available (not "cold" forever  -  first request
after inactivity takes 20-30s, this is normal for free tier).

## 2. Set up Supabase

1. [supabase.com/dashboard](https://supabase.com/dashboard) → New Project
2. SQL Editor → New query → paste contents of `app/supabase_schema.sql` → Run
3. Project Settings → API → copy:
   - Project URL
   - `anon` `public` key
   - `service_role` key (keep this secret)

## 3. Configure the app locally (to test before deploying)

```bash
cd app
cp .env.local.example .env.local
# Fill in all values in .env.local:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   SUPABASE_SERVICE_ROLE_KEY
#   JWT_SECRET          (generate: openssl rand -base64 32)
#   HF_TOKEN             (your HF token, Read permission is enough here)
#   HF_MODEL_ID           birajsubedi/whisper-large-v2-nepali-financial

npm install
npm test         # confirm NLP parser tests pass
npm run dev       # open http://localhost:3000
```

Test the full flow locally: register → login → tap mic → speak a
Nepali financial command → confirm → check it appears in transaction
history.

## 4. Deploy to Vercel

**Option A  -  via GitHub (recommended):**
1. Push this repo to GitHub
2. [vercel.com/new](https://vercel.com/new) → Import the repo
3. **Root Directory**: set to `app` (important  -  this is a monorepo)
4. Add all environment variables from `.env.local` in the Vercel project settings
5. Deploy

**Option B  -  via CLI:**
```bash
cd app
npm install -g vercel
vercel
# Follow prompts, set root directory to current folder
# Add env vars when prompted, or via vercel.com dashboard after
```

## 5. Post-deployment checklist

- [ ] Visit your live URL, register a test account
- [ ] Test voice command end-to-end (send, load, balance)
- [ ] Visit `/report`  -  confirm research data and benchmark table renders
- [x] Update placeholder URLs in `README.md` and `report/speakpay_report.tex`
- [x] Update benchmark numbers using `training/benchmark_results.json`

## Common issues

**Build fails on Vercel with "Module not found"** → confirm Root
Directory is set to `app`, not the repo root.

**500 error on `/api/transcribe`** → check `HF_MODEL_ID` matches
exactly what you pushed in step 1, and `HF_TOKEN` has at least Read access.

**"insufficient_funds" on every send** → the wallet starts with ₹100
welcome balance (see `app/src/app/api/auth/register/route.ts`)  -  make
sure you're testing with realistic amounts.

**Database errors** → confirm `supabase_schema.sql` ran without
errors in the SQL Editor; check the `transfer_funds` function exists
under Database → Functions.
