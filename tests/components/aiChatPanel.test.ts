import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AiChatPanel from '../../src/components/AiChatPanel.vue'
import { useProjectStore } from '../../src/stores/project'
import { useUiStore } from '../../src/stores/ui'

describe('AiChatPanel', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  function helperStreamResponse(content: string, status = 'Connected'): Response {
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode([
          'event: status',
          `data: ${JSON.stringify({ type: 'status', message: status })}`,
          '',
          'event: delta',
          `data: ${JSON.stringify({ type: 'delta', content })}`,
          '',
          'event: done',
          `data: ${JSON.stringify({ type: 'done', content })}`,
          '',
        ].join('\n')))
        controller.close()
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  function slowHelperStreamResponse(content: string, status = 'Connected'): Response {
    return new Response(new ReadableStream({
      async start(controller) {
        controller.enqueue(new TextEncoder().encode(`${[
          'event: status',
          `data: ${JSON.stringify({ type: 'status', message: status })}`,
          '',
          'event: delta',
          `data: ${JSON.stringify({ type: 'delta', content })}`,
          '',
        ].join('\n')}\n`))
        await new Promise(resolve => setTimeout(resolve, 20))
        controller.enqueue(new TextEncoder().encode(`${[
          'event: done',
          `data: ${JSON.stringify({ type: 'done', content })}`,
          '',
        ].join('\n')}\n`))
        controller.close()
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  async function openAiSettings(wrapper: ReturnType<typeof mount<typeof AiChatPanel>>) {
    await wrapper.get('[data-testid="ai-settings-button"]').trigger('click')
    await flushPromises()
  }

  it('asks the provider proxy and applies returned builder actions', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(helperStreamResponse(
      '```json\n{"reply":"Created concat node.","actions":[{"type":"create_node","templateId":"blank","node":{"name":"ConcatText","displayName":"Concat Text","category":"ComfyUINodeBuilder","inputs":[{"name":"left","type":"STRING","optional":false,"isWidget":true},{"name":"right","type":"STRING","optional":false,"isWidget":true}],"outputs":[{"name":"text","type":"STRING","optional":false,"isWidget":false}],"code":"return (left + right,)"}}]}\n```',
    ))
    const projectStore = useProjectStore()
    const wrapper = mount(AiChatPanel)

    await openAiSettings(wrapper)
    await wrapper.get('[data-testid="ai-api-key"]').setValue('sk-test')
    await wrapper.get('[data-testid="ai-prompt"]').setValue('Create a concat text node')
    await wrapper.get('form.prompt-row').trigger('submit.prevent')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/helper/ai-chat-stream', expect.objectContaining({
      method: 'POST',
    }))
    expect(projectStore.project.nodes[0]).toMatchObject({
      name: 'ConcatText',
      displayName: 'Concat Text',
    })
    expect(wrapper.text()).toContain('Created concat node.')
    expect(wrapper.text()).toContain('Created node ConcatText.')
  })

  it('prefills provider base urls and allows selectable or manual model names', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(helperStreamResponse('Manual model accepted.'))
    const wrapper = mount(AiChatPanel)

    expect(wrapper.find('[data-testid="ai-settings-popover"]').exists()).toBe(false)
    await openAiSettings(wrapper)
    expect(wrapper.find('[data-testid="ai-settings-popover"]').exists()).toBe(true)
    expect((wrapper.get('[data-testid="ai-base-url"]').element as HTMLInputElement).value).toBe('https://api.openai.com/v1')
    expect((wrapper.get('[data-testid="ai-model-preset"]').element as HTMLSelectElement).value).toBe('gpt-4.1-mini')

    await wrapper.get('[data-testid="ai-provider"]').setValue('anthropic')

    expect((wrapper.get('[data-testid="ai-base-url"]').element as HTMLInputElement).value).toBe('https://api.anthropic.com')
    expect((wrapper.get('[data-testid="ai-model-preset"]').element as HTMLSelectElement).value).toBe('claude-3-5-sonnet-latest')

    expect((wrapper.get('[data-testid="ai-model-input"]').element as HTMLInputElement).disabled).toBe(true)
    await wrapper.get('[data-testid="ai-model-preset"]').setValue('__custom__')
    expect((wrapper.get('[data-testid="ai-model-input"]').element as HTMLInputElement).disabled).toBe(false)
    await wrapper.get('[data-testid="ai-model-input"]').setValue('claude-custom-build')
    await wrapper.get('[data-testid="ai-api-key"]').setValue('sk-test')
    await wrapper.get('[data-testid="ai-prompt"]').setValue('Use the custom model')
    await wrapper.get('form.prompt-row').trigger('submit.prevent')
    await flushPromises()

    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(request.provider).toBe('anthropic')
    expect(request.baseUrl).toBe('https://api.anthropic.com')
    expect(request.model).toBe('claude-custom-build')
  })

  it('fetches provider models and places ranked fetched models above manual input', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      models: [
        { id: 'gpt-5-pro', label: 'GPT-5 Pro' },
        { id: 'gpt-4.1', label: 'GPT-4.1' },
        { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const wrapper = mount(AiChatPanel)

    await openAiSettings(wrapper)
    await wrapper.get('[data-testid="ai-api-key"]').setValue('sk-test')
    await wrapper.get('[data-testid="ai-refresh-models"]').trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/helper/ai-models', expect.objectContaining({
      method: 'POST',
    }))
    const options = wrapper.findAll('[data-testid="ai-model-preset"] option').map(option => ({
      value: (option.element as HTMLOptionElement).value,
      text: option.text(),
    }))
    expect(options.slice(0, 4)).toEqual([
      { value: 'gpt-5-pro', text: 'GPT-5 Pro' },
      { value: 'gpt-4.1', text: 'GPT-4.1' },
      { value: 'gpt-4.1-mini', text: 'GPT-4.1 Mini' },
      { value: '__custom__', text: 'Custom model...' },
    ])
    expect((wrapper.get('[data-testid="ai-model-preset"]').element as HTMLSelectElement).value).toBe('gpt-5-pro')
    expect((wrapper.get('[data-testid="ai-model-input"]').element as HTMLInputElement).value).toBe('gpt-5-pro')
    expect((wrapper.get('[data-testid="ai-model-input"]').element as HTMLInputElement).disabled).toBe(true)
    expect(wrapper.text()).toContain('Fetched 3 models')
  })

  it('shows concise AI response and important action steps while hiding raw code', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(helperStreamResponse(
      'AI raw response before plan.\n```json\n{"reply":"Created inspector node.","actions":[{"type":"create_node","templateId":"blank","node":{"name":"InspectorNode","displayName":"Inspector Node","category":"ComfyUINodeBuilder","code":"secret_code = 1"}}]}\n```',
    ))
    const wrapper = mount(AiChatPanel)

    await openAiSettings(wrapper)
    await wrapper.get('[data-testid="ai-api-key"]').setValue('sk-test')
    await wrapper.get('[data-testid="ai-prompt"]').setValue('Create an inspector node')
    await wrapper.get('form.prompt-row').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).not.toContain('AI raw response before plan.')
    expect(wrapper.text()).not.toContain('secret_code')
    expect(wrapper.text()).toContain('Sending prompt')
    expect(wrapper.text()).toContain('Connected')
    expect(wrapper.text()).toContain('Provider response received')
    expect(wrapper.text()).toContain('Parsed 1 action')
    expect(wrapper.text()).toContain('Creating node InspectorNode')
    expect(wrapper.text()).toContain('Created node InspectorNode.')
    expect(wrapper.find('.raw-output').exists()).toBe(false)
  })

  it('shows current task status while generating, keeps panels scrolled, and notifies when done', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(slowHelperStreamResponse('Hidden streaming response.'))
    const uiStore = useUiStore()
    const wrapper = mount(AiChatPanel)
    const messages = wrapper.get('[data-testid="ai-messages"]').element as HTMLElement
    const activity = wrapper.get('[data-testid="ai-activity-list"]').element as HTMLElement
    Object.defineProperty(messages, 'scrollHeight', { configurable: true, value: 240 })
    Object.defineProperty(messages, 'scrollTo', { configurable: true, value: vi.fn() })
    Object.defineProperty(activity, 'scrollHeight', { configurable: true, value: 180 })
    Object.defineProperty(activity, 'scrollTo', { configurable: true, value: vi.fn() })
    const scrollSpy = vi.spyOn(messages, 'scrollTo').mockImplementation(() => {})
    const activityScrollSpy = vi.spyOn(activity, 'scrollTo').mockImplementation(() => {})

    await openAiSettings(wrapper)
    await wrapper.get('[data-testid="ai-api-key"]').setValue('sk-test')
    await wrapper.get('[data-testid="ai-prompt"]').setValue('Stream a response')
    await wrapper.get('form.prompt-row').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.get('[data-testid="ai-current-task"]').text()).toContain('Sending prompt')
    expect(wrapper.get('[data-testid="ai-current-task"]').classes()).toContain('is-generating')
    expect(wrapper.text()).not.toContain('Hidden streaming response.')
    expect(fetchMock).toHaveBeenCalledWith('/helper/ai-chat-stream', expect.objectContaining({
      method: 'POST',
    }))
    expect(scrollSpy).toHaveBeenCalledWith({ top: 240, behavior: 'smooth' })
    expect(activityScrollSpy).toHaveBeenCalledWith({ top: 180, behavior: 'smooth' })

    await vi.advanceTimersByTimeAsync(25)
    await flushPromises()

    expect(uiStore.toasts.at(-1)).toMatchObject({
      title: 'AI response complete',
      type: 'success',
      message: 'Hidden streaming response.',
    })
    vi.useRealTimers()
  })

  it('formats message roles and send shortcut for scanning', () => {
    const wrapper = mount(AiChatPanel)

    expect(wrapper.get('[data-testid="ai-message-system"]').classes()).toContain('message-system')
    expect(wrapper.get('[data-testid="ai-send-shortcut"]').text()).toBe('Ctrl Enter')
    expect(wrapper.get('.send-btn').text()).toContain('Send')
    expect(wrapper.get('.send-btn').text()).toContain('Ctrl Enter')
  })

  it('sends generated ComfyUI runtime files in AI context', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(helperStreamResponse('Context received.'))
    const projectStore = useProjectStore()
    projectStore.addNode('blank')
    projectStore.updateNode(projectStore.project.nodes[0].id, {
      name: 'StringConcatDisplay',
      displayName: 'String Concat Display',
      category: 'ComfyUINodeBuilder',
      code: 'combined = string_a + string_b',
    })
    const wrapper = mount(AiChatPanel)

    await openAiSettings(wrapper)
    await wrapper.get('[data-testid="ai-api-key"]').setValue('sk-test')
    await wrapper.get('[data-testid="ai-prompt"]').setValue('Update the selected node')
    await wrapper.get('form.prompt-row').trigger('submit.prevent')
    await flushPromises()

    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    const contextMessage = request.messages.find((message: { role: string; content: string }) => message.content.includes('Generated ComfyUI runtime files'))
    expect(contextMessage?.content).toContain('StringConcatDisplay.py')
    expect(contextMessage?.content).toContain('NODE_CLASS_MAPPINGS = {"StringConcatDisplay": StringConcatDisplay}')
    expect(contextMessage?.content).toContain('NODE_DISPLAY_NAME_MAPPINGS = {"StringConcatDisplay": "String Concat Display"}')
    expect(contextMessage?.content).toContain('__init__.py')
  })

  it('does not emit deploy unless AI deploy is explicitly allowed', async () => {
    const deployResponse = () => helperStreamResponse('```json\n{"reply":"Deploy requested.","actions":[{"type":"deploy_pack"}]}\n```')
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(deployResponse())
      .mockResolvedValueOnce(deployResponse())
    const wrapper = mount(AiChatPanel)

    await openAiSettings(wrapper)
    await wrapper.get('[data-testid="ai-api-key"]').setValue('sk-test')
    await wrapper.get('[data-testid="ai-prompt"]').setValue('Deploy it')
    await wrapper.get('form.prompt-row').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.emitted('deploy')).toBeUndefined()
    expect(wrapper.text()).toContain('AI deploy is disabled')

    await wrapper.get('[data-testid="allow-ai-deploy"]').setValue(true)
    await wrapper.get('[data-testid="ai-prompt"]').setValue('Deploy it')
    await wrapper.get('form.prompt-row').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.emitted('deploy')).toHaveLength(1)
  })

  it('persists provider, manual mode, model, base url, and API key between panel mounts', async () => {
    const first = mount(AiChatPanel)

    await openAiSettings(first)
    await first.get('[data-testid="ai-provider"]').setValue('anthropic')
    await first.get('[data-testid="ai-model-preset"]').setValue('__custom__')
    await first.get('[data-testid="ai-model-input"]').setValue('claude-custom-build')
    await first.get('[data-testid="ai-base-url"]').setValue('https://anthropic.example/v1')
    await first.get('[data-testid="ai-api-key"]').setValue('sk-persisted')
    first.unmount()

    const second = mount(AiChatPanel)

    await openAiSettings(second)
    expect((second.get('[data-testid="ai-provider"]').element as HTMLSelectElement).value).toBe('anthropic')
    expect((second.get('[data-testid="ai-model-preset"]').element as HTMLSelectElement).value).toBe('__custom__')
    expect((second.get('[data-testid="ai-model-input"]').element as HTMLInputElement).disabled).toBe(false)
    expect((second.get('[data-testid="ai-model-input"]').element as HTMLInputElement).value).toBe('claude-custom-build')
    expect((second.get('[data-testid="ai-base-url"]').element as HTMLInputElement).value).toBe('https://anthropic.example/v1')
    expect((second.get('[data-testid="ai-api-key"]').element as HTMLInputElement).value).toBe('sk-persisted')
  })

  it('toggles the AI panel from UI state', () => {
    const uiStore = useUiStore()
    expect(uiStore.aiPanelOpen).toBe(false)
    uiStore.toggleAiPanel()
    expect(uiStore.aiPanelOpen).toBe(true)
  })
})
