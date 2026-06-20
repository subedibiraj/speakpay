// ══════════════════════════════════════════════════════════════════════
// SpeakPay ASR Client
// Handles recording, cold-start retries, offline fallback
// ══════════════════════════════════════════════════════════════════════

export type ASRResult = {
  transcript: string
  intent: import('./nlp').ParsedIntent
  latencyMs: number
  source: 'model' | 'browser_fallback'
}

// Cold-start retry: HF Inference API returns 503 when model is loading.
// We retry up to MAX_RETRIES times with exponential backoff.
const MAX_RETRIES   = 4
const BASE_DELAY_MS = 5000

async function callTranscribeAPI(
  blob: Blob,
  onRetry?: (attempt: number, waitMs: number) => void
): Promise<Response> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const fd = new FormData()
    fd.append('audio', blob, 'command.wav')
    const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
    if (res.status !== 503) return res

    if (attempt < MAX_RETRIES) {
      const wait = BASE_DELAY_MS * Math.pow(1.5, attempt)
      onRetry?.(attempt + 1, wait)
      await new Promise(r => setTimeout(r, wait))
    }
  }
  throw new Error('model_unavailable')
}

// Browser Web Speech API fallback (English-biased but better than nothing)
function browserFallback(): Promise<string> {
  return new Promise((resolve, reject) => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) { reject(new Error('no_browser_asr')); return }
    const rec  = new SpeechRecognition()
    rec.lang   = 'ne-NP'
    rec.continuous      = false
    rec.interimResults  = false
    rec.onresult = (e: any) => resolve(e.results[0][0].transcript)
    rec.onerror  = (e: any) => reject(new Error(e.error))
    rec.start()
  })
}

export async function transcribeBlob(
  blob: Blob,
  opts?: {
    onRetry?:    (attempt: number, waitMs: number) => void
    allowFallback?: boolean
  }
): Promise<ASRResult> {
  const t0 = Date.now()

  try {
    const res = await callTranscribeAPI(blob, opts?.onRetry)
    if (!res.ok) throw new Error(`api_error_${res.status}`)
    const data = await res.json()
    return {
      transcript: data.transcript,
      intent:     data.intent,
      latencyMs:  Date.now() - t0,
      source:     'model',
    }
  } catch (err) {
    if (opts?.allowFallback) {
      // Try browser ASR as last resort
      try {
        const transcript = await browserFallback()
        const { parseIntent } = await import('./nlp')
        return {
          transcript,
          intent:    parseIntent(transcript),
          latencyMs: Date.now() - t0,
          source:    'browser_fallback',
        }
      } catch { /* fall through */ }
    }
    throw err
  }
}

// Audio recorder helper
export function createRecorder(onStop: (blob: Blob) => void) {
  let mr: MediaRecorder | null = null
  const chunks: Blob[] = []

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    // Prefer wav-compatible formats
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'
    mr = new MediaRecorder(stream, { mimeType })
    mr.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
    mr.onstop = () => {
      stream.getTracks().forEach(t => t.stop())
      onStop(new Blob(chunks, { type: mimeType }))
      chunks.length = 0
    }
    mr.start(200) // collect in 200ms chunks
  }

  const stop = () => mr?.stop()

  return { start, stop }
}
