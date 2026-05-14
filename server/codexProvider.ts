import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { Writable, Readable } from 'node:stream'
import type { AiMessage, AiProviderResult, AiStreamEvent, AiStreamSink } from './aiProviders.ts'

export interface CodexProviderRequest {
  model?: string
  reasoningEffort?: string
  messages: AiMessage[]
}

export interface CodexReasoningLevel {
  effort: string
  description?: string
}

export interface CodexModelOption {
  id: string
  label: string
  defaultReasoningEffort?: string
  supportedReasoningEfforts: CodexReasoningLevel[]
}

export interface CodexStatusResult {
  available: boolean
  detail: string
  version?: string
  configModel?: string
  configReasoningEffort?: string
  models: CodexModelOption[]
  reasoningEfforts: CodexReasoningLevel[]
}

export interface CodexProcess {
  stdin: Writable
  stdout: Readable
  stderr: Readable
  on(event: 'error', listener: (err: Error) => void): this
  on(event: 'close', listener: (code: number | null, signal: NodeJS.Signals | null) => void): this
  kill(signal?: NodeJS.Signals | number): boolean
}

export type CodexSpawn = (command: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv }) => CodexProcess

const CODEX_DEFAULT_MODEL = '__codex_default__'
const DEFAULT_REASONING_EFFORTS: CodexReasoningLevel[] = [
  { effort: 'low', description: 'Fast responses with lighter reasoning' },
  { effort: 'medium', description: 'Balanced reasoning for everyday work' },
  { effort: 'high', description: 'Greater reasoning depth' },
  { effort: 'xhigh', description: 'Extra reasoning depth for complex work' },
]

export function codexMessagesToPrompt(messages: AiMessage[]): string {
  return [
    'You are being called by ComfyUI Node Builder as a local Codex provider.',
    'Do not edit files directly. Do not run terminal commands unless absolutely necessary to answer.',
    'Return your final response for the app to parse. If changes are needed, include the JSON builder action plan requested by the system instructions.',
    '',
    ...messages.map(message => `## ${message.role.toUpperCase()}\n${message.content}`),
  ].join('\n\n')
}

function codexArgs(model: string | undefined, reasoningEffort: string | undefined, outputPath: string, json = false): string[] {
  const args = [
    'exec',
    '--sandbox',
    'read-only',
    '--cd',
    process.cwd(),
    '--output-last-message',
    outputPath,
  ]
  if (json) args.push('--json')
  const normalizedModel = model?.trim()
  if (normalizedModel && normalizedModel !== CODEX_DEFAULT_MODEL) {
    args.push('--model', normalizedModel)
  }
  const normalizedEffort = reasoningEffort?.trim()
  if (normalizedEffort) {
    args.push('-c', `model_reasoning_effort="${normalizedEffort}"`)
  }
  args.push('-')
  return args
}

function codexHome(): string {
  return process.env.CODEX_HOME || path.join(process.env.HOME || '', '.codex')
}

function parseTomlString(config: string, key: string): string | undefined {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = config.match(new RegExp(`^\\s*${escapedKey}\\s*=\\s*["']([^"']+)["']\\s*$`, 'm'))
  return match?.[1]
}

async function loadCodexConfig(): Promise<{ model?: string; reasoningEffort?: string }> {
  try {
    const config = await readFile(path.join(codexHome(), 'config.toml'), 'utf8')
    return {
      model: parseTomlString(config, 'model'),
      reasoningEffort: parseTomlString(config, 'model_reasoning_effort'),
    }
  } catch {
    return {}
  }
}

async function loadCodexModels(): Promise<CodexModelOption[]> {
  try {
    const raw = await readFile(path.join(codexHome(), 'models_cache.json'), 'utf8')
    const parsed = JSON.parse(raw) as { models?: unknown[] }
    const models = Array.isArray(parsed.models) ? parsed.models : []
    return models
      .map(item => {
        const model = item as {
          slug?: unknown
          display_name?: unknown
          default_reasoning_level?: unknown
          supported_reasoning_levels?: unknown
          visibility?: unknown
        }
        const id = typeof model.slug === 'string' ? model.slug : ''
        const levels = Array.isArray(model.supported_reasoning_levels)
          ? model.supported_reasoning_levels
              .map(level => {
                const entry = level as { effort?: unknown; description?: unknown }
                return typeof entry.effort === 'string'
                  ? { effort: entry.effort, description: typeof entry.description === 'string' ? entry.description : undefined }
                  : null
              })
              .filter((level): level is CodexReasoningLevel => Boolean(level))
          : []
        return id
          ? {
              id,
              label: typeof model.display_name === 'string' ? model.display_name : id,
              defaultReasoningEffort: typeof model.default_reasoning_level === 'string' ? model.default_reasoning_level : undefined,
              supportedReasoningEfforts: levels.length > 0 ? levels : DEFAULT_REASONING_EFFORTS,
              visibility: model.visibility,
            }
          : null
      })
      .filter((model): model is CodexModelOption & { visibility?: unknown } => Boolean(model))
      .filter(model => model.visibility !== 'hidden')
      .map(({ visibility: _visibility, ...model }) => model)
  } catch {
    return []
  }
}

async function runCodexVersion(spawnImpl: CodexSpawn): Promise<{ ok: boolean; output: string }> {
  const child = spawnImpl('codex', ['exec', '--version'], { cwd: process.cwd(), env: process.env })
  let stdout = ''
  let stderr = ''
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', chunk => { stdout += String(chunk) })
  child.stderr.on('data', chunk => { stderr += String(chunk) })
  return await new Promise(resolve => {
    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      resolve({ ok: false, output: 'codex exec --version timed out' })
    }, 5000)
    child.on('error', err => {
      clearTimeout(timeout)
      resolve({ ok: false, output: err.message })
    })
    child.on('close', code => {
      clearTimeout(timeout)
      resolve({ ok: code === 0, output: (stdout || stderr || `codex exited with code ${code}`).trim() })
    })
  })
}

export async function checkCodexStatus(spawnImpl: CodexSpawn = spawn as CodexSpawn): Promise<CodexStatusResult> {
  const [versionResult, config, models] = await Promise.all([
    runCodexVersion(spawnImpl),
    loadCodexConfig(),
    loadCodexModels(),
  ])
  const selectedModel = models.find(model => model.id === config.model) ?? models[0]
  const reasoningEfforts = selectedModel?.supportedReasoningEfforts ?? DEFAULT_REASONING_EFFORTS
  return {
    available: versionResult.ok,
    detail: versionResult.ok ? 'Local Codex is available.' : versionResult.output,
    version: versionResult.ok ? versionResult.output : undefined,
    configModel: config.model,
    configReasoningEffort: config.reasoningEffort,
    models,
    reasoningEfforts,
  }
}

export async function runCodexExec(
  request: CodexProviderRequest,
  spawnImpl: CodexSpawn = spawn as CodexSpawn,
): Promise<AiProviderResult> {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'comfyui-node-builder-codex-'))
  const outputPath = path.join(tempDir, 'last-message.txt')
  const prompt = codexMessagesToPrompt(request.messages)

  try {
    const child = spawnImpl('codex', codexArgs(request.model, request.reasoningEffort, outputPath), {
      cwd: process.cwd(),
      env: process.env,
    })
    let stdout = ''
    let stderr = ''

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => { stdout += String(chunk) })
    child.stderr.on('data', chunk => { stderr += String(chunk) })

    const resultPromise = new Promise<AiProviderResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill('SIGTERM')
        reject(new Error('Local Codex request timed out.'))
      }, 10 * 60 * 1000)

      child.on('error', err => {
        clearTimeout(timeout)
        reject(new Error(`Failed to run local Codex: ${err.message}`))
      })
      child.on('close', async (code) => {
        clearTimeout(timeout)
        if (code !== 0) {
          reject(new Error((stderr || stdout || `Codex exited with code ${code}`).trim()))
          return
        }
        try {
          const message = (await readFile(outputPath, 'utf8')).trim()
          resolve({ message })
        } catch {
          resolve({ message: stdout.trim() })
        }
      })
    })

    child.stdin.end(prompt)
    return await resultPromise
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

function textFromContentValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(textFromContentValue).join('')
  if (!value || typeof value !== 'object') return ''
  const record = value as Record<string, unknown>
  return textFromContentValue(record.text)
    || textFromContentValue(record.content)
    || textFromContentValue(record.message)
    || textFromContentValue(record.delta)
}

function codexJsonDelta(event: unknown, depth = 0): string {
  if (!event || typeof event !== 'object') return ''
  const record = event as Record<string, unknown>
  if (depth < 4) {
    const nested = codexJsonDelta(record.event, depth + 1) || codexJsonDelta(record.item, depth + 1)
    if (nested) return nested
  }
  const type = typeof record.type === 'string' ? record.type : ''
  if (!/delta/i.test(type)) return ''
  return textFromContentValue(record.delta)
    || textFromContentValue(record.text)
    || textFromContentValue(record.content)
    || textFromContentValue(record.message)
    || textFromContentValue(record.item)
}

function codexJsonSnapshot(event: unknown, depth = 0): string {
  if (!event || typeof event !== 'object') return ''
  const record = event as Record<string, unknown>
  if (depth < 4) {
    const nested = codexJsonSnapshot(record.event, depth + 1)
    if (nested) return nested
  }
  const type = typeof record.type === 'string' ? record.type : ''
  const role = typeof record.role === 'string' ? record.role : ''
  const item = record.item && typeof record.item === 'object' ? record.item as Record<string, unknown> : null
  const itemRole = item && typeof item.role === 'string' ? item.role : ''
  const looksAssistant = role === 'assistant' ||
    itemRole === 'assistant' ||
    /assistant|agent_message|output_text|message/i.test(type)
  if (!looksAssistant || /delta/i.test(type)) return ''
  return textFromContentValue(record.message)
    || textFromContentValue(record.content)
    || textFromContentValue(record.text)
    || textFromContentValue(record.output_text)
    || textFromContentValue(record.item)
}

function codexJsonStatus(event: unknown, depth = 0): string {
  if (!event || typeof event !== 'object') return ''
  const record = event as Record<string, unknown>
  if (depth < 4) {
    const nested = codexJsonStatus(record.event, depth + 1)
    if (nested) return nested
  }
  const type = typeof record.type === 'string' ? record.type : ''
  if (/assistant|agent_message|output_text|delta|message/i.test(type)) return ''
  return textFromContentValue(record.message)
}

function parseCodexJsonLine(line: string): unknown | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

function normalizedCodexModel(model: string | undefined): string | undefined {
  const normalized = model?.trim()
  return normalized && normalized !== CODEX_DEFAULT_MODEL ? normalized : undefined
}

function normalizedReasoningEffort(reasoningEffort: string | undefined): string | undefined {
  const normalized = reasoningEffort?.trim()
  return normalized || undefined
}

function codexAppServerArgs(): string[] {
  return ['app-server', '--listen', 'stdio://']
}

function appServerAgentDelta(message: unknown): string {
  if (!message || typeof message !== 'object') return ''
  const record = message as Record<string, unknown>
  if (record.method !== 'item/agentMessage/delta') return ''
  const params = record.params && typeof record.params === 'object' ? record.params as Record<string, unknown> : null
  return typeof params?.delta === 'string' ? params.delta : ''
}

function appServerCompletedAgentText(message: unknown): string {
  if (!message || typeof message !== 'object') return ''
  const record = message as Record<string, unknown>
  if (record.method !== 'item/completed') return ''
  const params = record.params && typeof record.params === 'object' ? record.params as Record<string, unknown> : null
  const item = params?.item && typeof params.item === 'object' ? params.item as Record<string, unknown> : null
  return item?.type === 'agentMessage' && typeof item.text === 'string' ? item.text : ''
}

function appServerErrorMessage(message: unknown): string {
  if (!message || typeof message !== 'object') return ''
  const record = message as Record<string, unknown>
  const error = record.error && typeof record.error === 'object' ? record.error as Record<string, unknown> : null
  return typeof error?.message === 'string' ? error.message : ''
}

async function streamCodexAppServerProvider(
  request: CodexProviderRequest,
  sink: AiStreamSink,
  spawnImpl: CodexSpawn,
): Promise<AiProviderResult> {
  await sink({ type: 'status', message: 'Starting local Codex stream...' })
  const child = spawnImpl('codex', codexAppServerArgs(), {
    cwd: process.cwd(),
    env: process.env,
  })
  const prompt = codexMessagesToPrompt(request.messages)
  let stdoutBuffer = ''
  let stderr = ''
  let streamed = ''
  let finalText = ''
  let nextId = 1
  let initializeRequestId = 0
  let threadStartRequestId = 0
  let turnStartRequestId = 0
  let threadId = ''
  let settled = false
  let eventQueue = Promise.resolve()
  const enqueue = (event: AiStreamEvent) => {
    eventQueue = eventQueue.then(() => sink(event))
    return eventQueue
  }

  function send(method: string, params: unknown): number {
    const id = nextId++
    const line = `${JSON.stringify({ id, method, params })}\n`
    queueMicrotask(() => {
      if (!settled) child.stdin.write(line)
    })
    return id
  }

  function finish(resolve: (value: AiProviderResult) => void, message: string) {
    if (settled) return
    settled = true
    void enqueue({ type: 'done', content: message }).then(() => {
      child.kill('SIGTERM')
      resolve({ message })
    })
  }

  function fail(reject: (reason?: unknown) => void, err: Error) {
    if (settled) return
    settled = true
    child.kill('SIGTERM')
    reject(err)
  }

  function handleResponse(message: unknown, reject: (reason?: unknown) => void) {
    if (!message || typeof message !== 'object') return
    const record = message as Record<string, unknown>
    if (typeof record.id !== 'number' || !record.result || typeof record.result !== 'object') return
    const result = record.result as Record<string, unknown>
    if (record.id === initializeRequestId) {
      threadStartRequestId = send('thread/start', {
        cwd: process.cwd(),
        approvalPolicy: 'never',
        sandbox: 'read-only',
        ephemeral: true,
        threadSource: 'user',
        ...(normalizedCodexModel(request.model) ? { model: normalizedCodexModel(request.model) } : {}),
      })
      return
    }
    if (record.id === threadStartRequestId) {
      const thread = result.thread && typeof result.thread === 'object' ? result.thread as Record<string, unknown> : null
      threadId = typeof thread?.id === 'string' ? thread.id : ''
      if (!threadId) {
        fail(reject, new Error('Local Codex app server did not return a thread id.'))
        return
      }
      turnStartRequestId = send('turn/start', {
        threadId,
        input: [{ type: 'text', text: prompt, text_elements: [] }],
        cwd: process.cwd(),
        approvalPolicy: 'never',
        sandboxPolicy: { type: 'readOnly', networkAccess: false },
        ...(normalizedCodexModel(request.model) ? { model: normalizedCodexModel(request.model) } : {}),
        ...(normalizedReasoningEffort(request.reasoningEffort) ? { effort: normalizedReasoningEffort(request.reasoningEffort) } : {}),
      })
      return
    }
    if (record.id === turnStartRequestId && record.error) {
      fail(reject, new Error(appServerErrorMessage(record) || 'Local Codex turn failed to start.'))
    }
  }

  function processAppServerLine(line: string, resolve: (value: AiProviderResult) => void, reject: (reason?: unknown) => void) {
    const message = parseCodexJsonLine(line)
    if (!message) return
    const error = appServerErrorMessage(message)
    if (error) {
      fail(reject, new Error(error))
      return
    }
    handleResponse(message, reject)
    const delta = appServerAgentDelta(message)
    if (delta) {
      streamed += delta
      void enqueue({ type: 'delta', content: delta })
      return
    }
    const completedText = appServerCompletedAgentText(message)
    if (completedText) {
      finalText = completedText
      if (!streamed) {
        streamed = completedText
        void enqueue({ type: 'delta', content: completedText })
      } else if (completedText.startsWith(streamed)) {
        const suffix = completedText.slice(streamed.length)
        if (suffix) {
          streamed = completedText
          void enqueue({ type: 'delta', content: suffix })
        }
      }
      return
    }
    if (message && typeof message === 'object' && (message as Record<string, unknown>).method === 'turn/completed') {
      void eventQueue.then(() => finish(resolve, finalText || streamed))
    }
  }

  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', chunk => { stderr += String(chunk) })

  const resultPromise = new Promise<AiProviderResult>((resolve, reject) => {
    const timeout = setTimeout(() => {
      fail(reject, new Error('Local Codex request timed out.'))
    }, 10 * 60 * 1000)

    child.stdout.on('data', chunk => {
      stdoutBuffer += String(chunk)
      const lines = stdoutBuffer.split(/\r?\n/)
      stdoutBuffer = lines.pop() ?? ''
      for (const line of lines) processAppServerLine(line, resolve, reject)
    })
    child.on('error', err => {
      clearTimeout(timeout)
      fail(reject, new Error(`Failed to run local Codex app server: ${err.message}`))
    })
    child.on('close', code => {
      clearTimeout(timeout)
      if (settled) return
      if (stdoutBuffer.trim()) processAppServerLine(stdoutBuffer, resolve, reject)
      if (settled) return
      const detail = stderr || `Codex app server exited with code ${code}`
      fail(reject, new Error(detail.trim()))
    })

    initializeRequestId = send('initialize', {
      clientInfo: { name: 'comfyui-node-builder', title: 'ComfyUI Node Builder', version: '0.0.0' },
      capabilities: { experimentalApi: true },
    })
  })

  return await resultPromise
}

async function streamCodexExecProvider(
  request: CodexProviderRequest,
  sink: AiStreamSink,
  spawnImpl: CodexSpawn = spawn as CodexSpawn,
): Promise<AiProviderResult> {
  await sink({ type: 'status', message: 'Running local Codex...' })
  const tempDir = await mkdtemp(path.join(tmpdir(), 'comfyui-node-builder-codex-'))
  const outputPath = path.join(tempDir, 'last-message.txt')
  const prompt = codexMessagesToPrompt(request.messages)

  try {
    const child = spawnImpl('codex', codexArgs(request.model, request.reasoningEffort, outputPath, true), {
      cwd: process.cwd(),
      env: process.env,
    })
    let stdoutBuffer = ''
    let stderr = ''
    let streamed = ''
    let eventQueue = Promise.resolve()
    const enqueue = (event: AiStreamEvent) => {
      eventQueue = eventQueue.then(() => sink(event))
      return eventQueue
    }
    const processCodexJsonLine = (line: string) => {
      const event = parseCodexJsonLine(line)
      if (!event) return
      const status = codexJsonStatus(event)
      if (status) void enqueue({ type: 'status', message: status })
      const delta = codexJsonDelta(event)
      if (delta) {
        streamed += delta
        void enqueue({ type: 'delta', content: delta })
        return
      }
      const snapshot = codexJsonSnapshot(event)
      if (snapshot && snapshot.startsWith(streamed)) {
        const suffix = snapshot.slice(streamed.length)
        if (suffix) {
          streamed = snapshot
          void enqueue({ type: 'delta', content: suffix })
        }
      }
    }

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => {
      stdoutBuffer += String(chunk)
      const lines = stdoutBuffer.split(/\r?\n/)
      stdoutBuffer = lines.pop() ?? ''
      for (const line of lines) processCodexJsonLine(line)
    })
    child.stderr.on('data', chunk => { stderr += String(chunk) })

    const resultPromise = new Promise<AiProviderResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill('SIGTERM')
        reject(new Error('Local Codex request timed out.'))
      }, 10 * 60 * 1000)

      child.on('error', err => {
        clearTimeout(timeout)
        reject(new Error(`Failed to run local Codex: ${err.message}`))
      })
      child.on('close', async (code) => {
        clearTimeout(timeout)
        if (stdoutBuffer.trim()) {
          processCodexJsonLine(stdoutBuffer)
          stdoutBuffer = ''
        }
        try {
          await eventQueue
        } catch (err) {
          reject(err)
          return
        }
        if (code !== 0) {
          reject(new Error((stderr || `Codex exited with code ${code}`).trim()))
          return
        }
        try {
          const message = (await readFile(outputPath, 'utf8')).trim()
          if (message && !streamed) await enqueue({ type: 'delta', content: message })
          else if (message && message.startsWith(streamed)) {
            const suffix = message.slice(streamed.length)
            if (suffix) await enqueue({ type: 'delta', content: suffix })
          }
          await enqueue({ type: 'done', content: message })
          resolve({ message })
        } catch {
          await enqueue({ type: 'done', content: streamed })
          resolve({ message: streamed })
        }
      })
    })

    child.stdin.end(prompt)
    return await resultPromise
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

export async function streamCodexProvider(
  request: CodexProviderRequest,
  sink: AiStreamSink,
  spawnImpl: CodexSpawn = spawn as CodexSpawn,
): Promise<AiProviderResult> {
  let sawContent = false
  try {
    return await streamCodexAppServerProvider(request, event => {
      if (event.type === 'delta' && event.content) sawContent = true
      return sink(event)
    }, spawnImpl)
  } catch (err) {
    if (sawContent) throw err
    await sink({ type: 'status', message: 'Local Codex live stream failed; using exec fallback...' })
    return await streamCodexExecProvider(request, sink, spawnImpl)
  }
}
