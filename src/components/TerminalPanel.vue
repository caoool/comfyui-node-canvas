<template>
  <section class="terminal-panel" aria-label="Node terminal and builder logs">
    <header class="terminal-topbar">
      <div class="terminal-title-group">
        <div class="pane-title">{{ activeTab === 'terminal' ? 'Node Terminal' : 'Builder Output' }}</div>
        <div class="pane-subtitle">
          <span v-if="activeTab === 'terminal'">pack uv env for {{ projectStore.project.name }}</span>
          <span v-else>Deploy, terminal, and diagnostics logs</span>
        </div>
      </div>

      <div v-if="activeTab === 'terminal' && lastResult" class="env-pill" :title="lastResult.envPath">
        {{ lastResult.cwd }}
      </div>

      <div class="terminal-tabs" role="tablist" aria-label="Terminal views">
        <button
          class="terminal-tab"
          :class="{ active: activeTab === 'terminal' }"
          role="tab"
          aria-label="Terminal tab"
          :aria-selected="activeTab === 'terminal'"
          @click="activeTab = 'terminal'"
        >
          Terminal
        </button>
        <button
          class="terminal-tab"
          :class="{ active: activeTab === 'logs' }"
          role="tab"
          aria-label="Builder Output tab"
          :aria-selected="activeTab === 'logs'"
          @click="activeTab = 'logs'"
        >
          Builder Output
        </button>
      </div>

      <button class="clear-button" type="button" @click="clearActiveView">
        Clear
      </button>
    </header>

    <div v-if="activeTab === 'terminal'" class="terminal-screen" ref="terminalOutputRef">
      <div v-if="entries.length === 0" class="terminal-empty">
        Commands run in a shared pack uv environment with generated project files as the working directory.
      </div>

      <div
        v-for="entry in entries"
        :key="entry.id"
        class="terminal-entry"
        :class="`entry-${entry.kind}`"
      >
        <div v-if="entry.kind === 'command'" class="terminal-line command-line">
          <span class="prompt-label">{{ entry.prompt }}</span>
          <span>{{ entry.text }}</span>
        </div>
        <pre v-else class="terminal-block">{{ entry.text }}</pre>
      </div>

      <form class="terminal-prompt-row" @submit.prevent="runCommand">
        <span class="prompt-label">{{ promptLabel }}</span>
        <input
          ref="terminalInputRef"
          v-model="command"
          class="terminal-input"
          aria-label="Node terminal command"
          placeholder="type a command"
          spellcheck="false"
          autocomplete="off"
          :disabled="running"
          @keydown="onCommandKeydown"
        />
        <button class="run-button" type="submit" :disabled="!canRun">
          {{ running ? 'Running' : 'Run' }}
        </button>
      </form>
    </div>

    <div v-else class="builder-log-screen">
      <div v-if="uiStore.builderLogs.length === 0" class="terminal-empty">
        No builder logs yet.
      </div>
      <article
        v-for="log in uiStore.builderLogs"
        :key="log.id"
        class="builder-log"
        :class="`log-${log.level}`"
      >
        <div class="log-meta">
          <span>{{ log.source }}</span>
          <time>{{ formatTime(log.timestamp) }}</time>
        </div>
        <pre>{{ log.message }}</pre>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useProjectStore } from '../stores/project'
import { useUiStore } from '../stores/ui'
import { runNodeTerminalCommand, type NodeTerminalResult } from '../lib/nodeTerminalClient'

interface TerminalEntry {
  id: string
  kind: 'command' | 'stdout' | 'stderr' | 'system'
  prompt?: string
  text: string
}

const projectStore = useProjectStore()
const uiStore = useUiStore()
const activeTab = ref<'terminal' | 'logs'>('terminal')
const command = ref('python -V')
const running = ref(false)
const entries = ref<TerminalEntry[]>([])
const history = ref<string[]>([])
const historyIndex = ref<number | null>(null)
const draftCommand = ref('')
const lastResult = ref<NodeTerminalResult | null>(null)
const terminalOutputRef = ref<HTMLElement | null>(null)
const terminalInputRef = ref<HTMLInputElement | null>(null)

const selectedNode = computed(() =>
  projectStore.project.nodes.find(node => node.id === uiStore.selectedNodeId) ?? null,
)
const promptLabel = computed(() => `${projectStore.project.name || 'pack'} $`)
const canRun = computed(() => Boolean(command.value.trim() && !running.value))

function appendEntry(kind: TerminalEntry['kind'], text: string, prompt?: string) {
  entries.value.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    kind,
    prompt,
    text,
  })
  scrollTerminalToBottom()
}

function scrollTerminalToBottom() {
  nextTick(() => {
    const el = terminalOutputRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

function focusCommandInput() {
  nextTick(() => {
    if (activeTab.value === 'terminal') terminalInputRef.value?.focus()
  })
}

function rememberCommand(value: string) {
  const next = value.trim()
  if (!next) return
  if (history.value[history.value.length - 1] !== next) history.value.push(next)
  history.value = history.value.slice(-100)
  historyIndex.value = null
  draftCommand.value = ''
}

async function runCommand() {
  const nextCommand = command.value.trim()
  if (!nextCommand || running.value) return

  rememberCommand(nextCommand)
  command.value = ''

  if (nextCommand === 'clear' || nextCommand === 'cls') {
    entries.value = []
    focusCommandInput()
    return
  }

  appendEntry('command', nextCommand, promptLabel.value)
  uiStore.addBuilderLog('terminal', 'info', `${promptLabel.value} ${nextCommand}`)
  running.value = true
  try {
    const result = await runNodeTerminalCommand(projectStore.project, selectedNode.value?.id ?? null, nextCommand)
    lastResult.value = result
    if (result.stdout) {
      appendEntry('stdout', result.stdout.trimEnd())
      uiStore.addBuilderLog('terminal', 'success', result.stdout.trimEnd())
    }
    if (result.stderr) {
      appendEntry('stderr', result.stderr.trimEnd())
      uiStore.addBuilderLog('terminal', result.exitCode === 0 ? 'warning' : 'error', result.stderr.trimEnd())
    }
    if (result.exitCode !== 0) {
      appendEntry('system', `Process exited with code ${result.exitCode}`)
    }
  } catch (err) {
    const message = String(err)
    appendEntry('stderr', message)
    uiStore.addBuilderLog('terminal', 'error', message)
    uiStore.showToast('Terminal command failed', 'error', message)
  } finally {
    running.value = false
    focusCommandInput()
  }
}

function onCommandKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l') {
    event.preventDefault()
    entries.value = []
    return
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    if (history.value.length === 0) return
    if (historyIndex.value === null) {
      draftCommand.value = command.value
      historyIndex.value = history.value.length - 1
    } else {
      historyIndex.value = Math.max(0, historyIndex.value - 1)
    }
    command.value = history.value[historyIndex.value]
    return
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    if (historyIndex.value === null) return
    if (historyIndex.value >= history.value.length - 1) {
      historyIndex.value = null
      command.value = draftCommand.value
      draftCommand.value = ''
      return
    }
    historyIndex.value += 1
    command.value = history.value[historyIndex.value]
  }
}

function clearActiveView() {
  if (activeTab.value === 'logs') {
    uiStore.clearBuilderLogs()
  } else {
    entries.value = []
  }
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
</script>

<style scoped>
.terminal-panel {
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #080d13;
  border-top: 1px solid var(--border-subtle);
  color: var(--text);
  font-family: var(--font-mono);
}
.terminal-topbar {
  min-height: 42px;
  display: grid;
  grid-template-columns: minmax(140px, 1fr) minmax(0, auto) auto auto;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.035), transparent),
    var(--panel);
  border-bottom: 1px solid var(--border-subtle);
}
.terminal-title-group {
  min-width: 0;
}
.pane-title {
  color: var(--text);
  font: 850 11px/1.2 var(--font-sans);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.pane-subtitle {
  min-width: 0;
  margin-top: 2px;
  color: var(--text-muted);
  font: 11px/1.2 var(--font-sans);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.env-pill {
  min-width: 0;
  max-width: 360px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: var(--field);
  color: var(--text-dim);
  padding: 4px 7px;
  font: 10.5px var(--font-mono);
}
.terminal-tabs {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-sm);
  background: var(--field);
  padding: 2px;
}
.terminal-tab,
.clear-button,
.run-button {
  border: 1px solid transparent;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--text-dim);
  cursor: pointer;
  font: 760 11.5px var(--font-sans);
  padding: 5px 8px;
}
.terminal-tab:hover,
.clear-button:hover,
.run-button:hover:not(:disabled) {
  color: var(--text);
  background: var(--hover);
}
.terminal-tab.active {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: rgba(104, 167, 255, 0.24);
}
.clear-button {
  border-color: var(--border-subtle);
  background: var(--raised);
  color: var(--text);
  box-shadow: var(--inner-highlight);
}
.terminal-screen,
.builder-log-screen {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 10px;
  background:
    linear-gradient(90deg, rgba(104, 167, 255, 0.025), transparent 40px),
    #080d13;
}
.terminal-screen {
  display: flex;
  flex-direction: column;
}
.terminal-empty {
  color: var(--text-muted);
  font: 12px/1.45 var(--font-sans);
  margin-bottom: 8px;
}
.terminal-entry {
  flex: 0 0 auto;
  font: 12px/1.48 var(--font-mono);
}
.terminal-line {
  display: flex;
  min-width: 0;
  gap: 9px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  padding: 2px 0;
}
.prompt-label {
  flex: 0 0 auto;
  color: var(--accent);
  font-weight: 800;
}
.terminal-block {
  margin: 0;
  padding: 2px 0 4px 0;
  color: var(--text);
  font: inherit;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.entry-stderr .terminal-block {
  color: #ffb8b8;
}
.entry-system .terminal-block {
  color: var(--text-muted);
}
.terminal-prompt-row {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  margin-top: auto;
  padding-top: 8px;
}
.terminal-input {
  width: 100%;
  min-width: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--text);
  outline: none;
  padding: 2px 0;
  font: 12px/1.48 var(--font-mono);
  caret-color: var(--accent);
}
.terminal-input::placeholder {
  color: var(--text-muted);
}
.terminal-input:disabled {
  opacity: 0.55;
}
.run-button {
  border-color: var(--border-subtle);
  background: var(--raised);
  color: var(--text);
  padding: 4px 8px;
}
.run-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.builder-log {
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-sm);
  background: rgba(255,255,255,0.025);
  padding: 8px;
  margin-bottom: 7px;
}
.log-meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: var(--text-muted);
  font: 800 10px var(--font-sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 5px;
}
.builder-log pre {
  min-width: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  margin: 0;
  color: var(--text-dim);
  font: 11.5px/1.42 var(--font-mono);
}
.log-error {
  border-color: rgba(240, 120, 120, 0.34);
}
.log-warning {
  border-color: rgba(234, 184, 95, 0.32);
}
.log-success {
  border-color: rgba(96, 200, 143, 0.28);
}
@media (max-width: 760px) {
  .terminal-topbar {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .env-pill {
    display: none;
  }
  .terminal-tabs {
    grid-column: 1 / -1;
    width: 100%;
  }
  .terminal-tab {
    flex: 1 1 0;
  }
}
</style>
