import { describe, expect, it } from 'vitest'
import { lubanLookup } from './luban'

describe('魯班尺', () => {
  it('第一循環八字順序：財病離義官劫害本', () => {
    const words = [0, 5.5, 11, 16.5, 22, 27.5, 33, 38.5].map((cm) => lubanLookup(cm).word)
    expect(words).toEqual(['財', '病', '離', '義', '官', '劫', '害', '本'])
  })
  it('循環 43.2cm：86.5 回到財、108 為吉', () => {
    expect(lubanLookup(86.5).word).toBe('財')
    expect(lubanLookup(108).auspicious).toBe(true)
  })
  it('凶數給出附近吉數建議', () => {
    const r = lubanLookup(70)
    expect(r.suggestions.length).toBeGreaterThan(0)
    expect(r.suggestions.every((s) => s.to > 0)).toBe(true)
  })
})
