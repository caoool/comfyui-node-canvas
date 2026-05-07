<template>
  <div class="code-panel">
    <div v-if="!selectedNode" class="no-node">
      Select a node to edit its code.
    </div>
    <template v-else>
      <!-- Editor section -->
      <div class="section-header">Execute Body</div>
      <div class="editor-wrap">
        <VueMonacoEditor
          v-model:value="localCode"
          language="python"
          theme="vs-dark"
          :options="editorOptions"
          @change="onCodeChange"
        />
      </div>

      <!-- Preview section -->
      <div class="section-header preview-header">
        <span>Generated Python</span>
        <button class="btn-copy" @click="copyGenerated" title="Copy">Copy</button>
      </div>
      <div class="preview-wrap">
        <pre class="preview-code">{{ generatedCode }}</pre>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { VueMonacoEditor } from '@guolao/vue-monaco-editor'
import { useProjectStore } from '../stores/project'
import { useUiStore } from '../stores/ui'
import { generatePython } from '../lib/generatePython'

const projectStore = useProjectStore()
const uiStore = useUiStore()

const editorOptions = {
  minimap: { enabled: false },
  fontSize: 13,
  lineNumbers: 'on' as const,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 4,
  insertSpaces: true,
}

const selectedNode = computed(() => {
  if (!uiStore.selectedNodeId) return null
  return projectStore.project.nodes.find(n => n.id === uiStore.selectedNodeId) ?? null
})

const localCode = ref(selectedNode.value?.code ?? '')

watch(selectedNode, (node) => {
  localCode.value = node?.code ?? ''
})

const generatedCode = computed(() => {
  if (!selectedNode.value) return ''
  return generatePython({ ...selectedNode.value, code: localCode.value })
})

function onCodeChange(value: string | undefined) {
  if (!selectedNode.value || value === undefined) return
  projectStore.updateNode(selectedNode.value.id, { code: value })
}

async function copyGenerated() {
  try {
    await navigator.clipboard.writeText(generatedCode.value)
  } catch {}
}
</script>

<style scoped>
.code-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--panel);
  overflow: hidden;
}
.no-node {
  padding: 16px;
  font-size: 12px;
  color: var(--text-dim);
  text-align: center;
}
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-dim);
  background: var(--header);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.editor-wrap {
  height: 240px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border);
}
.preview-header { border-top: 1px solid var(--border); }
.preview-wrap {
  flex: 1;
  overflow: auto;
  padding: 8px;
}
.preview-code {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12px;
  color: var(--text);
  white-space: pre;
  margin: 0;
}
.btn-copy {
  padding: 2px 8px;
  background: var(--node-body);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
}
.btn-copy:hover { background: var(--header); }
</style>
