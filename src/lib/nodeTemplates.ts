import { nanoid } from 'nanoid'
import type { NodeSpec, PortSpec, WidgetSpec } from '../types/index'

export type NodeTemplateId =
  | 'blank'
  | 'image-pass-through'
  | 'image-transform'
  | 'latent-transform'
  | 'mask-utility'
  | 'text-utility'
  | 'string-concat-preview'
  | 'multi-output'
  | 'cosyvoice3-voice-clone'

export interface NodeTemplate {
  id: NodeTemplateId
  label: string
  description: string
}

export const NODE_TEMPLATES: NodeTemplate[] = [
  { id: 'blank', label: 'Blank Node', description: 'Minimal custom node scaffold.' },
  { id: 'image-pass-through', label: 'Image Pass-through', description: 'Accepts and returns one IMAGE.' },
  { id: 'image-transform', label: 'Image Transform', description: 'IMAGE input with FLOAT strength widget.' },
  { id: 'latent-transform', label: 'Latent Transform', description: 'LATENT input and output scaffold.' },
  { id: 'mask-utility', label: 'Mask Utility', description: 'MASK input and output scaffold.' },
  { id: 'text-utility', label: 'Text Utility', description: 'STRING widget input and output scaffold.' },
  { id: 'string-concat-preview', label: 'String Concat Preview', description: 'Two STRING inputs, runtime text preview, and one concat STRING output.' },
  { id: 'multi-output', label: 'Multi-output', description: 'One IMAGE input returning IMAGE and MASK.' },
  { id: 'cosyvoice3-voice-clone', label: 'CosyVoice 3 Voice Clone', description: 'Zero-shot voice cloning with reference AUDIO, text controls, and AUDIO output.' },
]

const TEMPLATE_NAMES: Record<NodeTemplateId, { name: string; displayName: string; category: string }> = {
  blank: { name: 'CustomNode', displayName: 'Custom Node', category: 'ComfyUINodeBuilder' },
  'image-pass-through': { name: 'ImagePassThrough', displayName: 'Image Pass-through', category: 'ComfyUINodeBuilder' },
  'image-transform': { name: 'ImageTransform', displayName: 'Image Transform', category: 'ComfyUINodeBuilder' },
  'latent-transform': { name: 'LatentTransform', displayName: 'Latent Transform', category: 'ComfyUINodeBuilder' },
  'mask-utility': { name: 'MaskUtility', displayName: 'Mask Utility', category: 'ComfyUINodeBuilder' },
  'text-utility': { name: 'TextUtility', displayName: 'Text Utility', category: 'ComfyUINodeBuilder' },
  'string-concat-preview': { name: 'StringConcatPreview', displayName: 'String Concat Preview', category: 'ComfyUINodeBuilder' },
  'multi-output': { name: 'ImageAndMask', displayName: 'Image and Mask', category: 'ComfyUINodeBuilder' },
  'cosyvoice3-voice-clone': { name: 'CosyVoice3VoiceClone', displayName: 'CosyVoice 3 Voice Clone', category: 'ComfyUINodeBuilder/audio' },
}

function port(name: string, type: string, patch: Partial<PortSpec> = {}): PortSpec {
  return {
    id: nanoid(),
    name,
    type,
    optional: false,
    isWidget: false,
    ...patch,
  }
}

const COSYVOICE3_MODULE_CODE = `import importlib.util
import os
import sys
import tempfile
import time
import uuid
import wave

import torch

try:
    import torchaudio
except Exception as exc:
    torchaudio = None
    _TORCHAUDIO_IMPORT_ERROR = exc
else:
    _TORCHAUDIO_IMPORT_ERROR = None


os.environ.setdefault("MPLCONFIGDIR", os.path.join(tempfile.gettempdir(), "comfyui_node_builder_matplotlib"))

_NODE_DIR = os.path.dirname(os.path.abspath(__file__))
_VENDOR_COSYVOICE_DIR = os.path.join(_NODE_DIR, "vendor", "CosyVoice")
_VENDOR_MATCHA_DIR = os.path.join(_VENDOR_COSYVOICE_DIR, "third_party", "Matcha-TTS")
if os.path.isdir(_VENDOR_COSYVOICE_DIR) and _VENDOR_COSYVOICE_DIR not in sys.path:
    sys.path.insert(0, _VENDOR_COSYVOICE_DIR)
if os.path.isdir(_VENDOR_MATCHA_DIR) and _VENDOR_MATCHA_DIR not in sys.path:
    sys.path.insert(0, _VENDOR_MATCHA_DIR)

try:
    from cosyvoice.cli.cosyvoice import AutoModel
except Exception as exc:
    AutoModel = None
    _COSYVOICE3_IMPORT_ERROR = exc
else:
    _COSYVOICE3_IMPORT_ERROR = None

try:
    from huggingface_hub import snapshot_download as _hf_snapshot_download
except Exception as exc:
    _hf_snapshot_download = None
    _HF_IMPORT_ERROR = exc
else:
    _HF_IMPORT_ERROR = None


_COSYVOICE3_MODEL_CACHE = {}
_COSYVOICE3_AUDIO_LOADER_PATCHED = False
_COSYVOICE3_INSTALL_HINT = "In the builder: Click Deploy & Restart; the builder runs install.py and requirements.txt setup before restarting ComfyUI."
_COSYVOICE3_END_OF_PROMPT = "<|endofprompt|>"
_COSYVOICE3_DEFAULT_INSTRUCTION = "You are a helpful assistant."
_COSYVOICE3_RUNTIME_MODULES = (
    ("conformer", "conformer"),
    ("diffusers", "diffusers"),
    ("einops", "einops"),
    ("gdown", "gdown"),
    ("hydra-core", "hydra"),
    ("HyperPyYAML", "hyperpyyaml"),
    ("huggingface_hub", "huggingface_hub"),
    ("inflect", "inflect"),
    ("librosa", "librosa"),
    ("lightning", "lightning"),
    ("matplotlib", "matplotlib"),
    ("modelscope", "modelscope"),
    ("networkx", "networkx"),
    ("numpy", "numpy"),
    ("omegaconf", "omegaconf"),
    ("onnx", "onnx"),
    ("onnxruntime", "onnxruntime"),
    ("openai-whisper", "whisper"),
    ("protobuf", "google.protobuf"),
    ("pyarrow", "pyarrow"),
    ("pyworld", "pyworld"),
    ("rich", "rich"),
    ("scipy", "scipy"),
    ("soundfile", "soundfile"),
    ("tiktoken", "tiktoken"),
    ("transformers", "transformers"),
    ("wetext", "wetext"),
    ("wget", "wget"),
    ("x-transformers", "x_transformers"),
)


def _cosyvoice3_log(stage, detail=""):
    message = f"[ComfyUINodeBuilder][CosyVoice3VoiceClone][{stage}]"
    if detail:
        message = f"{message} {detail}"
    print(message, flush=True)


class _CosyVoice3Progress:
    def __init__(self, total):
        self.total = int(total)
        self.current = 0
        self.bar = None
        try:
            import comfy.utils as comfy_utils

            self.bar = comfy_utils.ProgressBar(total)
        except Exception as exc:
            _cosyvoice3_log("progress_unavailable", f"{type(exc).__name__}: {exc}")

    def step(self, value, label):
        self.current = int(value)
        _cosyvoice3_log("progress", f"{self.current}/{self.total} {label}")
        if self.bar is None:
            return
        try:
            self.bar.update_absolute(self.current, self.total)
        except Exception as exc:
            _cosyvoice3_log("progress_error", f"{type(exc).__name__}: {exc}")


def _cosyvoice3_with_endofprompt(value):
    value = str(value or "").strip()
    if _COSYVOICE3_END_OF_PROMPT in value:
        return value
    if value:
        return f"{_COSYVOICE3_DEFAULT_INSTRUCTION}{_COSYVOICE3_END_OF_PROMPT}{value}"
    return f"{_COSYVOICE3_DEFAULT_INSTRUCTION}{_COSYVOICE3_END_OF_PROMPT}"


def _set_cosyvoice3_seed(seed):
    import random

    seed_value = int(seed if seed is not None else 0)
    _cosyvoice3_log("seed", f"value={seed_value}")
    random.seed(seed_value)
    try:
        import numpy as np

        np.random.seed(seed_value % (2**32 - 1))
    except Exception as exc:
        _cosyvoice3_log("seed_warning", f"numpy unavailable: {type(exc).__name__}: {exc}")
    torch.manual_seed(seed_value)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed_value)


def _missing_cosyvoice3_runtime_dependencies():
    missing = []
    for requirement, module_name in _COSYVOICE3_RUNTIME_MODULES:
        try:
            found = importlib.util.find_spec(module_name) is not None
        except Exception:
            found = False
        if not found:
            missing.append(requirement)
    if torchaudio is None:
        missing.append("torchaudio")
    if _hf_snapshot_download is None:
        missing.append("huggingface_hub")
    return sorted(set(missing), key=str.lower)


def _require_cosyvoice3_runtime_dependencies():
    missing = _missing_cosyvoice3_runtime_dependencies()
    if missing:
        raise ImportError(
            f"CosyVoice runtime dependencies are missing: {', '.join(missing)}. {_COSYVOICE3_INSTALL_HINT}"
        )
    if AutoModel is None:
        raise ImportError(
            f"CosyVoice source is not importable. {_COSYVOICE3_INSTALL_HINT}"
        ) from _COSYVOICE3_IMPORT_ERROR
    _patch_cosyvoice3_audio_loader()


def _require_torchaudio():
    if torchaudio is None:
        raise ImportError(
            f"torchaudio is required for CosyVoice audio conversion. {_COSYVOICE3_INSTALL_HINT}"
        ) from _TORCHAUDIO_IMPORT_ERROR
    return torchaudio


def _cosyvoice3_load_wav_without_torchcodec(wav, target_sr, min_sr=16000):
    import soundfile as sf

    ta = _require_torchaudio()
    data, sample_rate = sf.read(wav, dtype="float32", always_2d=True)
    speech = torch.from_numpy(data).transpose(0, 1).contiguous()
    speech = speech.mean(dim=0, keepdim=True)
    if sample_rate != target_sr:
        if sample_rate < min_sr:
            raise AssertionError(f"wav sample rate {sample_rate} must be greater than {target_sr}")
        speech = ta.functional.resample(speech, sample_rate, target_sr)
    return speech


def _patch_cosyvoice3_audio_loader():
    global _COSYVOICE3_AUDIO_LOADER_PATCHED
    if _COSYVOICE3_AUDIO_LOADER_PATCHED:
        return
    try:
        import cosyvoice.cli.frontend as cosyvoice_frontend
        import cosyvoice.utils.file_utils as cosyvoice_file_utils
    except Exception as exc:
        raise ImportError(f"Could not patch CosyVoice audio loader. {_COSYVOICE3_INSTALL_HINT}") from exc
    cosyvoice_file_utils.load_wav = _cosyvoice3_load_wav_without_torchcodec
    cosyvoice_frontend.load_wav = _cosyvoice3_load_wav_without_torchcodec
    _COSYVOICE3_AUDIO_LOADER_PATCHED = True
    _cosyvoice3_log("audio_loader", "patched CosyVoice load_wav without TorchCodec")


def _patch_cosyvoice3_lm_dtype(cosyvoice):
    model = getattr(cosyvoice, "model", None)
    llm = getattr(model, "llm", None)
    if llm is None or getattr(llm, "_builder_dtype_patch", False):
        return
    original_inference_wrapper = llm.inference_wrapper
    target_dtype = None
    try:
        target_dtype = llm.llm.model.model.embed_tokens.weight.dtype
    except Exception:
        try:
            target_dtype = next(llm.llm.parameters()).dtype
        except Exception:
            target_dtype = None
    if target_dtype is not None:
        try:
            llm.speech_embedding.to(dtype=target_dtype)
        except Exception:
            pass
        try:
            llm.llm_decoder.to(dtype=target_dtype)
        except Exception:
            pass
        try:
            llm.llm_embedding.to(dtype=target_dtype)
        except Exception:
            pass

    def _builder_dtype_safe_inference_wrapper(lm_input, sampling, min_len, max_len, uuid):
        if target_dtype is not None and torch.is_floating_point(lm_input):
            lm_input = lm_input.to(target_dtype)
        yield from original_inference_wrapper(lm_input, sampling, min_len, max_len, uuid)

    llm.inference_wrapper = _builder_dtype_safe_inference_wrapper
    llm._builder_dtype_patch = True


def _resolve_cosyvoice3_model_dir(model_dir):
    model_dir = str(model_dir or "").strip()
    if not model_dir:
        raise ValueError("model_dir is required. Use a local model folder or a Hugging Face repo id.")

    expanded = os.path.abspath(os.path.expandvars(os.path.expanduser(model_dir)))
    if os.path.isdir(expanded):
        _cosyvoice3_log("model_dir", f"using local path={expanded}")
        return expanded
    if os.path.exists(expanded):
        raise ValueError(f"model_dir exists but is not a directory: {expanded}")

    if "/" not in model_dir:
        raise ValueError(
            f"model_dir was not found as a local folder and does not look like a Hugging Face repo id: {model_dir}"
        )
    if _hf_snapshot_download is None:
        raise ImportError(
            f"huggingface_hub is required to auto-download CosyVoice 3. {_COSYVOICE3_INSTALL_HINT}"
        ) from _HF_IMPORT_ERROR

    _cosyvoice3_log("model_dir", f"downloading/resolving Hugging Face repo={model_dir}")
    resolved = _hf_snapshot_download(repo_id=model_dir)
    _cosyvoice3_log("model_dir", f"resolved path={resolved}")
    return resolved


def _get_cosyvoice3_model(model_dir, fp16):
    _require_cosyvoice3_runtime_dependencies()
    if AutoModel is None:
        raise ImportError(
            f"CosyVoice is not importable. {_COSYVOICE3_INSTALL_HINT}"
        ) from _COSYVOICE3_IMPORT_ERROR
    resolved_model_dir = _resolve_cosyvoice3_model_dir(model_dir)
    use_fp16 = bool(fp16) and torch.cuda.is_available()
    cache_key = (resolved_model_dir, use_fp16)
    if cache_key not in _COSYVOICE3_MODEL_CACHE:
        _cosyvoice3_log("model_load", f"cache=miss path={resolved_model_dir} fp16={use_fp16} cuda={torch.cuda.is_available()}")
        _COSYVOICE3_MODEL_CACHE[cache_key] = AutoModel(model_dir=resolved_model_dir, fp16=use_fp16)
    else:
        _cosyvoice3_log("model_load", f"cache=hit path={resolved_model_dir} fp16={use_fp16}")
    model = _COSYVOICE3_MODEL_CACHE[cache_key]
    _patch_cosyvoice3_lm_dtype(model)
    return model


def _audio_waveform_channels(audio):
    if not isinstance(audio, dict):
        raise TypeError("reference_audio must be a ComfyUI AUDIO dictionary.")
    waveform = audio.get("waveform")
    sample_rate = audio.get("sample_rate")
    if waveform is None or sample_rate is None:
        raise ValueError("reference_audio must contain waveform and sample_rate.")
    if not torch.is_tensor(waveform):
        waveform = torch.as_tensor(waveform)
    waveform = waveform.detach().float().cpu()
    if waveform.ndim == 3:
        waveform = waveform[0]
    elif waveform.ndim == 1:
        waveform = waveform.unsqueeze(0)
    elif waveform.ndim != 2:
        raise ValueError(f"Unsupported AUDIO waveform shape: {tuple(waveform.shape)}")
    if waveform.ndim == 2 and waveform.shape[0] > 8 and waveform.shape[1] <= 8:
        waveform = waveform.transpose(0, 1)
    return waveform, int(sample_rate)


def _write_pcm16_wav(path, waveform, sample_rate):
    if not torch.is_tensor(waveform):
        waveform = torch.as_tensor(waveform)
    waveform = waveform.detach().float().cpu()
    if waveform.ndim == 3:
        waveform = waveform[0]
    elif waveform.ndim == 1:
        waveform = waveform.unsqueeze(0)
    elif waveform.ndim != 2:
        raise ValueError(f"Unsupported WAV waveform shape: {tuple(waveform.shape)}")
    if waveform.ndim == 2 and waveform.shape[0] > 8 and waveform.shape[1] <= 8:
        waveform = waveform.transpose(0, 1)
    waveform = waveform.clamp(-1.0, 1.0)
    interleaved = (waveform.transpose(0, 1).contiguous() * 32767.0).round().to(torch.int16)
    with wave.open(path, "wb") as wav_file:
        wav_file.setnchannels(int(waveform.shape[0]))
        wav_file.setsampwidth(2)
        wav_file.setframerate(int(sample_rate))
        try:
            wav_file.writeframes(interleaved.numpy().tobytes())
        except Exception:
            import array

            samples = array.array("h", interleaved.reshape(-1).tolist())
            if sys.byteorder != "little":
                samples.byteswap()
            wav_file.writeframes(samples.tobytes())


def _comfy_audio_to_prompt_wav(audio, target_sample_rate=16000):
    ta = _require_torchaudio()
    waveform, sample_rate = _audio_waveform_channels(audio)
    _cosyvoice3_log(
        "reference_audio",
        f"channels={waveform.shape[0]} samples={waveform.shape[1]} sample_rate={sample_rate} target_sample_rate={target_sample_rate}",
    )
    if waveform.shape[0] > 1:
        waveform = waveform.mean(dim=0, keepdim=True)
    if sample_rate != target_sample_rate:
        _cosyvoice3_log("reference_audio", f"resampling {sample_rate}->{target_sample_rate}")
        waveform = ta.functional.resample(waveform, sample_rate, target_sample_rate)
    waveform = waveform.clamp(-1.0, 1.0)
    handle = tempfile.NamedTemporaryFile(prefix="cosyvoice3_reference_", suffix=".wav", delete=False)
    handle.close()
    _write_pcm16_wav(handle.name, waveform, target_sample_rate)
    _cosyvoice3_log("reference_audio", f"prompt_wav={handle.name}")
    return handle.name


def _speech_to_channels(speech):
    if not torch.is_tensor(speech):
        speech = torch.as_tensor(speech)
    speech = speech.detach().float().cpu()
    if speech.ndim == 1:
        return speech.unsqueeze(0)
    if speech.ndim == 2:
        return speech
    if speech.ndim == 3:
        return speech[0]
    raise ValueError(f"Unsupported CosyVoice speech shape: {tuple(speech.shape)}")


def _cosyvoice_chunks_to_comfy_audio(chunks, sample_rate):
    waveforms = []
    for chunk in chunks:
        speech = chunk.get("tts_speech") if isinstance(chunk, dict) else chunk
        if speech is None:
            continue
        waveforms.append(_speech_to_channels(speech))
    if not waveforms:
        raise RuntimeError("CosyVoice returned no audio chunks.")
    channels = torch.cat(waveforms, dim=-1).unsqueeze(0)
    _cosyvoice3_log("audio_result", f"chunks={len(waveforms)} shape={tuple(channels.shape)} sample_rate={int(sample_rate)}")
    return {"waveform": channels, "sample_rate": int(sample_rate)}


def _manual_audio_preview_record(audio):
    import folder_paths

    waveform, sample_rate = _audio_waveform_channels(audio)
    temp_dir = folder_paths.get_temp_directory()
    os.makedirs(temp_dir, exist_ok=True)
    filename = f"ComfyUI_temp_cosyvoice3_{uuid.uuid4().hex[:8]}.wav"
    path = os.path.join(temp_dir, filename)
    _write_pcm16_wav(path, waveform, sample_rate)
    _cosyvoice3_log("preview", f"manual_wav={path}")
    return {"filename": filename, "subfolder": "", "type": "temp"}


def _comfy_audio_to_preview_record(audio):
    try:
        from comfy_api.latest import _ui as UI

        records = UI.AudioSaveHelper.save_audio(
            audio,
            filename_prefix="ComfyUI_temp_cosyvoice3",
            folder_type=UI.FolderType.temp,
            cls=None,
            format="flac",
            quality="128k",
        )
        if records:
            _cosyvoice3_log("preview", "saved with ComfyUI AudioSaveHelper")
            return dict(records[0])
    except Exception as exc:
        _cosyvoice3_log("preview", f"AudioSaveHelper unavailable: {type(exc).__name__}: {exc}")
    return _manual_audio_preview_record(audio)`

const COSYVOICE3_EXECUTE_CODE = `started_at = time.perf_counter()
progress = _CosyVoice3Progress(7)
prompt_wav = None
start_detail = f"text_chars={len(str(text or ''))} reference_text_chars={len(str(reference_text or ''))} model_dir={model_dir} fp16={bool(fp16)} speed={speed} mode={mode} seed={seed}"
_cosyvoice3_log("start", start_detail)
progress.step(0, "started")

try:
    if not str(text or "").strip():
        raise ValueError("text is required.")
    _require_cosyvoice3_runtime_dependencies()
    mode = str(mode or "zero_shot").strip()
    if mode not in ("auto", "zero_shot", "cross_lingual"):
        raise ValueError(f"Unsupported mode: {mode}. Use auto, zero_shot, or cross_lingual.")
    reference_text = str(reference_text or "").strip()
    text_clean = str(text).strip()
    short_zero_shot_text = bool(reference_text) and len(text_clean) < 0.5 * len(reference_text)
    if mode == "auto":
        mode = "zero_shot" if reference_text else "cross_lingual"
        _cosyvoice3_log("mode", f"auto_selected={mode}")
    if mode == "zero_shot" and short_zero_shot_text:
        raise ValueError(
            "CosyVoice zero_shot text is too short compared with reference_text. "
            "Use a longer synthesis text, or trim reference_text/reference_audio to a shorter matching prompt. "
            "Do not use cross_lingual for same-language voice cloning because it ignores reference_text."
        )
    if mode == "zero_shot" and not reference_text:
        raise ValueError("reference_text is required for zero_shot voice cloning. Enter the exact transcript of reference_audio, or set mode to cross_lingual only when the reference audio language differs from the synthesis text.")
    if mode == "cross_lingual" and reference_text:
        _cosyvoice3_log("quality_warning", "reference_text is ignored in cross_lingual mode")
    reference_prompt_text = _cosyvoice3_with_endofprompt(reference_text)
    synthesis_text = _cosyvoice3_with_endofprompt(text)
    _set_cosyvoice3_seed(seed)

    progress.step(1, "reference audio preparing")
    prompt_wav = _comfy_audio_to_prompt_wav(reference_audio)
    progress.step(2, "reference audio ready")

    progress.step(3, "model loading")
    cosyvoice = _get_cosyvoice3_model(model_dir, fp16)
    progress.step(4, "model ready")

    if mode == "zero_shot":
        _cosyvoice3_log("inference", "mode=zero_shot")
        progress.step(5, "inference zero_shot")
        chunks = list(cosyvoice.inference_zero_shot(
            str(text),
            reference_prompt_text,
            prompt_wav,
            stream=False,
            speed=float(speed),
        ))
    else:
        mode = "cross_lingual"
        _cosyvoice3_log("inference", "mode=cross_lingual")
        progress.step(5, "inference cross_lingual")
        chunks = list(cosyvoice.inference_cross_lingual(
            synthesis_text,
            prompt_wav,
            stream=False,
            speed=float(speed),
        ))
    _cosyvoice3_log("inference", f"mode={mode} chunks={len(chunks)}")
    audio = _cosyvoice_chunks_to_comfy_audio(chunks, cosyvoice.sample_rate)
    progress.step(6, "audio result ready")
    audio_preview = _comfy_audio_to_preview_record(audio)
    progress.step(7, "done")
    _cosyvoice3_log("done", f"elapsed_s={time.perf_counter() - started_at:.2f}")
except Exception as exc:
    _cosyvoice3_log("error", f"{type(exc).__name__}: {exc} elapsed_s={time.perf_counter() - started_at:.2f}")
    raise
finally:
    if prompt_wav:
        try:
            os.remove(prompt_wav)
            _cosyvoice3_log("cleanup", f"removed prompt_wav={prompt_wav}")
        except OSError as exc:
            _cosyvoice3_log("cleanup", f"failed to remove prompt_wav={prompt_wav}: {exc}")`

const COSYVOICE3_INSTALL_SCRIPT = `import os
import shutil
import subprocess
import sys


PACK_DIR = os.path.dirname(os.path.abspath(__file__))
VENDOR_DIR = os.path.join(PACK_DIR, "vendor")
COSYVOICE_DIR = os.path.join(VENDOR_DIR, "CosyVoice")
COSYVOICE_REPO = "https://github.com/FunAudioLLM/CosyVoice.git"


def run(command):
    print("+", " ".join(command), flush=True)
    subprocess.check_call(command)


os.makedirs(VENDOR_DIR, exist_ok=True)
if os.path.isdir(os.path.join(COSYVOICE_DIR, ".git")):
    run(["git", "-C", COSYVOICE_DIR, "pull", "--ff-only"])
    run(["git", "-C", COSYVOICE_DIR, "submodule", "update", "--init", "--recursive"])
else:
    if os.path.exists(COSYVOICE_DIR):
        print(f"Removing incomplete CosyVoice checkout at {COSYVOICE_DIR}", flush=True)
        shutil.rmtree(COSYVOICE_DIR)
    run(["git", "clone", "--recursive", COSYVOICE_REPO, COSYVOICE_DIR])

print("CosyVoice source is available at", COSYVOICE_DIR)
print("CosyVoice source is ready. The builder will install the generated requirements.txt into this ComfyUI Python:", sys.executable)`

const COSYVOICE3_RUNTIME_REQUIREMENTS = [
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
]

const COSYVOICE3_ENDOFPROMPT_HELPERS = `_COSYVOICE3_END_OF_PROMPT = "<|endofprompt|>"
_COSYVOICE3_DEFAULT_INSTRUCTION = "You are a helpful assistant."


def _cosyvoice3_with_endofprompt(value):
    value = str(value or "").strip()
    if _COSYVOICE3_END_OF_PROMPT in value:
        return value
    if value:
        return f"{_COSYVOICE3_DEFAULT_INSTRUCTION}{_COSYVOICE3_END_OF_PROMPT}{value}"
    return f"{_COSYVOICE3_DEFAULT_INSTRUCTION}{_COSYVOICE3_END_OF_PROMPT}"


def _builder_cosyvoice3_quality_warnings(text, prompt_text):
    text_len = len(str(text or "").strip())
    prompt_len = len(str(prompt_text or "").strip())
    if text_len == 0:
        print("[ComfyUINodeBuilder][CosyVoice3][quality_warning] text is empty", flush=True)
    if prompt_len == 0:
        print("[ComfyUINodeBuilder][CosyVoice3][quality_warning] prompt text is empty", flush=True)
    if text_len > 0 and prompt_len > 0 and text_len < max(8, prompt_len // 4):
        print("[ComfyUINodeBuilder][CosyVoice3][quality_warning] synthesis text is much shorter than prompt text; output quality may be poor", flush=True)`

const COSYVOICE3_DTYPE_PATCH_HELPER = `def _patch_cosyvoice3_lm_dtype(cosyvoice):
    model = getattr(cosyvoice, "model", None)
    llm = getattr(model, "llm", None)
    if llm is None or getattr(llm, "_builder_dtype_patch", False):
        return
    original_inference_wrapper = llm.inference_wrapper
    target_dtype = None
    try:
        target_dtype = llm.llm.model.model.embed_tokens.weight.dtype
    except Exception:
        try:
            target_dtype = next(llm.llm.parameters()).dtype
        except Exception:
            target_dtype = None
    if target_dtype is not None:
        try:
            llm.speech_embedding.to(dtype=target_dtype)
        except Exception:
            pass
        try:
            llm.llm_decoder.to(dtype=target_dtype)
        except Exception:
            pass
        try:
            llm.llm_embedding.to(dtype=target_dtype)
        except Exception:
            pass

    def _builder_dtype_safe_inference_wrapper(lm_input, sampling, min_len, max_len, uuid):
        import torch as _torch

        if target_dtype is not None and _torch.is_floating_point(lm_input):
            lm_input = lm_input.to(target_dtype)
        yield from original_inference_wrapper(lm_input, sampling, min_len, max_len, uuid)

    llm.inference_wrapper = _builder_dtype_safe_inference_wrapper
    llm._builder_dtype_patch = True`

const COSYVOICE3_MANAGED_NODE_NAME = 'CosyVoice3VoiceClone'
const COSYVOICE3_MODE_OPTIONS = ['auto', 'zero_shot', 'cross_lingual']
const COSYVOICE3_SEED_MAX = 2147483647

const COSYVOICE3_BLOCKED_REQUIREMENT_PATTERNS = [
  /^torch==/i,
  /^torchaudio==/i,
  /^deepspeed\b/i,
  /^tensorrt-cu12\b/i,
  /^--extra-index-url\b/i,
]

function requirementPackageName(requirement: string): string {
  const trimmed = requirement.trim()
  const markerIndex = trimmed.indexOf(';')
  const withoutMarker = markerIndex >= 0 ? trimmed.slice(0, markerIndex) : trimmed
  const match = withoutMarker.match(/^[A-Za-z0-9_.-]+/)
  return (match?.[0] ?? withoutMarker).toLowerCase().replaceAll('_', '-')
}

function isBlockedCosyVoiceRequirement(requirement: string): boolean {
  return COSYVOICE3_BLOCKED_REQUIREMENT_PATTERNS.some(pattern => pattern.test(requirement.trim()))
}

function mergeCosyVoiceRuntimeRequirements(existingRequirements: string[] = []): string[] {
  const managedNames = new Set(COSYVOICE3_RUNTIME_REQUIREMENTS.map(requirementPackageName))
  const merged = [...COSYVOICE3_RUNTIME_REQUIREMENTS]
  const seen = new Set(merged.map(requirement => requirement.trim()))
  for (const rawRequirement of existingRequirements) {
    const requirement = rawRequirement.trim()
    if (!requirement || seen.has(requirement) || isBlockedCosyVoiceRequirement(requirement)) continue
    if (managedNames.has(requirementPackageName(requirement))) continue
    seen.add(requirement)
    merged.push(requirement)
  }
  return merged
}

export function pythonRequirementsForNode(node: Pick<NodeSpec, 'name' | 'pythonRequirements'>): string[] {
  if (node.name !== COSYVOICE3_MANAGED_NODE_NAME) return node.pythonRequirements ?? []
  return mergeCosyVoiceRuntimeRequirements(node.pythonRequirements)
}

export function pythonInstallScriptForNode(node: Pick<NodeSpec, 'name' | 'pythonInstallScript'>): string {
  if (node.name === COSYVOICE3_MANAGED_NODE_NAME && !node.pythonInstallScript?.trim()) {
    return COSYVOICE3_INSTALL_SCRIPT
  }
  return node.pythonInstallScript ?? ''
}

function shouldUseLatestCosyVoiceModuleCode(node: Pick<NodeSpec, 'name' | 'moduleCode'>): boolean {
  if (node.name !== COSYVOICE3_MANAGED_NODE_NAME) return false
  const moduleCode = node.moduleCode ?? ''
  if (!moduleCode.trim()) return true
  if (moduleCode.includes('_patch_cosyvoice3_lm_dtype') && !moduleCode.includes('llm.llm_decoder.to(dtype=target_dtype)')) return true
  if (moduleCode.includes('_set_cosyvoice3_seed')) return false
  return moduleCode.includes('_cosyvoice3_with_endofprompt') ||
    moduleCode.includes('_patch_cosyvoice3_audio_loader') ||
    moduleCode.includes('_COSYVOICE3_MODEL_CACHE') ||
    moduleCode.includes('[ComfyUINodeBuilder][CosyVoice3VoiceClone]') ||
    moduleCode.includes('from cosyvoice.cli.cosyvoice import AutoModel')
}

function shouldUseLatestCosyVoiceExecuteCode(node: Pick<NodeSpec, 'name' | 'code'>): boolean {
  if (node.name !== COSYVOICE3_MANAGED_NODE_NAME) return false
  const code = node.code ?? ''
  if (!code.trim()) return true
  if (code.includes('short zero_shot text detected; switching to cross_lingual')) return true
  if (code.includes('short_zero_shot_text') && code.includes('mode == "auto"')) return false
  return code.includes('_cosyvoice3_with_endofprompt') ||
    code.includes('cosyvoice.inference_cross_lingual') ||
    code.includes('cosyvoice.inference_zero_shot') ||
    code.includes('_comfy_audio_to_prompt_wav') ||
    code.includes('_CosyVoice3Progress')
}

type CosyVoiceInputSpec = {
  name: string
  type: string
  isWidget: boolean
  widgetType?: WidgetSpec['widgetType']
  default?: unknown
  config?: Record<string, unknown>
}

const COSYVOICE3_INPUT_SPECS: CosyVoiceInputSpec[] = [
  { name: 'reference_audio', type: 'AUDIO', isWidget: false },
  { name: 'text', type: 'STRING', isWidget: true, widgetType: 'multiline', default: 'Hello from a cloned voice.', config: { multiline: true, dynamicPrompts: false } },
  { name: 'reference_text', type: 'STRING', isWidget: true, widgetType: 'multiline', default: '', config: { multiline: true, dynamicPrompts: false } },
  { name: 'model_dir', type: 'STRING', isWidget: true, widgetType: 'text', default: 'FunAudioLLM/Fun-CosyVoice3-0.5B-2512', config: {} },
  { name: 'fp16', type: 'BOOLEAN', isWidget: true, widgetType: 'bool', default: true, config: {} },
  { name: 'speed', type: 'FLOAT', isWidget: true, widgetType: 'slider', default: 1, config: { min: 0.5, max: 2, step: 0.05 } },
  { name: 'mode', type: 'COMBO', isWidget: true, widgetType: 'dropdown', default: 'auto', config: { options: COSYVOICE3_MODE_OPTIONS } },
  { name: 'seed', type: 'INT', isWidget: true, widgetType: 'seed', default: 0, config: { min: 0, max: COSYVOICE3_SEED_MAX, control_after_generate: true } },
]

function widgetDefaultFor(spec: CosyVoiceInputSpec, existing: WidgetSpec | undefined): unknown {
  if (!existing) return spec.default
  if (spec.name === 'mode') return spec.default
  return existing.default ?? spec.default
}

function widgetConfigFor(spec: CosyVoiceInputSpec, existing: WidgetSpec | undefined): Record<string, unknown> {
  if (spec.name === 'mode' || spec.name === 'seed') return { ...(spec.config ?? {}) }
  return { ...(spec.config ?? {}), ...(existing?.config ?? {}) }
}

function ensureCosyVoiceContract(node: NodeSpec): NodeSpec {
  const existingInputs = new Map(node.inputs.map(input => [input.name, input]))
  const inputs: PortSpec[] = COSYVOICE3_INPUT_SPECS.map(spec => {
    const existing = existingInputs.get(spec.name)
    if (existing) {
      return {
        ...existing,
        type: spec.type,
        optional: false,
        isWidget: spec.isWidget,
      }
    }
    return port(spec.name, spec.type, { isWidget: spec.isWidget })
  })
  const managedInputNames = new Set(COSYVOICE3_INPUT_SPECS.map(spec => spec.name))
  inputs.push(...node.inputs.filter(input => !managedInputNames.has(input.name)))

  const inputByName = new Map(inputs.map(input => [input.name, input]))
  const existingWidgets = new Map(node.widgets.map(widget => [widget.portId, widget]))
  const managedPortIds = new Set(inputs.slice(0, COSYVOICE3_INPUT_SPECS.length).map(input => input.id))
  const widgets: WidgetSpec[] = []
  for (const spec of COSYVOICE3_INPUT_SPECS) {
    if (!spec.isWidget || !spec.widgetType) continue
    const input = inputByName.get(spec.name)
    if (!input) continue
    const existing = existingWidgets.get(input.id)
    widgets.push({
      id: existing?.id ?? nanoid(),
      portId: input.id,
      widgetType: spec.widgetType,
      default: widgetDefaultFor(spec, existing),
      config: widgetConfigFor(spec, existing),
    })
  }
  widgets.push(...node.widgets.filter(widget => !managedPortIds.has(widget.portId)))

  const outputs = [...node.outputs]
  const audioOutput = outputs.find(output => output.name === 'audio')
  if (audioOutput) {
    audioOutput.type = 'AUDIO'
    audioOutput.optional = false
    audioOutput.isWidget = false
    audioOutput.expression = 'audio'
  } else {
    outputs.push(port('audio', 'AUDIO', { expression: 'audio' }))
  }

  const uiOutputs = [...(node.uiOutputs ?? [])]
  if (!uiOutputs.some(output => output.key === 'audio')) {
    uiOutputs.push({ id: nanoid(), key: 'audio', kind: 'audio', label: 'Generated audio', expression: 'audio_preview', sample: [] })
  }
  if (!uiOutputs.some(output => output.key === 'text')) {
    uiOutputs.push({ id: nanoid(), key: 'text', kind: 'text', label: 'Synthesis text', expression: 'text', sample: 'Hello from a cloned voice.' })
  }

  return { ...node, inputs, widgets, outputs, uiOutputs }
}

function addCosyVoicePreflightToExecuteCode(code: string): string {
  if (!code.trim() || code.includes('_require_cosyvoice3_runtime_dependencies()')) return code
  const afterTextValidation = '    if not str(text or "").strip():\n        raise ValueError("text is required.")\n'
  if (!code.includes(afterTextValidation)) return code
  return code.replace(afterTextValidation, `${afterTextValidation}    _require_cosyvoice3_runtime_dependencies()\n`)
}

function looksLikeGenericCosyVoice3Node(node: NodeSpec): boolean {
  if (node.name === COSYVOICE3_MANAGED_NODE_NAME) return false
  const searchable = [
    node.name,
    node.displayName,
    node.moduleCode,
    node.code,
    node.pythonSource ?? '',
  ].join('\n')
  if (!/inference_(zero_shot|cross_lingual|sft)/.test(searchable)) return false
  return /CosyVoice3|Fun-CosyVoice3|_ensure_cosyvoice_import_path|vendor[\\/]+CosyVoice/i.test(searchable)
}

function appendPythonHelper(moduleCode: string, helper: string): string {
  const prefix = moduleCode.trimEnd()
  return prefix ? `${prefix}\n\n${helper}` : helper
}

function replaceTopLevelPythonFunction(moduleCode: string, functionName: string, replacement: string): string {
  const lines = moduleCode.split('\n')
  const start = lines.findIndex(line => line.startsWith(`def ${functionName}(`))
  if (start < 0) return appendPythonHelper(moduleCode, replacement)

  let end = start + 1
  while (end < lines.length) {
    const line = lines[end]
    const isTopLevelCode = line.trim() !== '' && !line.startsWith(' ') && !line.startsWith('\t')
    if (isTopLevelCode) break
    end += 1
  }

  const before = lines.slice(0, start).join('\n').trimEnd()
  const after = lines.slice(end).join('\n').trimStart()
  return [before, replacement, after].filter(part => part.length > 0).join('\n\n')
}

function addCosyVoiceGenericRuntimeHelpers(moduleCode: string): string {
  let next = moduleCode
  if (!next.includes('_cosyvoice3_with_endofprompt')) {
    next = appendPythonHelper(next, COSYVOICE3_ENDOFPROMPT_HELPERS)
  }
  if (!next.includes('_patch_cosyvoice3_lm_dtype')) {
    next = appendPythonHelper(next, COSYVOICE3_DTYPE_PATCH_HELPER)
  } else if (!next.includes('llm.llm_decoder.to(dtype=target_dtype)')) {
    next = replaceTopLevelPythonFunction(next, '_patch_cosyvoice3_lm_dtype', COSYVOICE3_DTYPE_PATCH_HELPER)
  }
  return next
}

function patchCosyVoiceZeroShotCall(code: string, promptVariable: string): { code: string, changed: boolean } {
  const textExpr = [
    'text.strip\\(\\)',
    'text_clean',
    'str\\(text\\)\\.strip\\(\\)',
    'str\\(text\\)',
    'str\\(text\\s+or\\s+["\']["\']\\)\\.strip\\(\\)',
  ].join('|')
  const promptExpr = [
    `${promptVariable}\\.strip\\(\\)`,
    `${promptVariable}_clean`,
    `str\\(${promptVariable}\\)\\.strip\\(\\)`,
    `str\\(${promptVariable}\\)`,
    `str\\(${promptVariable}\\s+or\\s+["\']["\']\\)\\.strip\\(\\)`,
  ].join('|')
  const callPattern = new RegExp(`cosyvoice\\.inference_zero_shot\\(\\s*(?:${textExpr})\\s*,\\s*(?:${promptExpr})\\s*,`, 'g')
  const patched = code.replace(callPattern, 'cosyvoice.inference_zero_shot(text_for_cosyvoice, prompt_text_for_cosyvoice,')
  return { code: patched, changed: patched !== code }
}

function insertCosyVoiceEndOfPromptAssignments(code: string, promptVariable: string): string {
  if (code.includes('text_for_cosyvoice = _cosyvoice3_with_endofprompt(text)')) return code
  const lines = code.split('\n')
  const callLineIndex = lines.findIndex(line => line.includes('cosyvoice.inference_zero_shot('))
  if (callLineIndex < 0) return code
  const indent = lines[callLineIndex].match(/^\s*/)?.[0] ?? ''
  const assignments = [
    `${indent}text_for_cosyvoice = str(text or "").strip()`,
    `${indent}prompt_text_for_cosyvoice = _cosyvoice3_with_endofprompt(${promptVariable})`,
    `${indent}_builder_cosyvoice3_quality_warnings(text_for_cosyvoice, prompt_text_for_cosyvoice)`,
    '',
  ]
  return [
    ...lines.slice(0, callLineIndex),
    ...assignments,
    ...lines.slice(callLineIndex),
  ].join('\n')
}

function insertCosyVoiceRuntimePatchCall(code: string): string {
  if (code.includes('_patch_cosyvoice3_lm_dtype(cosyvoice)')) return code
  const lines = code.split('\n')
  const modelLineIndex = lines.findIndex(line => (
    /^\s*cosyvoice\s*=/.test(line) &&
    (line.includes('AutoModel(') || line.includes('_get_cosyvoice'))
  ))
  const callLineIndex = modelLineIndex >= 0
    ? modelLineIndex + 1
    : lines.findIndex(line => line.includes('cosyvoice.inference_zero_shot('))
  if (callLineIndex < 0) return code
  const indent = lines[Math.max(0, callLineIndex - 1)].match(/^\s*/)?.[0] ?? ''
  return [
    ...lines.slice(0, callLineIndex),
    `${indent}_patch_cosyvoice3_lm_dtype(cosyvoice)`,
    ...lines.slice(callLineIndex),
  ].join('\n')
}

function patchGenericCosyVoice3Node(node: NodeSpec): NodeSpec {
  let code = node.code ?? ''
  let changed = false
  for (const promptVariable of ['prompt_text', 'reference_text']) {
    const result = patchCosyVoiceZeroShotCall(code, promptVariable)
    code = result.code
    changed = changed || result.changed
    if (result.changed) {
      code = insertCosyVoiceEndOfPromptAssignments(code, promptVariable)
      break
    }
  }
  const moduleCode = addCosyVoiceGenericRuntimeHelpers(node.moduleCode ?? '')
  const codeWithRuntimePatch = insertCosyVoiceRuntimePatchCall(code)
  if (!changed && moduleCode === (node.moduleCode ?? '') && codeWithRuntimePatch === (node.code ?? '')) return node
  return {
    ...node,
    moduleCode,
    code: codeWithRuntimePatch,
  }
}

export function nodeForPythonGeneration(node: NodeSpec): NodeSpec {
  if (looksLikeGenericCosyVoice3Node(node)) return patchGenericCosyVoice3Node(node)
  if (node.name !== COSYVOICE3_MANAGED_NODE_NAME) return node
  const upgradedNode = ensureCosyVoiceContract(node)
  return {
    ...upgradedNode,
    moduleCode: shouldUseLatestCosyVoiceModuleCode(node) ? COSYVOICE3_MODULE_CODE : node.moduleCode,
    code: shouldUseLatestCosyVoiceExecuteCode(node)
      ? COSYVOICE3_EXECUTE_CODE
      : addCosyVoicePreflightToExecuteCode(node.code ?? ''),
    pythonRequirements: pythonRequirementsForNode(node),
    pythonInstallScript: pythonInstallScriptForNode(node),
  }
}

export function createCosyVoice3VoiceCloneNode(): NodeSpec {
  const node: NodeSpec = {
    id: nanoid(),
    name: COSYVOICE3_MANAGED_NODE_NAME,
    displayName: 'CosyVoice 3 Voice Clone',
    category: 'ComfyUINodeBuilder/audio',
    isOutputNode: false,
    inputs: [],
    outputs: [],
    widgets: [],
    uiOutputs: [],
    moduleCode: '',
    code: '',
    pythonRequirements: [...COSYVOICE3_RUNTIME_REQUIREMENTS],
    pythonInstallScript: COSYVOICE3_INSTALL_SCRIPT,
    useReturnOverrides: false,
    returnTypes: [],
    returnNames: [],
  }
  const referenceAudio = port('reference_audio', 'AUDIO')
  const text = port('text', 'STRING', { isWidget: true })
  const referenceText = port('reference_text', 'STRING', { isWidget: true })
  const modelDir = port('model_dir', 'STRING', { isWidget: true })
  const fp16 = port('fp16', 'BOOLEAN', { isWidget: true })
  const speed = port('speed', 'FLOAT', { isWidget: true })
  const mode = port('mode', 'COMBO', { isWidget: true })
  const seed = port('seed', 'INT', { isWidget: true })
  node.inputs = [referenceAudio, text, referenceText, modelDir, fp16, speed, mode, seed]
  node.outputs = [port('audio', 'AUDIO', { expression: 'audio' })]
  node.uiOutputs = [
    { id: nanoid(), key: 'audio', kind: 'audio', label: 'Generated audio', expression: 'audio_preview', sample: [] },
    { id: nanoid(), key: 'text', kind: 'text', label: 'Synthesis text', expression: 'text', sample: 'Hello from a cloned voice.' },
  ]
  node.widgets = [
    {
      id: nanoid(),
      portId: text.id,
      widgetType: 'multiline',
      default: 'Hello from a cloned voice.',
      config: { multiline: true, dynamicPrompts: false },
    },
    {
      id: nanoid(),
      portId: referenceText.id,
      widgetType: 'multiline',
      default: '',
      config: { multiline: true, dynamicPrompts: false },
    },
    {
      id: nanoid(),
      portId: modelDir.id,
      widgetType: 'text',
      default: 'FunAudioLLM/Fun-CosyVoice3-0.5B-2512',
      config: {},
    },
    {
      id: nanoid(),
      portId: fp16.id,
      widgetType: 'bool',
      default: true,
      config: {},
    },
    {
      id: nanoid(),
      portId: speed.id,
      widgetType: 'slider',
      default: 1,
      config: { min: 0.5, max: 2, step: 0.05 },
    },
    {
      id: nanoid(),
      portId: mode.id,
      widgetType: 'dropdown',
      default: 'auto',
      config: { options: COSYVOICE3_MODE_OPTIONS },
    },
    {
      id: nanoid(),
      portId: seed.id,
      widgetType: 'seed',
      default: 0,
      config: { min: 0, max: COSYVOICE3_SEED_MAX, control_after_generate: true },
    },
  ]
  node.moduleCode = COSYVOICE3_MODULE_CODE
  node.code = COSYVOICE3_EXECUTE_CODE
  return node
}

export function createNodeFromTemplate(templateId: NodeTemplateId): NodeSpec {
  if (templateId === 'cosyvoice3-voice-clone') return createCosyVoice3VoiceCloneNode()
  const base = TEMPLATE_NAMES[templateId]
  const node: NodeSpec = {
    id: nanoid(),
    name: base.name,
    displayName: base.displayName,
    category: base.category,
    isOutputNode: false,
    inputs: [],
    outputs: [],
    widgets: [],
    uiOutputs: [],
    moduleCode: '',
    code: '',
    useReturnOverrides: false,
    returnTypes: [],
    returnNames: [],
  }

    switch (templateId) {
    case 'blank':
      node.code = '# Define variables here. Outputs and Return UI generate the final return.'
      break
    case 'image-pass-through':
      node.inputs = [port('image', 'IMAGE')]
      node.outputs = [port('image', 'IMAGE', { expression: 'image' })]
      node.code = ''
      break
    case 'image-transform': {
      const strength = port('strength', 'FLOAT', { isWidget: true })
      node.inputs = [port('image', 'IMAGE'), strength]
      node.outputs = [port('image', 'IMAGE', { expression: 'image' })]
      node.widgets = [{
        id: nanoid(),
        portId: strength.id,
        widgetType: 'slider',
        default: 1,
        config: { min: 0, max: 1, step: 0.01 },
      }]
      node.code = '# Replace this with your image processing logic.'
      break
    }
    case 'latent-transform':
      node.inputs = [port('latent', 'LATENT')]
      node.outputs = [port('latent', 'LATENT', { expression: 'latent' })]
      node.code = ''
      break
    case 'mask-utility':
      node.inputs = [port('mask', 'MASK')]
      node.outputs = [port('mask', 'MASK', { expression: 'mask' })]
      node.code = ''
      break
    case 'text-utility': {
      const text = port('text', 'STRING', { isWidget: true })
      node.inputs = [text]
      node.outputs = [port('text', 'STRING', { expression: 'text' })]
      node.widgets = [{
        id: nanoid(),
        portId: text.id,
        widgetType: 'text',
        default: '',
        config: {},
      }]
      node.code = ''
      break
    }
    case 'string-concat-preview': {
      const leftText = port('string1', 'STRING')
      const rightText = port('string2', 'STRING')
      const leftSample = 'Hello from string A'
      const rightSample = 'and string B from the builder'
      node.inputs = [leftText, rightText]
      node.outputs = [port('concat', 'STRING', { expression: 'combined' })]
      node.isOutputNode = true
      node.uiOutputs = [
        { id: nanoid(), key: 'text', kind: 'text', label: 'Combined text', expression: 'combined', sample: `${leftSample}\n${rightSample}` },
      ]
      node.code = 'combined = f"{string1}\\n{string2}"'
      break
    }
    case 'multi-output':
      node.inputs = [port('image', 'IMAGE')]
      node.outputs = [port('image', 'IMAGE', { expression: 'image' }), port('mask', 'MASK', { expression: 'mask' })]
      node.code = 'mask = None'
      break
  }

  return node
}
