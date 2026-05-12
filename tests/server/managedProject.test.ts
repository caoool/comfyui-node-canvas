import { describe, expect, it } from 'vitest'
import {
  BUILDER_METADATA_ID,
  BUILDER_METADATA_VERSION,
  builderMetadataPathFor,
  customNodesDirFor,
  isSafePackName,
  isSafePackFilePath,
  listBuilderOwnedProjects,
  managedPackDirFor,
  packFilePathFor,
  parseBuilderOwnedProject,
} from '../../server/managedProject'

describe('server managed project helpers', () => {
  it('resolves load path only inside the requested managed pack folder', () => {
    expect(customNodesDirFor('/ComfyUI')).toBe('/ComfyUI/custom_nodes')
    expect(managedPackDirFor('/ComfyUI')).toBe('/ComfyUI/custom_nodes/ComfyUINodeBuilder')
    expect(builderMetadataPathFor('/ComfyUI')).toBe('/ComfyUI/custom_nodes/ComfyUINodeBuilder/builder.project.json')
    expect(managedPackDirFor('/ComfyUI', 'MyPack')).toBe('/ComfyUI/custom_nodes/MyPack')
    expect(builderMetadataPathFor('/ComfyUI', 'MyPack')).toBe('/ComfyUI/custom_nodes/MyPack/builder.project.json')
  })

  it('accepts only safe pack folder names', () => {
    expect(isSafePackName('ComfyUINodeBuilder')).toBe(true)
    expect(isSafePackName('My_Pack_2')).toBe(true)
    expect(isSafePackName('../Other')).toBe(false)
    expect(isSafePackName('has/slash')).toBe(false)
    expect(isSafePackName('123StartsWithNumber')).toBe(false)
  })

  it('accepts only builder-owned metadata wrapper', () => {
    const project = { name: 'Owned', nodes: [] }
    const loaded = parseBuilderOwnedProject(JSON.stringify({
      builder: BUILDER_METADATA_ID,
      schemaVersion: BUILDER_METADATA_VERSION,
      project,
    }))
    expect(loaded).toEqual(project)
  })

  it('rejects raw project json without builder ownership marker', () => {
    expect(() => parseBuilderOwnedProject(JSON.stringify({
      name: 'Raw Project',
      nodes: [],
    }))).toThrow('not owned')
  })

  it('rejects another tool ownership marker', () => {
    expect(() => parseBuilderOwnedProject(JSON.stringify({
      builder: 'other-tool',
      schemaVersion: BUILDER_METADATA_VERSION,
      project: { name: 'Other', nodes: [] },
    }))).toThrow('not owned')
  })

  it('allows safe nested pack files for ComfyUI web extensions', () => {
    expect(isSafePackFilePath('TextUtility.py')).toBe(true)
    expect(isSafePackFilePath('__init__.py')).toBe(true)
    expect(isSafePackFilePath('web/runtimeUiDisplays.js')).toBe(true)
    expect(packFilePathFor('/ComfyUI/custom_nodes/ComfyUINodeBuilder', 'web/runtimeUiDisplays.js'))
      .toBe('/ComfyUI/custom_nodes/ComfyUINodeBuilder/web/runtimeUiDisplays.js')
  })

  it('rejects unsafe pack file paths', () => {
    expect(isSafePackFilePath('../outside.py')).toBe(false)
    expect(isSafePackFilePath('web/../outside.py')).toBe(false)
    expect(isSafePackFilePath('/tmp/outside.py')).toBe(false)
    expect(isSafePackFilePath('web\\runtimeUiDisplays.js')).toBe(false)
    expect(isSafePackFilePath('web//runtimeUiDisplays.js')).toBe(false)
  })

  it('lists only builder-owned projects from custom_nodes subfolders', async () => {
    const entries = [
      { name: 'BuilderPack', isDirectory: () => true },
      { name: 'OtherPack', isDirectory: () => true },
      { name: 'file.py', isDirectory: () => false },
    ]
    const result = await listBuilderOwnedProjects('/ComfyUI', {
      exists: candidate => candidate === '/ComfyUI/custom_nodes',
      readdir: async () => entries,
      readFile: async candidate => {
        if (String(candidate).endsWith('BuilderPack/builder.project.json')) {
          return JSON.stringify({
            builder: BUILDER_METADATA_ID,
            schemaVersion: BUILDER_METADATA_VERSION,
            project: { name: 'Builder Pack', packFolderName: 'BuilderPack', nodes: [] },
          })
        }
        return JSON.stringify({ builder: 'other-tool', schemaVersion: 1, project: { name: 'Other', nodes: [] } })
      },
    })

    expect(result).toEqual([
      {
        packName: 'BuilderPack',
        path: '/ComfyUI/custom_nodes/BuilderPack/builder.project.json',
        project: { name: 'Builder Pack', packFolderName: 'BuilderPack', nodes: [] },
      },
    ])
  })
})
