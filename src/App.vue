<template>
  <AppLayout
    :status-text="statusText"
    :connected="connected"
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
import { ref, onMounted, onUnmounted } from 'vue'
import AppLayout from './components/AppLayout.vue'
import NodeLibrary from './components/NodeLibrary.vue'
import NodeCanvas from './components/NodeCanvas.vue'
import PropertiesPanel from './components/PropertiesPanel.vue'
import CodePanel from './components/CodePanel.vue'
import { useProjectStore } from './stores/project'
import { useUiStore } from './stores/ui'
import { exportZip, downloadBlob } from './lib/exportZip'
import { checkConnection, hotReload } from './lib/comfyuiApi'
import { writePack } from './lib/writeToFilesystem'
import { generatePython } from './lib/generatePython'

const projectStore = useProjectStore()
const uiStore = useUiStore()
const showSettings = ref(false)
const statusText = ref('Ready')
const connected = ref(false)

// Periodic connection check
let connectionTimer: ReturnType<typeof setInterval> | null = null

async function updateConnectionStatus() {
  const url = projectStore.project.comfyuiUrl
  if (!url) { connected.value = false; return }
  connected.value = await checkConnection(url)
}

onMounted(() => {
  updateConnectionStatus()
  connectionTimer = setInterval(updateConnectionStatus, 5000)
})

onUnmounted(() => {
  if (connectionTimer) clearInterval(connectionTimer)
})

async function onExportZip() {
  try {
    const blob = await exportZip(projectStore.project)
    const name = projectStore.project.name.replace(/\s+/g, '_') || 'node_pack'
    downloadBlob(blob, `${name}.zip`)
    uiStore.showToast('ZIP exported!', 'success')
  } catch (err) {
    uiStore.showToast('Export failed. Check console for details.', 'error')
    console.error('Export error:', err)
  }
}

async function onHotReload() {
  const { comfyuiUrl, comfyuiInstallPath, name, nodes } = projectStore.project
  if (!comfyuiInstallPath) {
    uiStore.showToast('Set ComfyUI install path in Settings first.', 'error')
    return
  }
  try {
    statusText.value = 'Writing files...'
    // Build files map
    const files: Record<string, string> = {}
    for (const node of nodes) {
      files[`${node.name}.py`] = generatePython(node)
    }
    // __init__.py
    const nodeNames = nodes.map(n => n.name)
    const initLines = [
      ...nodeNames.map(n => `from .${n} import NODE_CLASS_MAPPINGS as ${n}_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS as ${n}_DISPLAY_MAPPINGS`),
      '',
      'NODE_CLASS_MAPPINGS = {}',
      'NODE_DISPLAY_NAME_MAPPINGS = {}',
      ...nodeNames.map(n => `NODE_CLASS_MAPPINGS.update(${n}_MAPPINGS)`),
      ...nodeNames.map(n => `NODE_DISPLAY_NAME_MAPPINGS.update(${n}_DISPLAY_MAPPINGS)`),
      '',
      '__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]',
    ]
    files['__init__.py'] = initLines.join('\n')
    const packName = name.replace(/\s+/g, '_') || 'node_pack'
    await writePack(comfyuiInstallPath, packName, files)
    statusText.value = 'Reloading ComfyUI...'
    if (comfyuiUrl) {
      await hotReload(comfyuiUrl)
    }
    statusText.value = 'Done!'
    uiStore.showToast('Hot reload complete!', 'success')
    setTimeout(() => { statusText.value = 'Ready' }, 3000)
  } catch (err) {
    statusText.value = 'Error'
    uiStore.showToast(`Hot reload failed: ${String(err)}`, 'error')
    setTimeout(() => { statusText.value = 'Ready' }, 5000)
  }
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
