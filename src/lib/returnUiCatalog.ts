import type { UiOutputKind } from '../types/index'

export interface ReturnUiPaletteItem {
  kind: UiOutputKind
  label: string
  key: string
  description: string
  sample: unknown
}

export const RETURN_UI_KINDS: UiOutputKind[] = [
  'text',
  'markdown',
  'json',
  'list',
  'table',
  'image',
  'audio',
  'video',
  'color',
  'chart',
  'mesh',
  'file',
  'generic',
  'custom',
]

export const RETURN_UI_ITEMS: ReturnUiPaletteItem[] = [
  { kind: 'text', label: 'Text', key: 'text', description: 'Show text or a single-line value in the node body.', sample: 'runtime text' },
  { kind: 'markdown', label: 'Markdown', key: 'markdown', description: 'Show formatted markdown-like text.', sample: '## Result' },
  { kind: 'json', label: 'JSON', key: 'json', description: 'Show dictionaries, objects, or structured debug data.', sample: { value: 1 } },
  { kind: 'list', label: 'List', key: 'list', description: 'Show a list of values.', sample: ['item A', 'item B'] },
  { kind: 'table', label: 'Table', key: 'table', description: 'Show tabular or row-based data.', sample: [['name', 'value']] },
  { kind: 'image', label: 'Image', key: 'images', description: 'Show image records returned through ComfyUI UI data.', sample: [] },
  { kind: 'audio', label: 'Audio', key: 'audio', description: 'Show audio records or URLs.', sample: [] },
  { kind: 'video', label: 'Video', key: 'video', description: 'Show video records or URLs.', sample: [] },
  { kind: 'color', label: 'Color', key: 'color', description: 'Show a color swatch and value.', sample: '#75b9ff' },
  { kind: 'chart', label: 'Chart', key: 'chart', description: 'Show chart-like structured values.', sample: [1, 3, 2, 5] },
  { kind: 'mesh', label: '3D / Mesh', key: 'mesh', description: 'Show mesh or 3D preview metadata.', sample: {} },
  { kind: 'file', label: 'File', key: 'files', description: 'Show generated file records or paths.', sample: [] },
  { kind: 'generic', label: 'Generic', key: 'value', description: 'Show any JSON-serializable UI value.', sample: null },
  { kind: 'custom', label: 'Custom Renderer', key: 'custom', description: 'Create an editable JavaScript renderer for this node.', sample: { value: 'custom' } },
]

export function returnUiItemForKind(kind: UiOutputKind): ReturnUiPaletteItem {
  return RETURN_UI_ITEMS.find(item => item.kind === kind) ?? RETURN_UI_ITEMS[0]
}
