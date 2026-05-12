<template>
  <div
    class="drop-zone"
    :class="{ 'drop-zone-over': isDragOver }"
    @dragover.prevent="isDragOver = true"
    @dragleave="isDragOver = false"
    @drop.prevent="onDrop"
  >
    <div class="zone-label">{{ label }}</div>
    <draggable
      v-model="localPorts"
      item-key="id"
      handle=".port-row"
      @end="onReorder"
    >
      <template #item="{ element }">
        <PortRow
          :port="element"
          :zone="zone"
          :widget="widgetByPortId.get(element.id)"
          :is-active="isPortActive(element.id)"
          @remove="removePort"
        />
      </template>
    </draggable>
    <div v-if="localPorts.length === 0" class="zone-empty">Drop ports here</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import draggable from 'vuedraggable'
import PortRow from './PortRow.vue'
import { useUiStore } from '../stores/ui'
import { nanoid } from 'nanoid'
import type { PortSpec, PaletteItem, WidgetSpec } from '../types/index'
import { createWidgetFromPalette } from '../lib/comfyCatalog'

const props = defineProps<{
  modelValue: PortSpec[]
  widgets: WidgetSpec[]
  zone: 'inputs' | 'outputs'
  label: string
}>()

const emit = defineEmits<{
  'update:modelValue': [ports: PortSpec[]]
  'update:widgets': [widgets: WidgetSpec[]]
}>()

const uiStore = useUiStore()
const isDragOver = ref(false)

const localPorts = ref<PortSpec[]>([...props.modelValue])

watch(() => props.modelValue, (val) => {
  localPorts.value = [...val]
}, { deep: true })

const widgetByPortId = computed(() => {
  const m = new Map<string, WidgetSpec>()
  for (const w of props.widgets) m.set(w.portId, w)
  return m
})

function isPortActive(portId: string): boolean {
  const sel = uiStore.selectedItem
  if (!sel) return false
  if (sel.kind === 'port' && sel.portId === portId) return true
  if (sel.kind === 'widget') {
    const w = props.widgets.find(x => x.id === sel.widgetId)
    return w?.portId === portId
  }
  return false
}

function onReorder() {
  emit('update:modelValue', [...localPorts.value])
}

function uniquifyName(base: string): string {
  const taken = new Set(localPorts.value.map(p => p.name))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}_${n}`)) n++
  return `${base}_${n}`
}

function onDrop(event: DragEvent) {
  isDragOver.value = false
  const raw = event.dataTransfer?.getData('palette')
  if (!raw) return
  const palette = JSON.parse(raw) as PaletteItem
  // Widgets only make sense on the input side; treat widget drops on outputs as plain ports.
  const isWidget = palette.isWidget && props.zone === 'inputs' && palette.widgetType !== null
  const port: PortSpec = {
    id: nanoid(),
    name: uniquifyName(palette.name),
    type: palette.type,
    optional: false,
    isWidget,
  }
  const updatedPorts = [...localPorts.value, port]
  localPorts.value = updatedPorts
  emit('update:modelValue', updatedPorts)
  if (isWidget && palette.widgetType) {
    const widget = createWidgetFromPalette(palette, port.id)
    emit('update:widgets', [...props.widgets, widget])
  }
}

function removePort(id: string) {
  const updated = localPorts.value.filter(p => p.id !== id)
  localPorts.value = updated
  emit('update:modelValue', updated)
  // Drop any widget owned by this port, regardless of zone (cheap and safe).
  const remainingWidgets = props.widgets.filter(w => w.portId !== id)
  if (remainingWidgets.length !== props.widgets.length) {
    emit('update:widgets', remainingWidgets)
  }
}
</script>

<style scoped>
.drop-zone {
  min-height: 56px;
  padding: 6px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--r-md);
  transition: border-color 150ms ease, background 150ms ease;
  background: rgba(255, 255, 255, 0.012);
}
.drop-zone-over {
  border-color: var(--accent);
  border-style: solid;
  background: var(--accent-soft);
}
.zone-label {
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 600;
  padding: 4px 6px 6px;
}
.zone-empty {
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  padding: 12px;
  font-style: italic;
}
</style>
