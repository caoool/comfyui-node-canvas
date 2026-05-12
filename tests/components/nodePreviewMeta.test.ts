import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import NodeDefinitionPanel from '../../src/components/NodeDefinitionPanel.vue'
import NodePreview from '../../src/components/NodePreview.vue'
import { useProjectStore } from '../../src/stores/project'
import { useUiStore } from '../../src/stores/ui'

describe('node preview metadata editing', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('removes duplicate node metadata controls from the definition panel', () => {
    const projectStore = useProjectStore()
    const uiStore = useUiStore()
    const node = projectStore.addNode('blank')
    uiStore.selectNode(node.id)

    const wrapper = mount(NodeDefinitionPanel)

    expect(wrapper.find('.preview-header').exists()).toBe(false)
    expect(wrapper.find('.return-editor').exists()).toBe(false)
    expect(wrapper.find('button.btn-danger').exists()).toBe(false)
    expect(wrapper.find('label.return-toggle').exists()).toBe(false)
  })

  it('edits class, display name, category, and output-node mode directly on the node preview', async () => {
    const projectStore = useProjectStore()
    const node = projectStore.addNode('blank')

    const wrapper = mount(NodePreview, {
      props: {
        node,
      },
    })

    await wrapper.find('[data-testid="node-preview-class"]').setValue('PreviewEditedNode')
    await wrapper.find('[data-testid="node-preview-class"]').trigger('change')
    await wrapper.find('[data-testid="node-preview-display"]').setValue('Preview Edited Node')
    await wrapper.find('[data-testid="node-preview-display"]').trigger('change')
    await wrapper.find('[data-testid="node-preview-category"]').setValue('ComfyUINodeBuilder/testing')
    await wrapper.find('[data-testid="node-preview-category"]').trigger('change')
    await wrapper.find('[data-testid="node-preview-output-toggle"]').setValue(true)

    expect(projectStore.project.nodes[0]).toMatchObject({
      name: 'PreviewEditedNode',
      displayName: 'Preview Edited Node',
      category: 'ComfyUINodeBuilder/testing',
      isOutputNode: true,
    })
  })
})
