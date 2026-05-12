import { describe, expect, it, vi } from 'vitest'
import { requestComfyUIRestart } from '../../server/comfyuiRestart'

describe('requestComfyUIRestart', () => {
  it('uses the current Extension Manager v2 restart endpoint first', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response)

    const result = await requestComfyUIRestart('http://127.0.0.1:8188', fetchMock)

    expect(result).toMatchObject({
      ok: true,
      status: 200,
      endpoint: '/v2/manager/reboot',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://127.0.0.1:8188/system_stats', {
      signal: expect.any(AbortSignal),
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://127.0.0.1:8188/v2/manager/reboot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal: expect.any(AbortSignal),
    })
  })

  it('falls back to the legacy POST endpoint when v2 is not found', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response)

    const result = await requestComfyUIRestart('http://127.0.0.1:8188', fetchMock)

    expect(result).toMatchObject({
      ok: true,
      status: 200,
      endpoint: '/manager/reboot',
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://127.0.0.1:8188/v2/manager/reboot', expect.any(Object))
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'http://127.0.0.1:8188/manager/reboot', expect.any(Object))
  })

  it('reports the attempted endpoints when no restart route exists', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response)

    const result = await requestComfyUIRestart('http://127.0.0.1:8188', fetchMock)

    expect(result.ok).toBe(false)
    expect(result.error).toContain('POST /v2/manager/reboot -> HTTP 404')
    expect(result.error).toContain('POST /manager/reboot -> HTTP 404')
  })

  it('treats a dropped restart response as accepted after ComfyUI is reachable', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response)
      .mockRejectedValueOnce(new Error('fetch failed'))

    const result = await requestComfyUIRestart('http://127.0.0.1:8188', fetchMock)

    expect(result).toMatchObject({
      ok: true,
      endpoint: '/v2/manager/reboot',
    })
    expect(result.attempts[0].error).toContain('Connection closed after restart request')
  })

  it('does not report restart accepted when ComfyUI is not reachable first', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('connection refused'))

    const result = await requestComfyUIRestart('http://127.0.0.1:8188', fetchMock)

    expect(result.ok).toBe(false)
    expect(result.error).toContain('ComfyUI is not reachable before restart')
    expect(result.attempts).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
