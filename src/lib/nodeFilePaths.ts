export function languageForPath(path: string): string {
  if (path.endsWith('.py')) return 'python'
  if (path.endsWith('.json')) return 'json'
  if (path.endsWith('.js')) return 'javascript'
  if (path.endsWith('.md')) return 'markdown'
  if (path.endsWith('.txt')) return 'plaintext'
  return 'plaintext'
}

export function normalizeCustomNodeFilePath(path: string): string | null {
  const trimmed = path.trim().replace(/\\/g, '/').replace(/^\/+/, '')
  if (!trimmed) return null
  const parts = trimmed.split('/')
  if (parts.some(part => !part || part === '.' || part === '..')) return null
  return parts.join('/')
}

export function isPersistentNodeFilePath(relativePath: string, nodeName: string): boolean {
  return relativePath === `${nodeName}.py` ||
    relativePath === 'requirements.txt' ||
    relativePath === 'install.py'
}

export function isPersistentProjectFilePath(relativePath: string): boolean {
  return relativePath === 'requirements.txt' || relativePath === 'install.py'
}

export function isReservedPackFilePath(relativePath: string, nodeName: string): boolean {
  return isPersistentNodeFilePath(relativePath, nodeName) ||
    relativePath === '__init__.py' ||
    relativePath === 'builder.project.json' ||
    relativePath === 'web/runtimeUiDisplays.js' ||
    relativePath.endsWith('.customRenderer.js')
}

export function isReservedProjectFilePath(relativePath: string, nodeNames: string[]): boolean {
  return isPersistentProjectFilePath(relativePath) ||
    nodeNames.some(nodeName => relativePath === `${nodeName}.py`) ||
    relativePath === '__init__.py' ||
    relativePath === 'builder.project.json' ||
    relativePath === 'web/runtimeUiDisplays.js' ||
    relativePath.endsWith('.customRenderer.js')
}
