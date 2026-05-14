import { describe, expect, it } from 'vitest'
import { packFolderRelativePath, normalizePackFolderName, uniquePackFolderName } from '../../src/lib/packIdentity'

describe('packIdentity', () => {
  it('normalizes pack slugs under the builder category prefix', () => {
    expect(normalizePackFolderName('My Audio Pack')).toBe('ComfyUINodeBuilder/My_Audio_Pack')
    expect(normalizePackFolderName('123 bad/name')).toBe('ComfyUINodeBuilder/Pack_123_bad/name')
    expect(normalizePackFolderName('ComfyUINodeBuilder/Voice Tools')).toBe('ComfyUINodeBuilder/Voice_Tools')
    expect(normalizePackFolderName('../')).toBe('ComfyUINodeBuilder/')
  })

  it('deduplicates pack slugs without changing existing projects', () => {
    expect(uniquePackFolderName('My Pack', [
      { id: 'p1', packFolderName: 'ComfyUINodeBuilder/My_Pack' },
      { id: 'p2', packFolderName: 'ComfyUINodeBuilder/My_Pack_2' },
    ])).toBe('ComfyUINodeBuilder/My_Pack_3')
    expect(uniquePackFolderName('My Pack', [
      { id: 'p1', packFolderName: 'ComfyUINodeBuilder/My_Pack' },
    ], 'p1')).toBe('ComfyUINodeBuilder/My_Pack')
  })

  it('resolves the folder path below the ComfyUINodeBuilder root', () => {
    expect(packFolderRelativePath('ComfyUINodeBuilder/Voice Tools')).toBe('Voice_Tools')
    expect(packFolderRelativePath('ComfyUINodeBuilder/Group/Voice Tools')).toBe('Group/Voice_Tools')
    expect(packFolderRelativePath('ComfyUINodeBuilder/')).toBe('ComfyUINodeBuilder')
  })
})
