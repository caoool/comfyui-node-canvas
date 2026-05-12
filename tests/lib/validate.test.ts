import { validateNode, validateProject } from '../../src/lib/validate'
import type { NodeSpec, PortSpec, Project } from '../../src/types/index'

function makeNode(overrides: Partial<NodeSpec> = {}): NodeSpec {
  return {
    id: 'n1',
    name: 'MyNode',
    displayName: 'My Node',
    category: 'custom',
    inputs: [],
    outputs: [],
    widgets: [],
    moduleCode: '',
    code: '',
    useReturnOverrides: true,
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

  it('ignores return override mismatch when overrides are disabled', () => {
    const node = makeNode({
      useReturnOverrides: false,
      returnTypes: ['IMAGE'],
      returnNames: ['a', 'b'],
      outputs: [{ id: 'o1', name: 'image', type: 'IMAGE', optional: false, isWidget: false }],
    })
    const errors = validateNode(node)
    expect(errors.some(e => e.field === 'returnNames')).toBe(false)
  })

  it('detects return override mismatch when overrides are enabled', () => {
    const node = makeNode({
      useReturnOverrides: true,
      returnTypes: ['IMAGE'],
      returnNames: ['a', 'b'],
    })
    const errors = validateNode(node)
    expect(errors.some(e => e.field === 'returnNames')).toBe(true)
  })

  it('requires UI payloads for output nodes with no output ports', () => {
    const node = makeNode({
      isOutputNode: true,
      outputs: [],
      code: 'return (text,)',
    })
    const errors = validateNode(node)
    expect(errors.some(e => e.field === 'code' && e.message.includes('UI payload'))).toBe(true)
  })

  it('allows terminal output nodes that return UI payloads', () => {
    const node = makeNode({
      isOutputNode: true,
      outputs: [],
      code: 'return {"ui": {"text": (text,)}}',
    })
    const errors = validateNode(node)
    expect(errors.some(e => e.field === 'code')).toBe(false)
  })

  it('returns multiple errors for multiple violations', () => {
    const node = makeNode({ name: '', displayName: '' })
    const errors = validateNode(node)
    expect(errors.length).toBeGreaterThanOrEqual(2)
  })
})

describe('validateProject', () => {
  function makeProject(nodes: NodeSpec[]): Project {
    return { name: 'Pack', nodes, comfyuiUrl: '', comfyuiInstallPath: '' }
  }

  it('detects duplicate node class names before deploy', () => {
    const errors = validateProject(makeProject([
      makeNode({ id: 'a', name: 'SameNode' }),
      makeNode({ id: 'b', name: 'SameNode' }),
    ]))
    expect(errors.some(e => e.message.includes('Duplicate node class name'))).toBe(true)
  })

  it('includes node-level validation errors', () => {
    const errors = validateProject(makeProject([makeNode({ name: '123bad' })]))
    expect(errors.some(e => e.message.includes('must start with'))).toBe(true)
  })
})
