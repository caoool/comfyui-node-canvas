import { projectInstallScript, projectRequirements } from './buildPackFiles'
import { helperServerUrl } from './helperServer'
import { BUILDER_METADATA_FILE, buildManagedPackFiles } from './managedPack'
import { normalizePackFolderName } from './packIdentity'
import type { Project } from '../types/index'

export interface NodeTerminalPayload {
  projectName: string
  selectedNodeId?: string
  command: string
  files: Record<string, string>
  requirements: string[]
  installScript: string
}

export interface NodeTerminalResult {
  success: true
  command: string
  exitCode: number
  stdout: string
  stderr: string
  cwd: string
  envPath: string
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(helperServerUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error((data as { error?: string }).error ?? `HTTP ${response.status}`)
  }
  return data as T
}

export function buildNodeTerminalPayload(
  project: Project,
  selectedNodeId: string | null | undefined,
  command: string,
): NodeTerminalPayload {
  if (selectedNodeId && !project.nodes.some(candidate => candidate.id === selectedNodeId)) {
    throw new Error('Selected node was not found.')
  }

  const files = { ...buildManagedPackFiles(project) }
  delete files[BUILDER_METADATA_FILE]

  return {
    projectName: normalizePackFolderName(project.packFolderName || project.name),
    selectedNodeId: selectedNodeId ?? undefined,
    command,
    files,
    requirements: projectRequirements(project),
    installScript: projectInstallScript(project),
  }
}

export async function runNodeTerminalCommand(
  project: Project,
  selectedNodeId: string | null | undefined,
  command: string,
): Promise<NodeTerminalResult> {
  return postJson('/node-terminal/run', buildNodeTerminalPayload(project, selectedNodeId, command))
}
