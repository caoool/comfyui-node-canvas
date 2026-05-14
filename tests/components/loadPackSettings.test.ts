import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppToolbar from '../../src/components/AppToolbar.vue'
import SettingsModal from '../../src/components/SettingsModal.vue'
import { useProjectStore } from '../../src/stores/project'

const mocks = vi.hoisted(() => ({
  checkConnection: vi.fn(),
  validateInstallPath: vi.fn(),
}))

vi.mock('../../src/lib/comfyuiApi', () => ({
  checkConnection: mocks.checkConnection,
}))

vi.mock('../../src/lib/writeToFilesystem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/writeToFilesystem')>()
  return {
    ...actual,
    validateInstallPath: mocks.validateInstallPath,
  }
})

describe('load pack placement', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.checkConnection.mockResolvedValue(true)
    mocks.validateInstallPath.mockResolvedValue({ ok: true, customNodesPath: '/ComfyUI/custom_nodes' })
  })

  it('removes Load Pack from the main toolbar', () => {
    const wrapper = mount(AppToolbar, {
      props: {
        exportDisabled: false,
        deployInProgress: false,
      },
    })

    expect(wrapper.text()).not.toContain('Load Pack')
    expect(wrapper.emitted('load-managed-pack')).toBeUndefined()
  })

  it('puts Load Pack under Settings with an overwrite warning and acknowledgement gate', async () => {
    const wrapper = mount(SettingsModal, {
      props: {
        modelValue: true,
      },
      global: {
        stubs: {
          Teleport: true,
        },
      },
    })

    expect(wrapper.text()).toContain('Load Builder Pack')
    expect(wrapper.text()).toContain('replaces the current builder project')
    expect(wrapper.text()).toContain('builder.project.json')

    expect(wrapper.get('[data-testid="settings-load-pack"]').attributes('disabled')).toBeDefined()

    await wrapper.get('[data-testid="settings-load-pack-ack"]').setValue(true)
    const enabledLoadButton = wrapper.get('[data-testid="settings-load-pack"]')
    expect(enabledLoadButton.attributes('disabled')).toBeUndefined()
    await enabledLoadButton.trigger('click')

    expect(wrapper.emitted('load-managed-pack')).toHaveLength(1)
  })

  it('scans ComfyUI custom_nodes and imports builder-owned packs from Settings', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      packs: [
        {
          packName: 'AudioTools',
          path: '/ComfyUI/custom_nodes/ComfyUINodeBuilder/builder.project.json',
          project: {
            name: 'Audio Tools',
            packFolderName: 'AudioTools',
            nodes: [],
            comfyuiUrl: 'http://127.0.0.1:8188',
            comfyuiInstallPath: '/ComfyUI',
          },
        },
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(SettingsModal, {
      props: {
        modelValue: true,
      },
      global: {
        stubs: {
          Teleport: true,
        },
      },
    })

    await wrapper.get('[data-testid="settings-install-path"]').setValue('/ComfyUI')
    await wrapper.get('[data-testid="settings-scan-packs"]').trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/helper/list-managed-projects', expect.objectContaining({
      body: JSON.stringify({ installPath: '/ComfyUI' }),
    }))
    expect(wrapper.text()).toContain('Audio Tools')

    await wrapper.get('[data-testid="settings-import-pack-AudioTools"]').trigger('click')

    const emitted = wrapper.emitted('import-managed-pack')
    expect(emitted).toHaveLength(1)
    expect(emitted?.[0]).toEqual([
      expect.objectContaining({ name: 'Audio Tools' }),
      'AudioTools',
      '/ComfyUI/custom_nodes/ComfyUINodeBuilder/builder.project.json',
    ])
  })

  it('does not call the helper when scanning without a ComfyUI install path', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(SettingsModal, {
      props: {
        modelValue: true,
      },
      global: {
        stubs: {
          Teleport: true,
        },
      },
    })

    await wrapper.get('[data-testid="settings-scan-packs"]').trigger('click')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Set the ComfyUI install path before scanning.')
  })

  it('edits the active pack slug from Settings without showing pack name', async () => {
    const projectStore = useProjectStore()
    const wrapper = mount(SettingsModal, {
      props: {
        modelValue: true,
      },
      global: {
        stubs: {
          Teleport: true,
        },
      },
    })

    expect(wrapper.find('[data-testid="settings-pack-name"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Pack Name')

    await wrapper.get('[data-testid="settings-pack-folder"]').setValue('Vision Tools')
    await wrapper.get('[data-testid="settings-pack-folder"]').trigger('change')

    expect(projectStore.project.packFolderName).toBe('ComfyUINodeBuilder/Vision_Tools')
    expect(wrapper.text()).toContain('ComfyUI/custom_nodes/ComfyUINodeBuilder')
  })

  it('auto-checks remembered ComfyUI settings when Settings opens', async () => {
    const projectStore = useProjectStore()
    projectStore.setComfyuiUrl('http://127.0.0.1:8199')
    projectStore.setComfyuiInstallPath('/ComfyUI')

    const wrapper = mount(SettingsModal, {
      props: {
        modelValue: true,
      },
      global: {
        stubs: {
          Teleport: true,
        },
      },
    })
    await flushPromises()

    expect(mocks.checkConnection).toHaveBeenCalledWith('http://127.0.0.1:8199')
    expect(mocks.validateInstallPath).toHaveBeenCalledWith('/ComfyUI')
    expect(wrapper.text()).toContain('Connected')
    expect(wrapper.text()).toContain('/ComfyUI/custom_nodes')
    expect(wrapper.text()).not.toContain('Saved URL')
    expect(wrapper.text()).not.toContain('Saved path')
    expect(wrapper.text()).not.toContain('Not checked')
  })
})
