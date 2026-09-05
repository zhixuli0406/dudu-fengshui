import { rectCenter } from '../geometry'
import type { FloorPlan } from '../floorplan'
import { overlaps, type PlanContext } from './context'
import type { Finding } from './types'

/** 需要高度資訊的規則：樑深、吊燈、淨高。 */
export function heightRules(ctx: PlanContext, plan: FloorPlan): Finding[] {
  const out: Finding[] = []
  for (const lamp of ctx.items('lamp')) {
    for (const tgt of [...ctx.items('bed'), ...ctx.items('desk'), ...ctx.items('sofa')]) {
      if (!overlaps(lamp, tgt)) continue
      const zh = { bed: '床', desk: '座位', sofa: '沙發' }[tgt.type as 'bed' | 'desk' | 'sofa']
      out.push({ ruleId: 'light_over_seat', name: `吊燈／吊扇壓${zh}`, category: '樑柱', severity: 'low', affects: ['健康', '安全'],
        explanation: '吊燈或吊扇正在頭頂上方，形成壓迫與安全疑慮（掉落、風直吹）。', remedies: ['改用吸頂燈或移開吊燈位置', '吊扇不置於床頭正上方'], itemIds: [lamp.id, tgt.id], roomIds: [], marks: [rectCenter(lamp)] })
    }
  }
  if (plan.ceilingHeightCm && plan.ceilingHeightCm < 240) {
    out.push({ ruleId: 'low_ceiling', name: `天花板淨高偏低（${plan.ceilingHeightCm} cm）`, category: '格局', severity: 'low', affects: ['健康'],
      explanation: '淨高不足 240 cm 空間壓迫、通風差；此門檻為程式預設值，來源不一。', remedies: ['天花板避免再包樑或多層造型', '以淺色與直立線條拉高視覺'], itemIds: [], roomIds: [], contested: true })
  }
  return out
}

/** 樑深 ≥ 30 cm 者，樑壓類問題升級為高。 */
export function escalateDeepBeams(findings: Finding[], plan: FloorPlan): Finding[] {
  return findings.map((f) => {
    if (!f.ruleId.startsWith('beam_over')) return f
    const beam = plan.items.find((i) => i.type === 'beam' && f.itemIds.includes(i.id))
    if (!beam?.depthCm || beam.depthCm < 30) return f
    return { ...f, severity: 'high', explanation: `${f.explanation}（樑深 ${beam.depthCm} cm ≥ 30，加重）` }
  })
}
