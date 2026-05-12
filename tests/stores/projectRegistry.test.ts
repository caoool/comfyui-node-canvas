import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useProjectStore } from '../../src/stores/project'
import type { Project } from '../../src/types/index'

const LEGACY_STORAGE_KEY = 'comfyui-node-builder-project'
const REGISTRY_STORAGE_KEY = 'comfyui-node-builder-pack-registry'

describe('project pack registry', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('migrates the legacy single project into a local pack registry', () => {
    const legacyProject = {
      id: 'legacy-project',
      name: 'Legacy Pack',
      nodes: [],
      comfyuiUrl: 'http://127.0.0.1:8188',
      comfyuiInstallPath: '/ComfyUI',
    } satisfies Partial<Project>
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacyProject))

    const projectStore = useProjectStore()

    expect(projectStore.project.name).toBe('Legacy Pack')
    expect(projectStore.project.packFolderName).toBe('Legacy_Pack')
    expect(projectStore.projectSummaries).toEqual([
      expect.objectContaining({
        id: projectStore.project.id,
        name: 'Legacy Pack',
        packFolderName: 'Legacy_Pack',
      }),
    ])
  })

  it('creates and switches independent local packs without mixing nodes', () => {
    const projectStore = useProjectStore()
    const firstNode = projectStore.addNode('blank')
    projectStore.updateNode(firstNode.id, { displayName: 'First Pack Node' })

    const secondPack = projectStore.createProject('Second Pack')
    projectStore.switchProject(secondPack.id)
    const secondNode = projectStore.addNode('text-utility')
    projectStore.updateNode(secondNode.id, { displayName: 'Second Pack Node' })

    expect(projectStore.project.name).toBe('Second Pack')
    expect(projectStore.project.packFolderName).toBe('Second_Pack')
    expect(projectStore.project.nodes.map(node => node.displayName)).toEqual(['Second Pack Node'])

    projectStore.switchProject(projectStore.projectSummaries.find(summary => summary.name === 'ComfyUINodeBuilder')!.id)

    expect(projectStore.project.nodes.map(node => node.displayName)).toEqual(['First Pack Node'])

    const persisted = JSON.parse(localStorage.getItem(REGISTRY_STORAGE_KEY) ?? '{}')
    expect(persisted.projects).toHaveLength(2)
    expect(persisted.projects.map((project: Project) => project.packFolderName).sort()).toEqual(['ComfyUINodeBuilder', 'Second_Pack'])
  })

  it('imports a builder-owned ComfyUI pack as a separate local pack and switches to it', () => {
    const projectStore = useProjectStore()
    projectStore.addNode('blank')

    const imported = projectStore.importProject({
      name: 'Imported Pack',
      packFolderName: 'ImportedPack',
      nodes: [],
      comfyuiUrl: 'http://127.0.0.1:8188',
      comfyuiInstallPath: '/ComfyUI',
      pythonRequirements: ['requests'],
      pythonInstallScript: '',
      customFiles: [],
    })

    expect(projectStore.project.id).toBe(imported.id)
    expect(projectStore.project.name).toBe('Imported Pack')
    expect(projectStore.project.packFolderName).toBe('ImportedPack')
    expect(projectStore.project.pythonRequirements).toEqual(['requests'])
    expect(projectStore.projectSummaries).toHaveLength(2)
  })

  it('renames the active pack display name and ComfyUI folder without colliding with other packs', () => {
    const projectStore = useProjectStore()

    projectStore.setProjectName('Vision Tools')
    projectStore.setPackFolderName('Vision Tools')

    expect(projectStore.project.name).toBe('Vision Tools')
    expect(projectStore.project.packFolderName).toBe('Vision_Tools')

    projectStore.createProject('Audio Tools')
    projectStore.setPackFolderName('Vision Tools')

    expect(projectStore.project.name).toBe('Audio Tools')
    expect(projectStore.project.packFolderName).toBe('Vision_Tools_2')
    expect(projectStore.projectSummaries.map(summary => summary.packFolderName).sort()).toEqual([
      'Vision_Tools',
      'Vision_Tools_2',
    ])
  })

  it('duplicates and deletes packs without mixing active pack state', () => {
    const projectStore = useProjectStore()
    projectStore.setProjectName('Vision Tools')
    projectStore.setPackFolderName('VisionTools')
    const node = projectStore.addNode('blank')
    projectStore.updateNode(node.id, { name: 'VisionNode', displayName: 'Vision Node' })

    const originalId = projectStore.project.id!
    const duplicate = projectStore.duplicateProject(originalId)

    expect(duplicate).toEqual(expect.objectContaining({
      name: 'Vision Tools Copy',
      packFolderName: 'VisionTools_Copy',
    }))
    expect(projectStore.project.id).toBe(duplicate?.id)
    expect(projectStore.project.nodes[0]).toEqual(expect.objectContaining({
      name: 'VisionNode',
      displayName: 'Vision Node',
    }))
    expect(projectStore.project.nodes[0].id).not.toBe(node.id)

    const deleted = projectStore.deleteProject(duplicate!.id!)

    expect(deleted).toBe(true)
    expect(projectStore.project.id).toBe(originalId)
    expect(projectStore.projectSummaries).toHaveLength(1)
    expect(projectStore.deleteProject(originalId)).toBe(false)
  })
})
