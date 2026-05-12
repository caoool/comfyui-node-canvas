import { describe, expect, it } from 'vitest'
import { buildPythonCodeBlocks, buildPythonFileView, extractEditablePythonSections } from '../../src/lib/pythonFileSections'
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

describe('pythonFileSections', () => {
  it('builds one full Python file view with file path and editable ranges', () => {
    const view = buildPythonFileView(makeNode(), '/home/lu/ComfyUI')
    expect(view.filePath).toBe('/home/lu/ComfyUI/custom_nodes/ComfyUINodeBuilder/TextUtility.py')
    expect(view.text).toContain('import json\nROOT = "/tmp"\n\nclass TextUtility:')
    expect(view.text).toContain('    def execute(self, string1, string2):\n        combined = string1 + string2')
    expect(view.editable.module.startOffset).toBeLessThan(view.editable.module.endOffset)
    expect(view.editable.execute.startOffset).toBeLessThan(view.editable.execute.endOffset)
    expect(view.generatedBlocks.length).toBeGreaterThanOrEqual(2)
  })

  it('extracts only module globals and execute body from an edited full file', () => {
    const view = buildPythonFileView(makeNode(), '')
    const nextText = view.text
      .replace('ROOT = "/tmp"', 'ROOT = "/mnt"')
      .replace('combined = string1 + string2', 'combined = string2 + string1')

    const extracted = extractEditablePythonSections(nextText, view)
    expect(extracted.moduleCode).toContain('ROOT = "/mnt"')
    expect(extracted.code).toContain('combined = string2 + string1')
    expect(extracted.code).not.toContain('        combined')
  })

  it('keeps the generated return block outside the editable execute range', () => {
    const view = buildPythonFileView(makeNode({
      code: 'combined = string1 + string2',
      outputs: [
        { id: 'o1', name: 'combined', type: 'STRING', optional: false, isWidget: false, expression: 'combined' },
      ],
      uiOutputs: [
        { id: 'u1', key: 'text', kind: 'text', label: 'Combined text', expression: 'combined' },
      ],
    }), '')
    const generatedReturnIndex = view.text.indexOf('# Generated return')

    expect(generatedReturnIndex).toBeGreaterThan(view.editable.execute.endOffset)
    expect(extractEditablePythonSections(view.text, view).code).toBe('combined = string1 + string2')
  })

  it('splits the file into connected generated and editable code blocks', () => {
    const blocks = buildPythonCodeBlocks(makeNode(), '')

    expect(blocks.map(block => [block.kind, block.id])).toEqual([
      ['editable', 'module'],
      ['generated', 'generated-contract'],
      ['editable', 'execute'],
      ['generated', 'generated-return'],
    ])
    expect(blocks.find(block => block.id === 'module')?.text).toBe('import json\nROOT = "/tmp"')
    expect(blocks.find(block => block.id === 'execute')?.text).toBe('combined = string1 + string2')
    expect(blocks.find(block => block.id === 'generated-return')?.text).toContain('return {"ui": {"text": (combined,)}, "result": (combined,)}')
  })
})
