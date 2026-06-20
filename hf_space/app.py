import os
import io
import torch
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from transformers import WhisperForConditionalGeneration, WhisperProcessor, pipeline
from peft import PeftModel

app = FastAPI(title="SpeakPay ASR Model API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_MODEL = "openai/whisper-large-v2"
LORA_MODEL = "birajsubedi/whisper-large-v2-nepali-financial"
LANGUAGE = "nepali"
TASK = "transcribe"

print("Booting GPU/CPU environment...")
device = "cuda" if torch.cuda.is_available() else "cpu"
torch_dtype = torch.float16 if device == "cuda" else torch.float32

print(f"Loading base model {BASE_MODEL} into {device}...")
base_model = WhisperForConditionalGeneration.from_pretrained(
    BASE_MODEL, torch_dtype=torch_dtype
).to(device)

print(f"Applying LoRA weights {LORA_MODEL}...")
model = PeftModel.from_pretrained(base_model, LORA_MODEL)

print("Loading Whisper processor...")
processor = WhisperProcessor.from_pretrained(BASE_MODEL, language=LANGUAGE, task=TASK)

print("Initializing ASR pipeline...")
asr_pipeline = pipeline(
    "automatic-speech-recognition",
    model=model,
    tokenizer=processor.tokenizer,
    feature_extractor=processor.feature_extractor,
    torch_dtype=torch_dtype,
    device=0 if device == "cuda" else -1,
)
print("Startup complete. Ready for inference!")

@app.post("/transcribe")
async def transcribe(request: Request):
    """Accept raw audio bytes via POST body. No FormData needed."""
    try:
        content = await request.body()
        if not content or len(content) < 100:
            raise HTTPException(status_code=400, detail="No audio data received")
        
        # Pipeline accepts raw bytes and uses ffmpeg internally to decode any format
        result = asr_pipeline(content, generate_kwargs={"language": LANGUAGE, "task": TASK})
        text = result.get("text", "").strip()
        
        return {"text": text}
    except HTTPException:
        raise
    except Exception as e:
        print("Transcription Error:", e)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def health_check():
    return {"status": "ok", "message": "SpeakPay ASR API is running", "model": LORA_MODEL}
