"""
SpeakPay — Shared configuration
Edit HF_USERNAME before running any scripts.
"""

# ── Hugging Face ─────────────────────────────────────────────────────
HF_USERNAME  = "birajsubedi"   # ← CHANGE THIS
DATASET_REPO = f"{HF_USERNAME}/NepFinSpeech"
MODEL_REPO   = f"{HF_USERNAME}/whisper-large-v2-nepali-financial"

# ── Model ────────────────────────────────────────────────────────────
BASE_MODEL = "openai/whisper-large-v2"
LANGUAGE   = "Nepali"
TASK       = "transcribe"
TARGET_SR  = 16000

# ── Data split ───────────────────────────────────────────────────────
TEST_SPLIT = 0.15
VAL_SPLIT  = 0.10
SEED       = 42

# ── LoRA ─────────────────────────────────────────────────────────────
LORA_R       = 32
LORA_ALPHA   = 64
LORA_DROPOUT = 0.05
LORA_TARGET_MODULES = ["q_proj", "v_proj", "k_proj", "out_proj", "fc1", "fc2"]

# ── Training ─────────────────────────────────────────────────────────
# RTX 3060 has 12GB VRAM — these settings fit comfortably in fp16
# without 8-bit quantization (avoids the bitsandbytes/triton issues
# that plagued the Colab environment).
TRAIN_BATCH_SIZE = 1
EVAL_BATCH_SIZE  = 1
GRAD_ACCUM       = 16         # effective batch = 16
LEARNING_RATE    = 1e-4
MAX_STEPS        = 300        # ~30-50 min on RTX 3060
WARMUP_STEPS     = 30
SAVE_STEPS       = 75
EVAL_STEPS       = 75
LOGGING_STEPS    = 10
