import axios from 'axios'

export async function checkConnection(url: string): Promise<boolean> {
  try {
    const response = await axios.get(`${url}/system_stats`, { timeout: 3000 })
    return response.status === 200
  } catch {
    return false
  }
}

export async function hotReload(comfyuiUrl: string): Promise<void> {
  // ComfyUI doesn't have a native hot-reload endpoint
  // We send a POST to /free to release memory, then the nodes reload on next use
  // This is the best available mechanism
  await axios.post(`${comfyuiUrl}/free`, { unload_models: false, free_memory: false }, { timeout: 5000 })
}
