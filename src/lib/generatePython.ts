import type { NodeSpec, PortSpec, WidgetSpec } from '../types/index'

function formatValue(value: unknown): string {
  if (typeof value === 'string') return `"${value}"`
  if (typeof value === 'boolean') return value ? 'true' : 'false'
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
    case 'int': {
      const cfg = widget.config as Record<string, unknown>
      const min = cfg.min
      const max = cfg.max
      const step = cfg.step
      const def = cfg.default
      const entries: string[] = []
      if (def !== undefined) entries.push(`"default": ${formatValue(def)}`)
      if (min !== undefined) entries.push(`"min": ${formatValue(min)}`)
      if (max !== undefined) entries.push(`"max": ${formatValue(max)}`)
      if (step !== undefined) entries.push(`"step": ${formatValue(step)}`)
      const pyType = port.type // FLOAT or INT as specified by port
      return `"${port.name}": ("${pyType}", {${entries.join(', ')}})`
    }
    case 'dropdown': {
      const cfg = widget.config as { options: string[] }
      const options = cfg.options.map(o => `"${o}"`).join(', ')
      const def = formatValue(widget.default)
      return `"${port.name}": ([${options}], {"default": ${def}})`
    }
    case 'text': {
      return `"${port.name}": ("${port.type}", {"multiline": false})`
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
  const returnTypesTuple = formatTuple(node.returnTypes)
  lines.push(`    RETURN_TYPES = ${returnTypesTuple}`)

  // RETURN_NAMES (omit if empty)
  if (node.returnNames.length > 0) {
    const returnNamesTuple = formatTuple(node.returnNames)
    lines.push(`    RETURN_NAMES = ${returnNamesTuple}`)
  }

  lines.push(`    FUNCTION = "execute"`)
  lines.push(`    CATEGORY = "${node.category}"`)
  lines.push(``)

  // execute method signature
  const requiredParams = requiredPorts.map(p => p.name)
  const optionalParams = optionalPorts.map(p => `${p.name}=None`)
  const allParams = ['self', ...requiredParams, ...optionalParams].join(', ')
  lines.push(`    def execute(${allParams}):`)

  // execute method body
  if (node.code.trim() === '') {
    lines.push(`        pass`)
  } else {
    for (const codeLine of node.code.split('\n')) {
      lines.push(codeLine === '' ? '' : `        ${codeLine}`)
    }
  }

  lines.push(``)
  lines.push(`NODE_CLASS_MAPPINGS = {"${className}": ${className}}`)
  lines.push(`NODE_DISPLAY_NAME_MAPPINGS = {"${className}": "${node.displayName}"}`)

  return lines.join('\n')
}
