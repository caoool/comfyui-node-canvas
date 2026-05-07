const HELPER_URL = 'http://localhost:3001'

export async function writePack(
  installPath: string,
  packName: string,
  files: Record<string, string>
): Promise<void> {
  const response = await fetch(`${HELPER_URL}/write-pack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ installPath, packName, files }),
  })
  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error ?? `HTTP ${response.status}`)
  }
}
