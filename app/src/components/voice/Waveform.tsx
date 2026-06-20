'use client'
import { motion } from 'framer-motion'

const BARS = 7

export function Waveform({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div className="flex items-center gap-[3px] h-8" aria-hidden="true">
      {Array.from({ length: BARS }).map((_, i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full bg-teal"
          animate={active
            ? { scaleY: [0.3, 1, 0.3], transition: {
                duration: 0.5 + Math.random() * 0.3,
                delay: i * 0.07,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            : { scaleY: 0.3 }
          }
          style={{ height: '100%', originY: 0.5 }}
        />
      ))}
    </div>
  )
}
