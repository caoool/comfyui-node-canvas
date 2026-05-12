export const DEFAULT_PACK_FOLDER_NAME = 'ComfyUINodeBuilder'

export interface PackIdentityLike {
  id?: string
  packFolderName?: string
}

export function normalizePackFolderName(raw: unknown, fallback = DEFAULT_PACK_FOLDER_NAME): string {
  const fallbackName = fallback || DEFAULT_PACK_FOLDER_NAME
  const source = typeof raw === 'string' ? raw.trim() : ''
  const collapsed = source
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
  let name = collapsed || fallbackName
  if (!/^[A-Za-z_]/.test(name)) name = `Pack_${name}`
  name = name.replace(/[^A-Za-z0-9_]/g, '_').replace(/_+/g, '_').replace(/_+$/g, '')
  return name || fallbackName
}

export function uniquePackFolderName(
  raw: unknown,
  projects: PackIdentityLike[],
  excludeId: string | null = null,
): string {
  const base = normalizePackFolderName(raw)
  const taken = new Set(
    projects
      .filter(project => !excludeId || project.id !== excludeId)
      .map(project => normalizePackFolderName(project.packFolderName)),
  )
  if (!taken.has(base)) return base
  let suffix = 2
  while (taken.has(`${base}_${suffix}`)) suffix += 1
  return `${base}_${suffix}`
}
