import {
  customUiRendererPathForNode,
  nodeUsesCustomUiRenderer,
  projectInstallScript,
  projectRequirements,
} from './buildPackFiles'
import { MANAGED_PACK_NAME, buildManagedPackFiles } from './managedPack'
import { isPersistentProjectFilePath, isReservedProjectFilePath, languageForPath, normalizeCustomNodeFilePath } from './nodeFilePaths'
import { packFolderRelativePath } from './packIdentity'
import type { CustomNodeDirectorySpec, CustomNodeFileSpec, Project } from '../types/index'

export type PackCodeFileKind = 'node-python' | 'requirements' | 'install' | 'custom-ui' | 'custom-file' | 'generated' | 'filesystem'

export interface PackFilesystemEntry {
  kind: 'directory' | 'file'
  relativePath: string
}

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
  protected: boolean
  deletable: boolean
}

export type PackCodeTreeEntry =
  | {
    kind: 'directory'
    id: string
    name: string
    relativePath: string
    depth: number
    protected: boolean
    deletable: boolean
  }
  | {
    kind: 'file'
    id: string
    name: string
    relativePath: string
    depth: number
    protected: boolean
    file: PackCodeFile
  }

function sortRank(path: string, selectedNodeName: string, nodeNames: Set<string>, customFilePaths: Set<string>): number {
  if (path === `${selectedNodeName}.py`) return 0
  if (nodeNames.has(path.replace(/\.py$/, '')) && path.endsWith('.py')) return 1
  if (path === 'requirements.txt') return 2
  if (path === 'install.py') return 3
  if (customFilePaths.has(path)) return 4
  if (path.endsWith('.customRenderer.js')) return 5
  return 6
}

function packPath(project: Project): string {
  const packLeaf = packFolderRelativePath(project.packFolderName || project.name)
  if (!project.comfyuiInstallPath) return `custom_nodes/${MANAGED_PACK_NAME}/${packLeaf}`
  return `${project.comfyuiInstallPath.replace(/\/+$/, '')}/custom_nodes/${MANAGED_PACK_NAME}/${packLeaf}`
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

export function buildPackCodeFiles(
  project: Project,
  selectedNodeId?: string | null,
  filesystemEntries: PackFilesystemEntry[] = [],
): PackCodeFile[] {
  const selectedNode = selectedNodeId
    ? project.nodes.find(node => node.id === selectedNodeId)
    : null

  const generatedFiles = buildManagedPackFiles(project)
  const files: Record<string, string> = { ...generatedFiles }
  if (!('requirements.txt' in files)) files['requirements.txt'] = projectRequirementsText(project)
  if (!('install.py' in files)) files['install.py'] = projectInstallScriptText(project)

  const customFiles = safeCustomFilesForProject(project)
  const customFilePaths = new Set(customFiles.map(file => file.relativePath))

  const nodeByPythonFile = new Map(project.nodes.map(node => [`${node.name}.py`, node]))
  const nodeNames = new Set(project.nodes.map(node => node.name))
  const customUiNodeByPath = new Map(project.nodes
    .filter(nodeUsesCustomUiRenderer)
    .map(node => [customUiRendererPathForNode(node.name), node]))
  const basePath = packPath(project)

  const builderFiles = Object.entries(files)
    .sort(([a], [b]) =>
      sortRank(a, selectedNode?.name ?? '', nodeNames, customFilePaths) -
        sortRank(b, selectedNode?.name ?? '', nodeNames, customFilePaths) ||
      a.localeCompare(b),
    )
    .map(([relativePath, text]) => {
      const node = nodeByPythonFile.get(relativePath)
      const customUiNode = customUiNodeByPath.get(relativePath)
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
      const persistent = Boolean(node) || isPersistentProjectFilePath(relativePath)
      const deletable = kind === 'custom-file' && !persistent
      return {
        path: `${basePath}/${relativePath}`,
        relativePath,
        filename: parts[parts.length - 1] || relativePath,
        text,
        language: languageForPath(relativePath),
        kind,
        scope,
        nodeId: node?.id ?? customUiNode?.id,
        persistent,
        protected: !deletable,
        deletable,
      }
    })

  const builderFilePaths = new Set(builderFiles.map(file => file.relativePath))
  const filesystemFiles = filesystemEntries
    .filter(entry => entry.kind === 'file' && !builderFilePaths.has(entry.relativePath))
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath))
    .map((entry): PackCodeFile => {
      const parts = entry.relativePath.split('/')
      return {
        path: `${basePath}/${entry.relativePath}`,
        relativePath: entry.relativePath,
        filename: parts[parts.length - 1] || entry.relativePath,
        text: '# This file exists in the deployed pack folder, but is not managed by the builder.\n',
        language: languageForPath(entry.relativePath),
        kind: 'filesystem',
        scope: 'project',
        persistent: true,
        protected: true,
        deletable: false,
      }
    })

  return [...builderFiles, ...filesystemFiles]
}

export function buildPackCodeFileTree(
  files: PackCodeFile[],
  customDirectories: CustomNodeDirectorySpec[] = [],
  filesystemEntries: PackFilesystemEntry[] = [],
): PackCodeTreeEntry[] {
  type DirectoryNode = Extract<PackCodeTreeEntry, { kind: 'directory' }> & {
    children: TreeNode[]
  }
  type FileNode = Extract<PackCodeTreeEntry, { kind: 'file' }>
  type TreeNode = DirectoryNode | FileNode

  const root: TreeNode[] = []
  const directories = new Map<string, DirectoryNode>()
  const builderDirectoryPaths = new Set<string>()
  const filesystemDirectoryPaths = new Set(
    filesystemEntries
      .filter(entry => entry.kind === 'directory')
      .map(entry => entry.relativePath),
  )

  function addAncestorDirectories(relativePath: string) {
    const parts = relativePath.split('/')
    for (let index = 1; index < parts.length; index += 1) {
      builderDirectoryPaths.add(parts.slice(0, index).join('/'))
    }
  }

  function ensureDirectory(parts: string[], index: number, siblings: TreeNode[]): DirectoryNode {
    const relativePath = parts.slice(0, index + 1).join('/')
    let directory = directories.get(relativePath)
    if (!directory) {
      directory = {
        kind: 'directory',
        id: `dir:${relativePath}`,
        name: parts[index],
        relativePath,
        depth: index,
        protected: false,
        deletable: true,
        children: [],
      }
      directories.set(relativePath, directory)
      siblings.push(directory)
    }
    return directory
  }

  for (const directory of customDirectories) {
    builderDirectoryPaths.add(directory.relativePath)
    addAncestorDirectories(`${directory.relativePath}/__dir__`)
    const parts = directory.relativePath.split('/')
    let siblings = root
    for (let index = 0; index < parts.length; index += 1) {
      const entry = ensureDirectory(parts, index, siblings)
      siblings = entry.children
    }
  }

  for (const directory of filesystemEntries.filter(entry => entry.kind === 'directory')) {
    const parts = directory.relativePath.split('/')
    let siblings = root
    for (let index = 0; index < parts.length; index += 1) {
      const entry = ensureDirectory(parts, index, siblings)
      siblings = entry.children
    }
  }

  for (const file of files) {
    if (file.kind !== 'filesystem') addAncestorDirectories(file.relativePath)
    const parts = file.relativePath.split('/')
    let siblings = root

    for (let index = 0; index < parts.length - 1; index += 1) {
      const directory = ensureDirectory(parts, index, siblings)
      siblings = directory.children
    }

    siblings.push({
      kind: 'file',
      id: `file:${file.relativePath}`,
      name: parts[parts.length - 1] || file.relativePath,
      relativePath: file.relativePath,
      depth: Math.max(0, parts.length - 1),
      protected: file.protected,
      file,
    })
  }

  for (const directory of [...directories.values()].sort((a, b) => b.depth - a.depth)) {
    const isFilesystemOnlyDirectory = filesystemDirectoryPaths.has(directory.relativePath) && !builderDirectoryPaths.has(directory.relativePath)
    directory.protected = isFilesystemOnlyDirectory || directory.children.some(child => child.protected)
    directory.deletable = !directory.protected
  }

  const entries: PackCodeTreeEntry[] = []
  function flatten(nodes: TreeNode[]) {
    for (const node of nodes) {
      if (node.kind === 'directory') {
        const { children: _children, ...entry } = node
        entries.push(entry)
        flatten(node.children)
      } else {
        entries.push(node)
      }
    }
  }
  flatten(root)
  return entries
}
