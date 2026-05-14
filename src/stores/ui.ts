import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { SelectedItem } from '../types/index'

export interface Toast {
  id: string
  title: string
  message?: string
  type: 'success' | 'error' | 'info' | 'warning'
}

export interface Diagnostic {
  id: string
  level: 'info' | 'success' | 'warning' | 'error'
  title: string
  detail?: string
  timestamp: number
}

export interface BuilderLog {
  id: string
  source: 'builder' | 'diagnostic' | 'terminal'
  level: 'info' | 'success' | 'warning' | 'error'
  message: string
  timestamp: number
}

export const useUiStore = defineStore('ui', () => {
  const selectedNodeId = ref<string | null>(null)
  const selectedItem = ref<SelectedItem>(null)
  const toasts = ref<Toast[]>([])
  const diagnostics = ref<Diagnostic[]>([])
  const builderLogs = ref<BuilderLog[]>([])
  const terminalOpen = ref(false)
  const aiPanelOpen = ref(true)

  function selectNode(id: string | null) {
    selectedNodeId.value = id
    selectedItem.value = id ? { kind: 'node' } : null
  }

  function selectPort(portId: string, zone: 'inputs' | 'outputs') {
    selectedItem.value = { kind: 'port', portId, zone }
  }

  function selectWidget(widgetId: string) {
    selectedItem.value = { kind: 'widget', widgetId }
  }

  function selectUiOutput(uiOutputId: string) {
    selectedItem.value = { kind: 'uiOutput', uiOutputId }
  }

  function clearSelection() {
    selectedItem.value = null
  }

  function showToast(message: string, type: Toast['type'] = 'info', detail?: string) {
    const id = Date.now().toString()
    toasts.value.push({ id, title: message, message: detail, type })
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id)
    }, type === 'error' || type === 'warning' ? 5200 : 3400)
  }

  function addBuilderLog(source: BuilderLog['source'], level: BuilderLog['level'], message: string) {
    builderLogs.value.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      source,
      level,
      message,
      timestamp: Date.now(),
    })
    builderLogs.value = builderLogs.value.slice(0, 300)
  }

  function addDiagnostic(level: Diagnostic['level'], title: string, detail?: string, notify = true) {
    diagnostics.value.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      level,
      title,
      detail,
      timestamp: Date.now(),
    })
    diagnostics.value = diagnostics.value.slice(0, 100)
    addBuilderLog('diagnostic', level, detail ? `${title}\n${detail}` : title)
    if (notify) {
      showToast(title, level === 'warning' ? 'warning' : level, detail?.split('\n')[0])
    }
  }

  function clearDiagnostics() {
    diagnostics.value = []
  }

  function clearBuilderLogs() {
    builderLogs.value = []
  }

  function setTerminalOpen(open: boolean) {
    terminalOpen.value = open
  }

  function toggleTerminal() {
    terminalOpen.value = !terminalOpen.value
  }

  function setAiPanelOpen(open: boolean) {
    aiPanelOpen.value = open
  }

  function toggleAiPanel() {
    aiPanelOpen.value = !aiPanelOpen.value
  }

  return {
    selectedNodeId,
    selectedItem,
    toasts,
    diagnostics,
    builderLogs,
    terminalOpen,
    aiPanelOpen,
    selectNode,
    selectPort,
    selectWidget,
    selectUiOutput,
    clearSelection,
    showToast,
    addBuilderLog,
    addDiagnostic,
    clearDiagnostics,
    clearBuilderLogs,
    setTerminalOpen,
    toggleTerminal,
    setAiPanelOpen,
    toggleAiPanel,
  }
})
