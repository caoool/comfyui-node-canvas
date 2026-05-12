import type { NodeSpec, PortSpec, UiOutputSpec } from '../types/index'

const GENERATED_RETURN_COMMENT = '# Generated return. Edit Outputs / Return UI in the contract panel.'
const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/
const ASSIGNMENT_RE = /^\s*([A-Za-z_][A-Za-z0-9_]*(?:\s*,\s*[A-Za-z_][A-Za-z0-9_]*)*)\s*(?::[^=]+)?=(?!=)/
const FOR_RE = /^\s*for\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\b/
const WITH_AS_RE = /\bas\s+([A-Za-z_][A-Za-z0-9_]*)\s*:?$/

function pyString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function cleanExpression(expression: string | undefined, fallback: string): string {
  const trimmed = expression?.trim()
  return trimmed || fallback
}

function tupleExpression(expressions: string[]): string {
  if (expressions.length === 0) return '()'
  if (expressions.length === 1) return `(${expressions[0]},)`
  return `(${expressions.join(', ')})`
}

function uiValueExpression(output: UiOutputSpec): string {
  return `(${cleanExpression(output.expression, output.key)},)`
}

export function buildGeneratedReturnCode(node: NodeSpec): string {
  const resultExpressions = node.outputs.map(output => cleanExpression(output.expression, output.name))
  const uiOutputs = node.uiOutputs ?? []
  const lines = [GENERATED_RETURN_COMMENT]

  if (uiOutputs.length > 0) {
    const uiEntries = uiOutputs
      .map(output => `${pyString(output.key)}: ${uiValueExpression(output)}`)
      .join(', ')
    const uiDict = `{${uiEntries}}`
    if (resultExpressions.length > 0) {
      lines.push(`return {"ui": ${uiDict}, "result": ${tupleExpression(resultExpressions)}}`)
    } else {
      lines.push(`return {"ui": ${uiDict}}`)
    }
    return lines.join('\n')
  }

  lines.push(`return ${tupleExpression(resultExpressions)}`)
  return lines.join('\n')
}

export function extractPythonVariableNames(code: string, inputNames: string[] = []): string[] {
  const names: string[] = []
  const seen = new Set<string>()
  const add = (name: string) => {
    const cleaned = name.trim()
    if (!IDENTIFIER_RE.test(cleaned) || seen.has(cleaned)) return
    seen.add(cleaned)
    names.push(cleaned)
  }

  inputNames.forEach(add)
  for (const rawLine of code.split('\n')) {
    const line = rawLine.split('#')[0] ?? ''
    const assignment = line.match(ASSIGNMENT_RE)
    if (assignment) {
      assignment[1].split(',').forEach(add)
      continue
    }
    const forMatch = line.match(FOR_RE)
    if (forMatch) {
      add(forMatch[1])
      continue
    }
    const withMatch = line.match(WITH_AS_RE)
    if (withMatch) add(withMatch[1])
  }
  return names
}

function splitTopLevelComma(value: string): string[] {
  const result: string[] = []
  let current = ''
  let depth = 0
  let quote: string | null = null
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i]
    const prev = value[i - 1]
    if (quote) {
      current += char
      if (char === quote && prev !== '\\') quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      current += char
      continue
    }
    if (char === '(' || char === '[' || char === '{') depth += 1
    if (char === ')' || char === ']' || char === '}') depth -= 1
    if (char === ',' && depth === 0) {
      const part = current.trim()
      if (part) result.push(part)
      current = ''
      continue
    }
    current += char
  }
  const tail = current.trim()
  if (tail) result.push(tail)
  return result
}

function parseTupleExpressions(value: string): string[] {
  const trimmed = value.trim()
  if (!trimmed.startsWith('(') || !trimmed.endsWith(')')) return []
  return splitTopLevelComma(trimmed.slice(1, -1)).filter(item => item !== '')
}

function parseLegacyReturn(returnExpression: string): { result: string[]; ui: Record<string, string> } {
  const parsed = { result: [] as string[], ui: {} as Record<string, string> }
  const trimmed = returnExpression.trim()
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    parsed.result = parseTupleExpressions(trimmed)
    return parsed
  }

  const resultMatch = trimmed.match(/["']result["']\s*:\s*(\([^{}]*\))/)
  if (resultMatch) parsed.result = parseTupleExpressions(resultMatch[1])

  const uiBlockMatch = trimmed.match(/["']ui["']\s*:\s*\{([^{}]*)\}/)
  if (uiBlockMatch) {
    const entries = splitTopLevelComma(uiBlockMatch[1])
    for (const entry of entries) {
      const match = entry.match(/["']([^"']+)["']\s*:\s*(.+)$/)
      if (!match) continue
      const tupleValues = parseTupleExpressions(match[2])
      parsed.ui[match[1]] = tupleValues[0] ?? match[2].trim()
    }
  }

  return parsed
}

function stripTrailingReturn(code: string): { code: string; returnExpression: string | null } {
  const lines = code.split('\n')
  let index = lines.length - 1
  while (index >= 0 && lines[index].trim() === '') index -= 1
  if (index < 0) return { code, returnExpression: null }

  const line = lines[index]
  const match = line.match(/^\s*return\s+(.+)$/)
  if (!match) return { code, returnExpression: null }

  const nextCode = lines.slice(0, index).join('\n').replace(/\n+$/, '')
  return { code: nextCode, returnExpression: match[1] }
}

function withOutputExpressions(outputs: PortSpec[], expressions: string[]): PortSpec[] {
  return outputs.map((output, index) => ({
    ...output,
    expression: output.expression?.trim() || expressions[index]?.trim() || output.name,
  }))
}

function withUiExpressions(uiOutputs: UiOutputSpec[], expressions: Record<string, string>, fallback: string): UiOutputSpec[] {
  return uiOutputs.map(output => ({
    ...output,
    expression: output.expression?.trim() || expressions[output.key]?.trim() || fallback || output.key,
  }))
}

export function migrateLegacyReturnCode(node: NodeSpec): NodeSpec {
  const stripped = stripTrailingReturn(node.code ?? '')
  const parsed = stripped.returnExpression ? parseLegacyReturn(stripped.returnExpression) : { result: [] as string[], ui: {} as Record<string, string> }
  const outputs = withOutputExpressions(node.outputs, parsed.result)
  const firstOutputExpression = outputs[0]?.expression ?? parsed.result[0] ?? ''
  const uiOutputs = withUiExpressions(node.uiOutputs ?? [], parsed.ui, firstOutputExpression)
  return {
    ...node,
    code: stripped.returnExpression ? stripped.code : node.code,
    outputs,
    uiOutputs,
  }
}

export { GENERATED_RETURN_COMMENT }
