import { describe, expect, it } from 'vitest'
import { controlledBy, controls, generatedBy, generates, relation } from './fiveElements'

describe('五行生剋', () => {
  it('相生循環', () => {
    expect(generates('wood')).toBe('fire')
    expect(generates('fire')).toBe('earth')
    expect(generates('earth')).toBe('metal')
    expect(generates('metal')).toBe('water')
    expect(generates('water')).toBe('wood')
  })
  it('相剋循環', () => {
    expect(controls('wood')).toBe('earth')
    expect(controls('earth')).toBe('water')
    expect(controls('water')).toBe('fire')
    expect(controls('fire')).toBe('metal')
    expect(controls('metal')).toBe('wood')
  })
  it('反向查詢', () => {
    expect(generatedBy('fire')).toBe('wood')
    expect(controlledBy('wood')).toBe('metal')
  })
  it('relation', () => {
    expect(relation('wood', 'wood')).toBe('same')
    expect(relation('wood', 'fire')).toBe('generates')
    expect(relation('fire', 'wood')).toBe('generatedBy')
    expect(relation('wood', 'earth')).toBe('controls')
    expect(relation('earth', 'wood')).toBe('controlledBy')
  })
})
