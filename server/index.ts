import express from 'express'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'

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

  if (!installPath || !packName || !files) {
    return res.status(400).json({ error: 'installPath, packName, and files are required' })
  }

  const customNodesDir = path.join(installPath, 'custom_nodes')
  if (!existsSync(customNodesDir)) {
    return res.status(400).json({ error: `custom_nodes directory not found at: ${customNodesDir}` })
  }

  const packDir = path.join(customNodesDir, packName)
  try {
    await mkdir(packDir, { recursive: true })
    for (const [filename, code] of Object.entries(files)) {
      await writeFile(path.join(packDir, filename), code, 'utf8')
    }
    res.json({ success: true, path: packDir })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

const PORT = 3001
app.listen(PORT, () => {
  console.log(`[helper-server] Listening on http://localhost:${PORT}`)
})
