export const PACK_SLUG_ROOT = 'ComfyUINodeBuilder'
export const DEFAULT_PACK_FOLDER_NAME = `${PACK_SLUG_ROOT}/`

export interface PackIdentityLike {
  id?: string
  packFolderName?: string
}

export function normalizePackFolderName(raw: unknown, fallback = DEFAULT_PACK_FOLDER_NAME): string {
  const fallbackName = fallback || DEFAULT_PACK_FOLDER_NAME
  const source = typeof raw === 'string' ? raw.trim() : ''
  const withoutRoot = source === PACK_SLUG_ROOT || source.startsWith(`${PACK_SLUG_ROOT}/`)
    ? source.slice(PACK_SLUG_ROOT.length).replace(/^\/+/, '')
    : source
  const parts = withoutRoot
    .split('/')
    .map(part => normalizeSlugPart(part))
    .filter(Boolean)
  if (parts.length === 0) return fallbackName
  return `${PACK_SLUG_ROOT}/${parts.join('/')}`
}

export function packFolderRelativePath(raw: unknown, fallback = DEFAULT_PACK_FOLDER_NAME): string {
  const normalized = normalizePackFolderName(raw, fallback)
  const withoutRoot = normalized
    .slice(PACK_SLUG_ROOT.length)
    .replace(/^\/+/, '')
    .replace(/\/+$/g, '')
  return withoutRoot || PACK_SLUG_ROOT
}

function normalizeSlugPart(raw: string): string {
  const collapsed = raw
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (!collapsed) return ''
  const prefixed = /^[A-Za-z_]/.test(collapsed) ? collapsed : `Pack_${collapsed}`
  return prefixed.replace(/[^A-Za-z0-9_]/g, '_').replace(/_+/g, '_').replace(/_+$/g, '')
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
  const slashIndex = base.lastIndexOf('/')
  const prefix = slashIndex >= 0 ? base.slice(0, slashIndex + 1) : ''
  const lastPart = slashIndex >= 0 ? base.slice(slashIndex + 1) : base
  while (taken.has(`${prefix}${lastPart}_${suffix}`)) suffix += 1
  return `${prefix}${lastPart}_${suffix}`
}
