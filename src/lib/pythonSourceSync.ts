import { generatePython } from './generatePython'
import type { LintSeverity } from './lintPython'
import type { NodeSpec, PortSpec, WidgetKind, WidgetSpec } from '../types/index'

export interface PythonSourceSyncIssue {
  line: number
  startCol: number
  endCol: number
  severity: LintSeverity
  message: string
}

export interface PythonSourceSyncResult {
  patch: Partial<NodeSpec>
  issues: PythonSourceSyncIssue[]
}

export interface PythonSourcePatchResult {
  text: string
  issues: PythonSourceSyncIssue[]
}

type IdFactory = () => string

interface ParsedClass {
  name: string
  index: number
  line: number
}

interface ParsedInput {
  name: string
  type: string
  optional: boolean
  isWidget: boolean
  widgetType: WidgetKind | null
  default: unknown
  config: Record<string, unknown>
}

interface SourceSections {
  moduleCode: string
  code: string | null
  missingExecute: boolean
}

function issue(message: string, line = 1, startCol = 1, severity: LintSeverity = 'error'): PythonSourceSyncIssue {
  return {
    line,
    startCol,
    endCol: startCol + 1,
    severity,
    message,
  }
}

function lineForOffset(text: string, offset: number): number {
  return text.slice(0, Math.max(0, offset)).split('\n').length
}

function findClass(text: string): ParsedClass | null {
  const match = /^class\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:\([^)]*\))?\s*:/m.exec(text)
  if (!match || match.index === undefined) return null
  return {
    name: match[1],
    index: match.index,
    line: lineForOffset(text, match.index),
  }
}

function parseAssignmentLine(text: string, name: string): { value: string; line: number } | null {
  const lines = text.split('\n')
  const re = new RegExp(`^\\s*${name}\\s*=\\s*(.+?)\\s*$`)
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(re)
    if (match) return { value: match[1], line: i + 1 }
  }
  return null
}

function decodePythonString(raw: string): string {
  return raw.replace(/\\(["'\\nrt])/g, (_whole, escaped: string) => {
    if (escaped === 'n') return '\n'
    if (escaped === 'r') return '\r'
    if (escaped === 't') return '\t'
    return escaped
  })
}

function quotedStrings(value: string): string[] {
  const strings: string[] = []
  const re = /(["'])((?:\\.|(?!\1).)*)\1/g
  let match: RegExpExecArray | null = null
  while ((match = re.exec(value)) !== null) {
    strings.push(decodePythonString(match[2]))
  }
  return strings
}

function parseStringTupleAssignment(text: string, name: string): { values: string[]; line: number } | null {
  const assignment = parseAssignmentLine(text, name)
  if (!assignment) return null
  const trimmed = assignment.value.trim()
  if (trimmed === '()') return { values: [], line: assignment.line }
  return { values: quotedStrings(trimmed), line: assignment.line }
}

function parseDisplayName(text: string, fallback: string): string {
  const assignment = parseAssignmentLine(text, 'NODE_DISPLAY_NAME_MAPPINGS')
  if (!assignment) return fallback
  const strings = quotedStrings(assignment.value)
  return strings[1] ?? fallback
}

function parseCategory(text: string, fallback: string): string {
  const assignment = parseAssignmentLine(text, 'CATEGORY')
  if (!assignment) return fallback
  return quotedStrings(assignment.value)[0] ?? fallback
}

function parseOutputNodeFlag(text: string): boolean {
  const assignment = parseAssignmentLine(text, 'OUTPUT_NODE')
  return assignment?.value.trim() === 'True'
}

function firstTupleString(value: string): string | null {
  return value.match(/^\(\s*(["'])(.*?)\1/)?.[2] ?? null
}

function parseDefaultValue(value: string): unknown {
  const defaultMatch = value.match(/["']default["']\s*:\s*([^,}]+)/)
  if (!defaultMatch) return undefined
  const raw = defaultMatch[1].trim()
  if (raw === 'True') return true
  if (raw === 'False') return false
  if (raw === 'None') return null
  const quoted = quotedStrings(raw)
  if (quoted.length > 0) return quoted[0]
  const numberValue = Number(raw)
  return Number.isFinite(numberValue) ? numberValue : raw
}

function inferWidgetType(value: string, type: string, existing?: WidgetSpec): WidgetKind {
  if (existing) return existing.widgetType
  if (/^\(\s*\[/.test(value)) return 'dropdown'
  if (type === 'BOOLEAN') return 'bool'
  if (type === 'INT') return 'int'
  if (type === 'FLOAT') return 'number'
  if (type === 'STRING' && /["']multiline["']\s*:\s*True/.test(value)) return 'multiline'
  if (type === 'STRING') return 'text'
  return 'text'
}

function inferPortType(value: string, existing?: PortSpec): string {
  const directType = firstTupleString(value)
  if (directType) return directType
  if (/^\(\s*\[/.test(value)) return existing?.type ?? 'COMBO'
  return existing?.type ?? 'CUSTOM'
}

function inferConfig(value: string, widgetType: WidgetKind): Record<string, unknown> {
  const config: Record<string, unknown> = {}
  if (widgetType === 'multiline' || /["']multiline["']\s*:\s*True/.test(value)) config.multiline = true
  if (/["']dynamicPrompts["']\s*:\s*False/.test(value)) config.dynamicPrompts = false
  const min = value.match(/["']min["']\s*:\s*([0-9.-]+)/)
  const max = value.match(/["']max["']\s*:\s*([0-9.-]+)/)
  const step = value.match(/["']step["']\s*:\s*([0-9.-]+)/)
  if (min) config.min = Number(min[1])
  if (max) config.max = Number(max[1])
  if (step) config.step = Number(step[1])
  return config
}

function parseInputSection(
  text: string,
  section: 'required' | 'optional',
  current: NodeSpec,
): { inputs: ParsedInput[]; found: boolean } {
  const currentByName = new Map(current.inputs.map(input => [input.name, input]))
  const widgetByPortId = new Map(current.widgets.map(widget => [widget.portId, widget]))
  const inputs: ParsedInput[] = []
  const lines = text.split('\n')
  let inSection = false
  let found = false

  for (const line of lines) {
    if (!inSection) {
      const emptySection = new RegExp(`["']${section}["']\\s*:\\s*\\{\\s*\\}`).test(line)
      if (emptySection) {
        found = true
        break
      }
      if (new RegExp(`["']${section}["']\\s*:\\s*\\{`).test(line)) {
        found = true
        inSection = true
      }
      continue
    }
    if (/^\s*}\s*,?\s*$/.test(line)) break
    const match = line.match(/^\s*["']([^"']+)["']\s*:\s*(.+?)\s*,?\s*$/)
    if (!match) continue
    const name = match[1]
    const value = match[2]
    const existing = currentByName.get(name)
    const existingWidget = existing ? widgetByPortId.get(existing.id) : undefined
    const type = inferPortType(value, existing)
    const isWidget = existing?.isWidget === true || /,\s*\{/.test(value) || /^\(\s*\[/.test(value)
    const widgetType = isWidget ? inferWidgetType(value, type, existingWidget) : null
    inputs.push({
      name,
      type,
      optional: section === 'optional',
      isWidget,
      widgetType,
      default: isWidget ? parseDefaultValue(value) : undefined,
      config: widgetType ? inferConfig(value, widgetType) : {},
    })
  }

  return { inputs, found }
}

function buildInputsAndWidgets(
  parsedInputs: ParsedInput[],
  current: NodeSpec,
  idFactory: IdFactory,
): { inputs: PortSpec[]; widgets: WidgetSpec[] } {
  const currentInputByName = new Map(current.inputs.map(input => [input.name, input]))
  const currentWidgetByPortId = new Map(current.widgets.map(widget => [widget.portId, widget]))
  const inputs: PortSpec[] = []
  const widgets: WidgetSpec[] = []

  for (const parsed of parsedInputs) {
    const existingInput = currentInputByName.get(parsed.name)
    const existingWidget = existingInput ? currentWidgetByPortId.get(existingInput.id) : undefined
    const port: PortSpec = {
      id: existingInput?.id ?? idFactory(),
      name: parsed.name,
      type: parsed.type,
      optional: parsed.optional && !parsed.isWidget,
      isWidget: parsed.isWidget,
      expression: existingInput?.expression,
    }
    inputs.push(port)
    if (parsed.isWidget && parsed.widgetType) {
      widgets.push({
        id: existingWidget?.id ?? idFactory(),
        portId: port.id,
        widgetType: parsed.widgetType,
        default: parsed.default ?? existingWidget?.default ?? '',
        config: { ...(existingWidget?.config ?? {}), ...parsed.config },
      })
    }
  }

  return { inputs, widgets }
}

function parseInputs(text: string, current: NodeSpec, idFactory: IdFactory): { inputs: PortSpec[]; widgets: WidgetSpec[]; found: boolean } {
  const required = parseInputSection(text, 'required', current)
  const optional = parseInputSection(text, 'optional', current)
  const parsedInputs = [...required.inputs, ...optional.inputs]
  return {
    ...buildInputsAndWidgets(parsedInputs, current, idFactory),
    found: required.found,
  }
}

function parseOutputs(text: string, current: NodeSpec, idFactory: IdFactory): { outputs: PortSpec[]; found: boolean } {
  const types = parseStringTupleAssignment(text, 'RETURN_TYPES')
  if (!types) return { outputs: current.outputs, found: false }
  const names = parseStringTupleAssignment(text, 'RETURN_NAMES')?.values ?? []
  const outputByName = new Map(current.outputs.map(output => [output.name, output]))
  const outputs = types.values.map((type, index): PortSpec => {
    const name = names[index] ?? current.outputs[index]?.name ?? (index === 0 ? 'output' : `output_${index + 1}`)
    const existing = outputByName.get(name) ?? current.outputs[index]
    return {
      id: existing?.id ?? idFactory(),
      name,
      type,
      optional: false,
      isWidget: false,
      expression: existing?.expression ?? name,
    }
  })
  return { outputs, found: true }
}

function extractSections(text: string, parsedClass: ParsedClass): SourceSections {
  const moduleCode = text.slice(0, parsedClass.index).replace(/\n{2,}$/, '')
  const lines = text.split('\n')
  const executeLine = lines.findIndex(line => /^\s{4}def\s+execute\s*\(/.test(line))
  if (executeLine < 0) {
    return { moduleCode, code: null, missingExecute: true }
  }

  const body: string[] = []
  for (let i = executeLine + 1; i < lines.length; i += 1) {
    const line = lines[i]
    if (line.trim() === '') {
      body.push('')
      continue
    }
    if (!line.startsWith('        ')) break
    const unindented = line.slice(8)
    if (unindented.trim().startsWith('# Generated return')) break
    body.push(unindented)
  }

  while (body.length > 0 && body[body.length - 1].trim() === '') body.pop()
  return { moduleCode, code: body.join('\n'), missingExecute: false }
}

export function syncNodeFromPythonSource(
  source: string,
  current: NodeSpec,
  idFactory: IdFactory,
): PythonSourceSyncResult {
  const issues: PythonSourceSyncIssue[] = []
  const patch: Partial<NodeSpec> = { pythonSource: source }
  const parsedClass = findClass(source)
  if (!parsedClass) {
    issues.push(issue('Cannot sync node preview: no Python class declaration was found.'))
    return { patch, issues }
  }

  const inputs = parseInputs(source, current, idFactory)
  if (!inputs.found) {
    issues.push(issue('Cannot sync inputs: INPUT_TYPES required section was not found.', parsedClass.line))
  }
  const outputs = parseOutputs(source, current, idFactory)
  if (!outputs.found) {
    issues.push(issue('Cannot sync outputs: RETURN_TYPES was not found.', parsedClass.line))
  }
  const sections = extractSections(source, parsedClass)
  if (sections.missingExecute) {
    issues.push(issue('Cannot sync execute body: def execute(...) was not found.', parsedClass.line))
  }

  const syncedPatch: Partial<NodeSpec> = {
    ...patch,
    name: parsedClass.name,
    displayName: parseDisplayName(source, current.displayName),
    category: parseCategory(source, current.category),
    isOutputNode: parseOutputNodeFlag(source),
    moduleCode: sections.moduleCode,
    code: sections.code ?? current.code,
  }
  if (inputs.found) {
    syncedPatch.inputs = inputs.inputs
    syncedPatch.widgets = inputs.widgets
  }
  if (outputs.found) syncedPatch.outputs = outputs.outputs

  return { patch: syncedPatch, issues }
}

export function patchPythonSourceFromNode(
  source: string,
  current: NodeSpec,
  next: NodeSpec,
): PythonSourcePatchResult {
  const issues: PythonSourceSyncIssue[] = []
  const parsedClass = findClass(source)
  if (!parsedClass) {
    issues.push(issue('Cannot update Python source from node preview: no Python class declaration was found.'))
    return { text: source, issues }
  }
  const sections = extractSections(source, parsedClass)
  if (sections.missingExecute) {
    issues.push(issue('Cannot update Python source from node preview: def execute(...) was not found.', parsedClass.line))
    return { text: source, issues }
  }

  const moduleCode = next.moduleCode !== current.moduleCode ? next.moduleCode : sections.moduleCode
  const code = next.code !== current.code ? next.code : sections.code ?? next.code
  return {
    text: generatePython({ ...next, moduleCode, code }),
    issues,
  }
}
