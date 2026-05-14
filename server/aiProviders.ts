import { runCodexExec, streamCodexProvider } from './codexProvider.ts'

export type AiProviderId = 'codex' | 'openai' | 'openai-compatible' | 'openrouter' | 'anthropic' | 'gemini' | 'ollama'

export interface AiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AiProviderRequest {
  provider: AiProviderId
  apiKey?: string
  baseUrl?: string
  model: string
  reasoningEffort?: string
  messages: AiMessage[]
  temperature?: number
}

export interface AiProviderResult {
  message: string
}

export type AiStreamEvent =
  | { type: 'status'; message: string }
  | { type: 'delta'; content: string }
  | { type: 'done'; content: string }
  | { type: 'error'; message: string }

export type AiStreamSink = (event: AiStreamEvent) => void | Promise<void>

export interface AiModelListRequest {
  provider: AiProviderId
  apiKey?: string
  baseUrl?: string
}

export interface AiModelInfo {
  id: string
  label: string
  created?: number
  rank: number
}

export interface AiModelListResult {
  models: AiModelInfo[]
}

type FetchLike = typeof fetch

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

async function postJson(fetchImpl: FetchLike, url: string, init: RequestInit): Promise<unknown> {
  const response = await fetchImpl(url, {
    ...init,
    method: 'POST',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = typeof data === 'object' && data && 'error' in data
      ? JSON.stringify((data as { error?: unknown }).error)
      : `HTTP ${response.status}`
    throw new Error(detail)
  }
  return data
}

async function getJson(fetchImpl: FetchLike, url: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetchImpl(url, {
    ...init,
    method: 'GET',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = typeof data === 'object' && data && 'error' in data
      ? JSON.stringify((data as { error?: unknown }).error)
      : `HTTP ${response.status}`
    throw new Error(detail)
  }
  return data
}

function openAiBaseUrl(request: AiProviderRequest): string {
  if (request.baseUrl) return trimTrailingSlash(request.baseUrl)
  if (request.provider === 'openrouter') return 'https://openrouter.ai/api/v1'
  return 'https://api.openai.com/v1'
}

function modelBaseUrl(request: AiModelListRequest): string {
  if (request.baseUrl) return trimTrailingSlash(request.baseUrl)
  if (request.provider === 'openrouter') return 'https://openrouter.ai/api/v1'
  if (request.provider === 'anthropic') return 'https://api.anthropic.com'
  if (request.provider === 'gemini') return 'https://generativelanguage.googleapis.com/v1beta'
  if (request.provider === 'ollama') return 'http://127.0.0.1:11434'
  return 'https://api.openai.com/v1'
}

async function callOpenAiCompatible(request: AiProviderRequest, fetchImpl: FetchLike): Promise<AiProviderResult> {
  const data = await postJson(fetchImpl, `${openAiBaseUrl(request)}/chat/completions`, {
    headers: {
      'Content-Type': 'application/json',
      ...(request.apiKey ? { Authorization: `Bearer ${request.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: request.model,
      messages: request.messages,
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    }),
  }) as { choices?: Array<{ message?: { content?: string } }> }
  return { message: data.choices?.[0]?.message?.content?.trim() ?? '' }
}

async function emit(sink: AiStreamSink, event: AiStreamEvent): Promise<void> {
  await sink(event)
}

async function readResponseText(response: Response, onChunk: (chunk: string) => Promise<void> | void): Promise<void> {
  if (!response.body) return
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      if (value) await onChunk(decoder.decode(value, { stream: true }))
    }
    const rest = decoder.decode()
    if (rest) await onChunk(rest)
  } finally {
    reader.releaseLock()
  }
}

function openAiStreamDelta(rawData: string): string {
  try {
    const parsed = JSON.parse(rawData) as {
      choices?: Array<{
        delta?: { content?: string }
        message?: { content?: string }
        text?: string
      }>
    }
    return parsed.choices?.map(choice => choice.delta?.content ?? choice.message?.content ?? choice.text ?? '').join('') ?? ''
  } catch {
    return ''
  }
}

function anthropicStreamDelta(rawData: string): string {
  try {
    const parsed = JSON.parse(rawData) as { delta?: { text?: string }; type?: string }
    return parsed.type === 'content_block_delta' ? parsed.delta?.text ?? '' : ''
  } catch {
    return ''
  }
}

function geminiStreamDelta(rawData: string): string {
  try {
    const parsed = JSON.parse(rawData) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    return parsed.candidates
      ?.flatMap(candidate => candidate.content?.parts ?? [])
      .map(part => part.text ?? '')
      .join('') ?? ''
  } catch {
    return ''
  }
}

async function responseErrorDetail(response: Response): Promise<string> {
  const data = await response.json().catch(() => ({}))
  return typeof data === 'object' && data && 'error' in data
    ? JSON.stringify((data as { error?: unknown }).error)
    : `HTTP ${response.status}`
}

async function emitSseDeltas(response: Response, sink: AiStreamSink, parseDelta: (rawData: string) => string): Promise<string> {
  let buffer = ''
  let content = ''

  async function processPart(part: string) {
    for (const line of part.split(/\r?\n/)) {
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (!data || data === '[DONE]') continue
      const delta = parseDelta(data)
      if (!delta) continue
      content += delta
      await emit(sink, { type: 'delta', content: delta })
    }
  }

  await readResponseText(response, async (chunk) => {
    buffer += chunk
    const parts = buffer.split(/\r?\n\r?\n/)
    buffer = parts.pop() ?? ''
    for (const part of parts) await processPart(part)
  })
  if (buffer.trim()) await processPart(buffer)
  return content
}

async function streamOpenAiCompatible(request: AiProviderRequest, sink: AiStreamSink, fetchImpl: FetchLike): Promise<AiProviderResult> {
  await emit(sink, { type: 'status', message: `Connecting to ${request.provider}...` })
  const response = await fetchImpl(`${openAiBaseUrl(request)}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(request.apiKey ? { Authorization: `Bearer ${request.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: request.model,
      messages: request.messages,
      stream: true,
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    }),
  })
  if (!response.ok) {
    throw new Error(await responseErrorDetail(response))
  }

  const content = await emitSseDeltas(response, sink, openAiStreamDelta)
  await emit(sink, { type: 'done', content })
  return { message: content }
}

async function streamAnthropic(request: AiProviderRequest, sink: AiStreamSink, fetchImpl: FetchLike): Promise<AiProviderResult> {
  await emit(sink, { type: 'status', message: 'Connecting to anthropic...' })
  const system = request.messages.filter(message => message.role === 'system').map(message => message.content).join('\n\n')
  const messages = request.messages
    .filter(message => message.role !== 'system')
    .map(message => ({ role: message.role === 'assistant' ? 'assistant' : 'user', content: message.content }))
  const response = await fetchImpl(`${trimTrailingSlash(request.baseUrl || 'https://api.anthropic.com')}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      ...(request.apiKey ? { 'x-api-key': request.apiKey } : {}),
    },
    body: JSON.stringify({
      model: request.model,
      system,
      messages,
      max_tokens: 4096,
      stream: true,
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    }),
  })
  if (!response.ok) throw new Error(await responseErrorDetail(response))

  const content = await emitSseDeltas(response, sink, anthropicStreamDelta)
  await emit(sink, { type: 'done', content })
  return { message: content }
}

async function streamGemini(request: AiProviderRequest, sink: AiStreamSink, fetchImpl: FetchLike): Promise<AiProviderResult> {
  await emit(sink, { type: 'status', message: 'Connecting to gemini...' })
  const baseUrl = trimTrailingSlash(request.baseUrl || 'https://generativelanguage.googleapis.com/v1beta')
  const url = `${baseUrl}/models/${encodeURIComponent(request.model)}:streamGenerateContent?key=${encodeURIComponent(request.apiKey || '')}&alt=sse`
  const systemText = request.messages.filter(message => message.role === 'system').map(message => message.content).join('\n\n')
  const contents = request.messages
    .filter(message => message.role !== 'system')
    .map(message => ({ role: geminiRole(message.role), parts: [{ text: message.content }] }))
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
      contents,
      ...(request.temperature !== undefined ? { generationConfig: { temperature: request.temperature } } : {}),
    }),
  })
  if (!response.ok) throw new Error(await responseErrorDetail(response))

  const content = await emitSseDeltas(response, sink, geminiStreamDelta)
  await emit(sink, { type: 'done', content })
  return { message: content }
}

async function streamOllama(request: AiProviderRequest, sink: AiStreamSink, fetchImpl: FetchLike): Promise<AiProviderResult> {
  await emit(sink, { type: 'status', message: 'Connecting to ollama...' })
  const response = await fetchImpl(`${trimTrailingSlash(request.baseUrl || 'http://127.0.0.1:11434')}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: request.model,
      messages: request.messages,
      stream: true,
      ...(request.temperature !== undefined ? { options: { temperature: request.temperature } } : {}),
    }),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  let buffer = ''
  let content = ''
  await readResponseText(response, async (chunk) => {
    buffer += chunk
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const parsed = JSON.parse(line) as { message?: { content?: string }; done?: boolean }
        const delta = parsed.message?.content ?? ''
        if (delta) {
          content += delta
          await emit(sink, { type: 'delta', content: delta })
        }
      } catch {}
    }
  })
  await emit(sink, { type: 'done', content })
  return { message: content }
}

export async function streamAiProvider(
  request: AiProviderRequest,
  sink: AiStreamSink,
  fetchImpl: FetchLike = fetch,
): Promise<AiProviderResult> {
  if (request.provider === 'codex') return streamCodexProvider(request, sink)
  if (!request.model?.trim()) throw new Error('AI model is required')
  if (request.provider === 'anthropic') return streamAnthropic(request, sink, fetchImpl)
  if (request.provider === 'gemini') return streamGemini(request, sink, fetchImpl)
  if (request.provider === 'ollama') return streamOllama(request, sink, fetchImpl)
  if (request.provider === 'openai' || request.provider === 'openrouter' || request.provider === 'openai-compatible') {
    return streamOpenAiCompatible(request, sink, fetchImpl)
  }
  await emit(sink, { type: 'status', message: `Waiting for ${request.provider} response...` })
  const result = await callAiProvider(request, fetchImpl)
  if (result.message) await emit(sink, { type: 'delta', content: result.message })
  await emit(sink, { type: 'done', content: result.message })
  return result
}

async function callAnthropic(request: AiProviderRequest, fetchImpl: FetchLike): Promise<AiProviderResult> {
  const system = request.messages.filter(message => message.role === 'system').map(message => message.content).join('\n\n')
  const messages = request.messages
    .filter(message => message.role !== 'system')
    .map(message => ({ role: message.role === 'assistant' ? 'assistant' : 'user', content: message.content }))
  const data = await postJson(fetchImpl, `${trimTrailingSlash(request.baseUrl || 'https://api.anthropic.com')}/v1/messages`, {
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      ...(request.apiKey ? { 'x-api-key': request.apiKey } : {}),
    },
    body: JSON.stringify({
      model: request.model,
      system,
      messages,
      max_tokens: 4096,
      temperature: request.temperature ?? 0.2,
    }),
  }) as { content?: Array<{ type?: string; text?: string }> }
  return { message: data.content?.map(block => block.text ?? '').join('').trim() ?? '' }
}

function geminiRole(role: AiMessage['role']): 'user' | 'model' {
  return role === 'assistant' ? 'model' : 'user'
}

async function callGemini(request: AiProviderRequest, fetchImpl: FetchLike): Promise<AiProviderResult> {
  const baseUrl = trimTrailingSlash(request.baseUrl || 'https://generativelanguage.googleapis.com/v1beta')
  const url = `${baseUrl}/models/${encodeURIComponent(request.model)}:generateContent?key=${encodeURIComponent(request.apiKey || '')}`
  const systemText = request.messages.filter(message => message.role === 'system').map(message => message.content).join('\n\n')
  const contents = request.messages
    .filter(message => message.role !== 'system')
    .map(message => ({ role: geminiRole(message.role), parts: [{ text: message.content }] }))
  const data = await postJson(fetchImpl, url, {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
      contents,
      generationConfig: { temperature: request.temperature ?? 0.2 },
    }),
  }) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  return { message: data.candidates?.[0]?.content?.parts?.map(part => part.text ?? '').join('').trim() ?? '' }
}

async function callOllama(request: AiProviderRequest, fetchImpl: FetchLike): Promise<AiProviderResult> {
  const data = await postJson(fetchImpl, `${trimTrailingSlash(request.baseUrl || 'http://127.0.0.1:11434')}/api/chat`, {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: request.model,
      messages: request.messages,
      stream: false,
      options: { temperature: request.temperature ?? 0.2 },
    }),
  }) as { message?: { content?: string } }
  return { message: data.message?.content?.trim() ?? '' }
}

export async function callAiProvider(request: AiProviderRequest, fetchImpl: FetchLike = fetch): Promise<AiProviderResult> {
  if (request.provider === 'codex') return runCodexExec(request)
  if (!request.model?.trim()) throw new Error('AI model is required')
  if (request.provider === 'anthropic') return callAnthropic(request, fetchImpl)
  if (request.provider === 'gemini') return callGemini(request, fetchImpl)
  if (request.provider === 'ollama') return callOllama(request, fetchImpl)
  return callOpenAiCompatible(request, fetchImpl)
}

function titleizeModelId(id: string): string {
  return id
    .replace(/^models\//, '')
    .replace(/[/:_-]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
}

function scoreModel(id: string, provider: AiProviderId, created?: number): number {
  const name = id.toLowerCase()
  let score = 0

  const familyScores: Array<[RegExp, number]> = [
    [/gpt[-_]?5/, 1200],
    [/claude[-_]?4/, 1120],
    [/gemini[-_]?2\.5/, 1080],
    [/gpt[-_]?4\.1/, 1040],
    [/gpt[-_]?4o/, 1000],
    [/\bo4\b|o4[-_]/, 960],
    [/\bo3\b|o3[-_]/, 940],
    [/claude[-_]?3[._-]?7/, 930],
    [/claude[-_]?3[._-]?5/, 900],
    [/llama[-_]?4/, 880],
    [/qwen[-_]?3/, 850],
    [/deepseek[-_]?r1/, 830],
    [/llama[-_]?3\.3/, 810],
    [/qwen[-_]?2\.5/, 790],
    [/gemini[-_]?2/, 760],
    [/gpt[-_]?4/, 740],
    [/claude[-_]?3/, 720],
    [/llama[-_]?3/, 650],
    [/gpt[-_]?3\.5/, 420],
  ]

  for (const [pattern, value] of familyScores) {
    if (pattern.test(name)) {
      score += value
      break
    }
  }

  if (/latest|current|new|preview/.test(name)) score += 90
  if (/pro|max|ultra|opus/.test(name)) score += 80
  if (/sonnet|reasoning|coder|code/.test(name)) score += 55
  if (/turbo|instruct/.test(name)) score += 20
  if (/mini|flash|haiku|nano|small|lite|8b/.test(name)) score -= 90
  if (/embedding|embed|moderation|tts|transcribe|whisper|rerank|image|vision/.test(name)) score -= 420
  if (provider === 'ollama' && /:32b|:70b|:72b|:405b/.test(name)) score += 45
  if (created) score += Math.min(180, Math.max(0, Math.floor(created / 10_000_000)))

  return score
}

function sortAndDedupeModels(provider: AiProviderId, models: Array<Omit<AiModelInfo, 'rank'>>): AiModelInfo[] {
  const seen = new Set<string>()
  return models
    .map(model => ({
      ...model,
      id: model.id.trim(),
      label: (model.label || titleizeModelId(model.id)).trim(),
      rank: scoreModel(model.id, provider, model.created),
    }))
    .filter(model => {
      if (!model.id || seen.has(model.id)) return false
      seen.add(model.id)
      return true
    })
    .sort((a, b) => b.rank - a.rank || a.label.localeCompare(b.label))
}

function parseOpenAiModels(provider: AiProviderId, data: unknown): AiModelInfo[] {
  const rawModels = Array.isArray((data as { data?: unknown[] })?.data) ? (data as { data: unknown[] }).data : []
  return sortAndDedupeModels(provider, rawModels.map(model => {
    const item = model as { id?: unknown; name?: unknown; created?: unknown }
    const id = String(item.id ?? item.name ?? '')
    return {
      id,
      label: typeof item.name === 'string' ? item.name : titleizeModelId(id),
      created: typeof item.created === 'number' ? item.created : undefined,
    }
  }))
}

function parseAnthropicModels(data: unknown): AiModelInfo[] {
  const rawModels = Array.isArray((data as { data?: unknown[] })?.data) ? (data as { data: unknown[] }).data : []
  return sortAndDedupeModels('anthropic', rawModels.map(model => {
    const item = model as { id?: unknown; display_name?: unknown; created_at?: unknown }
    const id = String(item.id ?? '')
    const createdAt = typeof item.created_at === 'string' ? Date.parse(item.created_at) : NaN
    return {
      id,
      label: typeof item.display_name === 'string' ? item.display_name : titleizeModelId(id),
      created: Number.isFinite(createdAt) ? Math.floor(createdAt / 1000) : undefined,
    }
  }))
}

function parseGeminiModels(data: unknown): AiModelInfo[] {
  const rawModels = Array.isArray((data as { models?: unknown[] })?.models) ? (data as { models: unknown[] }).models : []
  return sortAndDedupeModels('gemini', rawModels
    .filter(model => {
      const methods = (model as { supportedGenerationMethods?: unknown }).supportedGenerationMethods
      return !Array.isArray(methods) || methods.includes('generateContent')
    })
    .map(model => {
      const item = model as { name?: unknown; displayName?: unknown }
      const id = String(item.name ?? '').replace(/^models\//, '')
      return {
        id,
        label: typeof item.displayName === 'string' ? item.displayName : titleizeModelId(id),
      }
    }))
}

function parseOllamaModels(data: unknown): AiModelInfo[] {
  const rawModels = Array.isArray((data as { models?: unknown[] })?.models) ? (data as { models: unknown[] }).models : []
  return sortAndDedupeModels('ollama', rawModels.map(model => {
    const item = model as { name?: unknown; model?: unknown; modified_at?: unknown }
    const id = String(item.name ?? item.model ?? '')
    const modifiedAt = typeof item.modified_at === 'string' ? Date.parse(item.modified_at) : NaN
    return {
      id,
      label: titleizeModelId(id),
      created: Number.isFinite(modifiedAt) ? Math.floor(modifiedAt / 1000) : undefined,
    }
  }))
}

export async function listAiModels(request: AiModelListRequest, fetchImpl: FetchLike = fetch): Promise<AiModelListResult> {
  if (request.provider === 'codex') {
    return { models: [{ id: '__codex_default__', label: 'Codex default', rank: 1000 }] }
  }
  const baseUrl = modelBaseUrl(request)
  if (request.provider === 'anthropic') {
    const data = await getJson(fetchImpl, `${baseUrl}/v1/models`, {
      headers: {
        'anthropic-version': '2023-06-01',
        ...(request.apiKey ? { 'x-api-key': request.apiKey } : {}),
      },
    })
    return { models: parseAnthropicModels(data) }
  }
  if (request.provider === 'gemini') {
    const data = await getJson(fetchImpl, `${baseUrl}/models?key=${encodeURIComponent(request.apiKey || '')}`)
    return { models: parseGeminiModels(data) }
  }
  if (request.provider === 'ollama') {
    const data = await getJson(fetchImpl, `${baseUrl}/api/tags`)
    return { models: parseOllamaModels(data) }
  }
  const data = await getJson(fetchImpl, `${baseUrl}/models`, {
    headers: {
      ...(request.apiKey ? { Authorization: `Bearer ${request.apiKey}` } : {}),
    },
  })
  return { models: parseOpenAiModels(request.provider, data) }
}
