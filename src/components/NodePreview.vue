<template>
  <div class="node-preview">
    <div class="node-header">
      <span class="node-title">{{ node.displayName || node.name }}</span>
      <span class="node-category">{{ node.category }}</span>
    </div>
    <div class="node-body">
      <div class="zone-section">
        <DropZone
          v-model="inputs"
          zone="inputs"
          label="Inputs"
          @update:modelValue="updateInputs"
        />
      </div>
      <div class="zone-section">
        <DropZone
          v-model="outputs"
          zone="outputs"
          label="Outputs"
          @update:modelValue="updateOutputs"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import DropZone from './DropZone.vue'
import { useProjectStore } from '../stores/project'
import type { NodeSpec, PortSpec } from '../types/index'

const props = defineProps<{ node: NodeSpec }>()
const projectStore = useProjectStore()

const inputs = ref<PortSpec[]>([...props.node.inputs])
const outputs = ref<PortSpec[]>([...props.node.outputs])

watch(() => props.node.inputs, (val) => { inputs.value = [...val] }, { deep: true })
watch(() => props.node.outputs, (val) => { outputs.value = [...val] }, { deep: true })

function updateInputs(ports: PortSpec[]) {
  inputs.value = ports
  projectStore.updateNode(props.node.id, { inputs: ports })
}

function updateOutputs(ports: PortSpec[]) {
  outputs.value = ports
  projectStore.updateNode(props.node.id, { outputs: ports })
}
</script>

<style scoped>
.node-preview {
  background: var(--node-body);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  min-width: 280px;
  max-width: 420px;
}
.node-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--header);
}
.node-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--text);
}
.node-category {
  font-size: 11px;
  color: var(--text-dim);
}
.node-body {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.zone-section { display: flex; flex-direction: column; gap: 4px; }
</style>
