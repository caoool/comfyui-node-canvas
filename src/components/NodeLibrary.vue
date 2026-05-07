<template>
  <div class="library">
    <div class="library-header">
      <span class="library-title">Nodes</span>
      <button class="btn-add" @click="addNode" title="Add node">+</button>
    </div>
    <div class="library-body">
      <div v-if="project.nodes.length === 0" class="empty">
        No nodes yet. Click + to add.
      </div>
      <div v-for="(nodes, category) in groupedNodes" :key="category" class="category-group">
        <div class="category-label">{{ category }}</div>
        <div
          v-for="node in nodes"
          :key="node.id"
          class="node-item"
          :class="{ 'node-item-active': uiStore.selectedNodeId === node.id }"
          @click="uiStore.selectNode(node.id)"
        >
          <span class="node-name">{{ node.displayName || node.name }}</span>
          <button
            class="btn-delete"
            @click.stop="deleteNode(node.id)"
            title="Delete node"
          >×</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useProjectStore } from '../stores/project'
import { useUiStore } from '../stores/ui'
import type { NodeSpec } from '../types/index'

const projectStore = useProjectStore()
const uiStore = useUiStore()

const project = computed(() => projectStore.project)

const groupedNodes = computed(() => {
  const groups: Record<string, NodeSpec[]> = {}
  for (const node of project.value.nodes) {
    const cat = node.category || 'uncategorized'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(node)
  }
  return groups
})

function addNode() {
  const node = projectStore.addNode()
  uiStore.selectNode(node.id)
}

function deleteNode(id: string) {
  if (uiStore.selectedNodeId === id) {
    uiStore.selectNode(null)
  }
  projectStore.removeNode(id)
}
</script>

<style scoped>
.library {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--panel);
}
.library-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.library-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-dim);
}
.btn-add {
  width: 22px;
  height: 22px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-add:hover { opacity: 0.85; }
.library-body {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}
.empty {
  padding: 16px 10px;
  font-size: 12px;
  color: var(--text-dim);
  text-align: center;
}
.category-group { margin-bottom: 4px; }
.category-label {
  padding: 4px 10px 2px;
  font-size: 11px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.node-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  cursor: pointer;
  border-radius: 4px;
  margin: 1px 4px;
}
.node-item:hover { background: var(--node-body); }
.node-item-active { background: var(--node-body); outline: 1px solid var(--accent); }
.node-name {
  font-size: 13px;
  color: var(--text);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.btn-delete {
  width: 18px;
  height: 18px;
  background: none;
  color: var(--text-dim);
  border: none;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  border-radius: 3px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-delete:hover { background: #c62828; color: #fff; }
</style>
