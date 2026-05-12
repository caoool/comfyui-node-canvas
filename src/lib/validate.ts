import type { NodeSpec, Project, ValidationError } from '../types/index'

const NAME_FORMAT = /^[A-Za-z][A-Za-z0-9_]*$/
const PORT_NAME_FORMAT = /^[a-z_][a-z0-9_]*$/
const UI_RETURN_PATTERN = /["']ui["']\s*:/
const TUPLE_RETURN_PATTERN = /\breturn\s*\(/

export function validateNode(node: NodeSpec): ValidationError[] {
  const errors: ValidationError[] = []

  // Rule 1: name required
  if (!node.name || node.name.trim() === '') {
    errors.push({ field: 'name', message: 'Node name is required' })
  } else if (!NAME_FORMAT.test(node.name)) {
    // Rule 2: name format (only checked when non-empty)
    errors.push({
      field: 'name',
      message: 'Node name must start with a letter and contain only letters, numbers, underscores',
    })
  }

  // Rule 3: displayName required
  if (!node.displayName || node.displayName.trim() === '') {
    errors.push({ field: 'displayName', message: 'Display name is required' })
  }

  // Rule 4: category required
  if (!node.category || node.category.trim() === '') {
    errors.push({ field: 'category', message: 'Category is required' })
  }

  // Rule 5: duplicate input names
  const inputNames = new Set<string>()
  for (const port of node.inputs) {
    if (inputNames.has(port.name)) {
      errors.push({ field: 'inputs', message: `Duplicate input name: ${port.name}` })
    } else {
      inputNames.add(port.name)
    }
  }

  // Rule 6: duplicate output names
  const outputNames = new Set<string>()
  for (const port of node.outputs) {
    if (outputNames.has(port.name)) {
      errors.push({ field: 'outputs', message: `Duplicate output name: ${port.name}` })
    } else {
      outputNames.add(port.name)
    }
  }

  // Rule 7: port name format (inputs)
  for (const port of node.inputs) {
    if (!PORT_NAME_FORMAT.test(port.name)) {
      errors.push({ field: 'inputs', message: `Invalid port name: ${port.name}` })
    }
  }

  // Rule 7: port name format (outputs)
  for (const port of node.outputs) {
    if (!PORT_NAME_FORMAT.test(port.name)) {
      errors.push({ field: 'outputs', message: `Invalid port name: ${port.name}` })
    }
  }

  // Rule 8: returnTypes/returnNames mismatch in advanced override mode
  if (node.useReturnOverrides && node.returnNames.length > 0 && node.returnTypes.length !== node.returnNames.length) {
    errors.push({
      field: 'returnNames',
      message: 'Return names count must match return types count',
    })
  }

  if (
    node.isOutputNode &&
    node.outputs.length === 0 &&
    TUPLE_RETURN_PATTERN.test(node.code) &&
    !UI_RETURN_PATTERN.test(node.code)
  ) {
    errors.push({
      field: 'code',
      message: 'Output nodes without output ports cannot use tuple-only returns; return a ComfyUI UI payload, e.g. return {"ui": {"text": (value,)}}',
    })
  }

  return errors
}

export function validateProject(project: Project): ValidationError[] {
  const errors: ValidationError[] = []
  const nodeNames = new Map<string, string>()
  const fileNames = new Map<string, string>()

  for (const node of project.nodes) {
    for (const error of validateNode(node)) {
      errors.push({ field: `${node.name || node.id}.${error.field}`, message: error.message })
    }

    const nameKey = node.name.trim()
    if (nameKey) {
      const existing = nodeNames.get(nameKey)
      if (existing) {
        errors.push({ field: 'nodes', message: `Duplicate node class name: ${nameKey}` })
      } else {
        nodeNames.set(nameKey, node.id)
      }
    }

    const filename = `${nameKey}.py`
    const existingFile = fileNames.get(filename)
    if (nameKey && existingFile) {
      errors.push({ field: 'nodes', message: `Duplicate generated filename: ${filename}` })
    } else if (nameKey) {
      fileNames.set(filename, node.id)
    }
  }

  return errors
}
