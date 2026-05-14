import { describe, expect, it, vi } from 'vitest'
import { fetchCodexStatus, streamAiChat } from '../../src/lib/aiAssistantClient'

function streamResponse(text: string): Response {
  return new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text))
      controller.close()
    },
  }), {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

describe('aiAssistantClient', () => {
  it('parses helper stream events and returns the final assistant text', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(streamResponse([
      'event: status',
      'data: {"type":"status","message":"Connecting"}',
      '',
      'event: delta',
      'data: {"type":"delta","content":"Hel"}',
      '',
      'event: delta',
      'data: {"type":"delta","content":"lo"}',
      '',
      'event: done',
      'data: {"type":"done","content":"Hello"}',
      '',
    ].join('\n')))
    const events: Array<{ type: string; content?: string; message?: string }> = []

    const result = await streamAiChat({
      provider: 'openai',
      model: 'gpt-test',
      apiKey: 'sk-test',
    }, [{ role: 'user', content: 'hi' }], event => events.push(event))

    expect(fetchMock).toHaveBeenCalledWith('/helper/ai-chat-stream', expect.objectContaining({
      method: 'POST',
    }))
    expect(result).toBe('Hello')
    expect(events).toEqual([
      { type: 'status', message: 'Connecting' },
      { type: 'delta', content: 'Hel' },
      { type: 'delta', content: 'lo' },
      { type: 'done', content: 'Hello' },
    ])
  })

  it('fetches local Codex status from the helper', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      available: true,
      detail: 'Local Codex is available.',
      version: 'codex-cli-exec 0.129.0',
      configModel: 'gpt-5.5',
      configReasoningEffort: 'medium',
      models: [
        {
          id: 'gpt-5.5',
          label: 'GPT-5.5',
          defaultReasoningEffort: 'medium',
          supportedReasoningEfforts: [{ effort: 'medium' }],
        },
      ],
      reasoningEfforts: [{ effort: 'medium' }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    const result = await fetchCodexStatus()

    expect(fetchMock).toHaveBeenCalledWith('/helper/ai-codex-status')
    expect(result.configModel).toBe('gpt-5.5')
    expect(result.reasoningEfforts).toEqual([{ effort: 'medium' }])
  })
})
