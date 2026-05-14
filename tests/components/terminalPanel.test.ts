import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TerminalPanel from '../../src/components/TerminalPanel.vue'
import AppLayout from '../../src/components/AppLayout.vue'
import AppStatusBar from '../../src/components/AppStatusBar.vue'
import { useProjectStore } from '../../src/stores/project'
import { useUiStore } from '../../src/stores/ui'

describe('terminal panel', () => {
  beforeEach(() => {
    localStorage.clear()
    Object.defineProperty(window, 'innerWidth', { value: 1280, writable: true })
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('starts the node list and preview at their minimum widths', async () => {
    const wrapper = mount(AppLayout, {
      props: {
        statusText: 'Ready',
      },
      slots: {
        library: '<div>Nodes</div>',
        definition: '<div>Preview</div>',
        code: '<div>Code</div>',
      },
    })
    await flushPromises()

    expect(wrapper.find('.panel-library').attributes('style')).toContain('width: 260px')
    expect(wrapper.find('.panel-code').attributes('style')).toContain('width: 364px')
  })

  it('renders the AI builder as a persistent right panel by default', async () => {
    const uiStore = useUiStore()
    const wrapper = mount(AppLayout, {
      props: {
        statusText: 'Ready',
      },
      slots: {
        library: '<div>Nodes</div>',
        definition: '<div>Preview</div>',
        code: '<div>Code</div>',
      },
    })
    await flushPromises()

    expect(uiStore.aiPanelOpen).toBe(true)
    expect(wrapper.find('[data-testid="ai-right-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="ai-right-panel"]').attributes('style')).toContain('width: 340px')
    expect(wrapper.find('.ai-resizer').exists()).toBe(true)
  })

  it('toggles the terminal from the bottom status bar', async () => {
    const uiStore = useUiStore()
    const wrapper = mount(AppStatusBar, {
      props: { statusText: 'Ready' },
    })

    await wrapper.find('[aria-label="Terminal"]').trigger('click')

    expect(uiStore.terminalOpen).toBe(true)
    expect(wrapper.find('[aria-label="Terminal"]').classes()).toContain('active')
  })

  it('toggles the AI builder from the bottom status bar', async () => {
    const uiStore = useUiStore()
    const wrapper = mount(AppStatusBar, {
      props: { statusText: 'Ready' },
    })

    expect(uiStore.aiPanelOpen).toBe(true)
    await wrapper.find('[aria-label="AI"]').trigger('click')

    expect(uiStore.aiPanelOpen).toBe(false)
    expect(wrapper.find('[aria-label="AI"]').classes()).not.toContain('active')
  })

  it('runs commands for the selected node and records terminal logs', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        command: 'python -V',
        exitCode: 0,
        stdout: 'Python 3.13.0\n',
        stderr: '',
        cwd: '/repo/.node-builder/terminal/custom-node-node-id',
        envPath: '/repo/.node-builder/terminal/custom-node-node-id/.venv',
      }),
    } as Response)
    const projectStore = useProjectStore()
    const uiStore = useUiStore()
    const node = projectStore.addNode('blank')
    uiStore.selectNode(node.id)

    const wrapper = mount(TerminalPanel)

    await wrapper.find('[aria-label="Node terminal command"]').setValue('python -V')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('Python 3.13.0')
    expect(uiStore.builderLogs.some(log => log.source === 'terminal' && log.message.includes('python -V'))).toBe(true)
  })

  it('renders as a regular terminal with tabbed builder logs instead of side-by-side panes', async () => {
    const projectStore = useProjectStore()
    const uiStore = useUiStore()
    const node = projectStore.addNode('blank')
    uiStore.selectNode(node.id)
    uiStore.addBuilderLog('builder', 'info', 'deploy log')

    const wrapper = mount(TerminalPanel)

    expect(wrapper.find('.terminal-screen').exists()).toBe(true)
    expect(wrapper.find('.terminal-prompt-row').exists()).toBe(true)
    expect(wrapper.find('.logs-pane').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Builder Output tab"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('deploy log')

    await wrapper.find('[aria-label="Builder Output tab"]').trigger('click')

    expect(wrapper.text()).toContain('deploy log')
  })

  it('supports shell-like clear and command history without calling the helper for clear', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        command: 'python -V',
        exitCode: 0,
        stdout: 'Python 3.13.0\n',
        stderr: '',
        cwd: '/repo/.node-builder/terminal/custom-node-node-id',
        envPath: '/repo/.node-builder/terminal/custom-node-node-id/.venv',
      }),
    } as Response)
    const projectStore = useProjectStore()
    const uiStore = useUiStore()
    const node = projectStore.addNode('blank')
    uiStore.selectNode(node.id)
    const wrapper = mount(TerminalPanel)
    const input = wrapper.find('[aria-label="Node terminal command"]')

    await input.setValue('python -V')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()
    await input.setValue('clear')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(wrapper.text()).not.toContain('Python 3.13.0')

    await input.trigger('keydown', { key: 'ArrowUp' })
    expect((input.element as HTMLInputElement).value).toBe('clear')

    await input.trigger('keydown', { key: 'ArrowUp' })
    expect((input.element as HTMLInputElement).value).toBe('python -V')
  })

  it('returns focus to the command input after every submitted command', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        command: 'python -V',
        exitCode: 0,
        stdout: 'Python 3.13.0\n',
        stderr: '',
        cwd: '/repo/.node-builder/terminal/custom-node-node-id',
        envPath: '/repo/.node-builder/terminal/custom-node-node-id/.venv',
      }),
    } as Response)
    const projectStore = useProjectStore()
    const uiStore = useUiStore()
    const node = projectStore.addNode('blank')
    uiStore.selectNode(node.id)
    const wrapper = mount(TerminalPanel, { attachTo: document.body })
    const input = wrapper.find('[aria-label="Node terminal command"]')

    await input.setValue('python -V')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(document.activeElement).toBe(input.element)

    ;(input.element as HTMLInputElement).blur()
    await input.setValue('clear')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(document.activeElement).toBe(input.element)
  })
})
