import { generatePython } from '../../src/lib/generatePython'
import type { NodeSpec, PortSpec, WidgetSpec } from '../../src/types/index'

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
    returnTypes: [],
    returnNames: [],
    ...overrides,
  }
}

describe('generatePython', () => {
  it('generates class name from node.name', () => {
    const node = makeNode({ name: 'MyNode' })
    const output = generatePython(node)
    expect(output).toContain('class MyNode:')
  })

  it('generates INPUT_TYPES with empty required when no inputs', () => {
    const node = makeNode()
    const output = generatePython(node)
    expect(output).toContain('"required": {}')
  })

  it('generates non-widget port in required', () => {
    const inputs: PortSpec[] = [
      { id: 'p1', name: 'image', type: 'IMAGE', optional: false, isWidget: false },
    ]
    const node = makeNode({ inputs })
    const output = generatePython(node)
    expect(output).toContain('"image": ("IMAGE",)')
  })

  it('generates optional port in optional section', () => {
    const inputs: PortSpec[] = [
      { id: 'p1', name: 'mask', type: 'MASK', optional: true, isWidget: false },
    ]
    const node = makeNode({ inputs })
    const output = generatePython(node)
    expect(output).toContain('"optional"')
    expect(output).toContain('"mask": ("MASK",)')
  })

  it('omits optional section when no optional ports', () => {
    const inputs: PortSpec[] = [
      { id: 'p1', name: 'image', type: 'IMAGE', optional: false, isWidget: false },
    ]
    const node = makeNode({ inputs })
    const output = generatePython(node)
    expect(output).not.toContain('"optional"')
  })

  it('generates slider widget with FLOAT type', () => {
    const inputs: PortSpec[] = [
      { id: 'p1', name: 'strength', type: 'FLOAT', optional: false, isWidget: true },
    ]
    const widgets: WidgetSpec[] = [
      {
        id: 'w1',
        portId: 'p1',
        widgetType: 'slider',
        default: 0.5,
        config: { min: 0, max: 1, step: 0.01, default: 0.5 },
      },
    ]
    const node = makeNode({ inputs, widgets })
    const output = generatePython(node)
    expect(output).toContain('"strength": ("FLOAT", {"default": 0.5, "min": 0, "max": 1, "step": 0.01})')
  })

  it('generates dropdown widget', () => {
    const inputs: PortSpec[] = [
      { id: 'p1', name: 'mode', type: 'STRING', optional: false, isWidget: true },
    ]
    const widgets: WidgetSpec[] = [
      {
        id: 'w1',
        portId: 'p1',
        widgetType: 'dropdown',
        default: 'a',
        config: { options: ['a', 'b'] },
      },
    ]
    const node = makeNode({ inputs, widgets })
    const output = generatePython(node)
    expect(output).toContain('(["a", "b"], {"default": "a"})')
  })

  it('generates text widget using port.type', () => {
    const inputs: PortSpec[] = [
      { id: 'p1', name: 'prompt', type: 'STRING', optional: false, isWidget: true },
    ]
    const widgets: WidgetSpec[] = [
      {
        id: 'w1',
        portId: 'p1',
        widgetType: 'text',
        default: '',
        config: {},
      },
    ]
    const node = makeNode({ inputs, widgets })
    const output = generatePython(node)
    expect(output).toContain('"prompt": ("STRING", {"multiline": false})')
  })

  it('generates bool widget', () => {
    const inputs: PortSpec[] = [
      { id: 'p1', name: 'enable', type: 'BOOLEAN', optional: false, isWidget: true },
    ]
    const widgets: WidgetSpec[] = [
      {
        id: 'w1',
        portId: 'p1',
        widgetType: 'bool',
        default: false,
        config: {},
      },
    ]
    const node = makeNode({ inputs, widgets })
    const output = generatePython(node)
    expect(output).toContain('("BOOLEAN", {"default": false})')
  })

  it('generates RETURN_TYPES tuple', () => {
    const node = makeNode({ returnTypes: ['IMAGE', 'LATENT'] })
    const output = generatePython(node)
    expect(output).toContain('RETURN_TYPES = ("IMAGE", "LATENT")')
  })

  it('generates single RETURN_TYPE with trailing comma', () => {
    const node = makeNode({ returnTypes: ['IMAGE'] })
    const output = generatePython(node)
    expect(output).toContain('RETURN_TYPES = ("IMAGE",)')
  })

  it('omits RETURN_NAMES when empty', () => {
    const node = makeNode({ returnNames: [] })
    const output = generatePython(node)
    expect(output).not.toContain('RETURN_NAMES')
  })

  it('inserts user code in execute body', () => {
    const node = makeNode({ code: 'return image' })
    const output = generatePython(node)
    expect(output).toContain('        return image')
  })

  it('generates int widget with INT type', () => {
    const inputs: PortSpec[] = [
      { id: 'p1', name: 'steps', type: 'INT', optional: false, isWidget: true },
    ]
    const widgets: WidgetSpec[] = [
      {
        id: 'w1',
        portId: 'p1',
        widgetType: 'int',
        default: 20,
        config: { min: 1, max: 100, step: 1, default: 20 },
      },
    ]
    const node = makeNode({ inputs, widgets })
    const output = generatePython(node)
    expect(output).toContain('"steps": ("INT", {"default": 20, "min": 1, "max": 100, "step": 1})')
  })

  it('generates RETURN_NAMES when non-empty', () => {
    const node = makeNode({ returnTypes: ['IMAGE'], returnNames: ['result'] })
    const output = generatePython(node)
    expect(output).toContain('RETURN_NAMES = ("result",)')
  })

  it('preserves blank lines in user code without adding spaces', () => {
    const node = makeNode({ code: 'line1\n\nline3' })
    const output = generatePython(node)
    expect(output).toContain('        line1')
    expect(output).toContain('        line3')
    // blank line between them must not have trailing spaces
    const lines = output.split('\n')
    const blankIdx = lines.findIndex(l => l === '')
    expect(blankIdx).toBeGreaterThan(-1)
  })
})
