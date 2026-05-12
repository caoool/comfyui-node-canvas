<template>
  <div
    class="return-ui-row"
    :class="{ 'return-ui-row-active': isActive }"
    @click="uiStore.selectUiOutput(output.id)"
  >
    <span class="return-ui-kind">{{ output.kind }}</span>
    <span class="return-ui-key">ui.{{ output.key }}</span>
    <span class="return-ui-expression">{{ output.expression || output.key }}</span>
    <button class="btn-remove" title="Remove" @click.stop="emit('remove', output.id)">×</button>
  </div>
</template>

<script setup lang="ts">
import { useUiStore } from '../stores/ui'
import type { UiOutputSpec } from '../types/index'

defineProps<{
  output: UiOutputSpec
  isActive: boolean
}>()

const emit = defineEmits<{
  remove: [id: string]
}>()

const uiStore = useUiStore()
</script>

<style scoped>
.return-ui-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(0, 1fr) 18px;
  align-items: center;
  gap: 7px;
  padding: 6px 10px;
  border-radius: var(--r-sm);
  cursor: pointer;
  font-size: 12px;
  transition: background 100ms ease;
  position: relative;
}
.return-ui-row:hover { background: var(--hover); }
.return-ui-row:hover .btn-remove { opacity: 1; }
.return-ui-row-active { background: var(--accent-soft); }
.return-ui-row-active::before {
  content: '';
  position: absolute;
  left: -2px;
  top: 4px;
  bottom: 4px;
  width: 2px;
  border-radius: 2px;
  background: var(--accent);
}
.return-ui-kind {
  color: var(--accent);
  background: var(--accent-soft);
  border-radius: 999px;
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 700;
  text-transform: lowercase;
}
.return-ui-key,
.return-ui-expression {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono);
}
.return-ui-key { color: var(--text); }
.return-ui-expression {
  color: var(--text-muted);
  font-size: 10.5px;
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
