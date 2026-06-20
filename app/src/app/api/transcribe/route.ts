import { NextRequest, NextResponse } from 'next/server'
import { parseIntent } from '@/lib/nlp'
import { supabaseAdmin } from '@/lib/supabase'

const HF_TOKEN    = process.env.HF_TOKEN!
const HF_MODEL_ID = process.env.HF_MODEL_ID!
const HF_URL      = `https://api-inference.huggingface.co/models/${HF_MODEL_ID}`

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const audio    = formData.get('audio') as File | null
    if (!audio) return NextResponse.json({ error: 'No audio' }, { status: 400 })

    const buffer = Buffer.from(await audio.arrayBuffer())

    const hfRes = await fetch(HF_URL, {
      method:  'POST',
      headers: { Authorization: `Bearer ${HF_TOKEN}`, 'Content-Type': 'audio/wav' },
      body:    buffer,
    })

    if (hfRes.status === 503) {
      return NextResponse.json({ error: 'model_loading', retryAfter: 20 }, { status: 503 })
    }
    if (!hfRes.ok) {
      return NextResponse.json({ error: await hfRes.text() }, { status: hfRes.status })
    }

    const { text }   = await hfRes.json()
    const transcript = (text ?? '').trim()
    const intent     = parseIntent(transcript)

    // Log to asr_logs for research analytics (non-blocking)
    supabaseAdmin.from('asr_logs').insert({
      transcript,
      model_used:  'domain_lora',
      intent:      intent.action,
    }).then(
      () => {},
      () => {}
    )

    return NextResponse.json({ transcript, intent })
  } catch (err: any) {
    console.error('Transcribe error:', err)
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
