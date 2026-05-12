import { buildManagedPackFiles } from './managedPack'
import { helperServerUrl } from './helperServer'
import { normalizePackFolderName } from './packIdentity'
import type { Project } from '../types/index'

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

export async function writePack(
  installPath: string,
  packName: string,
  files: Record<string, string>
): Promise<void> {
  await postJson('/write-pack', { installPath, packName, files })
}

export interface DeployManagedPackResult {
  success: true
  path: string
  filesWritten: string[]
  restartRequired: boolean
}

export async function deployManagedPack(
  installPath: string,
  project: Project,
): Promise<DeployManagedPackResult> {
  return postJson('/deploy-managed-pack', {
    installPath,
    packName: normalizePackFolderName(project.packFolderName || project.name),
    files: buildManagedPackFiles(project),
  })
}

export interface ReadManagedProjectResult {
  exists: boolean
  path: string
  project?: Project
}

export async function readManagedProject(
  installPath: string,
  packName?: string,
): Promise<ReadManagedProjectResult> {
  return postJson('/read-managed-project', { installPath, packName })
}

export interface ManagedProjectSummary {
  packName: string
  path: string
  project: Project
}

export interface ListManagedProjectsResult {
  packs: ManagedProjectSummary[]
}

export async function listManagedProjects(installPath: string): Promise<ListManagedProjectsResult> {
  return postJson('/list-managed-projects', { installPath })
}

export interface InstallManagedDependenciesResult {
  success: true
  python: string
  requirementsPath: string
  installScriptPath: string
  stdout: string
  stderr: string
}

export async function installManagedDependencies(
  installPath: string,
  packName?: string,
): Promise<InstallManagedDependenciesResult> {
  return postJson('/install-managed-dependencies', { installPath, packName })
}

export interface ValidateInstallPathResult {
  ok: true
  customNodesPath: string
}

export async function validateInstallPath(installPath: string): Promise<ValidateInstallPathResult> {
  return postJson('/validate-install-path', { installPath })
}
