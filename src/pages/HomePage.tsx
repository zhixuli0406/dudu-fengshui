import { Link } from 'react-router-dom'
import { ArrowRight, Check, Compass, FileText, LayoutGrid, Trees, Users } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { Page } from '../components/AppShell'
import { Button } from '../components/mds'
import { fengshuiYearOf } from '../engine/calendar'
import { periodOfYear } from '../engine/xuankong'
import { annualAfflictions, palaceLabel } from '../engine/annual'
import { cn } from '../lib/utils'

export function HomePage() {
  const persons = useAppStore((s) => s.persons)
  const house = useAppStore((s) => s.house)
  const floors = useAppStore((s) => s.floors)
  const environment = useAppStore((s) => s.environment)
  const fy = fengshuiYearOf(new Date())
  const period = periodOfYear(fy.year)
  const a = annualAfflictions(fy.year)
  const hasPlan = floors.some((f) => f.outline.length >= 3 && f.items.length > 0)
  const steps = [
    { to: '/setup', title: '家庭成員與房屋', desc: persons.length ? `${persons.length} 位成員，朝向 ${Math.round(house.facingBearing)}°` : '出生年、性別、建成年', done: persons.length > 0 && house.facingSource !== 'none', icon: Users },
    { to: '/plan', title: '平面圖', desc: hasPlan ? `${floors.length} 個樓層` : '掃描、拍照描圖或手繪', done: hasPlan, icon: LayoutGrid },
    { to: '/environment', title: '屋外環境', desc: Object.keys(environment).length ? `已答 ${Object.keys(environment).length} 題` : '路沖、壁刀、電塔等勾選', done: Object.keys(environment).length > 0, icon: Trees },
    { to: '/report', title: '分析報告', desc: '八宅、飛星、流年、形勢', done: false, icon: FileText },
  ]
  const next = steps.find((s) => !s.done) ?? steps[3]!
  return (
    <Page className="space-y-6 pt-6">
      <header>
        <h1 className="text-2xl font-semibold">嘟嘟風水</h1>
        <p className="mt-1 text-sm text-muted-foreground">量朝向、畫平面圖，得到八宅、玄空飛星與形勢派的室內風水判讀。資料只留在你的手機。</p>
      </header>

      <Link to={next.to} className="block rounded-xl bg-brand p-4 text-brand-foreground shadow-[var(--surface-shadow)] active:translate-y-px">
        <div className="text-xs opacity-80">下一步</div>
        <div className="mt-0.5 flex items-center justify-between text-base font-medium">{next.title}<ArrowRight className="size-5" /></div>
      </Link>

      <ol className="divide-y divide-surface-border rounded-xl border border-surface-border bg-surface">
        {steps.map((s, i) => (
          <li key={s.to}>
            <Link to={s.to} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-hover">
              <span className={cn('flex size-7 items-center justify-center rounded-full text-xs font-medium', s.done ? 'bg-brand text-brand-foreground' : 'bg-muted text-muted-foreground')}>{s.done ? <Check className="size-4" /> : i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{s.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{s.desc}</span>
              </span>
              <s.icon className="size-4 text-muted-foreground" strokeWidth={1.75} />
            </Link>
          </li>
        ))}
      </ol>

      <section>
        <h2 className="text-sm font-medium">{fy.year} {fy.ganzhi}年，{period} 運</h2>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">五黃</dt><dd>{palaceLabel(a.wuhuang)}</dd>
          <dt className="text-muted-foreground">二黑</dt><dd>{palaceLabel(a.erhei)}</dd>
          <dt className="text-muted-foreground">八白財星</dt><dd>{palaceLabel(a.babai)}</dd>
          <dt className="text-muted-foreground">九紫喜慶</dt><dd>{palaceLabel(a.jiuzi)}</dd>
          <dt className="text-muted-foreground">太歲</dt><dd>{a.taisui.taisuiMountain}山（{a.taisui.zodiac}年），三煞 {a.taisui.sanshaBranches.join('')}</dd>
        </dl>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Link to="/compass"><Button variant="outline" className="w-full"><Compass />羅盤量向</Button></Link>
        <Link to="/knowledge"><Button variant="outline" className="w-full">知識庫</Button></Link>
      </div>
      <p className="text-xs text-muted-foreground">文化參考，不構成醫療、法律或投資建議。<Link to="/privacy" className="underline underline-offset-2">隱私與免責</Link></p>
    </Page>
  )
}
