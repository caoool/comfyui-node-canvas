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
          :is-active="uiStore.selectedItem?.kind === 'port' && uiStore.selectedItem.portId === element.id"
          @remove="removePort"
        />
      </template>
    </draggable>
    <div v-if="localPorts.length === 0" class="zone-empty">Drop ports here</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import draggable from 'vuedraggable'
import PortRow from './PortRow.vue'
import { useUiStore } from '../stores/ui'
import { nanoid } from 'nanoid'
import type { PortSpec, PaletteItem } from '../types/index'

const props = defineProps<{
  modelValue: PortSpec[]
  zone: 'inputs' | 'outputs'
  label: string
}>()

const emit = defineEmits<{
  'update:modelValue': [ports: PortSpec[]]
}>()

const uiStore = useUiStore()
const isDragOver = ref(false)

const localPorts = ref<PortSpec[]>([...props.modelValue])

watch(() => props.modelValue, (val) => {
  localPorts.value = [...val]
}, { deep: true })

function onReorder() {
  emit('update:modelValue', [...localPorts.value])
}

function onDrop(event: DragEvent) {
  isDragOver.value = false
  const raw = event.dataTransfer?.getData('palette')
  if (!raw) return
  const palette = JSON.parse(raw) as PaletteItem
  const port: PortSpec = {
    id: nanoid(),
    name: palette.name,
    type: palette.type,
    optional: false,
    isWidget: palette.isWidget,
  }
  const updated = [...localPorts.value, port]
  localPorts.value = updated
  emit('update:modelValue', updated)
}

function removePort(id: string) {
  const updated = localPorts.value.filter(p => p.id !== id)
  localPorts.value = updated
  emit('update:modelValue', updated)
}
</script>

<style scoped>
.drop-zone {
  min-height: 48px;
  padding: 4px;
  border: 1px dashed var(--border);
  border-radius: 6px;
  transition: border-color 0.15s;
}
.drop-zone-over {
  border-color: var(--accent);
  background: rgba(74, 158, 255, 0.06);
}
.zone-label {
  font-size: 11px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 2px 4px 4px;
}
.zone-empty {
  font-size: 12px;
  color: var(--text-dim);
  text-align: center;
  padding: 8px;
}
</style>
