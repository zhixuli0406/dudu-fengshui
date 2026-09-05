import type { FloorPlan } from '../floorplan'
import { bathroomRules } from './bathroomRules'
import { bedRules } from './bedRules'
import { buildContext } from './context'
import { doorRules } from './doorRules'
import { kitchenRules } from './kitchenRules'
import { layoutRules } from './layoutRules'
import { miscRules } from './miscRules'
import { crossFloorRules } from './crossFloorRules'
import { escalateDeepBeams, heightRules } from './heightRules'
import { SEVERITY_WEIGHT, type Finding } from './types'

export function runFormRules(plan: FloorPlan): Finding[] {
  const ctx = buildContext(plan)
  const all = escalateDeepBeams([...doorRules(ctx), ...bedRules(ctx), ...kitchenRules(ctx), ...bathroomRules(ctx), ...miscRules(ctx), ...layoutRules(ctx), ...heightRules(ctx, plan)], plan)
  // de-duplicate identical rule+items
  const seen = new Set<string>()
  const out: Finding[] = []
  for (const f of all) {
    const key = `${f.ruleId}|${[...f.itemIds].sort().join(',')}|${[...f.roomIds].sort().join(',')}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(f)
  }
  const order = { high: 0, medium: 1, low: 2 }
  return out.sort((a, b) => order[a.severity] - order[b.severity])
}

/** All floors: per-floor rules (tagged with floor name when > 1 floor) plus cross-floor rules. */
export function runAllFormRules(floors: FloorPlan[]): Finding[] {
  const multi = floors.length > 1
  const per = floors.flatMap((f) => runFormRules(f).map((x) => (multi ? { ...x, floor: f.name ?? `L${f.level ?? 0}` } : x)))
  const cross = multi ? crossFloorRules(floors) : []
  const order = { high: 0, medium: 1, low: 2 }
  return [...per, ...cross].sort((a, b) => order[a.severity] - order[b.severity])
}

/** 0–100 score from findings. */
export function formScore(findings: Finding[]): number {
  const penalty = findings.reduce((a, f) => a + SEVERITY_WEIGHT[f.severity] * (f.contested ? 0.5 : 1), 0)
  return Math.max(0, Math.round(100 - penalty))
}

export * from './types'
export { buildContext } from './context'
