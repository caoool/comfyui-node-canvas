import type { NodeSpec, PortSpec, Project, UiOutputSpec, WidgetSpec } from '../types/index'

export function cloneProjectSnapshot(project: Project): Project {
  return JSON.parse(JSON.stringify(project)) as Project
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
}

function nodeLabel(node: Pick<NodeSpec, 'displayName' | 'name'>): string {
  return node.displayName || node.name || 'node'
}

function keyedById<T extends { id: string }>(items: T[] = []): Map<string, T> {
  return new Map(items.map(item => [item.id, item]))
}

function keyedByName<T extends { name: string }>(items: T[] = []): Map<string, T> {
  return new Map(items.map(item => [item.name, item]))
}

function uiOutputsByKey(items: UiOutputSpec[] = []): Map<string, UiOutputSpec> {
  return new Map(items.map(item => [item.key, item]))
}

function describePortChanges(
  changes: string[],
  beforeItems: PortSpec[],
  afterItems: PortSpec[],
  nodeName: string,
  kind: 'input' | 'output',
) {
  const beforeByName = keyedByName(beforeItems)
  for (const afterItem of afterItems) {
    const beforeItem = beforeByName.get(afterItem.name)
    if (!beforeItem) {
      changes.push(`Added ${kind} ${afterItem.name} to ${nodeName}`)
    } else if (!sameValue(beforeItem, afterItem)) {
      changes.push(`Updated ${kind} ${afterItem.name} on ${nodeName}`)
    }
  }
}

function describeWidgetChanges(changes: string[], beforeItems: WidgetSpec[], afterItems: WidgetSpec[], nodeName: string) {
  const beforeById = keyedById(beforeItems)
  for (const afterItem of afterItems) {
    const beforeItem = beforeById.get(afterItem.id)
    if (!beforeItem) {
      changes.push(`Added widget ${afterItem.widgetType} to ${nodeName}`)
    } else if (!sameValue(beforeItem, afterItem)) {
      changes.push(`Updated widget ${afterItem.widgetType} on ${nodeName}`)
    }
  }
}

function describeUiOutputChanges(changes: string[], beforeItems: UiOutputSpec[] = [], afterItems: UiOutputSpec[] = [], nodeName: string) {
  const beforeByKey = uiOutputsByKey(beforeItems)
  for (const afterItem of afterItems) {
    const beforeItem = beforeByKey.get(afterItem.key)
    if (!beforeItem) {
      changes.push(`Added UI output ${afterItem.key} to ${nodeName}`)
    } else if (!sameValue(beforeItem, afterItem)) {
      changes.push(`Updated UI output ${afterItem.key} on ${nodeName}`)
    }
  }
}

function describeNodeChanges(changes: string[], beforeNode: NodeSpec, afterNode: NodeSpec) {
  const name = nodeLabel(afterNode)
  if (beforeNode.name !== afterNode.name) changes.push(`Renamed node ${nodeLabel(beforeNode)} to ${afterNode.name}`)
  if (beforeNode.displayName !== afterNode.displayName) changes.push(`Updated display name for ${name}`)
  if (beforeNode.category !== afterNode.category) changes.push(`Updated category for ${name}`)
  if (beforeNode.isOutputNode !== afterNode.isOutputNode) changes.push(`Updated output-node flag for ${name}`)
  describePortChanges(changes, beforeNode.inputs, afterNode.inputs, name, 'input')
  describePortChanges(changes, beforeNode.outputs, afterNode.outputs, name, 'output')
  describeWidgetChanges(changes, beforeNode.widgets, afterNode.widgets, name)
  describeUiOutputChanges(changes, beforeNode.uiOutputs, afterNode.uiOutputs, name)
  if (beforeNode.moduleCode !== afterNode.moduleCode) changes.push(`Updated module code for ${name}`)
  if (beforeNode.code !== afterNode.code) changes.push(`Updated code for ${name}`)
  if (beforeNode.pythonSource !== afterNode.pythonSource) changes.push(`Updated Python source for ${name}`)
  if (!sameValue(beforeNode.returnTypes, afterNode.returnTypes) || !sameValue(beforeNode.returnNames, afterNode.returnNames)) {
    changes.push(`Updated return metadata for ${name}`)
  }
  if (!sameValue(beforeNode.customFiles, afterNode.customFiles)) changes.push(`Updated node files for ${name}`)
}

function describeProjectFiles(changes: string[], before: Project, after: Project) {
  const beforeFiles = new Map((before.customFiles ?? []).map(file => [file.relativePath, file]))
  const afterFiles = new Map((after.customFiles ?? []).map(file => [file.relativePath, file]))
  for (const [path, afterFile] of afterFiles.entries()) {
    const beforeFile = beforeFiles.get(path)
    if (!beforeFile) changes.push(`Added file ${path}`)
    else if (beforeFile.content !== afterFile.content) changes.push(`Updated file ${path}`)
  }
  for (const path of beforeFiles.keys()) {
    if (!afterFiles.has(path)) changes.push(`Deleted file ${path}`)
  }
}

export function describeProjectChanges(before: Project, after: Project): string[] {
  if (sameValue(before, after)) return []
  const changes: string[] = []
  if (before.name !== after.name) changes.push(`Renamed pack to ${after.name}`)
  if (before.packFolderName !== after.packFolderName) changes.push(`Updated pack folder to ${after.packFolderName || 'unset'}`)
  if (!sameValue(before.pythonRequirements, after.pythonRequirements)) changes.push('Updated requirements.txt')
  if (before.pythonInstallScript !== after.pythonInstallScript) changes.push('Updated install.py')
  describeProjectFiles(changes, before, after)

  const beforeNodes = keyedById(before.nodes)
  const afterNodes = keyedById(after.nodes)
  for (const afterNode of after.nodes) {
    const beforeNode = beforeNodes.get(afterNode.id)
    if (!beforeNode) {
      changes.push(`Added node ${nodeLabel(afterNode)}`)
    } else {
      describeNodeChanges(changes, beforeNode, afterNode)
    }
  }
  for (const beforeNode of before.nodes) {
    if (!afterNodes.has(beforeNode.id)) changes.push(`Deleted node ${nodeLabel(beforeNode)}`)
  }
  return changes
}
