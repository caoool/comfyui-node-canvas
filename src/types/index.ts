export interface WidgetSpec {
  id: string
  portId: string
  widgetType: 'slider' | 'dropdown' | 'text' | 'int' | 'bool'
  default: unknown
  config: Record<string, unknown>
}

export interface PortSpec {
  id: string
  name: string
  type: string
  optional: boolean
  isWidget: boolean
}

export interface NodeSpec {
  id: string
  name: string
  displayName: string
  category: string
  inputs: PortSpec[]
  outputs: PortSpec[]
  widgets: WidgetSpec[]
  code: string
  returnTypes: string[]
  returnNames: string[]
}

export interface Project {
  name: string
  nodes: NodeSpec[]
  comfyuiUrl: string
  comfyuiInstallPath: string
}

export interface ValidationError {
  field: string
  message: string
}

export type SelectedItem =
  | { kind: 'node' }
  | { kind: 'port'; portId: string; zone: 'inputs' | 'outputs' }
  | { kind: 'widget'; widgetId: string }
  | null

export interface PaletteItem {
  label: string
  name: string
  type: string
  isWidget: boolean
  widgetType: WidgetSpec['widgetType'] | null
}
