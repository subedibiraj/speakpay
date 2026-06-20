// ══════════════════════════════════════════════════════════════════════
// SpeakPay TTS Engine
// Tries Nepali voice → falls back to best available → silent fallback
// ══════════════════════════════════════════════════════════════════════

let _nepaliVoice: SpeechSynthesisVoice | null | undefined = undefined

function getNepaliVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined') return null
  if (_nepaliVoice !== undefined) return _nepaliVoice
  const voices = window.speechSynthesis.getVoices()
  _nepaliVoice =
    voices.find(v => v.lang === 'ne-NP') ??
    voices.find(v => v.lang.startsWith('ne')) ??
    voices.find(v => v.lang.startsWith('hi')) ?? // Hindi as fallback
    null
  return _nepaliVoice
}

export function speak(text: string, rate = 0.88, onEnd?: () => void): void {
  if (typeof window === 'undefined') return
  window.speechSynthesis.cancel()
  const u    = new SpeechSynthesisUtterance(text)
  const voice = getNepaliVoice()
  if (voice) u.voice = voice
  u.lang   = 'ne-NP'
  u.rate   = rate
  u.pitch  = 1.0
  u.volume = 1.0
  if (onEnd) u.onend = onEnd
  window.speechSynthesis.speak(u)
}

export function cancel(): void {
  if (typeof window !== 'undefined') window.speechSynthesis.cancel()
}

// Pre-load voices (browsers require a user gesture or voices may be empty)
export function preloadVoices(): void {
  if (typeof window === 'undefined') return
  window.speechSynthesis.getVoices()
  window.speechSynthesis.onvoiceschanged = () => {
    _nepaliVoice = undefined // reset cache
    getNepaliVoice()
  }
}
