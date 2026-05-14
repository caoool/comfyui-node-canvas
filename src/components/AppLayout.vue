<template>
  <div class="layout">
    <AppToolbar
      :export-disabled="exportDisabled"
      :export-disabled-reason="exportDisabledReason"
      :deploy-in-progress="deployInProgress"
      @export-zip="emit('export-zip')"
      @deploy="emit('deploy')"
    />
    <div class="workbench">
      <div class="panels">
        <aside class="panel panel-library" :style="{ width: `${leftWidth}px` }">
          <slot name="library" />
        </aside>
        <div class="resizer" title="Resize node manager" @mousedown="startResize('left', $event)"></div>
        <main class="panel panel-definition">
          <slot name="definition" />
        </main>
        <div class="resizer" title="Resize code workspace" @mousedown="startResize('code', $event)"></div>
        <aside class="panel panel-code" :style="{ width: `${codeWidth}px` }">
          <slot name="code" />
        </aside>
      </div>
      <div
        v-if="uiStore.aiPanelOpen"
        class="ai-resizer"
        title="Resize AI builder"
        @mousedown="startAiResize"
      ></div>
      <aside
        v-if="uiStore.aiPanelOpen"
        data-testid="ai-right-panel"
        class="panel panel-ai"
        :style="{ width: `${aiWidth}px` }"
      >
        <AiChatPanel @deploy="emit('deploy')" />
      </aside>
    </div>
    <div
      v-if="uiStore.terminalOpen"
      class="terminal-resizer"
      title="Resize terminal"
      @mousedown="startTerminalResize"
    ></div>
    <section
      v-if="uiStore.terminalOpen"
      class="terminal-shell"
      :style="{ height: `${terminalHeight}px` }"
    >
      <TerminalPanel />
    </section>
    <AppStatusBar :status-text="statusText" @settings="emit('settings')" />
    <ToastNotification />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppToolbar from './AppToolbar.vue'
import AppStatusBar from './AppStatusBar.vue'
import TerminalPanel from './TerminalPanel.vue'
import AiChatPanel from './AiChatPanel.vue'
import ToastNotification from './ToastNotification.vue'
import { useUiStore } from '../stores/ui'

defineProps<{
  statusText: string
  exportDisabled?: boolean
  exportDisabledReason?: string
  deployInProgress?: boolean
}>()

const emit = defineEmits<{
  'export-zip': []
  'deploy': []
  'settings': []
}>()

const uiStore = useUiStore()
const LAYOUT_VERSION = 'right-ai-layout-v1'
const RESIZER_WIDTH = 12
const MIN_LEFT_WIDTH = 260
const MAX_LEFT_WIDTH = 560
const MIN_CODE_WIDTH = 360
const MIN_DEFINITION_WIDTH = 280
const MIN_AI_WIDTH = 340
const MAX_AI_WIDTH = 620
const MIN_TERMINAL_HEIGHT = 180
const MAX_TERMINAL_HEIGHT = 520

const leftWidth = ref(MIN_LEFT_WIDTH)
const codeWidth = ref(MIN_CODE_WIDTH)
const terminalHeight = ref(280)
const aiWidth = ref(MIN_AI_WIDTH)

onMounted(() => {
  const hasCurrentLayout = localStorage.getItem('layout.version') === LAYOUT_VERSION
  leftWidth.value = hasCurrentLayout
    ? Number(localStorage.getItem('layout.leftWidth')) || MIN_LEFT_WIDTH
    : MIN_LEFT_WIDTH
  codeWidth.value = hasCurrentLayout
    ? Number(localStorage.getItem('layout.codeWidth')) || maxCodeWidth()
    : maxCodeWidth()
  terminalHeight.value = Number(localStorage.getItem('layout.terminalHeight')) || 280
  aiWidth.value = Number(localStorage.getItem('layout.aiWidth')) || MIN_AI_WIDTH
  normalizeLayout(true)
  window.addEventListener('resize', handleWindowResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleWindowResize)
})

watch(() => uiStore.aiPanelOpen, () => normalizeLayout(true))

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min
  return Math.min(Math.max(value, min), max)
}

function workbenchContentWidth(): number {
  const aiReserve = uiStore.aiPanelOpen ? aiWidth.value + RESIZER_WIDTH : 0
  return Math.max(MIN_LEFT_WIDTH + MIN_CODE_WIDTH + MIN_DEFINITION_WIDTH + (RESIZER_WIDTH * 2), window.innerWidth - aiReserve)
}

function maxLeftWidth(): number {
  return Math.min(
    MAX_LEFT_WIDTH,
    Math.max(MIN_LEFT_WIDTH, workbenchContentWidth() - MIN_CODE_WIDTH - MIN_DEFINITION_WIDTH - RESIZER_WIDTH),
  )
}

function maxCodeWidth(): number {
  return Math.max(MIN_CODE_WIDTH, workbenchContentWidth() - leftWidth.value - MIN_DEFINITION_WIDTH - (RESIZER_WIDTH * 2))
}

function maxTerminalHeight(): number {
  return Math.min(MAX_TERMINAL_HEIGHT, Math.max(MIN_TERMINAL_HEIGHT, Math.floor(window.innerHeight * 0.46)))
}

function maxAiWidth(): number {
  const coreMinWidth = MIN_LEFT_WIDTH + MIN_CODE_WIDTH + MIN_DEFINITION_WIDTH + (RESIZER_WIDTH * 3)
  return Math.min(MAX_AI_WIDTH, Math.max(MIN_AI_WIDTH, window.innerWidth - coreMinWidth))
}

function normalizeLayout(persist = false) {
  aiWidth.value = clamp(aiWidth.value, MIN_AI_WIDTH, maxAiWidth())
  leftWidth.value = clamp(leftWidth.value, MIN_LEFT_WIDTH, maxLeftWidth())
  codeWidth.value = clamp(codeWidth.value, MIN_CODE_WIDTH, maxCodeWidth())
  terminalHeight.value = clamp(terminalHeight.value, MIN_TERMINAL_HEIGHT, maxTerminalHeight())
  if (persist) {
    localStorage.setItem('layout.version', LAYOUT_VERSION)
    localStorage.setItem('layout.leftWidth', String(leftWidth.value))
    localStorage.setItem('layout.codeWidth', String(codeWidth.value))
    localStorage.setItem('layout.terminalHeight', String(terminalHeight.value))
    localStorage.setItem('layout.aiWidth', String(aiWidth.value))
  }
}

function handleWindowResize() {
  normalizeLayout(true)
}

function startResize(kind: 'left' | 'code', event: MouseEvent) {
  event.preventDefault()
  const startX = event.clientX
  const startLeft = leftWidth.value
  const startCode = codeWidth.value

  function onMove(moveEvent: MouseEvent) {
    const dx = moveEvent.clientX - startX
    if (kind === 'left') {
      leftWidth.value = clamp(startLeft + dx, MIN_LEFT_WIDTH, maxLeftWidth())
      codeWidth.value = clamp(codeWidth.value, MIN_CODE_WIDTH, maxCodeWidth())
      localStorage.setItem('layout.leftWidth', String(leftWidth.value))
      localStorage.setItem('layout.codeWidth', String(codeWidth.value))
    } else {
      codeWidth.value = clamp(startCode - dx, MIN_CODE_WIDTH, maxCodeWidth())
      localStorage.setItem('layout.codeWidth', String(codeWidth.value))
    }
  }

  function onUp() {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    document.body.classList.remove('is-resizing')
  }

  document.body.classList.add('is-resizing')
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

function startTerminalResize(event: MouseEvent) {
  event.preventDefault()
  const startY = event.clientY
  const startHeight = terminalHeight.value

  function onMove(moveEvent: MouseEvent) {
    const dy = startY - moveEvent.clientY
    terminalHeight.value = clamp(startHeight + dy, MIN_TERMINAL_HEIGHT, maxTerminalHeight())
    localStorage.setItem('layout.terminalHeight', String(terminalHeight.value))
  }

  function onUp() {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    document.body.classList.remove('is-terminal-resizing')
  }

  document.body.classList.add('is-terminal-resizing')
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

function startAiResize(event: MouseEvent) {
  event.preventDefault()
  const startX = event.clientX
  const startWidth = aiWidth.value

  function onMove(moveEvent: MouseEvent) {
    const dx = startX - moveEvent.clientX
    aiWidth.value = clamp(startWidth + dx, MIN_AI_WIDTH, maxAiWidth())
    codeWidth.value = clamp(codeWidth.value, MIN_CODE_WIDTH, maxCodeWidth())
    localStorage.setItem('layout.aiWidth', String(aiWidth.value))
    localStorage.setItem('layout.codeWidth', String(codeWidth.value))
  }

  function onUp() {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    document.body.classList.remove('is-ai-resizing')
  }

  document.body.classList.add('is-ai-resizing')
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}
</script>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background:
    radial-gradient(circle at 36% 0, rgba(104, 167, 255, 0.065), transparent 30rem),
    var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
}
.workbench {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.panels {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.panel {
  overflow: auto;
  background: var(--panel);
  min-width: 0;
  min-height: 0;
}
.panel-library {
  flex-shrink: 0;
  box-shadow: 1px 0 0 var(--border-subtle) inset;
}
.panel-definition {
  flex: 1;
  background: var(--bg-grid);
}
.panel-code {
  flex-shrink: 0;
  overflow: hidden;
  box-shadow: -1px 0 0 var(--border-subtle) inset;
}
.panel-ai {
  flex-shrink: 0;
  overflow: hidden;
  box-shadow: 1px 0 0 rgba(255,255,255,0.035) inset, -1px 0 0 var(--border-subtle) inset;
  background: var(--panel);
}
.resizer {
  width: 6px;
  flex-shrink: 0;
  cursor: col-resize;
  background:
    linear-gradient(90deg, transparent, rgba(148,163,184,0.18), transparent),
    var(--bg);
  transition: background 120ms ease;
}
.resizer:hover {
  background:
    linear-gradient(90deg, transparent, rgba(104,167,255,0.7), transparent),
    var(--bg);
}
.terminal-resizer {
  height: 6px;
  flex-shrink: 0;
  cursor: row-resize;
  background:
    linear-gradient(180deg, transparent, rgba(148,163,184,0.2), transparent),
    var(--bg);
  transition: background 120ms ease;
}
.terminal-resizer:hover {
  background:
    linear-gradient(180deg, transparent, rgba(104,167,255,0.68), transparent),
    var(--bg);
}
.ai-resizer {
  width: 6px;
  flex-shrink: 0;
  cursor: col-resize;
  background:
    linear-gradient(90deg, transparent, rgba(148,163,184,0.2), transparent),
    var(--bg);
  transition: background 120ms ease;
}
.ai-resizer:hover {
  background:
    linear-gradient(90deg, transparent, rgba(104,167,255,0.68), transparent),
    var(--bg);
}
.terminal-shell {
  flex: 0 0 auto;
  min-height: 0;
  overflow: hidden;
  background: var(--bg);
}
:global(body.is-resizing) {
  cursor: col-resize;
  user-select: none;
}
:global(body.is-terminal-resizing) {
  cursor: row-resize;
  user-select: none;
}
:global(body.is-ai-resizing) {
  cursor: col-resize;
  user-select: none;
}
@media (max-width: 760px) {
  .workbench {
    flex-direction: column;
    overflow: auto;
  }
  .panels {
    flex-direction: column;
    flex: 0 0 auto;
    overflow: visible;
  }
  .panel-library,
  .panel-code,
  .panel-ai {
    width: 100% !important;
    flex: 0 0 auto;
  }
  .panel-library {
    min-height: 720px;
  }
  .panel-definition {
    flex: 0 0 auto;
    min-height: 720px;
  }
  .panel-code {
    min-height: 560px;
  }
  .panel-ai {
    min-height: 620px;
  }
  .resizer {
    display: none;
  }
  .terminal-resizer {
    display: none;
  }
  .ai-resizer {
    display: none;
  }
  .terminal-shell {
    height: 420px !important;
  }
}
</style>
