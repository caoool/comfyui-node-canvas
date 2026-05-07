<template>
  <div class="meta-form">
    <div class="form-title">Node Properties</div>
    <label class="field">
      <span class="label">Name (Python class)</span>
      <input v-model="localName" class="input" @change="save" placeholder="MyNode" />
    </label>
    <label class="field">
      <span class="label">Display Name</span>
      <input v-model="localDisplayName" class="input" @change="save" placeholder="My Node" />
    </label>
    <label class="field">
      <span class="label">Category</span>
      <input v-model="localCategory" class="input" @change="save" placeholder="custom" />
    </label>
    <div class="field">
      <span class="label">Return Types (comma-separated)</span>
      <input v-model="localReturnTypes" class="input" @change="save" placeholder="IMAGE, LATENT" />
    </div>
    <div class="field">
      <span class="label">Return Names (comma-separated)</span>
      <input v-model="localReturnNames" class="input" @change="save" placeholder="image, latent" />
    </div>
    <div v-if="errors.length > 0" class="errors">
      <div v-for="(e, i) in errors" :key="i" class="error-msg">{{ e.message }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useProjectStore } from '../stores/project'
import { validateNode } from '../lib/validate'
import type { NodeSpec, ValidationError } from '../types/index'

const props = defineProps<{ node: NodeSpec }>()
const projectStore = useProjectStore()

const localName = ref(props.node.name)
const localDisplayName = ref(props.node.displayName)
const localCategory = ref(props.node.category)
const localReturnTypes = ref(props.node.returnTypes.join(', '))
const localReturnNames = ref(props.node.returnNames.join(', '))
const errors = ref<ValidationError[]>([])

watch(() => props.node, (n) => {
  localName.value = n.name
  localDisplayName.value = n.displayName
  localCategory.value = n.category
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
    returnTypes: parseList(localReturnTypes.value),
    returnNames: parseList(localReturnNames.value),
  }
  // Build a merged node for validation
  const merged = { ...props.node, ...patch }
  errors.value = validateNode(merged)
  // Save even with errors (let user fix gradually)
  projectStore.updateNode(props.node.id, patch)
}
</script>

<style scoped>
.meta-form { padding: 12px; }
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
.label {
  font-size: 11px;
  color: var(--text-dim);
}
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
.errors { margin-top: 8px; }
.error-msg {
  font-size: 11px;
  color: #ff6b6b;
  padding: 2px 0;
}
</style>
