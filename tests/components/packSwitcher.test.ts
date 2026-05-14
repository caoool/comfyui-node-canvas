import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import AppToolbar from '../../src/components/AppToolbar.vue'
import { useProjectStore } from '../../src/stores/project'

describe('pack switcher', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('creates and switches packs from the toolbar', async () => {
    const projectStore = useProjectStore()
    projectStore.createProject('Audio Tools')
    projectStore.switchProject(projectStore.projectSummaries.find(summary => summary.name === 'ComfyUINodeBuilder')!.id)

    const wrapper = mount(AppToolbar, {
      props: {
        exportDisabled: false,
        deployInProgress: false,
      },
    })

    const select = wrapper.get('[data-testid="pack-switcher"]')
    expect((select.element as HTMLSelectElement).value).toBe(projectStore.project.id)

    await select.setValue(projectStore.projectSummaries.find(summary => summary.name === 'Audio Tools')!.id)
    expect(projectStore.project.name).toBe('Audio Tools')

    await wrapper.get('[data-testid="create-pack"]').trigger('click')
    expect(projectStore.project.name).toMatch(/^New Pack/)
    expect(projectStore.projectSummaries).toHaveLength(3)
  })

  it('renames the active pack directly after the pack selector', async () => {
    const projectStore = useProjectStore()
    const wrapper = mount(AppToolbar, {
      props: {
        exportDisabled: false,
        deployInProgress: false,
      },
    })

    await wrapper.get('[data-testid="rename-pack"]').trigger('click')

    await wrapper.get('[data-testid="toolbar-pack-name"]').setValue('Vision Tools')
    await wrapper.get('[data-testid="toolbar-pack-folder"]').setValue('Vision Tools')
    await wrapper.get('[data-testid="save-pack-rename"]').trigger('click')

    expect(projectStore.project.name).toBe('Vision Tools')
    expect(projectStore.project.packFolderName).toBe('ComfyUINodeBuilder/Vision_Tools')
    expect(wrapper.get('[data-testid="pack-switcher"]').text()).toContain('Vision Tools · ComfyUINodeBuilder/Vision_Tools')
    expect(wrapper.find('[data-testid="toolbar-pack-name"]').exists()).toBe(false)
  })

  it('uses icon pack controls to create, duplicate, rename, and delete packs', async () => {
    const projectStore = useProjectStore()
    const wrapper = mount(AppToolbar, {
      props: {
        exportDisabled: false,
        deployInProgress: false,
      },
    })

    const controls = wrapper.findAll('.pack-switcher > *')
    expect(controls[0].attributes('data-testid')).toBe('create-pack')
    expect(wrapper.get('[data-testid="rename-pack"]').text()).toBe('')
    expect(wrapper.get('[data-testid="duplicate-pack"]').text()).toBe('')
    expect(wrapper.get('[data-testid="delete-pack"]').text()).toBe('')
    expect(wrapper.get('[data-testid="delete-pack"]').attributes('disabled')).toBeUndefined()

    await wrapper.get('[data-testid="create-pack"]').trigger('click')
    expect(projectStore.projectSummaries).toHaveLength(2)

    const createdId = projectStore.project.id!
    await wrapper.get('[data-testid="duplicate-pack"]').trigger('click')
    expect(projectStore.project.name).toBe('New Pack Copy')
    expect(projectStore.project.id).not.toBe(createdId)
    expect(projectStore.projectSummaries).toHaveLength(3)

    await wrapper.get('[data-testid="delete-pack"]').trigger('click')
    expect(projectStore.projectSummaries).toHaveLength(2)
    expect(projectStore.project.id).toBe(createdId)
  })

  it('clears the pack selector when deleting the last local pack', async () => {
    const projectStore = useProjectStore()
    projectStore.setProjectName('Vision Tools')
    projectStore.setPackFolderName('VisionTools')
    const wrapper = mount(AppToolbar, {
      props: {
        exportDisabled: false,
        deployInProgress: false,
      },
    })

    await wrapper.get('[data-testid="delete-pack"]').trigger('click')

    const select = wrapper.get('[data-testid="pack-switcher"]').element as HTMLSelectElement
    expect(projectStore.activeProjectId).toBe('')
    expect(projectStore.projectSummaries).toHaveLength(0)
    expect(select.value).toBe('')
    expect(wrapper.get('[data-testid="pack-switcher"]').text()).not.toContain('Vision Tools')
    expect(wrapper.get('[data-testid="rename-pack"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="duplicate-pack"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="delete-pack"]').attributes('disabled')).toBeDefined()
  })
})
