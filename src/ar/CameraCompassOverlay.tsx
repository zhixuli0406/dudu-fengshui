import { useEffect, useRef, useState } from 'react'
import { mountainOf } from '../engine/mountains24'
import { PALACES } from '../engine/bagua'

/**
 * Pseudo-AR compass: rear camera stream with a heading strip drawn on top.
 * Works on iOS Safari and Android; requires HTTPS and a user gesture for permissions.
 */
export function CameraCompassOverlay({ heading, onClose }: { heading: number | null; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    let stream: MediaStream | null = null
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        if (video.current) { video.current.srcObject = stream; await video.current.play() }
      } catch (e) { setErr((e as Error).message) }
    })()
    return () => { stream?.getTracks().forEach((t) => t.stop()) }
  }, [])

  const h = heading ?? 0
  const ticks = []
  for (let d = -60; d <= 60; d += 5) {
    const bearing = ((h + d) % 360 + 360) % 360
    const m = mountainOf(bearing)
    ticks.push({ d, bearing, label: d % 15 === 0 ? m.name : '', major: d % 15 === 0, cardinal: bearing % 90 === 0 ? ['北', '東', '南', '西'][bearing / 90] : '' })
  }
  return (
    <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4] max-h-[70vh]">
      <video ref={video} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
      {err && <div className="absolute inset-0 flex items-center justify-center text-sm text-red-300 p-4 text-center">無法開啟相機：{err}</div>}
      {/* heading strip */}
      <div className="absolute top-3 inset-x-3 h-16 rounded-xl bg-black/50 backdrop-blur-sm overflow-hidden">
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gold" />
        {ticks.map((t) => (
          <div key={t.d} className="absolute top-0 bottom-0 flex flex-col items-center" style={{ left: `calc(50% + ${t.d * 2.6}px)`, transform: 'translateX(-50%)' }}>
            <div className={`w-px ${t.major ? 'h-4 bg-paper' : 'h-2 bg-paper/50'}`} />
            {t.label && <div className="text-[13px] font-serif text-paper mt-0.5">{t.label}</div>}
            {t.cardinal && <div className="text-[10px] text-gold">{t.cardinal}</div>}
          </div>
        ))}
      </div>
      <div className="absolute bottom-3 inset-x-3 flex items-end justify-between">
        <div className="rounded-xl bg-black/60 px-3 py-2">
          <div className="text-3xl font-bold text-paper tabular-nums">{heading == null ? '--' : heading.toFixed(0)}°</div>
          {heading != null && <div className="text-xs text-gold">向 {mountainOf(heading).name}山 · {PALACES[mountainOf(heading).palace].direction}</div>}
        </div>
        <button onClick={onClose} className="rounded-xl bg-black/60 px-3 py-2 text-sm text-paper">關閉</button>
      </div>
      {/* center reticle */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 border-2 border-gold/70 rounded-full" />
    </div>
  )
}
