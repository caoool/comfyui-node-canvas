<template>
  <div class="port-form">
    <div class="form-title">Port Properties</div>
    <label class="field">
      <span class="label">Name (snake_case)</span>
      <input v-model="localName" class="input" @change="save" />
    </label>
    <label class="field">
      <span class="label">Type</span>
      <input v-model="localType" class="input" @change="save" placeholder="IMAGE" />
    </label>
    <label class="field-row">
      <input type="checkbox" v-model="localOptional" @change="save" />
      <span class="label">Optional</span>
    </label>
    <div v-if="error" class="error-msg">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useProjectStore } from '../stores/project'
import { useUiStore } from '../stores/ui'
import type { NodeSpec, PortSpec } from '../types/index'

const projectStore = useProjectStore()
const uiStore = useUiStore()

const portInfo = computed(() => {
  const sel = uiStore.selectedItem
  if (!sel || sel.kind !== 'port') return null
  const nodeId = uiStore.selectedNodeId
  const node = nodeId ? projectStore.project.nodes.find(n => n.id === nodeId) : null
  if (!node) return null
  const zone = sel.zone
  const list = zone === 'inputs' ? node.inputs : node.outputs
  const port = list.find(p => p.id === sel.portId)
  return port ? { node, port, zone } : null
})

const localName = ref('')
const localType = ref('')
const localOptional = ref(false)
const error = ref('')

watch(portInfo, (info) => {
  if (info) {
    localName.value = info.port.name
    localType.value = info.port.type
    localOptional.value = info.port.optional
    error.value = ''
  }
}, { immediate: true })

function save() {
  const info = portInfo.value
  if (!info) return
  const { node, port, zone } = info
  const list = zone === 'inputs' ? [...node.inputs] : [...node.outputs]
  const idx = list.findIndex(p => p.id === port.id)
  if (idx < 0) return
  const updated: PortSpec = { ...port, name: localName.value.trim(), type: localType.value.trim().toUpperCase(), optional: localOptional.value }
  list[idx] = updated
  const patch: Partial<NodeSpec> = zone === 'inputs' ? { inputs: list } : { outputs: list }
  projectStore.updateNode(node.id, patch)
}
</script>

<style scoped>
.port-form { padding: 12px; }
.form-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-dim);
  margin-bottom: 12px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}
.field-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.label { font-size: 11px; color: var(--text-dim); }
.input {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 5px 8px;
  color: var(--text);
  font-size: 13px;
  outline: none;
  width: 100%;
}
.input:focus { border-color: var(--accent); }
.error-msg { font-size: 11px; color: #ff6b6b; }
</style>
