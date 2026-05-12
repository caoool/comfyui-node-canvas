import { nanoid } from 'nanoid'
import type { PaletteItem, WidgetKind, WidgetSpec } from '../types/index'

export type PreviewKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'text'
  | 'list'
  | 'chart'
  | 'color'
  | 'mesh'
  | 'model'
  | 'conditioning'
  | 'latent'
  | 'mask'
  | 'generic'

export interface ComfyTypeItem extends PaletteItem {
  preview: PreviewKind
}

export const COMFY_CATEGORIES = [
  'ComfyUINodeBuilder',
  'custom',
  'image',
  'image/preprocessors',
  'image/postprocessing',
  'image/upscaling',
  'image/transform',
  'mask',
  'mask/compositing',
  'latent',
  'latent/advanced',
  'latent/audio',
  'latent/video',
  'conditioning',
  'conditioning/controlnet',
  'conditioning/video_models',
  'sampling',
  'sampling/custom_sampling',
  'loaders',
  'advanced/loaders',
  'advanced/model',
  'advanced/conditioning',
  'audio',
  'video',
  '3d',
  'text',
  'utils',
  'utils/primitive',
  'api node/image',
  'api node/video',
]

export const COMFY_DATA_TYPES: ComfyTypeItem[] = [
  { group: 'Media', label: 'IMAGE', name: 'image', type: 'IMAGE', preview: 'image', isWidget: false, widgetType: null, description: 'Batched image tensor.' },
  { group: 'Media', label: 'MASK', name: 'mask', type: 'MASK', preview: 'mask', isWidget: false, widgetType: null, description: 'Single-channel mask tensor.' },
  { group: 'Media', label: 'VIDEO', name: 'video', type: 'VIDEO', preview: 'video', isWidget: false, widgetType: null, description: 'Video clip or generated video handle.' },
  { group: 'Media', label: 'AUDIO', name: 'audio', type: 'AUDIO', preview: 'audio', isWidget: false, widgetType: null, description: 'Audio clip, waveform, or audio container.' },
  { group: 'Media', label: 'AUDIO_ENCODER', name: 'audio_encoder', type: 'AUDIO_ENCODER', preview: 'model', isWidget: false, widgetType: null, description: 'Audio encoder model.' },
  { group: 'Media', label: 'AUDIO_ENCODER_OUTPUT', name: 'audio_encoding', type: 'AUDIO_ENCODER_OUTPUT', preview: 'conditioning', isWidget: false, widgetType: null, description: 'Audio encoder output.' },
  { group: 'Media', label: 'SVG', name: 'svg', type: 'SVG', preview: 'image', isWidget: false, widgetType: null, description: 'Vector image output.' },
  { group: 'Media', label: 'WEBCAM', name: 'webcam', type: 'WEBCAM', preview: 'video', isWidget: false, widgetType: null, description: 'Camera/webcam stream.' },
  { group: 'Media', label: 'AUDIO_RECORD', name: 'audio_record', type: 'AUDIO_RECORD', preview: 'audio', isWidget: false, widgetType: null, description: 'Recorded microphone input.' },
  { group: 'Media', label: 'OPTICAL_FLOW', name: 'optical_flow', type: 'OPTICAL_FLOW', preview: 'video', isWidget: false, widgetType: null, description: 'Optical flow data.' },
  { group: 'Media', label: 'INTERP_MODEL', name: 'interp_model', type: 'INTERP_MODEL', preview: 'model', isWidget: false, widgetType: null, description: 'Frame interpolation model.' },
  { group: 'Media', label: 'BACKGROUND_REMOVAL', name: 'background_removal', type: 'BACKGROUND_REMOVAL', preview: 'model', isWidget: false, widgetType: null, description: 'Background removal model/result.' },

  { group: 'Core', label: 'LATENT', name: 'latent', type: 'LATENT', preview: 'latent', isWidget: false, widgetType: null, description: 'Latent image/video representation.' },
  { group: 'Core', label: 'CONDITIONING', name: 'conditioning', type: 'CONDITIONING', preview: 'conditioning', isWidget: false, widgetType: null, description: 'Positive/negative conditioning payload.' },
  { group: 'Core', label: 'MODEL', name: 'model', type: 'MODEL', preview: 'model', isWidget: false, widgetType: null, description: 'Diffusion model object.' },
  { group: 'Core', label: 'CLIP', name: 'clip', type: 'CLIP', preview: 'model', isWidget: false, widgetType: null, description: 'CLIP text encoder.' },
  { group: 'Core', label: 'VAE', name: 'vae', type: 'VAE', preview: 'model', isWidget: false, widgetType: null, description: 'Variational autoencoder.' },
  { group: 'Core', label: 'CLIP_VISION', name: 'clip_vision', type: 'CLIP_VISION', preview: 'model', isWidget: false, widgetType: null, description: 'CLIP vision encoder.' },
  { group: 'Core', label: 'CLIP_VISION_OUTPUT', name: 'clip_vision_output', type: 'CLIP_VISION_OUTPUT', preview: 'conditioning', isWidget: false, widgetType: null, description: 'CLIP vision embedding.' },
  { group: 'Core', label: 'CONTROL_NET', name: 'control_net', type: 'CONTROL_NET', preview: 'model', isWidget: false, widgetType: null, description: 'ControlNet model object.' },
  { group: 'Core', label: 'STYLE_MODEL', name: 'style_model', type: 'STYLE_MODEL', preview: 'model', isWidget: false, widgetType: null, description: 'Style model object.' },
  { group: 'Core', label: 'GLIGEN', name: 'gligen', type: 'GLIGEN', preview: 'model', isWidget: false, widgetType: null, description: 'GLIGEN model object.' },
  { group: 'Core', label: 'UPSCALE_MODEL', name: 'upscale_model', type: 'UPSCALE_MODEL', preview: 'model', isWidget: false, widgetType: null, description: 'Upscale model object.' },
  { group: 'Core', label: 'LATENT_UPSCALE_MODEL', name: 'latent_upscale_model', type: 'LATENT_UPSCALE_MODEL', preview: 'model', isWidget: false, widgetType: null, description: 'Latent upscale model object.' },
  { group: 'Core', label: 'LORA_MODEL', name: 'lora_model', type: 'LORA_MODEL', preview: 'model', isWidget: false, widgetType: null, description: 'LoRA model object.' },
  { group: 'Core', label: 'PHOTOMAKER', name: 'photomaker', type: 'PHOTOMAKER', preview: 'model', isWidget: false, widgetType: null, description: 'PhotoMaker model/data object.' },

  { group: 'Primitive', label: 'STRING', name: 'string', type: 'STRING', preview: 'text', isWidget: false, widgetType: null, description: 'String/text value.' },
  { group: 'Primitive', label: 'INT', name: 'int_value', type: 'INT', preview: 'text', isWidget: false, widgetType: null, description: 'Integer value.' },
  { group: 'Primitive', label: 'FLOAT', name: 'float_value', type: 'FLOAT', preview: 'text', isWidget: false, widgetType: null, description: 'Floating point value.' },
  { group: 'Primitive', label: 'BOOLEAN', name: 'enabled', type: 'BOOLEAN', preview: 'text', isWidget: false, widgetType: null, description: 'Boolean value.' },
  { group: 'Primitive', label: 'COMBO', name: 'choice', type: 'COMBO', preview: 'list', isWidget: false, widgetType: null, description: 'Selectable option list.' },
  { group: 'Primitive', label: 'COLOR', name: 'color', type: 'COLOR', preview: 'color', isWidget: false, widgetType: null, description: 'Color value.' },
  { group: 'Primitive', label: 'FLOATS', name: 'float_list', type: 'FLOATS', preview: 'list', isWidget: false, widgetType: null, description: 'List of float values.' },

  { group: 'Sampling', label: 'SAMPLER', name: 'sampler', type: 'SAMPLER', preview: 'generic', isWidget: false, widgetType: null, description: 'Sampler object.' },
  { group: 'Sampling', label: 'SIGMAS', name: 'sigmas', type: 'SIGMAS', preview: 'chart', isWidget: false, widgetType: null, description: 'Sigma schedule.' },
  { group: 'Sampling', label: 'NOISE', name: 'noise', type: 'NOISE', preview: 'latent', isWidget: false, widgetType: null, description: 'Noise object.' },
  { group: 'Sampling', label: 'GUIDER', name: 'guider', type: 'GUIDER', preview: 'generic', isWidget: false, widgetType: null, description: 'Custom sampling guider.' },
  { group: 'Sampling', label: 'TIMESTEPS_RANGE', name: 'timesteps', type: 'TIMESTEPS_RANGE', preview: 'chart', isWidget: false, widgetType: null, description: 'Timestep range.' },

  { group: 'Hooks', label: 'HOOKS', name: 'hooks', type: 'HOOKS', preview: 'generic', isWidget: false, widgetType: null, description: 'Patch/control hooks.' },
  { group: 'Hooks', label: 'HOOK_KEYFRAMES', name: 'hook_keyframes', type: 'HOOK_KEYFRAMES', preview: 'chart', isWidget: false, widgetType: null, description: 'Hook keyframe schedule.' },
  { group: 'Hooks', label: 'MODEL_PATCH', name: 'model_patch', type: 'MODEL_PATCH', preview: 'model', isWidget: false, widgetType: null, description: 'Model patch object.' },
  { group: 'Hooks', label: 'LATENT_OPERATION', name: 'latent_operation', type: 'LATENT_OPERATION', preview: 'generic', isWidget: false, widgetType: null, description: 'Latent operation object.' },

  { group: '3D', label: 'MESH', name: 'mesh', type: 'MESH', preview: 'mesh', isWidget: false, widgetType: null, description: '3D mesh.' },
  { group: '3D', label: 'VOXEL', name: 'voxel', type: 'VOXEL', preview: 'mesh', isWidget: false, widgetType: null, description: 'Voxel grid.' },
  { group: '3D', label: 'FILE_3D', name: 'file_3d', type: 'FILE_3D', preview: 'mesh', isWidget: false, widgetType: null, description: '3D file.' },
  { group: '3D', label: 'FILE_3D_GLB', name: 'file_3d_glb', type: 'FILE_3D_GLB', preview: 'mesh', isWidget: false, widgetType: null, description: 'GLB 3D file.' },
  { group: '3D', label: 'FILE_3D_OBJ', name: 'file_3d_obj', type: 'FILE_3D_OBJ', preview: 'mesh', isWidget: false, widgetType: null, description: 'OBJ 3D file.' },
  { group: '3D', label: 'FILE_3D_FBX', name: 'file_3d_fbx', type: 'FILE_3D_FBX', preview: 'mesh', isWidget: false, widgetType: null, description: 'FBX 3D file.' },
  { group: '3D', label: 'FILE_3D_MULTI', name: 'file_3d_any', type: 'FILE_3D_GLB,FILE_3D_OBJ,FILE_3D_FBX,FILE_3D', preview: 'mesh', isWidget: false, widgetType: null, description: 'Common 3D file match types.' },
  { group: '3D', label: 'LOAD_3D', name: 'load_3d', type: 'LOAD_3D', preview: 'mesh', isWidget: false, widgetType: null, description: 'Loaded 3D scene.' },
  { group: '3D', label: 'LOAD3D_CAMERA', name: 'camera', type: 'LOAD3D_CAMERA', preview: 'mesh', isWidget: false, widgetType: null, description: '3D camera.' },
  { group: '3D', label: 'CAMERA_CONTROL', name: 'camera_control', type: 'CAMERA_CONTROL', preview: 'mesh', isWidget: false, widgetType: null, description: 'Camera control data.' },

  { group: 'API/Extension', label: 'OPENAI_INPUT_FILES', name: 'openai_files', type: 'OPENAI_INPUT_FILES', preview: 'list', isWidget: false, widgetType: null, description: 'OpenAI file list.' },
  { group: 'API/Extension', label: 'OPENAI_CHAT_CONFIG', name: 'openai_chat_config', type: 'OPENAI_CHAT_CONFIG', preview: 'generic', isWidget: false, widgetType: null, description: 'OpenAI chat config.' },
  { group: 'API/Extension', label: 'GEMINI_INPUT_FILES', name: 'gemini_files', type: 'GEMINI_INPUT_FILES', preview: 'list', isWidget: false, widgetType: null, description: 'Gemini file list.' },
  { group: 'API/Extension', label: 'MODEL_TASK_ID', name: 'model_task_id', type: 'MODEL_TASK_ID', preview: 'text', isWidget: false, widgetType: null, description: 'Remote model task id.' },
  { group: 'API/Extension', label: 'RIG_TASK_ID', name: 'rig_task_id', type: 'RIG_TASK_ID', preview: 'text', isWidget: false, widgetType: null, description: 'Remote rig task id.' },
  { group: 'API/Extension', label: 'RETARGET_TASK_ID', name: 'retarget_task_id', type: 'RETARGET_TASK_ID', preview: 'text', isWidget: false, widgetType: null, description: 'Remote retarget task id.' },
  { group: 'API/Extension', label: 'MESHY_TASK_ID', name: 'meshy_task_id', type: 'MESHY_TASK_ID', preview: 'text', isWidget: false, widgetType: null, description: 'Meshy task id.' },
  { group: 'API/Extension', label: 'MESHY_RIGGED_TASK_ID', name: 'meshy_rigged_task_id', type: 'MESHY_RIGGED_TASK_ID', preview: 'text', isWidget: false, widgetType: null, description: 'Meshy rigged task id.' },
  { group: 'API/Extension', label: 'ELEVENLABS_VOICE', name: 'elevenlabs_voice', type: 'ELEVENLABS_VOICE', preview: 'audio', isWidget: false, widgetType: null, description: 'ElevenLabs voice selection/data.' },
  { group: 'API/Extension', label: 'LUMA_CONCEPTS', name: 'luma_concepts', type: 'LUMA_CONCEPTS', preview: 'list', isWidget: false, widgetType: null, description: 'Luma concepts.' },
  { group: 'API/Extension', label: 'LUMA_REF', name: 'luma_ref', type: 'LUMA_REF', preview: 'image', isWidget: false, widgetType: null, description: 'Luma reference data.' },
  { group: 'API/Extension', label: 'PIXVERSE_TEMPLATE', name: 'pixverse_template', type: 'PIXVERSE_TEMPLATE', preview: 'video', isWidget: false, widgetType: null, description: 'PixVerse template.' },
  { group: 'API/Extension', label: 'RECRAFT_CONTROLS', name: 'recraft_controls', type: 'RECRAFT_CONTROLS', preview: 'generic', isWidget: false, widgetType: null, description: 'Recraft control data.' },
  { group: 'API/Extension', label: 'RECRAFT_COLOR', name: 'recraft_color', type: 'RECRAFT_COLOR', preview: 'color', isWidget: false, widgetType: null, description: 'Recraft color value.' },
  { group: 'API/Extension', label: 'RECRAFT_V3_STYLE', name: 'recraft_style', type: 'RECRAFT_V3_STYLE', preview: 'generic', isWidget: false, widgetType: null, description: 'Recraft style value.' },
  { group: 'API/Extension', label: 'SAM3_TRACK_DATA', name: 'sam3_track_data', type: 'SAM3_TRACK_DATA', preview: 'video', isWidget: false, widgetType: null, description: 'SAM3 tracking data.' },
  { group: 'API/Extension', label: 'WAN_CAMERA_EMBEDDING', name: 'wan_camera_embedding', type: 'WAN_CAMERA_EMBEDDING', preview: 'conditioning', isWidget: false, widgetType: null, description: 'WAN camera embedding.' },
  { group: 'API/Extension', label: 'BOUNDING_BOX', name: 'bounding_box', type: 'BOUNDING_BOX', preview: 'image', isWidget: false, widgetType: null, description: 'Bounding box coordinates.' },
  { group: 'API/Extension', label: 'POSE_KEYPOINT', name: 'pose_keypoint', type: 'POSE_KEYPOINT', preview: 'image', isWidget: false, widgetType: null, description: 'Pose keypoints.' },
  { group: 'API/Extension', label: 'TRACKS', name: 'tracks', type: 'TRACKS', preview: 'chart', isWidget: false, widgetType: null, description: 'Tracking data.' },
  { group: 'API/Extension', label: 'CURVE', name: 'curve', type: 'CURVE', preview: 'chart', isWidget: false, widgetType: null, description: 'Curve data.' },
  { group: 'API/Extension', label: 'HISTOGRAM', name: 'histogram', type: 'HISTOGRAM', preview: 'chart', isWidget: false, widgetType: null, description: 'Histogram data.' },
  { group: 'API/Extension', label: 'MATCHTYPE', name: 'match_any', type: '*', preview: 'generic', isWidget: false, widgetType: null, description: 'Wildcard match type.' },
]

export const COMFY_WIDGET_PRESETS: PaletteItem[] = [
  { group: 'Numbers', label: 'Float Slider', name: 'strength', type: 'FLOAT', isWidget: true, widgetType: 'slider', default: 1, config: { min: 0, max: 1, step: 0.01 }, description: 'FLOAT slider widget.' },
  { group: 'Numbers', label: 'Float Number', name: 'value', type: 'FLOAT', isWidget: true, widgetType: 'number', default: 0, config: { min: -1000000, max: 1000000, step: 0.01 }, description: 'FLOAT number widget.' },
  { group: 'Numbers', label: 'Integer', name: 'steps', type: 'INT', isWidget: true, widgetType: 'int', default: 20, config: { min: 0, max: 10000, step: 1 }, description: 'INT widget.' },
  { group: 'Numbers', label: 'Seed', name: 'seed', type: 'INT', isWidget: true, widgetType: 'seed', default: 0, config: { min: 0, max: 18446744073709551615, control_after_generate: true }, description: 'ComfyUI seed control.' },
  { group: 'Numbers', label: 'Boolean', name: 'enabled', type: 'BOOLEAN', isWidget: true, widgetType: 'bool', default: false, config: {}, description: 'BOOLEAN toggle.' },

  { group: 'Text + Select', label: 'Combo', name: 'mode', type: 'COMBO', isWidget: true, widgetType: 'dropdown', default: 'option1', config: { options: ['option1', 'option2'] }, description: 'Dropdown from a fixed option list.' },
  { group: 'Text + Select', label: 'Dynamic Combo', name: 'choice', type: 'COMFY_DYNAMICCOMBO_V3', isWidget: true, widgetType: 'dynamic_combo', default: '', config: { options: [] }, description: 'Dynamic Extension Manager frontend combo type.' },
  { group: 'Text + Select', label: 'Text', name: 'text', type: 'STRING', isWidget: true, widgetType: 'text', default: '', config: { multiline: false }, description: 'Single-line STRING widget.' },
  { group: 'Text + Select', label: 'Multiline', name: 'prompt', type: 'STRING', isWidget: true, widgetType: 'multiline', default: '', config: { multiline: true, dynamicPrompts: true }, description: 'Prompt-sized multiline STRING widget.' },
  { group: 'Text + Select', label: 'JSON', name: 'json_data', type: 'STRING', isWidget: true, widgetType: 'json', default: '{}', config: { multiline: true }, description: 'JSON/text config widget.' },
  { group: 'Text + Select', label: 'List', name: 'items', type: 'COMFY_AUTOGROW_V3', isWidget: true, widgetType: 'autogrow', default: [], config: { template: ['STRING', { multiline: false }] }, description: 'Autogrow list-style widget.' },
  { group: 'Text + Select', label: 'Match Type', name: 'match_any', type: 'COMFY_MATCHTYPE_V3', isWidget: true, widgetType: 'matchtype', default: null, config: { lazy: true, template: '*' }, description: 'Match-any typed widget.' },

  { group: 'Files + Media', label: 'Image Upload', name: 'image', type: 'IMAGE', isWidget: true, widgetType: 'image_upload', default: '', config: { image_upload: true }, description: 'Image upload/select affordance.' },
  { group: 'Files + Media', label: 'Video Upload', name: 'video', type: 'VIDEO', isWidget: true, widgetType: 'video_upload', default: '', config: { video_upload: true }, description: 'Video upload/select affordance.' },
  { group: 'Files + Media', label: 'Audio Upload', name: 'audio', type: 'AUDIO', isWidget: true, widgetType: 'audio_upload', default: '', config: { audio_upload: true }, description: 'Audio upload/select affordance.' },
  { group: 'Files + Media', label: 'File Path', name: 'file_path', type: 'STRING', isWidget: true, widgetType: 'file', default: '', config: { file_upload: true }, description: 'File picker/path widget.' },

  { group: 'Visual Controls', label: 'Color', name: 'color', type: 'COLOR', isWidget: true, widgetType: 'color', default: '#ffffff', config: {}, description: 'Color swatch/picker.' },
  { group: 'Visual Controls', label: 'Bounding Box', name: 'box', type: 'BOUNDING_BOX', isWidget: true, widgetType: 'bounding_box', default: [0, 0, 1, 1], config: { component: 'bbox' }, description: 'Bounding box editor.' },
  { group: 'Visual Controls', label: 'Curve', name: 'curve', type: 'CURVE', isWidget: true, widgetType: 'curve', default: [], config: {}, description: 'Curve editor data.' },
]

export function createWidgetFromPalette(item: PaletteItem, portId: string): WidgetSpec {
  return {
    id: nanoid(),
    portId,
    widgetType: item.widgetType as WidgetKind,
    default: item.default ?? defaultValueForWidget(item.widgetType as WidgetKind),
    config: { ...(item.config ?? defaultConfigForWidget(item.widgetType as WidgetKind)) },
  }
}

function defaultValueForWidget(widgetType: WidgetKind): unknown {
  switch (widgetType) {
    case 'slider': return 1
    case 'number': return 0
    case 'int': return 20
    case 'seed': return 0
    case 'dropdown': return 'option1'
    case 'text':
    case 'multiline':
    case 'file':
    case 'image_upload':
    case 'video_upload':
    case 'audio_upload':
    case 'dynamic_combo': return ''
    case 'bool': return false
    case 'color': return '#ffffff'
    case 'json': return '{}'
    case 'list':
    case 'autogrow':
    case 'bounding_box':
    case 'curve': return []
    case 'matchtype': return null
  }
}

function defaultConfigForWidget(widgetType: WidgetKind): Record<string, unknown> {
  switch (widgetType) {
    case 'slider': return { min: 0, max: 1, step: 0.01 }
    case 'number': return { min: -1000000, max: 1000000, step: 0.01 }
    case 'int': return { min: 0, max: 10000, step: 1 }
    case 'seed': return { min: 0, max: 18446744073709551615, control_after_generate: true }
    case 'dropdown': return { options: ['option1', 'option2'] }
    case 'multiline': return { multiline: true, dynamicPrompts: true }
    case 'text': return { multiline: false }
    case 'image_upload': return { image_upload: true }
    case 'video_upload': return { video_upload: true }
    case 'audio_upload': return { audio_upload: true }
    case 'file': return { file_upload: true }
    case 'autogrow': return { template: ['STRING', { multiline: false }] }
    case 'matchtype': return { lazy: true, template: '*' }
    case 'bounding_box': return { component: 'bbox' }
    default: return {}
  }
}

export function previewKindForType(type: string): PreviewKind {
  const exact = COMFY_DATA_TYPES.find(item => item.type === type)
  if (exact) return exact.preview
  if (type.includes('IMAGE') || type.includes('SVG')) return 'image'
  if (type.includes('MASK')) return 'mask'
  if (type.includes('VIDEO') || type.includes('WEBCAM')) return 'video'
  if (type.includes('AUDIO')) return 'audio'
  if (type.includes('STRING') || type.includes('TEXT')) return 'text'
  if (type.includes('LIST') || type.includes('FILES') || type.includes('TRACK')) return 'list'
  if (type.includes('CURVE') || type.includes('HISTOGRAM') || type.includes('SIGMAS')) return 'chart'
  if (type.includes('COLOR')) return 'color'
  if (type.includes('MESH') || type.includes('3D') || type.includes('VOXEL') || type.includes('CAMERA')) return 'mesh'
  if (type.includes('MODEL') || type.includes('CLIP') || type.includes('VAE') || type.includes('CONTROL')) return 'model'
  if (type.includes('CONDITIONING')) return 'conditioning'
  if (type.includes('LATENT')) return 'latent'
  return 'generic'
}

export function portColor(type: string): string {
  const t = type.split(',')[0]
  const map: Record<string, string> = {
    IMAGE: 'var(--type-image)',
    LATENT: 'var(--type-latent)',
    FLOAT: 'var(--type-float)',
    INT: 'var(--type-int)',
    STRING: 'var(--type-string)',
    MASK: 'var(--type-mask)',
    CONDITIONING: 'var(--type-conditioning)',
    MODEL: 'var(--type-model)',
    VAE: 'var(--type-vae)',
    CLIP: 'var(--type-clip)',
    BOOLEAN: 'var(--type-boolean)',
    AUDIO: 'var(--type-audio)',
    VIDEO: 'var(--type-video)',
    MESH: 'var(--type-mesh)',
    FILE_3D: 'var(--type-mesh)',
    COLOR: 'var(--type-color)',
    COMBO: 'var(--type-combo)',
  }
  return map[t] ?? 'var(--text-muted)'
}
