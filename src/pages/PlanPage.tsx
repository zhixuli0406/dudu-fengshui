import { useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Camera, ChevronUp, Eye, Image as ImageIcon, MoreHorizontal, MousePointer2, PenLine, RotateCcw, RotateCw, ScanLine, Share2, Sparkles, Square, Trash2, Undo2, X } from 'lucide-react'
import { PlanEditor, type EditorMode } from '../components/PlanEditor'
import { Page as _Page, PageHeader } from '../components/AppShell'
import { Badge, Button, Input, NativeSelect, Segmented } from '../components/mds'
import { ITEM_ZH, ROOM_ZH, type ItemType, type RoomType } from '../engine/floorplan'
import { useAppStore } from '../store/useAppStore'
import { runFormRules, runAllFormRules } from '../engine/rules'
import { demoPlan } from '../data/demoPlan'
import { PALACES } from '../engine/bagua'
import { palaceOfBearing } from '../engine/direction'
import type { Trigram } from '../engine/bagua'
import type { PalaceOverlayInfo } from '../components/NineGridOverlay'
import { buildReport } from '../engine/report'
import { NINE_STARS } from '../engine/stars'
import { fileToDataUrl } from '../lib/image'
import { ShareSheet } from '../components/ShareSheet'
import type { Point } from '../engine/geometry'
import { cn } from '../lib/utils'
void _Page

const ROOM_TYPES: RoomType[] = ['living', 'master', 'bedroom', 'kids', 'study', 'kitchen', 'dining', 'bathroom', 'entry', 'balcony', 'altar', 'storage', 'corridor', 'driveway', 'void', 'other']
const ITEM_TYPES: ItemType[] = ['mainDoor', 'door', 'window', 'bed', 'stove', 'sink', 'fridge', 'toilet', 'desk', 'sofa', 'mirror', 'beam', 'lamp', 'altar', 'stairs', 'elevator', 'aquarium', 'column', 'tv', 'plant']
const MODES: { value: EditorMode; label: string; icon: typeof PenLine }[] = [
  { value: 'calibrate', label: '底圖', icon: ImageIcon },
  { value: 'outline', label: '外牆', icon: PenLine },
  { value: 'room', label: '房間', icon: Square },
  { value: 'item', label: '物件', icon: Camera },
  { value: 'select', label: '選取', icon: MousePointer2 },
]

export function PlanPage() {
  const { plan, floors, activeFloor, setActiveFloor, addFloor, removeFloor, updatePlan, addRoom, updateRoom, removeRoom, addItem, updateItem, removeItem, setPlan, setFloors, house, setHouse, persons, settings, setSettings } = useAppStore()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [mode, setMode] = useState<EditorMode>((params.get('mode') as EditorMode | null) ?? (plan.outline.length >= 3 ? 'select' : 'outline'))
  const [roomType, setRoomType] = useState<RoomType>('living')
  const [itemType, setItemType] = useState<ItemType>('mainDoor')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [overlay, setOverlay] = useState<'none' | 'pie' | 'grid'>(settings.gridStyle)
  const [overlayKind, setOverlayKind] = useState<'palace' | 'bazhai' | 'stars' | 'annual'>('palace')
  const [showFindings, setShowFindings] = useState(true)
  const [sheet, setSheet] = useState<'none' | 'menu' | 'display' | 'share'>('none')
  const [contextOpen, setContextOpen] = useState(true)
  const [calPts, setCalPts] = useState<Point[]>([])
  const [roomShape, setRoomShape] = useState<'rect' | 'poly'>('poly')
  const [roomDraft, setRoomDraft] = useState<Point[]>([])
  const [calDist, setCalDist] = useState(300)
  const fileRef = useRef<HTMLInputElement>(null)

  const selectedItem = plan.items.find((i) => i.id === selectedId)
  const selectedRoom = plan.rooms.find((r) => r.id === selectedId)
  const findings = useMemo(() => (showFindings ? runFormRules(plan) : []), [plan, showFindings])
  const crossCount = useMemo(() => (floors.length > 1 ? runAllFormRules(floors).filter((f) => f.floor?.includes('／')).length : 0), [floors])
  const report = useMemo(() => {
    try { return buildReport(persons, { facingBearing: house.facingBearing, periodYear: house.periodYear, plan, stoveMode: house.stoveMode, jianxiangTolerance: house.jianxiangTolerance, replacementMode: house.replacementMode }) } catch { return null }
  }, [overlayKind, sheet, persons, house, plan])
  const overlayInfo = useMemo<Partial<Record<Trigram, PalaceOverlayInfo>> | undefined>(() => {
    if (!report) return undefined
    const out: Partial<Record<Trigram, PalaceOverlayInfo>> = {}
    for (const p of report.xuankong.palaces) {
      if (overlayKind === 'stars') out[p.palace] = { lines: [`${p.mountainStar} ${p.waterStar}`, `運${p.periodStar}`], tone: p.combo.rating === 'great' || p.combo.rating === 'good' ? 'good' : p.combo.rating === 'bad' || p.combo.rating === 'terrible' ? 'bad' : 'neutral' }
      if (overlayKind === 'annual') out[p.palace] = { lines: [NINE_STARS[p.annualStar]!.zh], tone: [5, 2, 3, 7].includes(p.annualStar) ? 'bad' : [8, 9, 1, 6, 4].includes(p.annualStar) ? 'good' : 'neutral' }
      if (overlayKind === 'bazhai') {
        const primary = report.persons.find((x) => x.person.primary) ?? report.persons[0]
        if (primary) { const star = primary.stars[p.palace]; out[p.palace] = { lines: [{ shengqi: '生氣', tianyi: '天醫', yannian: '延年', fuwei: '伏位', huohai: '禍害', liusha: '六煞', wugui: '五鬼', jueming: '絕命' }[star]], tone: ['shengqi', 'tianyi', 'yannian', 'fuwei'].includes(star) ? 'good' : 'bad' } }
      }
    }
    for (const t of report.bazhai.wealth) out[t] = { lines: [...(out[t]?.lines ?? []), '財位'], tone: out[t]?.tone ?? 'neutral' }
    for (const t of report.bazhai.wenchang) if ((t as string) !== 'center') out[t] = { lines: [...(out[t]?.lines ?? []), '文昌'], tone: out[t]?.tone ?? 'neutral' }
    for (const t of report.bazhai.wealthLeak) out[t] = { lines: [...(out[t]?.lines ?? []), '洩財'], tone: out[t]?.tone ?? 'neutral' }
    return out
  }, [report, overlayKind])

  const autoRoomId = (x: number, y: number, w: number, h: number) => plan.rooms.find((r) => r.polygon.length >= 3 && inPoly({ x: x + w / 2, y: y + h / 2 }, r.polygon))?.id
  const alignNorthByMainDoor = () => {
    const md = plan.items.find((i) => i.type === 'mainDoor')
    if (!md) { alert('請先放置「大門」並把箭頭轉到屋內方向'); return }
    updatePlan((p) => ({ ...p, northOffset: Math.round((((house.facingBearing - (md.facing + 180)) % 360 + 360) % 360) * 10) / 10 }))
  }
  const loadUnderlay = async (file: File) => {
    const { dataUrl, w, h } = await fileToDataUrl(file)
    updatePlan((p) => ({ ...p, underlay: { dataUrl, pxW: w, pxH: h, x: 0, y: 0, cmPerPx: 1000 / Math.max(w, h), opacity: 0.55, rotation: 0 } }))
    setMode('calibrate'); setCalPts([])
  }
  const applyCalibration = () => {
    const u = plan.underlay
    if (!u || calPts.length !== 2 || calDist <= 0) return
    const d = Math.hypot(calPts[1]!.x - calPts[0]!.x, calPts[1]!.y - calPts[0]!.y)
    if (d < 1) return
    const k = calDist / d
    updatePlan((p) => ({ ...p, underlay: { ...u, cmPerPx: u.cmPerPx * k, x: u.x * k, y: u.y * k } }))
    setCalPts([]); setMode('outline')
  }
  const changeMode = (m: EditorMode) => { setMode(m); setContextOpen(true); if (m !== 'select') setSelectedId(null); if (m !== 'room') setRoomDraft([]) }
  const closeRoomDraft = () => {
    if (roomDraft.length < 3) return
    addRoom({ type: roomType, polygon: roomDraft })
    setRoomDraft([])
  }
  const fillWholeFloor = () => { if (plan.outline.length >= 3) addRoom({ type: roomType, polygon: plan.outline.map((q) => ({ ...q })) }) }

  return (
    <div className="mx-auto flex h-[calc(100dvh-3.75rem-env(safe-area-inset-bottom))] w-full max-w-2xl flex-col sm:border-x sm:border-surface-border">
      <PageHeader title="平面圖微調" subtitle={`${plan.name ?? '1F'}${findings.length ? `，${findings.length} 項待處理` : ''}`}
        right={<div className="flex gap-1"><Button variant="ghost" size="icon-sm" aria-label="顯示設定" onClick={() => setSheet('display')}><Eye /></Button><Button variant="ghost" size="icon-sm" aria-label="更多" onClick={() => setSheet('menu')}><MoreHorizontal /></Button></div>} />

      {floors.length > 1 && (
        <div className="flex items-center gap-2 border-b border-surface-border bg-surface px-3 py-1.5">
          <Segmented value={String(activeFloor)} onValueChange={(v) => { setActiveFloor(Number(v)); setSelectedId(null) }} options={floors.map((f, i) => ({ value: String(i), label: f.name ?? `L${f.level ?? 0}` }))} />
          {crossCount > 0 && <Badge variant="destructive">樓上樓下 {crossCount}</Badge>}
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <PlanEditor
          plan={plan} mode={mode} roomType={roomType} itemType={itemType} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); if (id) setContextOpen(true) }}
          onAddOutlinePoint={(p) => updatePlan((pl) => ({ ...pl, outline: [...pl.outline, p] }))}
          onMoveOutlinePoint={(i, p) => updatePlan((pl) => ({ ...pl, outline: pl.outline.map((q, k) => (k === i ? p : q)) }))}
          onAddRoom={(r) => { addRoom(r) }}
          onAddItem={(it) => { const id = addItem({ ...it, roomId: autoRoomId(it.x, it.y, it.w, it.h) }); setSelectedId(id); setMode('select') }}
          onUpdateItem={updateItem}
          overlay={overlay} overlayInfo={overlayInfo}
          calibratePoints={calPts} onCalibratePoint={(p) => setCalPts((c) => (c.length >= 2 ? [p] : [...c, p]))}
          roomShape={roomShape} roomDraft={roomDraft} onRoomDraftPoint={(p) => setRoomDraft((d) => [...d, p])} onRoomDraftClose={closeRoomDraft}
          marks={findings.filter((f) => f.marks?.length).map((f) => f.marks!)}
          highlightIds={findings.flatMap((f) => f.itemIds)}
        />
        {plan.outline.length < 3 && !plan.underlay && mode === 'outline' && (
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-4">
            <div className="pointer-events-auto max-w-sm rounded-xl border border-surface-border bg-surface/95 p-3 text-sm shadow-[var(--menu-shadow)] backdrop-blur">
              <div className="font-medium">還沒有平面圖</div>
              <p className="mt-1 text-xs text-muted-foreground">最快的方式是用精靈，幾步就完成；這裡是進階的手繪與微調工具。</p>
              <Button variant="brand" className="mt-2 w-full" onClick={() => nav('/plan/wizard')}><Sparkles />用精靈建立</Button>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                <Button variant="outline" size="sm" onClick={() => nav('/scan')}><ScanLine />掃描</Button>
                <Button variant="outline" size="sm" onClick={() => { setMode('calibrate'); fileRef.current?.click() }}><ImageIcon />拍照描圖</Button>
                <Button variant="outline" size="sm" onClick={() => { setFloors([demoPlan()]); setHouse({ facingBearing: 180, facingSource: 'manual' }); setMode('select') }}>範例</Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* context panel */}
      <div className="border-t border-surface-border bg-surface">
        <button className="flex w-full items-center justify-between px-3 py-1.5 text-xs text-muted-foreground" onClick={() => setContextOpen((o) => !o)}>
          <span>{contextTitle(mode, selectedItem?.type, selectedRoom?.type)}</span>
          <ChevronUp className={cn('size-4 transition-transform', !contextOpen && 'rotate-180')} />
        </button>
        {contextOpen && (
          <div className="border-t border-surface-border px-3 py-2 text-sm">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadUnderlay(f); e.target.value = '' }} />
            {mode === 'calibrate' && (
              <div className="space-y-2">
                {!plan.underlay ? (
                  <div className="flex items-center gap-2"><Button variant="brandSubtle" onClick={() => fileRef.current?.click()}><ImageIcon />匯入照片或平面圖</Button><span className="text-xs text-muted-foreground">iPhone 可直接拍建商平面圖或草圖</span></div>
                ) : (
                  <>
                    <div className="text-xs text-muted-foreground">在圖上點兩個已知距離的點，輸入實際長度後套用比例。</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input type="number" className="w-24" value={calDist} onChange={(e) => setCalDist(Number(e.target.value) || 0)} /><span className="text-xs">cm</span>
                      <Button variant="brand" onClick={applyCalibration} disabled={calPts.length !== 2}>套用比例（{calPts.length}/2）</Button>
                      <Button variant="ghost" size="icon" aria-label="旋轉 90 度" onClick={() => updatePlan((p) => ({ ...p, underlay: p.underlay && { ...p.underlay, rotation: (p.underlay.rotation + 90) % 360 } }))}><RotateCw /></Button>
                      <label className="flex items-center gap-1 text-xs">透明度<input type="range" min={0.1} max={1} step={0.05} value={plan.underlay.opacity} onChange={(e) => updatePlan((p) => ({ ...p, underlay: p.underlay && { ...p.underlay, opacity: Number(e.target.value) } }))} /></label>
                      <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>換底圖</Button>
                      <Button variant="destructive" size="sm" onClick={() => { updatePlan((p) => ({ ...p, underlay: undefined })); setCalPts([]) }}><Trash2 />移除</Button>
                    </div>
                  </>
                )}
              </div>
            )}
            {mode === 'outline' && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">點擊依序放置轉角，拖曳可微調；至少 3 點後按「閉合」。</span>
                <Button variant="outline" size="sm" onClick={() => updatePlan((p) => ({ ...p, outline: p.outline.slice(0, -1) }))} disabled={!plan.outline.length}><Undo2 />退一步</Button>
                <Button variant="brand" size="sm" onClick={() => { changeMode('room'); setRoomShape('poly') }} disabled={plan.outline.length < 3}>閉合並定房間（{plan.outline.length} 點）</Button>
              </div>
            )}
            {mode === 'room' && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Segmented value={roomShape} onValueChange={(v) => { setRoomShape(v); setRoomDraft([]) }} options={[{ value: 'poly', label: '逐點畫' }, { value: 'rect', label: '拖曳矩形' }]} />
                  {roomShape === 'poly' ? (
                    <>
                      <span className="text-xs text-muted-foreground">點每個牆角，會自動吸附外牆與既有房間；點回第一點或按「閉合」完成。</span>
                      <Button variant="outline" size="sm" onClick={() => setRoomDraft((d) => d.slice(0, -1))} disabled={!roomDraft.length}><Undo2 />退一步</Button>
                      <Button variant="brand" size="sm" onClick={closeRoomDraft} disabled={roomDraft.length < 3}>閉合房間（{roomDraft.length}）</Button>
                    </>
                  ) : <span className="text-xs text-muted-foreground">在圖上拖曳畫出矩形範圍。</span>}
                  {plan.rooms.length === 0 && plan.outline.length >= 3 && <Button variant="ghost" size="sm" onClick={fillWholeFloor}>整層當一個房間</Button>}
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1">{ROOM_TYPES.map((t) => <Chip key={t} active={roomType === t} onClick={() => setRoomType(t)}>{ROOM_ZH[t]}</Chip>)}</div>
              </div>
            )}
            {mode === 'item' && (
              <div className="space-y-1.5">
                <div className="text-xs text-muted-foreground">選物件後點擊放置；放好後可旋轉箭頭方向。</div>
                <div className="flex gap-1.5 overflow-x-auto pb-1">{ITEM_TYPES.map((t) => <Chip key={t} active={itemType === t} onClick={() => setItemType(t)}>{ITEM_ZH[t]}</Chip>)}</div>
              </div>
            )}
            {mode === 'select' && !selectedId && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>點物件可選取、拖曳移動；空白處拖曳平移，雙指或滾輪縮放。北方偏角 {plan.northOffset.toFixed(0)}°。</span>
                <Button variant="outline" size="sm" onClick={alignNorthByMainDoor}>依大門朝向校正北方</Button>
              </div>
            )}
            {selectedItem && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{ITEM_ZH[selectedItem.type]}</span>
                <span className="text-xs text-muted-foreground">箭頭＝{facingHint(selectedItem.type)}，朝{PALACES[palaceOfBearing(((selectedItem.facing + plan.northOffset) % 360 + 360) % 360)].direction}</span>
                <Button variant="outline" size="icon-sm" aria-label="逆時針 15 度" onClick={() => updateItem(selectedItem.id, { facing: (selectedItem.facing + 345) % 360 })}><RotateCcw /></Button>
                <Button variant="outline" size="icon-sm" aria-label="順時針 15 度" onClick={() => updateItem(selectedItem.id, { facing: (selectedItem.facing + 15) % 360 })}><RotateCw /></Button>
                <Button variant="outline" size="sm" onClick={() => updateItem(selectedItem.id, { facing: (selectedItem.facing + 90) % 360 })}>轉 90°</Button>
                <label className="flex items-center gap-1 text-xs">寬<Input type="number" className="h-7 w-16 md:h-7" value={selectedItem.w} onChange={(e) => updateItem(selectedItem.id, { w: Number(e.target.value) || selectedItem.w })} /></label>
                <label className="flex items-center gap-1 text-xs">深<Input type="number" className="h-7 w-16 md:h-7" value={selectedItem.h} onChange={(e) => updateItem(selectedItem.id, { h: Number(e.target.value) || selectedItem.h })} /></label>
                {selectedItem.type === 'beam' && <label className="flex items-center gap-1 text-xs">樑深<Input type="number" className="h-7 w-16 md:h-7" placeholder="cm" value={selectedItem.depthCm ?? ''} onChange={(e) => updateItem(selectedItem.id, { depthCm: Number(e.target.value) || undefined })} /></label>}
                <NativeSelect className="h-7 w-auto md:h-7" value={selectedItem.roomId ?? autoRoomId(selectedItem.x, selectedItem.y, selectedItem.w, selectedItem.h) ?? ''} onChange={(e) => updateItem(selectedItem.id, { roomId: e.target.value || undefined })}>
                  <option value="">自動判定房間</option>{plan.rooms.map((r) => <option key={r.id} value={r.id}>{r.name || ROOM_ZH[r.type]}</option>)}
                </NativeSelect>
                <Button variant="destructive" size="icon-sm" aria-label="刪除" onClick={() => { removeItem(selectedItem.id); setSelectedId(null) }}><Trash2 /></Button>
              </div>
            )}
            {selectedRoom && (
              <div className="flex flex-wrap items-center gap-2">
                <NativeSelect className="h-7 w-auto md:h-7" value={selectedRoom.type} onChange={(e) => updateRoom(selectedRoom.id, { type: e.target.value as RoomType })}>{ROOM_TYPES.map((t) => <option key={t} value={t}>{ROOM_ZH[t]}</option>)}</NativeSelect>
                <Input className="h-7 w-32 md:h-7" placeholder="名稱（選填）" value={selectedRoom.name ?? ''} onChange={(e) => updateRoom(selectedRoom.id, { name: e.target.value })} />
                <Button variant="destructive" size="sm" onClick={() => { removeRoom(selectedRoom.id); setSelectedId(null) }}><Trash2 />刪除房間</Button>
              </div>
            )}
          </div>
        )}
        <div className="grid grid-cols-5 border-t border-surface-border">
          {MODES.map((m) => (
            <button key={m.value} onClick={() => changeMode(m.value)} className={cn('flex h-12 flex-col items-center justify-center gap-0.5 text-[11px]', mode === m.value ? 'bg-brand/10 text-brand' : 'text-muted-foreground')}>
              <m.icon className="size-4" strokeWidth={1.75} />{m.label}
            </button>
          ))}
        </div>
      </div>

      {sheet === 'share' && report && <ShareSheet plan={plan} report={report} onClose={() => setSheet('none')} initialKind={overlayKind === 'palace' ? 'annual' : overlayKind} />}
      {(sheet === 'menu' || sheet === 'display') && (
        <div className="fixed inset-0 z-50" role="dialog">
          <button aria-label="關閉" className="absolute inset-0 bg-black/20" onClick={() => setSheet('none')} />
          <div className="sheet-enter absolute inset-x-0 bottom-0 mx-auto max-w-2xl rounded-t-2xl bg-surface-raised p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[var(--floating-shadow)]">
            <div className="mb-3 flex items-center justify-between"><span className="text-sm font-medium">{sheet === 'menu' ? '平面圖操作' : '顯示設定'}</span><Button variant="ghost" size="icon-sm" onClick={() => setSheet('none')} aria-label="關閉"><X /></Button></div>
            {sheet === 'menu' && (
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="brandSubtle" onClick={() => { setSheet('none'); nav('/plan/wizard') }}><Sparkles />用精靈重新建立</Button>
                  <Button variant="outline" onClick={() => { setSheet('none'); nav('/scan') }}><ScanLine />空間掃描</Button>
                  <Button variant="outline" onClick={() => { setSheet('none'); setMode('calibrate'); fileRef.current?.click() }}><ImageIcon />拍照描圖</Button>
                  <Button variant="outline" onClick={() => { addFloor({ copyOutline: true }); setMode('room'); setSheet('none') }}>新增樓層（複製外牆）</Button>
                  <Button variant="outline" onClick={() => { if (floors.some((f) => f.outline.length) && !confirm('載入範例會取代目前所有樓層，確定？')) return; setFloors([demoPlan()]); setHouse({ facingBearing: 180, facingSource: 'manual' }); setMode('select'); setSheet('none') }}>載入範例</Button>
                </div>
                <div className="grid grid-cols-2 gap-3 border-t border-surface-border pt-3">
                  <label className="flex flex-col gap-1 text-xs">樓層名稱<Input value={plan.name ?? ''} onChange={(e) => updatePlan((p) => ({ ...p, name: e.target.value }))} /></label>
                  <label className="flex flex-col gap-1 text-xs">層序（0 為含大門的主層）<Input type="number" value={plan.level ?? 0} onChange={(e) => updatePlan((p) => ({ ...p, level: Number(e.target.value) || 0 }))} /></label>
                  <label className="flex flex-col gap-1 text-xs">格線（cm）<Input type="number" value={plan.gridCm} onChange={(e) => updatePlan((p) => ({ ...p, gridCm: Math.max(10, Number(e.target.value) || 50) }))} /></label>
                  <label className="flex flex-col gap-1 text-xs">天花板淨高（cm）<Input type="number" placeholder="選填" value={plan.ceilingHeightCm ?? ''} onChange={(e) => updatePlan((p) => ({ ...p, ceilingHeightCm: Number(e.target.value) || undefined }))} /></label>
                  <label className="flex flex-col gap-1 text-xs">北方偏角（度）<Input type="number" value={plan.northOffset} onChange={(e) => updatePlan((p) => ({ ...p, northOffset: ((Number(e.target.value) || 0) % 360 + 360) % 360 }))} /></label>
                </div>
                <div className="flex gap-2 border-t border-surface-border pt-3">
                  <Button variant="destructive" size="sm" onClick={() => { if (confirm('清除本層的外牆、房間與物件？')) { setPlan({ ...plan, outline: [], rooms: [], items: [], underlay: undefined }); setMode('outline'); setSelectedId(null); setSheet('none') } }}>清除本層</Button>
                  {floors.length > 1 && <Button variant="destructive" size="sm" onClick={() => { if (confirm(`刪除 ${plan.name ?? '本層'}？`)) { removeFloor(activeFloor); setSheet('none') } }}>刪除本層</Button>}
                </div>
              </div>
            )}
            {sheet === 'display' && (
              <div className="space-y-3 text-sm">
                <label className="flex flex-col gap-1 text-xs">九宮疊圖<Segmented value={overlay} onValueChange={(v) => { setOverlay(v); if (v !== 'none') setSettings({ gridStyle: v }) }} options={[{ value: 'none', label: '無' }, { value: 'pie', label: '八方扇形' }, { value: 'grid', label: '九宮格' }]} /></label>
                <label className="flex flex-col gap-1 text-xs">疊圖內容<Segmented value={overlayKind} onValueChange={setOverlayKind} options={[{ value: 'palace', label: '方位' }, { value: 'bazhai', label: '八宅' }, { value: 'stars', label: '飛星' }, { value: 'annual', label: '流年' }]} /></label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--brand)]" checked={showFindings} onChange={(e) => setShowFindings(e.target.checked)} />在圖上標示形勢問題</label>
                <Button variant="brandSubtle" className="w-full" onClick={() => setSheet('share')}><Share2 />分享分析圖（PNG）</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={cn('shrink-0 rounded-lg border px-2.5 py-1.5 text-xs', active ? 'border-brand bg-brand/10 text-foreground' : 'border-border text-muted-foreground')}>{children}</button>
}

function contextTitle(mode: EditorMode, itemType?: ItemType, roomType?: RoomType): string {
  if (itemType) return `已選取：${ITEM_ZH[itemType]}`
  if (roomType) return `已選取房間：${ROOM_ZH[roomType]}`
  return { calibrate: '底圖：匯入照片並校正比例', outline: '外牆：點擊放置轉角', room: '定房間：逐點畫出每個房間', item: '物件：點擊放置', select: '選取與移動' }[mode]
}

function facingHint(t: ItemType): string {
  switch (t) {
    case 'mainDoor': case 'door': return '開門進入屋內的方向'
    case 'bed': return '床頭方向'
    case 'stove': return '灶口朝向'
    case 'desk': case 'sofa': return '人坐時面向'
    case 'mirror': return '鏡面朝向'
    case 'altar': return '神位面向'
    case 'window': return '窗外方向'
    case 'lamp': case 'beam': case 'column': return '不影響'
    default: return '正面方向'
  }
}

function inPoly(p: { x: number; y: number }, poly: { x: number; y: number }[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!, b = poly[j]!
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}
