import { describe, expect, it, vi, afterEach } from 'vitest'
import { restartComfyUI } from '../../src/lib/comfyuiApi'

describe('comfyuiApi', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('requests ComfyUI restart through the helper server', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, status: 200 }),
    } as Response)

    await restartComfyUI('http://127.0.0.1:8188')

    expect(fetchMock).toHaveBeenCalledWith('/helper/comfyui-restart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'http://127.0.0.1:8188' }),
    })
  })

  it('surfaces helper restart errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ error: 'Extension Manager restart endpoint is unavailable' }),
    } as Response)

    await expect(restartComfyUI('http://127.0.0.1:8188')).rejects.toThrow('Extension Manager restart endpoint is unavailable')
  })

  it('surfaces restart status failures without requiring helper HTTP errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: false, error: 'Extension Manager restart endpoint is unavailable' }),
    } as Response)

    await expect(restartComfyUI('http://127.0.0.1:8188')).rejects.toThrow('Extension Manager restart endpoint is unavailable')
  })
})
