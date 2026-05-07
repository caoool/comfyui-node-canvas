import { validateNode } from '../../src/lib/validate'
import type { NodeSpec, PortSpec } from '../../src/types/index'

function makeNode(overrides: Partial<NodeSpec> = {}): NodeSpec {
  return {
    id: 'n1',
    name: 'MyNode',
    displayName: 'My Node',
    category: 'custom',
    inputs: [],
    outputs: [],
    widgets: [],
    code: '',
    returnTypes: ['IMAGE'],
    returnNames: ['result'],
    ...overrides,
  }
}

describe('validateNode', () => {
  it('returns empty array for valid node', () => {
    const node = makeNode()
    const errors = validateNode(node)
    expect(errors).toEqual([])
  })

  it('requires node name', () => {
    const node = makeNode({ name: '' })
    const errors = validateNode(node)
    expect(errors.some(e => e.field === 'name')).toBe(true)
  })

  it('validates name format', () => {
    const node = makeNode({ name: '123bad' })
    const errors = validateNode(node)
    const nameError = errors.find(e => e.field === 'name')
    expect(nameError).toBeDefined()
    expect(nameError!.message).toContain('must start with')
  })

  it('requires displayName', () => {
    const node = makeNode({ displayName: '' })
    const errors = validateNode(node)
    expect(errors.some(e => e.field === 'displayName')).toBe(true)
  })

  it('requires category (whitespace-only is invalid)', () => {
    const node = makeNode({ category: '   ' })
    const errors = validateNode(node)
    expect(errors.some(e => e.field === 'category')).toBe(true)
  })

  it('detects duplicate input names', () => {
    const inputs: PortSpec[] = [
      { id: 'p1', name: 'image', type: 'IMAGE', optional: false, isWidget: false },
      { id: 'p2', name: 'image', type: 'IMAGE', optional: false, isWidget: false },
    ]
    const node = makeNode({ inputs })
    const errors = validateNode(node)
    const dupError = errors.find(e => e.field === 'inputs')
    expect(dupError).toBeDefined()
    expect(dupError!.message).toContain('Duplicate')
  })

  it('validates port name format (snake_case required)', () => {
    const inputs: PortSpec[] = [
      { id: 'p1', name: 'BadName', type: 'IMAGE', optional: false, isWidget: false },
    ]
    const node = makeNode({ inputs })
    const errors = validateNode(node)
    const fmtError = errors.find(e => e.field === 'inputs')
    expect(fmtError).toBeDefined()
    expect(fmtError!.message).toContain('Invalid port name')
  })

  it('detects returnTypes/returnNames length mismatch', () => {
    const node = makeNode({ returnTypes: ['IMAGE'], returnNames: ['a', 'b'] })
    const errors = validateNode(node)
    expect(errors.some(e => e.field === 'returnNames')).toBe(true)
  })

  it('returns multiple errors for multiple violations', () => {
    const node = makeNode({ name: '', displayName: '' })
    const errors = validateNode(node)
    expect(errors.length).toBeGreaterThanOrEqual(2)
  })
})
