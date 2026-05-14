import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DeployPipelineDeps } from '../../src/lib/deployPipeline'
import type { Project } from '../../src/types/index'

const mocks = vi.hoisted(() => ({
  deployManagedPack: vi.fn(),
  installManagedDependencies: vi.fn(),
  readManagedProject: vi.fn(),
  validateInstallPath: vi.fn(),
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
  validateInstallPath: mocks.validateInstallPath,
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
    mocks.validateInstallPath.mockResolvedValue({ ok: true, customNodesPath: '/ComfyUI/custom_nodes' })
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
      expect(project.packFolderName).toBe('ComfyUINodeBuilder/FirstPack')
      projectStore.switchProject(secondPack.id!)
      return {
        success: true,
        path: '/ComfyUI/custom_nodes/ComfyUINodeBuilder',
        filesWritten: ['requirements.txt'],
        restartRequired: true,
      }
    })

    const wrapper = mount(App)
    await wrapper.get('[data-testid="deploy"]').trigger('click')
    await flushPromises()

    expect(mocks.deployManagedPack).toHaveBeenCalledWith('/ComfyUI', expect.objectContaining({
      name: 'First Pack',
      packFolderName: 'ComfyUINodeBuilder/FirstPack',
    }))
    expect(mocks.installManagedDependencies).toHaveBeenCalledWith('/ComfyUI', 'ComfyUINodeBuilder/FirstPack')
    expect(mocks.restartComfyUI).toHaveBeenCalledWith('http://127.0.0.1:8188')
  })

  it('warns on startup when ComfyUI install path is not set', async () => {
    const { default: App } = await import('../../src/App.vue')
    const { useUiStore } = await import('../../src/stores/ui')
    const uiStore = useUiStore()

    mount(App)
    await flushPromises()

    expect(mocks.validateInstallPath).not.toHaveBeenCalled()
    expect(uiStore.diagnostics[0]).toMatchObject({
      level: 'warning',
      title: 'Set ComfyUI install path',
    })
  })

  it('checks remembered ComfyUI install path on startup without notifying on success', async () => {
    const { default: App } = await import('../../src/App.vue')
    const { useProjectStore } = await import('../../src/stores/project')
    const { useUiStore } = await import('../../src/stores/ui')
    const projectStore = useProjectStore()
    const uiStore = useUiStore()
    projectStore.setComfyuiInstallPath('/ComfyUI')

    mount(App)
    await flushPromises()

    expect(mocks.validateInstallPath).toHaveBeenCalledWith('/ComfyUI')
    expect(uiStore.diagnostics).toEqual([])
    expect(uiStore.toasts).toEqual([])
  })
})
