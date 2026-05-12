import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import ContractSidebar from '../../src/components/ContractSidebar.vue'
import NodeLibrary from '../../src/components/NodeLibrary.vue'
import NodePreview from '../../src/components/NodePreview.vue'
import PortEditForm from '../../src/components/PortEditForm.vue'
import { addCustomPortToNode } from '../../src/lib/nodeContract'
import { NODE_TEMPLATES, createNodeFromTemplate } from '../../src/lib/nodeTemplates'
import { useProjectStore } from '../../src/stores/project'
import { useUiStore } from '../../src/stores/ui'

function ids(...values: string[]) {
  let index = 0
  return () => values[index++] ?? `id-${index}`
}

describe('contract builder defaults', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('uses Blank Node as the default new-node template and ComfyUINodeBuilder as the default category', async () => {
    const wrapper = mount(NodeLibrary)
    const projectStore = useProjectStore()

    expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('blank')

    await wrapper.find('button.btn-template').trigger('click')

    expect(projectStore.project.nodes).toHaveLength(1)
    expect(projectStore.project.nodes[0]).toMatchObject({
      name: 'CustomNode',
      category: 'ComfyUINodeBuilder',
      inputs: [],
      outputs: [],
    })
  })

  it('creates standard starter templates under the builder category by default', () => {
    for (const template of NODE_TEMPLATES) {
      expect(createNodeFromTemplate(template.id).category).toBe('ComfyUINodeBuilder')
    }
  })

  it('adds custom input and output from selectable catalog items', async () => {
    const projectStore = useProjectStore()
    const uiStore = useUiStore()
    const node = projectStore.addNode('blank')
    uiStore.selectNode(node.id)

    const wrapper = mount(ContractSidebar)

    expect(wrapper.text()).toContain('Custom')
    expect(wrapper.find('[data-testid="add-custom-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="add-custom-output"]').exists()).toBe(true)
    expect(wrapper.find('input[placeholder="custom_name"]').exists()).toBe(false)

    await wrapper.find('[data-testid="add-custom-input"]').trigger('click')
    await wrapper.find('[data-testid="add-custom-output"]').trigger('click')

    const updated = projectStore.project.nodes[0]
    expect(updated.inputs[0]).toMatchObject({ name: 'custom_value', type: 'CUSTOM_TYPE', isWidget: false })
    expect(updated.outputs[0]).toMatchObject({ name: 'custom_value', type: 'CUSTOM_TYPE', isWidget: false })
    expect(uiStore.selectedItem).toEqual({ kind: 'port', portId: updated.outputs[0].id, zone: 'outputs' })
  })

  it('lets users click a custom port on the node preview and edit its properties', async () => {
    const projectStore = useProjectStore()
    const uiStore = useUiStore()
    const node = projectStore.addNode('blank')
    const withOutput = addCustomPortToNode(node, 'outputs', 'custom_value', 'CUSTOM_TYPE', ids('port-1')).node
    projectStore.updateNode(node.id, withOutput)
    uiStore.selectNode(node.id)

    const preview = mount(NodePreview, {
      props: {
        node: projectStore.project.nodes[0],
      },
    })

    await preview.find('.socket-row-output').trigger('click')
    expect(uiStore.selectedItem).toEqual({ kind: 'port', portId: 'port-1', zone: 'outputs' })

    const form = mount(PortEditForm)
    const typeInput = form.find('input[list="port-type-options"]')
    await typeInput.setValue('MY_CUSTOM_TYPE')
    await typeInput.trigger('change')

    expect(projectStore.project.nodes[0].outputs[0].type).toBe('MY_CUSTOM_TYPE')
  })
})
