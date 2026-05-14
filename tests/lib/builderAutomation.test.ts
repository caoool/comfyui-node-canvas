import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { applyBuilderAction } from '../../src/lib/builderAutomation'
import { generatePython } from '../../src/lib/generatePython'
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
    expect(projectStore.project.packFolderName).toBe('ComfyUINodeBuilder/AudioTools')
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

  it('routes AI-created CosyVoice3 voice clone nodes to the maintained template', async () => {
    const projectStore = useProjectStore()
    const uiStore = useUiStore()

    const result = await applyBuilderAction(projectStore, uiStore, {
      type: 'create_node',
      templateId: 'blank',
      node: {
        name: 'CosyVoiceZeroShotClone',
        displayName: 'CosyVoice Zero Shot Clone',
        category: 'ComfyUINodeBuilder/VoiceToolset',
        moduleCode: 'from cosyvoice.cli.cosyvoice import AutoModel',
        code: 'for result in cosyvoice.inference_zero_shot(text.strip(), prompt_text.strip(), prompt_wav, stream=False):\n    audio = result["tts_speech"]',
      },
    })

    expect(result.level).toBe('success')
    expect(projectStore.project.nodes).toHaveLength(1)
    const node = projectStore.project.nodes[0]
    expect(node.name).toBe('CosyVoice3VoiceClone')
    expect(node.inputs.map(input => input.name)).toEqual([
      'reference_audio',
      'text',
      'reference_text',
      'model_dir',
      'fp16',
      'speed',
      'mode',
      'seed',
    ])
    expect(node.code).toContain('short_zero_shot_text')
    expect(node.code).toContain('CosyVoice zero_shot text is too short')
    expect(node.code).toContain('mode = "zero_shot" if reference_text else "cross_lingual"')
    expect(node.code).not.toContain('prompt_text.strip()')
    expect(uiStore.selectedNodeId).toBe(node.id)
  })

  it('routes AI-updated CosyVoice3 nodes back to the maintained template instead of preserving brittle patches', async () => {
    const projectStore = useProjectStore()
    const uiStore = useUiStore()
    const node = projectStore.addNode('blank')
    projectStore.updateNode(node.id, {
      name: 'CosyVoiceZeroShotClone',
      displayName: 'CosyVoice Zero Shot Clone',
      code: 'audio = None',
    })

    const result = await applyBuilderAction(projectStore, uiStore, {
      type: 'update_node',
      nodeId: node.id,
      patch: {
        moduleCode: 'from cosyvoice.cli.cosyvoice import AutoModel',
        code: 'for result in cosyvoice.inference_zero_shot(text.strip(), prompt_text.strip(), prompt_wav, stream=False):\n    audio = result["tts_speech"]',
      },
    })

    expect(result.level).toBe('success')
    expect(result.message).toContain('maintained CosyVoice 3 voice clone template')
    const updated = projectStore.project.nodes[0]
    expect(updated.name).toBe('CosyVoice3VoiceClone')
    expect(updated.pythonSource).toBeUndefined()
    expect(updated.inputs.map(input => input.name)).toContain('reference_audio')
    expect(updated.inputs.map(input => input.name)).not.toContain('prompt_audio')
    expect(updated.code).toContain('short_zero_shot_text')
    expect(updated.code).toContain('CosyVoice zero_shot text is too short')
    expect(updated.code).not.toContain('prompt_text.strip()')
  })

  it('routes AI full-file edits of CosyVoice3 nodes back to the maintained template', async () => {
    const projectStore = useProjectStore()
    const uiStore = useUiStore()
    const node = projectStore.addNode('blank')
    projectStore.updateNode(node.id, {
      name: 'CosyVoiceZeroShotClone',
      displayName: 'CosyVoice Zero Shot Clone',
      inputs: [
        { id: 'prompt-audio', name: 'prompt_audio', type: 'AUDIO', optional: false, isWidget: false },
        { id: 'text-input', name: 'text', type: 'STRING', optional: false, isWidget: true },
      ],
      outputs: [
        { id: 'audio-output', name: 'audio', type: 'AUDIO', optional: false, isWidget: false, expression: 'audio' },
      ],
      moduleCode: 'from cosyvoice.cli.cosyvoice import AutoModel',
      code: 'audio = None',
    })
    const brittleSource = generatePython(projectStore.project.nodes[0])
      .replace('audio = None', 'for result in cosyvoice.inference_zero_shot(text.strip(), prompt_text.strip(), prompt_wav, stream=False):\n            audio = result["tts_speech"]')

    const result = await applyBuilderAction(projectStore, uiStore, {
      type: 'upsert_file',
      relativePath: 'CosyVoiceZeroShotClone.py',
      content: brittleSource,
    })

    expect(result.level).toBe('success')
    expect(result.message).toContain('maintained CosyVoice 3 voice clone template')
    const updated = projectStore.project.nodes[0]
    expect(updated.name).toBe('CosyVoice3VoiceClone')
    expect(updated.pythonSource).toBeUndefined()
    expect(updated.code).toContain('mode = "zero_shot" if reference_text else "cross_lingual"')
    expect(updated.code).not.toContain('text.strip()')
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
      packFolderName: 'ComfyUINodeBuilder/LLM_Prompt_Tools',
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

  it('uses node edits when AI sends update_node with an empty patch wrapper', async () => {
    const projectStore = useProjectStore()
    const uiStore = useUiStore()
    const node = projectStore.addNode('blank')
    uiStore.selectNode(node.id)

    const result = await applyBuilderAction(projectStore, uiStore, {
      type: 'update_node',
      patch: {},
      node: {
        inputs: [
          { name: 'prompt', type: 'STRING', optional: false, isWidget: true },
        ],
        code: 'text = prompt',
      },
    })

    expect(result.level).toBe('success')
    expect(projectStore.project.nodes[0].inputs).toEqual([
      expect.objectContaining({ name: 'prompt', type: 'STRING', optional: false, isWidget: true }),
    ])
    expect(projectStore.project.nodes[0].code).toBe('text = prompt')
  })

  it('routes AI file edits for managed pack files through builder state', async () => {
    const projectStore = useProjectStore()
    const uiStore = useUiStore()
    const node = projectStore.addNode('blank')
    projectStore.updateNode(node.id, {
      name: 'PromptEcho',
      displayName: 'Prompt Echo',
      category: 'ComfyUINodeBuilder/Text',
      inputs: [{ id: 'input-1', name: 'prompt', type: 'STRING', optional: false, isWidget: true }],
      outputs: [{ id: 'output-1', name: 'text', type: 'STRING', optional: false, isWidget: false, expression: 'text' }],
      code: 'text = prompt',
    })
    const source = generatePython(projectStore.project.nodes[0])
      .replace('class PromptEcho:', 'class PromptEchoAdvanced:')
      .replace('NODE_DISPLAY_NAME_MAPPINGS = {"PromptEcho": "Prompt Echo"}', 'NODE_DISPLAY_NAME_MAPPINGS = {"PromptEchoAdvanced": "Prompt Echo Advanced"}')

    const sourceResult = await applyBuilderAction(projectStore, uiStore, {
      type: 'upsert_file',
      relativePath: 'PromptEcho.py',
      content: source,
    })
    const requirementsResult = await applyBuilderAction(projectStore, uiStore, {
      type: 'upsert_file',
      relativePath: 'requirements.txt',
      content: 'regex\nnumpy\n',
    })
    const installResult = await applyBuilderAction(projectStore, uiStore, {
      type: 'upsert_file',
      relativePath: 'install.py',
      content: 'print("setup")\n',
    })

    expect(sourceResult.message).toBe('Updated PromptEcho.py.')
    expect(requirementsResult.message).toBe('Updated requirements.txt.')
    expect(installResult.message).toBe('Updated install.py.')
    expect(projectStore.project.nodes[0]).toMatchObject({
      name: 'PromptEchoAdvanced',
      displayName: 'Prompt Echo Advanced',
      pythonSource: source,
    })
    expect(projectStore.project.pythonRequirements).toEqual(['regex', 'numpy'])
    expect(projectStore.project.pythonInstallScript).toBe('print("setup")')
  })

  it('sanitizes AI install.py edits that try to install upstream CosyVoice requirements', async () => {
    const projectStore = useProjectStore()
    const uiStore = useUiStore()

    const result = await applyBuilderAction(projectStore, uiStore, {
      type: 'set_install_script',
      code: [
        'import os',
        'COSYVOICE_DIR = os.path.join(PACK_DIR, "external", "CosyVoice")',
        'requirements = os.path.join(COSYVOICE_DIR, "requirements.txt")',
        '_install_with_current_python(["-r", requirements])',
      ].join('\n'),
    })

    expect(result.level).toBe('success')
    expect(projectStore.project.pythonInstallScript).toContain('Skipping upstream CosyVoice requirements.txt')
    expect(projectStore.project.pythonInstallScript).not.toContain('_install_with_current_python(["-r", requirements])')
  })

  it('sanitizes AI install.py edits that use blocking ModelScope CosyVoice predownload', async () => {
    const projectStore = useProjectStore()
    const uiStore = useUiStore()

    const result = await applyBuilderAction(projectStore, uiStore, {
      type: 'set_install_script',
      code: [
        'from modelscope import snapshot_download',
        'DEFAULT_MODEL_ID = "iic/CosyVoice3-0.5B"',
        'try:',
        '    model_path = snapshot_download(DEFAULT_MODEL_ID)',
        'except Exception as exc:',
        '    raise RuntimeError("Failed to download iic/CosyVoice3-0.5B from ModelScope.") from exc',
      ].join('\n'),
    })

    expect(result.level).toBe('success')
    expect(projectStore.project.pythonInstallScript).toContain('from huggingface_hub import snapshot_download')
    expect(projectStore.project.pythonInstallScript).toContain('DEFAULT_MODEL_ID = "FunAudioLLM/Fun-CosyVoice3-0.5B-2512"')
    expect(projectStore.project.pythonInstallScript).toContain('Optional CosyVoice model predownload failed')
    expect(projectStore.project.pythonInstallScript).not.toContain('modelscope')
    expect(projectStore.project.pythonInstallScript).not.toContain('raise RuntimeError')
    expect(projectStore.project.pythonInstallScript).not.toContain('iic/CosyVoice3-0.5B')
  })

  it('lets AI create and delete arbitrary builder-owned helper files', async () => {
    const projectStore = useProjectStore()
    const uiStore = useUiStore()

    const createResult = await applyBuilderAction(projectStore, uiStore, {
      type: 'upsert_file',
      relativePath: 'helpers/text_utils.py',
      content: 'def normalize(value):\n    return str(value).strip()\n',
    })
    const deleteResult = await applyBuilderAction(projectStore, uiStore, {
      type: 'delete_file',
      relativePath: 'helpers/text_utils.py',
    })

    expect(createResult.level).toBe('success')
    expect(createResult.message).toBe('Created helpers/text_utils.py.')
    expect(deleteResult.message).toBe('Deleted helpers/text_utils.py.')
    expect(projectStore.project.customFiles).toEqual([])
  })

  it('does not let AI delete builder-generated pack files directly', async () => {
    const projectStore = useProjectStore()
    const uiStore = useUiStore()
    projectStore.addNode('blank')

    const result = await applyBuilderAction(projectStore, uiStore, {
      type: 'delete_file',
      relativePath: '__init__.py',
    })

    expect(result.level).toBe('warning')
    expect(result.message).toContain('__init__.py is generated by the builder')
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
