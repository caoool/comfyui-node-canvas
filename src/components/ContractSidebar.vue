<template>
  <div class="contract-sidebar">
    <div class="contract-head">
      <div>
        <div class="section-title">Add to Node</div>
        <div class="section-subtitle">Search types, widgets, Return UI, or add custom ports.</div>
      </div>
    </div>

    <div v-if="!selectedNode" class="contract-empty">Select a node to add contract items.</div>

    <template v-else>
      <div class="contract-tools">
        <input v-model="filter" class="filter-input" placeholder="Search items" spellcheck="false" />
      </div>

      <div class="catalog">
        <section v-if="filteredCustomPortItems.length" class="catalog-group">
          <div class="catalog-title">Custom</div>
          <div class="catalog-items">
            <button
              v-for="item in filteredCustomPortItems"
              :key="item.id"
              class="catalog-chip catalog-chip-custom"
              :title="item.description"
              :data-testid="item.testId"
              @click="addCustomPort(item.zone)"
            >
              <span class="chip-dot chip-dot-custom"></span>
              <span>{{ item.label }}</span>
              <span class="chip-kind">{{ item.zone === 'inputs' ? 'In' : 'Out' }}</span>
            </button>
          </div>
        </section>

        <section v-for="group in filteredDataGroups" :key="`data-${group.name}`" class="catalog-group">
          <div class="catalog-title">{{ group.name }}</div>
          <div class="catalog-items">
            <div
              v-for="item in group.items"
              :key="`type-${item.type}-${item.name}`"
              class="catalog-chip catalog-chip-type"
              :title="item.description"
            >
              <span class="chip-dot" :style="{ background: portColor(item.type) }"></span>
              <span>{{ item.label }}</span>
              <span class="chip-actions">
                <button title="Add input" @click="addPort('inputs', item)">In</button>
                <button title="Add output" @click="addPort('outputs', item)">Out</button>
              </span>
            </div>
          </div>
        </section>

        <section v-for="group in filteredWidgetGroups" :key="`widget-${group.name}`" class="catalog-group">
          <div class="catalog-title">{{ group.name }}</div>
          <div class="catalog-items">
            <button
              v-for="item in group.items"
              :key="`widget-${item.widgetType}-${item.name}`"
              class="catalog-chip catalog-chip-widget"
              :title="item.description"
              @click="addPort('inputs', item)"
            >
              <span class="chip-dot" :style="{ background: portColor(item.type) }"></span>
              <span>{{ item.label }}</span>
              <span class="chip-kind">Widget</span>
            </button>
          </div>
        </section>

        <section v-if="filteredReturnUiItems.length" class="catalog-group">
          <div class="catalog-title">Return UI</div>
          <div class="catalog-items">
            <button
              v-for="item in filteredReturnUiItems"
              :key="`return-ui-${item.kind}`"
              class="catalog-chip catalog-chip-return-ui"
              :title="item.description"
              @click="addUiOutput(item.kind)"
            >
              <span class="chip-dot chip-dot-ui"></span>
              <span>{{ item.label }}</span>
              <span class="chip-kind">UI</span>
            </button>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useProjectStore } from '../stores/project'
import { useUiStore } from '../stores/ui'
import type { PaletteItem, UiOutputKind } from '../types/index'
import { COMFY_DATA_TYPES, COMFY_WIDGET_PRESETS, portColor } from '../lib/comfyCatalog'
import { RETURN_UI_ITEMS } from '../lib/returnUiCatalog'
import { addCustomPortToNode, addPalettePortToNode, addUiOutputToNode } from '../lib/nodeContract'

const projectStore = useProjectStore()
const uiStore = useUiStore()

const filter = ref('')
const CUSTOM_PORT_ITEMS = [
  {
    id: 'custom-input',
    label: 'Custom Input',
    zone: 'inputs' as const,
    name: 'custom_value',
    type: 'CUSTOM_TYPE',
    description: 'Add an editable custom input port, then click it on the node to set name and type.',
    testId: 'add-custom-input',
  },
  {
    id: 'custom-output',
    label: 'Custom Output',
    zone: 'outputs' as const,
    name: 'custom_value',
    type: 'CUSTOM_TYPE',
    description: 'Add an editable custom output port, then click it on the node to set name, type, and return expression.',
    testId: 'add-custom-output',
  },
]

const selectedNode = computed(() => {
  if (!uiStore.selectedNodeId) return null
  return projectStore.project.nodes.find(n => n.id === uiStore.selectedNodeId) ?? null
})

const filteredDataGroups = computed(() => groupItems(COMFY_DATA_TYPES, filter.value))
const filteredWidgetGroups = computed(() => groupItems(COMFY_WIDGET_PRESETS, filter.value))
const filteredCustomPortItems = computed(() => {
  const normalized = filter.value.trim().toLowerCase()
  return CUSTOM_PORT_ITEMS.filter(item => {
    const haystack = `${item.label} ${item.zone} ${item.name} ${item.type} ${item.description}`.toLowerCase()
    return !normalized || haystack.includes(normalized)
  })
})
const filteredReturnUiItems = computed(() => {
  const normalized = filter.value.trim().toLowerCase()
  return RETURN_UI_ITEMS.filter(item => {
    const haystack = `${item.kind} ${item.label} ${item.key} ${item.description}`.toLowerCase()
    return !normalized || haystack.includes(normalized)
  })
})

function groupItems(items: PaletteItem[], needle: string) {
  const normalized = needle.trim().toLowerCase()
  const groups = new Map<string, PaletteItem[]>()
  for (const item of items) {
    const haystack = `${item.group} ${item.label} ${item.name} ${item.type} ${item.description ?? ''}`.toLowerCase()
    if (normalized && !haystack.includes(normalized)) continue
    const group = item.group ?? 'Other'
    groups.set(group, [...(groups.get(group) ?? []), item])
  }
  return [...groups.entries()].map(([name, groupItems]) => ({ name, items: groupItems }))
}

function addPort(zone: 'inputs' | 'outputs', item: PaletteItem) {
  const node = selectedNode.value
  if (!node) return
  const result = addPalettePortToNode(node, zone, item)
  projectStore.updateNode(node.id, result.node)
  if (result.widget) {
    uiStore.selectWidget(result.widget.id)
  } else {
    uiStore.selectPort(result.port.id, zone)
  }
}

function addCustomPort(zone: 'inputs' | 'outputs') {
  const node = selectedNode.value
  const item = CUSTOM_PORT_ITEMS.find(item => item.zone === zone)
  if (!node || !item) return
  const result = addCustomPortToNode(node, zone, item.name, item.type)
  projectStore.updateNode(node.id, result.node)
  uiStore.selectPort(result.port.id, zone)
}

function addUiOutput(kind: UiOutputKind = 'text') {
  const node = selectedNode.value
  if (!node) return
  const result = addUiOutputToNode(node, kind)
  projectStore.updateNode(node.id, result.node)
  uiStore.selectUiOutput(result.uiOutput.id)
}
</script>

<style scoped>
.contract-sidebar {
  min-height: 0;
  display: flex;
  flex-direction: column;
  background:
    linear-gradient(180deg, rgba(104,167,255,0.025), transparent 110px),
    var(--panel);
  border-top: 1px solid var(--border-subtle);
}
.contract-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 10px;
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}
.section-title,
.catalog-title {
  color: var(--text-dim);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.section-subtitle {
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.35;
}
.contract-empty {
  padding: 18px 12px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.45;
}
.contract-tools {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 9px 10px;
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}
.filter-input {
  height: 28px;
  min-width: 0;
  width: 100%;
  background: var(--field);
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  color: var(--text);
  font: 12px var(--font-mono);
  padding: 0 8px;
  outline: none;
}
.filter-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.catalog {
  margin: 0;
  padding: 10px;
  min-height: 0;
  overflow: auto;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.014), transparent),
    color-mix(in srgb, var(--bg) 58%, var(--panel));
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 10px;
}
.catalog-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.catalog-items {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.catalog-chip {
  min-width: 0;
  max-width: 100%;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 25px;
  border: 1px solid var(--border-subtle);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.035), transparent),
    var(--raised);
  color: var(--text);
  border-radius: var(--r-sm);
  cursor: pointer;
  padding: 3px 5px 3px 7px;
  font-size: 11px;
  font-weight: 750;
  box-shadow: var(--inner-highlight);
}
.catalog-chip:hover {
  background: var(--hover);
  border-color: var(--border-strong);
}
.catalog-chip-widget {
  color: var(--accent);
  border-color: rgba(104, 167, 255, 0.28);
}
.catalog-chip-return-ui {
  color: var(--success);
  border-color: rgba(96, 200, 143, 0.28);
}
.catalog-chip-custom {
  color: var(--warning);
  border-color: rgba(240, 181, 85, 0.3);
}
.catalog-chip-type {
  cursor: default;
}
.chip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: 0 0 auto;
  box-shadow: 0 0 0 2px rgba(0,0,0,0.32);
}
.chip-dot-ui {
  background: var(--success);
}
.chip-dot-custom {
  background: var(--warning);
}
.chip-actions {
  display: inline-flex;
  margin-left: auto;
  gap: 2px;
}
.chip-actions button,
.chip-kind {
  min-width: 22px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-subtle);
  border-radius: 3px;
  background: var(--field);
  color: var(--text-muted);
  padding: 0 5px;
  font-size: 9px;
  font-weight: 700;
}
.chip-actions button {
  cursor: pointer;
}
.chip-actions button:hover {
  color: var(--text);
  border-color: var(--border-strong);
  background: var(--hover);
}
</style>
