import express from 'express'
import { writeFile, mkdir, readFile, readdir, unlink } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'
import { requestComfyUIRestart } from './comfyuiRestart.ts'
import { installManagedPackDependencies } from './dependencyInstaller.ts'
import { runNodeTerminalCommand } from './nodeTerminal.ts'
import { callAiProvider, listAiModels, streamAiProvider, type AiModelListRequest, type AiProviderRequest, type AiStreamEvent } from './aiProviders.ts'
import {
  builderMetadataPathFor,
  customNodesDirFor,
  isSafePackName,
  isSafePackFilePath,
  listBuilderOwnedProjects,
  managedPackDirFor,
  packFilePathFor,
  parseBuilderOwnedProject,
} from './managedProject.ts'

const app = express()
app.use(express.json({ limit: '10mb' }))

// CORS for local dev
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

// POST /write-node
// Body: { installPath: string, nodeName: string, code: string }
app.post('/write-node', async (req, res) => {
  const { installPath, nodeName, code } = req.body as {
    installPath: string
    nodeName: string
    code: string
  }

  if (!installPath || !nodeName || !code) {
    return res.status(400).json({ error: 'installPath, nodeName, and code are required' })
  }

  // Security: only allow writing inside custom_nodes/
  const customNodesDir = path.join(installPath, 'custom_nodes')
  if (!existsSync(customNodesDir)) {
    return res.status(400).json({ error: `custom_nodes directory not found at: ${customNodesDir}` })
  }

  // Write to custom_nodes/<nodeName>.py
  const filePath = path.join(customNodesDir, `${nodeName}.py`)
  try {
    await writeFile(filePath, code, 'utf8')
    res.json({ success: true, path: filePath })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// POST /write-pack
// Body: { installPath: string, packName: string, files: Record<string, string> }
// files: { 'NodeA.py': '...code...', '__init__.py': '...code...' }
app.post('/write-pack', async (req, res) => {
  const { installPath, packName, files } = req.body as {
    installPath: string
    packName: string
    files: Record<string, string>
  }

  if (!installPath || !isSafePackName(packName) || !files) {
    return res.status(400).json({ error: 'installPath, packName, and files are required' })
  }

  const customNodesDir = path.join(installPath, 'custom_nodes')
  if (!existsSync(customNodesDir)) {
    return res.status(400).json({ error: `custom_nodes directory not found at: ${customNodesDir}` })
  }

  const packDir = managedPackDirFor(installPath, packName)
  try {
    await mkdir(packDir, { recursive: true })
    for (const [filename, code] of Object.entries(files)) {
      if (!isSafePackFilePath(filename)) throw new Error(`Unsafe pack filename: ${filename}`)
      const filePath = packFilePathFor(packDir, filename)
      await mkdir(path.dirname(filePath), { recursive: true })
      await writeFile(filePath, code, 'utf8')
    }
    res.json({ success: true, path: packDir })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

function validateFileMap(files: unknown): files is Record<string, string> {
  if (!files || typeof files !== 'object' || Array.isArray(files)) return false
  for (const [filename, content] of Object.entries(files)) {
    if (typeof content !== 'string') return false
    if (!isSafePackFilePath(filename)) return false
  }
  return true
}

async function removeStaleGeneratedFiles(packDir: string, nextFilenames: Set<string>) {
  if (!existsSync(packDir)) return
  const staleFiles: string[] = []

  async function walk(dir: string, prefix = '') {
    const entries = await readdir(dir, { withFileTypes: true })
    await Promise.all(entries.map(async (entry) => {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (relativePath === 'web' || prefix.startsWith('web/')) await walk(fullPath, relativePath)
        return
      }
      if (!entry.isFile()) return
      const isGeneratedPython = !prefix && entry.name.endsWith('.py')
      const isGeneratedRequirements = !prefix && entry.name === 'requirements.txt'
      const isGeneratedFrontend = relativePath.startsWith('web/') && relativePath.endsWith('.js')
      if ((isGeneratedPython || isGeneratedRequirements || isGeneratedFrontend) && !nextFilenames.has(relativePath)) {
        staleFiles.push(fullPath)
      }
    }))
  }

  await walk(packDir)
  await Promise.all(staleFiles.map(filename => unlink(filename)))
}

// POST /validate-install-path
// Body: { installPath: string } → { ok: boolean, customNodesPath?: string, error?: string }
app.post('/validate-install-path', (req, res) => {
  const { installPath } = req.body as { installPath?: string }
  if (!installPath) return res.status(400).json({ ok: false, error: 'installPath is required' })
  const customNodesDir = customNodesDirFor(installPath)
  if (!existsSync(customNodesDir)) {
    return res.status(400).json({ ok: false, error: `custom_nodes directory not found at: ${customNodesDir}` })
  }
  res.json({ ok: true, customNodesPath: customNodesDir })
})

// POST /read-managed-project
// Body: { installPath: string, packName?: string } → { exists: boolean, path: string, project?: Project }
app.post('/read-managed-project', async (req, res) => {
  const { installPath, packName } = req.body as { installPath?: string; packName?: string }
  if (!installPath) return res.status(400).json({ error: 'installPath is required' })
  if (packName !== undefined && !isSafePackName(packName)) return res.status(400).json({ error: 'packName is unsafe' })
  const customNodesDir = customNodesDirFor(installPath)
  if (!existsSync(customNodesDir)) {
    return res.status(400).json({ error: `custom_nodes directory not found at: ${customNodesDir}` })
  }

  const metadataPath = builderMetadataPathFor(installPath, packName)
  if (!existsSync(metadataPath)) {
    return res.json({ exists: false, path: metadataPath })
  }

  try {
    const raw = await readFile(metadataPath, 'utf8')
    const project = parseBuilderOwnedProject(raw)
    res.json({ exists: true, path: metadataPath, project })
  } catch (err) {
    res.status(400).json({ error: String(err), path: metadataPath })
  }
})

// POST /list-managed-projects
// Body: { installPath: string } → { packs: [{ packName, path, project }] }
app.post('/list-managed-projects', async (req, res) => {
  const { installPath } = req.body as { installPath?: string }
  if (!installPath) return res.status(400).json({ error: 'installPath is required' })
  try {
    res.json({ packs: await listBuilderOwnedProjects(installPath) })
  } catch (err) {
    res.status(400).json({ error: String(err) })
  }
})

// POST /deploy-managed-pack
// Body: { installPath: string, packName?: string, files: Record<string, string> }
// Writes to the active builder-owned pack folder and removes stale generated files.
app.post('/deploy-managed-pack', async (req, res) => {
  const { installPath, packName, files } = req.body as {
    installPath?: string
    packName?: string
    files?: Record<string, string>
  }

  if (!installPath || !validateFileMap(files) || !isSafePackName(packName)) {
    return res.status(400).json({ error: 'installPath, safe packName, and safe files map are required' })
  }

  const customNodesDir = customNodesDirFor(installPath)
  if (!existsSync(customNodesDir)) {
    return res.status(400).json({ error: `custom_nodes directory not found at: ${customNodesDir}` })
  }

  const packDir = managedPackDirFor(installPath, packName)
  const nextFilenames = new Set(Object.keys(files))
  try {
    await mkdir(packDir, { recursive: true })
    await removeStaleGeneratedFiles(packDir, nextFilenames)
    for (const [filename, code] of Object.entries(files)) {
      const filePath = packFilePathFor(packDir, filename)
      await mkdir(path.dirname(filePath), { recursive: true })
      await writeFile(filePath, code, 'utf8')
    }
    res.json({
      success: true,
      path: packDir,
      filesWritten: Object.keys(files).sort(),
      restartRequired: true,
    })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// POST /install-managed-dependencies
// Body: { installPath: string, packName?: string } → installs the active pack's requirements.txt
// into ComfyUI's own Python environment.
app.post('/install-managed-dependencies', async (req, res) => {
  const { installPath, packName } = req.body as { installPath?: string; packName?: string }
  if (!installPath) return res.status(400).json({ error: 'installPath is required' })
  if (packName !== undefined && !isSafePackName(packName)) return res.status(400).json({ error: 'packName is unsafe' })
  const customNodesDir = customNodesDirFor(installPath)
  if (!existsSync(customNodesDir)) {
    return res.status(400).json({ error: `custom_nodes directory not found at: ${customNodesDir}` })
  }

  try {
    res.json(await installManagedPackDependencies(installPath, packName))
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// Loopback-only allowlist for ComfyUI proxy endpoints. Without this, any web
// page in the user's browser could use these proxies to scan or POST into
// the user's internal network (SSRF via the localhost-CORS gap).
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'])

function parseLoopbackUrl(raw: unknown): URL | null {
  if (typeof raw !== 'string' || !raw) return null
  try {
    const u = new URL(raw)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (!LOOPBACK_HOSTS.has(u.hostname)) return null
    return u
  } catch {
    return null
  }
}

function requestOriginIsLoopback(req: express.Request): boolean {
  const origin = req.get('origin')
  if (!origin) return true
  return Boolean(parseLoopbackUrl(origin))
}

// POST /node-terminal/run
// Body: { projectName, selectedNodeId, command, files, requirements, installScript }
// Creates/updates a shared pack-level uv environment under this builder repo,
// then runs the command with that venv first on PATH and cwd set to the pack workspace.
app.post('/node-terminal/run', async (req, res) => {
  if (!requestOriginIsLoopback(req)) {
    return res.status(403).json({ error: 'node terminal commands are only accepted from loopback origins' })
  }

  try {
    res.json(await runNodeTerminalCommand(req.body))
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// POST /ai-chat
// Body: AiProviderRequest → { message: string }
// Provider keys are supplied per request and are not persisted by the helper.
app.post('/ai-chat', async (req, res) => {
  if (!requestOriginIsLoopback(req)) {
    return res.status(403).json({ error: 'AI chat requests are only accepted from loopback origins' })
  }
  try {
    const body = req.body as AiProviderRequest
    res.json(await callAiProvider(body))
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

function writeAiStreamEvent(res: express.Response, event: AiStreamEvent) {
  res.write(`event: ${event.type}\n`)
  res.write(`data: ${JSON.stringify(event)}\n\n`)
}

// POST /ai-chat-stream
// Body: AiProviderRequest -> text/event-stream of AiStreamEvent records.
app.post('/ai-chat-stream', async (req, res) => {
  if (!requestOriginIsLoopback(req)) {
    return res.status(403).json({ error: 'AI chat requests are only accepted from loopback origins' })
  }
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()
  try {
    const body = req.body as AiProviderRequest
    await streamAiProvider(body, event => writeAiStreamEvent(res, event))
  } catch (err) {
    writeAiStreamEvent(res, { type: 'error', message: String(err) })
  } finally {
    res.end()
  }
})

// POST /ai-models
// Body: AiModelListRequest → { models: [{ id, label, rank }] }
// Fetches provider-visible models through the helper so browser CORS and API
// keys stay out of direct frontend requests.
app.post('/ai-models', async (req, res) => {
  if (!requestOriginIsLoopback(req)) {
    return res.status(403).json({ error: 'AI model list requests are only accepted from loopback origins' })
  }
  try {
    const body = req.body as AiModelListRequest
    res.json(await listAiModels(body))
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// POST /comfyui-ping
// Body: { url: string }  → { connected: boolean }
// Server-side ping bypasses browser CORS restrictions on ComfyUI's /system_stats.
app.post('/comfyui-ping', async (req, res) => {
  const u = parseLoopbackUrl((req.body as { url?: unknown })?.url)
  if (!u) return res.status(400).json({ error: 'url must be a loopback http(s) URL' })
  try {
    const r = await fetch(`${u.origin}/system_stats`, {
      signal: AbortSignal.timeout(3000),
    })
    res.json({ connected: r.ok })
  } catch {
    res.json({ connected: false })
  }
})

// POST /comfyui-free
// Body: { url: string }  → { ok: boolean, status?: number, error?: string }
// Forwards a ComfyUI /free POST so the browser doesn't hit CORS.
app.post('/comfyui-free', async (req, res) => {
  const u = parseLoopbackUrl((req.body as { url?: unknown })?.url)
  if (!u) return res.status(400).json({ error: 'url must be a loopback http(s) URL' })
  try {
    const r = await fetch(`${u.origin}/free`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unload_models: false, free_memory: false }),
      signal: AbortSignal.timeout(5000),
    })
    res.json({ ok: r.ok, status: r.status })
  } catch (err) {
    res.status(502).json({ ok: false, error: String(err) })
  }
})

// POST /comfyui-restart
// Body: { url: string } → { ok: boolean, status?: number, error?: string }
// Requests a ComfyUI Extension Manager reboot. This does not manage the
// ComfyUI process; it only calls ComfyUI's own restart endpoint when enabled.
app.post('/comfyui-restart', async (req, res) => {
  const u = parseLoopbackUrl((req.body as { url?: unknown })?.url)
  if (!u) return res.status(400).json({ error: 'url must be a loopback http(s) URL' })
  res.json(await requestComfyUIRestart(u.origin))
})

const PORT = 3001
// Bind to loopback only — keeps LAN peers off the helper.
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[helper-server] Listening on http://127.0.0.1:${PORT}`)
})
