<template>
  <AppLayout
    :status-text="statusText"
    :connected="false"
    @add-node="projectStore.addNode()"
    @export-zip="onExportZip"
    @hot-reload="onHotReload"
    @settings="showSettings = true"
  >
    <template #library>
      <NodeLibrary />
    </template>
    <template #canvas>
      <NodeCanvas />
    </template>
    <template #properties>
      <PropertiesPanel />
    </template>
    <template #code>
      <CodePanel />
    </template>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import AppLayout from './components/AppLayout.vue'
import NodeLibrary from './components/NodeLibrary.vue'
import NodeCanvas from './components/NodeCanvas.vue'
import PropertiesPanel from './components/PropertiesPanel.vue'
import CodePanel from './components/CodePanel.vue'
import { useProjectStore } from './stores/project'
import { useUiStore } from './stores/ui'
import { exportZip, downloadBlob } from './lib/exportZip'

const projectStore = useProjectStore()
const uiStore = useUiStore()
const showSettings = ref(false)
const statusText = ref('Ready')

async function onExportZip() {
  const blob = await exportZip(projectStore.project)
  const name = projectStore.project.name.replace(/\s+/g, '_') || 'node_pack'
  downloadBlob(blob, `${name}.zip`)
  uiStore.showToast('ZIP exported!', 'success')
}

function onHotReload() {
  // TODO: implement in Task 13
}
</script>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; }
#app { height: 100%; }

:root {
  --bg: #202020;
  --panel: #252525;
  --node-body: #353535;
  --header: #4a4a4a;
  --border: #3a3a3a;
  --text: #e0e0e0;
  --text-dim: #a0a0a0;
  --accent: #4a9eff;
}

.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-dim);
  font-size: 13px;
}
</style>
