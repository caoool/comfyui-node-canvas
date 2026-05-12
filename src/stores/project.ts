import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { nanoid } from 'nanoid'
import type { CustomNodeFileSpec, Project, NodeSpec } from '../types/index'
import { createNodeFromTemplate, nodeForPythonGeneration, pythonInstallScriptForNode, pythonRequirementsForNode, type NodeTemplateId } from '../lib/nodeTemplates'
import { migrateLegacyReturnCode } from '../lib/returnCode'
import { patchPythonSourceFromNode } from '../lib/pythonSourceSync'
import { normalizeCustomNodeFilePath } from '../lib/nodeFilePaths'
import { DEFAULT_PACK_FOLDER_NAME, normalizePackFolderName, uniquePackFolderName } from '../lib/packIdentity'

const STORAGE_KEY = 'comfyui-node-builder-project'
const REGISTRY_STORAGE_KEY = 'comfyui-node-builder-pack-registry'
const REGISTRY_SCHEMA_VERSION = 1
const OLD_STRING_CONCAT_PREVIEW_CODE = 'concat = f"{left_text}\\n{right_text}"\nreturn {"ui": {"text": [concat]}, "result": (concat,)}'
const STRING_CONCAT_PREVIEW_CODE = 'concat = f"{left_text}\\n{right_text}"\nreturn {"ui": {"text": (concat,)}, "result": (concat,)}'

interface ProjectRegistry {
  schemaVersion: typeof REGISTRY_SCHEMA_VERSION
  activeProjectId: string
  projects: Project[]
}

export interface ProjectSummary {
  id: string
  name: string
  packFolderName: string
  nodeCount: number
}

function defaultProject(): Project {
  return {
    id: nanoid(),
    name: 'ComfyUINodeBuilder',
    packFolderName: DEFAULT_PACK_FOLDER_NAME,
    nodes: [],
    comfyuiUrl: 'http://127.0.0.1:8188',
    comfyuiInstallPath: '',
    pythonRequirements: [],
    pythonInstallScript: '',
    customFiles: [],
  }
}

function uniqueNodeName(base: string, nodes: NodeSpec[], excludeId: string | null = null): string {
  const taken = new Set(nodes.filter(n => n.id !== excludeId).map(n => n.name))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}${n}`)) n++
  return `${base}${n}`
}

function uniqueDisplayName(base: string, nodes: NodeSpec[], excludeId: string | null = null): string {
  const taken = new Set(nodes.filter(n => n.id !== excludeId).map(n => n.displayName))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base} ${n}`)) n++
  return `${base} ${n}`
}

function normalizeNode(node: NodeSpec): NodeSpec {
  const legacyPreviews = (node as NodeSpec & {
    previews?: Array<{ id?: string; name?: string; type?: string; sample?: unknown }>
  }).previews ?? []
  const normalized = {
    ...node,
    isOutputNode: node.isOutputNode ?? false,
    uiOutputs: node.uiOutputs ?? legacyPreviews.map(preview => ({
      id: preview.id ?? nanoid(),
      key: 'text',
      kind: 'text' as const,
      label: preview.name ?? 'Text',
      expression: 'text',
      sample: preview.sample,
    })),
    moduleCode: node.moduleCode ?? '',
    pythonSource: node.pythonSource,
    pythonRequirements: pythonRequirementsForNode(node),
    pythonInstallScript: pythonInstallScriptForNode(node),
    customFiles: (node.customFiles ?? [])
      .map(file => {
        const relativePath = normalizeCustomNodeFilePath(file.relativePath)
        return relativePath ? { ...file, relativePath, content: file.content ?? '' } : null
      })
      .filter((file): file is CustomNodeFileSpec => Boolean(file)),
    useReturnOverrides: node.useReturnOverrides ?? false,
  }
  if (normalized.name === 'StringConcatPreview' && normalized.code === OLD_STRING_CONCAT_PREVIEW_CODE) {
    normalized.code = STRING_CONCAT_PREVIEW_CODE
  }
  return migrateLegacyReturnCode(nodeForPythonGeneration(normalized))
}

function normalizeCustomFiles(files: CustomNodeFileSpec[] | undefined): CustomNodeFileSpec[] {
  const normalizedFiles: CustomNodeFileSpec[] = []
  const seen = new Set<string>()
  for (const file of files ?? []) {
    const relativePath = normalizeCustomNodeFilePath(file.relativePath)
    if (!relativePath || seen.has(relativePath)) continue
    seen.add(relativePath)
    normalizedFiles.push({
      ...file,
      id: file.id || nanoid(),
      relativePath,
      content: file.content ?? '',
    })
  }
  return normalizedFiles
}

function mergeRequirementLists(...lists: Array<string[] | undefined>): string[] {
  const merged: string[] = []
  const seen = new Set<string>()
  for (const list of lists) {
    for (const rawRequirement of list ?? []) {
      const requirement = rawRequirement.trim()
      if (!requirement || seen.has(requirement)) continue
      seen.add(requirement)
      merged.push(requirement)
    }
  }
  return merged
}

function mergeInstallScripts(...scripts: Array<string | undefined>): string {
  return scripts
    .map(script => script?.trim())
    .filter((script): script is string => Boolean(script))
    .filter((script, index, all) => all.indexOf(script) === index)
    .join('\n\n')
}

function normalizeProject(project: Project): Project {
  const nodes: NodeSpec[] = []
  for (const rawNode of project.nodes ?? []) {
    const node = normalizeNode(rawNode)
    node.name = uniqueNodeName(node.name || 'CustomNode', nodes, node.id)
    node.displayName = uniqueDisplayName(node.displayName || node.name || 'Custom Node', nodes, node.id)
    nodes.push(node)
  }
  const hasProjectRequirements = Array.isArray(project.pythonRequirements)
  const hasProjectInstallScript = typeof project.pythonInstallScript === 'string'
  const hasProjectCustomFiles = Array.isArray(project.customFiles)
  const projectCustomFiles = normalizeCustomFiles(project.customFiles)
  const legacyCustomFiles = hasProjectCustomFiles
    ? []
    : normalizeCustomFiles(nodes.flatMap(node => node.customFiles ?? []))
  return {
    ...defaultProject(),
    ...project,
    id: project.id || nanoid(),
    name: project.name?.trim() || 'ComfyUINodeBuilder',
    packFolderName: normalizePackFolderName(project.packFolderName || project.name),
    pythonRequirements: hasProjectRequirements
      ? mergeRequirementLists(project.pythonRequirements)
      : mergeRequirementLists(...nodes.map(node => pythonRequirementsForNode(node))),
    pythonInstallScript: hasProjectInstallScript
      ? project.pythonInstallScript?.trimEnd() ?? ''
      : mergeInstallScripts(...nodes.map(node => pythonInstallScriptForNode(node))),
    customFiles: normalizeCustomFiles([...projectCustomFiles, ...legacyCustomFiles]),
    nodes: nodes.map(node => ({ ...node, customFiles: [] })),
  }
}

function normalizeProjectList(rawProjects: Project[]): Project[] {
  const projects: Project[] = []
  for (const rawProject of rawProjects) {
    const normalized = normalizeProject(rawProject)
    normalized.packFolderName = uniquePackFolderName(
      normalized.packFolderName || normalized.name,
      projects,
      normalized.id ?? null,
    )
    projects.push(normalized)
  }
  return projects.length > 0 ? projects : [defaultProject()]
}

function loadRegistry(): ProjectRegistry {
  try {
    const rawRegistry = localStorage.getItem(REGISTRY_STORAGE_KEY)
    if (rawRegistry) {
      const parsed = JSON.parse(rawRegistry) as Partial<ProjectRegistry>
      const projects = normalizeProjectList(Array.isArray(parsed.projects) ? parsed.projects : [])
      const activeProjectId = projects.some(project => project.id === parsed.activeProjectId)
        ? String(parsed.activeProjectId)
        : projects[0].id!
      return { schemaVersion: REGISTRY_SCHEMA_VERSION, activeProjectId, projects }
    }
  } catch {}

  try {
    const rawLegacyProject = localStorage.getItem(STORAGE_KEY)
    if (rawLegacyProject) {
      const projects = normalizeProjectList([JSON.parse(rawLegacyProject) as Project])
      return {
        schemaVersion: REGISTRY_SCHEMA_VERSION,
        activeProjectId: projects[0].id!,
        projects,
      }
    }
  } catch {}

  const project = defaultProject()
  return {
    schemaVersion: REGISTRY_SCHEMA_VERSION,
    activeProjectId: project.id!,
    projects: [project],
  }
}

function saveRegistry(registry: ProjectRegistry) {
  localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(registry))
}

function activeProjectFrom(projects: Project[], activeProjectId: string): Project {
  return projects.find(project => project.id === activeProjectId) ?? projects[0]
}

function uniqueProjectName(base: string, projects: Project[], excludeId: string | null = null): string {
  const fallback = base.trim() || 'New Pack'
  const taken = new Set(projects.filter(project => project.id !== excludeId).map(project => project.name))
  if (!taken.has(fallback)) return fallback
  let suffix = 2
  while (taken.has(`${fallback} ${suffix}`)) suffix += 1
  return `${fallback} ${suffix}`
}

function duplicateProjectTree(source: Project, projects: Project[]): Project {
  const cloned = normalizeProject(JSON.parse(JSON.stringify(source)) as Project)
  const portIdMap = new Map<string, string>()
  const copyName = uniqueProjectName(`${source.name || 'Pack'} Copy`, projects)
  cloned.id = nanoid()
  cloned.name = copyName
  cloned.packFolderName = uniquePackFolderName(`${source.packFolderName || normalizePackFolderName(source.name)}_Copy`, projects)
  cloned.customFiles = normalizeCustomFiles(cloned.customFiles).map(file => ({ ...file, id: nanoid() }))
  cloned.nodes = cloned.nodes.map(node => {
    portIdMap.clear()
    const inputs = node.inputs.map(port => {
      const id = nanoid()
      portIdMap.set(port.id, id)
      return { ...port, id }
    })
    const outputs = node.outputs.map(port => {
      const id = nanoid()
      portIdMap.set(port.id, id)
      return { ...port, id }
    })
    return {
      ...node,
      id: nanoid(),
      inputs,
      outputs,
      widgets: node.widgets.map(widget => ({
        ...widget,
        id: nanoid(),
        portId: portIdMap.get(widget.portId) ?? widget.portId,
        config: { ...widget.config },
      })),
      uiOutputs: (node.uiOutputs ?? []).map(output => ({ ...output, id: nanoid() })),
      customFiles: [],
    }
  })
  return cloned
}

export const useProjectStore = defineStore('project', () => {
  const initialRegistry = loadRegistry()
  const projects = ref<Project[]>(initialRegistry.projects)
  const activeProjectId = ref(initialRegistry.activeProjectId)
  const project = computed<Project>(() => activeProjectFrom(projects.value, activeProjectId.value))
  const projectSummaries = computed<ProjectSummary[]>(() => projects.value.map(project => ({
    id: project.id!,
    name: project.name,
    packFolderName: project.packFolderName || normalizePackFolderName(project.name),
    nodeCount: project.nodes.length,
  })))
  saveRegistry(initialRegistry)

  watch([projects, activeProjectId], ([nextProjects, nextActiveProjectId]) => {
    saveRegistry({
      schemaVersion: REGISTRY_SCHEMA_VERSION,
      activeProjectId: nextActiveProjectId,
      projects: nextProjects,
    })
  }, { deep: true, flush: 'sync' })

  function activeProject(): Project {
    return project.value
  }

  function addNode(templateId: NodeTemplateId = 'blank'): NodeSpec {
    const node = createNodeFromTemplate(templateId)
    const current = activeProject()
    node.name = uniqueNodeName(node.name, current.nodes)
    node.displayName = uniqueDisplayName(node.displayName, current.nodes)
    current.nodes.push(node)
    current.pythonRequirements = mergeRequirementLists(
      current.pythonRequirements,
      pythonRequirementsForNode(node),
    )
    current.pythonInstallScript = mergeInstallScripts(
      current.pythonInstallScript,
      pythonInstallScriptForNode(node),
    )
    return node
  }

  function removeNode(id: string) {
    const current = activeProject()
    current.nodes = current.nodes.filter(n => n.id !== id)
  }

  function updateNode(id: string, patch: Partial<NodeSpec>) {
    const current = activeProject()
    const node = current.nodes.find(n => n.id === id)
    if (!node) return
    const previous: NodeSpec = {
      ...node,
      inputs: [...node.inputs],
      outputs: [...node.outputs],
      widgets: [...node.widgets],
      uiOutputs: node.uiOutputs ? [...node.uiOutputs] : undefined,
      customFiles: node.customFiles ? [...node.customFiles] : undefined,
    }
    Object.assign(node, patch)
    if (
      previous.pythonSource &&
      !Object.prototype.hasOwnProperty.call(patch, 'pythonSource')
    ) {
      const synced = patchPythonSourceFromNode(previous.pythonSource, previous, node)
      if (synced.issues.length === 0) node.pythonSource = synced.text
    }
  }

  function updateProject(patch: Partial<Project>) {
    const current = activeProject()
    Object.assign(current, patch)
    if (Object.prototype.hasOwnProperty.call(patch, 'packFolderName')) {
      current.packFolderName = uniquePackFolderName(current.packFolderName || current.name, projects.value, current.id ?? null)
    }
  }

  function duplicateNode(id: string): NodeSpec | null {
    const current = activeProject()
    const source = current.nodes.find(n => n.id === id)
    if (!source) return null
    const portIdMap = new Map<string, string>()
    const clonePorts = (ports: NodeSpec['inputs']) => ports.map(port => {
      const nextId = nanoid()
      portIdMap.set(port.id, nextId)
      return { ...port, id: nextId }
    })
    const duplicated: NodeSpec = {
      ...source,
      id: nanoid(),
      name: uniqueNodeName(`${source.name}Copy`, current.nodes),
      displayName: uniqueDisplayName(`${source.displayName} Copy`, current.nodes),
      inputs: clonePorts(source.inputs),
      outputs: clonePorts(source.outputs),
      uiOutputs: (source.uiOutputs ?? []).map(output => ({ ...output, id: nanoid() })),
      pythonSource: source.pythonSource,
      customFiles: [],
      widgets: source.widgets.map(widget => ({
        ...widget,
        id: nanoid(),
        portId: portIdMap.get(widget.portId) ?? widget.portId,
        config: { ...widget.config },
      })),
    }
    current.nodes.push(duplicated)
    return duplicated
  }

  function replaceProject(nextProject: Project) {
    const current = activeProject()
    const normalized = normalizeProject({
      ...nextProject,
      id: current.id,
      packFolderName: nextProject.packFolderName || current.packFolderName,
    })
    normalized.packFolderName = uniquePackFolderName(normalized.packFolderName || normalized.name, projects.value, normalized.id ?? null)
    const index = projects.value.findIndex(candidate => candidate.id === current.id)
    if (index >= 0) projects.value[index] = normalized
    else projects.value.push(normalized)
    activeProjectId.value = normalized.id!
  }

  function setProjectName(name: string) {
    activeProject().name = name
  }

  function setPackFolderName(packFolderName: string) {
    const current = activeProject()
    current.packFolderName = uniquePackFolderName(packFolderName || current.name, projects.value, current.id ?? null)
  }

  function setComfyuiUrl(url: string) {
    activeProject().comfyuiUrl = url
  }

  function setComfyuiInstallPath(path: string) {
    activeProject().comfyuiInstallPath = path
  }

  function createProject(name = 'New Pack'): Project {
    const current = activeProject()
    const packFolderName = uniquePackFolderName(name, projects.value)
    const nextProject = normalizeProject({
      ...defaultProject(),
      id: nanoid(),
      name: uniqueProjectName(name, projects.value),
      packFolderName,
      nodes: [],
      comfyuiUrl: current.comfyuiUrl,
      comfyuiInstallPath: current.comfyuiInstallPath,
      pythonRequirements: [],
      pythonInstallScript: '',
      customFiles: [],
    })
    projects.value.push(nextProject)
    activeProjectId.value = nextProject.id!
    return nextProject
  }

  function duplicateProject(id = activeProjectId.value): Project | null {
    const source = projects.value.find(project => project.id === id)
    if (!source) return null
    const duplicated = duplicateProjectTree(source, projects.value)
    projects.value.push(duplicated)
    activeProjectId.value = duplicated.id!
    return duplicated
  }

  function deleteProject(id = activeProjectId.value): boolean {
    if (projects.value.length <= 1) return false
    const index = projects.value.findIndex(project => project.id === id)
    if (index < 0) return false
    const deletingActive = activeProjectId.value === id
    projects.value.splice(index, 1)
    if (deletingActive) {
      activeProjectId.value = projects.value[Math.max(0, index - 1)]?.id ?? projects.value[0].id!
    }
    return true
  }

  function switchProject(id: string): Project | null {
    const nextProject = projects.value.find(project => project.id === id)
    if (!nextProject) return null
    activeProjectId.value = nextProject.id!
    return nextProject
  }

  function importProject(nextProject: Project): Project {
    const normalized = normalizeProject(nextProject)
    const existingIndex = projects.value.findIndex(project => (
      normalizePackFolderName(project.packFolderName || project.name) === normalizePackFolderName(normalized.packFolderName || normalized.name)
    ))
    if (existingIndex >= 0) {
      normalized.id = projects.value[existingIndex].id
      normalized.packFolderName = projects.value[existingIndex].packFolderName
      projects.value[existingIndex] = normalized
    } else {
      normalized.id = normalized.id || nanoid()
      normalized.packFolderName = uniquePackFolderName(normalized.packFolderName || normalized.name, projects.value, normalized.id)
      projects.value.push(normalized)
    }
    activeProjectId.value = normalized.id!
    return normalized
  }

  return {
    project,
    projects,
    activeProjectId,
    projectSummaries,
    addNode,
    removeNode,
    updateNode,
    updateProject,
    duplicateNode,
    replaceProject,
    createProject,
    duplicateProject,
    deleteProject,
    switchProject,
    importProject,
    setProjectName,
    setPackFolderName,
    setComfyuiUrl,
    setComfyuiInstallPath,
  }
})
