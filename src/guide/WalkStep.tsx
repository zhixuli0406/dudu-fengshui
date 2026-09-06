import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Undo2, X } from 'lucide-react'
import type { ARPoint, ARSessionHandle, CaptureStage, CapturedItem, CapturedOpening, CapturedPolygon, OpeningKind, WallSegment } from '../ar/arSession'
import { detectAR, openInLaunchViewer, type ARCapability } from '../ar/providers'
import { captureToPlan } from '../ar/toPlan'
import { useCompass } from '../hooks/useCompass'
import { emptyPlan, ITEM_ZH, ROOM_ZH, type FloorPlan, type ItemType, type RoomType } from '../engine/floorplan'
import { polygonArea } from '../engine/geometry'
import { Escape, choiceCls } from './Scene'
import { cn } from '../lib/utils'

const loadAR = () => import('../ar/arSession')
const ROOM_CHOICES: RoomType[] = ['living', 'master', 'bedroom', 'kids', 'study', 'kitchen', 'dining', 'bathroom', 'entry', 'balcony', 'altar', 'other']
const ITEM_CHOICES: ItemType[] = ['bed', 'stove', 'toilet', 'desk', 'sofa', 'altar', 'tv', 'stairs']
const OPENINGS: OpeningKind[] = ['mainDoor', 'door', 'window']
const OPENING_ZH: Record<OpeningKind, string> = { mainDoor: '大門', door: '房門', window: '窗' }

/** What the master says at the top of the camera view, per stage. */
const STAGE_LINE: Record<CaptureStage, { title: string; line: string }> = {
  outline: { title: '外牆', line: '先繞外牆一圈。每個轉角，把圓環對準牆腳點一下，繞完按閉合。' },
  room: { title: '房間', line: '一間一間來。選房間種類，點它的四個角，按完成房間。' },
  opening: { title: '門窗', line: '大門一定要點。房門、窗對準門檻或窗台中間點一下。' },
  item: { title: '家具', line: '床點床的正中央，爐灶、馬桶、書桌、沙發、神位也一樣。朝向我看牆面就知道，不用你轉。' },
}

interface CaptureState { stage: CaptureStage; points: ARPoint[]; polygons: CapturedPolygon[]; openings: CapturedOpening[]; items: CapturedItem[]; walls: WallSegment[]; reticle: ARPoint | null }
const EMPTY: CaptureState = { stage: 'outline', points: [], polygons: [], openings: [], items: [], walls: [], reticle: null }

function overlayRootEl(): HTMLElement {
  let el = document.getElementById('ar-overlay-root')
  if (!el) { el = document.createElement('div'); el.id = 'ar-overlay-root'; document.body.appendChild(el) }
  return el
}

/** Is AR capture possible here, natively or through the iOS App Clip viewer? */
export function arUsable(cap: ARCapability | null): boolean {
  if (!cap) return false
  return cap.nativeXR || (cap.ios && cap.providerConfigured && cap.launchStatus !== 'unsupported')
}

/**
 * Walk one floor with the camera: outline → rooms → doors and windows → furniture. Positions come from
 * hit-testing the floor, north from the compass fused with the XR camera, facings from the walls.
 */
export function WalkStep({ upper, floorName, onDone, onSketch }: { upper: boolean; floorName: string; onDone: (plan: FloorPlan) => void; onSketch: () => void }) {
  const [cap, setCap] = useState<ARCapability | null>(null)
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState('')
  const [hint, setHint] = useState<string | null>(null)
  const [state, setState] = useState<CaptureState>(EMPTY)
  const [features, setFeatures] = useState<{ planeDetection: boolean } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [roomType, setRoomType] = useState<RoomType>('living')
  const [openingKind, setOpeningKind] = useState<OpeningKind>('mainDoor')
  const [itemType, setItemType] = useState<ItemType>(upper ? 'stairs' : 'bed')
  const [busy, setBusy] = useState(false)
  const handle = useRef<ARSessionHandle | null>(null)
  const compass = useCompass()
  const headingRef = useRef<number | null>(null)
  headingRef.current = compass.heading
  const root = useRef<HTMLElement | null>(null)
  if (typeof document !== 'undefined' && !root.current) root.current = overlayRootEl()

  useEffect(() => { detectAR().then(setCap) }, [])
  useEffect(() => () => { handle.current?.end() }, [])

  const start = async () => {
    setErr(null); setBusy(true)
    try {
      if (compass.status === 'need-permission') await compass.requestPermission()
      const { startARSession } = await loadAR()
      const h = await startARSession(root.current!, {
        onChange: setState, onStatus: setStatus, onTracking: setHint, onFeatures: (f) => setFeatures({ planeDetection: f.planeDetection }),
        getHeading: () => headingRef.current,
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
      if (!openInLaunchViewer(c)) setErr('無法開啟 iPhone 的 AR 檢視器，改用畫的吧。')
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  const closeOutline = () => { if (handle.current?.closePolygon()) handle.current.setStage('room', { label: ROOM_ZH[roomType] }) }
  const closeRoom = () => { handle.current?.closePolygon(); handle.current?.setStage('room', { label: ROOM_ZH[roomType] }) }
  const goOpenings = () => { if (state.points.length >= 3) handle.current?.closePolygon(); handle.current?.setStage('opening', { openingKind }) }
  const goItems = () => handle.current?.setStage('item', { itemType })
  const finish = async () => {
    const h = handle.current
    if (!h) return
    if (h.stage() !== 'opening' && h.stage() !== 'item' && h.points().length >= 3) h.closePolygon()
    const cap = { polygons: h.polygons(), openings: h.openings(), items: h.items(), northOffset: h.northOffset() }
    await h.end()
    const plan = captureToPlan(cap, emptyPlan(floorName, upper ? 1 : 0))
    if (!plan) { setErr('外牆至少要點三個轉角，再走一次吧。'); return }
    onDone(plan)
  }

  const area = state.points.length >= 3 ? polygonArea(state.points.map((q) => ({ x: q.x * 100, y: q.z * 100 }))) / 10000 : 0
  const last = state.points[state.points.length - 1]
  const liveLen = last && state.reticle ? Math.hypot(state.reticle.x - last.x, state.reticle.z - last.z) : null
  const native = cap?.nativeXR ?? false
  const needsLaunch = !!cap && !native && cap.ios && cap.providerConfigured && cap.launchStatus !== 'unsupported'

  return (
    <div className="space-y-3">
      <ol className="space-y-1.5 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-zinc-200">
        <li className="flex gap-2"><span className="text-brand">1</span><span>手機直立、鏡頭朝地板，慢慢動一下，畫面出現綠色圓環。</span></li>
        <li className="flex gap-2"><span className="text-brand">2</span><span>沿外牆走一圈，每個轉角點一下；再一間一間點房間的角。</span></li>
        <li className="flex gap-2"><span className="text-brand">3</span><span>{upper ? '樓梯口、房門、窗' : '大門、房門、窗'}點一下，最後點床、灶、桌、沙發的正中央。</span></li>
      </ol>
      {cap == null && <p className="text-xs text-zinc-500">看看這支手機能不能用鏡頭…</p>}
      {cap && !native && !needsLaunch && <p className="text-sm text-amber-200/80">這個瀏覽器用不了鏡頭建圖。Android 請用 Chrome；不然就用畫的。</p>}
      {err && <p className="text-sm text-rose-300">{err}</p>}
      {native && <button className={choiceCls(true, 'disabled:opacity-40')} disabled={busy || running} onClick={start}>{busy ? '準備中' : '開始走'}</button>}
      {needsLaunch && <button className={choiceCls(true, 'disabled:opacity-40')} disabled={busy} onClick={startIOS}>{busy ? '載入中' : '在 iPhone 開啟鏡頭建圖'}</button>}
      <Escape label="不用鏡頭，用畫的" onPick={onSketch} />

      {running && root.current && createPortal(
        <div className="text-white">
          <div className="absolute inset-x-3 top-3 rounded-xl bg-black/65 p-3 text-sm backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{floorName}・{STAGE_LINE[state.stage].title}</span>
              <span className="text-xs text-white/70">{state.stage === 'outline' || state.stage === 'room' ? `${state.points.length} 點${area > 0 ? `，約 ${area.toFixed(1)} m²` : ''}${liveLen != null ? `，這段 ${liveLen.toFixed(2)} m` : ''}` : state.stage === 'opening' ? `${state.openings.length} 個` : `${state.items.length} 件`}</span>
            </div>
            <div className="mt-1 text-[13px] text-[#efe7d6]">{STAGE_LINE[state.stage].line}</div>
            <div className="mt-1 text-xs text-white/70">{status}</div>
            {hint && <div className="mt-1 text-xs text-amber-300">{hint}</div>}
            <MiniMap state={state} />
          </div>
          <div className="absolute inset-x-3 bottom-6 space-y-2">
            {state.stage === 'room' && (
              <div className="flex gap-1.5 overflow-x-auto pb-1">{ROOM_CHOICES.map((t) => <button key={t} onClick={() => { setRoomType(t); handle.current?.setStage('room', { label: ROOM_ZH[t] }) }} className={cn('shrink-0 rounded-lg px-2.5 py-1.5 text-xs', roomType === t ? 'bg-white text-black' : 'bg-black/60 text-white')}>{ROOM_ZH[t]}</button>)}</div>
            )}
            {state.stage === 'opening' && (
              <div className="flex gap-1.5">{OPENINGS.filter((k) => !(upper && k === 'mainDoor')).map((k) => <button key={k} onClick={() => { setOpeningKind(k); handle.current?.setStage('opening', { openingKind: k }) }} className={cn('flex-1 rounded-lg px-2.5 py-1.5 text-xs', openingKind === k ? 'bg-white text-black' : 'bg-black/60 text-white')}>{OPENING_ZH[k]}</button>)}</div>
            )}
            {state.stage === 'item' && (
              <div className="flex gap-1.5 overflow-x-auto pb-1">{ITEM_CHOICES.map((t) => <button key={t} onClick={() => { setItemType(t); handle.current?.setStage('item', { itemType: t }) }} className={cn('shrink-0 rounded-lg px-2.5 py-1.5 text-xs', itemType === t ? 'bg-white text-black' : 'bg-black/60 text-white')}>{ITEM_ZH[t].split('／')[0]}</button>)}</div>
            )}
            <div className="flex gap-2">
              <button className="rounded-xl bg-black/70 px-3 py-3" aria-label="退一步" onClick={() => handle.current?.undo()}><Undo2 className="size-5" /></button>
              {state.stage === 'outline' && features?.planeDetection && <button className="flex-1 rounded-xl bg-black/70 py-3 text-sm" onClick={async () => { const ok = await handle.current?.roomCapture(); if (!ok) handle.current?.useDetectedFloor() }}>用偵測到的地板</button>}
              {state.stage === 'outline' && <button className="flex-1 rounded-xl bg-white py-3 text-sm font-medium text-black disabled:opacity-40" disabled={state.points.length < 3} onClick={closeOutline}>閉合外牆（{state.points.length}）</button>}
              {state.stage === 'room' && <button className="flex-1 rounded-xl bg-white py-3 text-sm font-medium text-black disabled:opacity-40" disabled={state.points.length < 3} onClick={closeRoom}>完成房間</button>}
              {state.stage === 'room' && <button className="flex-1 rounded-xl bg-black/70 py-3 text-sm" onClick={goOpenings}>下一步：門窗</button>}
              {state.stage === 'opening' && <button className="flex-1 rounded-xl bg-white py-3 text-sm font-medium text-black" onClick={goItems}>下一步：家具</button>}
              {state.stage === 'item' && <button className="flex-1 rounded-xl bg-white py-3 text-sm font-medium text-black" onClick={finish}><Check className="mr-1 inline size-4" />走完了</button>}
              <button className="rounded-xl bg-black/70 px-3 py-3" aria-label="取消" onClick={() => handle.current?.end()}><X className="size-5" /></button>
            </div>
          </div>
        </div>,
        root.current,
      )}
    </div>
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
      {state.items.map((o, i) => <circle key={i} cx={X(o.p.x)} cy={Z(o.p.z)} r={2.5} fill="#a855f7" />)}
      {state.reticle && <circle cx={X(state.reticle.x)} cy={Z(state.reticle.z)} r={3} fill="none" stroke="#2e9a76" strokeWidth={1.5} />}
    </svg>
  )
}
