import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Compass, Plus, Trash2 } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { Page, PageHeader } from '../components/AppShell'
import { Badge, Button, Empty, Field, Input, NativeSelect } from '../components/mds'
import { analyzePerson, groupZh, WANDERING_STARS } from '../engine/bazhai'
import { fengshuiYearOf, ganzhiOfYear } from '../engine/calendar'
import { PALACES } from '../engine/bagua'
import { periodOfYear } from '../engine/xuankong'
import { mountainOf } from '../engine/mountains24'

export function SetupPage() {
  const { persons, addPerson, removePerson, updatePerson, house, setHouse } = useAppStore()
  const [name, setName] = useState('')
  const [birth, setBirth] = useState('1990-01-01')
  const [gender, setGender] = useState<'male' | 'female'>('male')
  const submit = () => { if (!birth) return; addPerson({ name: name.trim() || `成員${persons.length + 1}`, birthDate: birth, gender }); setName('') }
  const facingLabel = { compass: '羅盤實測', manual: '手動輸入', ar: 'AR', none: '尚未量測' }[house.facingSource]

  return (
    <>
      <PageHeader title="家庭成員與房屋" subtitle="第 1 步" />
      <Page className="space-y-8">
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-medium">家庭成員</h2>
            <p className="text-sm text-muted-foreground">命卦依出生年（立春為界）與性別計算，用於床頭、書桌等朝向判斷。</p>
          </div>
          {persons.length === 0 ? <Empty variant="dashed" title="還沒有成員" description="至少新增一位，通常先填主要居住者。" /> : (
            <ul className="divide-y divide-surface-border rounded-xl border border-surface-border bg-surface">
              {persons.map((p) => {
                const by = fengshuiYearOf(new Date(p.birthDate + 'T12:00:00')).year
                const r = analyzePerson(by, p.gender)
                const gz = ganzhiOfYear(by)
                return (
                  <li key={p.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium">{p.name}{p.primary && <Badge variant="good">主要</Badge>}</div>
                      <div className="text-xs text-muted-foreground">{p.birthDate}，{gz.stem}{gz.branch}年屬{gz.zodiac}，{p.gender === 'male' ? '男' : '女'}</div>
                      <div className="mt-1 text-sm">命卦 {PALACES[r.gua].zh}，{groupZh(r.group)}命。吉方：{r.bestDirections.map((d) => `${PALACES[d].direction}（${WANDERING_STARS[r.stars[d]].zh}）`).join('、')}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {!p.primary && <Button variant="ghost" size="xs" onClick={() => persons.forEach((x) => updatePerson(x.id, { primary: x.id === p.id }))}>設為主要</Button>}
                      <Button variant="ghost" size="icon-sm" aria-label="移除" onClick={() => removePerson(p.id)}><Trash2 /></Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-surface-border bg-surface p-4">
            <Field label="稱呼"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：爸爸" /></Field>
            <Field label="性別">
              <NativeSelect value={gender} onChange={(e) => setGender(e.target.value as 'male' | 'female')}><option value="male">男</option><option value="female">女</option></NativeSelect>
            </Field>
            <Field label="出生日期（國曆）" className="col-span-2"><Input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} /></Field>
            <Button variant="brandSubtle" className="col-span-2" onClick={submit}><Plus />新增成員</Button>
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-base font-medium">房屋</h2>
            <p className="text-sm text-muted-foreground">朝向是站在大門內側面向屋外的方向，建成年決定玄空元運。</p>
          </div>
          <div className="space-y-4 rounded-xl border border-surface-border bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">朝向 {house.facingBearing.toFixed(0)}°，向{mountainOf(house.facingBearing).name}山</div>
                <div className="text-xs text-muted-foreground">{facingLabel}</div>
              </div>
              <Link to="/compass"><Button variant="outline"><Compass />用羅盤量</Button></Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="朝向（度）" hint="0 北、90 東、180 南、270 西">
                <Input type="number" min={0} max={359} value={Math.round(house.facingBearing)} onChange={(e) => setHouse({ facingBearing: ((Number(e.target.value) % 360) + 360) % 360, facingSource: 'manual' })} />
              </Field>
              <Field label="建成年" hint={`${periodOfYear(house.periodYear)} 運。大幅翻修可改填翻修年。`}>
                <Input type="number" value={house.periodYear} onChange={(e) => setHouse({ periodYear: Number(e.target.value) || house.periodYear })} />
              </Field>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-base font-medium">判法設定</h2>
            <p className="text-sm text-muted-foreground">這些項目各派說法不同，換一種設定結果會不同。</p>
          </div>
          <div className="grid gap-4 rounded-xl border border-surface-border bg-surface p-4 sm:grid-cols-2">
            <Field label="取向依據" hint="門為氣口是各派共同承認的基礎，預設自家大門。">
              <NativeSelect value={house.facingBasis} onChange={(e) => setHouse({ facingBasis: e.target.value as typeof house.facingBasis })}>
                <option value="unitDoor">自家大門朝向</option><option value="balcony">陽台或最大採光面</option><option value="buildingDoor">整棟大樓正門</option>
              </NativeSelect>
            </Field>
            <Field label="灶位判法" hint="「座凶向吉」坊間廣傳但古籍出處未驗證。">
              <NativeSelect value={house.stoveMode} onChange={(e) => setHouse({ stoveMode: e.target.value as typeof house.stoveMode })}>
                <option value="allGood">灶座與灶口皆宜吉方</option><option value="seatBadFaceGood">灶座壓凶方、灶口向吉方</option>
              </NativeSelect>
            </Field>
            <Field label="兼向門檻" hint="偏離山中心超過此角度即為兼向。">
              <NativeSelect value={house.jianxiangTolerance} onChange={(e) => setHouse({ jianxiangTolerance: Number(e.target.value) })}>
                <option value={3.5}>3.5°（玄空館）</option><option value={4.5}>4.5°（沈氏，預設）</option><option value={6}>6°（高端風水網）</option>
              </NativeSelect>
            </Field>
            <Field label="兼向時排盤" hint="替卦採傳統蔣大鴻／沈氏替星表。">
              <NativeSelect value={house.replacementMode} onChange={(e) => setHouse({ replacementMode: e.target.value as typeof house.replacementMode })}>
                <option value="auto">自動改用替卦起星</option><option value="never">一律下卦，僅提示</option>
              </NativeSelect>
            </Field>
          </div>
        </section>
        <Link to="/plan"><Button variant="brand" size="lg" className="w-full">下一步：平面圖</Button></Link>
      </Page>
    </>
  )
}
