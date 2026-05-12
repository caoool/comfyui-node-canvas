import { describe, expect, it } from 'vitest'
import { buildGeneratedReturnCode, extractPythonVariableNames, migrateLegacyReturnCode } from '../../src/lib/returnCode'
import type { NodeSpec } from '../../src/types/index'

function makeNode(overrides: Partial<NodeSpec> = {}): NodeSpec {
  return {
    id: 'n1',
    name: 'TextUtility',
    displayName: 'Text Utility',
    category: 'ComfyUINodeBuilder',
    inputs: [
      { id: 'i1', name: 'string1', type: 'STRING', optional: false, isWidget: false },
      { id: 'i2', name: 'string2', type: 'STRING', optional: false, isWidget: false },
    ],
    outputs: [
      { id: 'o1', name: 'concat', type: 'STRING', optional: false, isWidget: false, expression: 'combined' },
    ],
    widgets: [],
    uiOutputs: [
      { id: 'u1', key: 'text', kind: 'text', label: 'Combined text', expression: 'combined' },
    ],
    moduleCode: '',
    code: 'combined = f"{string1}\\n{string2}"',
    useReturnOverrides: false,
    returnTypes: [],
    returnNames: [],
    ...overrides,
  }
}

describe('returnCode', () => {
  it('builds a generated return block from output and return UI expressions', () => {
    const code = buildGeneratedReturnCode(makeNode())
    expect(code).toContain('# Generated return. Edit Outputs / Return UI in the contract panel.')
    expect(code).toContain('return {"ui": {"text": (combined,)}, "result": (combined,)}')
  })

  it('builds tuple returns from output expressions when no return UI is configured', () => {
    const code = buildGeneratedReturnCode(makeNode({
      uiOutputs: [],
      outputs: [
        { id: 'o1', name: 'image', type: 'IMAGE', optional: false, isWidget: false, expression: 'processed_image' },
        { id: 'o2', name: 'mask', type: 'MASK', optional: false, isWidget: false, expression: 'mask' },
      ],
    }))
    expect(code).toContain('return (processed_image, mask)')
  })

  it('extracts input and assigned variable names for selectable return bindings', () => {
    expect(extractPythonVariableNames('combined = string1 + string2\nleft, right = pair\nfor item in rows:\n    pass', ['string1', 'string2'])).toEqual([
      'string1',
      'string2',
      'combined',
      'left',
      'right',
      'item',
    ])
  })

  it('migrates a legacy inline return into contract-bound expressions', () => {
    const migrated = migrateLegacyReturnCode(makeNode({
      code: 'combined = string1 + string2\nreturn {"ui": {"text": (combined,)}, "result": (combined,)}',
      outputs: [
        { id: 'o1', name: 'concat', type: 'STRING', optional: false, isWidget: false },
      ],
      uiOutputs: [
        { id: 'u1', key: 'text', kind: 'text', label: 'Combined text' },
      ],
    }))

    expect(migrated.code).toBe('combined = string1 + string2')
    expect(migrated.outputs[0].expression).toBe('combined')
    expect(migrated.uiOutputs?.[0].expression).toBe('combined')
  })
})
