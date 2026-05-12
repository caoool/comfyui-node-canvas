<template>
  <div class="definition-panel">
    <div v-if="!selectedNode" class="empty-state">
      <div class="empty-title">No node selected</div>
      <div class="empty-copy">Create or load a node pack, then select a node to edit its preview and metadata.</div>
    </div>

    <template v-else>
      <main class="preview-workspace">
        <NodePreview :node="selectedNode" />
      </main>

      <section v-if="selectedItem && selectedItem.kind !== 'node'" class="selection-popover">
        <div class="popover-head">
          <span>{{ selectionTitle }}</span>
          <button title="Close" @click="uiStore.selectNode(selectedNode.id)">×</button>
        </div>
        <div class="popover-body">
          <PortEditForm v-if="selectedItem.kind === 'port'" />
          <WidgetConfigForm v-else-if="selectedItem.kind === 'widget'" />
          <ReturnUiEditForm v-else-if="selectedItem.kind === 'uiOutput'" />
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useProjectStore } from '../stores/project'
import { useUiStore } from '../stores/ui'
import NodePreview from './NodePreview.vue'
import PortEditForm from './PortEditForm.vue'
import ReturnUiEditForm from './ReturnUiEditForm.vue'
import WidgetConfigForm from './WidgetConfigForm.vue'

const projectStore = useProjectStore()
const uiStore = useUiStore()

const selectedNode = computed(() => {
  if (!uiStore.selectedNodeId) return null
  return projectStore.project.nodes.find(n => n.id === uiStore.selectedNodeId) ?? null
})

const selectedItem = computed(() => uiStore.selectedItem)
const selectionTitle = computed(() => {
  if (selectedItem.value?.kind === 'port') return selectedItem.value.zone === 'inputs' ? 'Input Properties' : 'Output Properties'
  if (selectedItem.value?.kind === 'widget') return 'Widget Properties'
  if (selectedItem.value?.kind === 'uiOutput') return 'Return UI Properties'
  return 'Selection'
})
</script>

<style scoped>
.definition-panel {
  height: 100%;
  min-width: 0;
  background: var(--bg-grid);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  container-type: inline-size;
}
.empty-state {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px;
  color: var(--text-muted);
}
.empty-title { color: var(--text); font-weight: 600; }
.empty-copy {
  max-width: 360px;
  text-align: center;
  line-height: 1.5;
  font-size: 13px;
}
.preview-workspace {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.selection-popover {
  flex: 0 0 auto;
  width: 100%;
  max-height: min(42vh, 330px);
  overflow: hidden;
  border-top: 1px solid var(--border-strong);
  border-right: 0;
  border-bottom: 0;
  border-left: 0;
  border-radius: 0;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.035), transparent 72px),
    color-mix(in srgb, var(--panel) 94%, black);
  box-shadow: 0 -16px 38px rgba(0,0,0,0.28);
  backdrop-filter: blur(12px);
}
.popover-head {
  min-height: 34px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-subtle);
}
.popover-body {
  max-height: calc(min(42vh, 330px) - 34px);
  overflow: auto;
}
.popover-head span {
  color: var(--text-dim);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.popover-head button {
  width: 22px;
  height: 22px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-sm);
  background: var(--raised);
  color: var(--text);
  cursor: pointer;
}
.popover-head button:hover {
  background: var(--hover);
  border-color: var(--border-strong);
}
</style>
