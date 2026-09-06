import { useEffect, useState } from 'react'

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Reveal `text` one character at a time; `finish()` shows it all at once (tap to skip). */
export function useTypewriter(text: string, speedMs = 34): { shown: string; done: boolean; finish: () => void } {
  const [count, setCount] = useState(() => (reducedMotion() ? text.length : 0))
  useEffect(() => {
    if (reducedMotion()) { setCount(text.length); return }
    setCount(0)
    const id = window.setInterval(() => setCount((c) => (c >= text.length ? c : c + 1)), speedMs)
    return () => window.clearInterval(id)
  }, [text, speedMs])
  const n = Math.min(count, text.length)
  return { shown: text.slice(0, n), done: n >= text.length, finish: () => setCount(text.length) }
}
