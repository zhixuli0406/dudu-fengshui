import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Check, Compass, PenLine, Undo2, X } from 'lucide-react'
import { Page, PageHeader } from '../components/AppShell'
import { Badge, Button } from '../components/mds'
import type { ARPoint, ARSessionHandle, CaptureStage, CapturedOpening, CapturedPolygon, OpeningKind, WallSegment } from '../ar/arSession'
import { detectAR, openInLaunchViewer, type ARCapability } from '../ar/providers'
import { useAppStore } from '../store/useAppStore'
import { useCompass } from '../hooks/useCompass'
import { ITEM_DEFAULT, ROOM_ZH, type Item, type Room, type RoomType } from '../engine/floorplan'
import { polygonArea, polygonCentroid } from '../engine/geometry'
import { cn } from '../lib/utils'

const loadAR = () => import('../ar/arSession')
const ROOM_CHOICES: RoomType[] = ['living', 'master', 'bedroom', 'kids', 'study', 'kitchen', 'dining', 'bathroom', 'entry', 'balcony', 'other']

function getOverlayRoot(): HTMLElement {
  let el = document.getElementById('ar-overlay-root')
  if (!el) { el = document.createElement('div'); el.id = 'ar-overlay-root'; document.body.appendChild(el) }
  return el
}

interface CaptureState { stage: CaptureStage; points: ARPoint[]; polygons: CapturedPolygon[]; openings: CapturedOpening[]; walls: WallSegment[]; reticle: ARPoint | null }
const EMPTY: CaptureState = { stage: 'outline', points: [], polygons: [], openings: [], walls: [], reticle: null }

export function ScanPage() {
  const [cap, setCap] = useState<ARCapability | null>(null)
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState('')
  const [hint, setHint] = useState<string | null>(null)
  const [state, setState] = useState<CaptureState>(EMPTY)
  const [features, setFeatures] = useState<{ planeDetection: boolean; depth: boolean; localFloor: boolean } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [roomType, setRoomType] = useState<RoomType>('living')
  const [openingKind, setOpeningKind] = useState<OpeningKind>('mainDoor')
  const [busy, setBusy] = useState(false)
  const handle = useRef<ARSessionHandle | null>(null)
  const overlayRoot = useRef<HTMLElement | null>(null)
  if (typeof document !== 'undefined' && !overlayRoot.current) overlayRoot.current = getOverlayRoot()
  const startHeading = useRef<number | null>(null)
  const compass = useCompass()
  const { setPlan, plan, setHouse } = useAppStore()
  const nav = useNavigate()

  useEffect(() => { detectAR().then(setCap) }, [])
  useEffect(() => () => { handle.current?.end() }, [])

  const start = async () => {
    setErr(null); setBusy(true)
    try {
      startHeading.current = compass.heading
      const { startARSession } = await loadAR()
      const h = await startARSession(overlayRoot.current!, {
        onChange: setState, onStatus: setStatus, onTracking: setHint, onFeatures: setFeatures,
        onEnd: () => { setRunning(false); handle.current = null },
      })
      handle.current = h
      setRunning(true)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const startIOS = async () => {
    setErr(null); setBusy(true)
    try {
      const c = await detectAR(); setCap(c)
      if (c.nativeXR) { await start(); return }
      if (c.launchStatus === 'launch-required' || c.launchUrl) { if (!openInLaunchViewer(c)) setErr('無法取得 Launch 檢視器連結，請確認 SDK key 與網域已登記'); return }
      setErr(c.launchStatus === 'unsupported' ? '此 iOS 裝置或瀏覽器不支援 Variant Launch，請用 Safari 開啟' : 'Variant Launch 尚未初始化，請稍後再試')
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  const closeOutline = () => { if (handle.current?.closePolygon()) handle.current.setStage('room', { label: ROOM_ZH[roomType] }) }
  const closeRoom = () => { handle.current?.closePolygon(); handle.current?.setStage('room', { label: ROOM_ZH[roomType] }) }
  const goOpenings = () => { if (state.points.length >= 3) handle.current?.closePolygon(); handle.current?.setStage('opening', { openingKind }) }
  const finish = async () => {
    const h = handle.current
    if (!h) return
    if (h.stage() !== 'opening' && h.points().length >= 3) h.closePolygon()
    const polys = h.polygons(), ops = h.openings()
    await h.end()
    const outlineAR = polys.find((p) => p.stage === 'outline')?.pts
    if (!outlineAR || outlineAR.length < 3) { setErr('外牆至少需要 3 個轉角'); return }
    const { arPointsToPlan } = await loadAR()
    const raw = arPointsToPlan(outlineAR)
    const minX = Math.min(...raw.map((q) => q.x)), minY = Math.min(...raw.map((q) => q.y))
    const toPlan = (pts: ARPoint[]) => arPointsToPlan(pts).map((q) => ({ x: q.x - minX, y: q.y - minY }))
    const cw = (pts: { x: number; y: number }[]) => { let s = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i]!, b = pts[(i + 1) % pts.length]!; s += (b.x - a.x) * (b.y + a.y) }; return s < 0 ? pts : [...pts].reverse() }
    const outline = cw(toPlan(outlineAR))
    const rooms: Room[] = polys.filter((p) => p.stage === 'room' && p.pts.length >= 3).map((p, i) => ({ id: `r_ar_${i}`, type: (ROOM_CHOICES.find((t) => ROOM_ZH[t] === p.label) ?? 'other'), polygon: cw(toPlan(p.pts)) }))
    const center = polygonCentroid(outline)
    const items: Item[] = ops.map((o, i) => {
      const p = toPlan([o.p])[0]!
      // nearest wall of the outline; facing = normal pointing towards the house centre (door opens inward)
      let best = { d: Infinity, angle: 0 }
      for (let k = 0; k < outline.length; k++) {
        const a = outline[k]!, b = outline[(k + 1) % outline.length]!
        const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2))
        const q = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }
        const d = Math.hypot(p.x - q.x, p.y - q.y)
        if (d < best.d) {
          const wallAng = (Math.atan2(b.x - a.x, -(b.y - a.y)) * 180) / Math.PI
          const n1 = (wallAng + 90 + 360) % 360, n2 = (wallAng + 270) % 360
          const v = (ang: number) => ({ x: Math.sin((ang * Math.PI) / 180), y: -Math.cos((ang * Math.PI) / 180) })
          const towardCenter = (ang: number) => { const d1 = v(ang); return (center.x - q.x) * d1.x + (center.y - q.y) * d1.y }
          best = { d, angle: towardCenter(n1) > towardCenter(n2) ? n1 : n2 }
        }
      }
      const size = ITEM_DEFAULT[o.kind]
      const alongWall = (best.angle + 90) % 360
      const horizontal = Math.abs(Math.sin((alongWall * Math.PI) / 180)) > 0.7
      const w = horizontal ? size.w : size.h, hgt = horizontal ? size.h : size.w
      return { id: `i_ar_${i}`, type: o.kind, x: p.x - w / 2, y: p.y - hgt / 2, w, h: hgt, facing: Math.round(best.angle / 15) * 15 }
    })
    const northOffset = startHeading.current != null ? Math.round(startHeading.current) : plan.northOffset
    setPlan({ ...plan, outline, rooms, items, northOffset })
    const md = items.find((i) => i.type === 'mainDoor')
    if (md && startHeading.current != null) setHouse({ facingBearing: ((md.facing + 180 + northOffset) % 360 + 360) % 360, facingSource: 'ar' })
    nav('/plan')
  }

  const area = state.points.length >= 3 ? polygonArea(state.points.map((q) => ({ x: q.x * 100, y: q.z * 100 }))) / 10000 : 0
  const last = state.points[state.points.length - 1]
  const liveLen = last && state.reticle ? Math.hypot(state.reticle.x - last.x, state.reticle.z - last.z) : null
  const supported = cap?.nativeXR ?? null

  return (
    <>
      <PageHeader title="空間掃描" back="/plan" />
      <Page className="space-y-5">
        <p className="text-sm text-muted-foreground">用鏡頭沿著房子走一圈：先點每個外牆轉角，再逐一點出各房間的角落，最後標出大門、房門與窗。完成後自動生成平面圖並定北。</p>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={supported ? 'good' : supported === false ? 'destructive' : 'ghost'}>AR {supported == null ? '偵測中' : supported ? '可用' : '不可用'}</Badge>
          <Badge variant={compass.heading != null ? 'good' : 'ghost'}>羅盤 {compass.heading != null ? `${compass.heading.toFixed(0)}°` : '未啟用'}</Badge>
          {features && <Badge variant={features.planeDetection ? 'good' : 'ghost'}>平面偵測 {features.planeDetection ? '有' : '無'}</Badge>}
        </div>
        {compass.status === 'need-permission' && <Button variant="outline" onClick={compass.requestPermission}><Compass />先啟用羅盤，掃描才能自動定北</Button>}

        {supported === false && cap?.ios && cap.providerConfigured && (
          <div className="rounded-xl border border-surface-border bg-surface p-4 text-sm">
            <div className="font-medium">iPhone 需要透過 App Clip 開啟 AR</div>
            <p className="mt-1 text-muted-foreground">Safari 原生不支援 WebXR。按下方按鈕會以 Variant Launch 的 App Clip 檢視器載入本頁（第三方服務，見隱私聲明），之後即可點地板建圖。請用 Safari 開啟本頁。</p>
            {cap.launchStatus && <p className="mt-1 text-xs text-muted-foreground">SDK 狀態：{cap.launchStatus}</p>}
            <Button variant="brand" className="mt-3" onClick={startIOS} disabled={busy}>{busy ? '載入中' : '在 iPhone 啟動 AR'}</Button>
          </div>
        )}
        {supported === false && !(cap?.ios && cap.providerConfigured) && (
          <div className="rounded-xl border border-surface-border bg-surface p-4 text-sm">
            <div className="font-medium">這個瀏覽器不支援 AR</div>
            <p className="mt-1 text-muted-foreground">Android 請用 Chrome 開啟本頁。iPhone 可改用底圖描圖：拍建商平面圖或手繪草圖，校正比例後照著描。</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="brand" size="lg" onClick={start} disabled={!supported || running || busy}>開始掃描</Button>
          <Button variant="outline" size="lg" onClick={() => nav('/plan')}><PenLine />手繪或描圖</Button>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>手機直立、鏡頭朝地面，緩慢移動讓系統認出地板，畫面出現綠色圓環。</li>
          <li>走到每個外牆轉角，把圓環對準牆腳交點後點一下畫面；繞完一圈按「閉合」。</li>
          <li>選房間類型，同樣點出房間四角，按「完成房間」；重複到所有房間。</li>
          <li>選「大門／房門／窗」，把圓環對準門檻或窗台中點點一下。</li>
          <li>按「完成」，到平面圖頁補床、灶、桌等家具。</li>
        </ol>
      </Page>

      {running && overlayRoot.current && createPortal(
        <div className="text-white">
          <div className="absolute inset-x-3 top-3 rounded-xl bg-black/60 p-3 text-sm backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{{ outline: '1 外牆', room: '2 房間', opening: '3 門窗' }[state.stage]}</span>
              <span className="text-xs text-white/70">{state.stage !== 'opening' ? `${state.points.length} 點${area > 0 ? `，約 ${area.toFixed(1)} m²` : ''}` : `${state.openings.length} 個`}{liveLen != null && state.stage !== 'opening' ? `，這段 ${liveLen.toFixed(2)} m` : ''}</span>
            </div>
            <div className="mt-1 text-xs text-white/80">{status}</div>
            {hint && <div className="mt-1 text-xs text-amber-300">{hint}</div>}
            <MiniMap state={state} />
          </div>
          <div className="absolute inset-x-3 bottom-6 space-y-2">
            {state.stage === 'room' && (
              <div className="flex gap-1.5 overflow-x-auto pb-1">{ROOM_CHOICES.map((t) => <button key={t} onClick={() => { setRoomType(t); handle.current?.setStage('room', { label: ROOM_ZH[t] }) }} className={cn('shrink-0 rounded-lg px-2.5 py-1.5 text-xs', roomType === t ? 'bg-white text-black' : 'bg-black/60 text-white')}>{ROOM_ZH[t]}</button>)}</div>
            )}
            {state.stage === 'opening' && (
              <div className="flex gap-1.5">{(['mainDoor', 'door', 'window'] as OpeningKind[]).map((k) => <button key={k} onClick={() => { setOpeningKind(k); handle.current?.setStage('opening', { openingKind: k }) }} className={cn('flex-1 rounded-lg px-2.5 py-1.5 text-xs', openingKind === k ? 'bg-white text-black' : 'bg-black/60 text-white')}>{{ mainDoor: '大門', door: '房門', window: '窗' }[k]}</button>)}</div>
            )}
            <div className="flex gap-2">
              <button className="rounded-xl bg-black/70 px-3 py-3" aria-label="退一步" onClick={() => handle.current?.undo()}><Undo2 className="size-5" /></button>
              {state.stage === 'outline' && features?.planeDetection && <button className="flex-1 rounded-xl bg-black/70 py-3 text-sm" onClick={async () => { const ok = await handle.current?.roomCapture(); if (!ok) handle.current?.useDetectedFloor() }}>用偵測到的地板</button>}
              {state.stage === 'outline' && <button className="flex-1 rounded-xl bg-white py-3 text-sm font-medium text-black disabled:opacity-40" disabled={state.points.length < 3} onClick={closeOutline}>閉合外牆（{state.points.length}）</button>}
              {state.stage === 'room' && <button className="flex-1 rounded-xl bg-white py-3 text-sm font-medium text-black disabled:opacity-40" disabled={state.points.length < 3} onClick={closeRoom}>完成房間</button>}
              {state.stage === 'room' && <button className="flex-1 rounded-xl bg-black/70 py-3 text-sm" onClick={goOpenings}>下一步：門窗</button>}
              {state.stage === 'opening' && <button className="flex-1 rounded-xl bg-white py-3 text-sm font-medium text-black" onClick={finish}><Check className="mr-1 inline size-4" />完成建圖</button>}
              <button className="rounded-xl bg-black/70 px-3 py-3" aria-label="取消" onClick={() => handle.current?.end()}><X className="size-5" /></button>
            </div>
          </div>
        </div>,
        overlayRoot.current,
      )}
    </>
  )
}

/** Top-down sketch of what has been captured so far (metres). */
function MiniMap({ state }: { state: CaptureState }) {
  const all = [...state.polygons.flatMap((p) => p.pts), ...state.points, ...state.walls.flatMap((w) => [w.a, w.b]), ...(state.reticle ? [state.reticle] : [])]
  if (all.length === 0) return null
  const xs = all.map((p) => p.x), zs = all.map((p) => p.z)
  const minX = Math.min(...xs) - 0.5, maxX = Math.max(...xs) + 0.5, minZ = Math.min(...zs) - 0.5, maxZ = Math.max(...zs) + 0.5
  const W = 120, H = 90
  const s = Math.min(W / (maxX - minX), H / (maxZ - minZ))
  const X = (x: number) => (x - minX) * s, Z = (z: number) => (z - minZ) * s
  const path = (pts: ARPoint[], close: boolean) => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Z(p.z).toFixed(1)}`).join(' ') + (close ? ' Z' : '')
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="mt-2 rounded-md bg-black/40">
      {state.walls.map((w, i) => <line key={i} x1={X(w.a.x)} y1={Z(w.a.z)} x2={X(w.b.x)} y2={Z(w.b.z)} stroke="rgba(96,165,250,0.6)" strokeWidth={1} />)}
      {state.polygons.map((p, i) => <path key={i} d={path(p.pts, true)} fill={p.stage === 'outline' ? 'rgba(46,154,118,0.15)' : 'rgba(59,130,246,0.15)'} stroke={p.stage === 'outline' ? '#2e9a76' : '#3b82f6'} strokeWidth={1.2} />)}
      {state.points.length > 0 && <path d={path(state.points, false)} fill="none" stroke="#fff" strokeWidth={1.2} strokeDasharray="3 2" />}
      {state.points.map((p, i) => <circle key={i} cx={X(p.x)} cy={Z(p.z)} r={2} fill="#fff" />)}
      {state.openings.map((o, i) => <circle key={i} cx={X(o.p.x)} cy={Z(o.p.z)} r={2.5} fill="#f59e0b" />)}
      {state.reticle && <circle cx={X(state.reticle.x)} cy={Z(state.reticle.z)} r={3} fill="none" stroke="#2e9a76" strokeWidth={1.5} />}
    </svg>
  )
}
