<template>
  <div class="canvas">
    <PaletteStrip />
    <div class="canvas-body">
      <div v-if="!selectedNode" class="canvas-empty">
        Select or create a node to start editing
      </div>
      <div v-else class="canvas-content">
        <NodePreview :node="selectedNode" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PaletteStrip from './PaletteStrip.vue'
import NodePreview from './NodePreview.vue'
import { useProjectStore } from '../stores/project'
import { useUiStore } from '../stores/ui'

const projectStore = useProjectStore()
const uiStore = useUiStore()

const selectedNode = computed(() => {
  if (!uiStore.selectedNodeId) return null
  return projectStore.project.nodes.find(n => n.id === uiStore.selectedNodeId) ?? null
})
</script>

<style scoped>
.canvas {
  display: flex;
  flex-direction: column;
  height: 100%;
  background:
    radial-gradient(circle at 1px 1px, rgba(255,255,255,0.045) 1px, transparent 0) 0 0/24px 24px,
    var(--bg);
}
.canvas-body {
  flex: 1;
  overflow: auto;
  padding: 32px 24px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}
.canvas-empty {
  margin-top: 96px;
  color: var(--text-muted);
  font-size: 13px;
  text-align: center;
  line-height: 1.6;
}
.canvas-content {
  width: 100%;
  max-width: 520px;
}
</style>
