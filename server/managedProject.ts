import path from 'path'
import { existsSync } from 'fs'
import { readdir as fsReaddir, readFile as fsReadFile } from 'fs/promises'

export const MANAGED_PACK_NAME = 'ComfyUINodeBuilder'
export const BUILDER_METADATA_FILE = 'builder.project.json'
export const BUILDER_METADATA_ID = 'comfyui-node-builder'
export const BUILDER_METADATA_VERSION = 1

export function customNodesDirFor(installPath: string): string {
  return path.join(installPath, 'custom_nodes')
}

export function isSafePackName(packName: unknown): packName is string {
  return typeof packName === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(packName)
}

export function managedPackDirFor(installPath: string, packName: string = MANAGED_PACK_NAME): string {
  if (!isSafePackName(packName)) {
    throw new Error(`Unsafe pack name: ${String(packName)}`)
  }
  return path.join(customNodesDirFor(installPath), packName)
}

export function builderMetadataPathFor(installPath: string, packName: string = MANAGED_PACK_NAME): string {
  return path.join(managedPackDirFor(installPath, packName), BUILDER_METADATA_FILE)
}

export function isSafePackFilePath(filename: unknown): filename is string {
  if (typeof filename !== 'string' || !filename) return false
  if (path.isAbsolute(filename) || filename.includes('\\')) return false

  const normalized = path.posix.normalize(filename)
  if (normalized !== filename) return false

  const parts = filename.split('/')
  return parts.every(part => part !== '' && part !== '.' && part !== '..')
}

export function packFilePathFor(packDir: string, filename: string): string {
  if (!isSafePackFilePath(filename)) {
    throw new Error(`Unsafe pack filename: ${filename}`)
  }
  const resolvedPackDir = path.resolve(packDir)
  const resolvedFilePath = path.resolve(packDir, filename)
  if (resolvedFilePath !== resolvedPackDir && !resolvedFilePath.startsWith(`${resolvedPackDir}${path.sep}`)) {
    throw new Error(`Unsafe pack filename: ${filename}`)
  }
  return resolvedFilePath
}

export function parseBuilderOwnedProject(raw: string): unknown {
  const metadata = JSON.parse(raw) as {
    builder?: unknown
    schemaVersion?: unknown
    project?: unknown
  }
  if (
    metadata.builder !== BUILDER_METADATA_ID ||
    metadata.schemaVersion !== BUILDER_METADATA_VERSION ||
    !metadata.project ||
    typeof metadata.project !== 'object'
  ) {
    throw new Error('builder.project.json is not owned by ComfyUI Node Builder')
  }
  return metadata.project
}

type DirEntryLike = {
  name: string
  isDirectory: () => boolean
}

export interface BuilderOwnedProjectSummary {
  packName: string
  path: string
  project: unknown
}

export interface ListBuilderOwnedProjectsOptions {
  exists?: (candidate: string) => boolean
  readdir?: (candidate: string) => Promise<DirEntryLike[]>
  readFile?: (candidate: string, encoding: BufferEncoding) => Promise<string>
}

export async function listBuilderOwnedProjects(
  installPath: string,
  options: ListBuilderOwnedProjectsOptions = {},
): Promise<BuilderOwnedProjectSummary[]> {
  const exists = options.exists ?? existsSync
  const readdir = options.readdir ?? ((candidate: string) => fsReaddir(candidate, { withFileTypes: true }) as Promise<DirEntryLike[]>)
  const readFile = options.readFile ?? fsReadFile
  const customNodesDir = customNodesDirFor(installPath)
  if (!exists(customNodesDir)) {
    throw new Error(`custom_nodes directory not found at: ${customNodesDir}`)
  }

  const entries = await readdir(customNodesDir)
  const packs: BuilderOwnedProjectSummary[] = []
  for (const entry of entries) {
    if (!entry.isDirectory() || !isSafePackName(entry.name)) continue
    const metadataPath = builderMetadataPathFor(installPath, entry.name)
    try {
      const raw = await readFile(metadataPath, 'utf8')
      const project = parseBuilderOwnedProject(raw)
      packs.push({ packName: entry.name, path: metadataPath, project })
    } catch {
      // Ignore folders that are not owned by this builder or have broken metadata.
    }
  }
  return packs.sort((a, b) => a.packName.localeCompare(b.packName))
}
