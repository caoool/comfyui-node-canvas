import { nanoid } from 'nanoid'
import type { CustomNodeFileSpec, NodeSpec, PortSpec, Project, UiOutputSpec, WidgetSpec } from '../types/index'
import type { useProjectStore } from '../stores/project'
import type { useUiStore } from '../stores/ui'
import { validateProject } from './validate'
import { isReservedProjectFilePath, normalizeCustomNodeFilePath } from './nodeFilePaths'
import { syncNodeFromPythonSource } from './pythonSourceSync'
import { sanitizeInstallScript } from './installScriptSanitizer'
import type { BuilderAction } from './aiActionPlan'
import {
  createCosyVoice3VoiceCloneNode,
  pythonInstallScriptForNode,
  pythonRequirementsForNode,
  type NodeTemplateId,
} from './nodeTemplates'
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

function actionNodePatch(action: Extract<BuilderAction, { type: 'update_node' }>): Partial<NodeSpec> {
  return {
    ...(action.node ?? {}),
    ...(action.patch ?? {}),
  }
}

function createNodeFromPatch(
  projectStore: ProjectStore,
  uiStore: UiStore,
  templateId: NodeTemplateId | undefined,
  patch: Partial<NodeSpec>,
): NodeSpec {
  const routedTemplateId = routedTemplateForAiNode(templateId, patch)
  const shouldPreservePatch = routedTemplateId === templateId || routedTemplateId === 'blank'
  const node = projectStore.addNode(routedTemplateId)
  if (!shouldPreservePatch) {
    uiStore.selectNode(node.id)
    return projectStore.project.nodes.find(candidate => candidate.id === node.id) ?? node
  }
  projectStore.updateNode(node.id, {
    ...normalizeNodePatch(patch, node),
    customFiles: [],
  })
  uiStore.selectNode(node.id)
  return projectStore.project.nodes.find(candidate => candidate.id === node.id) ?? node
}

function mergeRequirementList(existing: string[] = [], next: string[] = []): string[] {
  const merged: string[] = []
  const seen = new Set<string>()
  for (const raw of [...existing, ...next]) {
    const requirement = raw.trim()
    if (!requirement || seen.has(requirement)) continue
    seen.add(requirement)
    merged.push(requirement)
  }
  return merged
}

function mergeInstallScript(existing: string | undefined, next: string): string {
  const current = existing?.trimEnd() ?? ''
  const addition = next.trim()
  if (!addition || current.includes(addition)) return current
  return current ? `${current}\n\n${addition}` : addition
}

function applyMaintainedCosyVoiceTemplate(projectStore: ProjectStore, uiStore: UiStore, node: NodeSpec): NodeSpec {
  const template = createCosyVoice3VoiceCloneNode()
  projectStore.updateNode(node.id, {
    ...template,
    id: node.id,
    pythonSource: undefined,
    customFiles: [],
  })
  const updated = projectStore.project.nodes.find(candidate => candidate.id === node.id) ?? node
  projectStore.updateProject({
    pythonRequirements: mergeRequirementList(projectStore.project.pythonRequirements, pythonRequirementsForNode(updated)),
    pythonInstallScript: mergeInstallScript(projectStore.project.pythonInstallScript, pythonInstallScriptForNode(updated)),
  })
  uiStore.selectNode(node.id)
  return updated
}

function routedTemplateForAiNode(templateId: NodeTemplateId | undefined, patch: Partial<NodeSpec>): NodeTemplateId {
  if (templateId && templateId !== 'blank') return templateId
  if (looksLikeCosyVoice3VoiceClonePatch(patch)) return 'cosyvoice3-voice-clone'
  return templateId || 'blank'
}

function looksLikeCosyVoice3VoiceClonePatch(patch: Partial<NodeSpec>): boolean {
  const searchable = [
    patch.name,
    patch.displayName,
    patch.moduleCode,
    patch.code,
    patch.pythonSource,
    ...(patch.inputs ?? []).map(input => input.name),
  ].filter(Boolean).join('\n')
  if (!/cosyvoice|Fun-CosyVoice3|voice\s*clone|zero[_ -]?shot/i.test(searchable)) return false
  return /CosyVoice3|Fun-CosyVoice3|inference_zero_shot|inference_cross_lingual|prompt_audio|reference_audio/i.test(searchable)
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

function parseRequirementLines(content: string): string[] {
  return content.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
}

function findNodeForPythonFile(project: Project, relativePath: string): NodeSpec | null {
  if (relativePath.includes('/')) return null
  return project.nodes.find(node => relativePath === `${node.name}.py`) ?? null
}

function customUiRendererNodeName(relativePath: string): string | null {
  const match = relativePath.match(/^web\/(.+)\.customRenderer\.js$/)
  return match?.[1] ?? null
}

function upsertBuilderFile(projectStore: ProjectStore, uiStore: UiStore, relativePath: string, content: string): BuilderActionResult {
  const normalizedPath = normalizeCustomNodeFilePath(relativePath)
  if (!normalizedPath) {
    return { level: 'error', message: `Invalid file path: ${relativePath || 'empty'}` }
  }
  if (normalizedPath === 'requirements.txt') {
    projectStore.updateProject({ pythonRequirements: parseRequirementLines(content) })
    return { level: 'success', message: 'Updated requirements.txt.' }
  }
  if (normalizedPath === 'install.py') {
    projectStore.updateProject({ pythonInstallScript: content.trim() ? sanitizeInstallScript(content.trimEnd()) : '' })
    return { level: 'success', message: 'Updated install.py.' }
  }
  const node = findNodeForPythonFile(projectStore.project, normalizedPath)
  if (node) {
    const synced = syncNodeFromPythonSource(content, node, nanoid)
    if (looksLikeCosyVoice3VoiceClonePatch({ ...node, ...synced.patch })) {
      const updated = applyMaintainedCosyVoiceTemplate(projectStore, uiStore, node)
      return {
        level: 'success',
        message: `Updated ${normalizedPath} by routing ${updated.name} to the maintained CosyVoice 3 voice clone template instead of preserving brittle full-file AI source.`,
      }
    }
    projectStore.updateNode(node.id, synced.patch)
    return {
      level: synced.issues.length > 0 ? 'warning' : 'success',
      message: synced.issues.length > 0
        ? `Updated ${normalizedPath}, but some source changes could not sync to the node contract:\n${synced.issues.map(issue => issue.message).join('\n')}`
        : `Updated ${normalizedPath}.`,
    }
  }
  const rendererNodeName = customUiRendererNodeName(normalizedPath)
  if (rendererNodeName) {
    const rendererNode = projectStore.project.nodes.find(candidate => candidate.name === rendererNodeName)
    if (!rendererNode) return { level: 'error', message: `Node not found for ${normalizedPath}.` }
    projectStore.updateNode(rendererNode.id, { customUiRendererCode: content.trim() ? content.trimEnd() : '' })
    return { level: 'success', message: `Updated ${normalizedPath}.` }
  }
  if (isReservedProjectFilePath(normalizedPath, projectStore.project.nodes.map(candidate => candidate.name))) {
    return { level: 'warning', message: `${normalizedPath} is generated by the builder. Use node, dependency, install, or renderer actions instead of replacing it directly.` }
  }
  const existing = (projectStore.project.customFiles ?? []).some(file => normalizeCustomNodeFilePath(file.relativePath) === normalizedPath)
  projectStore.updateProject({
    customFiles: upsertCustomFile(projectStore.project.customFiles ?? [], normalizedPath, content),
  })
  return { level: 'success', message: `${existing ? 'Updated' : 'Created'} ${normalizedPath}.` }
}

function deleteBuilderFile(projectStore: ProjectStore, relativePath: string): BuilderActionResult {
  const normalizedPath = normalizeCustomNodeFilePath(relativePath)
  if (!normalizedPath) {
    return { level: 'error', message: `Invalid file path: ${relativePath || 'empty'}` }
  }
  if (normalizedPath === 'requirements.txt') {
    projectStore.updateProject({ pythonRequirements: [] })
    return { level: 'success', message: 'Cleared requirements.txt.' }
  }
  if (normalizedPath === 'install.py') {
    projectStore.updateProject({ pythonInstallScript: '' })
    return { level: 'success', message: 'Cleared install.py.' }
  }
  const node = findNodeForPythonFile(projectStore.project, normalizedPath)
  if (node) {
    return { level: 'warning', message: `${normalizedPath} is generated by the builder for node ${node.name}. Use delete_node to remove the node or update_node/upsert_file to edit it.` }
  }
  const rendererNodeName = customUiRendererNodeName(normalizedPath)
  if (rendererNodeName) {
    const rendererNode = projectStore.project.nodes.find(candidate => candidate.name === rendererNodeName)
    if (!rendererNode) return { level: 'error', message: `Node not found for ${normalizedPath}.` }
    projectStore.updateNode(rendererNode.id, { customUiRendererCode: '' })
    return { level: 'success', message: `Cleared ${normalizedPath}.` }
  }
  if (isReservedProjectFilePath(normalizedPath, projectStore.project.nodes.map(candidate => candidate.name))) {
    return { level: 'warning', message: `${normalizedPath} is generated by the builder and cannot be deleted directly.` }
  }
  const existing = (projectStore.project.customFiles ?? []).some(file => normalizeCustomNodeFilePath(file.relativePath) === normalizedPath)
  projectStore.updateProject({
    customFiles: (projectStore.project.customFiles ?? []).filter(file => normalizeCustomNodeFilePath(file.relativePath) !== normalizedPath),
  })
  return existing
    ? { level: 'success', message: `Deleted ${normalizedPath}.` }
    : { level: 'warning', message: `File not found: ${normalizedPath}` }
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
      const patch = actionNodePatch(action)
      const node = findNode(projectStore.project, action.nodeId, action.nodeName, {
        fallbackNodeId: uiStore.selectedNodeId,
        useOnlyNodeFallback: true,
      })
      if (!node && projectStore.project.nodes.length === 0 && Object.keys(patch).length > 0) {
        const createdNode = createNodeFromPatch(projectStore, uiStore, 'blank', patch)
        return { level: 'success', message: `Created node ${createdNode.name}.` }
      }
      if (!node) return { level: 'error', message: `Node not found: ${action.nodeId || action.nodeName || 'unnamed'}` }
      if (looksLikeCosyVoice3VoiceClonePatch({ ...node, ...patch })) {
        const updated = applyMaintainedCosyVoiceTemplate(projectStore, uiStore, node)
        return { level: 'success', message: `Updated node ${updated.name} using the maintained CosyVoice 3 voice clone template.` }
      }
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
      if (!Array.isArray(action.requirements)) {
        return { level: 'error', message: 'set_requirements requires a requirements array.' }
      }
      projectStore.updateProject({
        pythonRequirements: action.requirements
          .filter((requirement): requirement is string => typeof requirement === 'string')
          .map(requirement => requirement.trim())
          .filter(Boolean),
      })
      return { level: 'success', message: 'Updated requirements.txt.' }
    }
    case 'set_install_script': {
      if (typeof action.code !== 'string') {
        return { level: 'error', message: 'set_install_script requires a code string.' }
      }
      projectStore.updateProject({ pythonInstallScript: sanitizeInstallScript(action.code.trimEnd()) })
      return { level: 'success', message: 'Updated install.py.' }
    }
    case 'upsert_file': {
      if (typeof action.relativePath !== 'string' || typeof action.content !== 'string') {
        return { level: 'error', message: 'upsert_file requires relativePath and content strings.' }
      }
      return upsertBuilderFile(projectStore, uiStore, action.relativePath, action.content)
    }
    case 'delete_file': {
      if (typeof action.relativePath !== 'string') {
        return { level: 'error', message: 'delete_file requires a relativePath string.' }
      }
      return deleteBuilderFile(projectStore, action.relativePath)
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
      if (typeof action.command !== 'string' || !action.command.trim()) {
        return { level: 'error', message: 'run_terminal requires a command string.' }
      }
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
