import { useEffect, useState } from 'react'
import { CompassDial } from '../components/CompassDial'
import { useCompass } from '../hooks/useCompass'
import { useAppStore } from '../store/useAppStore'
import { mountainOf } from '../engine/mountains24'
import { palaceOfBearing } from '../engine/direction'
import { PALACES, TRIGRAMS_CLOCKWISE, type Trigram } from '../engine/bagua'
import { Escape, choiceCls } from './Scene'
import { cn } from '../lib/utils'

/**
 * The door question, measured live: where to stand, the dial, the reading, one confirm button.
 * Falls back to the 3×3 pad when the device has no usable sensor (desktop, permission denied) or on request.
 */
export function DoorCompass({ current, onConfirm, onKeep }: { current: number | null; onConfirm: (bearing: number, source: 'compass' | 'manual') => void; onKeep: () => void }) {
  const compass = useCompass()
  const settings = useAppStore((s) => s.settings)
  const [manual, setManual] = useState(false)
  const heading = compass.heading == null ? null : settings.useTrueNorth ? (((compass.heading + settings.declination) % 360) + 360) % 360 : compass.heading
  const pal = heading != null ? palaceOfBearing(heading) : null
  const mountain = heading != null ? mountainOf(heading) : null
  const noSensor = compass.status === 'unsupported' || compass.status === 'denied'
  useEffect(() => { if (noSensor) setManual(true) }, [noSensor])

  if (manual) {
    return (
      <div>
        {noSensor && <p className="mb-3 text-sm text-zinc-300">{compass.status === 'denied' ? '感測器權限被拒絕，先用手選。iOS 可到「設定」的 Safari 開啟「動作與方向存取」。' : '這台裝置量不到方向，先用手選；之後用手機再量會更準。'}</p>}
        <p className="mb-2 text-sm text-zinc-300">站在大門裡面、面朝屋外，你正對的是哪一邊？</p>
        <div className="grid grid-cols-4 gap-2">
          {TRIGRAMS_CLOCKWISE.map((t: Trigram) => <button key={t} className={choiceCls(current != null && palaceOfBearing(current) === t)} onClick={() => onConfirm(PALACES[t].bearing, 'manual')}>{PALACES[t].direction}</button>)}
        </div>
        {!noSensor && <Escape label="改回用羅盤量" onPick={() => setManual(false)} />}
      </div>
    )
  }

  const status = compass.status !== 'active' ? (compass.status === 'need-permission' ? '按下面的按鈕，允許使用方向感測器。' : '等感測器回報中…')
    : compass.mode === 'upright' ? '手機直立中，請平放、螢幕朝上。'
      : compass.stability < 3 ? '讀數穩定，可以按了。' : compass.stability < 8 ? '略有飄動，再等一下。' : '飄動很大：遠離鐵門與金屬，拿著手機畫 8 字校正。'
  const steady = compass.status === 'active' && compass.stability < 8 && compass.mode === 'flat'

  return (
    <div className="space-y-4">
      <StandHere />
      <div className="flex items-center gap-4">
        <CompassDial heading={heading} size={176} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-mono text-4xl tabular-nums text-[#efe7d6]">{heading == null ? '--' : Math.round(heading)}°</div>
          {pal && mountain ? <div className="mt-1 text-base text-zinc-100">{PALACES[pal].direction}，向{mountain.name}山</div> : <div className="mt-1 text-base text-zinc-500">還沒有讀數</div>}
          <div className={cn('mt-2 text-xs', steady ? 'text-brand' : 'text-amber-200/80')}>{status}</div>
        </div>
      </div>
      {compass.status === 'need-permission'
        ? <button className={choiceCls(true)} onClick={compass.requestPermission}>開始量</button>
        : <button className={choiceCls(true, 'disabled:opacity-40')} disabled={heading == null} onClick={() => onConfirm(Math.round(heading! * 10) / 10, 'compass')}>就是這個方向{pal ? `：${PALACES[pal].direction}` : ''}</button>}
      {current != null && <button className={choiceCls()} onClick={onKeep}>維持上次的 {Math.round(current)}°（{PALACES[palaceOfBearing(current)].direction}）</button>}
      <Escape label="量不到，改用手選方位" onPick={() => setManual(true)} />
    </div>
  )
}

/** Top-down sketch: stand just inside the main door, facing out, phone flat with its top toward the outside. */
function StandHere() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <svg viewBox="0 0 120 96" width={104} height={83} aria-hidden className="shrink-0">
        <rect x="10" y="6" width="100" height="62" rx="3" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
        <text x="16" y="20" fontSize="10" fill="rgba(255,255,255,0.55)">屋內</text>
        <line x1="44" y1="68" x2="76" y2="68" stroke="#0c0d10" strokeWidth="4" />
        <line x1="46" y1="68" x2="66" y2="84" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="60" cy="52" r="6" fill="var(--brand)" />
        <rect x="55" y="59" width="10" height="6" rx="1.5" fill="none" stroke="var(--brand)" strokeWidth="1.5" />
        <line x1="60" y1="60" x2="60" y2="88" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" />
        <polygon points="60,94 54,84 66,84" fill="var(--brand)" />
        <text x="78" y="92" fontSize="10" fill="rgba(255,255,255,0.55)">屋外</text>
      </svg>
      <div className="text-sm leading-relaxed text-zinc-200">
        <div className="font-medium text-[#efe7d6]">站在大門裡面，面朝屋外。</div>
        <div>手機平放、螢幕朝上，機頂對準門外。</div>
        <div className="text-xs text-zinc-400">離鐵門、金屬門框一公尺以上。</div>
      </div>
    </div>
  )
}
