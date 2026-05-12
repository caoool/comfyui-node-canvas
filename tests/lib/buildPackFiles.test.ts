import { describe, it, expect } from 'vitest'
import { buildPackFiles } from '../../src/lib/buildPackFiles'
import { createCosyVoice3VoiceCloneNode } from '../../src/lib/nodeTemplates'
import type { Project, NodeSpec } from '../../src/types/index'

function makeNode(overrides: Partial<NodeSpec> = {}): NodeSpec {
  return {
    id: 'n1',
    name: 'NodeA',
    displayName: 'Node A',
    category: 'custom',
    inputs: [],
    outputs: [],
    widgets: [],
    moduleCode: '',
    code: '',
    useReturnOverrides: false,
    returnTypes: [],
    returnNames: [],
    ...overrides,
  }
}

function makeProject(nodes: NodeSpec[]): Project {
  return { name: 'Pack', nodes, comfyuiUrl: '', comfyuiInstallPath: '' }
}

describe('buildPackFiles', () => {
  it('produces one .py per node plus __init__.py', () => {
    const files = buildPackFiles(makeProject([makeNode({ name: 'A' }), makeNode({ id: 'n2', name: 'B' })]))
    expect(Object.keys(files).sort()).toEqual(['A.py', 'B.py', '__init__.py', 'web/runtimeUiDisplays.js'])
  })

  it('writes a deduplicated requirements.txt when nodes declare python requirements', () => {
    const files = buildPackFiles(makeProject([
      makeNode({ name: 'A', pythonRequirements: ['huggingface_hub', ' torchaudio ', ''] }),
      makeNode({ id: 'n2', name: 'B', pythonRequirements: ['huggingface_hub', 'git+https://github.com/FunAudioLLM/CosyVoice.git'] }),
    ]))
    expect(files['requirements.txt']).toBe([
      'huggingface_hub',
      'torchaudio',
      'git+https://github.com/FunAudioLLM/CosyVoice.git',
      '',
    ].join('\n'))
  })

  it('writes ComfyUI-safe CosyVoice runtime requirements without replacing torch', () => {
    const files = buildPackFiles(makeProject([createCosyVoice3VoiceCloneNode()]))
    expect(files['requirements.txt']).toContain('x-transformers==2.11.24\n')
    expect(files['requirements.txt']).toContain('pyarrow\n')
    expect(files['requirements.txt']).toContain('pyworld\n')
    expect(files['requirements.txt']).toContain('scipy\n')
    expect(files['requirements.txt']).toContain('Cython\n')
    expect(files['requirements.txt']).toContain('onnxruntime-gpu; sys_platform == "linux"\n')
    expect(files['requirements.txt']).toContain('onnxruntime; sys_platform != "linux"\n')
    expect(files['requirements.txt']).not.toContain('torch==2.3.1')
    expect(files['requirements.txt']).not.toContain('torchaudio==2.3.1')
    expect(files['requirements.txt']).not.toContain('deepspeed')
    expect(files['requirements.txt']).not.toContain('tensorrt-cu12')
  })

  it('upgrades stale CosyVoice nodes when building an existing managed pack', () => {
    const files = buildPackFiles(makeProject([
      makeNode({
        name: 'CosyVoice3VoiceClone',
        moduleCode: 'from cosyvoice.cli.cosyvoice import AutoModel\n_COSYVOICE3_MODEL_CACHE = {}',
        code: 'try:\n    if not str(text or "").strip():\n        raise ValueError("text is required.")\n    cosyvoice = _get_cosyvoice3_model(model_dir, fp16)',
        pythonRequirements: ['huggingface_hub', 'torch==2.3.1', 'custom-extra-package'],
        pythonInstallScript: '',
      }),
    ]))
    expect(files['requirements.txt']).toContain('x-transformers==2.11.24\n')
    expect(files['requirements.txt']).toContain('custom-extra-package\n')
    expect(files['requirements.txt']).not.toContain('torch==2.3.1')
    expect(files['install.py']).toContain('https://github.com/FunAudioLLM/CosyVoice.git')
    expect(files['CosyVoice3VoiceClone.py']).toContain('def _require_cosyvoice3_runtime_dependencies():')
    expect(files['CosyVoice3VoiceClone.py']).toContain('_require_cosyvoice3_runtime_dependencies()')
  })

  it('upgrades CosyVoice nodes that have dependency preflight but no TorchCodec-safe loader patch', () => {
    const files = buildPackFiles(makeProject([
      makeNode({
        name: 'CosyVoice3VoiceClone',
        moduleCode: [
          'from cosyvoice.cli.cosyvoice import AutoModel',
          'def _require_cosyvoice3_runtime_dependencies():',
          '    pass',
          '_COSYVOICE3_MODEL_CACHE = {}',
        ].join('\n'),
        code: 'try:\n    if not str(text or "").strip():\n        raise ValueError("text is required.")\n    _require_cosyvoice3_runtime_dependencies()\n    cosyvoice = _get_cosyvoice3_model(model_dir, fp16)',
        pythonRequirements: ['huggingface_hub'],
        pythonInstallScript: '',
      }),
    ]))
    expect(files['CosyVoice3VoiceClone.py']).toContain('def _cosyvoice3_load_wav_without_torchcodec')
    expect(files['CosyVoice3VoiceClone.py']).toContain('cosyvoice_file_utils.load_wav = _cosyvoice3_load_wav_without_torchcodec')
    expect(files['CosyVoice3VoiceClone.py']).toContain('cosyvoice_frontend.load_wav = _cosyvoice3_load_wav_without_torchcodec')
    expect(files['CosyVoice3VoiceClone.py']).not.toContain('import torchcodec')
  })

  it('upgrades CosyVoice nodes that have TorchCodec patch but no CosyVoice3 endofprompt handling', () => {
    const files = buildPackFiles(makeProject([
      makeNode({
        name: 'CosyVoice3VoiceClone',
        moduleCode: [
          'from cosyvoice.cli.cosyvoice import AutoModel',
          'def _require_cosyvoice3_runtime_dependencies():',
          '    pass',
          'def _patch_cosyvoice3_audio_loader():',
          '    pass',
          '_COSYVOICE3_MODEL_CACHE = {}',
        ].join('\n'),
        code: 'progress = _CosyVoice3Progress(7)\nreference_text = str(reference_text or "").strip()\nchunks = list(cosyvoice.inference_cross_lingual(str(text), prompt_wav, stream=False, speed=float(speed)))',
        pythonRequirements: ['huggingface_hub'],
        pythonInstallScript: '',
      }),
    ]))
    expect(files['CosyVoice3VoiceClone.py']).toContain('def _cosyvoice3_with_endofprompt')
    expect(files['CosyVoice3VoiceClone.py']).toContain('reference_prompt_text = _cosyvoice3_with_endofprompt(reference_text)')
    expect(files['CosyVoice3VoiceClone.py']).toContain('synthesis_text = _cosyvoice3_with_endofprompt(text)')
  })

  it('upgrades CosyVoice nodes that have marker handling but no clone mode or seed controls', () => {
    const files = buildPackFiles(makeProject([
      makeNode({
        name: 'CosyVoice3VoiceClone',
        inputs: [
          { id: 'audio', name: 'reference_audio', type: 'AUDIO', optional: false, isWidget: false },
          { id: 'text', name: 'text', type: 'STRING', optional: false, isWidget: true },
          { id: 'reference_text', name: 'reference_text', type: 'STRING', optional: false, isWidget: true },
          { id: 'model_dir', name: 'model_dir', type: 'STRING', optional: false, isWidget: true },
          { id: 'fp16', name: 'fp16', type: 'BOOLEAN', optional: false, isWidget: true },
          { id: 'speed', name: 'speed', type: 'FLOAT', optional: false, isWidget: true },
        ],
        widgets: [
          { id: 'w_text', portId: 'text', widgetType: 'multiline', default: 'Hello from a cloned voice.', config: { multiline: true, dynamicPrompts: false } },
          { id: 'w_reference_text', portId: 'reference_text', widgetType: 'multiline', default: '', config: { multiline: true, dynamicPrompts: false } },
          { id: 'w_model_dir', portId: 'model_dir', widgetType: 'text', default: 'FunAudioLLM/Fun-CosyVoice3-0.5B-2512', config: {} },
          { id: 'w_fp16', portId: 'fp16', widgetType: 'bool', default: true, config: {} },
          { id: 'w_speed', portId: 'speed', widgetType: 'slider', default: 1, config: { min: 0.5, max: 2, step: 0.05 } },
        ],
        moduleCode: [
          '_COSYVOICE3_END_OF_PROMPT = "<|endofprompt|>"',
          'def _cosyvoice3_with_endofprompt(value):',
          '    return value',
        ].join('\n'),
        code: 'reference_prompt_text = _cosyvoice3_with_endofprompt(reference_text)\nsynthesis_text = _cosyvoice3_with_endofprompt(text)\nchunks = list(cosyvoice.inference_cross_lingual(synthesis_text, prompt_wav, stream=False, speed=float(speed)))',
        pythonRequirements: ['huggingface_hub'],
        pythonInstallScript: '',
      }),
    ]))
    expect(files['CosyVoice3VoiceClone.py']).toContain('"mode": (["auto", "zero_shot", "cross_lingual"], {"default": "auto"})')
    expect(files['CosyVoice3VoiceClone.py']).toContain('"seed": ("INT", {"default": 0, "min": 0, "max": 2147483647, "control_after_generate": True})')
    expect(files['CosyVoice3VoiceClone.py']).toContain('def _set_cosyvoice3_seed(seed):')
    expect(files['CosyVoice3VoiceClone.py']).toContain('mode = str(mode or "zero_shot").strip()')
    expect(files['CosyVoice3VoiceClone.py']).toContain('short zero_shot text')
    expect(files['CosyVoice3VoiceClone.py']).toContain('reference_text is required for zero_shot voice cloning')
  })

  it('upgrades CosyVoice nodes that have mode and seed but no short-text fallback', () => {
    const files = buildPackFiles(makeProject([
      makeNode({
        name: 'CosyVoice3VoiceClone',
        inputs: [
          { id: 'audio', name: 'reference_audio', type: 'AUDIO', optional: false, isWidget: false },
          { id: 'text', name: 'text', type: 'STRING', optional: false, isWidget: true },
          { id: 'reference_text', name: 'reference_text', type: 'STRING', optional: false, isWidget: true },
          { id: 'model_dir', name: 'model_dir', type: 'STRING', optional: false, isWidget: true },
          { id: 'fp16', name: 'fp16', type: 'BOOLEAN', optional: false, isWidget: true },
          { id: 'speed', name: 'speed', type: 'FLOAT', optional: false, isWidget: true },
          { id: 'mode', name: 'mode', type: 'COMBO', optional: false, isWidget: true },
          { id: 'seed', name: 'seed', type: 'INT', optional: false, isWidget: true },
        ],
        widgets: [
          { id: 'w_mode', portId: 'mode', widgetType: 'dropdown', default: 'zero_shot', config: { options: ['zero_shot', 'cross_lingual'] } },
          { id: 'w_seed', portId: 'seed', widgetType: 'seed', default: 0, config: { min: 0, max: 2147483647, control_after_generate: true } },
        ],
        moduleCode: 'def _set_cosyvoice3_seed(seed):\n    pass',
        code: 'mode = str(mode or "zero_shot").strip()\n_set_cosyvoice3_seed(seed)\nchunks = list(cosyvoice.inference_zero_shot(str(text), reference_prompt_text, prompt_wav, stream=False, speed=float(speed)))',
      }),
    ]))
    expect(files['CosyVoice3VoiceClone.py']).toContain('"mode": (["auto", "zero_shot", "cross_lingual"], {"default": "auto"})')
    expect(files['CosyVoice3VoiceClone.py']).toContain('if mode == "auto":')
    expect(files['CosyVoice3VoiceClone.py']).toContain('short zero_shot text')
    expect(files['CosyVoice3VoiceClone.py']).toContain('mode = "cross_lingual"')
  })

  it('writes install.py when nodes declare dependency install scripts', () => {
    const files = buildPackFiles(makeProject([
      makeNode({ name: 'A', pythonInstallScript: 'print("install A")' }),
    ]))
    expect(files['install.py']).toBe('print("install A")\n')
  })

  it('init.py imports only the mapping dicts (not the class itself)', () => {
    const files = buildPackFiles(makeProject([makeNode({ name: 'A' })]))
    expect(files['__init__.py']).toContain(
      'from .A import NODE_CLASS_MAPPINGS as A_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS as A_DISPLAY_MAPPINGS',
    )
    expect(files['__init__.py']).not.toContain('from .A import A,')
  })

  it('init.py merges all node mappings', () => {
    const init = buildPackFiles(makeProject([makeNode({ name: 'A' }), makeNode({ id: 'n2', name: 'B' })]))['__init__.py']
    expect(init).toContain('NODE_CLASS_MAPPINGS.update(A_MAPPINGS)')
    expect(init).toContain('NODE_CLASS_MAPPINGS.update(B_MAPPINGS)')
    expect(init).toContain('NODE_DISPLAY_NAME_MAPPINGS.update(A_DISPLAY_MAPPINGS)')
    expect(init).toContain('NODE_DISPLAY_NAME_MAPPINGS.update(B_DISPLAY_MAPPINGS)')
  })

  it('exports the mapping symbols via __all__', () => {
    const init = buildPackFiles(makeProject([makeNode({ name: 'A' })]))['__init__.py']
    expect(init).toContain('WEB_DIRECTORY = "./web"')
    expect(init).toContain('__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]')
  })

  it('ships a ComfyUI frontend extension for runtime UI displays', () => {
    const extension = buildPackFiles(makeProject([
      makeNode({
        name: 'A',
        uiOutputs: [
          { id: 'u1', key: 'text', kind: 'text', label: 'Combined Text' },
          { id: 'u2', key: 'images', kind: 'image', label: 'Images' },
        ],
      }),
    ]))['web/runtimeUiDisplays.js']
    expect(extension).toContain('ComfyUINodeBuilder.RuntimeUiDisplays')
    expect(extension).toContain('"A"')
    expect(extension).toContain('"Combined Text"')
    expect(extension).toContain('"images"')
    expect(extension).toContain('renderValue')
    expect(extension).toContain('message?.[spec.key]')
  })

  it('writes editable per-node custom UI renderer files and keeps them out of the shared runtime renderer', () => {
    const files = buildPackFiles(makeProject([
      makeNode({
        name: 'A',
        uiOutputs: [
          { id: 'u1', key: 'preview', kind: 'custom', label: 'Preview' },
        ],
      }),
    ]))

    expect(files['web/A.customRenderer.js']).toContain('Edit renderCustomUi')
    expect(files['web/A.customRenderer.js']).toContain('const NODE_TYPE = "A";')
    expect(files['web/A.customRenderer.js']).toContain('"preview"')
    expect(files['web/runtimeUiDisplays.js']).toContain('"A": []')
    expect(files['web/runtimeUiDisplays.js']).not.toContain('"preview"')
  })

  it('uses a node custom UI renderer manual override when provided', () => {
    const files = buildPackFiles(makeProject([
      makeNode({
        name: 'A',
        uiOutputs: [
          { id: 'u1', key: 'preview', kind: 'custom', label: 'Preview' },
        ],
        customUiRendererCode: 'console.log("custom renderer")',
      }),
    ]))

    expect(files['web/A.customRenderer.js']).toBe('console.log("custom renderer")\n')
  })

  it('deploys persistent full node Python source and node custom files', () => {
    const files = buildPackFiles(makeProject([
      makeNode({
        name: 'A',
        pythonSource: 'class A:\n    pass\n',
        customFiles: [
          { id: 'f1', relativePath: 'helpers/audio_tools.py', content: '# audio helpers\n' },
        ],
      }),
    ]))

    expect(files['A.py']).toBe('class A:\n    pass\n')
    expect(files['helpers/audio_tools.py']).toBe('# audio helpers\n')
  })

  it('handles empty project (no nodes)', () => {
    const files = buildPackFiles(makeProject([]))
    expect(Object.keys(files).sort()).toEqual(['__init__.py', 'web/runtimeUiDisplays.js'])
    expect(files['__init__.py']).toContain('NODE_CLASS_MAPPINGS = {}')
  })
})
