import { useState } from 'react'
import { Card } from '../components/ui'
import { PALACES, TRIGRAMS_CLOCKWISE } from '../engine/bagua'
import { MOUNTAINS } from '../engine/mountains24'
import { starMap, WANDERING_STARS } from '../engine/bazhai'
import { NINE_STARS } from '../engine/stars'
import { ELEMENT_ATTRS, ELEMENT_ZH, type Element } from '../engine/fiveElements'
import { PERIODS } from '../engine/xuankong'
import type { Trigram } from '../engine/bagua'
import catalog from '../data/formRulesCatalog.json'
import { lubanLookup } from '../engine/luban'

interface CatalogRule { id: string; category: string; name: string; condition: string; algorithm: string; severity: string; affects: string; explanation: string; remedy: string }
const CATALOG = catalog as CatalogRule[]

export function KnowledgePage() {
  const [gua, setGua] = useState<Trigram>('kan')
  const [cat, setCat] = useState<string>('all')
  const [q, setQ] = useState('')
  const [len, setLen] = useState(81)
  const luban = lubanLookup(len)
  const sm = starMap(gua)
  const cats = [...new Set(CATALOG.map((r) => r.category))]
  const shown = CATALOG.filter((r) => (cat === 'all' || r.category === cat) && (!q || (r.name + r.explanation + r.remedy).includes(q)))
  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto safe-t">
      <h1 className="font-serif text-2xl font-bold text-gold pt-2">風水知識庫</h1>
      <p className="text-xs text-paper/60">以下資料即為本程式引擎使用的規則表；完整來源與各派分歧請見專案 docs/research。</p>

      <Card title="八宅遊星表">
        <div className="flex gap-1 flex-wrap mb-2">
          {TRIGRAMS_CLOCKWISE.map((t) => <button key={t} onClick={() => setGua(t)} className={`px-2 py-1 rounded-md text-sm font-serif ${gua === t ? 'bg-gold text-ink' : 'bg-ink text-paper/80'}`}>{PALACES[t].zh}</button>)}
        </div>
        <table className="w-full text-sm">
          <thead><tr className="text-paper/60 text-xs"><th className="text-left py-1">方位</th><th className="text-left">遊星</th><th className="text-left">五行</th><th className="text-left">主事</th></tr></thead>
          <tbody>
            {TRIGRAMS_CLOCKWISE.map((t) => { const s = WANDERING_STARS[sm[t]]; return (
              <tr key={t} className="border-t border-ink-3/60"><td className="py-1">{PALACES[t].direction}（{PALACES[t].zh}）</td><td className={s.auspicious ? 'text-emerald-300' : 'text-red-300'}>{s.zh}</td><td>{ELEMENT_ZH[s.element]}</td><td className="text-paper/70 text-xs">{s.keyword}</td></tr>) })}
          </tbody>
        </table>
      </Card>

      <Card title="九星（玄空）">
        <ul className="space-y-1 text-sm">
          {Object.values(NINE_STARS).map((s) => (
            <li key={s.n} className="border-t border-ink-3/60 pt-1"><span className="font-serif text-gold">{s.zh}{s.name}</span> · {ELEMENT_ZH[s.element]} · <span className={s.nature === 'auspicious' ? 'text-emerald-300' : s.nature === 'inauspicious' ? 'text-red-300' : 'text-paper/80'}>{s.keywords}</span><div className="text-xs text-paper/60">化解／催旺：{s.remedy}</div></li>
          ))}
        </ul>
      </Card>

      <Card title="二十四山">
        <div className="grid grid-cols-3 gap-1 text-xs">
          {MOUNTAINS.map((m) => <div key={m.name} className="rounded bg-ink px-2 py-1"><span className="font-serif text-base text-gold">{m.name}</span> {PALACES[m.palace].zh}宮 {m.start}°–{m.end}° <span className={m.yang ? 'text-paper' : 'text-gold'}>{m.yang ? '陽' : '陰'}</span></div>)}
        </div>
      </Card>

      <Card title="五行屬性">
        <table className="w-full text-xs">
          <thead><tr className="text-paper/60"><th className="text-left">五行</th><th className="text-left">顏色</th><th className="text-left">材質</th><th className="text-left">形狀</th><th className="text-left">方位</th></tr></thead>
          <tbody>{(Object.keys(ELEMENT_ATTRS) as Element[]).map((e) => { const a = ELEMENT_ATTRS[e]; return <tr key={e} className="border-t border-ink-3/60"><td className="py-1">{ELEMENT_ZH[e]}</td><td>{a.colors.join('、')}</td><td>{a.materials.join('、')}</td><td>{a.shapes}</td><td>{a.direction}</td></tr> })}</tbody>
        </table>
      </Card>

      <Card title={`形勢派規則庫（${CATALOG.length} 條，摘自調研報告）`}>
        <div className="flex gap-1 flex-wrap mb-2">
          <button onClick={() => setCat('all')} className={`px-2 py-1 rounded-md text-xs ${cat === 'all' ? 'bg-gold text-ink' : 'bg-ink text-paper/80'}`}>全部</button>
          {cats.map((c) => <button key={c} onClick={() => setCat(c)} className={`px-2 py-1 rounded-md text-xs ${cat === c ? 'bg-gold text-ink' : 'bg-ink text-paper/80'}`}>{c}</button>)}
        </div>
        <input className="w-full rounded-lg bg-ink border border-ink-3 px-3 py-1.5 text-sm mb-2" placeholder="搜尋（例：床頭、鏡、樑）" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="space-y-2 text-sm max-h-[60vh] overflow-y-auto pr-1">
          {shown.slice(0, 80).map((r) => (
            <li key={r.id} className="rounded-xl bg-ink p-3">
              <div className="font-semibold">{r.name} <span className="text-[10px] text-paper/50">{r.category} · {r.severity}</span></div>
              <div className="text-xs text-paper/70 mt-1">{r.explanation}</div>
              <div className="text-xs text-gold/80 mt-1">化解：{r.remedy}</div>
              <details className="text-[11px] text-paper/50 mt-1"><summary>判定條件</summary>{r.condition}{r.algorithm ? `（${r.algorithm}）` : ''}</details>
            </li>
          ))}
          {shown.length > 80 && <li className="text-xs text-paper/50">僅顯示前 80 條，請用搜尋縮小範圍。</li>}
        </ul>
      </Card>

      <Card title="魯班尺（文公尺）查表">
        <div className="flex items-center gap-2 text-sm">
          <input type="number" step="0.1" className="w-28 rounded-lg bg-ink border border-ink-3 px-2 py-1" value={len} onChange={(e) => setLen(Number(e.target.value) || 0)} /> cm →
          <span className={`font-serif text-lg ${luban.auspicious ? 'text-emerald-300' : 'text-red-300'}`}>{luban.word}{luban.sub ? `・${luban.sub}` : ''}（{luban.luck}）</span>
        </div>
        <div className="text-xs text-paper/60 mt-1">門寬、門高、桌面、床架等尺寸宜落在「財、義、官、本」四吉字。附近吉數：{luban.suggestions.map((s) => `${s.from}–${s.to}（${s.word}）`).join('、')}</div>
      </Card>

      <Card title="三元九運">
        <div className="grid grid-cols-3 gap-1 text-xs">{PERIODS.map((p) => <div key={p.start} className="rounded bg-ink px-2 py-1">{p.yuan}{p.period}運 {p.start}–{p.end}</div>)}</div>
      </Card>
    </div>
  )
}
