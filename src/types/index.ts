export interface WidgetSpec {
  id: string
  portId: string
  widgetType: WidgetKind
  default: unknown
  config: Record<string, unknown>
}

export type WidgetKind =
  | 'slider'
  | 'number'
  | 'int'
  | 'seed'
  | 'dropdown'
  | 'dynamic_combo'
  | 'text'
  | 'multiline'
  | 'bool'
  | 'color'
  | 'file'
  | 'image_upload'
  | 'video_upload'
  | 'audio_upload'
  | 'autogrow'
  | 'matchtype'
  | 'bounding_box'
  | 'curve'
  | 'json'
  | 'list'

export interface PortSpec {
  id: string
  name: string
  type: string
  optional: boolean
  isWidget: boolean
  expression?: string
}

export type UiOutputKind =
  | 'text'
  | 'markdown'
  | 'json'
  | 'list'
  | 'table'
  | 'image'
  | 'audio'
  | 'video'
  | 'color'
  | 'chart'
  | 'mesh'
  | 'file'
  | 'generic'
  | 'custom'

export interface UiOutputSpec {
  id: string
  key: string
  kind: UiOutputKind
  label: string
  expression?: string
  sample?: unknown
}

export interface CustomNodeFileSpec {
  id: string
  relativePath: string
  content: string
}

export interface CustomNodeDirectorySpec {
  id: string
  relativePath: string
}

export interface NodeSpec {
  id: string
  name: string
  displayName: string
  category: string
  isOutputNode?: boolean
  inputs: PortSpec[]
  outputs: PortSpec[]
  widgets: WidgetSpec[]
  uiOutputs?: UiOutputSpec[]
  moduleCode: string
  code: string
  pythonSource?: string
  pythonRequirements?: string[]
  pythonInstallScript?: string
  customUiRendererCode?: string
  customFiles?: CustomNodeFileSpec[]
  useReturnOverrides: boolean
  returnTypes: string[]
  returnNames: string[]
}

export interface Project {
  id?: string
  name: string
  packFolderName?: string
  nodes: NodeSpec[]
  comfyuiUrl: string
  comfyuiInstallPath: string
  pythonRequirements?: string[]
  pythonInstallScript?: string
  customFiles?: CustomNodeFileSpec[]
  customDirectories?: CustomNodeDirectorySpec[]
}

export interface ValidationError {
  field: string
  message: string
}

export type SelectedItem =
  | { kind: 'node' }
  | { kind: 'port'; portId: string; zone: 'inputs' | 'outputs' }
  | { kind: 'widget'; widgetId: string }
  | { kind: 'uiOutput'; uiOutputId: string }
  | null

export interface PaletteItem {
  label: string
  name: string
  type: string
  isWidget: boolean
  widgetType: WidgetSpec['widgetType'] | null
  group?: string
  description?: string
  default?: unknown
  config?: Record<string, unknown>
}
