import { describe, expect, it } from 'vitest'
import { deriveWizardPlan, finalizeWizardPlan, wallBearing, wallDirectionZh, type WizardInput } from './wizardPlan'
import { buildContext } from './rules'
import { polygonCentroid } from './geometry'

const base: WizardInput = { widthM: 10, depthM: 8, shape: 'rect', corner: 'tr', notchWM: 3, notchDM: 2, doorWall: 'bottom', doorT: 0.5, cols: 4, rows: 4, paint: {}, walls: {} }

describe('deriveWizardPlan', () => {
  it('puts the main door on the bottom wall and orients the plan so it faces the compass reading', () => {
    const d = deriveWizardPlan(base, 50)
    expect(d.entry.y + d.entry.h / 2).toBeCloseTo(800, 0)
    expect(d.plan.northOffset).toBe(230) // top of the sketch points to the sitting direction
    expect(d.rooms).toHaveLength(0)
    expect(d.items).toHaveLength(1)
  })

  it('merges painted cells into rooms with stable ids and places key furniture against the chosen wall', () => {
    const w: WizardInput = { ...base, paint: { '0,0': 'master', '1,0': 'master', '3,3': 'kitchen' }, walls: { wz_r0: 'top' } }
    const d = deriveWizardPlan(w, 50)
    expect(d.rooms.map((r) => `${r.id}:${r.type}`)).toEqual(['wz_r0:master', 'wz_r1:kitchen'])
    const bed = d.items.find((i) => i.type === 'bed')!
    expect(bed.roomId).toBe('wz_r0')
    expect(bed.facing).toBe(0) // head toward the top wall
    expect(d.items.some((i) => i.type === 'door' && i.roomId === 'wz_r0')).toBe(true)
    // the master bedroom sits up-left of centre on the sketch; looking in from a door facing 東北 (50°),
    // "up" is the sitting direction 西南 (230°) and "left" is 東南 (140°), so up-left lands in 南
    const ctx = buildContext(d.plan)
    expect(ctx.palaceOf(polygonCentroid(d.rooms[0]!.polygon))).toBe('li')
  })

  it('finalize gives fresh ids but keeps furniture attached to its room', () => {
    const d = deriveWizardPlan({ ...base, paint: { '0,0': 'study' }, walls: { wz_r0: 'left' } }, 180)
    const f = finalizeWizardPlan(d)
    expect(f.rooms[0]!.id).not.toBe('wz_r0')
    const desk = f.items.find((i) => i.type === 'desk')!
    expect(desk.roomId).toBe(f.rooms[0]!.id)
  })
})

describe('wall bearings from the doorway', () => {
  it('names each wall by the compass direction it lies toward', () => {
    const north = deriveWizardPlan(base, 180).plan.northOffset // house faces south → top of sketch is north
    expect(north).toBe(0)
    expect(wallBearing('top', north)).toBe(0)
    expect(wallBearing('right', north)).toBe(90)
    expect(wallBearing('bottom', north)).toBe(180)
    expect(wallBearing('left', north)).toBe(270)
    const ne = deriveWizardPlan(base, 50).plan.northOffset
    expect(wallDirectionZh('top', ne)).toBe('西南')
    expect(wallDirectionZh('bottom', ne)).toBe('東北')
    expect(wallDirectionZh('right', ne)).toBe('西北')
    expect(wallDirectionZh('left', ne)).toBe('東南')
  })
})

describe('upper floors', () => {
  it('put the stairs where the door would be and inherit the north offset', () => {
    const d = deriveWizardPlan({ ...base, paint: { '0,0': 'bedroom' } }, 50, { upper: true, northOffset: 230, name: '2F', level: 1 })
    expect(d.entry.type).toBe('stairs')
    expect(d.items.some((i) => i.type === 'mainDoor')).toBe(false)
    expect(d.plan.northOffset).toBe(230)
    expect(d.plan.name).toBe('2F')
    expect(d.plan.level).toBe(1)
  })
})
