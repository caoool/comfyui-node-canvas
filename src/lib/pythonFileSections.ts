import { MANAGED_PACK_NAME } from './managedPack'
import { generatePython } from './generatePython'
import { packFolderRelativePath } from './packIdentity'
import type { NodeSpec } from '../types/index'

const MODULE_MARKER = '# __COMFYUI_BUILDER_EDITABLE_MODULE__'
const EXECUTE_MARKER = '# __COMFYUI_BUILDER_EDITABLE_EXECUTE__'

export interface TextRange {
  startOffset: number
  endOffset: number
  startLine: number
  endLine: number
}

export interface PythonFileView {
  filePath: string
  text: string
  editable: {
    module: TextRange
    execute: TextRange
  }
  generatedBlocks: TextRange[]
}

export interface EditablePythonSections {
  moduleCode: string
  code: string
}

export type PythonEditableSection = 'module' | 'execute'

export type PythonCodeBlock =
  | {
      id: 'module' | 'execute'
      kind: 'editable'
      editable: PythonEditableSection
      title: string
      subtitle: string
      text: string
    }
  | {
      id: 'generated-preamble' | 'generated-contract' | 'generated-return'
      kind: 'generated'
      title: string
      subtitle: string
      text: string
    }

function offsetToLine(text: string, offset: number): number {
  if (offset <= 0) return 1
  return text.slice(0, offset).split('\n').length
}

function rangeFor(text: string, startOffset: number, endOffset: number): TextRange {
  return {
    startOffset,
    endOffset,
    startLine: offsetToLine(text, startOffset),
    endLine: offsetToLine(text, endOffset),
  }
}

function generatedRangesFor(text: string, editable: PythonFileView['editable']): TextRange[] {
  const ranges: Array<[number, number]> = [
    [0, editable.module.startOffset],
    [editable.module.endOffset, editable.execute.startOffset],
    [editable.execute.endOffset, text.length],
  ]
  return ranges
    .filter(([start, end]) => end > start)
    .map(([start, end]) => rangeFor(text, start, end))
}

function indentExecuteBody(code: string): string {
  if (!code) return ''
  return code.split('\n').map(line => line === '' ? '' : `        ${line}`).join('\n')
}

function unindentExecuteBody(code: string): string {
  return code.split('\n').map(line => line.startsWith('        ') ? line.slice(8) : line).join('\n')
}

function pathForNode(node: NodeSpec, installPath: string): string {
  const filename = `${node.name}.py`
  const packLeaf = packFolderRelativePath(undefined)
  if (!installPath) return `custom_nodes/${MANAGED_PACK_NAME}/${packLeaf}/${filename}`
  return `${installPath.replace(/\/+$/, '')}/custom_nodes/${MANAGED_PACK_NAME}/${packLeaf}/${filename}`
}

export function buildPythonFileView(node: NodeSpec, installPath: string): PythonFileView {
  const shell = generatePython({
    ...node,
    moduleCode: MODULE_MARKER,
    code: EXECUTE_MARKER,
  })
  const moduleIndex = shell.indexOf(MODULE_MARKER)
  const executeNeedle = `        ${EXECUTE_MARKER}`
  const executeIndex = shell.indexOf(executeNeedle)

  if (moduleIndex === -1 || executeIndex === -1 || executeIndex < moduleIndex) {
    const text = generatePython(node)
    const emptyRange = rangeFor(text, 0, 0)
    return {
      filePath: pathForNode(node, installPath),
      text,
      editable: { module: emptyRange, execute: emptyRange },
      generatedBlocks: [rangeFor(text, 0, text.length)],
    }
  }

  const beforeModule = shell.slice(0, moduleIndex)
  const betweenModuleAndExecute = shell.slice(moduleIndex + MODULE_MARKER.length, executeIndex)
  const afterExecute = shell.slice(executeIndex + executeNeedle.length)
  const moduleCode = node.moduleCode ?? ''
  const executeCode = indentExecuteBody(node.code ?? '')

  const moduleStart = beforeModule.length
  const moduleEnd = moduleStart + moduleCode.length
  const executeStart = moduleEnd + betweenModuleAndExecute.length
  const executeEnd = executeStart + executeCode.length
  const text = `${beforeModule}${moduleCode}${betweenModuleAndExecute}${executeCode}${afterExecute}`
  const editable = {
    module: rangeFor(text, moduleStart, moduleEnd),
    execute: rangeFor(text, executeStart, executeEnd),
  }

  return {
    filePath: pathForNode(node, installPath),
    text,
    editable,
    generatedBlocks: generatedRangesFor(text, editable),
  }
}

export function extractEditablePythonSections(text: string, view: PythonFileView): EditablePythonSections {
  return {
    moduleCode: text.slice(view.editable.module.startOffset, view.editable.module.endOffset),
    code: unindentExecuteBody(text.slice(view.editable.execute.startOffset, view.editable.execute.endOffset)),
  }
}

export function buildPythonCodeBlocks(node: NodeSpec, installPath: string): PythonCodeBlock[] {
  const view = buildPythonFileView(node, installPath)
  const blocks: PythonCodeBlock[] = []
  const pushGenerated = (id: PythonCodeBlock['id'], title: string, subtitle: string, text: string) => {
    if (!text.trim()) return
    blocks.push({ id, kind: 'generated', title, subtitle, text } as PythonCodeBlock)
  }

  pushGenerated(
    'generated-preamble',
    'Generated preamble',
    'builder-owned setup',
    view.text.slice(0, view.editable.module.startOffset),
  )
  blocks.push({
    id: 'module',
    kind: 'editable',
    editable: 'module',
    title: 'Module globals',
    subtitle: 'imports, constants, helpers',
    text: node.moduleCode ?? '',
  })
  pushGenerated(
    'generated-contract',
    'Generated contract',
    'class, inputs, widgets, return metadata',
    view.text.slice(view.editable.module.endOffset, view.editable.execute.startOffset),
  )
  blocks.push({
    id: 'execute',
    kind: 'editable',
    editable: 'execute',
    title: 'Execute body',
    subtitle: 'write processing code and create return variables',
    text: node.code ?? '',
  })
  pushGenerated(
    'generated-return',
    'Generated return',
    'outputs, return UI, node mappings',
    view.text.slice(view.editable.execute.endOffset),
  )

  return blocks
}
