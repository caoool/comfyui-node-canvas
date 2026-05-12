<template>
  <div class="status-bar">
    <span class="status-text">{{ statusText }}</span>
    <span class="spacer"></span>
    <button
      class="status-action terminal-toggle"
      :class="{ active: uiStore.terminalOpen }"
      aria-label="Terminal"
      title="Toggle node terminal"
      @click="uiStore.toggleTerminal()"
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 4.5 6.1 8 3 11.5" />
        <path d="M7.5 11.5h5" />
      </svg>
      <span>Terminal</span>
    </button>
    <button
      class="status-action ai-toggle"
      :class="{ active: uiStore.aiPanelOpen }"
      aria-label="AI"
      title="Toggle AI builder"
      @click="uiStore.toggleAiPanel()"
    >
      <span>AI</span>
    </button>
    <AppNotificationDock @settings="emit('settings')" />
  </div>
</template>

<script setup lang="ts">
import AppNotificationDock from './AppNotificationDock.vue'
import { useUiStore } from '../stores/ui'

const uiStore = useUiStore()

defineProps<{
  statusText: string
}>()

const emit = defineEmits<{
  settings: []
}>()
</script>

<style scoped>
.status-bar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 14px;
  height: 28px;
  background: var(--header);
  border-top: 1px solid var(--border-subtle);
  box-shadow: 0 1px 0 rgba(255,255,255,0.035) inset;
  font-size: 12px;
  color: var(--text-dim);
  flex-shrink: 0;
}
.status-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.spacer { flex: 1; }
.status-action {
  height: 22px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-sm);
  background: var(--raised);
  color: var(--text);
  padding: 0 8px;
  cursor: pointer;
  font-size: 11.5px;
  font-weight: 760;
  box-shadow: var(--inner-highlight);
}
.status-action:hover,
.status-action.active {
  color: var(--accent);
  border-color: rgba(104, 167, 255, 0.34);
  background: var(--accent-soft);
}
.status-action svg {
  width: 13px;
  height: 13px;
  stroke: currentColor;
  stroke-width: 1.7;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
