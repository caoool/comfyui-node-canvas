import { describe, expect, it } from 'vitest'
import {
  COMFY_DATA_TYPES,
  COMFY_WIDGET_PRESETS,
  createWidgetFromPalette,
  previewKindForType,
} from '../../src/lib/comfyCatalog'

describe('comfyCatalog', () => {
  it('covers core ComfyUI media, model, primitive, 3D, and extension types', () => {
    const types = new Set(COMFY_DATA_TYPES.map(item => item.type))
    for (const type of [
      'IMAGE',
      'MASK',
      'VIDEO',
      'AUDIO',
      'LATENT',
      'CONDITIONING',
      'MODEL',
      'CLIP',
      'VAE',
      'STRING',
      'INT',
      'FLOAT',
      'BOOLEAN',
      'COMBO',
      'MESH',
      'FILE_3D',
      'OPENAI_INPUT_FILES',
      'BOUNDING_BOX',
      '*',
    ]) {
      expect(types.has(type)).toBe(true)
    }
  })

  it('includes broad widget presets used by real ComfyUI nodes', () => {
    const widgetTypes = new Set(COMFY_WIDGET_PRESETS.map(item => item.widgetType))
    for (const widgetType of [
      'slider',
      'number',
      'int',
      'seed',
      'dropdown',
      'dynamic_combo',
      'multiline',
      'bool',
      'color',
      'image_upload',
      'video_upload',
      'audio_upload',
      'autogrow',
      'matchtype',
      'bounding_box',
      'curve',
    ]) {
      expect(widgetTypes.has(widgetType)).toBe(true)
    }
  })

  it('creates widget specs from presets', () => {
    const seed = COMFY_WIDGET_PRESETS.find(item => item.widgetType === 'seed')
    expect(seed).toBeDefined()
    const widget = createWidgetFromPalette(seed!, 'port-1')
    expect(widget).toMatchObject({
      portId: 'port-1',
      widgetType: 'seed',
      default: 0,
    })
    expect(widget.config.control_after_generate).toBe(true)
  })

  it('maps common output types to preview surfaces', () => {
    expect(previewKindForType('IMAGE')).toBe('image')
    expect(previewKindForType('VIDEO')).toBe('video')
    expect(previewKindForType('AUDIO')).toBe('audio')
    expect(previewKindForType('STRING')).toBe('text')
    expect(previewKindForType('FLOATS')).toBe('list')
    expect(previewKindForType('MESH')).toBe('mesh')
  })
})
