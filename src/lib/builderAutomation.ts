import { nanoid } from 'nanoid'
import type { CustomNodeFileSpec, NodeSpec, PortSpec, Project, UiOutputSpec, WidgetSpec } from '../types/index'
import type { useProjectStore } from '../stores/project'
import type { useUiStore } from '../stores/ui'
import { validateProject } from './validate'
import { normalizeCustomNodeFilePath } from './nodeFilePaths'
import type { BuilderAction } from './aiActionPlan'
import type { NodeTemplateId } from './nodeTemplates'
import { RETURN_UI_KINDS } from './returnUiCatalog'

type ProjectStore = ReturnType<typeof useProjectStore>
type UiStore = ReturnType<typeof useUiStore>

export interface BuilderActionResult {
  level: 'info' | 'success' | 'warning' | 'error'
  message: string
  deployRequested?: boolean
  terminalCommand?: string
  terminalNodeId?: string | null
}

function normalizePort(port: Partial<PortSpec>): PortSpec {
  return {
    id: port.id || nanoid(),
    name: port.name || 'value',
    type: port.type || 'STRING',
    optional: port.optional ?? false,
    isWidget: port.isWidget ?? false,
    expression: port.expression,
  }
}

function normalizeWidget(widget: Partial<WidgetSpec>): WidgetSpec {
  return {
    id: widget.id || nanoid(),
    portId: widget.portId || '',
    widgetType: widget.widgetType || 'text',
    default: widget.default ?? '',
    config: widget.config ?? {},
  }
}

type UiOutputDraft = Partial<UiOutputSpec> & {
  name?: string
  type?: string
}

function normalizeUiKind(value: unknown): UiOutputSpec['kind'] {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return 'text'
  if (raw === 'string') return 'text'
  if (raw === 'dict' || raw === 'object') return 'json'
  if (RETURN_UI_KINDS.includes(raw as UiOutputSpec['kind'])) return raw as UiOutputSpec['kind']
  return 'generic'
}

function normalizeUiOutput(output: UiOutputDraft): UiOutputSpec {
  const key = output.key || output.name || 'text'
  return {
    id: output.id || nanoid(),
    key,
    kind: output.kind || normalizeUiKind(output.type),
    label: output.label || key,
    expression: output.expression || key,
    sample: output.sample,
  }
}

interface FindNodeOptions {
  fallbackNodeId?: string | null
  useOnlyNodeFallback?: boolean
}

function findNode(project: Project, nodeId?: string, nodeName?: string, options: FindNodeOptions = {}): NodeSpec | null {
  if (nodeId) return project.nodes.find(node => node.id === nodeId) ?? null
  if (nodeName) return project.nodes.find(node => node.name === nodeName || node.displayName === nodeName) ?? null
  if (options.fallbackNodeId) return project.nodes.find(node => node.id === options.fallbackNodeId) ?? null
  if (options.useOnlyNodeFallback && project.nodes.length === 1) return project.nodes[0]
  return null
}

function normalizeNodePatch(patch: Partial<NodeSpec>, fallback?: NodeSpec): Partial<NodeSpec> {
  const normalized = { ...patch }
  if (normalized.inputs) normalized.inputs = normalized.inputs.map(normalizePort)
  else if (fallback) normalized.inputs = fallback.inputs
  if (normalized.outputs) normalized.outputs = normalized.outputs.map(normalizePort)
  else if (fallback) normalized.outputs = fallback.outputs
  if (normalized.widgets) normalized.widgets = normalized.widgets.map(normalizeWidget)
  else if (fallback) normalized.widgets = fallback.widgets
  if (normalized.uiOutputs) normalized.uiOutputs = normalized.uiOutputs.map(normalizeUiOutput)
  else if (fallback) normalized.uiOutputs = fallback.uiOutputs
  return normalized
}

function createNodeFromPatch(
  projectStore: ProjectStore,
  uiStore: UiStore,
  templateId: NodeTemplateId | undefined,
  patch: Partial<NodeSpec>,
): NodeSpec {
  const node = projectStore.addNode(templateId || 'blank')
  projectStore.updateNode(node.id, {
    ...normalizeNodePatch(patch, node),
    customFiles: [],
  })
  uiStore.selectNode(node.id)
  return projectStore.project.nodes.find(candidate => candidate.id === node.id) ?? node
}

function upsertCustomFile(files: CustomNodeFileSpec[], relativePath: string, content: string): CustomNodeFileSpec[] {
  const normalizedPath = normalizeCustomNodeFilePath(relativePath)
  if (!normalizedPath) return files
  const existing = files.find(file => file.relativePath === normalizedPath)
  if (existing) {
    return files.map(file => file.relativePath === normalizedPath ? { ...file, content } : file)
  }
  return [...files, { id: nanoid(), relativePath: normalizedPath, content }]
}

export async function applyBuilderAction(
  projectStore: ProjectStore,
  uiStore: UiStore,
  action: BuilderAction,
): Promise<BuilderActionResult> {
  switch (action.type) {
    case 'create_pack': {
      projectStore.createProject(action.name || 'AI Pack')
      if (action.packFolderName) projectStore.setPackFolderName(action.packFolderName)
      return { level: 'success', message: `Created pack ${projectStore.project.name}.` }
    }
    case 'switch_pack': {
      const target = projectStore.projectSummaries.find(summary => (
        summary.packFolderName === action.packFolderName || summary.name === action.name
      ))
      if (!target) return { level: 'error', message: `Pack not found: ${action.packFolderName || action.name || 'unnamed'}` }
      projectStore.switchProject(target.id)
      return { level: 'success', message: `Switched to ${target.name}.` }
    }
    case 'rename_pack': {
      if (action.name) projectStore.setProjectName(action.name)
      if (action.packFolderName) projectStore.setPackFolderName(action.packFolderName)
      return { level: 'success', message: `Renamed pack to ${projectStore.project.name} (${projectStore.project.packFolderName}).` }
    }
    case 'create_node': {
      const node = createNodeFromPatch(projectStore, uiStore, action.templateId, action.node ?? {})
      return { level: 'success', message: `Created node ${node.name}.` }
    }
    case 'update_node': {
      const patch = { ...(action.patch ?? action.node ?? {}) }
      const node = findNode(projectStore.project, action.nodeId, action.nodeName, {
        fallbackNodeId: uiStore.selectedNodeId,
        useOnlyNodeFallback: true,
      })
      if (!node && projectStore.project.nodes.length === 0 && Object.keys(patch).length > 0) {
        const createdNode = createNodeFromPatch(projectStore, uiStore, 'blank', patch)
        return { level: 'success', message: `Created node ${createdNode.name}.` }
      }
      if (!node) return { level: 'error', message: `Node not found: ${action.nodeId || action.nodeName || 'unnamed'}` }
      projectStore.updateNode(node.id, normalizeNodePatch(patch))
      uiStore.selectNode(node.id)
      return { level: 'success', message: `Updated node ${node.name}.` }
    }
    case 'delete_node': {
      const node = findNode(projectStore.project, action.nodeId, action.nodeName)
      if (!node) return { level: 'error', message: `Node not found: ${action.nodeId || action.nodeName || 'unnamed'}` }
      projectStore.removeNode(node.id)
      if (uiStore.selectedNodeId === node.id) uiStore.selectNode(null)
      return { level: 'success', message: `Deleted node ${node.name}.` }
    }
    case 'set_requirements': {
      projectStore.updateProject({ pythonRequirements: action.requirements.map(requirement => requirement.trim()).filter(Boolean) })
      return { level: 'success', message: 'Updated requirements.txt.' }
    }
    case 'set_install_script': {
      projectStore.updateProject({ pythonInstallScript: action.code.trimEnd() })
      return { level: 'success', message: 'Updated install.py.' }
    }
    case 'upsert_file': {
      projectStore.updateProject({
        customFiles: upsertCustomFile(projectStore.project.customFiles ?? [], action.relativePath, action.content),
      })
      return { level: 'success', message: `Updated ${action.relativePath}.` }
    }
    case 'delete_file': {
      const normalizedPath = normalizeCustomNodeFilePath(action.relativePath)
      projectStore.updateProject({
        customFiles: (projectStore.project.customFiles ?? []).filter(file => file.relativePath !== normalizedPath),
      })
      return { level: 'success', message: `Deleted ${action.relativePath}.` }
    }
    case 'select_node': {
      const node = findNode(projectStore.project, action.nodeId, action.nodeName, {
        fallbackNodeId: uiStore.selectedNodeId,
        useOnlyNodeFallback: true,
      })
      if (!node) return { level: 'error', message: `Node not found: ${action.nodeId || action.nodeName || 'unnamed'}` }
      uiStore.selectNode(node.id)
      return { level: 'success', message: `Selected node ${node.name}.` }
    }
    case 'validate_project': {
      const errors = validateProject(projectStore.project)
      if (errors.length === 0) return { level: 'success', message: 'Validation passed.' }
      return { level: 'error', message: errors.map(error => error.message).join('\n') }
    }
    case 'run_terminal': {
      const node = findNode(projectStore.project, action.nodeId, action.nodeName)
      return {
        level: 'info',
        message: `Run terminal command: ${action.command}`,
        terminalCommand: action.command,
        terminalNodeId: node?.id ?? uiStore.selectedNodeId,
      }
    }
    case 'deploy_pack':
      return { level: 'warning', message: 'Deploy requested.', deployRequested: true }
    default:
      return { level: 'warning', message: `Unsupported action: ${(action as { type?: string }).type ?? 'unknown'}` }
  }
}
