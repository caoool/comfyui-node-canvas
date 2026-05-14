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

  function codexStatusResponse(): Response {
    return new Response(JSON.stringify({
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
          supportedReasoningEfforts: [
            { effort: 'low' },
            { effort: 'medium' },
            { effort: 'high' },
          ],
        },
      ],
      reasoningEfforts: [{ effort: 'medium' }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  function requestBodyFor(fetchMock: { mock: { calls: Array<[unknown, RequestInit?]> } }, url: string) {
    const call = fetchMock.mock.calls.find(call => call[0] === url)
    return JSON.parse(String(call?.[1]?.body))
  }

  function mockFetchWithCodexStatus(responseForUrl: (url: string) => Response) {
    return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url === '/helper/ai-codex-status') return codexStatusResponse()
      return responseForUrl(url)
    })
  }

  it('asks the provider proxy and applies returned builder actions', async () => {
    const fetchMock = mockFetchWithCodexStatus(() => helperStreamResponse(
      '```json\n{"reply":"Created concat node.","actions":[{"type":"create_node","templateId":"blank","node":{"name":"ConcatText","displayName":"Concat Text","category":"ComfyUINodeBuilder","inputs":[{"name":"left","type":"STRING","optional":false,"isWidget":true},{"name":"right","type":"STRING","optional":false,"isWidget":true}],"outputs":[{"name":"text","type":"STRING","optional":false,"isWidget":false}],"code":"return (left + right,)"}}]}\n```',
    ))
    const projectStore = useProjectStore()
    const wrapper = mount(AiChatPanel)

    await openAiSettings(wrapper)
    await wrapper.get('[data-testid="ai-provider"]').setValue('openai')
    await wrapper.get('[data-testid="ai-api-key"]').setValue('sk-test')
    await wrapper.get('[data-testid="ai-prompt"]').setValue('Create a concat text node')
    await wrapper.get('[data-testid="ai-prompt"]').trigger('keydown.enter')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/helper/ai-chat-stream', expect.objectContaining({
      method: 'POST',
    }))
    expect(projectStore.project.nodes[0]).toMatchObject({
      name: 'ConcatText',
      displayName: 'Concat Text',
    })
    expect(wrapper.text()).toContain('Created concat node.')
    expect(wrapper.text()).toContain('Applied builder changes')
    expect(wrapper.text()).toContain('Added node Concat Text')
  })

  it('reports no project changes when an AI update action is a no-op', async () => {
    mockFetchWithCodexStatus(() => helperStreamResponse(
      '```json\n{"reply":"Updated it.","actions":[{"type":"update_node","patch":{}}]}\n```',
    ))
    const projectStore = useProjectStore()
    const uiStore = useUiStore()
    const node = projectStore.addNode('blank')
    uiStore.selectNode(node.id)
    const wrapper = mount(AiChatPanel)

    await openAiSettings(wrapper)
    await wrapper.get('[data-testid="ai-provider"]').setValue('openai')
    await wrapper.get('[data-testid="ai-api-key"]').setValue('sk-test')
    await wrapper.get('[data-testid="ai-prompt"]').setValue('Add a text input')
    await wrapper.get('[data-testid="ai-prompt"]').trigger('keydown.enter')
    await flushPromises()

    expect(projectStore.project.nodes[0].inputs).toHaveLength(0)
    expect(wrapper.text()).toContain('No project changes detected')
    expect(wrapper.text()).not.toContain('Updated node CustomNode.')
  })

  it('summarizes observed node contract changes after AI applies them', async () => {
    mockFetchWithCodexStatus(() => helperStreamResponse(
      '```json\n{"reply":"Added text input.","actions":[{"type":"update_node","patch":{"inputs":[{"name":"prompt","type":"STRING","optional":false,"isWidget":true}],"code":"text = prompt"}}]}\n```',
    ))
    const projectStore = useProjectStore()
    const uiStore = useUiStore()
    const node = projectStore.addNode('blank')
    uiStore.selectNode(node.id)
    const wrapper = mount(AiChatPanel)

    await openAiSettings(wrapper)
    await wrapper.get('[data-testid="ai-provider"]').setValue('openai')
    await wrapper.get('[data-testid="ai-api-key"]').setValue('sk-test')
    await wrapper.get('[data-testid="ai-prompt"]').setValue('Add a text input')
    await wrapper.get('[data-testid="ai-prompt"]').trigger('keydown.enter')
    await flushPromises()

    expect(projectStore.project.nodes[0].inputs[0]).toEqual(expect.objectContaining({
      name: 'prompt',
      type: 'STRING',
      isWidget: true,
    }))
    expect(wrapper.text()).toContain('Applied builder changes')
    expect(wrapper.text()).toContain('Added input prompt to Custom Node')
    expect(wrapper.text()).toContain('Updated code for Custom Node')
  })

  it('lets AI create and delete builder-owned files through the conversation pipeline', async () => {
    mockFetchWithCodexStatus(() => helperStreamResponse(
      '```json\n{"reply":"Updated helper files.","actions":[{"type":"upsert_file","relativePath":"helpers/text_utils.py","content":"def clean(value):\\n    return str(value).strip()\\n"},{"type":"delete_file","relativePath":"old_helpers.py"}]}\n```',
    ))
    const projectStore = useProjectStore()
    projectStore.updateProject({
      customFiles: [
        { id: 'old-file', relativePath: 'old_helpers.py', content: '# old\\n' },
      ],
    })
    const wrapper = mount(AiChatPanel)

    await openAiSettings(wrapper)
    await wrapper.get('[data-testid="ai-provider"]').setValue('openai')
    await wrapper.get('[data-testid="ai-api-key"]').setValue('sk-test')
    await wrapper.get('[data-testid="ai-prompt"]').setValue('Add text helper file and remove old helper')
    await wrapper.get('[data-testid="ai-prompt"]').trigger('keydown.enter')
    await flushPromises()

    expect(projectStore.project.customFiles).toEqual([
      expect.objectContaining({
        relativePath: 'helpers/text_utils.py',
        content: 'def clean(value):\n    return str(value).strip()\n',
      }),
    ])
    expect(wrapper.text()).toContain('Updated helper files.')
    expect(wrapper.text()).toContain('Applied builder changes')
    expect(wrapper.text()).toContain('Added file helpers/text_utils.py')
    expect(wrapper.text()).toContain('Deleted file old_helpers.py')
  })

  it('reports malformed AI actions without throwing runtime TypeErrors', async () => {
    mockFetchWithCodexStatus(() => helperStreamResponse(
      '```json\n{"reply":"Trying install script.","actions":[{"type":"set_install_script"}]}\n```',
    ))
    const wrapper = mount(AiChatPanel)

    await openAiSettings(wrapper)
    await wrapper.get('[data-testid="ai-provider"]').setValue('openai')
    await wrapper.get('[data-testid="ai-api-key"]').setValue('sk-test')
    await wrapper.get('[data-testid="ai-prompt"]').setValue('Update install script')
    await wrapper.get('[data-testid="ai-prompt"]').trigger('keydown.enter')
    await flushPromises()

    expect(wrapper.text()).toContain('Trying install script.')
    expect(wrapper.text()).toContain('set_install_script requires a code string.')
    expect(wrapper.text()).not.toContain('No project changes detected')
    expect(wrapper.text()).not.toContain('TypeError')
    expect(wrapper.findAll('[data-testid="ai-message-system"]')).toHaveLength(0)
    expect(wrapper.find('[data-testid="ai-message-notice"]').exists()).toBe(true)
  })

  it('uses local Codex by default without requiring an API key', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(codexStatusResponse())
      .mockResolvedValueOnce(helperStreamResponse('Local Codex ready.'))
    const wrapper = mount(AiChatPanel)

    await openAiSettings(wrapper)
    expect((wrapper.get('[data-testid="ai-provider"]').element as HTMLSelectElement).value).toBe('codex')
    expect(wrapper.find('[data-testid="ai-api-key"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ai-base-url"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="ai-codex-status"]').text()).toContain('Local Codex available')
    expect((wrapper.get('[data-testid="ai-model-preset"]').element as HTMLSelectElement).value).toBe('gpt-5.5')
    expect((wrapper.get('[data-testid="ai-codex-effort"]').element as HTMLSelectElement).value).toBe('medium')

    await wrapper.get('[data-testid="ai-prompt"]').setValue('Use local Codex')
    await wrapper.get('[data-testid="ai-prompt"]').trigger('keydown.enter')
    await flushPromises()

    const request = requestBodyFor(fetchMock, '/helper/ai-chat-stream')
    expect(request.provider).toBe('codex')
    expect(request.model).toBe('gpt-5.5')
    expect(request.reasoningEffort).toBe('medium')
    expect(request).not.toHaveProperty('apiKey')
    expect(request).not.toHaveProperty('baseUrl')
  })

  it('prefills provider base urls and allows selectable or manual model names', async () => {
    const fetchMock = mockFetchWithCodexStatus(() => helperStreamResponse('Manual model accepted.'))
    const wrapper = mount(AiChatPanel)

    expect(wrapper.find('[data-testid="ai-settings-popover"]').exists()).toBe(false)
    await openAiSettings(wrapper)
    expect(wrapper.find('[data-testid="ai-settings-popover"]').exists()).toBe(true)
    await wrapper.get('[data-testid="ai-provider"]').setValue('openai')
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
    await wrapper.get('[data-testid="ai-prompt"]').trigger('keydown.enter')
    await flushPromises()

    const request = requestBodyFor(fetchMock, '/helper/ai-chat-stream')
    expect(request.provider).toBe('anthropic')
    expect(request.baseUrl).toBe('https://api.anthropic.com')
    expect(request.model).toBe('claude-custom-build')
  })

  it('fetches provider models and places ranked fetched models above manual input', async () => {
    const fetchMock = mockFetchWithCodexStatus(() => new Response(JSON.stringify({
      models: [
        { id: 'gpt-5-pro', label: 'GPT-5 Pro' },
        { id: 'gpt-4.1', label: 'GPT-4.1' },
        { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const wrapper = mount(AiChatPanel)

    await openAiSettings(wrapper)
    await wrapper.get('[data-testid="ai-provider"]').setValue('openai')
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
    expect(wrapper.text()).toContain('Fetched models (3)')
    expect(wrapper.findAll('[data-testid="ai-message-system"]')).toHaveLength(0)
  })

  it('shows concise AI response and important action steps while hiding raw code', async () => {
    mockFetchWithCodexStatus(() => helperStreamResponse(
      'AI raw response before plan.\n```json\n{"reply":"Created inspector node.","actions":[{"type":"create_node","templateId":"blank","node":{"name":"InspectorNode","displayName":"Inspector Node","category":"ComfyUINodeBuilder","code":"secret_code = 1"}}]}\n```',
    ))
    const wrapper = mount(AiChatPanel)

    await openAiSettings(wrapper)
    await wrapper.get('[data-testid="ai-provider"]').setValue('openai')
    await wrapper.get('[data-testid="ai-api-key"]').setValue('sk-test')
    await wrapper.get('[data-testid="ai-prompt"]').setValue('Create an inspector node')
    await wrapper.get('[data-testid="ai-prompt"]').trigger('keydown.enter')
    await flushPromises()

    expect(wrapper.text()).not.toContain('AI raw response before plan.')
    expect(wrapper.text()).not.toContain('secret_code')
    expect(wrapper.text()).not.toContain('Connected')
    expect(wrapper.text()).not.toContain('Provider response received')
    expect(wrapper.text()).not.toContain('Parsed 1 action')
    expect(wrapper.text()).not.toContain('Creating node InspectorNode')
    expect(wrapper.text()).toContain('Applied builder changes')
    expect(wrapper.text()).toContain('Added node Inspector Node')
    expect(wrapper.find('.raw-output').exists()).toBe(false)
  })

  it('renders conversation messages as a structured status transcript', async () => {
    mockFetchWithCodexStatus(() => helperStreamResponse(
      '```json\n{"reply":"Created inspector node.","actions":[{"type":"create_node","templateId":"blank","node":{"name":"InspectorNode","displayName":"Inspector Node","category":"ComfyUINodeBuilder","code":"secret_code = 1"}}]}\n```',
    ))
    const wrapper = mount(AiChatPanel)

    expect(wrapper.find('[data-testid="ai-conversation-empty"]').exists()).toBe(true)

    await openAiSettings(wrapper)
    await wrapper.get('[data-testid="ai-provider"]').setValue('openai')
    await wrapper.get('[data-testid="ai-api-key"]').setValue('sk-test')
    await wrapper.get('[data-testid="ai-prompt"]').setValue('Create an inspector node')
    await wrapper.get('[data-testid="ai-prompt"]').trigger('keydown.enter')
    await flushPromises()

    expect(wrapper.find('[data-testid="ai-conversation-empty"]').exists()).toBe(false)
    expect(wrapper.find('.message-card').exists()).toBe(true)
    expect(wrapper.find('.message-rail').exists()).toBe(true)
    expect(wrapper.find('[data-testid="ai-message-notice"] .message-list').exists()).toBe(true)
    expect(wrapper.find('[data-testid="ai-message-notice"]').classes()).toContain('message-tone-success')
  })

  it('shows current task status while generating, keeps panels scrolled, and notifies when done', async () => {
    vi.useFakeTimers()
    const fetchMock = mockFetchWithCodexStatus(() => slowHelperStreamResponse('Hidden streaming response.'))
    const uiStore = useUiStore()
    const wrapper = mount(AiChatPanel)
    const messages = wrapper.get('[data-testid="ai-messages"]').element as HTMLElement
    Object.defineProperty(messages, 'scrollHeight', { configurable: true, value: 240 })
    Object.defineProperty(messages, 'scrollTo', { configurable: true, value: vi.fn() })
    const scrollSpy = vi.spyOn(messages, 'scrollTo').mockImplementation(() => {})

    await openAiSettings(wrapper)
    await wrapper.get('[data-testid="ai-provider"]').setValue('openai')
    await wrapper.get('[data-testid="ai-api-key"]').setValue('sk-test')
    await wrapper.get('[data-testid="ai-prompt"]').setValue('Stream a response')
    await wrapper.get('[data-testid="ai-prompt"]').trigger('keydown.enter')
    await flushPromises()

    expect(wrapper.get('[data-testid="ai-current-task"]').text()).toContain('Connected')
    expect(wrapper.get('[data-testid="ai-current-task"]').classes()).toContain('is-generating')
    expect(wrapper.get('[data-testid="ai-current-task"]').classes()).toContain('task-active')
    expect(wrapper.get('[data-testid="ai-current-task"]').text()).toContain('live')
    expect(wrapper.text()).toContain('Hidden streaming response.')
    expect(wrapper.find('.message-streaming').exists()).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith('/helper/ai-chat-stream', expect.objectContaining({
      method: 'POST',
    }))
    expect(scrollSpy).toHaveBeenCalledWith({ top: 240, behavior: 'smooth' })

    await vi.advanceTimersByTimeAsync(25)
    await flushPromises()

    expect(uiStore.toasts.at(-1)).toMatchObject({
      title: 'AI response received',
      type: 'info',
      message: 'Hidden streaming response.',
    })
    expect(wrapper.find('.message-streaming').exists()).toBe(false)
    vi.useRealTimers()
  })

  it('shows streamed reply text while the provider is still sending a JSON action plan', async () => {
    vi.useFakeTimers()
    mockFetchWithCodexStatus(() => slowHelperStreamResponse(
      '```json\n{"reply":"Streaming JSON reply.","actions":[]}\n```',
    ))
    const wrapper = mount(AiChatPanel)

    await openAiSettings(wrapper)
    await wrapper.get('[data-testid="ai-provider"]').setValue('openai')
    await wrapper.get('[data-testid="ai-api-key"]').setValue('sk-test')
    await wrapper.get('[data-testid="ai-prompt"]').setValue('Stream JSON action plan')
    await wrapper.get('[data-testid="ai-prompt"]').trigger('keydown.enter')
    await flushPromises()

    expect(wrapper.text()).toContain('Streaming JSON reply.')
    expect(wrapper.text()).not.toContain('"actions"')
    expect(wrapper.find('.message-streaming').exists()).toBe(true)

    await vi.advanceTimersByTimeAsync(25)
    await flushPromises()
    vi.useRealTimers()
  })

  it('formats message roles and sends with Enter instead of a send button', () => {
    const wrapper = mount(AiChatPanel)

    expect(wrapper.find('[data-testid="ai-message-system"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ai-message-notice"]').exists()).toBe(false)
    expect(wrapper.find('.send-btn').exists()).toBe(false)
    expect(wrapper.get('[data-testid="ai-prompt"]').attributes('placeholder')).toContain('Enter to send')
    expect(wrapper.get('[data-testid="ai-settings-button"]').attributes('title')).toBe('AI settings')
    expect(wrapper.get('[data-testid="ai-new-conversation"]').attributes('title')).toBe('New conversation')
    expect(wrapper.get('[data-testid="ai-list-conversations"]').attributes('title')).toBe('List conversations')
    expect(wrapper.find('[data-testid="allow-ai-deploy"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ai-clear-conversation"]').exists()).toBe(false)
  })

  it('shows and filters slash commands aligned to the prompt input', async () => {
    const wrapper = mount(AiChatPanel)

    await wrapper.get('[data-testid="ai-prompt"]').setValue('/')
    await flushPromises()

    expect(wrapper.find('[data-testid="ai-command-menu"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="ai-command-menu"]').classes()).toContain('command-menu')
    expect(wrapper.text()).toContain('/clear')
    expect(wrapper.text()).toContain('/resume')
    expect(wrapper.text()).toContain('/compact')

    await wrapper.get('[data-testid="ai-prompt"]').setValue('/co')
    await flushPromises()

    expect(wrapper.text()).toContain('/compact')
    expect(wrapper.text()).not.toContain('/clear')
    expect(wrapper.text()).not.toContain('/resume')
  })

  it('resizes the bottom prompt from the top center handle', async () => {
    const wrapper = mount(AiChatPanel)
    const prompt = wrapper.get('[data-testid="ai-prompt"]')

    expect(prompt.attributes('style')).toContain('height: 72px')
    await wrapper.get('[data-testid="ai-prompt-resize-handle"]').trigger('mousedown', { clientY: 200 })
    window.dispatchEvent(new MouseEvent('mousemove', { clientY: 150 }))
    await flushPromises()

    expect(prompt.attributes('style')).toContain('height: 122px')
    window.dispatchEvent(new MouseEvent('mouseup'))
  })

  it('opens the conversation list popup with an empty state from the toolbar', async () => {
    const wrapper = mount(AiChatPanel)

    await wrapper.get('[data-testid="ai-list-conversations"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="ai-conversation-dialog"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('No previous conversations saved')
  })

  it('sends generated ComfyUI runtime files in AI context', async () => {
    const fetchMock = mockFetchWithCodexStatus(() => helperStreamResponse('Context received.'))
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
    await wrapper.get('[data-testid="ai-provider"]').setValue('openai')
    await wrapper.get('[data-testid="ai-api-key"]').setValue('sk-test')
    await wrapper.get('[data-testid="ai-prompt"]').setValue('Update the selected node')
    await wrapper.get('[data-testid="ai-prompt"]').trigger('keydown.enter')
    await flushPromises()

    const request = requestBodyFor(fetchMock, '/helper/ai-chat-stream')
    const contextMessage = request.messages.find((message: { role: string; content: string }) => message.content.includes('Generated ComfyUI runtime files'))
    expect(contextMessage?.content).toContain('StringConcatDisplay.py')
    expect(contextMessage?.content).toContain('NODE_CLASS_MAPPINGS = {"StringConcatDisplay": StringConcatDisplay}')
    expect(contextMessage?.content).toContain('NODE_DISPLAY_NAME_MAPPINGS = {"StringConcatDisplay": "String Concat Display"}')
    expect(contextMessage?.content).toContain('__init__.py')
  })

  it('sends available node templates in AI context so special nodes use maintained templates', async () => {
    const fetchMock = mockFetchWithCodexStatus(() => helperStreamResponse('Context received.'))
    const wrapper = mount(AiChatPanel)

    await openAiSettings(wrapper)
    await wrapper.get('[data-testid="ai-provider"]').setValue('openai')
    await wrapper.get('[data-testid="ai-api-key"]').setValue('sk-test')
    await wrapper.get('[data-testid="ai-prompt"]').setValue('Create a CosyVoice node')
    await wrapper.get('[data-testid="ai-prompt"]').trigger('keydown.enter')
    await flushPromises()

    const request = requestBodyFor(fetchMock, '/helper/ai-chat-stream')
    const templateMessage = request.messages.find((message: { role: string; content: string }) => message.content.includes('Available node templates'))
    expect(templateMessage?.content).toContain('cosyvoice3-voice-clone')
    expect(templateMessage?.content).toContain('Use create_node with templateId')
  })

  it('sends recent builder and deploy logs in AI context for debugging follow-up fixes', async () => {
    const fetchMock = mockFetchWithCodexStatus(() => helperStreamResponse('Context received.'))
    const uiStore = useUiStore()
    uiStore.addBuilderLog(
      'diagnostic',
      'error',
      'Deploy pipeline failed\nError: install.py failed\nfatal: not a git repository',
    )
    uiStore.addBuilderLog('builder', 'success', 'Applied builder changes:\n- Updated install.py')
    const wrapper = mount(AiChatPanel)

    await openAiSettings(wrapper)
    await wrapper.get('[data-testid="ai-provider"]').setValue('openai')
    await wrapper.get('[data-testid="ai-api-key"]').setValue('sk-test')
    await wrapper.get('[data-testid="ai-prompt"]').setValue('Fix the deploy error')
    await wrapper.get('[data-testid="ai-prompt"]').trigger('keydown.enter')
    await flushPromises()

    const request = requestBodyFor(fetchMock, '/helper/ai-chat-stream')
    const logMessage = request.messages.find((message: { role: string; content: string }) => message.content.includes('Recent builder, deploy, and terminal logs'))
    expect(logMessage?.content).toContain('Deploy pipeline failed')
    expect(logMessage?.content).toContain('fatal: not a git repository')
    expect(logMessage?.content).toContain('Updated install.py')
  })

  it('does not emit deploy unless AI deploy is explicitly allowed', async () => {
    const deployResponse = () => helperStreamResponse('```json\n{"reply":"Deploy requested.","actions":[{"type":"deploy_pack"}]}\n```')
    vi.spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = String(input)
        if (url === '/helper/ai-codex-status') return codexStatusResponse()
        return deployResponse()
      })
    const wrapper = mount(AiChatPanel)

    await openAiSettings(wrapper)
    await wrapper.get('[data-testid="ai-provider"]').setValue('openai')
    await wrapper.get('[data-testid="ai-api-key"]').setValue('sk-test')
    await wrapper.get('[data-testid="ai-prompt"]').setValue('Deploy it')
    await wrapper.get('[data-testid="ai-prompt"]').trigger('keydown.enter')
    await flushPromises()

    expect(wrapper.emitted('deploy')).toBeUndefined()
    expect(wrapper.text()).toContain('AI deploy is disabled')

    await wrapper.get('[data-testid="allow-ai-deploy"]').setValue(true)
    await wrapper.get('[data-testid="ai-prompt"]').setValue('Deploy it')
    await wrapper.get('[data-testid="ai-prompt"]').trigger('keydown.enter')
    await flushPromises()

    expect(wrapper.emitted('deploy')).toHaveLength(1)
  })

  it('stops later AI actions when a terminal verification action fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = String(input)
        if (url === '/helper/ai-codex-status') return codexStatusResponse()
        if (url === '/helper/node-terminal/run') {
          return new Response(JSON.stringify({
            command: 'python -m py_compile BrokenNode.py',
            exitCode: 1,
            stdout: '',
            stderr: 'SyntaxError: invalid syntax',
            cwd: '/tmp/builder',
            envPath: '/tmp/builder/env',
          }), { status: 200, headers: { 'Content-Type': 'application/json' } })
        }
        return helperStreamResponse(
          '```json\n{"reply":"I will verify then update.","actions":[{"type":"run_terminal","command":"python -m py_compile BrokenNode.py"},{"type":"create_node","templateId":"blank","node":{"name":"ShouldNotRun","displayName":"Should Not Run","category":"ComfyUINodeBuilder"}}]}\n```',
        )
      })
    const projectStore = useProjectStore()
    const wrapper = mount(AiChatPanel)

    await openAiSettings(wrapper)
    await wrapper.get('[data-testid="ai-provider"]').setValue('openai')
    await wrapper.get('[data-testid="ai-api-key"]').setValue('sk-test')
    await wrapper.get('[data-testid="ai-prompt"]').setValue('Verify then update')
    await wrapper.get('[data-testid="ai-prompt"]').trigger('keydown.enter')
    await flushPromises()

    expect(projectStore.project.nodes).toHaveLength(0)
    expect(wrapper.text()).toContain('exit 1')
    expect(wrapper.text()).toContain('SyntaxError: invalid syntax')
  })

  it('keeps provider and action progress out of the conversation', async () => {
    mockFetchWithCodexStatus(() => helperStreamResponse('No edits needed.', 'Connected'))
    const wrapper = mount(AiChatPanel)

    await openAiSettings(wrapper)
    await wrapper.get('[data-testid="ai-provider"]').setValue('openai')
    await wrapper.get('[data-testid="ai-api-key"]').setValue('sk-test')
    await wrapper.get('[data-testid="ai-prompt"]').setValue('Explain current node')
    await wrapper.get('[data-testid="ai-prompt"]').trigger('keydown.enter')
    await flushPromises()

    expect(wrapper.find('[data-testid="ai-activity-list"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('No edits needed.')
    expect(wrapper.text()).not.toContain('Sending prompt')
    expect(wrapper.text()).not.toContain('Connected')
    expect(wrapper.text()).not.toContain('Provider response received')
    expect(wrapper.text()).not.toContain('Parsed 0 actions')
    expect(wrapper.findAll('[data-testid="ai-message-system"]')).toHaveLength(0)
  })

  it('handles slash commands for clear, compact, and resume without calling the provider', async () => {
    const fetchMock = mockFetchWithCodexStatus(() => helperStreamResponse('Provider should not run.'))
    const wrapper = mount(AiChatPanel)

    await wrapper.get('[data-testid="ai-prompt"]').setValue('first saved prompt')
    await wrapper.get('[data-testid="ai-prompt"]').trigger('keydown.enter')
    await flushPromises()
    fetchMock.mockClear()
    await wrapper.get('[data-testid="ai-prompt"]').setValue('/compact')
    await wrapper.get('[data-testid="ai-prompt"]').trigger('keydown.enter')
    await flushPromises()
    expect(wrapper.text()).toContain('Context compacted')

    await wrapper.get('[data-testid="ai-prompt"]').setValue('/clear')
    await wrapper.get('[data-testid="ai-prompt"]').trigger('keydown.enter')
    await flushPromises()
    expect(wrapper.text()).toContain('Context cleared')
    expect(wrapper.text()).not.toContain('first saved prompt')

    await wrapper.get('[data-testid="ai-prompt"]').setValue('/resume')
    await wrapper.get('[data-testid="ai-prompt"]').trigger('keydown.enter')
    await flushPromises()

    expect(wrapper.find('[data-testid="ai-resume-dialog"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('first saved prompt')
    await wrapper.get('[data-testid="resume-conversation-0"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="ai-resume-dialog"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('first saved prompt')
    expect(fetchMock).not.toHaveBeenCalledWith('/helper/ai-chat-stream', expect.anything())
  })

  it('lists saved conversations from the toolbar and can delete one', async () => {
    const wrapper = mount(AiChatPanel)

    await wrapper.get('[data-testid="ai-prompt"]').setValue('conversation to delete')
    await wrapper.get('[data-testid="ai-prompt"]').trigger('keydown.enter')
    await flushPromises()
    await wrapper.get('[data-testid="ai-new-conversation"]').trigger('click')
    await flushPromises()

    await wrapper.get('[data-testid="ai-list-conversations"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="ai-conversation-dialog"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('conversation to delete')

    await wrapper.get('[data-testid="delete-conversation-0"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).not.toContain('conversation to delete')
    expect(wrapper.text()).toContain('No previous conversations saved')
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
    expect(uiStore.aiPanelOpen).toBe(true)

    uiStore.toggleAiPanel()
    expect(uiStore.aiPanelOpen).toBe(false)

    uiStore.setAiPanelOpen(true)
    expect(uiStore.aiPanelOpen).toBe(true)
  })
})
