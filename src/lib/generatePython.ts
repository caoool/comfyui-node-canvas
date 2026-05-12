import type { NodeSpec, PortSpec, WidgetSpec } from '../types/index'
import { buildGeneratedReturnCode } from './returnCode'

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return 'None'
  if (typeof value === 'string') return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  if (typeof value === 'boolean') return value ? 'True' : 'False'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'None'
  if (Array.isArray(value)) return `[${value.map(formatValue).join(', ')}]`
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${formatValue(k)}: ${formatValue(v)}`)
    return `{${entries.join(', ')}}`
  }
  return String(value)
}

function formatTuple(items: string[]): string {
  if (items.length === 0) return '()'
  if (items.length === 1) return `("${items[0]}",)`
  return `("${items.join('", "')}")`
}

function formatPortEntry(port: PortSpec, widget: WidgetSpec | undefined): string {
  if (!widget) {
    return `"${port.name}": ("${port.type}",)`
  }

  switch (widget.widgetType) {
    case 'slider':
    case 'number':
    case 'int':
    case 'seed': {
      const cfg = widget.config as Record<string, unknown>
      const entries: string[] = []
      if (widget.default !== undefined) entries.push(`"default": ${formatValue(widget.default)}`)
      for (const [key, value] of Object.entries(cfg)) {
        if (value !== undefined && key !== 'default') entries.push(`"${key}": ${formatValue(value)}`)
      }
      return `"${port.name}": ("${port.type}", {${entries.join(', ')}})`
    }
    case 'dropdown':
    case 'dynamic_combo': {
      const cfg = widget.config as { options?: string[] }
      const options = (cfg.options ?? []).map(o => formatValue(o)).join(', ')
      const def = formatValue(widget.default)
      return `"${port.name}": ([${options}], {"default": ${def}})`
    }
    case 'text':
    case 'multiline':
    case 'json':
    case 'file':
    case 'image_upload':
    case 'video_upload':
    case 'audio_upload':
    case 'color':
    case 'autogrow':
    case 'matchtype':
    case 'bounding_box':
    case 'curve':
    case 'list': {
      const cfg = { ...widget.config }
      if (widget.widgetType === 'text' && cfg.multiline === undefined) cfg.multiline = false
      if (widget.widgetType === 'multiline' && cfg.multiline === undefined) cfg.multiline = true
      if (widget.default !== undefined) cfg.default = widget.default
      return `"${port.name}": ("${port.type}", ${formatValue(cfg)})`
    }
    case 'bool': {
      return `"${port.name}": ("BOOLEAN", {"default": ${formatValue(widget.default)}})`
    }
    default:
      return `"${port.name}": ("${port.type}",)`
  }
}

export function generatePython(node: NodeSpec): string {
  const lines: string[] = []

  const className = node.name
  const moduleCode = node.moduleCode?.trim()
  if (moduleCode) {
    lines.push(moduleCode)
    lines.push(``)
  }

  // Build widget lookup by portId
  const widgetByPortId = new Map<string, WidgetSpec>()
  for (const w of node.widgets) {
    widgetByPortId.set(w.portId, w)
  }

  // Classify inputs
  const requiredPorts: PortSpec[] = []
  const optionalPorts: PortSpec[] = []
  for (const port of node.inputs) {
    if (port.optional && !port.isWidget) {
      optionalPorts.push(port)
    } else {
      requiredPorts.push(port)
    }
  }

  // Build INPUT_TYPES
  lines.push(`class ${className}:`)
  lines.push(`    @classmethod`)
  lines.push(`    def INPUT_TYPES(cls):`)
  lines.push(`        return {`)

  // required section
  if (requiredPorts.length === 0) {
    lines.push(`            "required": {},`)
  } else {
    lines.push(`            "required": {`)
    for (const port of requiredPorts) {
      const widget = port.isWidget ? widgetByPortId.get(port.id) : undefined
      // If isWidget is true but no widget found in map, treat as plain port
      const resolvedWidget = port.isWidget && widget === undefined ? undefined : widget
      lines.push(`                ${formatPortEntry(port, resolvedWidget)},`)
    }
    lines.push(`            },`)
  }

  // optional section
  if (optionalPorts.length > 0) {
    lines.push(`            "optional": {`)
    for (const port of optionalPorts) {
      lines.push(`                ${formatPortEntry(port, undefined)},`)
    }
    lines.push(`            }`)
  }

  lines.push(`        }`)
  lines.push(``)

  // RETURN_TYPES
  const returnTypes = node.useReturnOverrides ? node.returnTypes : node.outputs.map(p => p.type)
  const returnNames = node.useReturnOverrides ? node.returnNames : node.outputs.map(p => p.name)
  const returnTypesTuple = formatTuple(returnTypes)
  lines.push(`    RETURN_TYPES = ${returnTypesTuple}`)

  // RETURN_NAMES (omit if empty)
  if (returnNames.length > 0) {
    const returnNamesTuple = formatTuple(returnNames)
    lines.push(`    RETURN_NAMES = ${returnNamesTuple}`)
  }

  lines.push(`    FUNCTION = "execute"`)
  lines.push(`    CATEGORY = "${node.category}"`)
  if (node.isOutputNode) {
    lines.push(`    OUTPUT_NODE = True`)
  }
  lines.push(``)

  // execute method signature
  const requiredParams = requiredPorts.map(p => p.name)
  const optionalParams = optionalPorts.map(p => `${p.name}=None`)
  const allParams = ['self', ...requiredParams, ...optionalParams].join(', ')
  lines.push(`    def execute(${allParams}):`)

  // execute method body
  if (node.code.trim() !== '') {
    for (const codeLine of node.code.split('\n')) {
      lines.push(codeLine === '' ? '' : `        ${codeLine}`)
    }
  }
  for (const returnLine of buildGeneratedReturnCode(node).split('\n')) {
    lines.push(`        ${returnLine}`)
  }

  lines.push(``)
  lines.push(`NODE_CLASS_MAPPINGS = {"${className}": ${className}}`)
  lines.push(`NODE_DISPLAY_NAME_MAPPINGS = {"${className}": "${node.displayName}"}`)

  return lines.join('\n')
}
