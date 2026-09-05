import { describe, expect, it } from 'vitest'
import type { FloorPlan, Item } from '../floorplan'
import { runFormRules } from './index'

const rect = (x: number, y: number, w: number, h: number) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }]

function basePlan(): FloorPlan {
  return {
    outline: rect(0, 0, 800, 600),
    rooms: [
      { id: 'living', type: 'living', polygon: rect(0, 0, 500, 600) },
      { id: 'bed', type: 'master', polygon: rect(500, 0, 300, 300) },
      { id: 'bath', type: 'bathroom', polygon: rect(500, 300, 150, 150) },
      { id: 'kitchen', type: 'kitchen', polygon: rect(500, 450, 300, 150) },
    ],
    items: [],
    northOffset: 0,
    gridCm: 50,
  }
}
const item = (id: string, type: Item['type'], x: number, y: number, w: number, h: number, facing: number, roomId?: string): Item => ({ id, type, x, y, w, h, facing, roomId })

describe('form rules', () => {
  it('穿堂煞：大門直對窗', () => {
    const plan = basePlan()
    plan.items.push(item('m', 'mainDoor', 200, -5, 90, 10, 180), item('w', 'window', 200, 595, 120, 10, 0))
    const ids = runFormRules(plan).map((f) => f.ruleId)
    expect(ids).toContain('chuan_tang_sha')
  })
  it('無穿堂：門與窗錯開', () => {
    const plan = basePlan()
    plan.items.push(item('m', 'mainDoor', 50, -5, 90, 10, 180), item('w', 'window', 350, 595, 120, 10, 0))
    expect(runFormRules(plan).map((f) => f.ruleId)).not.toContain('chuan_tang_sha')
  })
  it('門沖床（床尾）與床頭靠窗', () => {
    const plan = basePlan()
    // bedroom door on the left wall of bedroom at x=500, opens east (90)
    plan.items.push(item('d', 'door', 495, 130, 10, 80, 90, 'bed'))
    // bed: head to the east wall (facing 90), centred on the door line
    plan.items.push(item('b', 'bed', 600, 95, 200, 150, 90, 'bed'))
    plan.items.push(item('w', 'window', 795, 110, 10, 120, 270, 'bed'))
    const f = runFormRules(plan)
    const ids = f.map((x) => x.ruleId)
    expect(ids).toContain('door_rushes_bed')
    expect(ids).toContain('bed_head_window')
  })
  it('床頭無靠', () => {
    const plan = basePlan()
    plan.items.push(item('b', 'bed', 580, 100, 150, 200, 0, 'bed'))
    expect(runFormRules(plan).map((f) => f.ruleId)).toContain('bed_head_no_wall')
  })
  it('樑壓床頭、鏡照床', () => {
    const plan = basePlan()
    plan.items.push(item('b', 'bed', 600, 0, 150, 200, 0, 'bed'))
    plan.items.push(item('beam', 'beam', 500, 20, 300, 30, 0))
    plan.items.push(item('mir', 'mirror', 640, 280, 60, 6, 0, 'bed'))
    const ids = runFormRules(plan).map((f) => f.ruleId)
    expect(ids).toContain('beam_over_bed_head')
    expect(ids).toContain('mirror_faces_bed')
  })
  it('廁所居中', () => {
    const plan = basePlan()
    plan.rooms.push({ id: 'cbath', type: 'bathroom', polygon: rect(350, 250, 100, 100) })
    expect(runFormRules(plan).map((f) => f.ruleId)).toContain('bathroom_center')
  })
  it('開門見灶、水火相沖、火燒天門', () => {
    const plan = basePlan()
    plan.items.push(item('kd', 'door', 495, 500, 10, 80, 90, 'kitchen'))
    plan.items.push(item('st', 'stove', 700, 510, 75, 50, 270, 'kitchen'))
    plan.items.push(item('sk', 'sink', 620, 510, 60, 50, 270, 'kitchen'))
    const ids = runFormRules(plan).map((f) => f.ruleId)
    expect(ids).toContain('door_sees_stove')
    expect(ids).toContain('stove_adjacent_water')
    // northOffset so that kitchen (SE of plan) maps to NW
    const plan2 = basePlan()
    plan2.northOffset = 180
    plan2.items.push(item('st', 'stove', 700, 520, 75, 50, 0, 'kitchen'))
    expect(runFormRules(plan2).map((f) => f.ruleId)).toContain('stove_in_northwest')
  })
  it('缺角偵測（L 型）', () => {
    const plan = basePlan()
    plan.outline = [{ x: 0, y: 0 }, { x: 800, y: 0 }, { x: 800, y: 300 }, { x: 500, y: 300 }, { x: 500, y: 600 }, { x: 0, y: 600 }]
    plan.rooms = [{ id: 'a', type: 'living', polygon: plan.outline }]
    const f = runFormRules(plan).find((x) => x.ruleId.startsWith('missing_corner'))
    expect(f).toBeDefined()
    expect(f!.ruleId).toBe('missing_corner_xun') // SE with north up
  })
  it('書桌背門、神位背廁所', () => {
    const plan = basePlan()
    plan.items.push(item('d', 'door', 495, 130, 10, 80, 90, 'bed'))
    plan.items.push(item('desk', 'desk', 620, 140, 120, 60, 90, 'bed')) // faces east, door behind (west)
    plan.items.push(item('al', 'altar', 400, 330, 90, 50, 270, 'living')) // faces west, bathroom is behind (east)
    const ids = runFormRules(plan).map((f) => f.ruleId)
    expect(ids).toContain('desk_back_to_door')
    expect(ids).toContain('altar_backs_bathroom')
  })
  it('空平面圖不噴錯', () => {
    expect(runFormRules({ outline: [], rooms: [], items: [], northOffset: 0, gridCm: 50 })).toEqual([])
  })
})
