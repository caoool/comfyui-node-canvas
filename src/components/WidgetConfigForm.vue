<template>
  <div class="widget-form" v-if="widgetInfo">
    <div class="form-title">Widget Config</div>
    <div class="field">
      <span class="label">Widget Type</span>
      <span class="value">{{ widgetInfo.widget.widgetType }}</span>
    </div>

    <label v-if="isBool" class="field-row">
      <input type="checkbox" v-model="boolDefault" @change="save" />
      <span class="label-row">Default value</span>
    </label>
    <label v-else class="field">
      <span class="label">Default</span>
      <input v-model="defaultText" class="input input-mono" @change="save" spellcheck="false" />
    </label>

    <template v-if="isNumeric">
      <div class="number-grid">
        <label class="field">
          <span class="label">Min</span>
          <input v-model.number="minValue" class="input input-mono" type="number" @change="save" />
        </label>
        <label class="field">
          <span class="label">Max</span>
          <input v-model.number="maxValue" class="input input-mono" type="number" @change="save" />
        </label>
        <label class="field">
          <span class="label">Step</span>
          <input v-model.number="stepValue" class="input input-mono" type="number" @change="save" />
        </label>
      </div>
      <label v-if="widgetInfo.widget.widgetType === 'seed'" class="field-row">
        <input type="checkbox" v-model="controlAfterGenerate" @change="save" />
        <span class="label-row">Control after generate</span>
      </label>
    </template>

    <template v-if="hasOptions">
      <div class="field">
        <span class="label">Options <span class="label-hint">one per line</span></span>
        <textarea v-model="optionsText" class="input textarea" rows="5" @change="save" spellcheck="false"></textarea>
      </div>
    </template>

    <template v-if="isTextual">
      <label class="field-row">
        <input type="checkbox" v-model="multiline" @change="save" />
        <span class="label-row">Multiline</span>
      </label>
      <label class="field-row">
        <input type="checkbox" v-model="dynamicPrompts" @change="save" />
        <span class="label-row">Dynamic prompts</span>
      </label>
    </template>

    <div class="field">
      <span class="label">Advanced Config <span class="label-hint">JSON</span></span>
      <textarea
        v-model="configJson"
        class="input textarea"
        :class="{ 'input-invalid': configError }"
        rows="7"
        @change="save"
        spellcheck="false"
      ></textarea>
      <span v-if="configError" class="field-err">{{ configError }}</span>
    </div>
  </div>
  <div v-else class="no-widget">Select a widget port to configure it.</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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

const defaultText = ref('')
const boolDefault = ref(false)
const minValue = ref(0)
const maxValue = ref(1)
const stepValue = ref(0.1)
const controlAfterGenerate = ref(false)
const optionsText = ref('')
const multiline = ref(false)
const dynamicPrompts = ref(false)
const configJson = ref('{}')
const configError = ref('')

const isNumeric = computed(() => {
  const type = widgetInfo.value?.widget.widgetType
  return type === 'slider' || type === 'number' || type === 'int' || type === 'seed'
})
const hasOptions = computed(() => {
  const type = widgetInfo.value?.widget.widgetType
  return type === 'dropdown' || type === 'dynamic_combo'
})
const isTextual = computed(() => {
  const type = widgetInfo.value?.widget.widgetType
  return type === 'text' || type === 'multiline' || type === 'json'
})
const isBool = computed(() => widgetInfo.value?.widget.widgetType === 'bool')

watch(widgetInfo, (info) => {
  if (!info) return
  const widget = info.widget
  const cfg = widget.config
  defaultText.value = stringifyDefault(widget.default)
  boolDefault.value = widget.default === true
  minValue.value = Number(cfg.min ?? 0)
  maxValue.value = Number(cfg.max ?? 1)
  stepValue.value = Number(cfg.step ?? 0.1)
  controlAfterGenerate.value = cfg.control_after_generate === true
  optionsText.value = Array.isArray(cfg.options) ? cfg.options.join('\n') : ''
  multiline.value = cfg.multiline === true
  dynamicPrompts.value = cfg.dynamicPrompts === true
  configJson.value = JSON.stringify(cfg, null, 2)
  configError.value = ''
}, { immediate: true })

function stringifyDefault(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function parseDefault(): unknown {
  const info = widgetInfo.value
  if (!info) return defaultText.value
  if (isBool.value) return boolDefault.value
  if (isNumeric.value) return Number(defaultText.value)
  if (info.widget.widgetType === 'json' || info.widget.widgetType === 'list' || info.widget.widgetType === 'bounding_box' || info.widget.widgetType === 'curve') {
    try {
      return JSON.parse(defaultText.value)
    } catch {
      return defaultText.value
    }
  }
  return defaultText.value
}

function save() {
  const info = widgetInfo.value
  if (!info) return
  let config: Record<string, unknown>
  try {
    config = configJson.value.trim() ? JSON.parse(configJson.value) as Record<string, unknown> : {}
    configError.value = ''
  } catch (err) {
    configError.value = String(err)
    return
  }

  if (isNumeric.value) {
    config.min = minValue.value
    config.max = maxValue.value
    config.step = stepValue.value
    if (info.widget.widgetType === 'seed') config.control_after_generate = controlAfterGenerate.value
  }
  if (hasOptions.value) config.options = optionsText.value.split('\n').map(s => s.trim()).filter(Boolean)
  if (isTextual.value) {
    config.multiline = multiline.value
    if (dynamicPrompts.value) config.dynamicPrompts = true
    else delete config.dynamicPrompts
  }

  const updatedWidgets = info.node.widgets.map(widget =>
    widget.id === info.widget.id ? { ...widget, config, default: parseDefault() } : widget
  )
  projectStore.updateNode(info.node.id, { widgets: updatedWidgets })
  configJson.value = JSON.stringify(config, null, 2)
}
</script>

<style scoped>
.widget-form { padding: 12px; }
.no-widget {
  padding: 24px 16px;
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  font-style: italic;
}
.form-title {
  font-size: 11px;
  font-weight: 850;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-dim);
  margin-bottom: 12px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 10px;
}
.field-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.number-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
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
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 400;
}
.label-row { font-size: 12px; color: var(--text); }
.value {
  font-size: 12px;
  color: var(--accent);
  font-family: var(--font-mono);
  background: var(--accent-soft);
  border: 1px solid rgba(104, 167, 255, 0.25);
  padding: 2px 8px;
  border-radius: 999px;
  align-self: flex-start;
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
.input::placeholder { color: var(--text-muted); }
.input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.input-mono {
  font-family: var(--font-mono);
  font-size: 12.5px;
}
.input-invalid { border-color: var(--danger); }
.textarea {
  resize: vertical;
  min-height: 72px;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.45;
}
.field-err {
  font-size: 11px;
  color: var(--danger);
  line-height: 1.4;
}
</style>
