<template>
  <div class="meta-form">
    <div class="form-title">Node Properties</div>
    <label class="field">
      <span class="label">Name <span class="label-hint">Python class</span></span>
      <input
        v-model="localName"
        class="input input-mono"
        :class="{ 'input-invalid': fieldErrors.name }"
        @change="save"
        placeholder="MyNode"
        spellcheck="false"
      />
      <span v-if="fieldErrors.name" class="field-err">{{ fieldErrors.name }}</span>
    </label>
    <label class="field">
      <span class="label">Display Name</span>
      <input
        v-model="localDisplayName"
        class="input"
        :class="{ 'input-invalid': fieldErrors.displayName }"
        @change="save"
        placeholder="My Node"
      />
      <span v-if="fieldErrors.displayName" class="field-err">{{ fieldErrors.displayName }}</span>
    </label>
    <label class="field">
      <span class="label">Category</span>
      <input
        v-model="localCategory"
        list="category-options"
        class="input input-mono"
        :class="{ 'input-invalid': fieldErrors.category }"
        @change="save"
        placeholder="ComfyUINodeBuilder"
        spellcheck="false"
      />
      <datalist id="category-options">
        <option v-for="cat in CATEGORY_OPTIONS" :key="cat" :value="cat" />
      </datalist>
      <span v-if="fieldErrors.category" class="field-err">{{ fieldErrors.category }}</span>
    </label>
    <label class="field-row">
      <input type="checkbox" v-model="localUseReturnOverrides" @change="save" />
      <span class="label-row">Advanced return overrides</span>
    </label>
    <div class="field">
      <span class="label">Return Types <span class="label-hint">comma-separated</span></span>
      <input
        v-if="localUseReturnOverrides"
        v-model="localReturnTypes"
        class="input input-mono"
        @change="save"
        placeholder="IMAGE, LATENT"
        spellcheck="false"
      />
      <input
        v-else
        :value="derivedReturnTypes"
        class="input input-mono input-readonly"
        disabled
        placeholder="Drop outputs to derive return types"
        spellcheck="false"
      />
    </div>
    <div class="field">
      <span class="label">Return Names <span class="label-hint">comma-separated</span></span>
      <input
        v-if="localUseReturnOverrides"
        v-model="localReturnNames"
        class="input input-mono"
        :class="{ 'input-invalid': fieldErrors.returnNames }"
        @change="save"
        placeholder="image, latent"
        spellcheck="false"
      />
      <input
        v-else
        :value="derivedReturnNames"
        class="input input-mono input-readonly"
        disabled
        placeholder="Drop outputs to derive return names"
        spellcheck="false"
      />
      <span v-if="localUseReturnOverrides && fieldErrors.returnNames" class="field-err">{{ fieldErrors.returnNames }}</span>
    </div>
    <div v-if="otherErrors.length > 0" class="errors">
      <div v-for="(e, i) in otherErrors" :key="i" class="error-msg">{{ e.message }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useProjectStore } from '../stores/project'
import { validateNode } from '../lib/validate'
import type { NodeSpec, ValidationError } from '../types/index'
import { COMFY_CATEGORIES } from '../lib/comfyCatalog'

const props = defineProps<{ node: NodeSpec }>()
const projectStore = useProjectStore()

const CATEGORY_OPTIONS = COMFY_CATEGORIES

const localName = ref(props.node.name)
const localDisplayName = ref(props.node.displayName)
const localCategory = ref(props.node.category)
const localUseReturnOverrides = ref(props.node.useReturnOverrides ?? false)
const localReturnTypes = ref(props.node.returnTypes.join(', '))
const localReturnNames = ref(props.node.returnNames.join(', '))
const errors = ref<ValidationError[]>([])

const FIELD_KEYS = ['name', 'displayName', 'category', 'returnNames'] as const
type FieldKey = typeof FIELD_KEYS[number]

const fieldErrors = computed<Record<FieldKey, string>>(() => {
  const map = { name: '', displayName: '', category: '', returnNames: '' } as Record<FieldKey, string>
  for (const e of errors.value) {
    if ((FIELD_KEYS as readonly string[]).includes(e.field) && !map[e.field as FieldKey]) {
      map[e.field as FieldKey] = e.message
    }
  }
  return map
})

const otherErrors = computed(() =>
  errors.value.filter(e => !(FIELD_KEYS as readonly string[]).includes(e.field)),
)

const derivedReturnTypes = computed(() => props.node.outputs.map(p => p.type).join(', '))
const derivedReturnNames = computed(() => props.node.outputs.map(p => p.name).join(', '))

watch(() => props.node, (n) => {
  localName.value = n.name
  localDisplayName.value = n.displayName
  localCategory.value = n.category
  localUseReturnOverrides.value = n.useReturnOverrides ?? false
  localReturnTypes.value = n.returnTypes.join(', ')
  localReturnNames.value = n.returnNames.join(', ')
}, { deep: true })

function parseList(s: string): string[] {
  return s.split(',').map(t => t.trim()).filter(Boolean)
}

function save() {
  const patch: Partial<NodeSpec> = {
    name: localName.value.trim(),
    displayName: localDisplayName.value.trim(),
    category: localCategory.value.trim(),
    useReturnOverrides: localUseReturnOverrides.value,
    returnTypes: parseList(localReturnTypes.value),
    returnNames: parseList(localReturnNames.value),
  }
  const merged = { ...props.node, ...patch }
  errors.value = validateNode(merged)
  if (errors.value.length === 0) {
    projectStore.updateNode(props.node.id, patch)
  }
  // When invalid, leave the persisted node intact; the form keeps the typed
  // value locally so the user can keep editing toward a valid state.
}
</script>

<style scoped>
.meta-form { padding: 14px; }
.form-title {
  font-size: 11px;
  font-weight: 600;
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
  font-weight: 500;
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
  background: var(--bg);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-md);
  padding: 7px 10px;
  color: var(--text);
  font-size: 13px;
  outline: none;
  width: 100%;
  transition: border-color 100ms ease, box-shadow 100ms ease;
}
.input::placeholder { color: var(--text-muted); }
.input-readonly {
  color: var(--text-dim);
  background: var(--panel-2);
  cursor: not-allowed;
}
.input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.input-mono {
  font-family: var(--font-mono);
  font-size: 12.5px;
}
.input-invalid {
  border-color: var(--danger);
}
.input-invalid:focus {
  box-shadow: 0 0 0 3px var(--danger-soft);
}
.field-err {
  font-size: 11px;
  color: var(--danger);
  line-height: 1.4;
}
.errors { margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border); }
.error-msg {
  font-size: 11px;
  color: var(--danger);
  padding: 3px 0;
  line-height: 1.4;
}
</style>
