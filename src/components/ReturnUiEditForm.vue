<template>
  <div class="return-ui-form">
    <div class="form-title">Return UI Properties</div>
    <label class="field">
      <span class="label">UI Key <span class="label-hint">returned as ui.key</span></span>
      <input
        v-model="localKey"
        class="input input-mono"
        :class="{ 'input-invalid': !keyValid }"
        spellcheck="false"
        @change="save"
      />
      <span v-if="!keyValid" class="field-err">Use letters, digits, and underscores.</span>
    </label>
    <label class="field">
      <span class="label">Display Type</span>
      <select v-model="localKind" class="input input-mono" @change="save">
        <option v-for="kind in RETURN_UI_KINDS" :key="kind" :value="kind">{{ kind }}</option>
      </select>
    </label>
    <label class="field">
      <span class="label">Label</span>
      <input v-model="localLabel" class="input" spellcheck="false" @change="save" />
    </label>
    <label class="field">
      <span class="label">Source Variable / Expression</span>
      <input
        v-model="localExpression"
        class="input input-mono"
        list="python-variable-options"
        spellcheck="false"
        placeholder="combined"
        @change="save"
      />
      <datalist id="python-variable-options">
        <option v-for="variable in variableOptions" :key="variable" :value="variable" />
      </datalist>
    </label>
    <label class="field">
      <span class="label">Builder Sample</span>
      <textarea v-model="localSample" class="input input-mono sample-input" spellcheck="false" @change="save"></textarea>
    </label>
    <div class="return-preview">
      <span>Generated return entry</span>
      <code>"{{ sanitizedKey }}": ({{ localExpression || sanitizedKey }},)</code>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useProjectStore } from '../stores/project'
import { useUiStore } from '../stores/ui'
import { extractPythonVariableNames } from '../lib/returnCode'
import { RETURN_UI_KINDS } from '../lib/returnUiCatalog'
import type { NodeSpec, UiOutputKind, UiOutputSpec } from '../types/index'

const UI_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/

const projectStore = useProjectStore()
const uiStore = useUiStore()

const uiInfo = computed(() => {
  const sel = uiStore.selectedItem
  if (!sel || sel.kind !== 'uiOutput') return null
  const nodeId = uiStore.selectedNodeId
  const node = nodeId ? projectStore.project.nodes.find(n => n.id === nodeId) : null
  if (!node) return null
  const output = (node.uiOutputs ?? []).find(candidate => candidate.id === sel.uiOutputId)
  return output ? { node, output } : null
})

const localKey = ref('')
const localKind = ref<UiOutputKind>('text')
const localLabel = ref('')
const localExpression = ref('')
const localSample = ref('')

const sanitizedKey = computed(() => sanitizeUiKey(localKey.value))
const keyValid = computed(() => !localKey.value || UI_KEY_RE.test(localKey.value.trim()))
const variableOptions = computed(() => {
  const node = uiInfo.value?.node
  if (!node) return []
  return extractPythonVariableNames(node.code, node.inputs.map(input => input.name))
})

watch(uiInfo, (info) => {
  if (!info) return
  localKey.value = info.output.key
  localKind.value = info.output.kind
  localLabel.value = info.output.label
  localExpression.value = info.output.expression ?? ''
  localSample.value = stringifySample(info.output.sample)
}, { immediate: true })

function stringifySample(sample: unknown): string {
  if (sample === undefined || sample === null) return ''
  if (typeof sample === 'string') return sample
  return JSON.stringify(sample, null, 2)
}

function parseSample(value: string): unknown {
  const trimmed = value.trim()
  if (!trimmed) return ''
  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

function sanitizeUiKey(value: string): string {
  return (value || 'text').trim().replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[0-9]/, '_$&') || 'text'
}

function save() {
  const info = uiInfo.value
  if (!info || !keyValid.value) return
  const uiOutputs = (info.node.uiOutputs ?? []).map((output): UiOutputSpec => {
    if (output.id !== info.output.id) return output
    return {
      ...output,
      key: sanitizedKey.value,
      kind: localKind.value,
      label: localLabel.value.trim() || sanitizedKey.value,
      expression: localExpression.value.trim(),
      sample: parseSample(localSample.value),
    }
  })
  projectStore.updateNode(info.node.id, { uiOutputs } as Partial<NodeSpec>)
}
</script>

<style scoped>
.return-ui-form { padding: 14px; }
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
.input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.input-mono { font-family: var(--font-mono); font-size: 12.5px; }
.input-invalid { border-color: var(--danger); }
.input-invalid:focus { box-shadow: 0 0 0 3px var(--danger-soft); }
.sample-input {
  min-height: 76px;
  resize: vertical;
  line-height: 1.4;
}
.field-err { font-size: 11px; color: var(--danger); line-height: 1.4; }
.return-preview {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 9px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-md);
  background: var(--field);
}
.return-preview span {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.return-preview code {
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 11px;
  overflow-wrap: anywhere;
}
</style>
