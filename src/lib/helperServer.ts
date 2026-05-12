const HELPER_PORT = 3001
const HELPER_PROXY_PREFIX = '/helper'

function formatHostname(hostname: string): string {
  if (!hostname) return 'localhost'
  if (hostname.includes(':') && !hostname.startsWith('[')) return `[${hostname}]`
  return hostname
}

export function helperServerOrigin(locationLike: Pick<Location, 'hostname'> | null | undefined = globalThis.location): string {
  return `http://${formatHostname(locationLike?.hostname ?? '')}:${HELPER_PORT}`
}

export function helperServerUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (import.meta.env.DEV) return `${HELPER_PROXY_PREFIX}${normalizedPath}`
  return `${helperServerOrigin()}${normalizedPath}`
}
