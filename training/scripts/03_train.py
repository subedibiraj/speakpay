"""
SpeakPay  -  Step 3: Fine-tune Whisper large-v2 with LoRA
Run: python scripts/03_train.py

Requires scripts/02_prepare_features.py to have run first.
"""
import os
import sys

# Force UTF-8 encoding on Windows to prevent checkmark printing crashes
if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

os.environ.setdefault("WANDB_DISABLED", "true")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import torch
import evaluate
from datasets import load_from_disk
from transformers import (
    WhisperForConditionalGeneration,
    WhisperProcessor,
    Seq2SeqTrainingArguments,
    Seq2SeqTrainer,
)
from peft import LoraConfig, get_peft_model, TaskType

from config import (
    BASE_MODEL, LANGUAGE, TASK,
    LORA_R, LORA_ALPHA, LORA_DROPOUT, LORA_TARGET_MODULES,
    TRAIN_BATCH_SIZE, EVAL_BATCH_SIZE, GRAD_ACCUM, LEARNING_RATE,
    MAX_STEPS, WARMUP_STEPS, SAVE_STEPS, EVAL_STEPS, LOGGING_STEPS,
)

ROOT         = Path(__file__).resolve().parent.parent
FEATURES_DIR = ROOT / "data" / "features"
CKPT_DIR     = ROOT / "checkpoints" / "whisper-nepali-financial"
FINAL_DIR    = ROOT / "checkpoints" / "final"

import re
NEP_NUM = re.compile(r"[०-९]+")


@dataclass
class SpeechCollator:
    processor: Any

    def __call__(self, features):
        inp = self.processor.feature_extractor.pad(
            [{"input_features": f["input_features"]} for f in features],
            return_tensors="pt",
        )
        lbl = self.processor.tokenizer.pad(
            [{"input_ids": f["labels"]} for f in features],
            return_tensors="pt",
        )
        labels = lbl["input_ids"].masked_fill(lbl.attention_mask.ne(1), -100)
        if (labels[:, 0] == self.processor.tokenizer.bos_token_id).all().cpu().item():
            labels = labels[:, 1:]
        inp["labels"] = labels
        inp["input_features"] = inp["input_features"].to(torch.float16)
        return inp


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--n-train", type=int, help="Subset train data to N samples")
    parser.add_argument("--output-dir", type=Path, help="Override checkpoint output directory")
    args_cli = parser.parse_args()

    global FINAL_DIR, CKPT_DIR
    if args_cli.output_dir:
        FINAL_DIR = args_cli.output_dir
        CKPT_DIR = args_cli.output_dir / "checkpoints"

    if not FEATURES_DIR.exists():
        raise SystemExit(
            f"ERROR: {FEATURES_DIR} not found. Run scripts/02_prepare_features.py first."
        )

    # ── GPU check ────────────────────────────────────────────────────
    if not torch.cuda.is_available():
        raise SystemExit("ERROR: No CUDA GPU detected. Check your PyTorch/CUDA install.")
    print(f"Device : {torch.cuda.get_device_name(0)}")
    print(f"VRAM   : {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")

    # ── Load data ────────────────────────────────────────────────────
    print(f"\nLoading prepared features from {FEATURES_DIR}...")
    ds = load_from_disk(str(FEATURES_DIR))
    
    if args_cli.n_train is not None:
        print(f"Subsetting training data to {args_cli.n_train} samples for data efficiency sweep...")
        # Subset deterministically
        ds["train"] = ds["train"].select(range(min(args_cli.n_train, len(ds["train"]))))
        
    print(ds)

    processor = WhisperProcessor.from_pretrained(BASE_MODEL, language=LANGUAGE, task=TASK)

    # ── Load model (fp16, no quantization needed  -  12GB VRAM is plenty) ──
    print(f"\nLoading {BASE_MODEL} (fp16)...")
    model = WhisperForConditionalGeneration.from_pretrained(
        BASE_MODEL, torch_dtype=torch.float16
    ).to("cuda")
    model.config.forced_decoder_ids = None
    model.config.suppress_tokens = []
    model.config.use_cache = False

    # Monkey-patch forward to accept and ignore input_ids/inputs_embeds (PEFT passes them as None)
    old_forward = model.forward
    def new_forward(*args, **kwargs):
        kwargs.pop("input_ids", None)
        kwargs.pop("inputs_embeds", None)
        return old_forward(*args, **kwargs)
    model.forward = new_forward

    lora_cfg = LoraConfig(
        r=LORA_R,
        lora_alpha=LORA_ALPHA,
        target_modules=LORA_TARGET_MODULES,
        lora_dropout=LORA_DROPOUT,
        bias="none",
        task_type=TaskType.SEQ_2_SEQ_LM,
    )
    model = get_peft_model(model, lora_cfg)
    if hasattr(model, "enable_input_require_grads"):
        model.enable_input_require_grads()
    model.print_trainable_parameters()
    model.generation_config.language = LANGUAGE.lower()
    model.generation_config.task = TASK
    model.generation_config.forced_decoder_ids = None

    # ── Metrics ──────────────────────────────────────────────────────
    wer_metric = evaluate.load("wer")
    cer_metric = evaluate.load("cer")

    def compute_metrics(pred):
        pred_ids = pred.predictions
        label_ids = pred.label_ids
        label_ids[label_ids == -100] = processor.tokenizer.pad_token_id
        p_str = processor.tokenizer.batch_decode(pred_ids, skip_special_tokens=True)
        l_str = processor.tokenizer.batch_decode(label_ids, skip_special_tokens=True)
        pn = [" ".join(s.lower().split()) for s in p_str]
        ln = [" ".join(s.lower().split()) for s in l_str]
        wer = 100 * wer_metric.compute(predictions=pn, references=ln)
        cer = 100 * cer_metric.compute(predictions=pn, references=ln)
        tot, hit = 0, 0
        for p, l in zip(p_str, l_str):
            for n in NEP_NUM.findall(l):
                tot += 1
                if n in p:
                    hit += 1
        num_acc = 100 * hit / tot if tot else 0
        return {"wer": round(wer, 2), "cer": round(cer, 2), "num_acc": round(num_acc, 1)}

    collator = SpeechCollator(processor=processor)

    # ── Training arguments ──────────────────────────────────────────
    args = Seq2SeqTrainingArguments(
        output_dir=str(CKPT_DIR),
        per_device_train_batch_size=TRAIN_BATCH_SIZE,
        per_device_eval_batch_size=EVAL_BATCH_SIZE,
        gradient_accumulation_steps=GRAD_ACCUM,
        learning_rate=LEARNING_RATE,
        warmup_steps=WARMUP_STEPS,
        max_steps=MAX_STEPS,
        gradient_checkpointing=True,
        fp16=True,
        evaluation_strategy="steps",
        predict_with_generate=True,
        generation_max_length=225,
        save_steps=SAVE_STEPS,
        eval_steps=EVAL_STEPS,
        logging_steps=LOGGING_STEPS,
        load_best_model_at_end=True,
        metric_for_best_model="wer",
        greater_is_better=False,
        push_to_hub=False,
        remove_unused_columns=False,
        label_names=["labels"],
        report_to=[],
        dataloader_num_workers=2,
        seed=42,
    )

    # Monkey-patch generate to ignore 'labels' passed during evaluation
    old_generate = model.generate
    def new_generate(*args, **kwargs):
        kwargs.pop("labels", None)
        return old_generate(*args, **kwargs)
    model.generate = new_generate

    trainer = Seq2SeqTrainer(
        args=args,
        model=model,
        train_dataset=ds["train"],
        eval_dataset=ds["validation"],
        data_collator=collator,
        compute_metrics=compute_metrics,
        tokenizer=processor.feature_extractor,
    )

    print(f"\nStarting training: {MAX_STEPS} steps, effective batch={TRAIN_BATCH_SIZE * GRAD_ACCUM}")
    result = trainer.train()
    print(f"\n✓ Training done  -  loss: {result.training_loss:.4f}")

    FINAL_DIR.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(str(FINAL_DIR))
    processor.save_pretrained(str(FINAL_DIR))
    print(f"✓ Saved final adapter to {FINAL_DIR}")
    print("\nNext: python scripts/04_benchmark.py")


if __name__ == "__main__":
    main()
