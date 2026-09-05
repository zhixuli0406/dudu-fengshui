import { useState } from 'react'
import { Page, PageHeader } from '../components/AppShell'
import { Input, Segmented } from '../components/mds'
import { PALACES, TRIGRAMS_CLOCKWISE, type Trigram } from '../engine/bagua'
import { MOUNTAINS } from '../engine/mountains24'
import { starMap, WANDERING_STARS } from '../engine/bazhai'
import { NINE_STARS } from '../engine/stars'
import { ELEMENT_ATTRS, ELEMENT_ZH, type Element } from '../engine/fiveElements'
import { PERIODS } from '../engine/xuankong'
import catalog from '../data/formRulesCatalog.json'
import { lubanLookup } from '../engine/luban'
import { cn } from '../lib/utils'

interface CatalogRule { id: string; category: string; name: string; condition: string; algorithm: string; severity: string; affects: string; explanation: string; remedy: string }
const CATALOG = catalog as CatalogRule[]
type Section = 'bazhai' | 'stars' | 'mountains' | 'rules' | 'luban'

export function KnowledgePage() {
  const [section, setSection] = useState<Section>('bazhai')
  const [gua, setGua] = useState<Trigram>('kan')
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')
  const [len, setLen] = useState(81)
  const sm = starMap(gua)
  const cats = [...new Set(CATALOG.map((r) => r.category))]
  const shown = CATALOG.filter((r) => (cat === 'all' || r.category === cat) && (!q || (r.name + r.explanation + r.remedy).includes(q)))
  const luban = lubanLookup(len)
  return (
    <>
      <PageHeader title="知識庫" back subtitle="程式引擎使用的規則表" />
      <Page className="space-y-5">
        <Segmented value={section} onValueChange={setSection} className="w-full" options={[{ value: 'bazhai', label: '八宅' }, { value: 'stars', label: '九星' }, { value: 'mountains', label: '二十四山' }, { value: 'rules', label: '規則庫' }, { value: 'luban', label: '魯班尺' }]} />

        {section === 'bazhai' && (
          <section className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {TRIGRAMS_CLOCKWISE.map((t) => <button key={t} onClick={() => setGua(t)} className={cn('rounded-lg border px-3 py-1.5 text-sm', gua === t ? 'border-brand bg-brand/10' : 'border-border text-muted-foreground')}>{PALACES[t].zh}宅</button>)}
            </div>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1 font-medium">方位</th><th className="font-medium">遊星</th><th className="font-medium">五行</th><th className="font-medium">主事</th></tr></thead>
              <tbody className="divide-y divide-surface-border">
                {TRIGRAMS_CLOCKWISE.map((t) => { const s = WANDERING_STARS[sm[t]]; return <tr key={t}><td className="py-1.5">{PALACES[t].direction}</td><td className={s.auspicious ? 'text-brand' : 'text-destructive'}>{s.zh}</td><td>{ELEMENT_ZH[s.element]}</td><td className="text-xs text-muted-foreground">{s.keyword}</td></tr> })}
              </tbody>
            </table>
            <div>
              <h3 className="text-sm font-medium">五行屬性</h3>
              <table className="mt-1 w-full text-xs">
                <thead><tr className="text-left text-muted-foreground"><th className="font-medium">五行</th><th className="font-medium">顏色</th><th className="font-medium">材質</th><th className="font-medium">形狀</th><th className="font-medium">方位</th></tr></thead>
                <tbody className="divide-y divide-surface-border">{(Object.keys(ELEMENT_ATTRS) as Element[]).map((e) => { const a = ELEMENT_ATTRS[e]; return <tr key={e}><td className="py-1">{ELEMENT_ZH[e]}</td><td>{a.colors.join('、')}</td><td>{a.materials.join('、')}</td><td>{a.shapes}</td><td>{a.direction}</td></tr> })}</tbody>
              </table>
            </div>
          </section>
        )}

        {section === 'stars' && (
          <section className="space-y-3">
            <ul className="divide-y divide-surface-border rounded-xl border border-surface-border bg-surface text-sm">
              {Object.values(NINE_STARS).map((s) => (
                <li key={s.n} className="px-4 py-3"><span className="font-medium">{s.zh}{s.name}</span><span className="ml-2 text-muted-foreground">{ELEMENT_ZH[s.element]}</span><div className={cn('mt-0.5', s.nature === 'auspicious' ? 'text-brand' : s.nature === 'inauspicious' ? 'text-destructive' : '')}>{s.keywords}</div><div className="mt-0.5 text-xs text-muted-foreground">{s.remedy}</div></li>
              ))}
            </ul>
            <div>
              <h3 className="text-sm font-medium">三元九運</h3>
              <div className="mt-1 grid grid-cols-3 gap-1 text-xs">{PERIODS.map((p) => <div key={p.start} className="rounded-md bg-muted px-2 py-1">{p.yuan}{p.period}運 {p.start}–{p.end}</div>)}</div>
            </div>
          </section>
        )}

        {section === 'mountains' && (
          <div className="grid grid-cols-3 gap-1.5 text-xs">
            {MOUNTAINS.map((m) => <div key={m.name} className="rounded-md bg-muted px-2 py-1.5"><span className="mr-1 text-base">{m.name}</span>{PALACES[m.palace].zh}宮 {m.start}°–{m.end}°<span className="ml-1 text-muted-foreground">{m.yang ? '陽' : '陰'}</span></div>)}
          </div>
        )}

        {section === 'rules' && (
          <section className="space-y-3">
            <Input placeholder="搜尋：床頭、鏡、樑…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              <button onClick={() => setCat('all')} className={cn('shrink-0 rounded-lg border px-2.5 py-1 text-xs', cat === 'all' ? 'border-brand bg-brand/10' : 'border-border text-muted-foreground')}>全部 {CATALOG.length}</button>
              {cats.map((c) => <button key={c} onClick={() => setCat(c)} className={cn('shrink-0 rounded-lg border px-2.5 py-1 text-xs', cat === c ? 'border-brand bg-brand/10' : 'border-border text-muted-foreground')}>{c}</button>)}
            </div>
            <ul className="divide-y divide-surface-border rounded-xl border border-surface-border bg-surface text-sm">
              {shown.slice(0, 60).map((r) => (
                <li key={r.id} className="px-4 py-3">
                  <div className="font-medium">{r.name}<span className="ml-2 text-xs text-muted-foreground">{r.category}，{r.severity}</span></div>
                  <div className="mt-1 text-xs text-muted-foreground">{r.explanation}</div>
                  <div className="mt-1 text-xs">化解：{r.remedy}</div>
                  <details className="mt-1 text-xs text-muted-foreground"><summary className="cursor-pointer">判定條件</summary>{r.condition}{r.algorithm ? `（${r.algorithm}）` : ''}</details>
                </li>
              ))}
              {shown.length > 60 && <li className="px-4 py-2 text-xs text-muted-foreground">僅顯示前 60 條，請用搜尋縮小範圍。</li>}
            </ul>
          </section>
        )}

        {section === 'luban' && (
          <section className="space-y-3 text-sm">
            <div className="flex items-center gap-2"><Input type="number" step="0.1" className="w-28" value={len} onChange={(e) => setLen(Number(e.target.value) || 0)} /><span>cm</span><span className={cn('text-lg font-medium', luban.auspicious ? 'text-brand' : 'text-destructive')}>{luban.word}{luban.sub ? `・${luban.sub}` : ''}（{luban.luck}）</span></div>
            <p className="text-xs text-muted-foreground">門寬、門高、桌面、床架等尺寸宜落在財、義、官、本四吉字。附近吉數：{luban.suggestions.map((s) => `${s.from}–${s.to}（${s.word}）`).join('、')}</p>
          </section>
        )}
      </Page>
    </>
  )
}
