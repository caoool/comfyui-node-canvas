import { helperServerUrl } from './helperServer'

export interface AiChatProviderConfig {
  provider: 'openai' | 'openai-compatible' | 'openrouter' | 'anthropic' | 'gemini' | 'ollama'
  apiKey?: string
  baseUrl?: string
  model: string
}

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AiModelOption {
  id: string
  label: string
  rank?: number
}

export type AiChatStreamEvent =
  | { type: 'status'; message: string }
  | { type: 'delta'; content: string }
  | { type: 'done'; content: string }
  | { type: 'error'; message: string }

export async function sendAiChat(config: AiChatProviderConfig, messages: AiChatMessage[]): Promise<string> {
  const response = await fetch(helperServerUrl('/ai-chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...config, messages }),
  })
  const data = await response.json().catch(() => ({})) as { message?: string; error?: string }
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)
  return data.message ?? ''
}

function parseStreamEvent(block: string): AiChatStreamEvent | null {
  const data = block
    .split(/\r?\n/)
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice(5).trimStart())
    .join('\n')
    .trim()
  if (!data) return null
  try {
    const parsed = JSON.parse(data) as AiChatStreamEvent
    if (parsed.type === 'status' || parsed.type === 'delta' || parsed.type === 'done' || parsed.type === 'error') return parsed
  } catch {
    return null
  }
  return null
}

export async function streamAiChat(
  config: AiChatProviderConfig,
  messages: AiChatMessage[],
  onEvent?: (event: AiChatStreamEvent) => void,
): Promise<string> {
  const response = await fetch(helperServerUrl('/ai-chat-stream'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...config, messages }),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(data.error || `HTTP ${response.status}`)
  }
  if (!response.body) return response.text()

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let streamed = ''
  let finalText = ''

  const processBlock = (block: string) => {
    const event = parseStreamEvent(block)
    if (!event) return
    onEvent?.(event)
    if (event.type === 'delta') streamed += event.content
    if (event.type === 'done') finalText = event.content
    if (event.type === 'error') throw new Error(event.message)
  }

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const blocks = buffer.split(/\r?\n\r?\n/)
      buffer = blocks.pop() ?? ''
      for (const block of blocks) processBlock(block)
    }
    buffer += decoder.decode()
    if (buffer.trim()) processBlock(buffer)
  } finally {
    reader.releaseLock()
  }

  return finalText || streamed
}

export async function fetchAiModels(config: Pick<AiChatProviderConfig, 'provider' | 'apiKey' | 'baseUrl'>): Promise<AiModelOption[]> {
  const response = await fetch(helperServerUrl('/ai-models'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
  const data = await response.json().catch(() => ({})) as { models?: AiModelOption[]; error?: string }
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)
  return Array.isArray(data.models) ? data.models : []
}
