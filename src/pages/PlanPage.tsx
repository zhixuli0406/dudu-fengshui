import { useMemo, useState } from 'react'
import { PlanEditor, type EditorMode } from '../components/PlanEditor'
import { Button, inputCls } from '../components/ui'
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

const ROOM_TYPES: RoomType[] = ['living', 'master', 'bedroom', 'kids', 'study', 'kitchen', 'dining', 'bathroom', 'entry', 'balcony', 'altar', 'storage', 'corridor', 'driveway', 'void', 'other']
const ITEM_TYPES: ItemType[] = ['mainDoor', 'door', 'window', 'bed', 'stove', 'sink', 'fridge', 'toilet', 'desk', 'sofa', 'mirror', 'beam', 'lamp', 'altar', 'stairs', 'elevator', 'aquarium', 'column', 'tv', 'plant']

export function PlanPage() {
  const { plan, floors, activeFloor, setActiveFloor, addFloor, removeFloor, updatePlan, addRoom, updateRoom, removeRoom, addItem, updateItem, removeItem, setPlan, house, setHouse, persons, settings, setSettings } = useAppStore()
  const [mode, setMode] = useState<EditorMode>(plan.outline.length >= 3 ? 'select' : 'outline')
  const [roomType, setRoomType] = useState<RoomType>('living')
  const [itemType, setItemType] = useState<ItemType>('mainDoor')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [overlay, setOverlay] = useState<'none' | 'pie' | 'grid'>('pie')
  const [overlayKind, setOverlayKind] = useState<'palace' | 'bazhai' | 'stars' | 'annual'>('palace')
  const [showFindings, setShowFindings] = useState(true)

  const selectedItem = plan.items.find((i) => i.id === selectedId)
  const selectedRoom = plan.rooms.find((r) => r.id === selectedId)
  const findings = useMemo(() => (showFindings ? runFormRules(plan) : []), [plan, showFindings])
  const crossCount = useMemo(() => (floors.length > 1 ? runAllFormRules(floors).filter((f) => f.floor?.includes('／')).length : 0), [floors])

  const report = useMemo(() => {
    if (overlayKind === 'palace') return null
    try { return buildReport(persons, { facingBearing: house.facingBearing, periodYear: house.periodYear, plan, stoveMode: house.stoveMode, jianxiangTolerance: house.jianxiangTolerance, replacementMode: house.replacementMode }) } catch { return null }
  }, [overlayKind, persons, house.facingBearing, house.periodYear, plan])

  const overlayInfo = useMemo<Partial<Record<Trigram, PalaceOverlayInfo>> | undefined>(() => {
    if (!report) return undefined
    const out: Partial<Record<Trigram, PalaceOverlayInfo>> = {}
    for (const p of report.xuankong.palaces) {
      if (overlayKind === 'stars') out[p.palace] = { lines: [`${p.mountainStar} ${p.waterStar}`, `運${p.periodStar}`], tone: p.combo.rating === 'great' || p.combo.rating === 'good' ? 'good' : p.combo.rating === 'bad' || p.combo.rating === 'terrible' ? 'bad' : 'neutral' }
      if (overlayKind === 'annual') out[p.palace] = { lines: [`${NINE_STARS[p.annualStar]!.zh}`], tone: [5, 2, 3, 7].includes(p.annualStar) ? 'bad' : [8, 9, 1, 6, 4].includes(p.annualStar) ? 'good' : 'neutral' }
      if (overlayKind === 'bazhai') {
        const primary = report.persons.find((x) => x.person.primary) ?? report.persons[0]
        if (primary) {
          const star = primary.stars[p.palace]
          const zh = { shengqi: '生氣', tianyi: '天醫', yannian: '延年', fuwei: '伏位', huohai: '禍害', liusha: '六煞', wugui: '五鬼', jueming: '絕命' }[star]
          out[p.palace] = { lines: [zh], tone: ['shengqi', 'tianyi', 'yannian', 'fuwei'].includes(star) ? 'good' : 'bad' }
        }
      }
    }
    return out
  }, [report, overlayKind])

  const alignNorthByMainDoor = () => {
    const md = plan.items.find((i) => i.type === 'mainDoor')
    if (!md) { alert('請先放置「大門」並把箭頭轉到屋內方向'); return }
    // door facing points inside; facing outward on screen = md.facing + 180; compass facing bearing = house.facingBearing
    const northOffset = ((house.facingBearing - (md.facing + 180)) % 360 + 360) % 360
    updatePlan((p) => ({ ...p, northOffset: Math.round(northOffset * 10) / 10 }))
  }

  const closeOutline = () => { if (plan.outline.length >= 3) setMode('select') }
  const undoOutline = () => updatePlan((p) => ({ ...p, outline: p.outline.slice(0, -1) }))
  const clearAll = () => { if (confirm('清除整張平面圖？')) { setPlan({ ...plan, outline: [], rooms: [], items: [] }); setMode('outline'); setSelectedId(null) } }
  const loadDemo = () => { setPlan(demoPlan()); setHouse({ facingBearing: 180, facingSource: 'manual' }); setMode('select'); setSelectedId(null) }
  const autoRoomId = (x: number, y: number, w: number, h: number) => plan.rooms.find((r) => r.polygon.length >= 3 && inPoly({ x: x + w / 2, y: y + h / 2 }, r.polygon))?.id

  return (
    <div className="flex flex-col h-[calc(100dvh-4.5rem)] max-w-3xl mx-auto safe-t">
      <div className="px-3 pt-2 flex items-center justify-between">
        <h1 className="font-serif text-xl font-bold text-gold">平面圖</h1>
        <div className="flex gap-1 text-xs">
          <button className="px-2 py-1 rounded bg-ink-3" onClick={loadDemo}>載入範例</button>
          <button className="px-2 py-1 rounded bg-ink-3" onClick={clearAll}>清除</button>
        </div>
      </div>
      {/* floors bar */}
      <div className="px-3 pb-1 flex gap-1 overflow-x-auto text-xs items-center">
        <span className="text-paper/50 shrink-0">樓層</span>
        {floors.map((f, i) => <button key={i} onClick={() => { setActiveFloor(i); setSelectedId(null) }} className={`shrink-0 px-2 py-1 rounded-md ${i === activeFloor ? 'bg-gold text-ink font-semibold' : 'bg-ink-2 text-paper/80'}`}>{f.name ?? `L${f.level ?? 0}`}</button>)}
        <button className="shrink-0 px-2 py-1 rounded-md bg-ink-2 text-gold" onClick={() => { addFloor({ copyOutline: true }); setMode('room') }}>＋樓層（複製外牆）</button>
        {floors.length > 1 && <button className="shrink-0 px-2 py-1 rounded-md bg-ink-2 text-red-300" onClick={() => { if (confirm(`刪除 ${plan.name ?? '本層'}？`)) removeFloor(activeFloor) }}>刪除本層</button>}
        <input className="w-16 rounded bg-ink px-1 py-0.5 shrink-0" value={plan.name ?? ''} placeholder="名稱" onChange={(e) => updatePlan((p) => ({ ...p, name: e.target.value }))} />
        <label className="shrink-0 flex items-center gap-1">層序<input type="number" className="w-12 rounded bg-ink px-1 py-0.5" value={plan.level ?? 0} onChange={(e) => updatePlan((p) => ({ ...p, level: Number(e.target.value) || 0 }))} /></label>
        {crossCount > 0 && <span className="shrink-0 text-red-300">樓上樓下問題 {crossCount}</span>}
      </div>
      {/* mode bar */}
      <div className="px-3 py-2 flex gap-1 overflow-x-auto text-xs">
        {([['outline', '外牆'], ['room', '房間'], ['item', '物件'], ['select', '選取／移動']] as [EditorMode, string][]).map(([m, l]) => (
          <button key={m} onClick={() => setMode(m)} className={`shrink-0 px-3 py-1.5 rounded-lg ${mode === m ? 'bg-gold text-ink font-semibold' : 'bg-ink-2 text-paper/80'}`}>{l}</button>
        ))}
        <span className="mx-1 border-l border-ink-3" />
        <select className="shrink-0 rounded-lg bg-ink-2 px-2 text-paper/80" value={overlay} onChange={(e) => setOverlay(e.target.value as typeof overlay)}>
          <option value="none">無疊圖</option><option value="pie">八方扇形</option><option value="grid">九宮格</option>
        </select>
        <select className="shrink-0 rounded-lg bg-ink-2 px-2 text-paper/80" value={overlayKind} onChange={(e) => setOverlayKind(e.target.value as typeof overlayKind)}>
          <option value="palace">方位</option><option value="bazhai">八宅遊星</option><option value="stars">飛星（山向）</option><option value="annual">流年星</option>
        </select>
        <label className="shrink-0 flex items-center gap-1 text-paper/80"><input type="checkbox" checked={showFindings} onChange={(e) => setShowFindings(e.target.checked)} />標示煞</label>
      </div>
      {/* sub bar */}
      <div className="px-3 pb-2 flex gap-1 overflow-x-auto text-xs items-center">
        {mode === 'outline' && (<>
          <span className="text-paper/60 shrink-0">點擊依序放置外牆轉角（順時針），完成後按「閉合」</span>
          <Button variant="subtle" className="!py-1 !px-2 shrink-0" onClick={undoOutline} disabled={!plan.outline.length}>退一步</Button>
          <Button className="!py-1 !px-2 shrink-0" onClick={closeOutline} disabled={plan.outline.length < 3}>閉合（{plan.outline.length} 點）</Button>
        </>)}
        {mode === 'room' && (<>
          <span className="text-paper/60 shrink-0">拖曳畫出房間：</span>
          {ROOM_TYPES.map((t) => <button key={t} onClick={() => setRoomType(t)} className={`shrink-0 px-2 py-1 rounded ${roomType === t ? 'bg-gold text-ink' : 'bg-ink-2'}`}>{ROOM_ZH[t]}</button>)}
        </>)}
        {mode === 'item' && (<>
          <span className="text-paper/60 shrink-0">點擊放置：</span>
          {ITEM_TYPES.map((t) => <button key={t} onClick={() => setItemType(t)} className={`shrink-0 px-2 py-1 rounded ${itemType === t ? 'bg-gold text-ink' : 'bg-ink-2'}`}>{ITEM_ZH[t]}</button>)}
        </>)}
        {mode === 'select' && !selectedId && <span className="text-paper/60">點物件可選取、拖曳移動；空白處拖曳平移、雙指或滾輪縮放。北方：{plan.northOffset.toFixed(0)}°
          <button className="ml-2 underline text-gold" onClick={alignNorthByMainDoor}>依大門朝向校正北方</button></span>}
        {selectedItem && (<>
          <span className="font-semibold shrink-0">{ITEM_ZH[selectedItem.type]}</span>
          <Button variant="subtle" className="!py-1 !px-2" onClick={() => updateItem(selectedItem.id, { facing: (selectedItem.facing + 345) % 360 })}>↺15°</Button>
          <Button variant="subtle" className="!py-1 !px-2" onClick={() => updateItem(selectedItem.id, { facing: (selectedItem.facing + 15) % 360 })}>↻15°</Button>
          <Button variant="subtle" className="!py-1 !px-2" onClick={() => updateItem(selectedItem.id, { facing: (selectedItem.facing + 90) % 360 })}>↻90°</Button>
          <label className="flex items-center gap-1 shrink-0">寬<input type="number" className="w-16 rounded bg-ink px-1 py-0.5" value={selectedItem.w} onChange={(e) => updateItem(selectedItem.id, { w: Number(e.target.value) || selectedItem.w })} /></label>
          <label className="flex items-center gap-1 shrink-0">深<input type="number" className="w-16 rounded bg-ink px-1 py-0.5" value={selectedItem.h} onChange={(e) => updateItem(selectedItem.id, { h: Number(e.target.value) || selectedItem.h })} /></label>
          {selectedItem.type === 'beam' && <label className="flex items-center gap-1 shrink-0">樑深cm<input type="number" className="w-14 rounded bg-ink px-1 py-0.5" value={selectedItem.depthCm ?? ''} placeholder="30" onChange={(e) => updateItem(selectedItem.id, { depthCm: Number(e.target.value) || undefined })} /></label>}
          <select className="rounded bg-ink px-1 py-0.5 shrink-0" value={selectedItem.roomId ?? autoRoomId(selectedItem.x, selectedItem.y, selectedItem.w, selectedItem.h) ?? ''} onChange={(e) => updateItem(selectedItem.id, { roomId: e.target.value || undefined })}>
            <option value="">（自動判定房間）</option>
            {plan.rooms.map((r) => <option key={r.id} value={r.id}>{r.name || ROOM_ZH[r.type]}</option>)}
          </select>
          <Button variant="danger" className="!py-1 !px-2 shrink-0" onClick={() => { removeItem(selectedItem.id); setSelectedId(null) }}>刪除</Button>
          <span className="text-paper/50 shrink-0">箭頭＝{facingHint(selectedItem.type)} · 方位 {PALACES[palaceOfBearing(((selectedItem.facing + plan.northOffset) % 360 + 360) % 360)].direction}</span>
        </>)}
        {selectedRoom && (<>
          <select className={`${inputCls} !w-auto !py-1`} value={selectedRoom.type} onChange={(e) => updateRoom(selectedRoom.id, { type: e.target.value as RoomType })}>
            {ROOM_TYPES.map((t) => <option key={t} value={t}>{ROOM_ZH[t]}</option>)}
          </select>
          <input className={`${inputCls} !w-28 !py-1`} placeholder="名稱" value={selectedRoom.name ?? ''} onChange={(e) => updateRoom(selectedRoom.id, { name: e.target.value })} />
          <Button variant="danger" className="!py-1 !px-2 shrink-0" onClick={() => { removeRoom(selectedRoom.id); setSelectedId(null) }}>刪除房間</Button>
        </>)}
      </div>
      <div className="flex-1 min-h-0 border-y border-ink-3">
        <PlanEditor
          plan={plan} mode={mode} roomType={roomType} itemType={itemType} selectedId={selectedId} onSelect={setSelectedId}
          onAddOutlinePoint={(p) => updatePlan((pl) => ({ ...pl, outline: [...pl.outline, p] }))}
          onMoveOutlinePoint={(i, p) => updatePlan((pl) => ({ ...pl, outline: pl.outline.map((q, k) => (k === i ? p : q)) }))}
          onAddRoom={(r) => { addRoom(r); setMode('select') }}
          onAddItem={(it) => { const id = addItem({ ...it, roomId: autoRoomId(it.x, it.y, it.w, it.h) }); setSelectedId(id); setMode('select') }}
          onUpdateItem={updateItem}
          overlay={overlay} overlayInfo={overlayInfo}
          marks={findings.filter((f) => f.marks?.length).map((f) => f.marks!)}
          highlightIds={findings.flatMap((f) => f.itemIds)}
        />
      </div>
      <div className="px-3 py-2 text-xs flex items-center gap-3 overflow-x-auto">
        <label className="flex items-center gap-1 shrink-0">格線 <input type="number" className="w-14 rounded bg-ink px-1 py-0.5" value={plan.gridCm} onChange={(e) => updatePlan((p) => ({ ...p, gridCm: Math.max(10, Number(e.target.value) || 50) }))} /> cm</label>
        <label className="flex items-center gap-1 shrink-0">淨高 <input type="number" className="w-14 rounded bg-ink px-1 py-0.5" value={plan.ceilingHeightCm ?? ''} placeholder="cm" onChange={(e) => updatePlan((p) => ({ ...p, ceilingHeightCm: Number(e.target.value) || undefined }))} /></label>
        <label className="flex items-center gap-1 shrink-0">北方偏角 <input type="number" className="w-16 rounded bg-ink px-1 py-0.5" value={plan.northOffset} onChange={(e) => updatePlan((p) => ({ ...p, northOffset: ((Number(e.target.value) || 0) % 360 + 360) % 360 }))} />°</label>
        <label className="flex items-center gap-1 shrink-0">九宮 <select className="rounded bg-ink px-1 py-0.5" value={settings.gridStyle} onChange={(e) => { setSettings({ gridStyle: e.target.value as 'pie' | 'grid' }); setOverlay(e.target.value as 'pie' | 'grid') }}><option value="pie">扇形</option><option value="grid">方格</option></select></label>
        <span className="text-paper/50 shrink-0">形勢問題 {findings.length} 項</span>
      </div>
    </div>
  )
}

function facingHint(t: ItemType): string {
  switch (t) {
    case 'mainDoor': case 'door': return '開門進入屋內的方向'
    case 'bed': return '床頭方向'
    case 'stove': return '灶口（開關面）朝向'
    case 'desk': case 'sofa': return '人坐時面向'
    case 'mirror': return '鏡面朝向'
    case 'altar': return '神位面向'
    case 'window': return '窗外方向'
    case 'lamp': case 'beam': case 'column': return '（方向不影響）'
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
