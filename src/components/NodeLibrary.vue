<template>
  <div class="library">
    <div class="library-header">
      <span class="library-title">Nodes</span>
    </div>
    <div class="template-row">
      <select v-model="selectedTemplate" class="template-select" title="New node template">
        <option v-for="template in NODE_TEMPLATES" :key="template.id" :value="template.id">
          {{ template.label }}
        </option>
      </select>
      <button class="btn-template" @click="addTemplateNode">New</button>
    </div>
    <div class="search-row">
      <input v-model="nodeSearch" class="search-input" placeholder="Search nodes" spellcheck="false" />
    </div>
    <div class="library-body">
      <div v-if="project.nodes.length === 0" class="empty">
        No nodes yet. Choose a template and click New.
      </div>
      <div v-else-if="filteredNodes.length === 0" class="empty">
        No matching nodes.
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
          <span class="node-actions">
            <button
              class="btn-action"
              @click.stop="duplicateNode(node.id)"
              title="Duplicate node"
            >⧉</button>
            <button
              class="btn-action"
              @click.stop="deleteNode(node.id)"
              title="Delete node"
            >×</button>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useProjectStore } from '../stores/project'
import { useUiStore } from '../stores/ui'
import type { NodeSpec } from '../types/index'
import { NODE_TEMPLATES, type NodeTemplateId } from '../lib/nodeTemplates'

const projectStore = useProjectStore()
const uiStore = useUiStore()
const selectedTemplate = ref<NodeTemplateId>('blank')
const nodeSearch = ref('')

const project = computed(() => projectStore.project)

const filteredNodes = computed(() => {
  const query = nodeSearch.value.trim().toLowerCase()
  if (!query) return project.value.nodes
  return project.value.nodes.filter((node) => {
    const haystack = `${node.name} ${node.displayName} ${node.category}`.toLowerCase()
    return haystack.includes(query)
  })
})

const groupedNodes = computed(() => {
  const groups: Record<string, NodeSpec[]> = {}
  for (const node of filteredNodes.value) {
    const cat = node.category || 'uncategorized'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(node)
  }
  return groups
})

function addTemplateNode() {
  const node = projectStore.addNode(selectedTemplate.value)
  uiStore.selectNode(node.id)
}

function duplicateNode(id: string) {
  const node = projectStore.duplicateNode(id)
  if (node) uiStore.selectNode(node.id)
}

function deleteNode(id: string) {
  if (uiStore.selectedNodeId === id) {
    const fallback = project.value.nodes.find(n => n.id !== id)
    uiStore.selectNode(fallback?.id ?? null)
  }
  projectStore.removeNode(id)
}
</script>

<style scoped>
.library {
  display: flex;
  flex-direction: column;
  height: 100%;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.018), transparent 140px),
    var(--panel);
}
.library-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 12px 10px;
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}
.template-row {
  display: flex;
  gap: 6px;
  padding: 10px;
  border-bottom: 1px solid var(--border-subtle);
}
.search-row {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-subtle);
}
.template-select {
  min-width: 0;
  flex: 1;
  height: 28px;
  background: var(--field);
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  color: var(--text);
  font-size: 12px;
  padding: 0 8px;
}
.btn-template {
  height: 28px;
  padding: 0 10px;
  background: var(--raised);
  color: var(--text);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-sm);
  cursor: pointer;
  font-size: 12px;
  font-weight: 720;
  box-shadow: var(--inner-highlight);
}
.btn-template:hover {
  background: var(--hover);
  border-color: var(--border-strong);
}
.search-input {
  width: 100%;
  height: 28px;
  background: var(--field);
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  color: var(--text);
  font: 12px var(--font-sans);
  padding: 0 9px;
  outline: none;
}
.search-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.library-title {
  font-size: 11px;
  font-weight: 850;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-dim);
}
.library-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}
.empty {
  padding: 24px 14px;
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  line-height: 1.5;
}
.category-group { margin-bottom: 8px; }
.category-label {
  padding: 8px 12px 5px;
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 800;
}
.node-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 34px;
  padding: 7px 10px;
  cursor: pointer;
  border-radius: var(--r-sm);
  margin: 2px 8px;
  border: 1px solid transparent;
  transition: background 100ms ease, border-color 100ms ease, color 100ms ease;
  position: relative;
}
.node-item:hover {
  background: rgba(255,255,255,0.035);
  border-color: var(--border-subtle);
}
.node-item-active {
  background:
    linear-gradient(90deg, rgba(104,167,255,0.16), rgba(104,167,255,0.06)),
    var(--raised);
  border-color: rgba(104, 167, 255, 0.25);
  color: var(--text);
  box-shadow: var(--inner-highlight);
}
.node-item-active::before {
  content: '';
  position: absolute;
  left: -8px;
  top: 6px;
  bottom: 6px;
  width: 3px;
  border-radius: 2px;
  background: var(--accent);
}
.node-name {
  font-size: 12.5px;
  color: var(--text);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 650;
}
.node-actions {
  display: inline-flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 100ms ease;
}
.node-item:hover .node-actions { opacity: 1; }
.btn-action {
  width: 20px;
  height: 20px;
  background: transparent;
  color: var(--text-muted);
  border: 1px solid transparent;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  border-radius: var(--r-sm);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 100ms ease, background 100ms ease, color 100ms ease;
}
.btn-action:hover { background: var(--danger-soft); color: var(--danger); }
</style>
