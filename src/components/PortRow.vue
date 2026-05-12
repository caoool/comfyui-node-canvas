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
    <span v-if="widget" class="port-widget">{{ widget.widgetType }}</span>
    <span v-if="port.optional" class="port-optional">opt</span>
    <button class="btn-remove" @click.stop="emit('remove', port.id)" title="Remove">×</button>
  </div>
</template>

<script setup lang="ts">
import type { PortSpec, WidgetSpec } from '../types/index'
import { useUiStore } from '../stores/ui'
import { portColor } from '../lib/comfyCatalog'

const props = defineProps<{
  port: PortSpec
  isActive: boolean
  zone: 'inputs' | 'outputs'
  widget?: WidgetSpec
}>()

const emit = defineEmits<{
  remove: [id: string]
}>()

const uiStore = useUiStore()

function onClick() {
  if (props.widget) {
    uiStore.selectWidget(props.widget.id)
  } else {
    uiStore.selectPort(props.port.id, props.zone)
  }
}
</script>

<style scoped>
.port-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: var(--r-sm);
  cursor: pointer;
  font-size: 12px;
  transition: background 100ms ease;
  position: relative;
}
.port-row:hover { background: var(--hover); }
.port-row:hover .btn-remove { opacity: 1; }
.port-row-active {
  background: var(--accent-soft);
}
.port-row-active::before {
  content: '';
  position: absolute;
  left: -2px;
  top: 4px;
  bottom: 4px;
  width: 2px;
  border-radius: 2px;
  background: var(--accent);
}
.port-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 0 2px rgba(0,0,0,0.35);
}
.port-name {
  color: var(--text);
  flex: 1;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
}
.port-type {
  color: var(--text-dim);
  font-size: 10.5px;
  font-family: var(--font-mono);
  letter-spacing: 0.04em;
}
.port-widget {
  color: var(--accent);
  font-size: 10px;
  background: var(--accent-soft);
  padding: 1px 6px;
  border-radius: 999px;
  text-transform: lowercase;
  letter-spacing: 0.04em;
  font-weight: 500;
}
.port-optional {
  color: var(--text-muted);
  font-size: 10px;
  background: var(--bg);
  padding: 1px 6px;
  border-radius: 999px;
  border: 1px solid var(--border);
  font-family: var(--font-mono);
}
.btn-remove {
  width: 18px;
  height: 18px;
  background: none;
  color: var(--text-muted);
  border: none;
  cursor: pointer;
  font-size: 12px;
  border-radius: var(--r-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 100ms ease, background 100ms ease, color 100ms ease;
}
.btn-remove:hover { background: var(--danger-soft); color: var(--danger); }
</style>
