import type { FloorPlan } from '../engine/floorplan'

const rect = (x: number, y: number, w: number, h: number) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }]

/** 三房兩廳示範平面圖（cm），上方為大門側，朝向以「資料」頁設定。 */
export function demoPlan(): FloorPlan {
  return {
    outline: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 800 }, { x: 650, y: 800 }, { x: 650, y: 950 }, { x: 0, y: 950 }],
    rooms: [
      { id: 'r_entry', type: 'entry', polygon: rect(350, 0, 200, 150) },
      { id: 'r_living', type: 'living', polygon: rect(0, 150, 550, 450) },
      { id: 'r_dining', type: 'dining', polygon: rect(0, 600, 350, 350) },
      { id: 'r_kitchen', type: 'kitchen', polygon: rect(350, 600, 300, 350) },
      { id: 'r_master', type: 'master', polygon: rect(550, 0, 450, 400) },
      { id: 'r_bath1', type: 'bathroom', polygon: rect(550, 400, 200, 200) },
      { id: 'r_bed2', type: 'bedroom', polygon: rect(750, 400, 250, 400) },
      { id: 'r_bath2', type: 'bathroom', polygon: rect(0, 0, 350, 150) },
    ],
    items: [
      { id: 'i_main', type: 'mainDoor', x: 405, y: -5, w: 90, h: 10, facing: 180 },
      { id: 'i_win_l', type: 'window', x: 200, y: 945, w: 150, h: 10, facing: 180, roomId: 'r_dining' },
      { id: 'i_door_master', type: 'door', x: 545, y: 200, w: 10, h: 80, facing: 90, roomId: 'r_master' },
      { id: 'i_bed_master', type: 'bed', x: 800, y: 20, w: 150, h: 200, facing: 0, roomId: 'r_master' },
      { id: 'i_win_master', type: 'window', x: 995, y: 100, w: 10, h: 150, facing: 90, roomId: 'r_master' },
      { id: 'i_door_bath1', type: 'door', x: 545, y: 460, w: 10, h: 80, facing: 90, roomId: 'r_bath1' },
      { id: 'i_toilet1', type: 'toilet', x: 690, y: 420, w: 40, h: 70, facing: 270, roomId: 'r_bath1' },
      { id: 'i_door_bed2', type: 'door', x: 745, y: 460, w: 10, h: 80, facing: 90, roomId: 'r_bed2' },
      { id: 'i_bed2', type: 'bed', x: 830, y: 560, w: 150, h: 200, facing: 90, roomId: 'r_bed2' },
      { id: 'i_desk2', type: 'desk', x: 760, y: 420, w: 120, h: 60, facing: 0, roomId: 'r_bed2' },
      { id: 'i_door_kitchen', type: 'door', x: 450, y: 595, w: 80, h: 10, facing: 180, roomId: 'r_kitchen' },
      { id: 'i_stove', type: 'stove', x: 560, y: 880, w: 75, h: 50, facing: 0, roomId: 'r_kitchen' },
      { id: 'i_sink', type: 'sink', x: 470, y: 880, w: 60, h: 50, facing: 0, roomId: 'r_kitchen' },
      { id: 'i_fridge', type: 'fridge', x: 360, y: 620, w: 70, h: 70, facing: 90, roomId: 'r_kitchen' },
      { id: 'i_sofa', type: 'sofa', x: 100, y: 420, w: 220, h: 90, facing: 0, roomId: 'r_living' },
      { id: 'i_tv', type: 'tv', x: 150, y: 170, w: 120, h: 20, facing: 180, roomId: 'r_living' },
      { id: 'i_beam', type: 'beam', x: 550, y: 200, w: 450, h: 30, facing: 0 },
      { id: 'i_mirror', type: 'mirror', x: 560, y: 320, w: 6, h: 80, facing: 90, roomId: 'r_master' },
      { id: 'i_door_bath2', type: 'door', x: 300, y: 145, w: 80, h: 10, facing: 0, roomId: 'r_bath2' },
    ],
    northOffset: 0,
    gridCm: 50,
  }
}
