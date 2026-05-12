<template>
  <div class="port-form">
    <div class="form-title">Port Properties</div>
    <label class="field">
      <span class="label">Name <span class="label-hint">snake_case</span></span>
      <input
        v-model="localName"
        class="input input-mono"
        :class="{ 'input-invalid': !nameValid }"
        @change="save"
        spellcheck="false"
      />
      <span v-if="!nameValid" class="field-err">Use lowercase letters, digits, underscores; must start with letter or underscore.</span>
    </label>
    <label class="field">
      <span class="label">Type</span>
      <input
        v-model="localType"
        list="port-type-options"
        class="input input-mono"
        @change="save"
        placeholder="IMAGE"
        spellcheck="false"
      />
      <datalist id="port-type-options">
        <option v-for="type in typeOptions" :key="type" :value="type" />
      </datalist>
    </label>
    <label class="field-row">
      <input type="checkbox" v-model="localOptional" @change="save" />
      <span class="label-row">Optional</span>
    </label>
    <label v-if="portInfo?.zone === 'outputs'" class="field">
      <span class="label">Return Variable / Expression</span>
      <input
        v-model="localExpression"
        list="return-variable-options"
        class="input input-mono"
        placeholder="processed_image"
        spellcheck="false"
        @change="save"
      />
      <datalist id="return-variable-options">
        <option v-for="variable in variableOptions" :key="variable" :value="variable" />
      </datalist>
    </label>
    <div v-if="error" class="error-msg">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useProjectStore } from '../stores/project'
import { useUiStore } from '../stores/ui'
import type { NodeSpec, PortSpec } from '../types/index'
import { COMFY_DATA_TYPES } from '../lib/comfyCatalog'
import { extractPythonVariableNames } from '../lib/returnCode'

const PORT_NAME_RE = /^[a-z_][a-z0-9_]*$/

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
const localExpression = ref('')
const error = ref('')
const typeOptions = [...new Set(COMFY_DATA_TYPES.map(item => item.type))].sort()

const nameValid = computed(() => !localName.value || PORT_NAME_RE.test(localName.value.trim()))
const variableOptions = computed(() => {
  const node = portInfo.value?.node
  if (!node) return []
  return extractPythonVariableNames(node.code, node.inputs.map(input => input.name))
})

watch(portInfo, (info) => {
  if (info) {
    localName.value = info.port.name
    localType.value = info.port.type
    localOptional.value = info.port.optional
    localExpression.value = info.port.expression ?? info.port.name
    error.value = ''
  }
}, { immediate: true })

function save() {
  const info = portInfo.value
  if (!info) return
  if (!nameValid.value) return
  const { node, port, zone } = info
  const list = zone === 'inputs' ? [...node.inputs] : [...node.outputs]
  const idx = list.findIndex(p => p.id === port.id)
  if (idx < 0) return
  const updated: PortSpec = {
    ...port,
    name: localName.value.trim(),
    type: localType.value.trim().toUpperCase(),
    optional: localOptional.value,
    expression: zone === 'outputs' ? localExpression.value.trim() : port.expression,
  }
  list[idx] = updated
  const patch: Partial<NodeSpec> = zone === 'inputs' ? { inputs: list } : { outputs: list }
  projectStore.updateNode(node.id, patch)
}
</script>

<style scoped>
.port-form { padding: 14px; }
.form-title {
  font-size: 11px;
  font-weight: 850;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-dim);
  margin-bottom: 14px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 12px;
}
.field-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.label {
  font-size: 11px;
  color: var(--text-dim);
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 6px;
}
.label-hint {
  font-size: 10px;
  color: var(--text-muted);
  font-weight: 400;
  font-style: italic;
}
.label-row { font-size: 12px; color: var(--text); }
.input {
  background: var(--field);
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  padding: 7px 10px;
  color: var(--text);
  font-size: 13px;
  outline: none;
  width: 100%;
  transition: border-color 100ms ease, box-shadow 100ms ease;
}
.input::placeholder { color: var(--text-muted); }
.input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.input-mono { font-family: var(--font-mono); font-size: 12.5px; }
.input-invalid { border-color: var(--danger); }
.input-invalid:focus { box-shadow: 0 0 0 3px var(--danger-soft); }
.field-err { font-size: 11px; color: var(--danger); line-height: 1.4; }
.error-msg { font-size: 11px; color: var(--danger); }
</style>
