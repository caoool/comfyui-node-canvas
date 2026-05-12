import { describe, expect, it } from 'vitest'
import { normalizePackFolderName, uniquePackFolderName } from '../../src/lib/packIdentity'

describe('packIdentity', () => {
  it('normalizes pack folder names into safe Python package-style folders', () => {
    expect(normalizePackFolderName('My Audio Pack')).toBe('My_Audio_Pack')
    expect(normalizePackFolderName('123 bad/name')).toBe('Pack_123_bad_name')
    expect(normalizePackFolderName('../')).toBe('ComfyUINodeBuilder')
  })

  it('deduplicates pack folder names without changing existing projects', () => {
    expect(uniquePackFolderName('My Pack', [
      { id: 'p1', packFolderName: 'My_Pack' },
      { id: 'p2', packFolderName: 'My_Pack_2' },
    ])).toBe('My_Pack_3')
    expect(uniquePackFolderName('My Pack', [
      { id: 'p1', packFolderName: 'My_Pack' },
    ], 'p1')).toBe('My_Pack')
  })
})
