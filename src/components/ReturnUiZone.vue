<template>
  <div class="return-ui-zone">
    <div class="zone-label">
      <span>{{ label }}</span>
      <button title="Add text display" @click="emit('add')">Add</button>
    </div>
    <draggable
      v-model="localOutputs"
      item-key="id"
      handle=".return-ui-row"
      @end="onReorder"
    >
      <template #item="{ element }">
        <ReturnUiRow
          :output="element"
          :is-active="isActive(element.id)"
          @remove="removeOutput"
        />
      </template>
    </draggable>
    <div v-if="localOutputs.length === 0" class="zone-empty">Add displays from Return UI items</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import draggable from 'vuedraggable'
import { useUiStore } from '../stores/ui'
import type { UiOutputSpec } from '../types/index'
import ReturnUiRow from './ReturnUiRow.vue'

const props = defineProps<{
  modelValue: UiOutputSpec[]
  label: string
}>()

const emit = defineEmits<{
  'update:modelValue': [outputs: UiOutputSpec[]]
  add: []
}>()

const uiStore = useUiStore()
const localOutputs = ref<UiOutputSpec[]>([...props.modelValue])

watch(() => props.modelValue, (val) => {
  localOutputs.value = [...val]
}, { deep: true })

function isActive(id: string): boolean {
  return uiStore.selectedItem?.kind === 'uiOutput' && uiStore.selectedItem.uiOutputId === id
}

function onReorder() {
  emit('update:modelValue', [...localOutputs.value])
}

function removeOutput(id: string) {
  const updated = localOutputs.value.filter(output => output.id !== id)
  localOutputs.value = updated
  emit('update:modelValue', updated)
  if (isActive(id)) uiStore.selectNode(uiStore.selectedNodeId)
}
</script>

<style scoped>
.return-ui-zone {
  min-height: 56px;
  padding: 6px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--r-md);
  background: rgba(255, 255, 255, 0.012);
}
.zone-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--text-muted);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 600;
  padding: 4px 6px 6px;
}
.zone-label button {
  height: 20px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: var(--raised);
  color: var(--text);
  cursor: pointer;
  padding: 0 7px;
  font-size: 10px;
  font-weight: 700;
  text-transform: none;
  letter-spacing: 0;
}
.zone-label button:hover {
  background: var(--hover);
  border-color: var(--border-strong);
}
.zone-empty {
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  padding: 12px;
  font-style: italic;
}
</style>
