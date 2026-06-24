// ASR Client
// Handles audio recording and Whisper API integration.

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

// Browser Web Speech API fallback
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
    forceBrowserASR?: boolean
  }
): Promise<ASRResult> {
  const t0 = Date.now()

  // Use browser ASR if forced, or as a fallback
  const runBrowserFallback = async () => {
    const transcript = await browserFallback()
    const { parseIntent } = await import('./nlp')
    return {
      transcript,
      intent:    parseIntent(transcript),
      latencyMs: Date.now() - t0,
      source:    'browser_fallback' as const,
    }
  }

  if (opts?.forceBrowserASR) {
    try {
      return await runBrowserFallback()
    } catch {
      // If forced browser ASR fails (e.g. no mic permission), try the model anyway
    }
  }

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
    if (opts?.allowFallback && !opts?.forceBrowserASR) {
      try {
        return await runBrowserFallback()
      } catch { /* fall through */ }
    }
    throw err
  }
}

// Audio recorder helper with Voice Activity Detection (VAD)
export function createRecorder(onStop: (blob: Blob) => void) {
  let mr: MediaRecorder | null = null
  let audioCtx: AudioContext | null = null
  let rafId: number | null = null
  const chunks: Blob[] = []
  let isStopped = false

  const start = async () => {
    isStopped = false
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'
    
    mr = new MediaRecorder(stream, { mimeType })
    mr.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
    
    mr.onstop = () => {
      isStopped = true
      if (rafId) cancelAnimationFrame(rafId)
      if (audioCtx) audioCtx.close()
      stream.getTracks().forEach(t => t.stop())
      onStop(new Blob(chunks, { type: mimeType }))
      chunks.length = 0
    }

    // --- Voice Activity Detection ---
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const source = audioCtx.createMediaStreamSource(stream)
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    let silenceStart = Date.now()
    let hasSpoken = false
    
    const checkSilence = () => {
      if (isStopped) return
      analyser.getByteFrequencyData(dataArray)
      let sum = 0
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]
      const avg = sum / dataArray.length
      
      const isSpeaking = avg > 10 // Threshold for speech

      if (isSpeaking) {
        hasSpoken = true
        silenceStart = Date.now()
      } else {
        // If they spoke, and then were silent for 1.5s -> STOP
        if (hasSpoken && Date.now() - silenceStart > 1500) {
          mr?.stop()
          return
        }
        // If they NEVER spoke, timeout after 7 seconds
        if (!hasSpoken && Date.now() - silenceStart > 7000) {
          mr?.stop()
          return
        }
      }
      rafId = requestAnimationFrame(checkSilence)
    }
    
    mr.start(200)
    checkSilence()
  }

  const stop = () => {
    if (!isStopped) mr?.stop()
  }

  return { start, stop }
}
