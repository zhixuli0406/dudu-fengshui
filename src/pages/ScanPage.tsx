import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Badge } from '../components/ui'
import type { ARPoint, ARSessionHandle } from '../ar/arSession'

const loadAR = () => import('../ar/arSession')

/** DOM overlay root outside React's tree (Variant Launch hides every sibling of the overlay root). */
function getOverlayRoot(): HTMLElement {
  let el = document.getElementById('ar-overlay-root')
  if (!el) { el = document.createElement('div'); el.id = 'ar-overlay-root'; document.body.appendChild(el) }
  return el
}
import { useAppStore } from '../store/useAppStore'
import { useCompass } from '../hooks/useCompass'
import { polygonArea } from '../engine/geometry'
import { detectAR, openInLaunchViewer, type ARCapability } from '../ar/providers'

export function ScanPage() {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [cap, setCap] = useState<ARCapability | null>(null)
  const [loadingProvider, setLoadingProvider] = useState(false)
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState('')
  const [pts, setPts] = useState<ARPoint[]>([])
  const [features, setFeatures] = useState<{ planeDetection: boolean; depth: boolean } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [trackingHint, setTrackingHint] = useState<string | null>(null)
  const handle = useRef<ARSessionHandle | null>(null)
  const overlayRoot = useRef<HTMLElement | null>(null)
  if (typeof document !== 'undefined' && !overlayRoot.current) overlayRoot.current = getOverlayRoot()
  const startHeading = useRef<number | null>(null)
  const compass = useCompass()
  const { setPlan, plan, setHouse } = useAppStore()
  const nav = useNavigate()

  useEffect(() => { detectAR().then((c) => { setCap(c); setSupported(c.nativeXR) }) }, [])
  useEffect(() => () => { handle.current?.end() }, [])

  const startIOSProvider = async () => {
    setErr(null); setLoadingProvider(true)
    try {
      const c = await detectAR()
      setCap(c)
      if (c.nativeXR) { setSupported(true); await start(); return }
      if (c.launchStatus === 'launch-required' || c.launchUrl) {
        if (!openInLaunchViewer(c)) setErr('無法取得 Launch 檢視器連結，請確認 SDK key 與網域已登記')
        return
      }
      setErr(c.launchStatus === 'unsupported' ? '此 iOS 裝置／瀏覽器不支援 Variant Launch（請用 Safari 開啟）' : 'Variant Launch SDK 尚未初始化，請稍後再試或確認網域已在 Launch Admin 登記')
    } catch (e) { setErr((e as Error).message) } finally { setLoadingProvider(false) }
  }
  const start = async () => {
    setErr(null)
    try {
      startHeading.current = compass.heading
      const { startARSession } = await loadAR()
      const h = await startARSession(overlayRoot.current!, {
        onPoints: setPts,
        onStatus: setStatus,
        onFeatures: setFeatures,
        onTracking: setTrackingHint,
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
        {supported === false && cap?.ios && cap.providerConfigured && (
          <div className="mt-3 rounded-xl bg-jade/10 border border-jade/40 p-3 text-xs text-paper/80 leading-relaxed">
            iOS Safari 原生不支援 WebXR，本站已整合 Variant Launch：按下方按鈕會以 App Clip 開啟 Launch 檢視器載入本頁，之後即可像 Android 一樣點地板轉角建圖（支援 hit-test 與 DOM overlay，無平面偵測）。請用 Safari 開啟本頁。
            {cap.launchStatus && <div className="mt-1 text-paper/50">SDK 狀態：{cap.launchStatus}</div>}
            <div className="mt-2"><Button onClick={startIOSProvider} disabled={loadingProvider}>{loadingProvider ? '載入中…' : '在 iPhone 啟動 AR（App Clip）'}</Button></div>
          </div>
        )}
        {supported === false && !(cap?.ios && cap.providerConfigured) && (
          <div className="mt-3 rounded-xl bg-ink p-3 text-xs text-paper/70 leading-relaxed">
            此瀏覽器不支援 WebXR immersive-ar（iOS Safari／iPadOS 原生皆不支援）。替代做法：<br />
            1. <b>照片描圖</b>：到「平面圖」頁按「底圖」，拍建商平面圖或手繪草圖，點兩個已知距離校正比例，再照著描外牆與房間（iPhone 可用）。<br />
            2. iPhone 用內建「測距儀」App 量出各邊長度，再依格線繪製（格線預設 50cm）。<br />
            3. 用「羅盤」頁的 AR 鏡頭模式（相機＋羅盤疊圖）量測坐向。<br />
            4. Android 手機請用 Chrome 開啟本頁。
          </div>
        )}
        {compass.status === 'need-permission' && <Button variant="ghost" className="mt-3" onClick={compass.requestPermission}>先啟用羅盤（定北用）</Button>}
        <div className="mt-3 flex gap-2">
          <Button onClick={start} disabled={!supported || running}>開始掃描</Button>
          <Button variant="subtle" onClick={() => nav('/plan')}>手繪／照片描圖</Button>
        </div>
        {err && <div className="text-xs text-red-300 mt-2">{err}</div>}
      </Card>

      {/* DOM overlay UI, portaled into a root outside React's tree */}
      {running && overlayRoot.current && createPortal(
        <>
          <div className="absolute top-4 inset-x-4 rounded-xl bg-black/60 text-paper text-sm p-3">
            <div>{status}</div>
            {trackingHint && <div className="text-xs text-amber-300 mt-1">{trackingHint}</div>}
            <div className="text-xs text-paper/70 mt-1">轉角 {pts.length} 個{area > 0 && ` · 約 ${area.toFixed(1)} m²`}</div>
          </div>
          <div className="absolute bottom-8 inset-x-4 flex gap-2">
            <button className="flex-1 rounded-xl bg-black/70 text-paper py-3" onClick={() => handle.current?.undo()}>退一步</button>
            {features?.planeDetection && <button className="flex-1 rounded-xl bg-black/70 text-paper py-3" onClick={async () => { const ok = await handle.current?.roomCapture(); if (!ok) useDetectedFloor() }}>掃房間</button>}
            {features?.planeDetection && <button className="flex-1 rounded-xl bg-black/70 text-paper py-3" onClick={useDetectedFloor}>用偵測到的地板</button>}
            <button className="flex-1 rounded-xl bg-gold text-ink font-semibold py-3" onClick={finish} disabled={pts.length < 3}>完成（{pts.length}）</button>
            <button className="rounded-xl bg-black/70 text-paper px-4 py-3" onClick={() => handle.current?.end()}>取消</button>
          </div>
        </>,
        overlayRoot.current,
      )}
    </div>
  )
}
