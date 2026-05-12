import { helperServerUrl } from './helperServer'

// Calls go through the local helper server so the browser
// avoids CORS issues against ComfyUI itself.

export async function checkConnection(url: string): Promise<boolean> {
  try {
    const r = await fetch(helperServerUrl('/comfyui-ping'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    if (!r.ok) {
      // Helper is up but rejected the request (e.g. invalid URL). Treat as not connected.
      return false
    }
    const data = await r.json() as { connected: boolean }
    return data.connected === true
  } catch (err) {
    // Likely the helper itself is unreachable. Surface that distinctly so the
    // user can tell ComfyUI vs helper-down apart.
    console.warn('[comfyuiApi] helper server unreachable:', err)
    return false
  }
}

export async function hotReload(comfyuiUrl: string): Promise<void> {
  // ComfyUI doesn't have a native hot-reload endpoint; we POST /free to nudge
  // it. The helper proxies the call so we sidestep CORS.
  const r = await fetch(helperServerUrl('/comfyui-free'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: comfyuiUrl }),
  })
  if (!r.ok) {
    let detail = `HTTP ${r.status}`
    try {
      const data = await r.json() as { error?: string }
      if (data?.error) detail = data.error
    } catch {}
    throw new Error(detail)
  }
}

export async function restartComfyUI(comfyuiUrl: string): Promise<void> {
  const r = await fetch(helperServerUrl('/comfyui-restart'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: comfyuiUrl }),
  })
  let data: { ok?: boolean; error?: string } | null = null
  try {
    data = await r.json() as { ok?: boolean; error?: string }
  } catch {}

  if (!r.ok) {
    throw new Error(data?.error || `HTTP ${r.status}`)
  }
  if (data?.ok === false) {
    throw new Error(data.error || 'ComfyUI restart request failed')
  }
}
