<template>
  <div class="layout">
    <AppToolbar
      @add-node="emit('add-node')"
      @export-zip="emit('export-zip')"
      @hot-reload="emit('hot-reload')"
      @settings="emit('settings')"
    />
    <div class="panels">
      <aside class="panel panel-library">
        <slot name="library" />
      </aside>
      <main class="panel panel-canvas">
        <slot name="canvas" />
      </main>
      <aside class="panel panel-properties">
        <slot name="properties" />
      </aside>
      <aside class="panel panel-code">
        <slot name="code" />
      </aside>
    </div>
    <AppStatusBar :status-text="statusText" :connected="connected" />
    <ToastNotification />
  </div>
</template>

<script setup lang="ts">
import AppToolbar from './AppToolbar.vue'
import AppStatusBar from './AppStatusBar.vue'
import ToastNotification from './ToastNotification.vue'

defineProps<{
  statusText: string
  connected: boolean
}>()

const emit = defineEmits<{
  'add-node': []
  'export-zip': []
  'hot-reload': []
  'settings': []
}>()
</script>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.panels {
  display: flex;
  flex: 1;
  overflow: hidden;
}
.panel {
  overflow: auto;
  border-right: 1px solid var(--border);
  background: var(--panel);
}
.panel:last-child { border-right: none; }
.panel-library { width: 220px; flex-shrink: 0; }
.panel-canvas { flex: 1; min-width: 0; background: var(--bg); }
.panel-properties { width: 280px; flex-shrink: 0; }
.panel-code { width: 340px; flex-shrink: 0; }
</style>
