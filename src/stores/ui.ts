import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { SelectedItem } from '../types/index'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

export const useUiStore = defineStore('ui', () => {
  const selectedNodeId = ref<string | null>(null)
  const selectedItem = ref<SelectedItem>(null)
  const toasts = ref<Toast[]>([])

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

  function clearSelection() {
    selectedItem.value = null
  }

  function showToast(message: string, type: Toast['type'] = 'info') {
    const id = Date.now().toString()
    toasts.value.push({ id, message, type })
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id)
    }, 3000)
  }

  return {
    selectedNodeId,
    selectedItem,
    toasts,
    selectNode,
    selectPort,
    selectWidget,
    clearSelection,
    showToast,
  }
})
