import { describe, expect, it } from 'vitest'
import { captureToPlan, facingFromPlan, type ARCapture } from './toPlan'
import { emptyPlan } from '../engine/floorplan'

// XR metres: x right, z toward the user (plan y down). A 4 × 4 m house, one 2 × 2 m bedroom in its top-left.
const P = (x: number, z: number) => ({ x, y: 0, z })
const capture = (extra: Partial<ARCapture> = {}): ARCapture => ({
  polygons: [
    { stage: 'outline', pts: [P(0, 0), P(4, 0), P(4, 4), P(0, 4)] },
    { stage: 'room', label: '主臥', pts: [P(0, 0), P(2, 0), P(2, 2), P(0, 2)] },
  ],
  openings: [{ kind: 'mainDoor', p: P(2, 4) }],
  items: [],
  northOffset: 0,
  ...extra,
})

describe('captureToPlan', () => {
  it('builds outline and rooms in cm and snaps the main door to the outline, opening inward', () => {
    const plan = captureToPlan(capture(), emptyPlan())!
    expect(plan.outline).toHaveLength(4)
    expect(plan.rooms[0]!.type).toBe('master')
    const door = plan.items.find((i) => i.type === 'mainDoor')!
    expect(door.facing).toBe(0) // on the bottom wall, opens up into the house
    expect(facingFromPlan(plan)).toBe(180) // forward = north, so the house faces south
  })

  it('furniture takes its room from position and its facing from the nearest wall', () => {
    const plan = captureToPlan(capture({ items: [{ type: 'bed', p: P(1, 0.4) }, { type: 'stove', p: P(3.7, 3) }] }), emptyPlan())!
    const bed = plan.items.find((i) => i.type === 'bed')!
    expect(bed.roomId).toBe(plan.rooms[0]!.id)
    expect(bed.facing).toBe(0) // head against the top wall
    const stove = plan.items.find((i) => i.type === 'stove')!
    expect(stove.roomId).toBeUndefined()
    expect(stove.facing).toBe(270) // back to the right outline wall, cook faces left
  })

  it('free-standing furniture uses the camera yaw', () => {
    const plan = captureToPlan(capture({ items: [{ type: 'sofa', p: P(2, 2), yaw: 92 }] }), emptyPlan())!
    expect(plan.items.find((i) => i.type === 'sofa')!.facing).toBe(90)
  })

  it('room doors open into their room and windows attach to the room', () => {
    const plan = captureToPlan(capture({ openings: [{ kind: 'mainDoor', p: P(2, 4) }, { kind: 'door', p: P(1, 2) }, { kind: 'window', p: P(0, 1) }] }), emptyPlan())!
    const door = plan.items.find((i) => i.type === 'door')!
    expect(door.roomId).toBe(plan.rooms[0]!.id)
    expect(door.facing).toBe(0) // bottom wall of the bedroom, opens up into it
    const win = plan.items.find((i) => i.type === 'window')!
    expect(win.roomId).toBe(plan.rooms[0]!.id)
    expect(win.facing).toBe(90) // left wall, inward = right
  })

  it('keeps the north offset from the session and returns null without an outline', () => {
    expect(captureToPlan(capture({ northOffset: 47.4 }), emptyPlan())!.northOffset).toBe(47)
    expect(captureToPlan(capture({ polygons: [] }), emptyPlan())).toBeNull()
  })
})
