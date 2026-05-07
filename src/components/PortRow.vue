<template>
  <div
    class="port-row"
    :class="{ 'port-row-active': isActive }"
    @click="onClick"
  >
    <span
      class="port-dot"
      :style="{ background: portColor(port.type) }"
    ></span>
    <span class="port-name">{{ port.name }}</span>
    <span class="port-type">{{ port.type }}</span>
    <span v-if="port.optional" class="port-optional">opt</span>
    <button class="btn-remove" @click.stop="emit('remove', port.id)" title="Remove">×</button>
  </div>
</template>

<script setup lang="ts">
import type { PortSpec } from '../types/index'

const props = defineProps<{
  port: PortSpec
  isActive: boolean
  zone: 'inputs' | 'outputs'
}>()

const emit = defineEmits<{
  remove: [id: string]
}>()

const PORT_COLORS: Record<string, string> = {
  IMAGE: '#9370ff', LATENT: '#ff70a0', FLOAT: '#cc88ff',
  INT: '#5599ff', STRING: '#ccaa44', MASK: '#79a9a0',
  CONDITIONING: '#fca33f', MODEL: '#6eb5b5', VAE: '#b56eb5', CLIP: '#b5b56e',
}
function portColor(type: string): string {
  return PORT_COLORS[type] ?? '#888'
}

import { useUiStore } from '../stores/ui'
const uiStore = useUiStore()

function onClick() {
  uiStore.selectPort(props.port.id, props.zone)
}
</script>

<style scoped>
.port-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}
.port-row:hover { background: var(--header); }
.port-row-active { background: var(--header); outline: 1px solid var(--accent); }
.port-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.port-name { color: var(--text); flex: 1; }
.port-type { color: var(--text-dim); font-size: 11px; }
.port-optional {
  color: var(--text-dim);
  font-size: 10px;
  background: var(--node-body);
  padding: 1px 4px;
  border-radius: 3px;
}
.btn-remove {
  width: 16px;
  height: 16px;
  background: none;
  color: var(--text-dim);
  border: none;
  cursor: pointer;
  font-size: 12px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-remove:hover { background: #c62828; color: #fff; }
</style>
