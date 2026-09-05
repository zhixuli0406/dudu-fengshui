#!/usr/bin/env python3
"""Verify the Xuan Kong Flying Star algorithm against independently sourced charts."""

# Palace indices 1..9 use Luoshu numbering as PALACE IDs:
# 1=坎(N) 2=坤(SW) 3=震(E) 4=巽(SE) 5=中 6=乾(NW) 7=兌(W) 8=艮(NE) 9=離(S)
PALACE_NAME = {1: "坎/北", 2: "坤/西南", 3: "震/東", 4: "巽/東南", 5: "中",
               6: "乾/西北", 7: "兌/西", 8: "艮/東北", 9: "離/南"}

# Luoshu forward flight order (中→乾→兌→艮→離→坎→坤→震→巽)
FLIGHT_ORDER = [5, 6, 7, 8, 9, 1, 2, 3, 4]

# 24 mountains, clockwise from north, with degree start (each spans 15 deg)
# order confirmed: 壬子癸 丑艮寅 甲卯乙 辰巽巳 丙午丁 未坤申 庚酉辛 戌乾亥
MOUNTAINS = [
    # (name, palace, yuan(地/天/人), yinyang(+1 yang / -1 yin), start_deg)
    ("壬", 1, "地", +1, 337.5), ("子", 1, "天", -1, 352.5), ("癸", 1, "人", -1, 7.5),
    ("丑", 8, "地", -1, 22.5), ("艮", 8, "天", +1, 37.5), ("寅", 8, "人", +1, 52.5),
    ("甲", 3, "地", +1, 67.5), ("卯", 3, "天", -1, 82.5), ("乙", 3, "人", -1, 97.5),
    ("辰", 4, "地", -1, 112.5), ("巽", 4, "天", +1, 127.5), ("巳", 4, "人", +1, 142.5),
    ("丙", 9, "地", +1, 157.5), ("午", 9, "天", -1, 172.5), ("丁", 9, "人", -1, 187.5),
    ("未", 2, "地", -1, 202.5), ("坤", 2, "天", +1, 217.5), ("申", 2, "人", +1, 232.5),
    ("庚", 7, "地", +1, 247.5), ("酉", 7, "天", -1, 262.5), ("辛", 7, "人", -1, 277.5),
    ("戌", 6, "地", -1, 292.5), ("乾", 6, "天", +1, 307.5), ("亥", 6, "人", +1, 322.5),
]
M = {m[0]: m for m in MOUNTAINS}


def fly(center_star, forward):
    """Distribute stars from center. Returns {palace: star}."""
    out = {}
    s = center_star
    for p in FLIGHT_ORDER:
        out[p] = s
        s = (s + (1 if forward else -1) - 1) % 9 + 1
    return out


def yin_yang_of(star_num, yuan):
    """The star lands in palace `star_num`; take the mountain of the SAME yuan
    in that palace and read its yin/yang. Star 5 has no trigram -> caller handles."""
    for name, palace, y, yy, _ in MOUNTAINS:
        if palace == star_num and y == yuan:
            return yy, name
    return None, None


def build_chart(period, sit_mountain):
    """sit_mountain e.g. '子'. Facing = opposite (index +12)."""
    idx = [m[0] for m in MOUNTAINS].index(sit_mountain)
    face_mountain = MOUNTAINS[(idx + 12) % 24][0]

    period_plate = fly(period, True)  # period plate ALWAYS flies forward

    sit_p, sit_yuan = M[sit_mountain][1], M[sit_mountain][2]
    face_p, face_yuan = M[face_mountain][1], M[face_mountain][2]

    mtn_center = period_plate[sit_p]   # period star sitting on the sitting palace
    fac_center = period_plate[face_p]  # period star sitting on the facing palace

    # Direction of flight
    if mtn_center == 5:
        mtn_yy = M[sit_mountain][3]        # 5 has no trigram -> use the sitting mtn itself
        src = f"5入中,借坐山{sit_mountain}陰陽"
    else:
        mtn_yy, ref = yin_yang_of(mtn_center, sit_yuan)
        src = f"{mtn_center}落{PALACE_NAME[mtn_center]}宮,{sit_yuan}元龍={ref}"
    if fac_center == 5:
        fac_yy = M[face_mountain][3]
        src2 = f"5入中,借向{face_mountain}陰陽"
    else:
        fac_yy, ref2 = yin_yang_of(fac_center, face_yuan)
        src2 = f"{fac_center}落{PALACE_NAME[fac_center]}宮,{face_yuan}元龍={ref2}"

    mtn_plate = fly(mtn_center, mtn_yy > 0)
    fac_plate = fly(fac_center, fac_yy > 0)

    return {
        "period": period, "sit": sit_mountain, "face": face_mountain,
        "sit_palace": sit_p, "face_palace": face_p,
        "period_plate": period_plate, "mtn_plate": mtn_plate, "fac_plate": fac_plate,
        "mtn_dir": "順" if mtn_yy > 0 else "逆", "fac_dir": "順" if fac_yy > 0 else "逆",
        "why_mtn": src, "why_fac": src2,
    }


def classify(c):
    """格局判定"""
    p, sp, fp = c["period"], c["sit_palace"], c["face_palace"]
    ms, fs = c["mtn_plate"], c["fac_plate"]
    tags = []
    if ms[sp] == p and fs[fp] == p:
        tags.append("旺山旺向(到山到向)")
    elif ms[fp] == p and fs[sp] == p:
        tags.append("上山下水")
    elif ms[fp] == p and fs[fp] == p:
        tags.append("雙星到向(雙星會向)")
    elif ms[sp] == p and fs[sp] == p:
        tags.append("雙星到坐(雙星會坐)")

    # 合十 with period plate
    if all((ms[k] + c["period_plate"][k]) % 10 == 0 for k in range(1, 10)):
        tags.append("全盤山星與運盤合十")
    if all((fs[k] + c["period_plate"][k]) % 10 == 0 for k in range(1, 10)):
        tags.append("全盤向星與運盤合十")

    # 伏吟 (star plate == period plate) / 反吟 (star plate + 元旦盤 == 10)
    yuandan = {k: k for k in range(1, 10)}  # 元旦盤: palace id == its Luoshu number
    for label, plate in (("山盤", ms), ("向盤", fs)):
        if all(plate[k] == c["period_plate"][k] for k in range(1, 10)):
            tags.append(f"{label}全盤伏吟(與運盤同)")
        if all(plate[k] == yuandan[k] for k in range(1, 10)):
            tags.append(f"{label}全盤伏吟(與元旦盤同)")
        if all(plate[k] + yuandan[k] == 10 for k in range(1, 10)):
            tags.append(f"{label}全盤反吟(與元旦盤合十)")

    # 父母三般卦 (each palace's 運/山/向 form {1,4,7} {2,5,8} or {3,6,9})
    groups = [{1, 4, 7}, {2, 5, 8}, {3, 6, 9}]
    if all(any({c["period_plate"][k], ms[k], fs[k]} <= g for g in groups) for k in range(1, 10)):
        tags.append("父母三般卦")
    return tags


def show(c):
    print(f"\n=== {c['period']}運 {c['sit']}山{c['face']}向 ===")
    print(f"  山盤: {c['mtn_plate'][5] if 5 in c['mtn_plate'] else '?'} 入中 {c['mtn_dir']}飛  ({c['why_mtn']})")
    print(f"  向盤: {c['fac_plate'][5]} 入中 {c['fac_dir']}飛  ({c['why_fac']})")
    for p in [4, 9, 2, 3, 5, 7, 8, 1, 6]:
        print(f"    {PALACE_NAME[p]:<7} 山{c['mtn_plate'][p]} 向{c['fac_plate'][p]} 運{c['period_plate'][p]}")
    print(f"  格局: {', '.join(classify(c)) or '(無特殊格局)'}")


# ---------- VERIFICATION ----------
# Expected values transcribed from published charts (山,向,運)
EXPECTED = {
    ("9", "子"): {  # source: vocus.cc/article/648c769afd89780001c93f95
        1: (9, 9, 5), 9: (1, 8, 4), 2: (8, 1, 6), 3: (7, 2, 7),
        7: (3, 6, 2), 6: (4, 5, 1), 8: (2, 7, 3), 4: (6, 3, 8),
    },
    ("9", "巽"): {  # source: 108s.tw/article/info/365 (巽山乾向 下元九運)
        4: (7, 2, 8), 9: (3, 6, 4), 2: (5, 4, 6), 3: (6, 3, 7), 5: (8, 1, 9),
        7: (1, 8, 2), 8: (2, 7, 3), 1: (4, 5, 5), 6: (9, 9, 1),
    },
}

print("=" * 60)
print("VERIFICATION AGAINST PUBLISHED CHARTS")
print("=" * 60)
all_ok = True
for (per, sit), exp in EXPECTED.items():
    c = build_chart(int(per), sit)
    ok = True
    for palace, (m, f, r) in exp.items():
        got = (c["mtn_plate"][palace], c["fac_plate"][palace], c["period_plate"][palace])
        if got != (m, f, r):
            ok = False
            all_ok = False
            print(f"  MISMATCH {per}運{sit}山 {PALACE_NAME[palace]}: expected {(m,f,r)} got {got}")
    print(f"[{'PASS' if ok else 'FAIL'}] {per}運 {sit}山 — {len(exp)} palaces checked")
print(f"\nOVERALL: {'ALL PASS' if all_ok else 'FAILURES PRESENT'}")

show(build_chart(9, "子"))
show(build_chart(9, "巽"))
show(build_chart(9, "乾"))

# Sanity: how many of the 24 mountains give 旺山旺向 in period 9?
print("\n=== 九運 24山 格局總覽 ===")
for name, *_ in MOUNTAINS:
    c = build_chart(9, name)
    print(f"  {name}山{c['face']}向: {', '.join(classify(c)) or '-'}")

# Cross-check: period 8, 乾山巽向 should be 旺山旺向 (per 108s.tw/article/info/413)
c8 = build_chart(8, "乾")
print(f"\n八運 乾山巽向 格局 = {classify(c8)}  (來源稱應為旺山旺向)")
