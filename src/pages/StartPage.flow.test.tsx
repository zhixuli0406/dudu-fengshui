// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StartPage } from './StartPage'
import { useAppStore } from '../store/useAppStore'
import { emptyPlan } from '../engine/floorplan'

/**
 * Walks the whole guided flow the way a phone without AR would: home type → door (manual) → people →
 * period → reveal → sketch floor 1 → walls → verdicts → upstairs → sketch floor 2 → verdict → summary.
 */
describe('師傅來看房 flow (sketch path, two floors)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // no motion: typewriter lines appear at once
    Object.defineProperty(window, 'matchMedia', { writable: true, value: (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) })
    const s = useAppStore.getState()
    useAppStore.setState({
      persons: [{ id: 'p1', name: '我', birthDate: '1989-05-01', gender: 'male', primary: true }],
      house: { ...s.house, facingBearing: 180, facingSource: 'none', homeType: undefined, floorCount: undefined, periodYear: 2026 },
      floors: [emptyPlan()], activeFloor: 0, plan: emptyPlan(),
      lite: { rooms: [], introSeen: true, stepId: 'home', pendingId: undefined, floorIdx: 0 },
      wizard: { ...s.wizard, paint: {}, walls: {}, cols: 4, rows: 4, doorWall: 'bottom' },
    })
  })
  afterEach(() => { cleanup(); vi.useRealTimers() })

  const btn = (name: string | RegExp) => screen.getByRole('button', { name })
  const click = (name: string | RegExp) => act(() => { fireEvent.click(btn(name)) })
  const tick = (ms = 500) => act(() => { vi.advanceTimersByTime(ms) })
  /** tap the dialogue until the wanted button shows up */
  const tapUntil = (container: HTMLElement, name: string | RegExp) => {
    for (let i = 0; i < 8 && !screen.queryByRole('button', { name }); i++) act(() => { fireEvent.click(container.querySelector('main .select-none')!) })
    expect(screen.getByRole('button', { name })).toBeTruthy()
  }
  const paint = (container: HTMLElement, brush: string, cells: number[]) => {
    click(brush)
    const rects = container.querySelectorAll('main svg rect.cursor-pointer')
    for (const i of cells) act(() => { fireEvent.pointerDown(rects[i]!) })
  }

  it('reaches the summary with two floors saved, furniture placed and the stairs marked upstairs', async () => {
    const { container } = render(<MemoryRouter><StartPage /></MemoryRouter>)
    await act(async () => { await Promise.resolve() }) // detectAR settles (no WebXR here)

    // 1 home type: 透天, 2 floors
    expect(screen.getByText('這是什麼樣的房子？')).toBeTruthy()
    click(/透天／別墅/)
    click('2 層')
    click('就這樣')
    expect(screen.getByText('大門朝哪個方向？')).toBeTruthy()

    // 2 door: jsdom has the event type but never fires it → after 3 s the hook gives up → manual chips
    tick(3500)
    click('東北')
    tick()
    expect(useAppStore.getState().house.facingBearing).toBe(45)
    expect(screen.getByText('這個家，誰當家？')).toBeTruthy()

    // 3 people, 4 period
    click('就是我')
    click(/先看我就好/)
    click(/2004 到 2023/)
    tick()

    // 5 reveal, then straight to the sketch (no AR)
    tapUntil(container, '好，進屋')
    click('好，進屋')
    expect(screen.getByText('房子大概多大？')).toBeTruthy()
    click('差不多這樣')
    expect(screen.getByText('房間各在哪裡？')).toBeTruthy()

    // 6 paint floor 1: master top-left (2 cells), kitchen bottom-right
    paint(container, '主臥', [0, 1])
    paint(container, '廚房', [15])
    click('塗好了')
    const f0 = useAppStore.getState().floors[0]!
    expect(f0.rooms.map((r) => r.type).sort()).toEqual(['kitchen', 'master'])
    expect(f0.items.some((i) => i.type === 'mainDoor')).toBe(true)

    // 7 walls + verdicts on floor 1
    expect(screen.getByText('床頭靠哪面牆？')).toBeTruthy()
    click(/裡面那面牆/)
    tick()
    tapUntil(container, '下一間')
    click('下一間')
    expect(screen.getByText('爐灶靠哪面牆？')).toBeTruthy()
    click(/右手邊那面牆/)
    tick()
    tapUntil(container, '這層看完了')
    const f0b = useAppStore.getState().floors[0]!
    expect(f0b.items.filter((i) => i.type === 'bed' || i.type === 'stove').map((i) => `${i.type}@${i.facing}`).sort()).toEqual(['bed@0', 'stove@270'])
    click('這層看完了')

    // 8 upstairs → sketch floor 2 the same way up, stairs instead of a door
    tapUntil(container, '上2F')
    click('上2F')
    expect(screen.getByText('樓梯口在這面牆的')).toBeTruthy()
    click('差不多這樣')
    paint(container, '臥室', [5])
    click('塗好了')
    const f1 = useAppStore.getState().floors[1]!
    expect(f1.name).toBe('2F')
    expect(f1.items.some((i) => i.type === 'stairs')).toBe(true)
    expect(f1.items.some((i) => i.type === 'mainDoor')).toBe(false)
    expect(f1.northOffset).toBe(useAppStore.getState().floors[0]!.northOffset)
    click(/不確定，先略過/)
    tapUntil(container, '聽結論')
    click('聽結論')
    expect(screen.getByText('走完一圈了。')).toBeTruthy()
    expect(useAppStore.getState().lite.stepId).toBe('summary')
  })

  it('back arrow retraces from the summary into the last room of the top floor', async () => {
    const s = useAppStore.getState()
    const f0 = { ...emptyPlan('1F', 0), outline: [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 400 }, { x: 0, y: 400 }], rooms: [{ id: 'wz_r0', type: 'living' as const, polygon: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }] }], items: [] }
    const f1 = { ...f0, name: '2F', level: 1, rooms: [{ id: 'wz_r0', type: 'bedroom' as const, polygon: f0.rooms[0]!.polygon }] }
    useAppStore.setState({ house: { ...s.house, facingBearing: 180, facingSource: 'manual', homeType: 'house', floorCount: 2 }, floors: [f0, f1], plan: f0, lite: { rooms: [], introSeen: true, stepId: 'summary', floorIdx: 1 } })
    const { container } = render(<MemoryRouter><StartPage /></MemoryRouter>)
    await act(async () => { await Promise.resolve() })
    act(() => { fireEvent.click(container.querySelector('header button')!) })
    expect(useAppStore.getState().lite).toMatchObject({ stepId: 'roomVerdict', pendingId: 'wz_r0', floorIdx: 1 })
    expect(screen.getByText(/臥室在房子的/)).toBeTruthy()
  })
})
