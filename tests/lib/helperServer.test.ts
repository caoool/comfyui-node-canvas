import { describe, expect, it } from 'vitest'
import { helperServerOrigin, helperServerUrl } from '../../src/lib/helperServer'

describe('helperServer', () => {
  it('routes helper calls through the Vite same-origin proxy in development', () => {
    expect(helperServerUrl('/install-managed-dependencies')).toBe('/helper/install-managed-dependencies')
    expect(helperServerUrl('comfyui-restart')).toBe('/helper/comfyui-restart')
  })

  it('uses the page hostname so WSL/LAN browser sessions do not call Windows localhost', () => {
    expect(helperServerOrigin({ hostname: '172.20.10.2' } as Location)).toBe('http://172.20.10.2:3001')
  })

  it('falls back to localhost when no browser hostname is available', () => {
    expect(helperServerOrigin(null)).toBe('http://localhost:3001')
  })
})
