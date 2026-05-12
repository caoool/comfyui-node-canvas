import { describe, expect, it } from 'vitest'
import { generatePython } from '../../src/lib/generatePython'
import {
  patchPythonSourceFromNode,
  syncNodeFromPythonSource,
} from '../../src/lib/pythonSourceSync'
import type { NodeSpec } from '../../src/types/index'

function makeNode(overrides: Partial<NodeSpec> = {}): NodeSpec {
  return {
    id: 'n1',
    name: 'TextUtility',
    displayName: 'Text Utility',
    category: 'ComfyUINodeBuilder',
    inputs: [
      { id: 'i1', name: 'string1', type: 'STRING', optional: false, isWidget: false },
      { id: 'i2', name: 'string2', type: 'STRING', optional: true, isWidget: false },
    ],
    outputs: [
      { id: 'o1', name: 'combined', type: 'STRING', optional: false, isWidget: false, expression: 'combined' },
    ],
    widgets: [],
    uiOutputs: [
      { id: 'u1', key: 'text', kind: 'text', label: 'Combined text', expression: 'combined' },
    ],
    moduleCode: 'import json\nROOT = "/tmp"',
    code: 'combined = string1 + string2',
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

describe('pythonSourceSync', () => {
  it('syncs full Python source changes back into node preview metadata and ports', () => {
    const current = makeNode()
    const source = generatePython(current)
      .replace('class TextUtility:', 'class TextUtilityRenamed:')
      .replace('CATEGORY = "ComfyUINodeBuilder"', 'CATEGORY = "ComfyUINodeBuilder/text"')
      .replace('NODE_DISPLAY_NAME_MAPPINGS = {"TextUtility": "Text Utility"}', 'NODE_DISPLAY_NAME_MAPPINGS = {"TextUtilityRenamed": "Text Utility Renamed"}')
      .replace('    FUNCTION = "execute"', '    FUNCTION = "execute"\n    OUTPUT_NODE = True')

    const result = syncNodeFromPythonSource(source, current, ids('input-3', 'output-2'))

    expect(result.issues).toEqual([])
    expect(result.patch).toMatchObject({
      pythonSource: source,
      name: 'TextUtilityRenamed',
      displayName: 'Text Utility Renamed',
      category: 'ComfyUINodeBuilder/text',
      isOutputNode: true,
    })
    expect(result.patch.inputs?.map(input => [input.name, input.type, input.optional])).toEqual([
      ['string1', 'STRING', false],
      ['string2', 'STRING', true],
    ])
    expect(result.patch.outputs?.map(output => [output.name, output.type, output.expression])).toEqual([
      ['combined', 'STRING', 'combined'],
    ])
    expect(result.patch.moduleCode).toBe('import json\nROOT = "/tmp"')
    expect(result.patch.code).toBe('combined = string1 + string2')
  })

  it('reports sync errors without overwriting preview fields when the source has no node class', () => {
    const current = makeNode()
    const result = syncNodeFromPythonSource('def helper():\n    pass\n', current, ids())

    expect(result.patch).toEqual({ pythonSource: 'def helper():\n    pass\n' })
    expect(result.issues).toContainEqual(expect.objectContaining({
      severity: 'error',
      message: expect.stringContaining('class'),
    }))
  })

  it('patches an existing full source when the node preview contract changes', () => {
    const current = makeNode()
    const source = generatePython(current)
    const next = makeNode({
      ...current,
      displayName: 'Image Utility',
      category: 'ComfyUINodeBuilder/image',
      isOutputNode: true,
      outputs: [
        { id: 'o1', name: 'image', type: 'IMAGE', optional: false, isWidget: false, expression: 'image' },
      ],
      code: 'image = None',
    })

    const result = patchPythonSourceFromNode(source, current, next)

    expect(result.issues).toEqual([])
    expect(result.text).toContain('import json\nROOT = "/tmp"\n\nclass TextUtility:')
    expect(result.text).toContain('RETURN_TYPES = ("IMAGE",)')
    expect(result.text).toContain('RETURN_NAMES = ("image",)')
    expect(result.text).toContain('CATEGORY = "ComfyUINodeBuilder/image"')
    expect(result.text).toContain('OUTPUT_NODE = True')
    expect(result.text).toContain('        image = None')
    expect(result.text).toContain('NODE_DISPLAY_NAME_MAPPINGS = {"TextUtility": "Image Utility"}')
  })
})
