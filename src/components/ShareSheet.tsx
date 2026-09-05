import { useState } from 'react'
import { Share2, X } from 'lucide-react'
import { Button, Segmented } from './mds'
import { buildShareSvg, SHARE_KIND_ZH, shareOrDownload, svgToPng, type ShareKind } from '../share/shareCard'
import type { FloorPlan } from '../engine/floorplan'
import type { Report } from '../engine/report'

/** Bottom sheet: pick a layer, preview, then share (Web Share) or download PNG. */
export function ShareSheet({ plan, report, onClose, initialKind = 'annual' }: { plan: FloorPlan; report: Report; onClose: () => void; initialKind?: ShareKind }) {
  const [kind, setKind] = useState<ShareKind>(initialKind)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const svg = buildShareSvg({ kind, plan, report })
  const preview = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  const go = async () => {
    setBusy(true); setMsg(null)
    try {
      const blob = await svgToPng(svg)
      const how = await shareOrDownload(blob, `fengshui-${kind}-${report.year}.png`, `嘟嘟風水 ${SHARE_KIND_ZH[kind]}`)
      setMsg(how === 'shared' ? '已開啟分享' : '已下載 PNG')
    } catch (e) { setMsg((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-label="分享圖片">
      <button aria-label="關閉" className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="sheet-enter absolute inset-x-0 bottom-0 mx-auto max-h-[92dvh] max-w-2xl overflow-y-auto rounded-t-2xl bg-surface-raised p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[var(--floating-shadow)]">
        <div className="mb-3 flex items-center justify-between"><span className="text-sm font-medium">分享分析圖</span><Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="關閉"><X /></Button></div>
        <Segmented value={kind} onValueChange={setKind} className="w-full" options={(Object.keys(SHARE_KIND_ZH) as ShareKind[]).map((k) => ({ value: k, label: SHARE_KIND_ZH[k] }))} />
        <img src={preview} alt={`${SHARE_KIND_ZH[kind]}預覽`} className="mt-3 w-full rounded-xl border border-surface-border bg-white" />
        <p className="mt-2 text-xs text-muted-foreground">圖片只含平面圖、分析層與分數，不含成員生日等個人資料。</p>
        <div className="mt-3 flex items-center gap-2">
          <Button variant="brand" size="lg" className="flex-1" onClick={go} disabled={busy}><Share2 />{busy ? '產生中' : '分享或下載 PNG'}</Button>
          {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
        </div>
      </div>
    </div>
  )
}
