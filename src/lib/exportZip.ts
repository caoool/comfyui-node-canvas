import JSZip from 'jszip'
import { generatePython } from './generatePython'
import type { Project } from '../types/index'

export async function exportZip(project: Project): Promise<Blob> {
  const zip = new JSZip()

  // Each node gets its own Python file: <node.name>.py
  for (const node of project.nodes) {
    const code = generatePython(node)
    zip.file(`${node.name}.py`, code)
  }

  // __init__.py that imports all nodes
  const nodeNames = project.nodes.map(n => n.name)
  const initLines = [
    ...nodeNames.map(name => `from .${name} import ${name}, NODE_CLASS_MAPPINGS as ${name}_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS as ${name}_DISPLAY_MAPPINGS`),
    '',
    'NODE_CLASS_MAPPINGS = {}',
    'NODE_DISPLAY_NAME_MAPPINGS = {}',
    ...nodeNames.map(name => `NODE_CLASS_MAPPINGS.update(${name}_MAPPINGS)`),
    ...nodeNames.map(name => `NODE_DISPLAY_NAME_MAPPINGS.update(${name}_DISPLAY_MAPPINGS)`),
    '',
    '__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]',
  ]
  zip.file('__init__.py', initLines.join('\n'))

  return zip.generateAsync({ type: 'blob' })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  try {
    a.click()
  } finally {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}
