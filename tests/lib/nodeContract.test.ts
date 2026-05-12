import { describe, expect, it } from 'vitest'
import type { NodeSpec, PaletteItem } from '../../src/types/index'
import {
  addCustomPortToNode,
  addPalettePortToNode,
  addUiOutputToNode,
  removePortFromNode,
  removeUiOutputFromNode,
} from '../../src/lib/nodeContract'

function node(overrides: Partial<NodeSpec> = {}): NodeSpec {
  return {
    id: 'node-1',
    name: 'TestNode',
    displayName: 'Test Node',
    category: 'ComfyUINodeBuilder',
    inputs: [],
    outputs: [],
    widgets: [],
    uiOutputs: [],
    moduleCode: '',
    code: '',
    useReturnOverrides: false,
    returnTypes: [],
    returnNames: [],
    ...overrides,
  }
}

function ids(...values: string[]) {
  let index = 0
  return () => values[index++] ?? `id-${index}`
}

describe('node contract mutations', () => {
  it('adds a widget input and creates its widget config', () => {
    const item: PaletteItem = {
      label: 'Float Slider',
      name: 'strength',
      type: 'FLOAT',
      isWidget: true,
      widgetType: 'slider',
      default: 0.7,
      config: { min: 0, max: 1, step: 0.01 },
    }

    const result = addPalettePortToNode(node(), 'inputs', item, ids('port-1', 'widget-1'))

    expect(result.port).toMatchObject({ id: 'port-1', name: 'strength', type: 'FLOAT', isWidget: true })
    expect(result.node.inputs).toEqual([result.port])
    expect(result.node.widgets).toEqual([
      {
        id: 'widget-1',
        portId: 'port-1',
        widgetType: 'slider',
        default: 0.7,
        config: { min: 0, max: 1, step: 0.01 },
      },
    ])
  })

  it('keeps custom port names unique and removes owned widgets with the port', () => {
    const base = addPalettePortToNode(node(), 'inputs', {
      label: 'Text',
      name: 'value',
      type: 'STRING',
      isWidget: true,
      widgetType: 'text',
    }, ids('port-1', 'widget-1')).node

    const withCustom = addCustomPortToNode(base, 'inputs', 'Value', 'custom_type', ids('port-2')).node
    const removed = removePortFromNode(withCustom, 'port-1')

    expect(withCustom.inputs.map(input => input.name)).toEqual(['value', 'value_2'])
    expect(withCustom.inputs[1]).toMatchObject({ type: 'CUSTOM_TYPE', isWidget: false })
    expect(removed.inputs.map(input => input.id)).toEqual(['port-2'])
    expect(removed.widgets).toEqual([])
  })

  it('adds return ui from code variables and removes it by id', () => {
    const source = node({
      inputs: [{ id: 'input-1', name: 'left_text', type: 'STRING', optional: false, isWidget: false }],
      code: 'concat = left_text + \"!\"',
    })

    const added = addUiOutputToNode(source, 'text', ids('ui-1'))
    const removed = removeUiOutputFromNode(added.node, 'ui-1')

    expect(added.uiOutput).toMatchObject({
      id: 'ui-1',
      key: 'text',
      kind: 'text',
      label: 'Text',
      expression: 'concat',
    })
    expect(removed.uiOutputs).toEqual([])
  })
})
