<template>
  <Teleport to="body">
    <div v-if="modelValue" class="modal-overlay" @click.self="close">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">Settings</span>
          <button class="btn-close" @click="close">×</button>
        </div>
        <div class="modal-body">
          <label class="field">
            <span class="label">Project Name</span>
            <input v-model="localName" class="input" @change="saveName" placeholder="My Node Pack" />
          </label>
          <label class="field">
            <span class="label">ComfyUI URL</span>
            <input v-model="localUrl" class="input" @change="saveUrl" placeholder="http://127.0.0.1:8188" />
          </label>
          <label class="field">
            <span class="label">ComfyUI Install Path (for hot reload)</span>
            <input v-model="localInstallPath" class="input" @change="saveInstallPath" placeholder="C:\ComfyUI or /home/user/ComfyUI" />
          </label>
          <div class="info">
            The install path is used by the local helper server to write node files directly to ComfyUI's custom_nodes/ directory.
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-primary" @click="close">Done</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useProjectStore } from '../stores/project'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [val: boolean] }>()

const projectStore = useProjectStore()

const localName = ref(projectStore.project.name)
const localUrl = ref(projectStore.project.comfyuiUrl)
const localInstallPath = ref(projectStore.project.comfyuiInstallPath)

watch(() => props.modelValue, (open) => {
  if (open) {
    localName.value = projectStore.project.name
    localUrl.value = projectStore.project.comfyuiUrl
    localInstallPath.value = projectStore.project.comfyuiInstallPath
  }
})

function saveName() { projectStore.setProjectName(localName.value.trim()) }
function saveUrl() { projectStore.setComfyuiUrl(localUrl.value.trim()) }
function saveInstallPath() { projectStore.setComfyuiInstallPath(localInstallPath.value.trim()) }
function close() { emit('update:modelValue', false) }
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}
.modal {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  width: 460px;
  max-width: 90vw;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
}
.modal-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
}
.btn-close {
  background: none;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
  padding: 0 4px;
}
.btn-close:hover { color: var(--text); }
.modal-body { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 4px; }
.label { font-size: 11px; color: var(--text-dim); }
.input {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 6px 10px;
  color: var(--text);
  font-size: 13px;
  outline: none;
  width: 100%;
}
.input:focus { border-color: var(--accent); }
.info {
  font-size: 11px;
  color: var(--text-dim);
  line-height: 1.5;
  padding: 8px;
  background: var(--bg);
  border-radius: 4px;
  border: 1px solid var(--border);
}
.modal-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
}
.btn-primary {
  padding: 6px 20px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}
.btn-primary:hover { opacity: 0.9; }
</style>
