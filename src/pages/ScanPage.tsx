import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Badge } from '../components/ui'
import type { ARPoint, ARSessionHandle } from '../ar/arSession'

const loadAR = () => import('../ar/arSession')
import { useAppStore } from '../store/useAppStore'
import { useCompass } from '../hooks/useCompass'
import { polygonArea } from '../engine/geometry'

export function ScanPage() {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState('')
  const [pts, setPts] = useState<ARPoint[]>([])
  const [features, setFeatures] = useState<{ planeDetection: boolean; depth: boolean } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const handle = useRef<ARSessionHandle | null>(null)
  const overlay = useRef<HTMLDivElement>(null)
  const startHeading = useRef<number | null>(null)
  const compass = useCompass()
  const { setPlan, plan, setHouse } = useAppStore()
  const nav = useNavigate()

  useEffect(() => { loadAR().then((m) => m.isARSupported()).then(setSupported) }, [])
  useEffect(() => () => { handle.current?.end() }, [])

  const start = async () => {
    setErr(null)
    try {
      startHeading.current = compass.heading
      const { startARSession } = await loadAR()
      const h = await startARSession(overlay.current!, {
        onPoints: setPts,
        onStatus: setStatus,
        onFeatures: setFeatures,
        onEnd: () => { setRunning(false); handle.current = null },
      })
      handle.current = h
      setRunning(true)
    } catch (e) { setErr((e as Error).message) }
  }
  const useDetectedFloor = () => {
    const fl = handle.current?.floorOutline()
    if (!fl) { setStatus('尚未偵測到地板平面，請緩慢環視房間地面'); return }
    setPts(fl)
    setStatus(`已取用偵測到的地板（${fl.length} 個頂點），可直接完成`)
  }
  const finish = async () => {
    const p = (handle.current?.points().length ?? 0) >= 3 ? handle.current!.points() : pts
    await handle.current?.end()
    if (p.length < 3) return
    const { arPointsToPlan } = await loadAR()
    const outline = arPointsToPlan(p)
    // normalise so min is 0
    const minX = Math.min(...outline.map((q) => q.x)), minY = Math.min(...outline.map((q) => q.y))
    const norm = outline.map((q) => ({ x: q.x - minX, y: q.y - minY }))
    // ensure clockwise (screen coords): positive signed area means clockwise in y-down
    let s = 0
    for (let i = 0; i < norm.length; i++) { const a = norm[i]!, b = norm[(i + 1) % norm.length]!; s += (b.x - a.x) * (b.y + a.y) }
    const cw = s < 0 ? norm : [...norm].reverse()
    const northOffset = startHeading.current != null ? Math.round(startHeading.current) : plan.northOffset
    setPlan({ ...plan, outline: cw, rooms: [], items: [], northOffset })
    if (startHeading.current != null) setHouse({ facingSource: plan.items.length ? 'ar' : 'ar' })
    nav('/plan')
  }

  const area = pts.length >= 3 ? polygonArea(pts.map((q) => ({ x: q.x * 100, y: q.z * 100 }))) / 10000 : 0

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto safe-t">
      <h1 className="font-serif text-2xl font-bold text-gold pt-2">AR 空間掃描</h1>
      <Card>
        <p className="text-sm text-paper/80">用手機鏡頭依序對準房屋外牆的每個地板轉角，點擊放置標記；系統會把轉角連成平面圖外牆並自動以開始掃描時的羅盤方向定北。之後到「平面圖」頁補上房間與家具即可分析。</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Badge tone={supported ? 'green' : supported === false ? 'red' : 'gray'}>WebXR AR：{supported == null ? '偵測中' : supported ? '可用' : '不可用'}</Badge>
          <Badge tone={compass.heading != null ? 'green' : 'gray'}>羅盤：{compass.heading != null ? `${compass.heading.toFixed(0)}°` : '未啟用'}</Badge>
          {features && <Badge tone={features.planeDetection ? 'green' : 'gray'}>平面偵測 {features.planeDetection ? '✓' : '✗'}</Badge>}
          {features && <Badge tone={features.depth ? 'green' : 'gray'}>深度 {features.depth ? '✓' : '✗'}</Badge>}
        </div>
        {supported === false && (
          <div className="mt-3 rounded-xl bg-ink p-3 text-xs text-paper/70 leading-relaxed">
            此瀏覽器不支援 WebXR immersive-ar（iOS Safari／iPadOS 目前皆不支援）。替代做法：<br />
            1. iPhone 用內建「測距儀」App 量出各邊長度，再到「平面圖」頁依格線繪製（格線預設 50cm）。<br />
            2. 用「羅盤」頁的 AR 鏡頭模式（相機＋羅盤疊圖）量測坐向。<br />
            3. Android 手機請用 Chrome 開啟本頁。
          </div>
        )}
        {compass.status === 'need-permission' && <Button variant="ghost" className="mt-3" onClick={compass.requestPermission}>先啟用羅盤（定北用）</Button>}
        <div className="mt-3 flex gap-2">
          <Button onClick={start} disabled={!supported || running}>開始掃描</Button>
          <Button variant="subtle" onClick={() => nav('/plan')}>直接手繪平面圖</Button>
        </div>
        {err && <div className="text-xs text-red-300 mt-2">{err}</div>}
      </Card>

      {/* DOM overlay root, shown in AR */}
      <div ref={overlay} className={running ? 'fixed inset-0 z-50 pointer-events-none' : 'hidden'}>
        <div className="absolute top-4 inset-x-4 rounded-xl bg-black/60 text-paper text-sm p-3 pointer-events-auto">
          <div>{status}</div>
          <div className="text-xs text-paper/70 mt-1">轉角 {pts.length} 個{area > 0 && ` · 約 ${area.toFixed(1)} m²`}</div>
        </div>
        <div className="absolute bottom-8 inset-x-4 flex gap-2 pointer-events-auto">
          <button className="flex-1 rounded-xl bg-black/70 text-paper py-3" onClick={() => handle.current?.undo()}>退一步</button>
          {features?.planeDetection && <button className="flex-1 rounded-xl bg-black/70 text-paper py-3" onClick={async () => { const ok = await handle.current?.roomCapture(); if (!ok) useDetectedFloor() }}>掃房間</button>}
          {features?.planeDetection && <button className="flex-1 rounded-xl bg-black/70 text-paper py-3" onClick={useDetectedFloor}>用偵測到的地板</button>}
          <button className="flex-1 rounded-xl bg-gold text-ink font-semibold py-3" onClick={finish} disabled={pts.length < 3}>完成（{pts.length}）</button>
          <button className="rounded-xl bg-black/70 text-paper px-4 py-3" onClick={() => handle.current?.end()}>取消</button>
        </div>
      </div>
    </div>
  )
}
