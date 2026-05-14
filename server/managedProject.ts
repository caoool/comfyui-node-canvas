import path from 'path'
import { existsSync } from 'fs'
import {
  mkdir,
  readdir as fsReaddir,
  readFile as fsReadFile,
  rm,
  writeFile,
} from 'fs/promises'

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

export function isSafePackSlug(packName: unknown): packName is string {
  return typeof packName === 'string' && /^[A-Za-z_][A-Za-z0-9_]*(?:\/[A-Za-z_][A-Za-z0-9_]*)*\/?$/.test(packName)
}

function packSlugParts(packName: string = MANAGED_PACK_NAME): string[] {
  if (!isSafePackSlug(packName)) {
    throw new Error(`Unsafe pack name: ${String(packName)}`)
  }
  const trimmed = packName.replace(/\/+$/g, '')
  const parts = trimmed.split('/').filter(Boolean)
  const withoutBuilderRoot = parts[0] === MANAGED_PACK_NAME ? parts.slice(1) : parts
  return withoutBuilderRoot.length > 0 ? withoutBuilderRoot : [MANAGED_PACK_NAME]
}

function builderRootDirFor(installPath: string): string {
  return path.join(customNodesDirFor(installPath), MANAGED_PACK_NAME)
}

export function buildBuilderRootInitPy(): string {
  return `"""ComfyUI Node Builder managed package loader.

This root package is intentionally owned by the builder. ComfyUI imports only
custom_nodes/ComfyUINodeBuilder, so this file discovers generated packs under
this folder and merges their node mappings.
"""

import importlib.util
import pathlib
import re
import sys
import traceback

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}
WEB_DIRECTORY = "./web"

_ROOT = pathlib.Path(__file__).resolve().parent
_THIS_FILE = pathlib.Path(__file__).resolve()


def _module_name_for(pack_dir):
    relative = pack_dir.relative_to(_ROOT).as_posix()
    safe = re.sub(r"[^0-9A-Za-z_]+", "_", relative).strip("_") or "default"
    return f"{__name__}._builder_pack_{safe}"


def _iter_managed_pack_inits():
    for init_file in sorted(_ROOT.glob("**/__init__.py")):
        try:
            resolved = init_file.resolve()
        except OSError:
            continue
        if resolved == _THIS_FILE:
            continue
        pack_dir = init_file.parent
        if not (pack_dir / "${BUILDER_METADATA_FILE}").is_file():
            continue
        yield init_file


def _load_pack(init_file):
    pack_dir = init_file.parent
    module_name = _module_name_for(pack_dir)
    spec = importlib.util.spec_from_file_location(
        module_name,
        init_file,
        submodule_search_locations=[str(pack_dir)],
    )
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not create module spec for {init_file}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


for _init_file in _iter_managed_pack_inits():
    try:
        _pack = _load_pack(_init_file)
    except Exception:
        print(f"[ComfyUINodeBuilder] Failed to import managed pack at {_init_file.parent}:")
        traceback.print_exc()
        continue
    NODE_CLASS_MAPPINGS.update(getattr(_pack, "NODE_CLASS_MAPPINGS", {}))
    NODE_DISPLAY_NAME_MAPPINGS.update(getattr(_pack, "NODE_DISPLAY_NAME_MAPPINGS", {}))

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
`
}

export async function syncBuilderRootPackage(installPath: string): Promise<string[]> {
  const builderRoot = builderRootDirFor(installPath)
  await mkdir(builderRoot, { recursive: true })
  await writeFile(path.join(builderRoot, '__init__.py'), buildBuilderRootInitPy(), 'utf8')
  return ['__init__.py']
}

function normalizedBuilderPackName(packName: unknown, fallbackParts: string[]): string {
  if (isSafePackSlug(packName)) {
    const parts = packSlugParts(packName)
    return `${MANAGED_PACK_NAME}/${parts.join('/')}`
  }
  return `${MANAGED_PACK_NAME}/${fallbackParts.join('/')}`
}

export function managedPackDirFor(installPath: string, packName: string = MANAGED_PACK_NAME): string {
  return path.join(builderRootDirFor(installPath), ...packSlugParts(packName))
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

function isInstallerOwnedPath(relativePath: string): boolean {
  return relativePath === 'vendor' || relativePath.startsWith('vendor/')
}

export async function syncManagedPackDir(packDir: string, files: Record<string, string>): Promise<string[]> {
  const nextFilenames = new Set(Object.keys(files))
  const preserveInstallerFiles = nextFilenames.has('install.py')
  await mkdir(packDir, { recursive: true })

  async function prune(dir: string, prefix = '') {
    const entries = await fsReaddir(dir, { withFileTypes: true })
    await Promise.all(entries.map(async (entry) => {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
      const fullPath = path.join(dir, entry.name)
      if (preserveInstallerFiles && isInstallerOwnedPath(relativePath)) return
      if (entry.isDirectory()) {
        await prune(fullPath, relativePath)
        const remaining = await fsReaddir(fullPath)
        if (remaining.length === 0) await rm(fullPath, { recursive: true, force: true })
        return
      }
      if (entry.isFile() && !nextFilenames.has(relativePath)) {
        await rm(fullPath, { force: true })
      }
    }))
  }

  await prune(packDir)
  for (const [filename, content] of Object.entries(files)) {
    const filePath = packFilePathFor(packDir, filename)
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(filePath, content, 'utf8')
  }
  return Object.keys(files).sort()
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

export interface ManagedPackFilesystemEntry {
  kind: 'directory' | 'file'
  relativePath: string
}

export async function listManagedPackFilesystem(
  installPath: string,
  packName: string = MANAGED_PACK_NAME,
): Promise<ManagedPackFilesystemEntry[]> {
  const packDir = managedPackDirFor(installPath, packName)
  if (!existsSync(packDir)) return []

  const entries: ManagedPackFilesystemEntry[] = []

  async function walk(dir: string, prefix = '') {
    const dirEntries = await fsReaddir(dir, { withFileTypes: true })
    for (const entry of dirEntries) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        entries.push({ kind: 'directory', relativePath })
        await walk(fullPath, relativePath)
      } else if (entry.isFile()) {
        entries.push({ kind: 'file', relativePath })
      }
    }
  }

  await walk(packDir)
  return entries.sort((a, b) => a.relativePath.localeCompare(b.relativePath) || a.kind.localeCompare(b.kind))
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

export interface RemoveLegacyBuilderPackDirsOptions extends ListBuilderOwnedProjectsOptions {
  rm?: (candidate: string) => Promise<void>
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
    if (!entry.isDirectory() || entry.name !== MANAGED_PACK_NAME) continue
    await scanBuilderPackDir(path.join(customNodesDir, entry.name), [], packs, readFile, readdir)
  }
  return packs.sort((a, b) => a.packName.localeCompare(b.packName))
}

async function scanBuilderPackDir(
  dir: string,
  slugParts: string[],
  packs: BuilderOwnedProjectSummary[],
  readFile: (candidate: string, encoding: BufferEncoding) => Promise<string>,
  readdir: (candidate: string) => Promise<DirEntryLike[]>,
) {
  let entries: DirEntryLike[]
  try {
    entries = await readdir(dir)
  } catch {
    return
  }

  const hasMetadata = entries.some(entry => !entry.isDirectory() && entry.name === BUILDER_METADATA_FILE)
  if (hasMetadata && slugParts.length > 0) {
    const metadataPath = path.join(dir, BUILDER_METADATA_FILE)
    try {
      const project = parseBuilderOwnedProject(await readFile(metadataPath, 'utf8'))
      const projectPackName = typeof project === 'object' && project !== null && 'packFolderName' in project
        ? (project as { packFolderName?: unknown }).packFolderName
        : undefined
      packs.push({
        packName: normalizedBuilderPackName(projectPackName, slugParts),
        path: metadataPath,
        project,
      })
    } catch {
      // Ignore folders that are not owned by this builder or have broken metadata.
    }
  }

  await Promise.all(entries
    .filter(entry => entry.isDirectory())
    .map(entry => scanBuilderPackDir(path.join(dir, entry.name), [...slugParts, entry.name], packs, readFile, readdir)))
}

export async function removeLegacyBuilderPackDirs(
  installPath: string,
  options: RemoveLegacyBuilderPackDirsOptions = {},
): Promise<string[]> {
  const exists = options.exists ?? existsSync
  const readdir = options.readdir ?? ((candidate: string) => fsReaddir(candidate, { withFileTypes: true }) as Promise<DirEntryLike[]>)
  const readFile = options.readFile ?? fsReadFile
  const removeDir = options.rm ?? ((candidate: string) => rm(candidate, { recursive: true, force: true }))
  const customNodesDir = customNodesDirFor(installPath)
  if (!exists(customNodesDir)) {
    throw new Error(`custom_nodes directory not found at: ${customNodesDir}`)
  }

  const removed: string[] = []
  const entries = await readdir(customNodesDir)
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name === MANAGED_PACK_NAME) {
      removed.push(...await removeLegacyFlatBuilderRoot(path.join(customNodesDir, entry.name), readFile, readdir, removeDir))
      continue
    }
    if (!entry.isDirectory() || !isSafePackName(entry.name)) continue
    const candidateDir = path.join(customNodesDir, entry.name)
    const metadataPath = path.join(candidateDir, BUILDER_METADATA_FILE)
    try {
      parseBuilderOwnedProject(await readFile(metadataPath, 'utf8'))
      await removeDir(candidateDir)
      removed.push(entry.name)
    } catch {
      // Only remove folders that are explicitly owned by this builder.
    }
  }
  return removed.sort((a, b) => a.localeCompare(b))
}

async function removeLegacyFlatBuilderRoot(
  builderRoot: string,
  readFile: (candidate: string, encoding: BufferEncoding) => Promise<string>,
  readdir: (candidate: string) => Promise<DirEntryLike[]>,
  removeDir: (candidate: string) => Promise<void>,
): Promise<string[]> {
  const metadataPath = path.join(builderRoot, BUILDER_METADATA_FILE)
  try {
    parseBuilderOwnedProject(await readFile(metadataPath, 'utf8'))
  } catch {
    return []
  }

  const removed: string[] = []
  const entries = await readdir(builderRoot)
  await Promise.all(entries.map(async entry => {
    const candidate = path.join(builderRoot, entry.name)
    if (entry.isDirectory() && await containsBuilderMetadata(candidate, readFile, readdir)) return
    await removeDir(candidate)
    removed.push(candidate)
  }))
  return removed
}

async function containsBuilderMetadata(
  dir: string,
  readFile: (candidate: string, encoding: BufferEncoding) => Promise<string>,
  readdir: (candidate: string) => Promise<DirEntryLike[]>,
): Promise<boolean> {
  let entries: DirEntryLike[]
  try {
    entries = await readdir(dir)
  } catch {
    return false
  }
  if (entries.some(entry => !entry.isDirectory() && entry.name === BUILDER_METADATA_FILE)) {
    try {
      parseBuilderOwnedProject(await readFile(path.join(dir, BUILDER_METADATA_FILE), 'utf8'))
      return true
    } catch {
      return false
    }
  }
  for (const entry of entries) {
    if (entry.isDirectory() && await containsBuilderMetadata(path.join(dir, entry.name), readFile, readdir)) return true
  }
  return false
}
