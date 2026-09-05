import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Printer, Share2 } from 'lucide-react'
import { ShareSheet } from '../components/ShareSheet'
import { Page, PageHeader } from '../components/AppShell'
import { Badge, Button, Empty, Segmented } from '../components/mds'
import { useAppStore } from '../store/useAppStore'
import { buildReport, type Report } from '../engine/report'
import { PALACES, TRIGRAMS_CLOCKWISE, type Trigram } from '../engine/bagua'
import { groupZh, WANDERING_STARS } from '../engine/bazhai'
import { NINE_STARS, RATING_ZH } from '../engine/stars'
import { TIMELINESS_ZH } from '../engine/xuankong'
import { palaceLabel } from '../engine/annual'
import { ROOM_ZH, mainFloor } from '../engine/floorplan'
import { SEVERITY_ZH } from '../engine/rules'
import { reportToMarkdown } from '../engine/exportMarkdown'
import { environmentFindings, type EnvironmentQuestion } from '../engine/environment'
import envQuestions from '../data/environmentQuestions.json'
import { cn } from '../lib/utils'

type Tab = 'summary' | 'bazhai' | 'xuankong' | 'annual' | 'form' | 'element'

export function ReportPage() {
  const { persons, house, plan, floors, environment } = useAppStore()
  const [tab, setTab] = useState<Tab>('summary')
  const [share, setShare] = useState(false)
  const report = useMemo<Report | null>(() => {
    try {
      const mainPlan = mainFloor(floors.length ? floors : [plan])
      const r = buildReport(persons, { facingBearing: house.facingBearing, periodYear: house.periodYear, plan: mainPlan, floors: floors.length ? floors : [plan], stoveMode: house.stoveMode, jianxiangTolerance: house.jianxiangTolerance, replacementMode: house.replacementMode })
      const env = environmentFindings(environment as Record<string, string | boolean | undefined>, envQuestions as EnvironmentQuestion[])
      if (!env.length) return r
      const order = { high: 0, medium: 1, low: 2 }
      const findings = [...r.form.findings, ...env].sort((a, b) => order[a.severity] - order[b.severity])
      const penalty = env.reduce((a, f) => a + ({ high: 12, medium: 6, low: 2 })[f.severity] * (f.contested ? 0.5 : 1), 0)
      const form = Math.max(0, r.form.score - penalty)
      const overall = Math.round(r.scores.bazhai * 0.25 + r.scores.xuankong * 0.25 + r.scores.annual * 0.15 + form * 0.35)
      return { ...r, form: { findings, score: form }, scores: { ...r.scores, form, overall } }
    } catch (e) { console.error(e); return null }
  }, [persons, house, plan, floors, environment])

  if (!report) return <Page><Empty tone="destructive" title="無法產生報告" description="請確認資料頁的設定。" /></Page>
  const missing: { text: string; to: string }[] = []
  if (persons.length === 0) missing.push({ text: '尚未新增家庭成員，八宅命卦會是空的', to: '/setup' })
  if (house.facingSource === 'none') missing.push({ text: `尚未量測朝向，目前用預設 ${house.facingBearing}°`, to: '/compass' })
  if (plan.outline.length < 3) missing.push({ text: '尚未繪製平面圖，形勢與方位分析受限', to: '/plan' })
  if (Object.keys(environment).length === 0) missing.push({ text: '尚未填寫屋外環境', to: '/environment' })

  const download = () => {
    const blob = new Blob([reportToMarkdown(report)], { type: 'text/markdown;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `fengshui-report-${report.year}.md`; a.click(); URL.revokeObjectURL(a.href)
  }
  const tone = (s: number) => (s >= 75 ? 'text-brand' : s >= 50 ? 'text-foreground' : 'text-destructive')

  return (
    <>
      <PageHeader title="分析報告" subtitle={`${report.year} ${report.ganzhi}年，${report.period} 運`} right={<div className="flex gap-1"><Button variant="brandSubtle" size="sm" onClick={() => setShare(true)}><Share2 />分享圖</Button><Button variant="ghost" size="icon-sm" aria-label="列印" onClick={() => window.print()}><Printer /></Button><Button variant="ghost" size="icon-sm" aria-label="匯出 Markdown" onClick={download}><Download /></Button></div>} />
      {share && <ShareSheet plan={mainFloor(floors.length ? floors : [plan])} report={report} onClose={() => setShare(false)} />}
      <Page className="space-y-5">
        {missing.length > 0 && (
          <ul className="space-y-1 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
            {missing.map((m) => <li key={m.to} className="flex items-center justify-between gap-2">{m.text}<Link to={m.to} className="shrink-0 text-brand underline underline-offset-2">去補</Link></li>)}
          </ul>
        )}

        <section className="rounded-xl border border-surface-border bg-surface p-4">
          <div className="flex items-end gap-4">
            <div>
              <div className="text-xs text-muted-foreground">總評</div>
              <div className={cn('font-mono text-5xl tabular-nums leading-none', tone(report.scores.overall))}>{report.scores.overall}</div>
            </div>
            <dl className="grid flex-1 grid-cols-2 gap-x-3 gap-y-1 text-sm sm:grid-cols-4">
              {([['八宅', report.scores.bazhai], ['玄空', report.scores.xuankong], ['流年', report.scores.annual], ['形勢', report.scores.form]] as const).map(([l, v]) => (
                <div key={l} className="flex items-baseline justify-between border-b border-surface-border py-0.5"><dt className="text-muted-foreground">{l}</dt><dd className={cn('font-mono tabular-nums', tone(v))}>{v}</dd></div>
              ))}
            </dl>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">朝向</dt><dd>{report.house.facingBearing.toFixed(1)}°，向{report.house.facing.name}</dd>
            <dt className="text-muted-foreground">坐山</dt><dd>坐{report.house.sitting.name}，{PALACES[report.house.sittingPalace].zh}宅（{groupZh(report.house.group)}宅）</dd>
            <dt className="text-muted-foreground">格局</dt><dd>{report.xuankong.patternZh}{report.xuankong.chart.replacement ? '（替卦）' : ''}</dd>
            <dt className="text-muted-foreground">正神／零神</dt><dd>{PALACES[report.house.zhengShen].direction}／{PALACES[report.house.lingShen].direction}</dd>
          </dl>
          {report.house.kongwang && <p className="mt-2 text-xs text-destructive">朝向落在{report.house.kongwang === 'major' ? '大空亡' : '小空亡'}線，建議重新量測。</p>}
          {report.house.jianxiang && <p className="mt-2 text-xs text-muted-foreground">兼向：偏離{report.house.facing.name}山中心 {report.xuankong.chart.jianxiangOffset}°（門檻 {house.jianxiangTolerance}°）。{report.xuankong.chart.replacement ? '已改用替卦起星，替卦星辰不固，效果不若下卦穩定。' : '目前以下卦排盤，結果僅供參考。'}</p>}
          {report.xuankong.chart.qixing && <p className="mt-2 text-xs text-muted-foreground">{report.xuankong.chart.qixing.kind}（{report.xuankong.chart.qixing.group} 三般卦），進階格局，生效以巒頭為條件。</p>}
          <p className="mt-2 text-xs text-muted-foreground">取向依據：{{ unitDoor: '自家大門', balcony: '陽台／採光面', buildingDoor: '大樓正門' }[house.facingBasis]}（各派有別）</p>
        </section>

        <Segmented value={tab} onValueChange={setTab} className="w-full" options={[{ value: 'summary', label: '重點' }, { value: 'bazhai', label: '八宅' }, { value: 'xuankong', label: '飛星' }, { value: 'annual', label: '流年' }, { value: 'form', label: `形勢 ${report.form.findings.length}` }, { value: 'element', label: '五行' }]} />

        {tab === 'summary' && (
          <section className="space-y-3">
            <h2 className="text-base font-medium">優先處理</h2>
            {report.topActions.length === 0 ? <Empty variant="dashed" title="沒有高優先問題" description="可看各分頁的細節。" /> : (
              <ol className="list-decimal space-y-2 pl-5 text-sm">{report.topActions.map((a, i) => <li key={i}>{a}</li>)}</ol>
            )}
            {report.xuankong.notes.length > 0 && <ul className="space-y-1 border-t border-surface-border pt-3 text-sm text-muted-foreground">{report.xuankong.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
          </section>
        )}

        {tab === 'bazhai' && (
          <section className="space-y-5">
            <div>
              <h2 className="text-base font-medium">成員命卦</h2>
              {report.persons.length === 0 ? <Empty variant="dashed" title="尚未新增成員" className="mt-2" /> : (
                <ul className="mt-2 divide-y divide-surface-border rounded-xl border border-surface-border bg-surface">
                  {report.persons.map((p) => (
                    <li key={p.person.id} className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap items-center gap-1.5 font-medium">{p.person.name}<Badge variant="ghost">{p.birthYear} 年，屬{p.zodiac}</Badge><Badge variant={p.compatible ? 'good' : 'destructive'}>{groupZh(p.group)}命，{p.compatible ? '與宅相合' : '與宅不合'}</Badge>{p.offendingTaisui && <Badge variant="destructive">{p.offendingTaisui}</Badge>}</div>
                      <div className="mt-1 text-muted-foreground">命卦 {PALACES[p.gua].zh}。吉方 {p.bestDirections.map((d) => `${PALACES[d].direction}${WANDERING_STARS[p.stars[d]].zh}`).join('、')}；凶方 {p.worstDirections.map((d) => `${PALACES[d].direction}${WANDERING_STARS[p.stars[d]].zh}`).join('、')}</div>
                      {!p.compatible && <div className="mt-1 text-xs text-muted-foreground">命宅不合時，以床頭、書桌、灶口朝向取命卦吉方補救，門位以宅卦為主。</div>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h2 className="text-base font-medium">宅卦遊星（{PALACES[report.house.houseGua].zh}宅）</h2>
              <div className="mt-2 grid grid-cols-4 gap-1.5 text-xs">
                {TRIGRAMS_CLOCKWISE.map((t) => { const s = WANDERING_STARS[report.bazhai.houseStars[t]]; return <div key={t} className={cn('rounded-lg p-2', s.auspicious ? 'bg-brand/10' : 'bg-destructive/10')}><div className="text-muted-foreground">{PALACES[t].direction}</div><div className="text-sm font-medium">{s.zh}</div></div> })}
              </div>
            </div>
            <div className="text-sm">
              <h2 className="text-base font-medium">文昌位與財位（依坐向）</h2>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="text-muted-foreground">文昌位</dt><dd>{report.bazhai.wenchang.map((t) => (t as string) === 'center' ? '中宮' : PALACES[t].direction).join('、')}，宜放書桌</dd>
                <dt className="text-muted-foreground">財位</dt><dd>{report.bazhai.wealth.map((t) => PALACES[t].direction).join('、')}</dd>
                <dt className="text-muted-foreground">洩財位</dt><dd>{report.bazhai.wealthLeak.map((t) => PALACES[t].direction).join('、')}，忌放魚缸</dd>
              </dl>
              <p className="mt-1 text-xs text-muted-foreground">{report.bazhai.wealthNote}。此為理氣派暗財位，與入門斜對角的明財位是不同系統；文昌位另有個人文昌與流年四綠位，三套不可混用。</p>
              {report.bazhai.positionWarnings.map((w, i) => <p key={i} className="mt-1 text-xs text-destructive">{w}</p>)}
            </div>
            <div>
              <h2 className="text-base font-medium">門、床、灶、桌</h2>
              {report.bazhai.items.length === 0 ? <Empty variant="dashed" className="mt-2" title="平面圖上還沒有大門、床、爐灶、書桌、神位或馬桶" /> : (
                <ul className="mt-2 divide-y divide-surface-border rounded-xl border border-surface-border bg-surface">
                  {report.bazhai.items.map((it) => (
                    <li key={`${it.itemId}-${it.label}`} className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap items-center gap-1.5 font-medium">{it.label}<Badge variant="ghost">{it.facingPalace ? `朝${PALACES[it.facingPalace].direction}` : `在${PALACES[it.palace].direction}`}</Badge></div>
                      <div className="mt-1 flex flex-wrap gap-1">{it.perPerson.map((pp) => <Badge key={pp.personId} variant={pp.verdict === 'good' ? 'good' : 'destructive'}>{pp.name}：{pp.note}</Badge>)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{it.advice}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {tab === 'xuankong' && (
          <section className="space-y-5">
            <div>
              <h2 className="text-base font-medium">{report.period}運 {report.house.sitting.name}山{report.house.facing.name}向{report.xuankong.chart.replacement ? '（替卦）' : ''}</h2>
              <StarGrid report={report} />
              <p className="mt-2 text-xs text-muted-foreground">每宮左上為山星（主人丁健康）、右上為向星（主財）、下方為運星。上方為北。</p>
            </div>
            <ul className="divide-y divide-surface-border rounded-xl border border-surface-border bg-surface">
              {report.xuankong.palaces.map((p) => (
                <li key={p.palace} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-1.5 font-medium">{PALACES[p.palace].direction}<span className="font-mono text-muted-foreground">山{p.mountainStar} 向{p.waterStar}</span><Badge variant={p.combo.rating === 'great' || p.combo.rating === 'good' ? 'good' : p.combo.rating === 'neutral' ? 'ghost' : 'destructive'}>{RATING_ZH[p.combo.rating]}</Badge></div>
                  <div className="mt-1">{p.combo.note}</div>
                  <div className="mt-1 text-xs text-muted-foreground">向星{TIMELINESS_ZH[p.waterTimeliness]}，山星{TIMELINESS_ZH[p.mountainTimeliness]}，流年{NINE_STARS[p.annualStar]!.zh}{p.rooms.length ? `。此方位：${p.rooms.map((r) => r.name || ROOM_ZH[r.type]).join('、')}` : ''}</div>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">{p.advice.map((a, i) => <li key={i}>{a}</li>)}</ul>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === 'annual' && (
          <section className="space-y-5 text-sm">
            <div>
              <h2 className="text-base font-medium">{report.year} {report.ganzhi}年</h2>
              <p className="mt-1 text-muted-foreground">太歲 {report.annual.data.taisui.taisuiMountain}山（{report.annual.data.taisui.zodiac}年），歲破 {report.annual.data.taisui.suipoMountain}山，三煞 {report.annual.data.taisui.sanshaBranches.join('')}（{PALACES[report.annual.data.taisui.sanshaPalace].direction}）。犯太歲：{report.annual.data.taisui.offending.map((o) => `${o.zodiac}（${o.type}）`).join('、')}</p>
            </div>
            <ul className="divide-y divide-surface-border rounded-xl border border-surface-border bg-surface">
              {report.annual.warnings.map((w, i) => (
                <li key={i} className={cn('px-4 py-3', w.rooms.length && w.severity === 'high' && 'bg-destructive/5')}>
                  <div className="flex flex-wrap items-center gap-1.5 font-medium">{w.title}<span className="text-muted-foreground">在{palaceLabel(w.palace)}</span>{w.rooms.length > 0 && <Badge variant="destructive">{w.rooms.join('、')}</Badge>}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{w.detail}</div>
                </li>
              ))}
            </ul>
            <div>
              <h2 className="text-base font-medium">吉星</h2>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                {([['八白財星', report.annual.data.babai], ['九紫喜慶', report.annual.data.jiuzi], ['一白桃花', report.annual.data.yibai], ['四綠文昌', report.annual.data.silv], ['六白武曲', report.annual.data.liubai]] as const).map(([l, p]) => <div key={l} className="flex justify-between border-b border-surface-border py-1"><dt className="text-muted-foreground">{l}</dt><dd>{palaceLabel(p)}</dd></div>)}
              </dl>
            </div>
          </section>
        )}

        {tab === 'form' && (
          <section className="space-y-2">
            {report.form.findings.length === 0 && <Empty variant="dashed" title="沒有偵測到形勢問題" description="平面圖上放了門、床、灶等物件後會自動判定。" />}
            {report.form.findings.map((f, i) => (
              <article key={i} className="rounded-xl border border-surface-border bg-surface p-4 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium">{f.floor && <span className="mr-1 text-muted-foreground">[{f.floor}]</span>}{f.name}</div>
                  <div className="flex shrink-0 gap-1"><Badge variant={f.severity === 'high' ? 'destructive' : f.severity === 'medium' ? 'warning' : 'ghost'}>{SEVERITY_ZH[f.severity]}</Badge>{f.contested && <Badge variant="outline">各派有別</Badge>}</div>
                </div>
                <div className="text-xs text-muted-foreground">{f.category}，影響 {f.affects.join('、')}</div>
                <p className="mt-2">{f.explanation}</p>
                <ul className="mt-2 list-disc space-y-0.5 pl-4">{f.remedies.map((r, k) => <li key={k}>{r}</li>)}</ul>
              </article>
            ))}
          </section>
        )}

        {tab === 'element' && (
          <ul className="divide-y divide-surface-border rounded-xl border border-surface-border bg-surface text-sm">
            {report.elementAdvice.map((e) => (
              <li key={e.palace} className="px-4 py-3">
                <div className="font-medium">{PALACES[e.palace].direction}（{PALACES[e.palace].zh}宮，{e.element}）<span className="ml-2 text-xs text-muted-foreground">{PALACES[e.palace].family}</span></div>
                <div className="mt-1 text-muted-foreground">顏色 {e.colors}；材質 {e.materials}</div>
                <div className="mt-1 text-xs text-muted-foreground">{e.tip}</div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">本報告為文化參考，各派理論互有出入；重大裝修請諮詢專業人士。<Link to="/privacy" className="underline underline-offset-2">免責聲明</Link></p>
      </Page>
    </>
  )
}

function StarGrid({ report }: { report: Report }) {
  const grid: (Trigram | 'center')[][] = [['xun', 'li', 'kun'], ['zhen', 'center', 'dui'], ['gen', 'kan', 'qian']]
  const c = report.xuankong.chart
  return (
    <div className="mt-2 grid grid-cols-3 gap-1.5">
      {grid.flat().map((t) => {
        const pe = t === 'center' ? null : report.xuankong.palaces.find((p) => p.palace === t)!
        const tone = pe ? (pe.combo.rating === 'great' || pe.combo.rating === 'good' ? 'bg-brand/10' : pe.combo.rating === 'neutral' ? 'bg-surface' : 'bg-destructive/10') : 'bg-muted'
        const isSit = t === report.house.sittingPalace, isFace = t === c.facingPalace
        return (
          <div key={t} className={cn('rounded-lg border border-surface-border p-2', tone, (isSit || isFace) && 'ring-1 ring-brand')}>
            <div className="text-[10px] text-muted-foreground">{t === 'center' ? '中宮' : PALACES[t].direction}{isSit ? '，坐' : isFace ? '，向' : ''}</div>
            <div className="flex justify-between font-mono text-lg tabular-nums"><span>{c.mountainStars[t]}</span><span>{c.waterStars[t]}</span></div>
            <div className="text-center font-mono text-xs text-muted-foreground">{c.periodStars[t]}</div>
          </div>
        )
      })}
    </div>
  )
}
