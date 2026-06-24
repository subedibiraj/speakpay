# SpeakPay — Local Fine-Tuning (RTX 3060)

Trains a LoRA-adapted Whisper large-v2 on NepFinSpeech-403 entirely on
your local GPU. No Colab, no environment drift.

## Why local instead of Colab

Colab's pre-installed package versions change without warning, which
caused a chain of `transformers`/`peft`/`bitsandbytes` incompatibilities.
Running locally means you control exact versions once, and they stay
fixed.

## 0. Prerequisites (you said you already have these)

- NVIDIA RTX 3060 (12GB VRAM) ✓
- CUDA installed ✓
- PyTorch with CUDA support installed ✓

Verify PyTorch sees your GPU before doing anything else:

```bash
python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
```

This must print `True` and `NVIDIA GeForce RTX 3060` (or similar).
If it prints `False`, your PyTorch install isn't CUDA-enabled — stop
and fix that first (reinstall PyTorch from pytorch.org with the
correct CUDA version for your driver).

## 1. Set up a virtual environment (recommended)

```bash
cd training
python -m venv venv

# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate
```

## 2. Install dependencies

**Important**: do NOT install `torch` again — keep your existing
CUDA-enabled PyTorch. Only install the rest:

```bash
pip install -r requirements.txt
```

If you get any dependency conflict mentioning `torch`, that's fine —
it just means pip is checking compatibility, not reinstalling it.

## 3. Configure

Open `scripts/config.py` and change line 1:

```python
HF_USERNAME = "birajsubedi"   # ← your actual Hugging Face username
```

Then log in to Hugging Face (only needed for step 5, but do it now):

```bash
huggingface-cli login
# Paste your HF token (the one with "Write" permission)
```

## 4. Run the pipeline — four scripts, in order

```bash
cd scripts

# Step 1: Download 403 audio files from Cloudinary, validate, resample
python 01_prepare_data.py
# Takes ~3-5 min depending on connection

# Step 2: Build train/val/test split, extract Whisper features
python 02_prepare_features.py
# Takes ~5-10 min (CPU-bound feature extraction)

# Step 3: Train the LoRA adapter
python 03_train.py
# Takes ~30-50 min on RTX 3060 for 300 steps
# Watch GPU usage: nvidia-smi -l 2  (in another terminal)

# Step 4: Benchmark — base vs general vs your domain model
python 04_benchmark.py
# Takes ~10-15 min, downloads 2 extra models temporarily
# Produces benchmark_results.json — THIS IS YOUR CORE RESULT

# Step 5: Push everything to Hugging Face
python 05_push_to_hub.py
# Takes ~5-10 min depending on upload speed
```

## 5. Expected VRAM usage

With the default settings (batch size 4, fp16, no quantization),
training uses roughly 8-10GB of your 12GB VRAM. If you hit an
out-of-memory error, open `scripts/config.py` and reduce:

```python
TRAIN_BATCH_SIZE = 2   # was 4
GRAD_ACCUM       = 8   # was 4  (keeps effective batch = 16)
```

## 6. What you'll have at the end

- `checkpoints/final/` — your trained LoRA adapter (~60MB)
- `benchmark_results.json` — WER/CER/NumAcc for all 3 models
- A public model on Hugging Face: `huggingface.co/birajsubedi/whisper-large-v2-nepali-financial`
- A public dataset on Hugging Face: `huggingface.co/datasets/birajsubedi/NepFinSpeech`

## Troubleshooting

**`CUDA out of memory`** → reduce `TRAIN_BATCH_SIZE` in `config.py` (see above)

**`ModuleNotFoundError` for any package** → make sure your venv is
activated (`which python` should point inside `venv/`)

**Download failures in step 1** → Cloudinary URLs are public and stable;
re-run the script, it skips already-downloaded files automatically

**`huggingface-cli login` fails** → make sure your token has "Write"
permission (Settings → Access Tokens on huggingface.co)
