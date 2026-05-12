<template>
  <section class="ai-panel" aria-label="AI builder chat">
    <header class="ai-topbar">
      <div class="title-group">
        <div class="pane-title">AI Builder</div>
        <div class="pane-subtitle">
          {{ projectStore.project.name }} · {{ messages.length - 1 }} thread messages · {{ activitySteps.length }} visible steps
        </div>
      </div>
      <div class="topbar-actions">
        <button
          data-testid="ai-settings-button"
          class="icon-button"
          type="button"
          title="AI settings"
          aria-label="AI settings"
          :aria-expanded="settingsOpen"
          @click="settingsOpen = !settingsOpen"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6.7 2.1h2.6l.35 1.55c.32.12.62.29.9.5l1.5-.48 1.3 2.25-1.15 1.07c.03.17.05.34.05.51s-.02.34-.05.51l1.15 1.07-1.3 2.25-1.5-.48c-.28.21-.58.38-.9.5L9.3 12.9H6.7l-.35-1.55a4.33 4.33 0 0 1-.9-.5l-1.5.48-1.3-2.25 1.15-1.07a3 3 0 0 1-.05-.51c0-.17.02-.34.05-.51L2.65 5.92l1.3-2.25 1.5.48c.28-.21.58-.38.9-.5L6.7 2.1Z" />
            <circle cx="8" cy="7.5" r="1.65" />
          </svg>
        </button>
        <label class="switch-control deploy-toggle" :class="{ checked: allowDeploy }">
          <input data-testid="allow-ai-deploy" type="checkbox" v-model="allowDeploy" />
          <span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>
          <span>Allow deploy</span>
        </label>
        <button class="ghost-button" type="button" @click="clearConversation">Clear chat</button>
      </div>
    </header>

    <div v-if="settingsOpen" class="settings-popover" data-testid="ai-settings-popover" role="dialog" aria-label="AI settings">
      <div class="settings-popover-header">
        <div>
          <div class="settings-title">AI Settings</div>
          <div class="settings-subtitle">{{ provider }} · {{ model || 'no model selected' }}</div>
        </div>
        <button
          data-testid="ai-settings-close"
          class="icon-button"
          type="button"
          title="Close AI settings"
          aria-label="Close AI settings"
          @click="settingsOpen = false"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      <form class="setup-strip" aria-label="AI provider setup" @submit.prevent>
        <label class="field-group provider-field">
          <span>Provider</span>
          <select data-testid="ai-provider" v-model="provider" class="field" @change="applyProviderDefaults">
            <option value="openai">OpenAI</option>
            <option value="openrouter">OpenRouter</option>
            <option value="openai-compatible">OpenAI-compatible</option>
            <option value="anthropic">Anthropic</option>
            <option value="gemini">Gemini</option>
            <option value="ollama">Ollama</option>
          </select>
        </label>

        <label class="field-group model-preset-field">
          <span>{{ modelLoading ? 'Fetching models...' : modelSourceLabel }}</span>
          <div class="model-select-row">
            <select data-testid="ai-model-preset" v-model="modelPreset" class="field" @change="applyModelPreset">
              <option
                v-for="option in currentModelOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
              <option value="__custom__">Custom model...</option>
            </select>
            <button
              data-testid="ai-refresh-models"
              class="refresh-models"
              type="button"
              :disabled="modelLoading"
              title="Fetch available models from the selected provider"
              aria-label="Fetch available models"
              @click="refreshModels"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M12.25 5.25A4.75 4.75 0 0 0 4 4.1L2.75 5.35" />
                <path d="M2.75 2.65v2.7h2.7" />
                <path d="M3.75 10.75A4.75 4.75 0 0 0 12 11.9l1.25-1.25" />
                <path d="M13.25 13.35v-2.7h-2.7" />
              </svg>
            </button>
          </div>
        </label>

        <label class="field-group model-input-field">
          <span>Manual model</span>
          <input
            data-testid="ai-model-input"
            v-model="model"
            class="field mono-field"
            :class="{ 'field-disabled': !manualModelSelected }"
            :disabled="!manualModelSelected"
            :placeholder="manualModelSelected ? 'type provider model id' : 'select Custom model... to edit'"
            spellcheck="false"
            @input="syncModelPresetFromInput"
          />
        </label>

        <label class="field-group api-key-field">
          <span>API Key</span>
          <input
            data-testid="ai-api-key"
            v-model="apiKey"
            class="field"
            type="password"
            autocomplete="off"
            @blur="maybeRefreshModels"
          />
        </label>

        <label class="field-group base-url-field">
          <span>Base URL</span>
          <input
            data-testid="ai-base-url"
            v-model="baseUrl"
            class="field mono-field"
            spellcheck="false"
            @blur="maybeRefreshModels"
          />
        </label>

        <div class="skill-row" aria-label="AI skills">
          <label
            v-for="skill in AI_SKILLS"
            :key="skill.id"
            class="skill-pill"
            :class="{ checked: selectedSkills.includes(skill.id) }"
            :title="skill.description"
          >
            <input type="checkbox" :value="skill.id" v-model="selectedSkills" />
            <span class="check-dot" aria-hidden="true"></span>
            <span>{{ skill.name }}</span>
          </label>
        </div>
      </form>
    </div>

    <div class="ai-workspace">
      <section class="conversation-panel" aria-label="AI conversation">
        <div class="messages" ref="messagesRef" data-testid="ai-messages">
          <div
            v-for="message in messages"
            :key="message.id"
            class="message"
            :class="`message-${message.role}`"
            :data-testid="`ai-message-${message.role}`"
          >
            <div class="message-role">
              <span class="role-dot" aria-hidden="true"></span>
              <span>{{ message.role }}</span>
            </div>
            <pre>{{ message.content }}</pre>
          </div>

          <div
            v-if="busy || currentTaskTitle"
            class="current-task"
            :class="{ 'is-generating': busy }"
            data-testid="ai-current-task"
          >
            <span class="task-indicator" aria-hidden="true"></span>
            <div class="task-copy">
              <span class="task-kicker">{{ busy ? 'Generating' : 'Latest task' }}</span>
              <strong>{{ currentTaskTitle || 'Waiting for AI' }}</strong>
            </div>
          </div>
        </div>

        <form class="prompt-row" @submit.prevent="sendPrompt">
          <textarea
            data-testid="ai-prompt"
            v-model="prompt"
            class="prompt"
            :disabled="busy"
            placeholder="Ask AI to create a node, fix the selected node, explain an error, validate, test, or deploy..."
            @keydown.meta.enter.prevent="sendPrompt"
            @keydown.ctrl.enter.prevent="sendPrompt"
          ></textarea>
          <button class="send-btn" :disabled="busy || !prompt.trim()" title="Send. Ctrl+Enter also sends.">
            <span class="send-label">{{ busy ? 'Working' : 'Send' }}</span>
            <kbd data-testid="ai-send-shortcut">Ctrl Enter</kbd>
          </button>
        </form>
      </section>

      <aside class="activity-panel" aria-label="AI activity steps">
        <div class="activity-header">
          <div>
            <div class="activity-title">Activity</div>
            <div class="activity-subtitle">Provider output, parsing, and builder actions</div>
          </div>
          <span class="busy-light" :class="{ active: busy }"></span>
        </div>

        <div class="activity-list" ref="activityRef" data-testid="ai-activity-list">
          <article
            v-for="step in activitySteps"
            :key="step.id"
            class="activity-step"
            :class="`step-${step.status}`"
          >
            <span class="step-status" aria-hidden="true"></span>
            <div class="step-copy">
              <div class="step-label">{{ step.label }}</div>
              <pre v-if="step.detail">{{ step.detail }}</pre>
            </div>
          </article>

          <div v-if="activitySteps.length === 0" class="activity-empty">
            Ask the AI for a change. Every provider call, parse result, terminal command, and builder action will appear here.
          </div>
        </div>
      </aside>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { AI_SKILLS, systemPromptForSkills } from '../lib/aiSkills'
import { parseAiActionPlan, type BuilderAction } from '../lib/aiActionPlan'
import { applyBuilderAction } from '../lib/builderAutomation'
import { fetchAiModels, streamAiChat, type AiChatProviderConfig, type AiChatMessage, type AiChatStreamEvent } from '../lib/aiAssistantClient'
import { buildPackFiles } from '../lib/buildPackFiles'
import { runNodeTerminalCommand } from '../lib/nodeTerminalClient'
import { useProjectStore } from '../stores/project'
import { useUiStore } from '../stores/ui'

const emit = defineEmits<{ deploy: [] }>()

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface ModelOption {
  label: string
  value: string
}

interface ProviderPreset {
  baseUrl: string
  models: ModelOption[]
}

interface ActivityStep {
  id: string
  status: 'active' | 'info' | 'success' | 'warning' | 'error'
  label: string
  detail?: string
}

const projectStore = useProjectStore()
const uiStore = useUiStore()
const providerPresets: Record<AiChatProviderConfig['provider'], ProviderPreset> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { label: 'GPT-4.1 Mini', value: 'gpt-4.1-mini' },
      { label: 'GPT-4.1', value: 'gpt-4.1' },
      { label: 'GPT-4o', value: 'gpt-4o' },
      { label: 'o4 Mini', value: 'o4-mini' },
      { label: 'o3', value: 'o3' },
    ],
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      { label: 'OpenAI GPT-4.1', value: 'openai/gpt-4.1' },
      { label: 'Claude 3.5 Sonnet', value: 'anthropic/claude-3.5-sonnet' },
      { label: 'Gemini 2.5 Pro', value: 'google/gemini-2.5-pro' },
      { label: 'Llama 3.3 70B', value: 'meta-llama/llama-3.3-70b-instruct' },
      { label: 'Qwen Coder 32B', value: 'qwen/qwen-2.5-coder-32b-instruct' },
    ],
  },
  'openai-compatible': {
    baseUrl: 'http://127.0.0.1:8000/v1',
    models: [
      { label: 'GPT-4.1 Mini', value: 'gpt-4.1-mini' },
      { label: 'Qwen Coder 32B', value: 'qwen2.5-coder-32b-instruct' },
      { label: 'Llama 3.1 70B', value: 'llama-3.1-70b-instruct' },
      { label: 'DeepSeek Coder', value: 'deepseek-coder' },
    ],
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    models: [
      { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-latest' },
      { label: 'Claude 3.5 Haiku', value: 'claude-3-5-haiku-latest' },
      { label: 'Claude 3 Opus', value: 'claude-3-opus-latest' },
    ],
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: [
      { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
      { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
      { label: 'Gemini 1.5 Pro', value: 'gemini-1.5-pro' },
      { label: 'Gemini 1.5 Flash', value: 'gemini-1.5-flash' },
    ],
  },
  ollama: {
    baseUrl: 'http://127.0.0.1:11434',
    models: [
      { label: 'Llama 3.1', value: 'llama3.1' },
      { label: 'Qwen 2.5 Coder', value: 'qwen2.5-coder' },
      { label: 'Mistral', value: 'mistral' },
      { label: 'Code Llama', value: 'codellama' },
    ],
  },
}
const AI_SETTINGS_KEY = 'comfyui-node-builder-ai-settings'

interface PersistedAiSettings {
  provider?: AiChatProviderConfig['provider']
  modelPreset?: string
  model?: string
  apiKey?: string
  baseUrl?: string
  selectedSkills?: string[]
}

function settingsStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function isProvider(value: unknown): value is AiChatProviderConfig['provider'] {
  return typeof value === 'string' && value in providerPresets
}

function loadAiSettings(): PersistedAiSettings {
  const storage = settingsStorage()
  if (!storage) return {}
  try {
    const parsed = JSON.parse(storage.getItem(AI_SETTINGS_KEY) || '{}') as PersistedAiSettings
    return {
      provider: isProvider(parsed.provider) ? parsed.provider : undefined,
      modelPreset: typeof parsed.modelPreset === 'string' ? parsed.modelPreset : undefined,
      model: typeof parsed.model === 'string' ? parsed.model : undefined,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : undefined,
      baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl : undefined,
      selectedSkills: Array.isArray(parsed.selectedSkills) ? parsed.selectedSkills.filter(item => typeof item === 'string') : undefined,
    }
  } catch {
    return {}
  }
}

const persistedAiSettings = loadAiSettings()
const provider = ref<AiChatProviderConfig['provider']>(persistedAiSettings.provider ?? 'openai')
const initialProviderPreset = providerPresets[provider.value]

function initialModelPreset(settings: PersistedAiSettings, preset: ProviderPreset): string {
  if (settings.modelPreset === '__custom__') return '__custom__'
  if (settings.modelPreset && preset.models.some(option => option.value === settings.modelPreset)) return settings.modelPreset
  if (settings.model) return '__custom__'
  return preset.models[0]?.value ?? '__custom__'
}

function initialSkillSelection(settings: PersistedAiSettings): string[] {
  const valid = settings.selectedSkills?.filter(id => AI_SKILLS.some(skill => skill.id === id)) ?? []
  return valid.length > 0 ? valid : AI_SKILLS.map(skill => skill.id)
}

const modelPreset = ref(initialModelPreset(persistedAiSettings, initialProviderPreset))
const model = ref(persistedAiSettings.model ?? (modelPreset.value === '__custom__' ? '' : modelPreset.value))
const apiKey = ref(persistedAiSettings.apiKey ?? '')
const baseUrl = ref(persistedAiSettings.baseUrl ?? initialProviderPreset.baseUrl)
const fetchedModels = ref<ModelOption[]>([])
const modelLoading = ref(false)
const prompt = ref('')
const busy = ref(false)
const allowDeploy = ref(false)
const settingsOpen = ref(false)
const selectedSkills = ref(initialSkillSelection(persistedAiSettings))
const lastRawOutput = ref('')
const currentTaskTitle = ref('')
const activitySteps = ref<ActivityStep[]>([])
const messagesRef = ref<HTMLElement | null>(null)
const activityRef = ref<HTMLElement | null>(null)
const messages = ref<ChatMessage[]>([
  {
    id: 'intro',
    role: 'system',
    content: 'AI can create packs/nodes, edit files, validate, run terminal tests, and deploy when allowed. Keep chatting here to iterate on bugs, tests, and follow-up changes.',
  },
])

const currentProviderPreset = computed(() => providerPresets[provider.value])
const currentModelOptions = computed(() => fetchedModels.value.length > 0 ? fetchedModels.value : currentProviderPreset.value.models)
const manualModelSelected = computed(() => modelPreset.value === '__custom__')
const modelSourceLabel = computed(() => fetchedModels.value.length > 0 ? `Fetched models (${fetchedModels.value.length})` : 'Model preset')

function saveAiSettings() {
  const storage = settingsStorage()
  if (!storage) return
  storage.setItem(AI_SETTINGS_KEY, JSON.stringify({
    provider: provider.value,
    modelPreset: modelPreset.value,
    model: model.value,
    apiKey: apiKey.value,
    baseUrl: baseUrl.value,
    selectedSkills: selectedSkills.value,
  } satisfies PersistedAiSettings))
}

watch([provider, modelPreset, model, apiKey, baseUrl, selectedSkills], saveAiSettings, { deep: true, flush: 'sync' })

function redactCodeForDisplay(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '[code hidden]')
    .replace(/"code"\s*:\s*"[^"]*"/g, '"code":"[hidden]"')
    .replace(/"moduleCode"\s*:\s*"[^"]*"/g, '"moduleCode":"[hidden]"')
    .replace(/"pythonSource"\s*:\s*"[^"]*"/g, '"pythonSource":"[hidden]"')
}

function cleanDisplayText(text: string, fallback = 'AI response received. Code and machine details are hidden.'): string {
  const cleaned = redactCodeForDisplay(text)
    .split('\n')
    .map(line => line.trimEnd())
    .filter(line => !/^\s*[{[\]}],?\s*$/.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (!cleaned || cleaned === '[code hidden]') return fallback
  return cleaned
}

function addMessage(role: ChatMessage['role'], content: string) {
  messages.value.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, role, content: cleanDisplayText(content) })
  scrollMessages()
}

function scrollMessages(behavior: ScrollBehavior = busy.value ? 'smooth' : 'auto') {
  nextTick(() => {
    const el = messagesRef.value
    if (!el) return
    const top = el.scrollHeight
    if (typeof el.scrollTo === 'function') {
      el.scrollTo({ top, behavior })
    } else {
      el.scrollTop = top
    }
  })
}

function scrollActivity(behavior: ScrollBehavior = busy.value ? 'smooth' : 'auto') {
  nextTick(() => {
    const el = activityRef.value
    if (!el) return
    const top = el.scrollHeight
    if (typeof el.scrollTo === 'function') {
      el.scrollTo({ top, behavior })
    } else {
      el.scrollTop = top
    }
  })
}

function visibleStepDetail(detail?: string): string | undefined {
  if (!detail) return undefined
  const cleaned = cleanDisplayText(detail, '')
  if (!cleaned) return undefined
  if (cleaned.includes('[code hidden]')) return undefined
  return cleaned.length > 180 ? `${cleaned.slice(0, 180)}...` : cleaned
}

function addStep(status: ActivityStep['status'], label: string, detail?: string) {
  activitySteps.value.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    status,
    label,
    detail: visibleStepDetail(detail),
  })
  activitySteps.value = activitySteps.value.slice(-80)
  scrollActivity()
}

function clearConversation() {
  messages.value = [messages.value[0]]
  activitySteps.value = []
  lastRawOutput.value = ''
  currentTaskTitle.value = ''
}

function applyProviderDefaults() {
  const preset = currentProviderPreset.value
  baseUrl.value = preset.baseUrl
  fetchedModels.value = []
  modelPreset.value = preset.models[0]?.value ?? '__custom__'
  model.value = modelPreset.value === '__custom__' ? '' : modelPreset.value
  maybeRefreshModels()
}

function applyModelPreset() {
  if (modelPreset.value === '__custom__') return
  model.value = modelPreset.value
}

function syncModelPresetFromInput() {
  const match = currentModelOptions.value.find(option => option.value === model.value.trim())
  modelPreset.value = match?.value ?? '__custom__'
}

function modelFetchCanRun(): boolean {
  if (provider.value === 'ollama' || provider.value === 'openai-compatible') return Boolean(baseUrl.value.trim())
  return Boolean(apiKey.value.trim())
}

function maybeRefreshModels() {
  if (modelFetchCanRun()) void refreshModels()
}

function adoptModelOptions(options: ModelOption[]) {
  fetchedModels.value = options
  if (options.length === 0) return
  const next = options[0]
  modelPreset.value = next.value
  model.value = next.value
}

async function refreshModels() {
  if (modelLoading.value) return
  modelLoading.value = true
  addStep('active', 'Fetching provider models', `${provider.value} ${baseUrl.value}`.trim())
  try {
    const models = await fetchAiModels({
      provider: provider.value,
      apiKey: apiKey.value.trim() || undefined,
      baseUrl: baseUrl.value.trim() || undefined,
    })
    adoptModelOptions(models.map(model => ({ label: model.label || model.id, value: model.id })))
    addStep('success', `Fetched ${models.length} models`, models.slice(0, 10).map(model => model.id).join('\n'))
  } catch (err) {
    const message = String(err)
    fetchedModels.value = []
    addStep('warning', 'Model fetch failed', message)
    uiStore.addBuilderLog('builder', 'warning', message)
  } finally {
    modelLoading.value = false
  }
}

function providerConfig(): AiChatProviderConfig {
  return {
    provider: provider.value,
    model: model.value.trim(),
    apiKey: apiKey.value.trim(),
    baseUrl: baseUrl.value.trim() || undefined,
  }
}

function projectContext(): string {
  return JSON.stringify({
    activePack: {
      name: projectStore.project.name,
      packFolderName: projectStore.project.packFolderName,
      nodeCount: projectStore.project.nodes.length,
      selectedNodeId: uiStore.selectedNodeId,
    },
    project: projectStore.project,
  }, null, 2)
}

function truncateForPrompt(text: string, limit = 16_000): string {
  if (text.length <= limit) return text
  return `${text.slice(0, limit)}\n# ... truncated ${text.length - limit} characters ...`
}

function runtimeFilesContext(): string {
  const files = buildPackFiles(projectStore.project)
  const relevantNames = Object.keys(files)
    .filter(filename => filename.endsWith('.py') || filename === 'requirements.txt' || filename === 'install.py')
    .sort((a, b) => {
      if (a === '__init__.py') return 1
      if (b === '__init__.py') return -1
      return a.localeCompare(b)
    })
  const sections = relevantNames.map(filename => [
    `### ${filename}`,
    '```python',
    truncateForPrompt(files[filename]),
    '```',
  ].join('\n'))
  return [
    'Generated ComfyUI runtime files for the active pack.',
    'These are what ComfyUI will import after deploy. The per-node files include NODE_CLASS_MAPPINGS and NODE_DISPLAY_NAME_MAPPINGS; __init__.py merges them at the pack level.',
    'When creating or updating nodes, keep actions compatible with these generated files. For create_node/update_node, moduleCode is top-level imports/helpers and code is the execute body; do not duplicate class definitions or mapping dictionaries there unless editing pythonSource directly.',
    ...sections,
  ].join('\n\n')
}

function chatMessages(userPrompt: string): AiChatMessage[] {
  return [
    { role: 'system', content: systemPromptForSkills(selectedSkills.value) },
    { role: 'system', content: `Current builder project JSON:\n${projectContext()}` },
    { role: 'system', content: runtimeFilesContext() },
    ...messages.value
      .filter(message => message.role === 'user' || message.role === 'assistant')
      .slice(-8)
      .map(message => ({ role: message.role, content: message.content }) as AiChatMessage),
    { role: 'user', content: userPrompt },
  ]
}

async function handleTerminalAction(action: Extract<BuilderAction, { type: 'run_terminal' }>) {
  const result = await applyBuilderAction(projectStore, uiStore, action)
  if (!result.terminalCommand) {
    addMessage('system', result.message)
    addStep(result.level, result.message)
    return
  }
  addStep('active', 'Running terminal command', result.terminalCommand)
  const terminalResult = await runNodeTerminalCommand(projectStore.project, result.terminalNodeId ?? uiStore.selectedNodeId, result.terminalCommand)
  const output = [
    `$ ${terminalResult.command}`,
    terminalResult.stdout.trimEnd(),
    terminalResult.stderr.trimEnd(),
    `exit ${terminalResult.exitCode}`,
  ].filter(Boolean).join('\n')
  uiStore.addBuilderLog('terminal', terminalResult.exitCode === 0 ? 'success' : 'error', output)
  addMessage('system', output)
  addStep(terminalResult.exitCode === 0 ? 'success' : 'error', `Terminal exited ${terminalResult.exitCode}`, output)
}

function actionTitle(action: BuilderAction): string {
  if (action.type === 'create_node') {
    const name = action.node?.name || action.node?.displayName || 'new node'
    return `Creating node ${name}`
  }
  if (action.type === 'update_node') {
    const name = action.nodeName || action.patch?.name || action.patch?.displayName || action.node?.name || 'selected node'
    return `Updating node ${name}`
  }
  if (action.type === 'delete_node') return `Deleting node ${action.nodeName || action.nodeId || ''}`.trim()
  if (action.type === 'create_pack') return `Creating pack ${action.name || action.packFolderName || ''}`.trim()
  if (action.type === 'switch_pack') return `Switching pack ${action.name || action.packFolderName || ''}`.trim()
  if (action.type === 'rename_pack') return `Renaming pack ${action.name || action.packFolderName || ''}`.trim()
  if (action.type === 'set_requirements') return `Updating ${action.requirements.length} dependencies`
  if (action.type === 'set_install_script') return 'Updating install script'
  if (action.type === 'upsert_file') return `Updating ${action.relativePath}`
  if (action.type === 'delete_file') return `Deleting ${action.relativePath}`
  if (action.type === 'select_node') return `Selecting node ${action.nodeName || action.nodeId || ''}`.trim()
  if (action.type === 'validate_project') return 'Validating project'
  if (action.type === 'run_terminal') return 'Running terminal command'
  if (action.type === 'deploy_pack') return 'Requesting deploy'
  void (action satisfies never)
  return 'Running builder action'
}

async function executeAction(action: BuilderAction) {
  const title = actionTitle(action)
  currentTaskTitle.value = title
  addStep('active', title)
  if (action.type === 'deploy_pack') {
    if (!allowDeploy.value) {
      addMessage('system', 'AI deploy is disabled. Enable "Allow AI deploy" to let AI trigger Deploy & Restart.')
      addStep('warning', 'Deploy blocked', 'Enable Allow deploy before AI can trigger Deploy & Restart.')
      return
    }
    emit('deploy')
    addMessage('system', 'Deploy requested for the active pack.')
    addStep('success', 'Deploy requested for active pack')
    return
  }
  if (action.type === 'run_terminal') {
    await handleTerminalAction(action)
    return
  }
  const result = await applyBuilderAction(projectStore, uiStore, action)
  uiStore.addBuilderLog('builder', result.level, result.message)
  addMessage('system', result.message)
  addStep(result.level, result.message)
}

function applyStreamEvent(event: AiChatStreamEvent) {
  if (event.type === 'status') {
    addStep('active', event.message)
    return
  }
  if (event.type === 'delta') {
    lastRawOutput.value += event.content
    scrollMessages()
    return
  }
  if (event.type === 'done') {
    lastRawOutput.value = event.content || lastRawOutput.value
    addStep('success', 'Provider response received', lastRawOutput.value.slice(0, 1200))
    uiStore.showToast('AI response complete', 'success', cleanDisplayText(lastRawOutput.value).slice(0, 180))
    scrollMessages()
    return
  }
  addStep('error', 'Provider stream error', event.message)
}

async function sendPrompt() {
  const nextPrompt = prompt.value.trim()
  if (!nextPrompt || busy.value) return
  prompt.value = ''
  busy.value = true
  currentTaskTitle.value = 'Sending prompt'
  addMessage('user', nextPrompt)
  addStep('active', 'Sending prompt', nextPrompt)
  lastRawOutput.value = ''
  let streamCompleted = false
  try {
    const assistantText = await streamAiChat(providerConfig(), chatMessages(nextPrompt), event => {
      if (event.type === 'done') streamCompleted = true
      applyStreamEvent(event)
    })
    lastRawOutput.value = assistantText || lastRawOutput.value
    if (!streamCompleted) {
      addStep('success', 'Provider response received', lastRawOutput.value.slice(0, 1200))
      uiStore.showToast('AI response complete', 'success', cleanDisplayText(lastRawOutput.value).slice(0, 180))
      scrollMessages()
    }
    const plan = parseAiActionPlan(assistantText)
    addStep(plan.actions.length > 0 ? 'success' : 'warning', `Parsed ${plan.actions.length} action${plan.actions.length === 1 ? '' : 's'}`)
    addMessage('assistant', plan.reply || assistantText)
    for (const action of plan.actions) {
      await executeAction(action)
    }
  } catch (err) {
    const message = String(err)
    addMessage('system', message)
    addStep('error', 'AI request failed', message)
    uiStore.addBuilderLog('builder', 'error', message)
  } finally {
    busy.value = false
    currentTaskTitle.value = ''
  }
}
</script>

<style scoped>
.ai-panel {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--panel-2) 74%, var(--bg)), var(--panel)),
    var(--panel);
  border-top: 1px solid var(--border-subtle);
  color: var(--text);
  min-height: 0;
}
.ai-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 12px;
  border-bottom: 1px solid var(--border-subtle);
  background: linear-gradient(180deg, rgba(255,255,255,0.035), transparent);
  box-shadow: var(--inner-highlight);
}
.title-group {
  min-width: 0;
}
.pane-title {
  font-size: 13px;
  font-weight: 850;
  letter-spacing: 0;
}
.pane-subtitle {
  color: var(--text-dim);
  font-size: 11.5px;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.topbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.icon-button {
  width: 28px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--r-sm);
  border: 1px solid var(--border-subtle);
  background: var(--raised);
  color: var(--text-dim);
  cursor: pointer;
  box-shadow: var(--inner-highlight);
}
.icon-button:hover {
  color: var(--text);
  border-color: var(--border);
  background: var(--hover);
}
.icon-button[aria-expanded="true"] {
  color: var(--accent);
  border-color: rgba(104, 167, 255, 0.35);
  background: var(--accent-soft);
}
.icon-button svg {
  width: 14px;
  height: 14px;
  stroke: currentColor;
  stroke-width: 1.6;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.switch-control,
.skill-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text);
  font-size: 12px;
}
.switch-control {
  cursor: pointer;
  user-select: none;
  color: var(--text-dim);
}
.switch-control input,
.skill-pill input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.switch-track {
  width: 30px;
  height: 16px;
  border-radius: 999px;
  background: var(--field);
  border: 1px solid var(--border);
  position: relative;
  box-shadow: var(--inner-highlight);
  transition: background 140ms ease, border-color 140ms ease;
}
.switch-thumb {
  position: absolute;
  width: 12px;
  height: 12px;
  left: 1px;
  top: 1px;
  border-radius: 50%;
  background: var(--text-muted);
  transition: transform 140ms ease, background 140ms ease;
}
.switch-control.checked {
  color: var(--text);
}
.switch-control.checked .switch-track {
  background: var(--accent-soft);
  border-color: rgba(104, 167, 255, 0.42);
}
.switch-control.checked .switch-thumb {
  transform: translateX(14px);
  background: var(--accent);
}
.ghost-button {
  height: 26px;
  padding: 0 9px;
  border-radius: var(--r-sm);
  border: 1px solid var(--border-subtle);
  background: var(--raised);
  color: var(--text-dim);
  cursor: pointer;
  font-size: 11.5px;
  font-weight: 760;
  box-shadow: var(--inner-highlight);
}
.ghost-button:hover {
  color: var(--text);
  border-color: var(--border);
  background: var(--hover);
}
.settings-popover {
  position: absolute;
  z-index: 30;
  top: 45px;
  right: 12px;
  width: min(760px, calc(100% - 24px));
  max-height: min(640px, calc(100% - 62px));
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--panel-2) 86%, var(--bg)), var(--panel)),
    var(--panel);
  box-shadow: 0 18px 55px rgba(0, 0, 0, 0.38), var(--inner-highlight);
}
.settings-popover-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-subtle);
}
.settings-title {
  font-size: 12.5px;
  font-weight: 850;
}
.settings-subtitle {
  color: var(--text-dim);
  font-size: 11px;
  margin-top: 2px;
  font-family: var(--font-mono);
}
.setup-strip {
  display: grid;
  grid-template-columns: minmax(150px, 0.85fr) minmax(220px, 1.15fr);
  gap: 10px;
  padding: 12px;
  border-bottom: 0;
  background: transparent;
  align-items: end;
}
.base-url-field,
.skill-row {
  grid-column: 1 / -1;
}
.field-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.field-group span {
  color: var(--text-dim);
  font-size: 11px;
  font-weight: 720;
}
.field,
.prompt {
  background: var(--field);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: var(--r-sm);
  outline: none;
  font: inherit;
}
.field {
  height: 28px;
  padding: 0 8px;
  font-size: 12px;
  width: 100%;
}
.field:disabled,
.field-disabled {
  color: var(--text-muted);
  background: color-mix(in srgb, var(--field) 72%, var(--panel));
  border-color: var(--border-subtle);
  cursor: not-allowed;
}
.field:focus-visible,
.prompt:focus-visible {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.mono-field {
  font-family: var(--font-mono);
  font-size: 11.5px;
}
.model-select-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 28px;
  gap: 6px;
}
.refresh-models {
  height: 28px;
  width: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--r-sm);
  border: 1px solid var(--border-subtle);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.04), transparent),
    var(--raised);
  color: var(--text-dim);
  cursor: pointer;
  box-shadow: var(--inner-highlight);
}
.refresh-models:hover:not(:disabled) {
  color: var(--accent);
  border-color: rgba(104, 167, 255, 0.34);
  background: var(--accent-soft);
}
.refresh-models:disabled {
  opacity: 0.45;
  cursor: wait;
}
.refresh-models svg {
  width: 14px;
  height: 14px;
  stroke: currentColor;
  stroke-width: 1.6;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.skill-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  grid-column: 1 / -1;
  padding-top: 2px;
}
.skill-pill {
  padding: 4px 7px;
  background: var(--raised);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-sm);
  color: var(--text-dim);
  cursor: pointer;
  box-shadow: var(--inner-highlight);
}
.skill-pill.checked {
  color: var(--text);
  border-color: rgba(104, 167, 255, 0.28);
  background: var(--accent-faint);
}
.check-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--text-muted);
}
.skill-pill.checked .check-dot {
  background: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.ai-workspace {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 0;
}
.conversation-panel {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.messages {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 10px 12px 0;
  padding: 12px;
  border-radius: var(--r-md);
}
.message {
  max-width: min(920px, 92%);
  padding: 10px 11px;
  border-radius: var(--r-md);
}
.message-user {
  align-self: flex-end;
}
.message-assistant {
  align-self: flex-start;
}
.message-streaming {
  box-shadow: inset 3px 0 0 var(--accent);
}
.message-role {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-dim);
  font-size: 10.5px;
  font-weight: 850;
  text-transform: uppercase;
  margin-bottom: 4px;
}
.role-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--text-muted);
  box-shadow: 0 0 0 3px rgba(167, 176, 194, 0.08);
}
.message-user .role-dot {
  background: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.message-user .message-role {
  color: var(--accent);
}
.message-assistant .role-dot {
  background: var(--success);
  box-shadow: 0 0 0 3px var(--success-soft);
}
.message-assistant .message-role {
  color: var(--success);
}
.message-system .role-dot {
  background: var(--warning);
  box-shadow: 0 0 0 3px var(--generated-soft);
}
.message-system .message-role {
  color: var(--warning);
}
.message pre {
  white-space: pre-wrap;
  font-family: var(--font-sans);
  font-size: 12.5px;
  line-height: 1.45;
}
.current-task {
  max-width: min(680px, 94%);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 11px;
  border-radius: var(--r-md);
  border: 1px solid rgba(104, 167, 255, 0.32);
  background:
    linear-gradient(180deg, rgba(104, 167, 255, 0.13), rgba(104, 167, 255, 0.05)),
    var(--raised);
  box-shadow: var(--inner-highlight);
}
.task-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--text-muted);
  box-shadow: 0 0 0 4px rgba(167, 176, 194, 0.1);
  flex-shrink: 0;
}
.current-task.is-generating .task-indicator {
  background: var(--accent);
  box-shadow: 0 0 0 4px var(--accent-soft);
  animation: taskPulse 1s ease-in-out infinite;
}
.task-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.task-kicker {
  color: var(--text-dim);
  font-size: 10.5px;
  font-weight: 850;
  text-transform: uppercase;
}
.task-copy strong {
  color: var(--text);
  font-size: 12.5px;
  font-weight: 850;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
@keyframes taskPulse {
  0%, 100% { transform: scale(0.92); opacity: 0.7; }
  50% { transform: scale(1.14); opacity: 1; }
}
.prompt-row {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--border-subtle);
  background: color-mix(in srgb, var(--panel) 88%, var(--bg));
}
.prompt {
  flex: 1;
  min-height: 62px;
  max-height: 180px;
  resize: vertical;
  padding: 8px 10px;
  font-size: 12.5px;
  line-height: 1.45;
}
.send-btn {
  width: 104px;
  min-height: 62px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border-radius: var(--r-md);
  border: 1px solid rgba(104, 167, 255, 0.42);
  background: linear-gradient(180deg, #72adff, var(--accent-strong));
  color: #fff;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(77, 145, 247, 0.18), var(--inner-highlight);
}
.send-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
}
.send-label {
  font-size: 12.5px;
}
.send-btn kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 70px;
  padding: 2px 5px;
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.24);
  background: rgba(0, 0, 0, 0.18);
  color: rgba(255, 255, 255, 0.86);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
}
.activity-panel {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--border-subtle);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--panel-2) 76%, var(--bg)), var(--panel));
}
.activity-header {
  min-height: 51px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-subtle);
}
.activity-title {
  font-size: 12px;
  font-weight: 850;
}
.activity-subtitle {
  color: var(--text-dim);
  font-size: 11px;
  margin-top: 2px;
}
.busy-light {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
}
.busy-light.active {
  background: var(--accent);
  box-shadow: 0 0 0 4px var(--accent-soft);
}
.activity-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
}
.activity-step {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr);
  gap: 8px;
  padding: 8px;
  border-radius: var(--r-md);
  border: 1px solid var(--border-subtle);
  background: var(--raised);
  box-shadow: var(--inner-highlight);
}
.step-status {
  width: 8px;
  height: 8px;
  margin-top: 4px;
  border-radius: 50%;
  background: var(--text-muted);
}
.step-active .step-status { background: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.step-info .step-status { background: var(--text-dim); box-shadow: 0 0 0 3px rgba(167, 176, 194, 0.12); }
.step-success .step-status { background: var(--success); box-shadow: 0 0 0 3px var(--success-soft); }
.step-warning .step-status { background: var(--warning); box-shadow: 0 0 0 3px var(--generated-soft); }
.step-error .step-status { background: var(--danger); box-shadow: 0 0 0 3px var(--danger-soft); }
.step-label {
  font-size: 12px;
  font-weight: 800;
  color: var(--text);
}
.step-copy pre {
  margin-top: 4px;
  white-space: pre-wrap;
  color: var(--text-dim);
  font-family: var(--font-mono);
  font-size: 10.8px;
  line-height: 1.4;
  max-height: 96px;
  overflow: auto;
}
.activity-empty {
  margin: auto;
  max-width: 260px;
  color: var(--text-dim);
  font-size: 12px;
  line-height: 1.45;
  text-align: center;
}
@media (max-width: 900px) {
  .setup-strip {
    grid-template-columns: 1fr;
  }
  .base-url-field,
  .skill-row {
    grid-column: auto;
  }
  .ai-workspace {
    grid-template-columns: 1fr;
  }
  .activity-panel {
    max-height: 210px;
    border-left: 0;
    border-top: 1px solid var(--border-subtle);
  }
}
</style>
