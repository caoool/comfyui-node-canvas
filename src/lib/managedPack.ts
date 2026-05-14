import { buildManagedProjectSnapshot, buildPackFiles } from './buildPackFiles'
import type { Project } from '../types/index'

export const MANAGED_PACK_NAME = 'ComfyUINodeBuilder'
export const BUILDER_METADATA_FILE = 'builder.project.json'
export const BUILDER_METADATA_ID = 'comfyui-node-builder'
export const BUILDER_METADATA_VERSION = 1

export interface ManagedProjectFile {
  builder: typeof BUILDER_METADATA_ID
  schemaVersion: typeof BUILDER_METADATA_VERSION
  project: Project
}

export function buildManagedProjectFile(project: Project): string {
  const metadata: ManagedProjectFile = {
    builder: BUILDER_METADATA_ID,
    schemaVersion: BUILDER_METADATA_VERSION,
    project: buildManagedProjectSnapshot(project),
  }
  return `${JSON.stringify(metadata, null, 2)}\n`
}

export function buildManagedPackFiles(project: Project): Record<string, string> {
  return {
    ...buildPackFiles(project),
    [BUILDER_METADATA_FILE]: buildManagedProjectFile(project),
  }
}

export function parseManagedProjectFile(raw: string): Project {
  const parsed = JSON.parse(raw) as Partial<ManagedProjectFile> | Project
  if (
    'builder' in parsed &&
    parsed.builder === BUILDER_METADATA_ID &&
    'schemaVersion' in parsed &&
    parsed.schemaVersion === BUILDER_METADATA_VERSION &&
    'project' in parsed &&
    parsed.project &&
    typeof parsed.project === 'object'
  ) {
    return parsed.project
  }
  throw new Error('builder.project.json is not owned by ComfyUI Node Builder')
}
