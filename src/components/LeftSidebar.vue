<template>
  <div class="left-sidebar">
    <div class="nodes-pane" :style="{ height: `${nodesHeight}px` }">
      <NodeLibrary />
    </div>
    <div class="sidebar-resizer" title="Resize nodes and add palette" @mousedown="startResize"></div>
    <ContractSidebar class="contract-pane" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import ContractSidebar from './ContractSidebar.vue'
import NodeLibrary from './NodeLibrary.vue'

const nodesHeight = ref(220)

onMounted(() => {
  nodesHeight.value = Number(localStorage.getItem('layout.nodesHeight')) || 220
})

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function startResize(event: MouseEvent) {
  event.preventDefault()
  const startY = event.clientY
  const startHeight = nodesHeight.value

  function onMove(moveEvent: MouseEvent) {
    const dy = moveEvent.clientY - startY
    nodesHeight.value = clamp(startHeight + dy, 150, Math.max(240, window.innerHeight - 280))
    localStorage.setItem('layout.nodesHeight', String(nodesHeight.value))
  }

  function onUp() {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    document.body.classList.remove('is-resizing-vertical')
  }

  document.body.classList.add('is-resizing-vertical')
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}
</script>

<style scoped>
.left-sidebar {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--panel);
}
.nodes-pane {
  min-height: 150px;
  flex: 0 0 auto;
  overflow: hidden;
}
.sidebar-resizer {
  height: 6px;
  flex: 0 0 auto;
  cursor: row-resize;
  background:
    linear-gradient(180deg, transparent, rgba(148,163,184,0.18), transparent),
    var(--bg);
  transition: background 120ms ease;
}
.sidebar-resizer:hover {
  background:
    linear-gradient(180deg, transparent, rgba(104,167,255,0.68), transparent),
    var(--bg);
}
.contract-pane {
  flex: 1 1 auto;
}
:global(body.is-resizing-vertical) {
  cursor: row-resize;
  user-select: none;
}
</style>
