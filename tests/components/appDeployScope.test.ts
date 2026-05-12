import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DeployPipelineDeps } from '../../src/lib/deployPipeline'
import type { Project } from '../../src/types/index'

const mocks = vi.hoisted(() => ({
  deployManagedPack: vi.fn(),
  installManagedDependencies: vi.fn(),
  readManagedProject: vi.fn(),
  restartComfyUI: vi.fn(),
  checkConnection: vi.fn(),
  runDeployPipeline: vi.fn(),
}))

vi.mock('../../src/components/AppLayout.vue', () => ({
  default: {
    name: 'AppLayout',
    props: ['statusText', 'exportDisabled', 'exportDisabledReason', 'deployInProgress'],
    emits: ['deploy', 'export-zip', 'settings'],
    template: '<button data-testid="deploy" @click="$emit(\'deploy\')">Deploy</button><slot name="library" /><slot name="definition" /><slot name="code" />',
  },
}))
vi.mock('../../src/components/SettingsModal.vue', () => ({ default: { template: '<div />' } }))
vi.mock('../../src/components/LeftSidebar.vue', () => ({ default: { template: '<div />' } }))
vi.mock('../../src/components/NodeDefinitionPanel.vue', () => ({ default: { template: '<div />' } }))
vi.mock('../../src/components/CodePanel.vue', () => ({ default: { template: '<div />' } }))
vi.mock('../../src/lib/writeToFilesystem', () => ({
  deployManagedPack: mocks.deployManagedPack,
  installManagedDependencies: mocks.installManagedDependencies,
  readManagedProject: mocks.readManagedProject,
}))
vi.mock('../../src/lib/comfyuiApi', () => ({
  restartComfyUI: mocks.restartComfyUI,
  checkConnection: mocks.checkConnection,
}))
vi.mock('../../src/lib/deployPipeline', () => ({
  runDeployPipeline: mocks.runDeployPipeline,
}))

describe('App deploy scope', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.runDeployPipeline.mockImplementation(async (deps: DeployPipelineDeps) => {
      const deployResult = await deps.deploy()
      const dependencyResult = await deps.installDependencies()
      await deps.restart()
      return {
        deployResult,
        dependencyResult,
        installedDependencies: true,
        backOnline: true,
      }
    })
    mocks.installManagedDependencies.mockResolvedValue({
      success: true,
      python: 'python',
      requirementsPath: 'requirements.txt',
      installScriptPath: 'install.py',
      stdout: '',
      stderr: '',
    })
    mocks.restartComfyUI.mockResolvedValue(undefined)
  })

  it('deploys and installs dependencies for the pack that was active when Deploy was clicked', async () => {
    const { default: App } = await import('../../src/App.vue')
    const { useProjectStore } = await import('../../src/stores/project')
    const projectStore = useProjectStore()
    const firstPackId = projectStore.project.id!
    projectStore.updateProject({
      name: 'First Pack',
      packFolderName: 'FirstPack',
      comfyuiInstallPath: '/ComfyUI',
      comfyuiUrl: 'http://127.0.0.1:8188',
    })
    const secondPack = projectStore.createProject('Second Pack')
    projectStore.switchProject(firstPackId)

    mocks.deployManagedPack.mockImplementation(async (_installPath: string, project: Project) => {
      expect(project.packFolderName).toBe('FirstPack')
      projectStore.switchProject(secondPack.id!)
      return {
        success: true,
        path: '/ComfyUI/custom_nodes/FirstPack',
        filesWritten: ['requirements.txt'],
        restartRequired: true,
      }
    })

    const wrapper = mount(App)
    await wrapper.get('[data-testid="deploy"]').trigger('click')
    await flushPromises()

    expect(mocks.deployManagedPack).toHaveBeenCalledWith('/ComfyUI', expect.objectContaining({
      name: 'First Pack',
      packFolderName: 'FirstPack',
    }))
    expect(mocks.installManagedDependencies).toHaveBeenCalledWith('/ComfyUI', 'FirstPack')
    expect(mocks.restartComfyUI).toHaveBeenCalledWith('http://127.0.0.1:8188')
  })
})
