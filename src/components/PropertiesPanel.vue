<template>
  <div class="properties">
    <div class="properties-header">
      <span class="properties-title">Properties</span>
    </div>
    <div class="properties-body">
      <!-- No selection -->
      <div v-if="!selectedItem" class="no-selection">
        No selection
      </div>
      <!-- Node selected -->
      <NodeMetaForm v-else-if="selectedItem.kind === 'node' && selectedNode" :node="selectedNode" />
      <!-- Port selected -->
      <PortEditForm v-else-if="selectedItem.kind === 'port'" />
      <!-- Widget selected -->
      <WidgetConfigForm v-else-if="selectedItem.kind === 'widget'" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useUiStore } from '../stores/ui'
import { useProjectStore } from '../stores/project'
import NodeMetaForm from './NodeMetaForm.vue'
import PortEditForm from './PortEditForm.vue'
import WidgetConfigForm from './WidgetConfigForm.vue'

const uiStore = useUiStore()
const projectStore = useProjectStore()

const selectedItem = computed(() => uiStore.selectedItem)
const selectedNode = computed(() => {
  if (!uiStore.selectedNodeId) return null
  return projectStore.project.nodes.find(n => n.id === uiStore.selectedNodeId) ?? null
})
</script>

<style scoped>
.properties {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--panel);
}
.properties-header {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.properties-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-dim);
}
.properties-body {
  flex: 1;
  overflow-y: auto;
}
.no-selection {
  padding: 32px 16px;
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  font-style: italic;
}
</style>
