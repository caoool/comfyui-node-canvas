<template>
  <section class="ai-panel" aria-label="AI builder chat">
    <header class="ai-topbar">
      <div class="topbar-left">
        <div class="title-group">
          <div class="pane-title">AI Builder</div>
          <div class="pane-subtitle">
            {{ projectStore.project.name }} · {{ threadMessageCount }} thread messages
          </div>
        </div>
      </div>
      <div class="topbar-settings">
        <button
          data-testid="ai-new-conversation"
          class="icon-button"
          type="button"
          title="New conversation"
          aria-label="New conversation"
          @click="startNewConversation"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 3.25v9.5" />
            <path d="M3.25 8h9.5" />
          </svg>
        </button>
        <button
          data-testid="ai-list-conversations"
          class="icon-button"
          type="button"
          title="List conversations"
          aria-label="List conversations"
          @click="openResumeDialog"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4.25 4.25h7.5" />
            <path d="M4.25 8h7.5" />
            <path d="M4.25 11.75h5.5" />
          </svg>
        </button>
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
      </div>
    </header>

    <div v-if="settingsOpen" class="settings-popover" data-testid="ai-settings-popover" role="dialog" aria-label="AI settings">
      <div class="settings-popover-header">
        <div>
          <div class="settings-title">AI Settings</div>
          <div class="settings-subtitle">{{ provider }} · {{ providerModelLabel }}</div>
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
        <label class="switch-control deploy-toggle settings-deploy-toggle" :class="{ checked: allowDeploy }">
          <input data-testid="allow-ai-deploy" type="checkbox" v-model="allowDeploy" />
          <span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>
          <span>Allow AI deploy</span>
        </label>

        <label class="field-group provider-field">
          <span>Provider</span>
          <select data-testid="ai-provider" v-model="provider" class="field" @change="applyProviderDefaults">
            <option value="codex">Local Codex</option>
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
          <div class="model-select-row" :class="{ 'no-refresh': isLocalCodex }">
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
              v-if="!isLocalCodex"
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
          <span>{{ isLocalCodex ? 'Codex model override' : 'Manual model' }}</span>
          <input
            data-testid="ai-model-input"
            v-model="model"
            class="field mono-field"
            :class="{ 'field-disabled': !manualModelSelected }"
            :disabled="!manualModelSelected"
            :placeholder="manualModelSelected ? modelInputPlaceholder : 'select Custom model... to edit'"
            spellcheck="false"
            @input="syncModelPresetFromInput"
          />
        </label>

        <label v-if="isLocalCodex" class="field-group effort-field">
          <span>Reasoning effort</span>
          <select data-testid="ai-codex-effort" v-model="reasoningEffort" class="field">
            <option
              v-for="option in codexReasoningOptions"
              :key="option.effort"
              :value="option.effort"
            >
              {{ option.effort }}
            </option>
          </select>
        </label>

        <div v-if="isLocalCodex" class="codex-status-card" :class="`check-${codexStatusState}`" data-testid="ai-codex-status">
          <div>
            <strong>{{ codexStatusText }}</strong>
            <span>{{ codexStatusDetail }}</span>
          </div>
          <button
            data-testid="ai-check-codex"
            class="btn-check-codex"
            type="button"
            :disabled="codexStatusState === 'checking'"
            @click="refreshCodexStatus"
          >
            {{ codexStatusState === 'checking' ? 'Checking...' : 'Check Codex' }}
          </button>
        </div>

        <label v-if="!isLocalCodex" class="field-group api-key-field">
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

        <label v-if="!isLocalCodex" class="field-group base-url-field">
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

    <div v-if="resumeOpen" class="resume-backdrop" data-testid="ai-resume-dialog" role="dialog" aria-label="Resume AI conversation">
      <div class="resume-dialog" data-testid="ai-conversation-dialog">
        <header class="resume-header">
          <div>
            <div class="resume-title">Resume Conversation</div>
            <div class="resume-subtitle">{{ savedConversations.length }} saved sessions</div>
          </div>
          <button class="icon-button" type="button" title="Close" aria-label="Close resume dialog" @click="resumeOpen = false">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </header>
        <div class="resume-list">
          <div
            v-for="(conversation, index) in savedConversations"
            :key="conversation.id"
            class="resume-item"
          >
            <button
              :data-testid="`resume-conversation-${index}`"
              class="resume-select"
              type="button"
              @click="resumeConversation(conversation.id)"
            >
              <strong>{{ conversation.title }}</strong>
              <span>{{ formatConversationDate(conversation.updatedAt) }}</span>
            </button>
            <button
              :data-testid="`delete-conversation-${index}`"
              class="resume-delete"
              type="button"
              title="Delete conversation"
              aria-label="Delete conversation"
              @click="deleteConversation(conversation.id)"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3.25 4.75h9.5" />
                <path d="M6.25 4.75V3.5h3.5v1.25" />
                <path d="M4.75 4.75 5.35 12.2c.05.62.57 1.1 1.19 1.1h2.92c.62 0 1.14-.48 1.19-1.1l.6-7.45" />
              </svg>
            </button>
          </div>
          <div v-if="savedConversations.length === 0" class="resume-empty">No previous conversations saved.</div>
        </div>
      </div>
    </div>

    <div class="ai-workspace">
      <section class="conversation-panel" aria-label="AI conversation">
        <div class="messages" ref="messagesRef" data-testid="ai-messages">
          <div v-if="messages.length === 0" class="conversation-empty" data-testid="ai-conversation-empty">
            <span class="empty-kicker">Ready</span>
            <strong>{{ projectStore.project.name || 'AI Builder' }}</strong>
            <span>{{ providerModelLabel }} · {{ selectedSkills.length }} active skills</span>
          </div>

          <div
            v-for="message in messages"
            :key="message.id"
            class="message"
            :class="[
              `message-${message.role}`,
              `message-tone-${messageTone(message)}`,
              { 'message-streaming': message.streaming },
            ]"
            :data-testid="`ai-message-${message.role}`"
          >
            <div class="message-rail" aria-hidden="true">
              <span class="role-dot"></span>
              <span class="rail-line"></span>
            </div>
            <article class="message-card">
              <header class="message-header">
                <div class="message-role">
                  <span>{{ messageRoleLabel(message) }}</span>
                  <span v-if="message.createdAt" class="message-time">{{ messageTimestamp(message) }}</span>
                </div>
                <div class="message-meta">
                  <span v-if="message.streaming" class="message-chip chip-live">
                    <span class="live-dot" aria-hidden="true"></span>
                    streaming
                  </span>
                  <span v-else-if="message.role === 'notice'" class="message-chip">
                    {{ messageNoticeLabel(message) }}
                  </span>
                </div>
              </header>
              <div class="message-body">
                <template v-for="(block, index) in messageBlocks(message.content)" :key="`${message.id}-${index}`">
                  <p v-if="block.kind === 'paragraph'">{{ block.text }}</p>
                  <ul v-else-if="block.kind === 'list'" class="message-list">
                    <li v-for="(item, itemIndex) in block.items" :key="`${message.id}-${index}-${itemIndex}`">{{ item }}</li>
                  </ul>
                  <pre v-else class="message-terminal">{{ block.text }}</pre>
                </template>
              </div>
            </article>
          </div>

          <div
            v-if="busy || currentTaskTitle"
            class="current-task"
            :class="[`task-${currentTaskStatus}`, { 'is-generating': busy }]"
            data-testid="ai-current-task"
          >
            <div class="task-indicator" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <div class="task-copy">
              <span class="task-kicker">{{ busy ? 'Working' : 'Latest task' }}</span>
              <strong>{{ currentTaskTitle || 'Waiting for AI' }}</strong>
              <span v-if="currentTaskDetail" class="task-detail">{{ currentTaskDetail }}</span>
            </div>
            <span v-if="busy" class="task-live">live</span>
          </div>
        </div>

        <form class="prompt-row" @submit.prevent="sendPrompt">
          <div
            data-testid="ai-prompt-resize-handle"
            class="prompt-resize-handle"
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize prompt"
            title="Resize prompt"
            @mousedown.prevent="startPromptResize"
          ></div>
          <div v-if="commandMenuOpen" class="command-menu" data-testid="ai-command-menu">
            <button
              v-for="command in filteredSlashCommands"
              :key="command.command"
              type="button"
              class="command-item"
              @mousedown.prevent="runSlashCommand(command.command)"
            >
              <strong>{{ command.command }}</strong>
              <span>{{ command.label }}</span>
            </button>
            <div v-if="filteredSlashCommands.length === 0" class="command-empty">No commands match.</div>
          </div>
          <textarea
            data-testid="ai-prompt"
            v-model="prompt"
            class="prompt"
            :disabled="busy"
            :style="{ height: `${promptHeight}px` }"
            placeholder="Ask AI or type /clear, /resume, /compact. Enter to send, Shift+Enter for a new line."
            @keydown.enter.exact.prevent="sendPrompt"
            @keydown.meta.enter.prevent="sendPrompt"
            @keydown.ctrl.enter.prevent="sendPrompt"
          ></textarea>
        </form>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { AI_SKILLS, systemPromptForSkills } from '../lib/aiSkills'
import { parseAiActionPlan, type BuilderAction } from '../lib/aiActionPlan'
import { applyBuilderAction, type BuilderActionResult } from '../lib/builderAutomation'
import { fetchAiModels, fetchCodexStatus, streamAiChat, type AiChatProviderConfig, type AiChatMessage, type AiChatStreamEvent, type CodexReasoningOption, type CodexStatus } from '../lib/aiAssistantClient'
import { buildPackFiles } from '../lib/buildPackFiles'
import { NODE_TEMPLATES } from '../lib/nodeTemplates'
import { runNodeTerminalCommand } from '../lib/nodeTerminalClient'
import { cloneProjectSnapshot, describeProjectChanges } from '../lib/projectDiff'
import { useProjectStore } from '../stores/project'
import { useUiStore } from '../stores/ui'

const emit = defineEmits<{ deploy: [] }>()

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'notice'
  content: string
  streaming?: boolean
  createdAt?: number
}

interface SavedConversation {
  id: string
  title: string
  updatedAt: number
  messages: ChatMessage[]
}

interface SlashCommand {
  command: '/clear' | '/resume' | '/compact'
  label: string
}

interface ModelOption {
  label: string
  value: string
}

interface ProviderPreset {
  baseUrl: string
  models: ModelOption[]
}

type StepStatus = 'active' | 'info' | 'success' | 'warning' | 'error'
type MessageTone = 'user' | 'assistant' | 'success' | 'warning' | 'error' | 'info'
type MessageBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'terminal'; text: string }

const slashCommands: SlashCommand[] = [
  { command: '/clear', label: 'Clear current context' },
  { command: '/resume', label: 'Resume a saved conversation' },
  { command: '/compact', label: 'Compact current session' },
]

const projectStore = useProjectStore()
const uiStore = useUiStore()
const providerPresets: Record<AiChatProviderConfig['provider'], ProviderPreset> = {
  codex: {
    baseUrl: '',
    models: [
      { label: 'Codex default', value: '__codex_default__' },
    ],
  },
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
const AI_CONVERSATIONS_KEY = 'comfyui-node-builder-ai-conversations'

interface PersistedAiSettings {
  provider?: AiChatProviderConfig['provider']
  modelPreset?: string
  model?: string
  apiKey?: string
  baseUrl?: string
  reasoningEffort?: string
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
      reasoningEffort: typeof parsed.reasoningEffort === 'string' ? parsed.reasoningEffort : undefined,
      selectedSkills: Array.isArray(parsed.selectedSkills) ? parsed.selectedSkills.filter(item => typeof item === 'string') : undefined,
    }
  } catch {
    return {}
  }
}

function loadSavedConversations(): SavedConversation[] {
  const storage = settingsStorage()
  if (!storage) return []
  try {
    const parsed = JSON.parse(storage.getItem(AI_CONVERSATIONS_KEY) || '[]') as Partial<SavedConversation>[]
    return (Array.isArray(parsed) ? parsed : [])
      .filter(item => typeof item.id === 'string' && Array.isArray(item.messages))
      .map(item => ({
        id: item.id!,
        title: typeof item.title === 'string' && item.title.trim() ? item.title : 'Untitled conversation',
        updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now(),
        messages: item.messages!.filter((message): message is ChatMessage => (
          Boolean(message)
          && typeof message.id === 'string'
          && ((message as { role?: unknown }).role === 'user' || (message as { role?: unknown }).role === 'assistant' || (message as { role?: unknown }).role === 'notice')
          && typeof message.content === 'string'
        )).map(message => ({
          ...message,
          createdAt: typeof message.createdAt === 'number' ? message.createdAt : undefined,
        })),
      }))
      .filter(item => item.messages.some(message => message.role === 'user' || message.role === 'assistant'))
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, 20)
  } catch {
    return []
  }
}

function saveConversations(conversations: SavedConversation[]) {
  const storage = settingsStorage()
  if (!storage) return
  storage.setItem(AI_CONVERSATIONS_KEY, JSON.stringify(conversations.slice(0, 20)))
}

function newConversationId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const persistedAiSettings = loadAiSettings()
const provider = ref<AiChatProviderConfig['provider']>(persistedAiSettings.provider ?? 'codex')
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
const reasoningEffort = ref(persistedAiSettings.reasoningEffort ?? 'medium')
const fetchedModels = ref<ModelOption[]>([])
const modelLoading = ref(false)
const codexStatusState = ref<'idle' | 'checking' | 'ok' | 'error'>('idle')
const codexStatusDetail = ref('Not checked')
const codexModelDetails = ref<CodexStatus['models']>([])
const codexReasoningOptions = ref<CodexReasoningOption[]>([
  { effort: 'low', description: 'Fast responses with lighter reasoning' },
  { effort: 'medium', description: 'Balanced reasoning for everyday work' },
  { effort: 'high', description: 'Greater reasoning depth' },
  { effort: 'xhigh', description: 'Extra reasoning depth for complex work' },
])
const prompt = ref('')
const promptHeight = ref(72)
const busy = ref(false)
const allowDeploy = ref(false)
const settingsOpen = ref(false)
const resumeOpen = ref(false)
const selectedSkills = ref(initialSkillSelection(persistedAiSettings))
const lastRawOutput = ref('')
const currentTaskTitle = ref('')
const currentTaskDetail = ref('')
const currentTaskStatus = ref<StepStatus>('info')
const streamingAssistantMessageId = ref<string | null>(null)
const messagesRef = ref<HTMLElement | null>(null)
const messages = ref<ChatMessage[]>([])
const savedConversations = ref<SavedConversation[]>(loadSavedConversations())
const currentConversationId = ref(newConversationId())

const currentProviderPreset = computed(() => providerPresets[provider.value])
const currentModelOptions = computed(() => fetchedModels.value.length > 0 ? fetchedModels.value : currentProviderPreset.value.models)
const manualModelSelected = computed(() => modelPreset.value === '__custom__')
const isLocalCodex = computed(() => provider.value === 'codex')
const modelSourceLabel = computed(() => {
  if (isLocalCodex.value) return 'Local Codex'
  return fetchedModels.value.length > 0 ? `Fetched models (${fetchedModels.value.length})` : 'Model preset'
})
const providerModelLabel = computed(() => {
  if (isLocalCodex.value && model.value === '__codex_default__') return 'Codex default'
  return model.value || 'no model selected'
})
const modelInputPlaceholder = computed(() => isLocalCodex.value ? 'optional codex -m model' : 'type provider model id')
const codexStatusText = computed(() => {
  if (codexStatusState.value === 'checking') return 'Checking local Codex'
  if (codexStatusState.value === 'ok') return 'Local Codex available'
  if (codexStatusState.value === 'error') return 'Local Codex unavailable'
  return 'Local Codex not checked'
})
const commandMenuOpen = computed(() => prompt.value.trimStart().startsWith('/'))
const filteredSlashCommands = computed(() => {
  const query = prompt.value.trimStart().toLowerCase()
  return slashCommands.filter(command => command.command.startsWith(query))
})
const threadMessageCount = computed(() => messages.value.filter(message => message.role === 'user' || message.role === 'assistant').length)

let stopPromptResize: (() => void) | null = null

function startPromptResize(event: MouseEvent) {
  stopPromptResize?.()
  const startY = event.clientY
  const startHeight = promptHeight.value

  function onMove(moveEvent: MouseEvent) {
    const delta = startY - moveEvent.clientY
    promptHeight.value = Math.min(220, Math.max(62, startHeight + delta))
  }

  function onUp() {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    document.body.classList.remove('is-prompt-resizing')
    stopPromptResize = null
  }

  stopPromptResize = onUp
  document.body.classList.add('is-prompt-resizing')
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

onBeforeUnmount(() => {
  stopPromptResize?.()
})

watch(settingsOpen, (open) => {
  if (open && isLocalCodex.value && codexStatusState.value === 'idle') {
    void refreshCodexStatus()
  }
})

watch(model, (nextModel) => {
  if (!isLocalCodex.value) return
  const selected = codexModelDetails.value.find(option => option.id === nextModel)
  if (!selected?.supportedReasoningEfforts?.length) return
  codexReasoningOptions.value = selected.supportedReasoningEfforts
  const nextEffort = selected.defaultReasoningEffort && selected.supportedReasoningEfforts.some(option => option.effort === selected.defaultReasoningEffort)
    ? selected.defaultReasoningEffort
    : selected.supportedReasoningEfforts[0].effort
  if (!selected.supportedReasoningEfforts.some(option => option.effort === reasoningEffort.value)) {
    reasoningEffort.value = nextEffort
  }
})

function saveAiSettings() {
  const storage = settingsStorage()
  if (!storage) return
  storage.setItem(AI_SETTINGS_KEY, JSON.stringify({
    provider: provider.value,
    modelPreset: modelPreset.value,
    model: model.value,
    apiKey: apiKey.value,
    baseUrl: baseUrl.value,
    reasoningEffort: reasoningEffort.value,
    selectedSkills: selectedSkills.value,
  } satisfies PersistedAiSettings))
}

watch([provider, modelPreset, model, apiKey, baseUrl, reasoningEffort, selectedSkills], saveAiSettings, { deep: true, flush: 'sync' })

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

function decodeJsonStringFragment(value: string): string {
  const normalized = value.endsWith('\\') ? value.slice(0, -1) : value
  try {
    return JSON.parse(`"${normalized}"`) as string
  } catch {
    return normalized
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
  }
}

function extractReplyFromJsonText(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  for (const candidate of [fenced, text]) {
    if (!candidate) continue
    try {
      const parsed = JSON.parse(candidate) as { reply?: unknown }
      if (typeof parsed.reply === 'string' && parsed.reply.trim()) return parsed.reply.trim()
    } catch {
      // Fall through to partial JSON extraction below.
    }
  }
  const match = text.match(/"reply"\s*:\s*"((?:\\.|[^"\\])*)/)
  return match?.[1] ? decodeJsonStringFragment(match[1]).trim() : ''
}

function streamingDisplayText(text: string): string {
  const reply = extractReplyFromJsonText(text)
  if (reply) return cleanDisplayText(reply, '')
  return cleanDisplayText(text, '')
}

function messageTone(message: ChatMessage): MessageTone {
  if (message.role === 'user') return 'user'
  if (message.role === 'assistant') return 'assistant'
  const text = message.content.toLowerCase()
  if (/typeerror|runtimeerror|syntaxerror|traceback|exception|failed|failure|invalid|blocked|requires|not found|exit [1-9]/.test(text)) {
    return 'error'
  }
  if (/warning|no project changes|disabled|unknown command|nothing to compact/.test(text)) return 'warning'
  if (/applied builder changes|validation passed|created|updated|deleted|deployed|success|context cleared|context compacted|terminal exited 0/.test(text)) {
    return 'success'
  }
  return 'info'
}

function messageRoleLabel(message: ChatMessage): string {
  if (message.role === 'notice') return 'builder'
  if (message.role === 'assistant') return 'assistant'
  return 'you'
}

function messageNoticeLabel(message: ChatMessage): string {
  const tone = messageTone(message)
  if (tone === 'success') return 'applied'
  if (tone === 'warning') return 'warning'
  if (tone === 'error') return 'needs attention'
  return 'event'
}

function messageTimestamp(message: ChatMessage): string {
  if (!message.createdAt) return ''
  return new Date(message.createdAt).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function looksTerminalText(text: string): boolean {
  return /^\s*\$ /m.test(text) ||
    /^exit\s+\d+/im.test(text) ||
    /(?:Traceback|RuntimeError|TypeError|SyntaxError|Exception|stderr|stdout):/i.test(text)
}

function messageBlocks(content: string): MessageBlock[] {
  const trimmed = content.trim()
  if (!trimmed) return []
  if (looksTerminalText(trimmed)) return [{ kind: 'terminal', text: trimmed }]

  const blocks: MessageBlock[] = []
  const paragraphs = trimmed.split(/\n{2,}/)
  for (const paragraph of paragraphs) {
    const lines = paragraph.split('\n').map(line => line.trim()).filter(Boolean)
    let paragraphLines: string[] = []
    let listItems: string[] = []

    function flushParagraph() {
      if (paragraphLines.length === 0) return
      blocks.push({ kind: 'paragraph', text: paragraphLines.join('\n') })
      paragraphLines = []
    }

    function flushList() {
      if (listItems.length === 0) return
      blocks.push({ kind: 'list', items: listItems })
      listItems = []
    }

    for (const line of lines) {
      const listMatch = line.match(/^[-*]\s+(.+)/)
      if (listMatch) {
        flushParagraph()
        listItems.push(listMatch[1])
      } else {
        flushList()
        paragraphLines.push(line)
      }
    }
    flushParagraph()
    flushList()
  }
  return blocks
}

function addMessage(role: ChatMessage['role'], content: string) {
  const visible = role === 'notice' ? cleanDisplayText(content, '') : cleanDisplayText(content)
  if (!visible) return
  messages.value.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, role, content: visible, createdAt: Date.now() })
  scrollMessages()
}

function addNotice(content: string) {
  addMessage('notice', content)
}

function setStreamingAssistantContent(content: string) {
  const visible = streamingDisplayText(content)
  if (!visible) return
  const existing = streamingAssistantMessageId.value
    ? messages.value.find(message => message.id === streamingAssistantMessageId.value)
    : null
  if (existing) {
    existing.content = visible
    existing.streaming = true
  } else {
    const message: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role: 'assistant',
      content: visible,
      streaming: true,
      createdAt: Date.now(),
    }
    streamingAssistantMessageId.value = message.id
    messages.value.push(message)
  }
  scrollMessages()
}

function finishAssistantMessage(content: string) {
  const visible = cleanDisplayText(content)
  const existing = streamingAssistantMessageId.value
    ? messages.value.find(message => message.id === streamingAssistantMessageId.value)
    : null
  if (existing) {
    existing.content = visible
    existing.streaming = false
    streamingAssistantMessageId.value = null
    scrollMessages()
    return
  }
  addMessage('assistant', visible)
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

function addStep(_status: StepStatus, label: string, detail?: string) {
  if (!busy.value) return
  currentTaskStatus.value = _status
  currentTaskTitle.value = label
  currentTaskDetail.value = detail?.trim() ?? ''
}

function meaningfulMessages(): ChatMessage[] {
  return messages.value.filter(message => message.role === 'user' || message.role === 'assistant')
}

function conversationTitle(sourceMessages = meaningfulMessages()): string {
  const firstUser = sourceMessages.find(message => message.role === 'user')?.content
  const firstContent = firstUser || sourceMessages.find(message => message.role === 'assistant')?.content || sourceMessages[0]?.content
  if (!firstContent) return 'Untitled conversation'
  return firstContent.split('\n')[0].slice(0, 80)
}

function archiveCurrentConversation() {
  const content = meaningfulMessages()
  if (content.length === 0) return
  const archived: SavedConversation = {
    id: currentConversationId.value,
    title: conversationTitle(content),
    updatedAt: Date.now(),
    messages: messages.value.map(message => ({ ...message })),
  }
  const rest = savedConversations.value.filter(conversation => conversation.id !== archived.id)
  savedConversations.value = [archived, ...rest].slice(0, 20)
  saveConversations(savedConversations.value)
}

function resetConversation(systemMessage?: string) {
  messages.value = []
  if (systemMessage) addNotice(systemMessage)
  lastRawOutput.value = ''
  currentTaskTitle.value = ''
  currentTaskDetail.value = ''
  currentTaskStatus.value = 'info'
  currentConversationId.value = newConversationId()
}

function clearConversation() {
  archiveCurrentConversation()
  resetConversation('Context cleared.')
}

function startNewConversation() {
  archiveCurrentConversation()
  resetConversation()
}

function compactConversation() {
  const content = meaningfulMessages()
  if (content.length === 0) {
    addNotice('Nothing to compact yet.')
    return
  }
  archiveCurrentConversation()
  const userCount = content.filter(message => message.role === 'user').length
  const assistantCount = content.filter(message => message.role === 'assistant').length
  const latestUser = [...content].reverse().find(message => message.role === 'user')?.content
  resetConversation([
    'Context compacted.',
    `Previous session had ${userCount} user message${userCount === 1 ? '' : 's'} and ${assistantCount} assistant message${assistantCount === 1 ? '' : 's'}.`,
    latestUser ? `Latest user request: ${latestUser}` : '',
  ].filter(Boolean).join('\n'))
}

function openResumeDialog() {
  savedConversations.value = loadSavedConversations()
  resumeOpen.value = true
}

function deleteConversation(id: string) {
  savedConversations.value = savedConversations.value.filter(conversation => conversation.id !== id)
  saveConversations(savedConversations.value)
  if (currentConversationId.value === id) {
    resetConversation()
  }
}

function resumeConversation(id: string) {
  const conversation = savedConversations.value.find(item => item.id === id)
  if (!conversation) return
  messages.value = conversation.messages.map(message => ({ ...message }))
  currentConversationId.value = conversation.id
  resumeOpen.value = false
  scrollMessages('auto')
}

function formatConversationDate(value: number): string {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function handleSlashCommand(command: string): boolean {
  if (command === '/clear') {
    clearConversation()
    return true
  }
  if (command === '/compact') {
    compactConversation()
    return true
  }
  if (command === '/resume') {
    openResumeDialog()
    return true
  }
  if (command.startsWith('/')) {
    addNotice(`Unknown command: ${command}`)
    return true
  }
  return false
}

function runSlashCommand(command: SlashCommand['command']) {
  prompt.value = ''
  handleSlashCommand(command)
}

function applyProviderDefaults() {
  const preset = currentProviderPreset.value
  baseUrl.value = preset.baseUrl
  fetchedModels.value = []
  modelPreset.value = preset.models[0]?.value ?? '__custom__'
  model.value = modelPreset.value === '__custom__' ? '' : modelPreset.value
  if (provider.value === 'codex') void refreshCodexStatus()
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
  if (isLocalCodex.value) return false
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

function applyCodexModels(status: Awaited<ReturnType<typeof fetchCodexStatus>>) {
  codexModelDetails.value = status.models
  if (status.models.length > 0) {
    fetchedModels.value = status.models.map(model => ({ label: model.label, value: model.id }))
    const configModel = status.configModel && status.models.some(model => model.id === status.configModel)
      ? status.configModel
      : status.models[0].id
    modelPreset.value = configModel
    model.value = configModel
  }
  const selected = status.models.find(option => option.id === model.value)
  codexReasoningOptions.value = selected?.supportedReasoningEfforts?.length
    ? selected.supportedReasoningEfforts
    : status.reasoningEfforts.length > 0
      ? status.reasoningEfforts
      : codexReasoningOptions.value
  const configuredEffort = status.configReasoningEffort || selected?.defaultReasoningEffort
  if (configuredEffort && codexReasoningOptions.value.some(option => option.effort === configuredEffort)) {
    reasoningEffort.value = configuredEffort
  } else if (!codexReasoningOptions.value.some(option => option.effort === reasoningEffort.value)) {
    reasoningEffort.value = codexReasoningOptions.value[0]?.effort ?? 'medium'
  }
}

async function refreshCodexStatus() {
  if (!isLocalCodex.value || codexStatusState.value === 'checking') return
  codexStatusState.value = 'checking'
  codexStatusDetail.value = 'Checking local Codex...'
  addStep('active', 'Checking local Codex')
  try {
    const status = await fetchCodexStatus()
    applyCodexModels(status)
    codexStatusState.value = status.available ? 'ok' : 'error'
    codexStatusDetail.value = status.version || status.detail || (status.available ? 'Available' : 'Unavailable')
    addStep(status.available ? 'success' : 'error', codexStatusText.value, codexStatusDetail.value)
  } catch (err) {
    const message = String(err)
    codexStatusState.value = 'error'
    codexStatusDetail.value = message
    addStep('error', 'Local Codex check failed', message)
  }
}

function providerConfig(): AiChatProviderConfig {
  if (provider.value === 'codex') {
    return {
      provider: 'codex',
      model: model.value.trim() === '__codex_default__' ? '' : model.value.trim(),
      reasoningEffort: reasoningEffort.value,
    }
  }
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

function nodeTemplatesContext(): string {
  return [
    'Available node templates.',
    'Use create_node with templateId when a maintained template matches the request; add a node patch only for user-specific customization.',
    ...NODE_TEMPLATES.map(template => `- ${template.id}: ${template.label}. ${template.description}`),
  ].join('\n')
}

function recentBuilderLogsContext(): string {
  const logs = uiStore.builderLogs.slice(0, 12)
  if (logs.length === 0) return ''
  const lines = logs
    .map(log => {
      const message = truncateForPrompt(log.message.trim(), 2_000)
      return `- [${log.source}/${log.level}] ${message}`
    })
    .filter(line => line.trim())
  if (lines.length === 0) return ''
  return [
    'Recent builder, deploy, and terminal logs.',
    'Use these logs as the primary evidence when the user asks you to fix deploy, install, validation, terminal, or runtime failures. Prefer addressing the concrete latest error over repeating an earlier attempted fix.',
    ...lines,
  ].join('\n')
}

function chatMessages(userPrompt: string): AiChatMessage[] {
  const builderLogs = recentBuilderLogsContext()
  return [
    { role: 'system', content: systemPromptForSkills(selectedSkills.value) },
    { role: 'system', content: nodeTemplatesContext() },
    { role: 'system', content: `Current builder project JSON:\n${projectContext()}` },
    { role: 'system', content: runtimeFilesContext() },
    builderLogs ? { role: 'system', content: builderLogs } : null,
    ...messages.value
      .filter(message => message.role === 'user' || message.role === 'assistant')
      .slice(-8)
      .map(message => ({ role: message.role, content: message.content }) as AiChatMessage),
    { role: 'user', content: userPrompt },
  ].filter((message): message is AiChatMessage => Boolean(message))
}

async function handleTerminalAction(action: Extract<BuilderAction, { type: 'run_terminal' }>): Promise<BuilderActionResult> {
  const result = await applyBuilderAction(projectStore, uiStore, action)
  if (!result.terminalCommand) {
    addNotice(result.message)
    addStep(result.level, result.message)
    return result
  }
  addStep('active', 'Running terminal command', result.terminalCommand)
  const terminalResult = await runNodeTerminalCommand(projectStore.project, result.terminalNodeId ?? uiStore.selectedNodeId, result.terminalCommand)
  const stdout = typeof terminalResult.stdout === 'string' ? terminalResult.stdout.trimEnd() : ''
  const stderr = typeof terminalResult.stderr === 'string' ? terminalResult.stderr.trimEnd() : ''
  const output = [
    `$ ${terminalResult.command}`,
    stdout,
    stderr,
    `exit ${terminalResult.exitCode}`,
  ].filter(Boolean).join('\n')
  uiStore.addBuilderLog('terminal', terminalResult.exitCode === 0 ? 'success' : 'error', output)
  addNotice(output)
  addStep(terminalResult.exitCode === 0 ? 'success' : 'error', `Terminal exited ${terminalResult.exitCode}`, output)
  return {
    level: terminalResult.exitCode === 0 ? 'success' : 'error',
    message: `Terminal exited ${terminalResult.exitCode}`,
    terminalCommand: terminalResult.command,
    terminalNodeId: result.terminalNodeId,
  }
}

function actionMayChangeProject(action: BuilderAction): boolean {
  return [
    'create_pack',
    'switch_pack',
    'rename_pack',
    'create_node',
    'update_node',
    'delete_node',
    'set_requirements',
    'set_install_script',
    'upsert_file',
    'delete_file',
  ].includes(action.type)
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
  if (action.type === 'set_requirements') {
    return Array.isArray(action.requirements) ? `Updating ${action.requirements.length} dependencies` : 'Updating requirements'
  }
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

interface ExecuteActionOptions {
  announceProjectResult?: boolean
}

async function executeAction(action: BuilderAction, options: ExecuteActionOptions = {}): Promise<BuilderActionResult | undefined> {
  const title = actionTitle(action)
  currentTaskTitle.value = title
  addStep('active', title)
  if (action.type === 'deploy_pack') {
    if (!allowDeploy.value) {
      addNotice('AI deploy is disabled. Enable "Allow AI deploy" to let AI trigger Deploy & Restart.')
      addStep('warning', 'Deploy blocked', 'Enable Allow deploy before AI can trigger Deploy & Restart.')
      return { level: 'warning', message: 'Deploy blocked.' }
    }
    emit('deploy')
    addNotice('Deploy requested for the active pack.')
    addStep('success', 'Deploy requested for active pack')
    return { level: 'success', message: 'Deploy requested for the active pack.', deployRequested: true }
  }
  if (action.type === 'run_terminal') {
    return await handleTerminalAction(action)
  }
  const result = await applyBuilderAction(projectStore, uiStore, action)
  const shouldAnnounce = options.announceProjectResult !== false || result.level === 'warning' || result.level === 'error'
  if (shouldAnnounce) {
    uiStore.addBuilderLog('builder', result.level, result.message)
    addNotice(result.message)
    addStep(result.level, result.message)
  }
  return result
}

function formatChangeSummary(changes: string[]): string {
  const visibleChanges = changes.slice(0, 10)
  const extraCount = changes.length - visibleChanges.length
  return [
    'Applied builder changes:',
    ...visibleChanges.map(change => `- ${change}`),
    extraCount > 0 ? `- ${extraCount} more changes` : '',
  ].filter(Boolean).join('\n')
}

async function executeAgentActions(actions: BuilderAction[]) {
  const before = cloneProjectSnapshot(projectStore.project)
  const mutatingActions = actions.filter(actionMayChangeProject)
  const results: BuilderActionResult[] = []
  for (const action of actions) {
    const result = await executeAction(action, {
      announceProjectResult: !actionMayChangeProject(action),
    })
    if (result) results.push(result)
    if (result?.level === 'error') return
  }
  if (mutatingActions.length === 0) return
  const changes = describeProjectChanges(before, cloneProjectSnapshot(projectStore.project))
  if (changes.length === 0) {
    const message = 'No project changes detected. The returned builder actions did not change the active project, so I did not mark this as updated.'
    addNotice(message)
    addStep('warning', 'No project changes detected', message)
    uiStore.addBuilderLog('builder', 'warning', message)
    return
  }
  const summary = formatChangeSummary(changes)
  addNotice(summary)
  addStep('success', 'Applied builder changes', changes.join('\n'))
  uiStore.addBuilderLog('builder', 'success', summary)
}

function applyStreamEvent(event: AiChatStreamEvent) {
  if (event.type === 'status') {
    addStep('active', event.message)
    return
  }
  if (event.type === 'delta') {
    lastRawOutput.value += event.content
    setStreamingAssistantContent(lastRawOutput.value)
    scrollMessages()
    return
  }
  if (event.type === 'done') {
    lastRawOutput.value = event.content || lastRawOutput.value
    addStep('success', 'Provider response received', lastRawOutput.value.slice(0, 1200))
    uiStore.showToast('AI response received', 'info', cleanDisplayText(lastRawOutput.value).slice(0, 180))
    scrollMessages()
    return
  }
  addStep('error', 'Provider stream error', event.message)
}

async function sendPrompt() {
  const nextPrompt = prompt.value.trim()
  if (!nextPrompt || busy.value) return
  prompt.value = ''
  if (handleSlashCommand(nextPrompt)) return
  busy.value = true
  currentTaskTitle.value = 'Sending prompt'
  currentTaskDetail.value = ''
  currentTaskStatus.value = 'active'
  addMessage('user', nextPrompt)
  addStep('active', 'Sending prompt', nextPrompt)
  lastRawOutput.value = ''
  streamingAssistantMessageId.value = null
  let streamCompleted = false
  try {
    const assistantText = await streamAiChat(providerConfig(), chatMessages(nextPrompt), event => {
      if (event.type === 'done') streamCompleted = true
      applyStreamEvent(event)
    })
    lastRawOutput.value = assistantText || lastRawOutput.value
    if (!streamCompleted) {
      addStep('success', 'Provider response received', lastRawOutput.value.slice(0, 1200))
      uiStore.showToast('AI response received', 'info', cleanDisplayText(lastRawOutput.value).slice(0, 180))
      scrollMessages()
    }
    const plan = parseAiActionPlan(assistantText)
    addStep(plan.actions.length > 0 ? 'success' : 'warning', `Parsed ${plan.actions.length} action${plan.actions.length === 1 ? '' : 's'}`)
    finishAssistantMessage(plan.reply || assistantText)
    await executeAgentActions(plan.actions)
  } catch (err) {
    streamingAssistantMessageId.value = null
    const message = String(err)
    addNotice(message)
    addStep('error', 'AI request failed', message)
    uiStore.addBuilderLog('builder', 'error', message)
  } finally {
    busy.value = false
    currentTaskTitle.value = ''
    currentTaskDetail.value = ''
    currentTaskStatus.value = 'info'
  }
}
</script>

<style scoped>
.ai-panel {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  container-type: inline-size;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--panel-2) 74%, var(--bg)), var(--panel)),
    var(--panel);
  border-top: 1px solid var(--border-subtle);
  color: var(--text);
  min-height: 0;
}
.ai-topbar {
  min-height: 53px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 9px 10px;
  border-bottom: 1px solid var(--border-subtle);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.035), transparent),
    var(--panel);
  box-shadow: var(--inner-highlight);
  flex-shrink: 0;
}
.topbar-left {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}
.title-group {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.pane-title {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 850;
  letter-spacing: 0;
  white-space: nowrap;
}
.pane-subtitle {
  min-width: 0;
  color: var(--text-muted);
  font-size: 10px;
  line-height: 1;
  margin-top: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.topbar-settings {
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
.icon-button.active,
.icon-button[aria-pressed="true"] {
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
.resume-backdrop {
  position: absolute;
  inset: 0;
  z-index: 35;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(3, 7, 12, 0.58);
}
.resume-dialog {
  width: min(440px, 100%);
  max-height: min(520px, calc(100% - 24px));
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--panel-2) 86%, var(--bg)), var(--panel)),
    var(--panel);
  box-shadow: 0 18px 55px rgba(0, 0, 0, 0.38), var(--inner-highlight);
  overflow: hidden;
}
.resume-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-subtle);
}
.resume-title {
  font-size: 13px;
  font-weight: 850;
}
.resume-subtitle {
  margin-top: 2px;
  color: var(--text-dim);
  font-size: 11px;
}
.resume-list {
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
}
.resume-item {
  width: 100%;
  display: flex;
  align-items: stretch;
  gap: 6px;
  padding: 0;
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-sm);
  background: var(--raised);
  color: var(--text);
  text-align: left;
  overflow: hidden;
}
.resume-item:hover {
  border-color: rgba(104, 167, 255, 0.34);
  background: var(--hover);
}
.resume-select {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 9px 10px;
  border: 0;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  text-align: left;
}
.resume-select strong {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
}
.resume-select span,
.resume-empty {
  color: var(--text-dim);
  font-size: 11px;
}
.resume-delete {
  width: 32px;
  border: 0;
  border-left: 1px solid var(--border-subtle);
  background: transparent;
  color: var(--text-dim);
  cursor: pointer;
}
.resume-delete:hover {
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 10%, transparent);
}
.resume-delete svg {
  width: 14px;
  height: 14px;
  stroke: currentColor;
  stroke-width: 1.6;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.resume-empty {
  padding: 16px;
  text-align: center;
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
.codex-status-card,
.settings-deploy-toggle,
.skill-row {
  grid-column: 1 / -1;
}
.settings-deploy-toggle {
  justify-content: flex-start;
  width: max-content;
  padding: 2px 0 4px;
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
.model-select-row.no-refresh {
  grid-template-columns: minmax(0, 1fr);
}
.codex-status-card {
  grid-column: 1 / -1;
  min-height: 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 8px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-sm);
  background: color-mix(in srgb, var(--field) 68%, var(--panel));
  color: var(--text-dim);
  font-size: 11.5px;
  line-height: 1.35;
}
.codex-status-card strong,
.codex-status-card span {
  display: block;
}
.codex-status-card strong {
  color: var(--text);
  font-size: 11.5px;
  margin-bottom: 2px;
}
.codex-status-card.check-ok {
  border-color: color-mix(in srgb, var(--success) 46%, var(--border));
}
.codex-status-card.check-error {
  border-color: color-mix(in srgb, var(--danger) 52%, var(--border));
}
.btn-check-codex {
  height: 26px;
  padding: 0 9px;
  border-radius: var(--r-sm);
  border: 1px solid var(--border-subtle);
  background: var(--raised);
  color: var(--text-dim);
  cursor: pointer;
  font-size: 11px;
  font-weight: 760;
  white-space: nowrap;
}
.btn-check-codex:hover:not(:disabled) {
  color: var(--text);
  border-color: var(--border);
  background: var(--hover);
}
.btn-check-codex:disabled {
  opacity: 0.55;
  cursor: wait;
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
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(circle at 16px 16px, rgba(255,255,255,0.035) 0 1px, transparent 1px) 0 0 / 18px 18px,
    linear-gradient(180deg, color-mix(in srgb, var(--panel) 92%, var(--bg)), var(--panel));
}
.conversation-panel {
  flex: 1;
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
  gap: 0;
  margin: 0;
  padding: 14px 14px 16px;
  scroll-behavior: smooth;
}
.conversation-empty {
  margin: auto;
  width: min(300px, 92%);
  display: grid;
  gap: 4px;
  padding: 16px;
  border: 1px dashed var(--border);
  border-radius: var(--r-md);
  background: color-mix(in srgb, var(--panel) 72%, transparent);
  color: var(--text-dim);
  text-align: center;
}
.conversation-empty strong {
  color: var(--text);
  font-size: 14px;
}
.empty-kicker {
  color: var(--accent);
  font-size: 10px;
  font-weight: 850;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.message {
  width: 100%;
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  gap: 9px;
  padding: 0;
  border-radius: 0;
}
.message-user {
  --message-accent: var(--accent);
  --message-accent-soft: var(--accent-soft);
}
.message-assistant {
  --message-accent: var(--success);
  --message-accent-soft: var(--success-soft);
}
.message-notice,
.message-tone-info {
  --message-accent: var(--text-muted);
  --message-accent-soft: rgba(167, 176, 194, 0.09);
}
.message-tone-success {
  --message-accent: var(--success);
  --message-accent-soft: var(--success-soft);
}
.message-tone-warning {
  --message-accent: var(--warning);
  --message-accent-soft: var(--generated-soft);
}
.message-tone-error {
  --message-accent: var(--danger);
  --message-accent-soft: var(--danger-soft);
}
.message-streaming {
  --message-accent: var(--accent);
}
.message-rail {
  position: relative;
  display: flex;
  justify-content: center;
  min-height: 100%;
}
.rail-line {
  position: absolute;
  top: 18px;
  bottom: -2px;
  width: 1px;
  background: var(--border-subtle);
}
.message:last-of-type .rail-line {
  bottom: 12px;
}
.role-dot {
  position: relative;
  z-index: 1;
  width: 9px;
  height: 9px;
  margin-top: 15px;
  border-radius: 50%;
  background: var(--message-accent);
  box-shadow:
    0 0 0 4px var(--message-accent-soft),
    0 0 0 1px color-mix(in srgb, var(--message-accent) 60%, transparent);
}
.message-card {
  min-width: 0;
  margin-bottom: 10px;
  padding: 10px 12px 11px;
  border: 1px solid transparent;
  border-left-color: color-mix(in srgb, var(--message-accent) 54%, transparent);
  border-radius: var(--r-md);
  background: color-mix(in srgb, var(--panel) 56%, transparent);
}
.message-user .message-card {
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--accent) 9%, transparent), transparent),
    color-mix(in srgb, var(--panel-2) 78%, transparent);
}
.message-assistant .message-card {
  background: color-mix(in srgb, var(--panel) 70%, transparent);
}
.message-notice .message-card {
  padding: 7px 10px;
  background: color-mix(in srgb, var(--message-accent) 6%, transparent);
}
.message-streaming .message-card {
  border-color: color-mix(in srgb, var(--accent) 30%, var(--border-subtle));
  box-shadow: inset 2px 0 0 var(--accent), 0 0 0 1px rgba(104, 167, 255, 0.06);
}
.message-header {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
  margin-bottom: 5px;
}
.message-role {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--message-accent);
  font-size: 10.5px;
  font-weight: 850;
  text-transform: uppercase;
}
.message-time {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 650;
  text-transform: none;
}
.message-meta {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}
.message-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 19px;
  padding: 0 7px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--message-accent) 28%, transparent);
  background: var(--message-accent-soft);
  color: color-mix(in srgb, var(--message-accent) 86%, var(--text));
  font-size: 10px;
  font-weight: 850;
  text-transform: uppercase;
}
.chip-live {
  border-color: rgba(104, 167, 255, 0.36);
  background: var(--accent-soft);
  color: var(--accent);
}
.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: taskPulse 1s ease-in-out infinite;
}
.message-body {
  color: var(--text);
  font-size: 12.5px;
  line-height: 1.5;
}
.message-notice .message-body {
  color: var(--text-dim);
  font-size: 12px;
}
.message-body p {
  margin: 0;
  white-space: pre-wrap;
}
.message-body p + p,
.message-body p + .message-list,
.message-list + p,
.message-terminal + p,
p + .message-terminal {
  margin-top: 8px;
}
.message-list {
  margin: 0;
  padding-left: 16px;
}
.message-list li + li {
  margin-top: 3px;
}
.message-terminal {
  margin: 0;
  padding: 9px 10px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-sm);
  background: color-mix(in srgb, #020711 72%, var(--panel));
  color: #d8e7ff;
  font-family: var(--font-mono);
  font-size: 11.5px;
  line-height: 1.45;
  white-space: pre-wrap;
  overflow: auto;
}
.current-task {
  width: calc(100% - 31px);
  margin-left: 31px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: var(--r-md);
  border: 1px solid rgba(104, 167, 255, 0.32);
  background:
    linear-gradient(180deg, rgba(104, 167, 255, 0.13), rgba(104, 167, 255, 0.05)),
    var(--raised);
  box-shadow: var(--inner-highlight);
}
.task-indicator {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
}
.task-indicator span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent);
  opacity: 0.45;
}
.current-task.is-generating .task-indicator span {
  animation: taskBounce 1s ease-in-out infinite;
}
.current-task.is-generating .task-indicator span:nth-child(2) {
  animation-delay: 0.12s;
}
.current-task.is-generating .task-indicator span:nth-child(3) {
  animation-delay: 0.24s;
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
.task-detail {
  max-height: 34px;
  overflow: hidden;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 10.5px;
  line-height: 1.35;
  white-space: pre-wrap;
}
.task-live {
  margin-left: auto;
  align-self: flex-start;
  padding: 2px 6px;
  border-radius: 999px;
  border: 1px solid rgba(104, 167, 255, 0.34);
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 9px;
  font-weight: 850;
  text-transform: uppercase;
}
@keyframes taskBounce {
  0%, 100% { transform: translateY(0); opacity: 0.42; }
  50% { transform: translateY(-3px); opacity: 1; }
}
@keyframes taskPulse {
  0%, 100% { transform: scale(0.92); opacity: 0.7; }
  50% { transform: scale(1.14); opacity: 1; }
}
.prompt-row {
  position: relative;
  display: flex;
  gap: 8px;
  padding: 12px 12px 10px;
  border-top: 1px solid var(--border-subtle);
  background: color-mix(in srgb, var(--panel) 88%, var(--bg));
  flex-shrink: 0;
}
.prompt-resize-handle {
  position: absolute;
  top: 3px;
  left: 50%;
  width: 46px;
  height: 8px;
  transform: translateX(-50%);
  cursor: row-resize;
  border-radius: 999px;
}
.prompt-resize-handle::before {
  content: "";
  position: absolute;
  left: 8px;
  right: 8px;
  top: 3px;
  height: 2px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-muted) 58%, transparent);
}
.prompt-resize-handle:hover::before {
  background: var(--accent);
}
.command-menu {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: calc(100% - 4px);
  z-index: 18;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--panel-2) 88%, var(--bg)), var(--panel)),
    var(--panel);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.32), var(--inner-highlight);
}
.command-item {
  display: grid;
  grid-template-columns: 82px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  padding: 7px 8px;
  border: 1px solid transparent;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--text);
  cursor: pointer;
  text-align: left;
}
.command-item:hover {
  border-color: rgba(104, 167, 255, 0.28);
  background: var(--accent-soft);
}
.command-item strong {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--accent);
}
.command-item span,
.command-empty {
  min-width: 0;
  color: var(--text-dim);
  font-size: 11.5px;
}
.command-empty {
  padding: 8px;
}
.prompt {
  flex: 1;
  min-height: 62px;
  max-height: 220px;
  resize: none;
  padding: 8px 10px;
  font-size: 12.5px;
  line-height: 1.45;
}
:global(body.is-prompt-resizing) {
  cursor: row-resize;
  user-select: none;
}
@media (max-width: 900px) {
  .setup-strip {
    grid-template-columns: 1fr;
  }
  .base-url-field,
  .skill-row {
    grid-column: auto;
  }
}
@container (max-width: 720px) {
  .ai-topbar {
    align-items: center;
    flex-direction: row;
  }
  .topbar-left {
    flex: 1;
    width: auto;
    justify-content: flex-start;
  }
  .topbar-settings {
    width: auto;
    justify-content: flex-end;
  }
  .settings-popover {
    left: 8px;
    right: 8px;
    width: auto;
  }
  .setup-strip {
    grid-template-columns: 1fr;
  }
  .base-url-field,
  .skill-row {
    grid-column: auto;
  }
  .messages {
    padding: 10px 8px 12px;
  }
  .message {
    grid-template-columns: 16px minmax(0, 1fr);
    gap: 6px;
  }
  .message-card {
    padding: 9px 10px;
  }
  .message-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }
  .current-task {
    width: calc(100% - 22px);
    margin-left: 22px;
  }
  .prompt-row {
    padding: 8px;
  }
}
</style>
