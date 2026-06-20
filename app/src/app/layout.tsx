import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title:       'SpeakPay — Voice-First Nepali eWallet',
  description: 'AI-assisted digital wallet for visually impaired individuals. Speak in Nepali to send money, check balance, and load funds.',
  keywords:    ['nepali ewallet', 'voice payment', 'accessibility', 'visually impaired', 'ASR'],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ne">
      <body>{children}</body>
    </html>
  )
}
