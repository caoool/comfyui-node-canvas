import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CodePanel from '../../src/components/CodePanel.vue'
import { useProjectStore } from '../../src/stores/project'
import { useUiStore } from '../../src/stores/ui'

vi.mock('@guolao/vue-monaco-editor', () => ({
  VueMonacoEditor: {
    name: 'VueMonacoEditor',
    props: ['value'],
    template: '<textarea data-testid="code-editor" :value="value" />',
  },
}))

describe('CodePanel', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('renders pack files as directories and shows protected chips on protected files', async () => {
    const projectStore = useProjectStore()
    const uiStore = useUiStore()
    const node = projectStore.addNode('blank')
    projectStore.setComfyuiInstallPath('/home/lu/ComfyUI')
    projectStore.updateProject({
      customFiles: [
        { id: 'helper', relativePath: 'shared/helpers.py', content: '# helper\n' },
      ],
    })
    uiStore.selectNode(node.id)

    const wrapper = mount(CodePanel)
    await flushPromises()

    const directories = wrapper.findAll('.file-tree-directory').map(row => row.find('.file-tab-name').text())
    expect(directories).toContain('shared')
    expect(directories).toContain('web')

    const builderMetadataRow = wrapper.findAll('.file-row')
      .find(row => row.text().includes('builder.project.json'))
    const helperRow = wrapper.findAll('.file-row')
      .find(row => row.text().includes('helpers.py'))

    expect(builderMetadataRow?.text()).toContain('Protected')
    expect(helperRow?.text()).not.toContain('Protected')
  })

  it('adds directories and can collapse and expand them', async () => {
    const projectStore = useProjectStore()
    const uiStore = useUiStore()
    const node = projectStore.addNode('blank')
    uiStore.selectNode(node.id)

    const wrapper = mount(CodePanel)
    await flushPromises()

    await wrapper.find('[data-testid="start-create-directory"]').trigger('click')
    await wrapper.find('[data-testid="new-directory-path"]').setValue('assets/audio')
    await wrapper.find('[data-testid="create-directory"]').trigger('submit.prevent')
    await flushPromises()

    expect(projectStore.project.customDirectories).toEqual([
      expect.objectContaining({ relativePath: 'assets/audio' }),
    ])
    expect(wrapper.findAll('.file-tree-directory').map(row => row.find('.file-tab-name').text())).toEqual(expect.arrayContaining(['assets', 'audio']))

    await wrapper.find('[data-testid="directory-assets"]').trigger('click')
    expect(wrapper.find('[data-testid="directory-assets/audio"]').exists()).toBe(false)

    await wrapper.find('[data-testid="directory-assets"]').trigger('click')
    expect(wrapper.find('[data-testid="directory-assets/audio"]').exists()).toBe(true)
  })

  it('deletes unprotected files and unprotected directories recursively', async () => {
    const projectStore = useProjectStore()
    const uiStore = useUiStore()
    const node = projectStore.addNode('blank')
    projectStore.updateProject({
      customDirectories: [
        { id: 'scratch', relativePath: 'scratch' },
      ],
      customFiles: [
        { id: 'a', relativePath: 'scratch/a.txt', content: 'a' },
        { id: 'b', relativePath: 'scratch/nested/b.txt', content: 'b' },
      ],
    })
    uiStore.selectNode(node.id)

    const wrapper = mount(CodePanel)
    await flushPromises()

    const fileRow = wrapper.findAll('.file-row').find(row => row.text().includes('a.txt'))
    await fileRow!.find('.file-delete').trigger('click')
    await flushPromises()

    expect(projectStore.project.customFiles?.map(file => file.relativePath)).toEqual(['scratch/nested/b.txt'])

    await wrapper.find('[data-testid="delete-directory-scratch"]').trigger('click')
    await flushPromises()

    expect(projectStore.project.customFiles).toEqual([])
    expect(projectStore.project.customDirectories).toEqual([])
  })

  it('does not allow deleting directories that contain protected files', async () => {
    const projectStore = useProjectStore()
    const uiStore = useUiStore()
    const node = projectStore.addNode('blank')
    projectStore.updateProject({
      customDirectories: [
        { id: 'web-extra', relativePath: 'web/extra' },
      ],
      customFiles: [
        { id: 'readme', relativePath: 'web/extra/readme.md', content: '# ok\n' },
      ],
    })
    uiStore.selectNode(node.id)

    const wrapper = mount(CodePanel)
    await flushPromises()

    expect(wrapper.find('[data-testid="delete-directory-web"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="delete-directory-web/extra"]').exists()).toBe(true)
  })

  it('clears the file tree when no node pack is selected', async () => {
    const projectStore = useProjectStore()
    projectStore.deleteProject(projectStore.activeProjectId)

    const wrapper = mount(CodePanel)
    await flushPromises()

    expect(projectStore.activeProjectId).toBe('')
    expect(wrapper.text()).toContain('No pack files to preview.')
    expect(wrapper.findAll('.file-row')).toHaveLength(0)
    expect(wrapper.findAll('.file-tree-directory')).toHaveLength(0)
  })
})
