import {
  customUiRendererCodeForNode,
  customUiRendererPathForNode,
  nodeUsesCustomUiRenderer,
  projectInstallScript,
  projectRequirements,
} from './buildPackFiles'
import { buildManagedPackFiles } from './managedPack'
import { isPersistentProjectFilePath, isReservedProjectFilePath, languageForPath, normalizeCustomNodeFilePath } from './nodeFilePaths'
import { normalizePackFolderName } from './packIdentity'
import type { CustomNodeFileSpec, Project } from '../types/index'

export type PackCodeFileKind = 'node-python' | 'requirements' | 'install' | 'custom-ui' | 'custom-file' | 'generated'

export interface PackCodeFile {
  path: string
  relativePath: string
  filename: string
  text: string
  language: string
  kind: PackCodeFileKind
  scope: 'project' | 'node'
  nodeId?: string
  persistent: boolean
  deletable: boolean
}

function sortRank(path: string, selectedNodeName: string): number {
  if (path === `${selectedNodeName}.py`) return 0
  if (path === 'requirements.txt') return 1
  if (path === 'install.py') return 2
  if (path.endsWith('.customRenderer.js')) return 3
  return 4
}

function packPath(project: Project): string {
  const packFolderName = normalizePackFolderName(project.packFolderName || project.name)
  if (!project.comfyuiInstallPath) return `custom_nodes/${packFolderName}`
  return `${project.comfyuiInstallPath.replace(/\/+$/, '')}/custom_nodes/${packFolderName}`
}

function projectRequirementsText(project: Project): string {
  const lines = projectRequirements(project).map(requirement => requirement.trim()).filter(Boolean)
  return lines.length > 0 ? `${lines.join('\n')}\n` : ''
}

function projectInstallScriptText(project: Project): string {
  const script = projectInstallScript(project).trim()
  return script ? `${script}\n` : ''
}

function safeCustomFilesForProject(project: Project): CustomNodeFileSpec[] {
  const files: CustomNodeFileSpec[] = []
  const seen = new Set<string>()
  const nodeNames = project.nodes.map(node => node.name)
  for (const file of project.customFiles ?? []) {
    const relativePath = normalizeCustomNodeFilePath(file.relativePath)
    if (!relativePath || isReservedProjectFilePath(relativePath, nodeNames) || seen.has(relativePath)) continue
    seen.add(relativePath)
    files.push({ ...file, relativePath })
  }
  return files
}

export function buildPackCodeFiles(project: Project, selectedNodeId?: string | null): PackCodeFile[] {
  const selectedNode = selectedNodeId
    ? project.nodes.find(node => node.id === selectedNodeId)
    : null
  if (!selectedNode) return []

  const generatedFiles = buildManagedPackFiles(project)
  const files: Record<string, string> = {
    [`${selectedNode.name}.py`]: selectedNode.pythonSource ?? generatedFiles[`${selectedNode.name}.py`] ?? '',
    'requirements.txt': projectRequirementsText(project),
    'install.py': projectInstallScriptText(project),
  }

  if (nodeUsesCustomUiRenderer(selectedNode)) {
    files[customUiRendererPathForNode(selectedNode.name)] = customUiRendererCodeForNode(selectedNode)
  }
  const customFiles = safeCustomFilesForProject(project)
  const customFilePaths = new Set(customFiles.map(file => file.relativePath))
  for (const customFile of customFiles) {
    files[customFile.relativePath] = customFile.content
  }

  const nodeByPythonFile = new Map([[`${selectedNode.name}.py`, selectedNode]])
  const basePath = packPath(project)

  return Object.entries(files)
    .sort(([a], [b]) => sortRank(a, selectedNode.name) - sortRank(b, selectedNode.name) || a.localeCompare(b))
    .map(([relativePath, text]) => {
      const node = nodeByPythonFile.get(relativePath)
      const parts = relativePath.split('/')
      const kind: PackCodeFileKind = node
        ? 'node-python'
        : relativePath === 'requirements.txt'
          ? 'requirements'
          : relativePath === 'install.py'
            ? 'install'
            : relativePath.endsWith('.customRenderer.js')
              ? 'custom-ui'
              : customFilePaths.has(relativePath)
                ? 'custom-file'
                : 'generated'
      const scope: PackCodeFile['scope'] = kind === 'node-python' || kind === 'custom-ui' ? 'node' : 'project'
      const persistent = relativePath === `${selectedNode.name}.py` || isPersistentProjectFilePath(relativePath)
      return {
        path: `${basePath}/${relativePath}`,
        relativePath,
        filename: parts[parts.length - 1] || relativePath,
        text,
        language: languageForPath(relativePath),
        kind,
        scope,
        nodeId: scope === 'node' ? selectedNode.id : undefined,
        persistent,
        deletable: kind === 'custom-file' && !persistent,
      }
    })
}
