import { describe, expect, it, vi } from 'vitest'
import { streamAiChat } from '../../src/lib/aiAssistantClient'

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
})
