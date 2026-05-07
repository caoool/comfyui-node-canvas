import type { NodeSpec, ValidationError } from '../types/index'

const NAME_FORMAT = /^[A-Za-z][A-Za-z0-9_]*$/
const PORT_NAME_FORMAT = /^[a-z_][a-z0-9_]*$/

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

  // Rule 8: returnTypes/returnNames mismatch
  if (node.returnNames.length > 0 && node.returnTypes.length !== node.returnNames.length) {
    errors.push({
      field: 'returnNames',
      message: 'Return names count must match return types count',
    })
  }

  return errors
}
