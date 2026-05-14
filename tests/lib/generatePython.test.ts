import { generatePython } from '../../src/lib/generatePython'
import { createCosyVoice3VoiceCloneNode } from '../../src/lib/nodeTemplates'
import type { NodeSpec, PortSpec, WidgetSpec } from '../../src/types/index'

function makeNode(overrides: Partial<NodeSpec> = {}): NodeSpec {
  return {
    id: 'n1',
    name: 'MyNode',
    displayName: 'My Node',
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

describe('generatePython', () => {
  it('generates class name from node.name', () => {
    const node = makeNode({ name: 'MyNode' })
    const output = generatePython(node)
    expect(output).toContain('class MyNode:')
  })

  it('generates INPUT_TYPES with empty required when no inputs', () => {
    const node = makeNode()
    const output = generatePython(node)
    expect(output).toContain('"required": {}')
  })

  it('generates non-widget port in required', () => {
    const inputs: PortSpec[] = [
      { id: 'p1', name: 'image', type: 'IMAGE', optional: false, isWidget: false },
    ]
    const node = makeNode({ inputs })
    const output = generatePython(node)
    expect(output).toContain('"image": ("IMAGE",)')
  })

  it('generates optional port in optional section', () => {
    const inputs: PortSpec[] = [
      { id: 'p1', name: 'mask', type: 'MASK', optional: true, isWidget: false },
    ]
    const node = makeNode({ inputs })
    const output = generatePython(node)
    expect(output).toContain('"optional"')
    expect(output).toContain('"mask": ("MASK",)')
  })

  it('omits optional section when no optional ports', () => {
    const inputs: PortSpec[] = [
      { id: 'p1', name: 'image', type: 'IMAGE', optional: false, isWidget: false },
    ]
    const node = makeNode({ inputs })
    const output = generatePython(node)
    expect(output).not.toContain('"optional"')
  })

  it('generates slider widget with FLOAT type', () => {
    const inputs: PortSpec[] = [
      { id: 'p1', name: 'strength', type: 'FLOAT', optional: false, isWidget: true },
    ]
    const widgets: WidgetSpec[] = [
      {
        id: 'w1',
        portId: 'p1',
        widgetType: 'slider',
        default: 0.5,
        config: { min: 0, max: 1, step: 0.01, default: 0.5 },
      },
    ]
    const node = makeNode({ inputs, widgets })
    const output = generatePython(node)
    expect(output).toContain('"strength": ("FLOAT", {"default": 0.5, "min": 0, "max": 1, "step": 0.01})')
  })

  it('generates dropdown widget', () => {
    const inputs: PortSpec[] = [
      { id: 'p1', name: 'mode', type: 'STRING', optional: false, isWidget: true },
    ]
    const widgets: WidgetSpec[] = [
      {
        id: 'w1',
        portId: 'p1',
        widgetType: 'dropdown',
        default: 'a',
        config: { options: ['a', 'b'] },
      },
    ]
    const node = makeNode({ inputs, widgets })
    const output = generatePython(node)
    expect(output).toContain('(["a", "b"], {"default": "a"})')
  })

  it('generates text widget using port.type', () => {
    const inputs: PortSpec[] = [
      { id: 'p1', name: 'prompt', type: 'STRING', optional: false, isWidget: true },
    ]
    const widgets: WidgetSpec[] = [
      {
        id: 'w1',
        portId: 'p1',
        widgetType: 'text',
        default: '',
        config: {},
      },
    ]
    const node = makeNode({ inputs, widgets })
    const output = generatePython(node)
    expect(output).toContain('"prompt": ("STRING", {"multiline": False, "default": ""})')
  })

  it('generates bool widget', () => {
    const inputs: PortSpec[] = [
      { id: 'p1', name: 'enable', type: 'BOOLEAN', optional: false, isWidget: true },
    ]
    const widgets: WidgetSpec[] = [
      {
        id: 'w1',
        portId: 'p1',
        widgetType: 'bool',
        default: false,
        config: {},
      },
    ]
    const node = makeNode({ inputs, widgets })
    const output = generatePython(node)
    expect(output).toContain('("BOOLEAN", {"default": False})')
  })

  it('generates multiline text widget with Python booleans', () => {
    const inputs: PortSpec[] = [
      { id: 'p1', name: 'prompt', type: 'STRING', optional: false, isWidget: true },
    ]
    const widgets: WidgetSpec[] = [
      {
        id: 'w1',
        portId: 'p1',
        widgetType: 'multiline',
        default: '',
        config: { multiline: true, dynamicPrompts: true },
      },
    ]
    const output = generatePython(makeNode({ inputs, widgets }))
    expect(output).toContain('"prompt": ("STRING", {"multiline": True, "dynamicPrompts": True, "default": ""})')
  })

  it('generates seed widget config', () => {
    const inputs: PortSpec[] = [
      { id: 'p1', name: 'seed', type: 'INT', optional: false, isWidget: true },
    ]
    const widgets: WidgetSpec[] = [
      {
        id: 'w1',
        portId: 'p1',
        widgetType: 'seed',
        default: 0,
        config: { min: 0, max: 100, control_after_generate: true },
      },
    ]
    const output = generatePython(makeNode({ inputs, widgets }))
    expect(output).toContain('"seed": ("INT", {"default": 0, "min": 0, "max": 100, "control_after_generate": True})')
  })

  it('generates RETURN_TYPES tuple', () => {
    const node = makeNode({ useReturnOverrides: true, returnTypes: ['IMAGE', 'LATENT'] })
    const output = generatePython(node)
    expect(output).toContain('RETURN_TYPES = ("IMAGE", "LATENT")')
  })

  it('generates single RETURN_TYPE with trailing comma', () => {
    const node = makeNode({ useReturnOverrides: true, returnTypes: ['IMAGE'] })
    const output = generatePython(node)
    expect(output).toContain('RETURN_TYPES = ("IMAGE",)')
  })

  it('omits RETURN_NAMES when empty', () => {
    const node = makeNode({ returnNames: [] })
    const output = generatePython(node)
    expect(output).not.toContain('RETURN_NAMES')
  })

  it('inserts user code in execute body', () => {
    const node = makeNode({ code: 'return image' })
    const output = generatePython(node)
    expect(output).toContain('        return image')
  })

  it('appends a generated return block from output and return UI bindings', () => {
    const node = makeNode({
      inputs: [
        { id: 'i1', name: 'string1', type: 'STRING', optional: false, isWidget: false },
        { id: 'i2', name: 'string2', type: 'STRING', optional: false, isWidget: false },
      ],
      outputs: [
        { id: 'o1', name: 'concat', type: 'STRING', optional: false, isWidget: false, expression: 'combined' },
      ],
      uiOutputs: [
        { id: 'u1', key: 'text', kind: 'text', label: 'Combined text', expression: 'combined' },
      ],
      code: 'combined = string1 + string2',
    })
    const output = generatePython(node)
    expect(output).toContain('        combined = string1 + string2')
    expect(output).toContain('        # Generated return. Edit Outputs / Return UI in the contract panel.')
    expect(output).toContain('        return {"ui": {"text": (combined,)}, "result": (combined,)}')
  })

  it('generates int widget with INT type', () => {
    const inputs: PortSpec[] = [
      { id: 'p1', name: 'steps', type: 'INT', optional: false, isWidget: true },
    ]
    const widgets: WidgetSpec[] = [
      {
        id: 'w1',
        portId: 'p1',
        widgetType: 'int',
        default: 20,
        config: { min: 1, max: 100, step: 1, default: 20 },
      },
    ]
    const node = makeNode({ inputs, widgets })
    const output = generatePython(node)
    expect(output).toContain('"steps": ("INT", {"default": 20, "min": 1, "max": 100, "step": 1})')
  })

  it('generates RETURN_NAMES when non-empty', () => {
    const node = makeNode({ useReturnOverrides: true, returnTypes: ['IMAGE'], returnNames: ['result'] })
    const output = generatePython(node)
    expect(output).toContain('RETURN_NAMES = ("result",)')
  })

  it('derives RETURN_TYPES and RETURN_NAMES from outputs by default', () => {
    const outputs: PortSpec[] = [
      { id: 'o1', name: 'image', type: 'IMAGE', optional: false, isWidget: false },
      { id: 'o2', name: 'mask', type: 'MASK', optional: false, isWidget: false },
    ]
    const node = makeNode({ outputs, returnTypes: [], returnNames: [] })
    const output = generatePython(node)
    expect(output).toContain('RETURN_TYPES = ("IMAGE", "MASK")')
    expect(output).toContain('RETURN_NAMES = ("image", "mask")')
  })

  it('uses advanced return overrides when enabled', () => {
    const outputs: PortSpec[] = [
      { id: 'o1', name: 'image', type: 'IMAGE', optional: false, isWidget: false },
    ]
    const node = makeNode({
      outputs,
      useReturnOverrides: true,
      returnTypes: ['LATENT'],
      returnNames: ['latent'],
    })
    const output = generatePython(node)
    expect(output).toContain('RETURN_TYPES = ("LATENT",)')
    expect(output).toContain('RETURN_NAMES = ("latent",)')
  })

  it('marks ComfyUI terminal nodes as output nodes', () => {
    const node = makeNode({ isOutputNode: true })
    const output = generatePython(node)
    expect(output).toContain('OUTPUT_NODE = True')
  })

  it('does not mark regular transform nodes as output nodes', () => {
    const output = generatePython(makeNode())
    expect(output).not.toContain('OUTPUT_NODE')
  })

  it('emits module code before the generated class', () => {
    const node = makeNode({ moduleCode: 'import torch\n\nDEFAULT = 1' })
    const output = generatePython(node)
    expect(output.startsWith('import torch\n\nDEFAULT = 1\n\nclass MyNode:')).toBe(true)
  })

  it('generates deployable Python for the CosyVoice 3 voice clone template', () => {
    const output = generatePython(createCosyVoice3VoiceCloneNode())
    expect(output).toContain('from cosyvoice.cli.cosyvoice import AutoModel')
    expect(output).toContain('def _require_torchaudio():')
    expect(output).toContain('def _cosyvoice3_load_wav_without_torchcodec')
    expect(output).toContain('def _patch_cosyvoice3_audio_loader')
    expect(output).toContain('cosyvoice_file_utils.load_wav = _cosyvoice3_load_wav_without_torchcodec')
    expect(output).toContain('cosyvoice_frontend.load_wav = _cosyvoice3_load_wav_without_torchcodec')
    expect(output).toContain('sf.read(wav, dtype="float32", always_2d=True)')
    expect(output).not.toContain('import torchcodec')
    expect(output).toContain('_COSYVOICE3_END_OF_PROMPT = "<|endofprompt|>"')
    expect(output).toContain('def _cosyvoice3_with_endofprompt')
    expect(output).toContain('def _require_cosyvoice3_runtime_dependencies():')
    expect(output).toContain('("x-transformers", "x_transformers")')
    expect(output).toContain('("pyarrow", "pyarrow")')
    expect(output).toContain('("pyworld", "pyworld")')
    expect(output).toContain('("scipy", "scipy")')
    expect(output).toContain('Click Deploy & Restart; the builder runs install.py')
    expect(output).toContain('def _write_pcm16_wav(path, waveform, sample_rate):')
    expect(output).toContain('def _cosyvoice3_log(stage, detail=""):')
    expect(output).toContain('class _CosyVoice3Progress:')
    expect(output).toContain('comfy_utils.ProgressBar(total)')
    expect(output).toContain('_write_pcm16_wav(handle.name, waveform, target_sample_rate)')
    expect(output).toContain('_write_pcm16_wav(path, waveform, sample_rate)')
    expect(output).not.toContain('.save(')
    expect(output).toContain('_VENDOR_COSYVOICE_DIR')
    expect(output.indexOf('sys.path.insert(0, _VENDOR_COSYVOICE_DIR)')).toBeLessThan(
      output.indexOf('from cosyvoice.cli.cosyvoice import AutoModel'),
    )
    expect(output).toContain('from huggingface_hub import snapshot_download as _hf_snapshot_download')
    expect(output).toContain('def _resolve_cosyvoice3_model_dir(model_dir):')
    expect(output).toContain('resolved = _hf_snapshot_download(repo_id=model_dir)')
    expect(output).toContain('return resolved')
    expect(output).toContain('AutoModel(model_dir=resolved_model_dir, fp16=use_fp16)')
    expect(output).toContain('def _comfy_audio_to_prompt_wav(audio, target_sample_rate=16000):')
    expect(output).toContain('class CosyVoice3VoiceClone:')
    expect(output).toContain('"reference_audio": ("AUDIO",)')
    expect(output).toContain('"fp16": ("BOOLEAN", {"default": True})')
    expect(output).toContain('RETURN_TYPES = ("AUDIO",)')
    expect(output).toContain('RETURN_NAMES = ("audio",)')
    expect(output).toContain('"mode": (["auto", "zero_shot", "cross_lingual"], {"default": "auto"})')
    expect(output).toContain('"seed": ("INT", {"default": 0, "min": 0, "max": 2147483647, "control_after_generate": True})')
    expect(output).toContain('    def execute(self, reference_audio, text, reference_text, model_dir, fp16, speed, mode, seed):')
    expect(output).toContain('        progress = _CosyVoice3Progress(7)')
    expect(output).toContain('        _require_cosyvoice3_runtime_dependencies()')
    expect(output).toContain('        mode = str(mode or "zero_shot").strip()')
    expect(output).toContain('        if mode == "auto":')
    expect(output).toContain('short_zero_shot_text')
    expect(output).toContain('mode = "zero_shot" if reference_text else "cross_lingual"')
    expect(output).toContain('CosyVoice zero_shot text is too short')
    expect(output).toContain('        if mode == "zero_shot" and not reference_text:')
    expect(output).toContain('reference_text is required for zero_shot voice cloning')
    expect(output).toContain('        _set_cosyvoice3_seed(seed)')
    expect(output).toContain('        reference_prompt_text = _cosyvoice3_with_endofprompt(reference_text)')
    expect(output).toContain('        synthesis_text = _cosyvoice3_with_endofprompt(text)')
    expect(output).toContain('            reference_prompt_text,')
    expect(output).toContain('            synthesis_text,')
    expect(output).toContain('        progress.step(3, "model loading")')
    expect(output).toContain('        _cosyvoice3_log("start"')
    expect(output).toContain('        _cosyvoice3_log("error"')
    expect(output).toContain('cosyvoice.inference_zero_shot')
    expect(output).toContain('cosyvoice.inference_cross_lingual')
    expect(output).toContain('        audio = _cosyvoice_chunks_to_comfy_audio(chunks, cosyvoice.sample_rate)')
    expect(output).toContain('        return {"ui": {"audio": (audio_preview,), "text": (text,)}, "result": (audio,)}')
  })

  it('preserves blank lines in user code without adding spaces', () => {
    const node = makeNode({ code: 'line1\n\nline3' })
    const output = generatePython(node)
    expect(output).toContain('        line1')
    expect(output).toContain('        line3')
    // blank line between them must not have trailing spaces
    const lines = output.split('\n')
    const blankIdx = lines.findIndex(l => l === '')
    expect(blankIdx).toBeGreaterThan(-1)
  })
})
