<template>
  <div class="widget-form" v-if="widgetInfo">
    <div class="form-title">Widget Config</div>
    <div class="field">
      <span class="label">Widget Type</span>
      <span class="value">{{ widgetInfo.widget.widgetType }}</span>
    </div>

    <!-- Slider / Int -->
    <template v-if="widgetInfo.widget.widgetType === 'slider' || widgetInfo.widget.widgetType === 'int'">
      <label class="field">
        <span class="label">Default</span>
        <input v-model.number="sliderDefault" class="input" type="number" @change="saveSlider" />
      </label>
      <label class="field">
        <span class="label">Min</span>
        <input v-model.number="sliderMin" class="input" type="number" @change="saveSlider" />
      </label>
      <label class="field">
        <span class="label">Max</span>
        <input v-model.number="sliderMax" class="input" type="number" @change="saveSlider" />
      </label>
      <label class="field">
        <span class="label">Step</span>
        <input v-model.number="sliderStep" class="input" type="number" @change="saveSlider" />
      </label>
    </template>

    <!-- Dropdown -->
    <template v-else-if="widgetInfo.widget.widgetType === 'dropdown'">
      <div class="field">
        <span class="label">Options (one per line)</span>
        <textarea v-model="dropdownOptions" class="input textarea" rows="4" @change="saveDropdown"></textarea>
      </div>
      <label class="field">
        <span class="label">Default</span>
        <input v-model="dropdownDefault" class="input" @change="saveDropdown" />
      </label>
    </template>

    <!-- Bool -->
    <template v-else-if="widgetInfo.widget.widgetType === 'bool'">
      <label class="field-row">
        <input type="checkbox" v-model="boolDefault" @change="saveBool" />
        <span class="label">Default value</span>
      </label>
    </template>
  </div>
  <div v-else class="no-widget">Select a widget port to configure it.</div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useProjectStore } from '../stores/project'
import { useUiStore } from '../stores/ui'

const projectStore = useProjectStore()
const uiStore = useUiStore()

const widgetInfo = computed(() => {
  const sel = uiStore.selectedItem
  if (!sel || sel.kind !== 'widget') return null
  const nodeId = uiStore.selectedNodeId
  const node = nodeId ? projectStore.project.nodes.find(n => n.id === nodeId) : null
  if (!node) return null
  const widget = node.widgets.find(w => w.id === sel.widgetId)
  return widget ? { node, widget } : null
})

// Slider fields
const sliderDefault = ref(0)
const sliderMin = ref(0)
const sliderMax = ref(1)
const sliderStep = ref(0.1)

// Dropdown fields
const dropdownOptions = ref('')
const dropdownDefault = ref('')

// Bool field
const boolDefault = ref(false)

watch(widgetInfo, (info) => {
  if (!info) return
  const w = info.widget
  if (w.widgetType === 'slider' || w.widgetType === 'int') {
    sliderDefault.value = (w.default as number) ?? 0
    sliderMin.value = (w.config.min as number) ?? 0
    sliderMax.value = (w.config.max as number) ?? 1
    sliderStep.value = (w.config.step as number) ?? 0.1
  } else if (w.widgetType === 'dropdown') {
    dropdownOptions.value = ((w.config.options as string[]) ?? []).join('\n')
    dropdownDefault.value = (w.default as string) ?? ''
  } else if (w.widgetType === 'bool') {
    boolDefault.value = (w.default as boolean) ?? false
  }
}, { immediate: true })

function updateWidget(config: Record<string, unknown>, defaultVal: unknown) {
  const info = widgetInfo.value
  if (!info) return
  const { node, widget } = info
  const updatedWidgets = node.widgets.map(w =>
    w.id === widget.id ? { ...w, config, default: defaultVal } : w
  )
  projectStore.updateNode(node.id, { widgets: updatedWidgets })
}

function saveSlider() {
  updateWidget(
    { min: sliderMin.value, max: sliderMax.value, step: sliderStep.value },
    sliderDefault.value
  )
}

function saveDropdown() {
  const opts = dropdownOptions.value.split('\n').map(s => s.trim()).filter(Boolean)
  updateWidget({ options: opts, default: dropdownDefault.value }, dropdownDefault.value)
}

function saveBool() {
  updateWidget({ default: boolDefault.value }, boolDefault.value)
}
</script>

<style scoped>
.widget-form { padding: 12px; }
.no-widget { padding: 16px; font-size: 12px; color: var(--text-dim); text-align: center; }
.form-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-dim);
  margin-bottom: 12px;
}
.field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
.field-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.label { font-size: 11px; color: var(--text-dim); }
.value { font-size: 13px; color: var(--text); }
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
.textarea { resize: vertical; }
</style>
