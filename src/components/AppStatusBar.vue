<template>
  <div class="status-bar">
    <span>{{ statusText }}</span>
    <span class="dot" :class="connected ? 'dot-ok' : 'dot-off'"></span>
    <span>{{ connected ? 'ComfyUI connected' : 'ComfyUI disconnected' }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  statusText: string
  connected: boolean
}>()
</script>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  height: 28px;
  background: var(--header);
  border-top: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-dim);
  flex-shrink: 0;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.dot-ok { background: #4caf50; }
.dot-off { background: #888; }
</style>
