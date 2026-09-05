import { describe, expect, it } from 'vitest'
import type { FloorPlan } from '../floorplan'
import { runAllFormRules } from './index'

const rect = (x: number, y: number, w: number, h: number) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }]

describe('多樓層規則', () => {
  const lower: FloorPlan = { name: '1F', level: 0, outline: rect(0, 0, 800, 600), rooms: [{ id: 'bed1', type: 'master', polygon: rect(0, 0, 400, 600) }, { id: 'k', type: 'kitchen', polygon: rect(400, 0, 400, 600) }], items: [{ id: 'b', type: 'bed', x: 100, y: 100, w: 150, h: 200, facing: 0 }, { id: 's', type: 'stove', x: 600, y: 100, w: 75, h: 50, facing: 0 }], northOffset: 0, gridCm: 50 }
  const upper: FloorPlan = { name: '2F', level: 1, outline: rect(0, 0, 800, 600), rooms: [{ id: 'bath2', type: 'bathroom', polygon: rect(0, 0, 400, 300) }, { id: 'bed2', type: 'bedroom', polygon: rect(400, 0, 400, 600) }], items: [{ id: 't', type: 'toilet', x: 120, y: 120, w: 40, h: 70, facing: 0 }, { id: 'b2', type: 'bed', x: 600, y: 100, w: 150, h: 200, facing: 0 }], northOffset: 0, gridCm: 50 }
  it('廁所在臥室上方、馬桶在床上方、臥室在廚房上方、床在灶上方', () => {
    const ids = runAllFormRules([lower, upper]).map((f) => f.ruleId)
    expect(ids).toContain('toilet_above_bedroom')
    expect(ids).toContain('toilet_over_bed')
    expect(ids).toContain('bedroom_above_kitchen')
    expect(ids).toContain('bed_over_stove')
  })
  it('單層不產生跨層規則、多層 findings 帶樓層標記', () => {
    expect(runAllFormRules([lower]).some((f) => f.floor)).toBe(false)
    expect(runAllFormRules([lower, upper]).every((f) => f.floor)).toBe(true)
  })
  it('樑深 ≥ 30 加重為高；吊燈壓床', () => {
    const p: FloorPlan = { ...lower, rooms: [{ id: 'r', type: 'master', polygon: rect(0, 0, 800, 600) }], items: [{ id: 'b', type: 'bed', x: 300, y: 200, w: 150, h: 200, facing: 0 }, { id: 'beam', type: 'beam', x: 0, y: 300, w: 800, h: 30, facing: 0, depthCm: 40 }, { id: 'lamp', type: 'lamp', x: 340, y: 260, w: 60, h: 60, facing: 0 }] }
    const f = runAllFormRules([p])
    expect(f.find((x) => x.ruleId.startsWith('beam_over_bed'))?.severity).toBe('high')
    expect(f.map((x) => x.ruleId)).toContain('light_over_seat')
  })
  it('臥室懸空（下方騎樓）', () => {
    const l: FloorPlan = { ...lower, rooms: [{ id: 'd', type: 'driveway', polygon: rect(0, 0, 400, 600) }], items: [] }
    expect(runAllFormRules([l, upper]).map((f) => f.ruleId)).not.toContain('bedroom_over_void') // bath2 over driveway, not bedroom
    const u2: FloorPlan = { ...upper, rooms: [{ id: 'bx', type: 'bedroom', polygon: rect(0, 0, 400, 600) }], items: [] }
    expect(runAllFormRules([l, u2]).map((f) => f.ruleId)).toContain('bedroom_over_void')
  })
})
