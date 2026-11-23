// The app reads grade keys through the same module the edge functions use (ITS-115). This
// checks the app-side wrappers and that Jest/Metro resolve the shared file.
import { gradePriceKey, parseGrade } from '@/components/tcg-card/GradeBadge'

jest.mock('@/components/ui/text/base-text', () => ({ Text: () => null }))

describe('grade keys in the app', () => {
  it('builds canonical keys like SQL grade_key', () => {
    expect(gradePriceKey('PSA', 10)).toBe('psa10')
    expect(gradePriceKey('bgs', 9.5)).toBe('bgs9_5')
    expect(gradePriceKey(undefined, 10)).toBe('ungraded')
  })

  it('parses canonical and legacy spellings', () => {
    expect(parseGrade('psa10')).toEqual({ company: 'PSA', grade: '10' })
    expect(parseGrade('psa10.0')).toEqual({ company: 'PSA', grade: '10' })
    expect(parseGrade('bgs9.5')).toEqual({ company: 'BGS', grade: '9.5' })
    expect(parseGrade('ungraded')).toBe('raw')
    expect(parseGrade('Raw')).toBe('raw')
    expect(parseGrade(null)).toBeNull()
  })

  it('shows an unrecognised key as its label', () => {
    expect(parseGrade('weird_key')).toEqual({ company: expect.any(String), grade: '' })
  })
})
