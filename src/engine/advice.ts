import { PALACES, type Trigram } from './bagua'
import { groupZh, WANDERING_STARS } from './bazhai'
import { NINE_STARS, RATING_ZH } from './stars'
import { palaceLabel } from './annual'
import type { Report } from './report'
import type { Finding } from './rules'
import { ROOM_ZH } from './floorplan'

/** 處理難度：由簡到繁 */
export type Effort = 'now' | 'small' | 'move' | 'renovate'
export const EFFORT_ORDER: Effort[] = ['now', 'small', 'move', 'renovate']
export const EFFORT_ZH: Record<Effort, string> = { now: '今天就能做', small: '花點小錢', move: '搬動家具', renovate: '需要裝修' }
export const EFFORT_DESC: Record<Effort, string> = {
  now: '不用花錢，改習慣或清理就好',
  small: '添購門簾、屏風、植物、燈具或擺設',
  move: '床、桌、沙發轉個方向或換位置',
  renovate: '改門、移灶、包樑等，請找專業人員',
}

export interface HowStep { text: string; effort: Effort }
export interface ActionItem {
  id: string
  /** easiest effort among its steps */
  effort: Effort
  priority: 1 | 2 | 3
  title: string
  why: string
  how: HowStep[]
  where?: string
  source: '形勢' | '八宅' | '流年' | '飛星' | '外局'
  contested?: boolean
}

const RENOVATE = /移灶|改門|門位|改為推拉門|改推拉門|裝修|包樑|砌|拆除|移位|移至實牆|移至背靠實牆|移出樑|改置|改用 IH|封窗|封板|移離中宮|改作|大改|考慮移位|改設於|移至其他牆面|改位|加隔層|加做防潮|加隔音|重新配置|改門向|改大門/
const MOVE = /移動床位|床位移|床頭改靠|床頭移|床移|轉向|移出|移離|移至|側移|遠離|避開|改靠|離開門|移開|移開吊燈|改側向|改用吸頂燈|家具移/
const SMALL = /門簾|屏風|植物|盆栽|櫃|地毯|燈|葫蘆|五帝錢|六帝錢|鹽|水晶|窗簾|床頭板|背板|鏡|布|鐘|風鈴|聚寶盆|魚缸|水景|石敢當|山海鎮|八卦鏡|貼膜|貼紙|氣密條|除濕|抽濕|背板|矮牆|吧台|工作檯|砧板|木質|金屬|白色|紅色|綠色|黃色|藍色|陶瓷|銅|擋風|背心/
const NOW = /常關|保持|清潔|乾燥|通風|不堆|避免|勿|關閉|忌|整潔|明亮|不要|少用|減少|不用時|收合|遮蓋|安靜|以動線|動線|先水後山|先有水|留意|注意|定期/

export function classifyRemedy(text: string): Effort {
  if (RENOVATE.test(text) && !/無法/.test(text)) return 'renovate'
  if (MOVE.test(text)) return 'move'
  if (NOW.test(text) && !SMALL.test(text)) return 'now'
  if (SMALL.test(text)) return 'small'
  if (NOW.test(text)) return 'now'
  return 'small'
}

/** Plain-language titles for common rule ids. Falls back to the finding name. */
const PLAIN: Record<string, { title: string; why?: string }> = {
  chuan_tang_sha: { title: '大門一開，直接看到對面的窗或陽台', why: '進門的氣直接穿出去，家裡留不住財氣，也少了緩衝。' },
  main_door_to_bathroom: { title: '一開大門就看到廁所', why: '穢氣迎門，觀感和健康都不好。' },
  main_door_to_kitchen: { title: '一開大門就看到廚房或爐灶', why: '傳統認為財氣進門就被火氣沖散。' },
  main_door_to_bedroom: { title: '大門正對臥室門', why: '外面的動靜直衝睡覺的地方，隱私和睡眠都受影響。' },
  bedroom_door_to_bathroom_door: { title: '臥室門正對廁所門', why: '廁所的濕氣和味道直接進臥室。' },
  kitchen_door_to_bathroom_door: { title: '廚房門正對廁所門', why: '廁所的氣味直接進廚房，衛生不好。' },
  door_to_door: { title: '兩扇房門正對', why: '傳統說法容易口角，實際上也少了隱私。' },
  main_door_to_elevator: { title: '大門正對電梯', why: '電梯門開開關關，氣場不穩。' },
  main_door_to_stairs: { title: '大門正對樓梯', why: '樓梯直沖大門，不容易聚氣。' },
  door_to_window: { title: '房門正對窗戶', why: '氣流直進直出，房間不容易安穩。' },
  bed_head_window: { title: '床頭靠著窗戶', why: '頭部直接吹到風、照到光，容易睡不好。' },
  bed_head_no_wall: { title: '床頭沒有靠牆', why: '睡覺缺乏安全感，傳統叫「無靠山」。' },
  door_rushes_bed: { title: '房門正對著床', why: '開門時氣流和視線直衝床上，睡眠容易不安。' },
  beam_over_bed_head: { title: '床頭上方有樑', why: '長期睡在樑下有壓迫感，傳統認為容易頭痛、壓力大。' },
  beam_over_bed: { title: '床的上方有樑', why: '樑壓在身體上方，睡起來有壓迫感。' },
  mirror_faces_bed: { title: '鏡子照到床', why: '半夜容易被鏡中影像嚇到，也影響感情。' },
  bed_head_bathroom_wall: { title: '床頭靠著廁所那面牆', why: '濕氣和水管聲音直接影響頭部。' },
  bed_faces_bathroom_door: { title: '床正對廁所門', why: '廁所的濕氣和味道直衝床位。' },
  bed_near_stove: { title: '床離爐灶太近', why: '火氣和油煙直接影響睡覺的地方。' },
  main_door_sees_stove: { title: '從大門直接看到爐灶', why: '傳統認為財庫外露、財氣易散。' },
  door_sees_stove: { title: '廚房門正對爐灶', why: '傳統說「開門見灶，錢財多耗」。' },
  stove_faces_water: { title: '爐灶正對水槽或冰箱', why: '水火相對，傳統認為家人容易口角、腸胃不好。' },
  stove_adjacent_water: { title: '爐灶和水槽、冰箱靠太近', why: '水火之間沒有緩衝。' },
  stove_back_window: { title: '爐灶背後是窗戶', why: '火苗受風，也象徵財庫沒有靠。' },
  stove_no_backing: { title: '爐灶四面沒有靠（中島灶）', why: '傳統認為財庫不穩，現代廚房常見，可用設計補救。' },
  stove_faces_bathroom: { title: '爐灶正對廁所門', why: '煮飯的地方直接對著廁所，衛生和風水都不宜。' },
  beam_over_stove: { title: '爐灶上方有樑', why: '傳統認為壓到女主人的健康和家中財庫。' },
  stove_in_northwest: { title: '爐灶在房子的西北方', why: '西北代表男主人，火在這裡傳統叫「火燒天門」。' },
  stove_in_center: { title: '爐灶在房子正中央', why: '中央是全家的核心，火在這裡容易心浮氣躁。' },
  kitchen_adjacent_bathroom: { title: '廚房和廁所共用一面牆', why: '水火相鄰，也要留意廁所氣味影響飲食區。' },
  bathroom_center: { title: '廁所在房子正中央', why: '穢氣往四面擴散，通風也最差。' },
  bathroom_ghost_gate: { title: '廁所在東北或西南', why: '日式家相忌諱的「鬼門線」，各派看法不同。' },
  bathroom_northwest: { title: '廁所在西北方', why: '西北代表男主人，傳統認為影響事業和健康。' },
  toilet_faces_door: { title: '一開廁所門就看到馬桶', why: '穢氣直出，也不好看。' },
  desk_back_to_door: { title: '書桌或座位背對門', why: '背後有人進出看不到，容易分心、沒安全感。' },
  desk_faces_door: { title: '書桌正對門', why: '門口的干擾直衝而來，不容易專心。' },
  desk_back_to_window: { title: '座位背對窗戶', why: '光從背後來，背後也沒有實牆可靠。' },
  beam_over_desk: { title: '書桌上方有樑', why: '坐在樑下容易覺得有壓力。' },
  desk_faces_bathroom: { title: '座位面對廁所門', why: '看書工作時正對廁所，不舒服也不專心。' },
  sofa_back_to_door: { title: '沙發背對門', why: '坐著看不到誰進來，沒有安全感。' },
  sofa_no_backing: { title: '沙發背後空空的', why: '傳統叫「無靠山」，坐起來也不安穩。' },
  beam_over_sofa: { title: '沙發上方有樑', why: '久坐的地方有壓迫感。' },
  altar_backs_bathroom: { title: '神位背後是廁所', why: '神位大忌，穢氣沖犯。' },
  altar_backs_kitchen: { title: '神位背後是廚房', why: '火氣沖犯神位。' },
  altar_faces_bathroom_or_kitchen: { title: '神位正對廁所或廚房門', why: '神位對著穢氣或火氣。' },
  beam_over_altar: { title: '神位上方有樑', why: '神位被壓，傳統認為家運不順。' },
  altar_no_backing: { title: '神位背後沒有實牆', why: '神位需要靠山，靠窗或懸空不穩。' },
  altar_in_bedroom: { title: '神位放在臥室', why: '臥室是私密空間，對神明不敬也影響睡眠。' },
  altar_reversed: { title: '神位和房子朝向相反', why: '傳統叫「倒頭廳」。' },
  mirror_faces_main_door: { title: '鏡子正對大門', why: '把進門的氣反射出去，也容易嚇到人。' },
  mirror_faces_door: { title: '鏡子正對房門', why: '開門就看到自己的影子，容易受驚。' },
  stairs_center: { title: '樓梯在房子正中央', why: '中央被樓梯切開，氣場不完整。' },
  aquarium_in_bedroom: { title: '魚缸放在臥室', why: '馬達聲和濕氣影響睡眠。' },
  aquarium_in_kitchen: { title: '魚缸放在廚房', why: '水火相沖。' },
  aquarium_near_stove: { title: '魚缸靠近爐灶', why: '水火相沖，濕氣也影響爐火。' },
  column_corner_rush: { title: '柱角對著床、沙發或座位', why: '尖角正對人，傳統叫「角煞」。' },
  kitchen_center: { title: '廚房在房子正中央', why: '油煙和火氣往四面擴散。' },
  storage_center: { title: '儲藏室在房子正中央', why: '中央堆雜物，又暗又不通風。' },
  room_in_room: { title: '臥室裡還有一個大房間', why: '傳統說「房中房，必有二房」，各派看法不同。' },
  toilet_above_bedroom: { title: '樓上的廁所在臥室正上方', why: '濕氣和穢氣壓在睡覺的地方。' },
  toilet_above_kitchen: { title: '樓上的廁所在廚房上方', why: '穢氣壓在煮飯的地方。' },
  toilet_above_altar: { title: '樓上的廁所在神位上方', why: '神位大忌。' },
  kitchen_above_bedroom: { title: '樓上的廚房在臥室上方', why: '火氣壓在臥室上方，各派看法不同。' },
  bedroom_above_kitchen: { title: '臥室在廚房正上方', why: '睡在火氣之上，容易燥熱。' },
  bedroom_over_void: { title: '臥室下面是騎樓或挑空', why: '傳統叫「懸空煞」，覺得不踏實。' },
  toilet_over_bed: { title: '樓上馬桶在床的正上方', why: '穢氣和水管聲直接壓在床上。' },
  bed_over_stove: { title: '床在樓下爐灶的正上方', why: '火氣上炎，容易燥熱。' },
  stairs_over_item: { title: '樓梯壓在床、灶、神位或座位上', why: '樓梯下方氣流被切割，人來人往也有震動。' },
  light_over_seat: { title: '吊燈或吊扇正在頭頂上', why: '有壓迫感，也有安全疑慮。' },
  low_ceiling: { title: '天花板偏低', why: '空間壓迫、通風差。' },
}

function plainTitle(f: Finding): { title: string; why: string } {
  const base = f.ruleId.replace(/^missing_corner_/, 'missing_corner')
  if (base === 'missing_corner') {
    const t = f.ruleId.replace('missing_corner_', '') as Trigram
    return { title: `房子的${PALACES[t]?.direction ?? ''}方缺了一角`, why: `${PALACES[t]?.direction ?? '這個方位'}代表${PALACES[t]?.family ?? '家人'}，傳統認為缺角會影響對應的人。` }
  }
  if (f.ruleId.startsWith('room_palace_')) return { title: f.name, why: f.explanation }
  if (f.ruleId.startsWith('env_')) return { title: f.name.replace(/^外局：/, ''), why: f.explanation.replace(/「|」/g, '').slice(0, 60) }
  const p = PLAIN[f.ruleId]
  return { title: p?.title ?? f.name, why: p?.why ?? f.explanation }
}

function stepsFromRemedies(remedies: string[]): HowStep[] {
  const steps = remedies.map((text) => ({ text, effort: classifyRemedy(text) }))
  return steps.sort((a, b) => EFFORT_ORDER.indexOf(a.effort) - EFFORT_ORDER.indexOf(b.effort))
}

function sev(p: Finding['severity']): 1 | 2 | 3 { return p === 'high' ? 1 : p === 'medium' ? 2 : 3 }

/** All actionable items from a report, easiest step first within each item. */
export function buildActions(report: Report): ActionItem[] {
  const out: ActionItem[] = []
  const roomsOf = (f: Finding) => {
    const names: string[] = []
    for (const id of f.roomIds) for (const p of report.xuankong.palaces) for (const r of p.rooms) if (r.id === id) names.push(r.name || ROOM_ZH[r.type])
    return names
  }

  // 形勢 / 外局
  for (const f of report.form.findings) {
    const { title, why } = plainTitle(f)
    const how = stepsFromRemedies(f.remedies)
    if (!how.length) continue
    const where = f.floor ? `${f.floor}${roomsOf(f).length ? ` ${roomsOf(f).join('、')}` : ''}` : roomsOf(f).join('、') || undefined
    out.push({ id: f.ruleId + ':' + f.itemIds.join(','), effort: how[0]!.effort, priority: sev(f.severity), title, why, how, where, source: f.ruleId.startsWith('env_') ? '外局' : '形勢', contested: f.contested })
  }

  // 八宅：門床灶桌
  for (const it of report.bazhai.items) {
    const bad = it.perPerson.filter((p) => p.verdict === 'bad')
    if (!bad.length) continue
    const names = bad.map((b) => b.name).join('、')
    const person = report.persons.find((p) => p.person.id === bad[0]!.personId)
    const good = person ? person.bestDirections.slice(0, 2).map((d) => `${PALACES[d].direction}（${WANDERING_STARS[person.stars[d]].zh}）`).join('或') : ''
    const dir = it.facingPalace ? PALACES[it.facingPalace].direction : PALACES[it.palace].direction
    const starZh = WANDERING_STARS[bad[0]!.star].zh
    if (it.itemType === 'bed') {
      out.push({ id: `bz_bed_${it.itemId}`, effort: 'move', priority: 2, title: `${it.label.replace('床頭朝向', '床頭朝')}${dir}，對${names}不利`, why: `依${names}的命卦，${dir}是「${starZh}」方。床頭朝吉方睡得比較安穩。`, where: it.label.match(/（(.+)）/)?.[1],
        how: [{ text: `床頭改朝${good}`, effort: 'move' }, { text: '暫時無法搬床：床頭加厚重床頭板，寢具用命卦五行的顏色', effort: 'small' }], source: '八宅' })
    } else if (it.itemType === 'mainDoor') {
      out.push({ id: `bz_door_${it.itemId}`, effort: 'small', priority: 2, title: `大門開在${dir}，對${names}是凶方`, why: `依${names}的命卦，${dir}是「${starZh}」方。大門改不了，用玄關緩衝就好。`,
        how: [{ text: '門內放地墊、常保持門口整潔明亮', effort: 'now' }, { text: '門內設玄關屏風或櫃體，讓氣轉個彎', effort: 'small' }, { text: '大改時考慮改門位到吉方', effort: 'renovate' }], source: '八宅' })
    } else if (it.itemType === 'stove') {
      const isSeat = it.label.startsWith('灶座')
      out.push({ id: `bz_stove_${it.itemId}_${isSeat ? 's' : 'f'}`, effort: 'small', priority: 3, title: `${isSeat ? '爐灶位置' : '爐灶開關面'}${isSeat ? '在' : '朝'}${dir}，對${names}不利`, why: `依${names}的命卦，${dir}是「${starZh}」方（判法各派有別，可在資料頁切換）。`,
        how: [{ text: '爐灶周圍保持乾淨、不堆雜物', effort: 'now' }, { text: '廚房用黃色、陶瓷等土色系擺設緩和', effort: 'small' }, { text: isSeat ? '重新裝修廚房時把爐灶移到吉方' : '換爐具時把開關面轉向吉方', effort: 'renovate' }], source: '八宅', contested: true })
    } else if (it.itemType === 'desk') {
      out.push({ id: `bz_desk_${it.itemId}`, effort: 'move', priority: 3, title: `座位面朝${dir}，對${names}不利`, why: `依${names}的命卦，${dir}是「${starZh}」方。書桌轉個方向就好。`, where: it.label.match(/（(.+)）/)?.[1],
        how: [{ text: `書桌轉向面朝${good}`, effort: 'move' }], source: '八宅' })
    } else if (it.itemType === 'altar') {
      out.push({ id: `bz_altar_${it.itemId}`, effort: 'move', priority: 2, title: `神位${it.label.includes('朝向') ? '朝' : '在'}${dir}，對${names}不利`, why: `依${names}的命卦，${dir}是「${starZh}」方。現代實務多以背靠實牆、避開流年煞方為主。`,
        how: [{ text: `神位改為面向${good}`, effort: 'move' }], source: '八宅', contested: true })
    } else if (it.itemType === 'toilet') {
      out.push({ id: `bz_toilet_${it.itemId}`, effort: 'now', priority: 3, title: `廁所在${dir}，是${names}的吉方`, why: `吉方被廁所占用，傳統認為好運被壓住；保持乾淨就能減輕。`,
        how: [{ text: '廁所門常關、保持乾燥通風', effort: 'now' }, { text: '放一盆黃金葛或粗鹽', effort: 'small' }], source: '八宅' })
    }
  }

  // 流年：只列有房間的
  for (const w of report.annual.warnings) {
    if (!w.rooms.length) continue
    const isWuhuang = w.title.startsWith('五黃'), isErhei = w.title.startsWith('二黑'), isSansha = w.title.startsWith('三煞'), isTaisui = w.title.startsWith('太歲'), isSuipo = w.title.startsWith('歲破')
    const how: HowStep[] = []
    if (isWuhuang || isTaisui || isSansha || isSuipo) how.push({ text: '今年這個方位不動土、不裝修、不釘釘子', effort: 'now' })
    if (isWuhuang || isErhei) how.push({ text: '保持安靜整潔，不要長時間躺臥，少放紅色物品', effort: 'now' }, { text: '放金屬類擺設（銅葫蘆、金屬鐘）洩土氣，此為坊間常用法', effort: 'small' })
    if (w.title.startsWith('三碧')) how.push({ text: '不要放綠色植物和水，可用紅色地毯或暖光', effort: 'small' })
    if (w.title.startsWith('七赤')) how.push({ text: '門窗留意防盜，可放小水景或藍黑色擺設', effort: 'small' })
    if (isSansha || isSuipo) how.push({ text: '床頭、座位今年避免朝這個方向', effort: 'move' })
    if (!how.length) continue
    out.push({ id: `annual_${w.palace}_${w.title}`, effort: how[0]!.effort, priority: w.severity === 'high' ? 1 : 2, title: `今年（${report.year}）${w.title.split('（')[0]}落在${palaceLabel(w.palace)}的${w.rooms.join('、')}`, why: w.detail.split('；')[0]!.split('，')[0]! + '。', where: w.rooms.join('、'), how, source: '流年' })
  }

  // 飛星：凶組合且有房間
  for (const p of report.xuankong.palaces) {
    if (!p.rooms.length) continue
    if (p.combo.rating !== 'bad' && p.combo.rating !== 'terrible') continue
    const roomNames = p.rooms.map((r) => r.name || ROOM_ZH[r.type]).join('、')
    out.push({ id: `star_${p.palace}`, effort: 'small', priority: p.combo.rating === 'terrible' ? 2 : 3, title: `${PALACES[p.palace].direction}方（${roomNames}）的飛星組合不理想`, why: `山星${p.mountainStar}、向星${p.waterStar}屬「${RATING_ZH[p.combo.rating]}」：${p.combo.note.split('，')[0]}。`, where: roomNames,
      how: [{ text: NINE_STARS[p.mountainStar]!.remedy.split('。')[0]!.replace(/^原則[：:（(]?[^：:]*[：:]/, ''), effort: 'small' }, { text: '重要的房間（主臥、書房）盡量安排在吉方', effort: 'move' }], source: '飛星' })
  }

  return out.sort((a, b) => EFFORT_ORDER.indexOf(a.effort) - EFFORT_ORDER.indexOf(b.effort) || a.priority - b.priority)
}

export function groupByEffort(items: ActionItem[]): Record<Effort, ActionItem[]> {
  const g: Record<Effort, ActionItem[]> = { now: [], small: [], move: [], renovate: [] }
  for (const it of items) g[it.effort].push(it)
  return g
}

/** One-paragraph plain summary. */
export function plainSummary(report: Report, actions: ActionItem[]): string {
  const primary = report.persons.find((p) => p.person.primary) ?? report.persons[0]
  const parts: string[] = []
  parts.push(`你家朝${PALACES[report.xuankong.chart.facingPalace].direction}（向${report.house.facing.name}），是坐${PALACES[report.house.sittingPalace].direction}的${PALACES[report.house.houseGua].zh}宅，屬${groupZh(report.house.group)}宅。`)
  if (primary) parts.push(`${primary.person.name}是${groupZh(primary.group)}命，${primary.compatible ? '和這間房子相合，' : '和房子的東西四不同組，但只要床頭、書桌朝自己的吉方就能補救，'}吉方是${primary.bestDirections.slice(0, 2).map((d) => PALACES[d].direction).join('和')}。`)
  const s = report.scores.overall
  parts.push(`整體 ${s} 分，${s >= 75 ? '狀況不錯' : s >= 50 ? '有幾處值得處理' : '有幾個明顯的問題'}。`)
  const top = actions.filter((a) => a.priority === 1).slice(0, 2)
  if (top.length) parts.push(`最該先處理：${top.map((a) => a.title).join('；')}。`)
  const nowCount = actions.filter((a) => a.effort === 'now').length
  if (nowCount) parts.push(`其中 ${nowCount} 項今天就能做。`)
  return parts.join('')
}
