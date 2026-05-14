import { describe, expect, it } from 'vitest'
import { mkdir, readdir, readFile, writeFile } from 'fs/promises'
import path from 'path'
import os from 'os'
import {
  BUILDER_METADATA_ID,
  BUILDER_METADATA_VERSION,
  builderMetadataPathFor,
  buildBuilderRootInitPy,
  customNodesDirFor,
  isSafePackName,
  isSafePackFilePath,
  listBuilderOwnedProjects,
  listManagedPackFilesystem,
  managedPackDirFor,
  packFilePathFor,
  parseBuilderOwnedProject,
  removeLegacyBuilderPackDirs,
  syncBuilderRootPackage,
  syncManagedPackDir,
} from '../../server/managedProject'

describe('server managed project helpers', () => {
  it('resolves all managed pack paths inside the ComfyUINodeBuilder custom node folder', () => {
    expect(customNodesDirFor('/ComfyUI')).toBe('/ComfyUI/custom_nodes')
    expect(managedPackDirFor('/ComfyUI')).toBe('/ComfyUI/custom_nodes/ComfyUINodeBuilder/ComfyUINodeBuilder')
    expect(builderMetadataPathFor('/ComfyUI')).toBe('/ComfyUI/custom_nodes/ComfyUINodeBuilder/ComfyUINodeBuilder/builder.project.json')
    expect(managedPackDirFor('/ComfyUI', 'MyPack')).toBe('/ComfyUI/custom_nodes/ComfyUINodeBuilder/MyPack')
    expect(managedPackDirFor('/ComfyUI', 'ComfyUINodeBuilder/MyPack')).toBe('/ComfyUI/custom_nodes/ComfyUINodeBuilder/MyPack')
    expect(builderMetadataPathFor('/ComfyUI', 'MyPack')).toBe('/ComfyUI/custom_nodes/ComfyUINodeBuilder/MyPack/builder.project.json')
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

  it('lists builder-owned projects from pack folders inside the ComfyUINodeBuilder custom node folder', async () => {
    const result = await listBuilderOwnedProjects('/ComfyUI', {
      exists: candidate => candidate === '/ComfyUI/custom_nodes',
      readdir: async candidate => {
        if (candidate === '/ComfyUI/custom_nodes') {
          return [
            { name: 'ComfyUINodeBuilder', isDirectory: () => true },
            { name: 'file.py', isDirectory: () => false },
          ]
        }
        if (candidate === '/ComfyUI/custom_nodes/ComfyUINodeBuilder') {
          return [
            { name: 'BuilderPack', isDirectory: () => true },
          ]
        }
        if (candidate === '/ComfyUI/custom_nodes/ComfyUINodeBuilder/BuilderPack') {
          return [
            { name: 'builder.project.json', isDirectory: () => false },
          ]
        }
        return []
      },
      readFile: async candidate => {
        if (candidate === '/ComfyUI/custom_nodes/ComfyUINodeBuilder/BuilderPack/builder.project.json') {
          return JSON.stringify({
            builder: BUILDER_METADATA_ID,
            schemaVersion: BUILDER_METADATA_VERSION,
            project: { name: 'Builder Pack', packFolderName: 'ComfyUINodeBuilder/BuilderPack', nodes: [] },
          })
        }
        throw new Error('unexpected path')
      },
    })

    expect(result).toEqual([
      {
        packName: 'ComfyUINodeBuilder/BuilderPack',
        path: '/ComfyUI/custom_nodes/ComfyUINodeBuilder/BuilderPack/builder.project.json',
        project: { name: 'Builder Pack', packFolderName: 'ComfyUINodeBuilder/BuilderPack', nodes: [] },
      },
    ])
  })

  it('builds a root ComfyUI package loader that discovers nested managed packs', () => {
    const initPy = buildBuilderRootInitPy()

    expect(initPy).toContain('NODE_CLASS_MAPPINGS = {}')
    expect(initPy).toContain('NODE_DISPLAY_NAME_MAPPINGS = {}')
    expect(initPy).toContain('WEB_DIRECTORY = "./web"')
    expect(initPy).toContain('_ROOT.glob("**/__init__.py")')
    expect(initPy).toContain('builder.project.json')
    expect(initPy).toContain('NODE_CLASS_MAPPINGS.update')
    expect(initPy).toContain('Failed to import managed pack')
  })

  it('writes the root ComfyUINodeBuilder loader outside the selected pack folder', async () => {
    const root = await mkdir(path.join(os.tmpdir(), `builder-root-loader-${Date.now()}-`), { recursive: true })
    await mkdir(path.join(root, 'custom_nodes'), { recursive: true })

    const written = await syncBuilderRootPackage(root)

    expect(written).toEqual(['__init__.py'])
    const rootInit = await readFile(path.join(root, 'custom_nodes', 'ComfyUINodeBuilder', '__init__.py'), 'utf8')
    expect(rootInit).toContain('custom_nodes/ComfyUINodeBuilder')
    expect(rootInit).toContain('NODE_CLASS_MAPPINGS.update')
  })

  it('syncs the managed folder exactly to the next builder file map', async () => {
    const root = await mkdir(path.join(os.tmpdir(), `builder-sync-${Date.now()}-`), { recursive: true })
    const packDir = path.join(root, 'ComfyUINodeBuilder')
    await mkdir(path.join(packDir, 'web'), { recursive: true })
    await mkdir(path.join(packDir, 'old-dir'), { recursive: true })
    await writeFile(path.join(packDir, 'OldNode.py'), '# stale\n')
    await writeFile(path.join(packDir, 'web', 'old.js'), '// stale\n')
    await writeFile(path.join(packDir, 'old-dir', 'leftover.txt'), 'stale\n')

    const files = {
      '__init__.py': '# init\n',
      'builder.project.json': '{}\n',
      'web/runtimeUiDisplays.js': '// runtime\n',
    }

    const written = await syncManagedPackDir(packDir, files)

    expect(written).toEqual(['__init__.py', 'builder.project.json', 'web/runtimeUiDisplays.js'])
    expect((await readdir(packDir)).sort()).toEqual(['__init__.py', 'builder.project.json', 'web'])
    expect(await readFile(path.join(packDir, 'web', 'runtimeUiDisplays.js'), 'utf8')).toBe('// runtime\n')
    expect(await readdir(path.join(packDir, 'web'))).toEqual(['runtimeUiDisplays.js'])
  })

  it('preserves installer-owned vendor files when the deployed pack has install.py', async () => {
    const root = await mkdir(path.join(os.tmpdir(), `builder-sync-vendor-${Date.now()}-`), { recursive: true })
    const packDir = path.join(root, 'ComfyUINodeBuilder')
    await mkdir(path.join(packDir, 'vendor', 'CosyVoice', 'cosyvoice', 'cli'), { recursive: true })
    await writeFile(path.join(packDir, 'vendor', 'CosyVoice', 'cosyvoice', 'cli', 'cosyvoice.py'), '# vendored\n')
    await writeFile(path.join(packDir, 'OldNode.py'), '# stale\n')

    const files = {
      '__init__.py': '# init\n',
      'builder.project.json': '{}\n',
      'install.py': 'print("setup")\n',
    }

    await syncManagedPackDir(packDir, files)

    expect(await readFile(path.join(packDir, 'vendor', 'CosyVoice', 'cosyvoice', 'cli', 'cosyvoice.py'), 'utf8')).toBe('# vendored\n')
    expect((await readdir(packDir)).sort()).toEqual(['__init__.py', 'builder.project.json', 'install.py', 'vendor'])
  })

  it('lists the deployed managed pack filesystem recursively', async () => {
    const root = await mkdir(path.join(os.tmpdir(), `builder-list-files-${Date.now()}-`), { recursive: true })
    const packDir = managedPackDirFor(root, 'VoiceToolset')
    await mkdir(path.join(packDir, 'vendor', 'CosyVoice'), { recursive: true })
    await mkdir(path.join(packDir, 'empty-dir'), { recursive: true })
    await writeFile(path.join(packDir, '__init__.py'), '# init\n')
    await writeFile(path.join(packDir, 'vendor', 'CosyVoice', 'README.md'), '# readme\n')

    await expect(listManagedPackFilesystem(root, 'VoiceToolset')).resolves.toEqual([
      { kind: 'file', relativePath: '__init__.py' },
      { kind: 'directory', relativePath: 'empty-dir' },
      { kind: 'directory', relativePath: 'vendor' },
      { kind: 'directory', relativePath: 'vendor/CosyVoice' },
      { kind: 'file', relativePath: 'vendor/CosyVoice/README.md' },
    ])
  })

  it('removes legacy builder-owned sibling pack folders without touching other custom nodes', async () => {
    const removed: string[] = []
    const result = await removeLegacyBuilderPackDirs('/ComfyUI', {
      exists: candidate => candidate === '/ComfyUI/custom_nodes',
      readdir: async () => [
        { name: 'ComfyUINodeBuilder', isDirectory: () => true },
        { name: 'VoiceTools', isDirectory: () => true },
        { name: 'OtherCustomNode', isDirectory: () => true },
      ],
      readFile: async candidate => {
        if (String(candidate).includes('VoiceTools')) {
          return JSON.stringify({
            builder: BUILDER_METADATA_ID,
            schemaVersion: BUILDER_METADATA_VERSION,
            project: { name: 'Voice Tools', packFolderName: 'VoiceTools', nodes: [] },
          })
        }
        return JSON.stringify({
          builder: 'other-tool',
          schemaVersion: BUILDER_METADATA_VERSION,
          project: { name: 'Other', nodes: [] },
        })
      },
      rm: async candidate => { removed.push(candidate) },
    })

    expect(result).toEqual(['VoiceTools'])
    expect(removed).toEqual(['/ComfyUI/custom_nodes/VoiceTools'])
  })

  it('removes old flat builder pack files from the ComfyUINodeBuilder root while preserving nested pack folders', async () => {
    const removed: string[] = []
    const result = await removeLegacyBuilderPackDirs('/ComfyUI', {
      exists: candidate => candidate === '/ComfyUI/custom_nodes',
      readdir: async candidate => {
        if (candidate === '/ComfyUI/custom_nodes') {
          return [{ name: 'ComfyUINodeBuilder', isDirectory: () => true }]
        }
        if (candidate === '/ComfyUI/custom_nodes/ComfyUINodeBuilder') {
          return [
            { name: 'builder.project.json', isDirectory: () => false },
            { name: '__init__.py', isDirectory: () => false },
            { name: 'OldNode.py', isDirectory: () => false },
            { name: 'web', isDirectory: () => true },
            { name: 'VoiceTools', isDirectory: () => true },
          ]
        }
        if (candidate === '/ComfyUI/custom_nodes/ComfyUINodeBuilder/VoiceTools') {
          return [{ name: 'builder.project.json', isDirectory: () => false }]
        }
        return []
      },
      readFile: async candidate => {
        if (candidate === '/ComfyUI/custom_nodes/ComfyUINodeBuilder/builder.project.json') {
          return JSON.stringify({
            builder: BUILDER_METADATA_ID,
            schemaVersion: BUILDER_METADATA_VERSION,
            project: { name: 'Old Flat Pack', packFolderName: 'ComfyUINodeBuilder/OldFlat', nodes: [] },
          })
        }
        if (candidate === '/ComfyUI/custom_nodes/ComfyUINodeBuilder/VoiceTools/builder.project.json') {
          return JSON.stringify({
            builder: BUILDER_METADATA_ID,
            schemaVersion: BUILDER_METADATA_VERSION,
            project: { name: 'Voice Tools', packFolderName: 'ComfyUINodeBuilder/VoiceTools', nodes: [] },
          })
        }
        throw new Error('not metadata')
      },
      rm: async candidate => { removed.push(candidate) },
    })

    expect(result).toEqual([
      '/ComfyUI/custom_nodes/ComfyUINodeBuilder/__init__.py',
      '/ComfyUI/custom_nodes/ComfyUINodeBuilder/builder.project.json',
      '/ComfyUI/custom_nodes/ComfyUINodeBuilder/OldNode.py',
      '/ComfyUI/custom_nodes/ComfyUINodeBuilder/web',
    ])
    expect(removed.sort((a, b) => a.localeCompare(b))).toEqual(result)
  })
})
