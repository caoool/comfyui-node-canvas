import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { applyBuilderAction } from '../../src/lib/builderAutomation'
import { useProjectStore } from '../../src/stores/project'
import { useUiStore } from '../../src/stores/ui'

describe('builderAutomation', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('creates and switches packs from AI actions', async () => {
    const projectStore = useProjectStore()
    const uiStore = useUiStore()

    const result = await applyBuilderAction(projectStore, uiStore, {
      type: 'create_pack',
      name: 'Audio Tools',
      packFolderName: 'AudioTools',
    })

    expect(result.level).toBe('success')
    expect(projectStore.project.name).toBe('Audio Tools')
    expect(projectStore.project.packFolderName).toBe('AudioTools')
  })

  it('creates a custom node with ports, code, dependencies, and selects it', async () => {
    const projectStore = useProjectStore()
    const uiStore = useUiStore()

    await applyBuilderAction(projectStore, uiStore, {
      type: 'create_node',
      templateId: 'blank',
      node: {
        name: 'ConcatText',
        displayName: 'Concat Text',
        category: 'ComfyUINodeBuilder/Text',
        inputs: [
          { name: 'left', type: 'STRING', optional: false, isWidget: true },
          { name: 'right', type: 'STRING', optional: false, isWidget: true },
        ],
        outputs: [{ name: 'text', type: 'STRING', optional: false, isWidget: false }],
        moduleCode: 'import textwrap',
        code: 'return (left + right,)',
        pythonRequirements: ['regex'],
      },
    })

    expect(projectStore.project.nodes).toHaveLength(1)
    expect(projectStore.project.nodes[0]).toMatchObject({
      name: 'ConcatText',
      displayName: 'Concat Text',
      category: 'ComfyUINodeBuilder/Text',
      moduleCode: 'import textwrap',
      code: 'return (left + right,)',
      pythonRequirements: ['regex'],
    })
    expect(projectStore.project.nodes[0].inputs.map(input => input.name)).toEqual(['left', 'right'])
    expect(projectStore.project.nodes[0].outputs.map(output => output.name)).toEqual(['text'])
    expect(uiStore.selectedNodeId).toBe(projectStore.project.nodes[0].id)
  })

  it('updates a node when AI returns node alias and name/type return UI fields', async () => {
    const projectStore = useProjectStore()
    const uiStore = useUiStore()
    const node = projectStore.addNode('blank')

    const result = await applyBuilderAction(projectStore, uiStore, {
      type: 'update_node',
      nodeId: node.id,
      node: {
        name: 'StringConcatDisplay',
        displayName: 'String Concat Display',
        category: 'ComfyUINodeBuilder/String',
        inputs: [
          { name: 'string_a', type: 'STRING' },
          { name: 'string_b', type: 'STRING' },
        ],
        outputs: [
          { name: 'combined', type: 'STRING' },
        ],
        uiOutputs: [
          { name: 'display_text', type: 'STRING' },
        ],
        code: 'combined = str(string_a) + str(string_b)',
      },
    })

    const updated = projectStore.project.nodes[0]
    expect(result.level).toBe('success')
    expect(updated).toMatchObject({
      name: 'StringConcatDisplay',
      displayName: 'String Concat Display',
      category: 'ComfyUINodeBuilder/String',
      code: 'combined = str(string_a) + str(string_b)',
    })
    expect(updated.inputs.map(input => [input.name, input.type, input.optional, input.isWidget])).toEqual([
      ['string_a', 'STRING', false, false],
      ['string_b', 'STRING', false, false],
    ])
    expect(updated.outputs.map(output => [output.name, output.type])).toEqual([
      ['combined', 'STRING'],
    ])
    expect(updated.uiOutputs?.[0]).toEqual(expect.objectContaining({
      key: 'display_text',
      kind: 'text',
      label: 'display_text',
      expression: 'display_text',
    }))
    expect(uiStore.selectedNodeId).toBe(node.id)
  })

  it('creates and selects a node when AI sends targetless update_node into an empty pack', async () => {
    const projectStore = useProjectStore()
    const uiStore = useUiStore()

    await applyBuilderAction(projectStore, uiStore, {
      type: 'rename_pack',
      name: 'LLM Prompt Tools',
      packFolderName: 'LLM_Prompt_Tools',
    })
    await applyBuilderAction(projectStore, uiStore, {
      type: 'set_requirements',
      requirements: ['transformers', 'torch', 'accelerate'],
    })
    const updateResult = await applyBuilderAction(projectStore, uiStore, {
      type: 'update_node',
      node: {
        name: 'SmallLLMPromptEnhancer',
        displayName: 'Small LLM Prompt Enhancer',
        category: 'ComfyUINodeBuilder/AI',
        inputs: [
          { name: 'prompt', type: 'STRING', optional: false, isWidget: true },
        ],
        outputs: [
          { name: 'enhanced_prompt', type: 'STRING', optional: false, isWidget: false },
        ],
        moduleCode: 'from transformers import pipeline',
        code: 'enhanced_prompt = prompt',
      },
    })
    const selectResult = await applyBuilderAction(projectStore, uiStore, {
      type: 'select_node',
    })

    expect(updateResult.level).toBe('success')
    expect(updateResult.message).toBe('Created node SmallLLMPromptEnhancer.')
    expect(selectResult.level).toBe('success')
    expect(projectStore.project).toMatchObject({
      name: 'LLM Prompt Tools',
      packFolderName: 'LLM_Prompt_Tools',
      pythonRequirements: ['transformers', 'torch', 'accelerate'],
    })
    expect(projectStore.project.nodes).toHaveLength(1)
    expect(projectStore.project.nodes[0]).toMatchObject({
      name: 'SmallLLMPromptEnhancer',
      displayName: 'Small LLM Prompt Enhancer',
      category: 'ComfyUINodeBuilder/AI',
      moduleCode: 'from transformers import pipeline',
      code: 'enhanced_prompt = prompt',
    })
    expect(uiStore.selectedNodeId).toBe(projectStore.project.nodes[0].id)
  })

  it('updates the only node when AI sends targetless update_node without a selection', async () => {
    const projectStore = useProjectStore()
    const uiStore = useUiStore()
    projectStore.addNode('blank')

    const result = await applyBuilderAction(projectStore, uiStore, {
      type: 'update_node',
      patch: {
        name: 'TinyLLMImagePrompt',
        displayName: 'Tiny LLM Image Prompt',
        category: 'ComfyUINodeBuilder/AI',
      },
    })

    expect(result.level).toBe('success')
    expect(projectStore.project.nodes).toHaveLength(1)
    expect(projectStore.project.nodes[0]).toMatchObject({
      name: 'TinyLLMImagePrompt',
      displayName: 'Tiny LLM Image Prompt',
      category: 'ComfyUINodeBuilder/AI',
    })
    expect(uiStore.selectedNodeId).toBe(projectStore.project.nodes[0].id)
  })

  it('validates the active project and reports validation errors', async () => {
    const projectStore = useProjectStore()
    const uiStore = useUiStore()
    const node = projectStore.addNode('blank')
    projectStore.updateNode(node.id, { category: '' })

    const result = await applyBuilderAction(projectStore, uiStore, { type: 'validate_project' })

    expect(result.level).toBe('error')
    expect(result.message).toContain('Category is required')
  })
})
