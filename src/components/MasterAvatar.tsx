import { useState } from 'react'

/**
 * The feng shui master persona. Illustration generated with Grok (manga style); `public/master.jpg` is the
 * web-optimised copy, `docs/assets/master-original.png` the 1024px original. Falls back to a silhouette.
 */
export function MasterAvatar({ size = 96, className = '' }: { size?: number; className?: string }) {
  const [hasImage, setHasImage] = useState(true)
  const src = `${import.meta.env.BASE_URL}master.jpg`
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-full ring-2 ring-white/20 ${className}`} style={{ width: size, height: size, background: 'radial-gradient(circle at 50% 35%, #3b3f46, #17181b 70%)' }}>
      {hasImage ? (
        <img src={src} alt="風水師" className="h-full w-full object-cover" onError={() => setHasImage(false)} />
      ) : (
        <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
          <circle cx="50" cy="38" r="16" fill="#e7d9c4" />
          <path d="M30 40 Q50 8 70 40 Z" fill="#2b2b30" />
          <path d="M28 44 L72 44 L66 38 L34 38 Z" fill="#2b2b30" />
          <path d="M22 100 Q28 62 50 60 Q72 62 78 100 Z" fill="#3a4a5c" />
          <circle cx="50" cy="78" r="9" fill="#d6b35c" stroke="#2b2b30" strokeWidth="2" />
          <circle cx="50" cy="78" r="3" fill="#2b2b30" />
        </svg>
      )}
    </div>
  )
}
