import JSZip from 'jszip'
import { buildManagedPackFiles } from './managedPack'
import type { Project } from '../types/index'

export async function exportZip(project: Project): Promise<Blob> {
  const zip = new JSZip()
  const files = buildManagedPackFiles(project)
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content)
  }
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
