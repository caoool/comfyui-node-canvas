import { afterEach, describe, expect, it, vi } from 'vitest'
import { deployManagedPack, installManagedDependencies, listManagedProjects, readManagedProject } from '../../src/lib/writeToFilesystem'
import type { Project } from '../../src/types/index'

describe('writeToFilesystem', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('requests dependency installation through the helper server', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, requirementsPath: '/ComfyUI/custom_nodes/ComfyUINodeBuilder/requirements.txt' }),
    } as Response)

    await installManagedDependencies('/ComfyUI', 'MyPack')

    expect(fetchMock).toHaveBeenCalledWith('/helper/install-managed-dependencies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installPath: '/ComfyUI', packName: 'MyPack' }),
    })
  })

  it('deploys and reads the active project pack folder instead of a fixed folder', async () => {
    const project = {
      id: 'p1',
      name: 'My Pack',
      packFolderName: 'MyPack',
      nodes: [],
      comfyuiUrl: 'http://127.0.0.1:8188',
      comfyuiInstallPath: '/ComfyUI',
      pythonRequirements: [],
      pythonInstallScript: '',
      customFiles: [],
    } satisfies Project
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, path: '/ComfyUI/custom_nodes/ComfyUINodeBuilder', filesWritten: [], restartRequired: true }),
    } as Response)

    await deployManagedPack('/ComfyUI', project)
    await readManagedProject('/ComfyUI', 'MyPack')

    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toMatchObject({
      installPath: '/ComfyUI',
      packName: 'ComfyUINodeBuilder/MyPack',
    })
    expect(JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body))).toEqual({
      installPath: '/ComfyUI',
      packName: 'MyPack',
    })
  })

  it('lists the builder-owned pack from ComfyUI through the helper server', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ packs: [{ packName: 'MyPack', path: '/ComfyUI/custom_nodes/ComfyUINodeBuilder/builder.project.json', project: { name: 'My Pack', nodes: [] } }] }),
    } as Response)

    const result = await listManagedProjects('/ComfyUI')

    expect(fetchMock).toHaveBeenCalledWith('/helper/list-managed-projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installPath: '/ComfyUI' }),
    })
    expect(result.packs[0].packName).toBe('MyPack')
  })
})
