import { describe, expect, it, vi } from 'vitest'
import { callAiProvider, listAiModels, streamAiProvider } from '../../server/aiProviders'

describe('aiProviders', () => {
  it('calls OpenAI-compatible chat completions without forcing temperature by default', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'hello' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    const result = await callAiProvider({
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-test',
      messages: [{ role: 'user', content: 'hi' }],
    }, fetchMock)

    expect(fetchMock).toHaveBeenCalledWith('https://api.openai.com/v1/chat/completions', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer sk-test' }),
    }))
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({
      model: 'gpt-test',
      messages: [{ role: 'user', content: 'hi' }],
    })
    expect(result).toEqual({ message: 'hello' })
  })

  it('sends OpenAI-compatible temperature only when explicitly configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'hello' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    await callAiProvider({
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-test',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 1,
    }, fetchMock)

    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({
      model: 'gpt-test',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 1,
    })
  })

  it('streams OpenAI-compatible chat chunks and returns the final text', async () => {
    const body = [
      'data: {"choices":[{"delta":{"content":"Hel"}}]}',
      '',
      'data: {"choices":[{"delta":{"content":"lo"}}]}',
      '',
      'data: [DONE]',
      '',
    ].join('\n')
    const fetchMock = vi.fn().mockResolvedValue(new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }))
    const events: Array<{ type: string; content?: string; message?: string }> = []

    const result = await streamAiProvider({
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-test',
      messages: [{ role: 'user', content: 'hi' }],
    }, event => events.push(event), fetchMock)

    expect(fetchMock).toHaveBeenCalledWith('https://api.openai.com/v1/chat/completions', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer sk-test' }),
    }))
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({
      model: 'gpt-test',
      messages: [{ role: 'user', content: 'hi' }],
      stream: true,
    })
    expect(events).toEqual([
      { type: 'status', message: 'Connecting to openai...' },
      { type: 'delta', content: 'Hel' },
      { type: 'delta', content: 'lo' },
      { type: 'done', content: 'Hello' },
    ])
    expect(result).toEqual({ message: 'Hello' })
  })

  it('streams Anthropic message chunks and returns the final text', async () => {
    const body = [
      'event: content_block_delta',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hel"}}',
      '',
      'event: content_block_delta',
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"lo"}}',
      '',
      'event: message_stop',
      'data: {"type":"message_stop"}',
      '',
    ].join('\n')
    const fetchMock = vi.fn().mockResolvedValue(new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }))
    const events: Array<{ type: string; content?: string; message?: string }> = []

    const result = await streamAiProvider({
      provider: 'anthropic',
      apiKey: 'anthropic-key',
      model: 'claude-test',
      messages: [
        { role: 'system', content: 'system prompt' },
        { role: 'user', content: 'hi' },
      ],
    }, event => events.push(event), fetchMock)

    expect(fetchMock).toHaveBeenCalledWith('https://api.anthropic.com/v1/messages', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'x-api-key': 'anthropic-key' }),
    }))
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toMatchObject({
      model: 'claude-test',
      system: 'system prompt',
      messages: [{ role: 'user', content: 'hi' }],
      stream: true,
    })
    expect(events).toEqual([
      { type: 'status', message: 'Connecting to anthropic...' },
      { type: 'delta', content: 'Hel' },
      { type: 'delta', content: 'lo' },
      { type: 'done', content: 'Hello' },
    ])
    expect(result).toEqual({ message: 'Hello' })
  })

  it('streams Gemini content chunks and returns the final text', async () => {
    const body = [
      'data: {"candidates":[{"content":{"parts":[{"text":"Ge"}]}}]}',
      '',
      'data: {"candidates":[{"content":{"parts":[{"text":"mini"}]}}]}',
      '',
    ].join('\n')
    const fetchMock = vi.fn().mockResolvedValue(new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }))
    const events: Array<{ type: string; content?: string; message?: string }> = []

    const result = await streamAiProvider({
      provider: 'gemini',
      apiKey: 'gemini-key',
      model: 'gemini-test',
      messages: [{ role: 'user', content: 'hi' }],
    }, event => events.push(event), fetchMock)

    expect(fetchMock.mock.calls[0][0]).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-test:streamGenerateContent?key=gemini-key&alt=sse')
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({
      contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
    })
    expect(events).toEqual([
      { type: 'status', message: 'Connecting to gemini...' },
      { type: 'delta', content: 'Ge' },
      { type: 'delta', content: 'mini' },
      { type: 'done', content: 'Gemini' },
    ])
    expect(result).toEqual({ message: 'Gemini' })
  })

  it('calls Anthropic messages API and parses text blocks', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      content: [{ type: 'text', text: 'anthropic reply' }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    const result = await callAiProvider({
      provider: 'anthropic',
      apiKey: 'anthropic-key',
      model: 'claude-test',
      messages: [
        { role: 'system', content: 'system prompt' },
        { role: 'user', content: 'hi' },
      ],
    }, fetchMock)

    expect(fetchMock).toHaveBeenCalledWith('https://api.anthropic.com/v1/messages', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'x-api-key': 'anthropic-key' }),
    }))
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toMatchObject({
      model: 'claude-test',
      system: 'system prompt',
      messages: [{ role: 'user', content: 'hi' }],
    })
    expect(result.message).toBe('anthropic reply')
  })

  it('calls Gemini generateContent and parses text parts', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'gemini reply' }] } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    const result = await callAiProvider({
      provider: 'gemini',
      apiKey: 'gemini-key',
      model: 'gemini-test',
      messages: [{ role: 'user', content: 'hi' }],
    }, fetchMock)

    expect(fetchMock.mock.calls[0][0]).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent?key=gemini-key')
    expect(result.message).toBe('gemini reply')
  })

  it('fetches and ranks OpenAI-compatible models with stronger recent models first', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [
        { id: 'text-embedding-3-small', created: 2000000000 },
        { id: 'gpt-4.1-mini', created: 1900000000 },
        { id: 'gpt-3.5-turbo', created: 1700000000 },
        { id: 'gpt-5-pro', created: 1800000000 },
        { id: 'gpt-4.1', created: 1900000000 },
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    const result = await listAiModels({
      provider: 'openai',
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com/v1',
    }, fetchMock)

    expect(fetchMock).toHaveBeenCalledWith('https://api.openai.com/v1/models', expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({ Authorization: 'Bearer sk-test' }),
    }))
    expect(result.models.map(model => model.id)).toEqual([
      'gpt-5-pro',
      'gpt-4.1',
      'gpt-4.1-mini',
      'gpt-3.5-turbo',
      'text-embedding-3-small',
    ])
  })

  it('normalizes Gemini and Ollama model list responses', async () => {
    const geminiFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      models: [
        { name: 'models/gemini-1.5-flash', displayName: 'Gemini 1.5 Flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/embedding-001', displayName: 'Embedding', supportedGenerationMethods: ['embedContent'] },
        { name: 'models/gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', supportedGenerationMethods: ['generateContent'] },
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const ollamaFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      models: [
        { name: 'llama3.1:8b', modified_at: '2025-01-01T00:00:00Z' },
        { name: 'qwen2.5-coder:32b', modified_at: '2025-02-01T00:00:00Z' },
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    const gemini = await listAiModels({ provider: 'gemini', apiKey: 'gemini-key', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' }, geminiFetch)
    const ollama = await listAiModels({ provider: 'ollama', baseUrl: 'http://127.0.0.1:11434' }, ollamaFetch)

    expect(gemini.models.map(model => model.id)).toEqual(['gemini-2.5-pro', 'gemini-1.5-flash'])
    expect(ollama.models.map(model => model.id)).toEqual(['qwen2.5-coder:32b', 'llama3.1:8b'])
  })
})
