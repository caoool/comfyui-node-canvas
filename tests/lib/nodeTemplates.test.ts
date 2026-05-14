import { describe, expect, it } from 'vitest'
import { NODE_TEMPLATES, createCosyVoice3VoiceCloneNode, createNodeFromTemplate } from '../../src/lib/nodeTemplates'

describe('nodeTemplates', () => {
  it('provides the essential real-node starter templates', () => {
    expect(NODE_TEMPLATES.map(t => t.id)).toEqual([
      'blank',
      'image-pass-through',
      'image-transform',
      'latent-transform',
      'mask-utility',
      'text-utility',
      'string-concat-preview',
      'multi-output',
      'cosyvoice3-voice-clone',
    ])
  })

  it('creates image transform with a strength widget and valid output return', () => {
    const node = createNodeFromTemplate('image-transform')
    expect(node.inputs.map(p => p.name)).toEqual(['image', 'strength'])
    expect(node.outputs.map(p => [p.name, p.type])).toEqual([['image', 'IMAGE']])
    expect(node.outputs[0].expression).toBe('image')
    expect(node.widgets[0].widgetType).toBe('slider')
    expect(node.code).not.toContain('return')
  })

  it('creates multi-output node with matching output contract', () => {
    const node = createNodeFromTemplate('multi-output')
    expect(node.outputs.map(p => p.type)).toEqual(['IMAGE', 'MASK'])
    expect(node.outputs.map(p => p.expression)).toEqual(['image', 'mask'])
    expect(node.code).toContain('mask = None')
    expect(node.code).not.toContain('return')
  })

  it('creates string concat preview with two inputs, a runtime preview, and one output', () => {
    const node = createNodeFromTemplate('string-concat-preview')
    expect(node.inputs.map(p => [p.name, p.type, p.isWidget])).toEqual([
      ['string1', 'STRING', false],
      ['string2', 'STRING', false],
    ])
    expect(node.widgets).toEqual([])
    expect(node.outputs.map(p => [p.name, p.type])).toEqual([['concat', 'STRING']])
    expect(node.outputs[0].expression).toBe('combined')
    expect(node.isOutputNode).toBe(true)
    expect(node.uiOutputs?.map(p => [p.key, p.kind, p.label, p.expression])).toEqual([['text', 'text', 'Combined text', 'combined']])
    expect(node.code).toContain('combined = f"{string1}\\n{string2}"')
    expect(node.code).not.toContain('return')
  })

  it('creates a CosyVoice 3 managed node with audio input, text controls, preview, and output', () => {
    const node = createCosyVoice3VoiceCloneNode()
    expect(node.name).toBe('CosyVoice3VoiceClone')
    expect(node.category).toBe('ComfyUINodeBuilder/audio')
    expect(node.inputs.map(p => [p.name, p.type, p.isWidget])).toEqual([
      ['reference_audio', 'AUDIO', false],
      ['text', 'STRING', true],
      ['reference_text', 'STRING', true],
      ['model_dir', 'STRING', true],
      ['fp16', 'BOOLEAN', true],
      ['speed', 'FLOAT', true],
      ['mode', 'COMBO', true],
      ['seed', 'INT', true],
    ])
    expect(node.widgets.map(w => w.widgetType)).toEqual(['multiline', 'multiline', 'text', 'bool', 'slider', 'dropdown', 'seed'])
    expect(node.widgets.find(w => w.widgetType === 'dropdown')?.default).toBe('auto')
    expect(node.widgets.find(w => w.widgetType === 'dropdown')?.config.options).toEqual(['auto', 'zero_shot', 'cross_lingual'])
    expect(node.outputs.map(p => [p.name, p.type, p.expression])).toEqual([['audio', 'AUDIO', 'audio']])
    expect(node.pythonRequirements).toEqual([
      'conformer==0.3.2',
      'Cython',
      'diffusers',
      'einops',
      'gdown',
      'hydra-core',
      'HyperPyYAML',
      'huggingface_hub',
      'inflect',
      'librosa',
      'lightning',
      'matplotlib',
      'modelscope',
      'networkx',
      'numpy',
      'onnx',
      'omegaconf',
      'onnxruntime-gpu; sys_platform == "linux"',
      'onnxruntime; sys_platform != "linux"',
      'openai-whisper',
      'protobuf',
      'pyarrow',
      'pyworld',
      'rich',
      'scipy',
      'soundfile',
      'tiktoken',
      'torchaudio',
      'transformers',
      'wetext',
      'wget',
      'x-transformers==2.11.24',
    ])
    expect(node.pythonRequirements).not.toContain('torch==2.3.1')
    expect(node.pythonRequirements).not.toContain('torchaudio==2.3.1')
    expect(node.pythonRequirements).not.toContain('deepspeed==0.15.1; sys_platform == "linux"')
    expect(node.pythonRequirements.some(req => req.startsWith('tensorrt-cu12'))).toBe(false)
    expect(node.pythonInstallScript).toContain('"clone", "--recursive"')
    expect(node.pythonInstallScript).toContain('https://github.com/FunAudioLLM/CosyVoice.git')
    expect(node.pythonInstallScript).toContain('shutil.rmtree(COSYVOICE_DIR)')
    expect(node.pythonInstallScript).not.toContain('Move it aside and retry')
    expect(node.uiOutputs?.map(p => [p.key, p.kind, p.label, p.expression])).toEqual([
      ['audio', 'audio', 'Generated audio', 'audio_preview'],
      ['text', 'text', 'Synthesis text', 'text'],
    ])
    expect(node.moduleCode).toContain('from cosyvoice.cli.cosyvoice import AutoModel')
    expect(node.moduleCode).toContain('_VENDOR_COSYVOICE_DIR')
    expect(node.moduleCode).toContain('import torchaudio')
    expect(node.moduleCode).toContain('import wave')
    expect(node.moduleCode).toContain('def _require_torchaudio')
    expect(node.moduleCode).toContain('def _write_pcm16_wav')
    expect(node.moduleCode).toContain('def _cosyvoice3_load_wav_without_torchcodec')
    expect(node.moduleCode).toContain('def _patch_cosyvoice3_audio_loader')
    expect(node.moduleCode).toContain('cosyvoice_file_utils.load_wav = _cosyvoice3_load_wav_without_torchcodec')
    expect(node.moduleCode).toContain('cosyvoice_frontend.load_wav = _cosyvoice3_load_wav_without_torchcodec')
    expect(node.moduleCode).toContain('sf.read(wav, dtype="float32", always_2d=True)')
    expect(node.moduleCode).not.toContain('import torchcodec')
    expect(node.moduleCode).toContain('_COSYVOICE3_END_OF_PROMPT = "<|endofprompt|>"')
    expect(node.moduleCode).toContain('def _cosyvoice3_with_endofprompt')
    expect(node.moduleCode).toContain('def _patch_cosyvoice3_lm_dtype')
    expect(node.moduleCode).toContain('llm.llm_decoder.to(dtype=target_dtype)')
    expect(node.moduleCode).toContain('def _cosyvoice3_log')
    expect(node.moduleCode).toContain('def _require_cosyvoice3_runtime_dependencies():')
    expect(node.moduleCode).toContain('("x-transformers", "x_transformers")')
    expect(node.moduleCode).toContain('("pyarrow", "pyarrow")')
    expect(node.moduleCode).toContain('("pyworld", "pyworld")')
    expect(node.moduleCode).toContain('("scipy", "scipy")')
    expect(node.moduleCode).toContain('Click Deploy & Restart; the builder runs install.py')
    expect(node.moduleCode).toContain('class _CosyVoice3Progress')
    expect(node.moduleCode).toContain('comfy_utils.ProgressBar')
    expect(node.moduleCode).toContain('os.environ.setdefault("MPLCONFIGDIR"')
    expect(node.moduleCode).not.toContain('.save(')
    expect(node.moduleCode.indexOf('sys.path.insert(0, _VENDOR_COSYVOICE_DIR)')).toBeLessThan(
      node.moduleCode.indexOf('from cosyvoice.cli.cosyvoice import AutoModel'),
    )
    expect(node.moduleCode).toContain('from huggingface_hub import snapshot_download as _hf_snapshot_download')
    expect(node.moduleCode).toContain('def _resolve_cosyvoice3_model_dir')
    expect(node.moduleCode).toContain('resolved = _hf_snapshot_download(repo_id=model_dir)')
    expect(node.moduleCode).toContain('return resolved')
    expect(node.moduleCode).toContain('AutoModel(model_dir=resolved_model_dir')
    expect(node.moduleCode).toContain('def _comfy_audio_to_prompt_wav')
    expect(node.code).toContain('cosyvoice = _get_cosyvoice3_model')
    expect(node.moduleCode).toContain('_patch_cosyvoice3_lm_dtype(model)')
    expect(node.code).toContain('progress = _CosyVoice3Progress(7)')
    expect(node.code).toContain('_require_cosyvoice3_runtime_dependencies()')
    expect(node.code).toContain('mode = str(mode or "zero_shot").strip()')
    expect(node.code).toContain('if mode == "auto":')
    expect(node.code).toContain('short_zero_shot_text')
    expect(node.code).toContain('mode = "zero_shot" if reference_text else "cross_lingual"')
    expect(node.code).toContain('CosyVoice zero_shot text is too short')
    expect(node.code).toContain('reference_text is required for zero_shot voice cloning')
    expect(node.code).toContain('_set_cosyvoice3_seed(seed)')
    expect(node.code).toContain('reference_prompt_text = _cosyvoice3_with_endofprompt(reference_text)')
    expect(node.code).toContain('synthesis_text = _cosyvoice3_with_endofprompt(text)')
    expect(node.code).toContain('reference_prompt_text,')
    expect(node.code).toContain('synthesis_text,')
    expect(node.code).toContain('progress.step(3, "model loading")')
    expect(node.code).toContain('_cosyvoice3_log("start"')
    expect(node.code).toContain('_cosyvoice3_log("error"')
    expect(node.code).toContain('inference_zero_shot')
    expect(node.code).not.toContain('return')
  })

  it('exposes the CosyVoice 3 managed node as a normal template id for AI and UI creation', () => {
    const node = createNodeFromTemplate('cosyvoice3-voice-clone')

    expect(node.name).toBe('CosyVoice3VoiceClone')
    expect(node.pythonInstallScript).toContain('https://github.com/FunAudioLLM/CosyVoice.git')
    expect(node.pythonRequirements).toContain('huggingface_hub')
  })

  it('uses derived returns by default for all templates', () => {
    for (const template of NODE_TEMPLATES) {
      const node = createNodeFromTemplate(template.id)
      expect(node.useReturnOverrides).toBe(false)
    }
  })
})
