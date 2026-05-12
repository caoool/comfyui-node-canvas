export type RestartEndpoint = {
  label: string
  method: 'POST'
  path: string
}

export type RestartAttempt = RestartEndpoint & {
  ok: boolean
  status?: number
  error?: string
}

export type RestartResult = {
  ok: boolean
  status?: number
  endpoint?: string
  attempts: RestartAttempt[]
  error?: string
}

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>

export const RESTART_ENDPOINTS: RestartEndpoint[] = [
  { label: 'Extension Manager v2', method: 'POST', path: '/v2/manager/reboot' },
  { label: 'legacy Manager', method: 'POST', path: '/manager/reboot' },
]

async function checkComfyUIReachable(origin: string, fetchImpl: FetchLike): Promise<RestartResult | null> {
  try {
    const response = await fetchImpl(`${origin}/system_stats`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!response.ok) {
      return {
        ok: false,
        attempts: [],
        status: response.status,
        error: `ComfyUI is reachable, but /system_stats returned HTTP ${response.status}.`,
      }
    }
    return null
  } catch (err) {
    return {
      ok: false,
      attempts: [],
      error: `ComfyUI is not reachable before restart: ${String(err)}`,
    }
  }
}

function summarizeAttempts(attempts: RestartAttempt[]): string {
  return attempts
    .map(attempt => `${attempt.method} ${attempt.path}${attempt.status ? ` -> HTTP ${attempt.status}` : ''}`)
    .join('; ')
}

export async function requestComfyUIRestart(origin: string, fetchImpl: FetchLike = fetch): Promise<RestartResult> {
  const attempts: RestartAttempt[] = []
  const unreachable = await checkComfyUIReachable(origin, fetchImpl)
  if (unreachable) return unreachable

  for (const endpoint of RESTART_ENDPOINTS) {
    try {
      const response = await fetchImpl(`${origin}${endpoint.path}`, {
        method: endpoint.method,
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal: AbortSignal.timeout(5000),
      })
      attempts.push({ ...endpoint, ok: response.ok, status: response.status })

      if (response.ok) {
        return { ok: true, status: response.status, endpoint: endpoint.path, attempts }
      }

      if (response.status === 403) {
        return {
          ok: false,
          status: response.status,
          attempts,
          error: 'ComfyUI Extension Manager blocked the restart request due to its security policy.',
        }
      }

      if (response.status !== 404 && response.status !== 405) {
        return {
          ok: false,
          status: response.status,
          attempts,
          error: `ComfyUI Extension Manager restart endpoint returned HTTP ${response.status}.`,
        }
      }
    } catch (err) {
      attempts.push({
        ...endpoint,
        ok: true,
        error: `Connection closed after restart request: ${String(err)}`,
      })
      return {
        ok: true,
        endpoint: endpoint.path,
        attempts,
      }
    }
  }

  return {
    ok: false,
    attempts,
    error: `ComfyUI Extension Manager restart endpoint was not found. Tried ${summarizeAttempts(attempts)}.`,
  }
}
