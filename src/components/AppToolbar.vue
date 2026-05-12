<template>
  <div class="toolbar">
    <div class="brand">
      <span class="brand-mark">◇</span>
      <span class="brand-name">ComfyUI Node Builder</span>
      <div class="pack-switcher">
        <button
          data-testid="create-pack"
          class="icon-btn"
          title="Create pack"
          aria-label="Create pack"
          @click="createPack"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 3.25v9.5" />
            <path d="M3.25 8h9.5" />
          </svg>
        </button>
        <select
          data-testid="pack-switcher"
          class="pack-select"
          :value="projectStore.project.id"
          aria-label="Active pack"
          @change="switchPack"
        >
          <option
            v-for="pack in projectStore.projectSummaries"
            :key="pack.id"
            :value="pack.id"
          >
            {{ pack.name }} · {{ pack.packFolderName }}
          </option>
        </select>
        <button
          data-testid="rename-pack"
          class="icon-btn"
          title="Rename active pack"
          aria-label="Rename active pack"
          @click="openRename"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3.25 11.75h9.5" />
            <path d="M9.85 3.65 12.35 6.15 6.2 12.3H3.7V9.8l6.15-6.15Z" />
          </svg>
        </button>
        <button
          data-testid="duplicate-pack"
          class="icon-btn"
          title="Duplicate active pack"
          aria-label="Duplicate active pack"
          @click="duplicatePack"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <rect x="5.25" y="3.25" width="7" height="7" rx="1.25" />
            <path d="M10.75 10.75v.75c0 .69-.56 1.25-1.25 1.25h-5A1.25 1.25 0 0 1 3.25 11.5v-5c0-.69.56-1.25 1.25-1.25h.75" />
          </svg>
        </button>
        <button
          data-testid="delete-pack"
          class="icon-btn danger-icon"
          title="Delete active pack from the local builder workspace"
          aria-label="Delete active pack"
          :disabled="projectStore.projectSummaries.length <= 1"
          @click="deletePack"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3.25 4.75h9.5" />
            <path d="M6.25 4.75V3.5h3.5v1.25" />
            <path d="M4.75 4.75 5.35 12.2c.05.62.57 1.1 1.19 1.1h2.92c.62 0 1.14-.48 1.19-1.1l.6-7.45" />
            <path d="M7 7.25v3.5" />
            <path d="M9 7.25v3.5" />
          </svg>
        </button>
        <div v-if="renameOpen" class="rename-popover" data-testid="rename-pack-popover">
          <label class="rename-field">
            <span>Pack Name</span>
            <input
              data-testid="toolbar-pack-name"
              v-model="draftName"
              class="rename-input"
              @keydown.enter.prevent="saveRename"
              @keydown.esc.prevent="cancelRename"
            />
          </label>
          <label class="rename-field">
            <span>ComfyUI Folder</span>
            <input
              data-testid="toolbar-pack-folder"
              v-model="draftFolder"
              class="rename-input rename-input-mono"
              spellcheck="false"
              @keydown.enter.prevent="saveRename"
              @keydown.esc.prevent="cancelRename"
            />
          </label>
          <div class="rename-actions">
            <button class="rename-secondary" @click="cancelRename">Cancel</button>
            <button data-testid="save-pack-rename" class="rename-primary" @click="saveRename">Save</button>
          </div>
        </div>
      </div>
    </div>
    <div class="actions">
      <button
        @click="emit('export-zip')"
        class="btn"
        :disabled="exportDisabled"
        :title="exportDisabled ? exportDisabledReason : ''"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 2.75v6.5" />
          <path d="m5.5 6.85 2.5 2.5 2.5-2.5" />
          <path d="M3.25 11.25v1.25c0 .69.56 1.25 1.25 1.25h7c.69 0 1.25-.56 1.25-1.25v-1.25" />
        </svg>
        <span>Export ZIP</span>
      </button>
      <button
        @click="emit('deploy')"
        class="btn btn-primary"
        :disabled="exportDisabled || deployInProgress"
        :title="exportDisabled ? exportDisabledReason : deployInProgress ? 'Deploy pipeline is running' : 'Deploy pack, install dependencies when needed, then restart ComfyUI'"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 2.75v7.5" />
          <path d="m5.25 5.5 2.75-2.75 2.75 2.75" />
          <path d="M4.25 11.75c.74.93 1.9 1.5 3.75 1.5s3.01-.57 3.75-1.5" />
        </svg>
        <span>{{ deployInProgress ? 'Deploying...' : 'Deploy & Restart' }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useProjectStore } from '../stores/project'
import { MANAGED_PACK_NAME } from '../lib/managedPack'

defineProps<{
  exportDisabled?: boolean
  exportDisabledReason?: string
  deployInProgress?: boolean
}>()
const emit = defineEmits<{
  'export-zip': []
  'deploy': []
}>()

const projectStore = useProjectStore()
const renameOpen = ref(false)
const draftName = ref('')
const draftFolder = ref('')

watch(() => projectStore.project.id, () => {
  if (renameOpen.value) openRename()
})

function switchPack(event: Event) {
  const id = (event.target as HTMLSelectElement).value
  projectStore.switchProject(id)
}

function openRename() {
  draftName.value = projectStore.project.name
  draftFolder.value = projectStore.project.packFolderName || MANAGED_PACK_NAME
  renameOpen.value = true
}

function cancelRename() {
  renameOpen.value = false
}

function saveRename() {
  projectStore.setProjectName(draftName.value.trim() || projectStore.project.name)
  projectStore.setPackFolderName(draftFolder.value.trim() || projectStore.project.packFolderName || projectStore.project.name)
  draftName.value = projectStore.project.name
  draftFolder.value = projectStore.project.packFolderName || MANAGED_PACK_NAME
  renameOpen.value = false
}

function createPack() {
  projectStore.createProject('New Pack')
}

function duplicatePack() {
  projectStore.duplicateProject(projectStore.project.id)
}

function deletePack() {
  projectStore.deleteProject(projectStore.project.id)
}
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  padding: 0 14px;
  height: 48px;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.035), transparent),
    var(--header);
  border-bottom: 1px solid var(--border-subtle);
  box-shadow: 0 1px 0 rgba(255,255,255,0.035) inset;
  flex-shrink: 0;
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  background:
    linear-gradient(145deg, rgba(104, 167, 255, 0.24), rgba(104, 167, 255, 0.06)),
    var(--raised);
  border: 1px solid rgba(104, 167, 255, 0.24);
  color: var(--accent);
  font-size: 14px;
  font-weight: 700;
  box-shadow: var(--inner-highlight);
}
.brand-name {
  font-weight: 750;
  color: var(--text);
  font-size: 14px;
  letter-spacing: 0;
  flex: 0 0 auto;
}
.pack-switcher {
  position: relative;
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  margin-left: 6px;
  padding-left: 10px;
  border-left: 1px solid var(--border-subtle);
}
.pack-select {
  width: min(320px, 30vw);
  height: 30px;
  border-radius: var(--r-md);
  border: 1px solid var(--border-subtle);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.035), transparent),
    var(--field);
  color: var(--text);
  padding: 0 30px 0 10px;
  font-size: 12.5px;
  font-weight: 650;
  outline: none;
}
.pack-select:focus-visible {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.rename-popover {
  position: absolute;
  top: calc(100% + 8px);
  left: 10px;
  z-index: 50;
  width: 310px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background: var(--panel);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-md);
}
.rename-popover::before {
  content: '';
  position: absolute;
  top: -6px;
  left: 96px;
  width: 10px;
  height: 10px;
  background: var(--panel);
  border-left: 1px solid var(--border-strong);
  border-top: 1px solid var(--border-strong);
  transform: rotate(45deg);
}
.rename-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.rename-field span {
  color: var(--text-dim);
  font-size: 11px;
  font-weight: 650;
}
.rename-input {
  width: 100%;
  height: 30px;
  padding: 0 9px;
  border-radius: var(--r-sm);
  border: 1px solid var(--border);
  background: var(--field);
  color: var(--text);
  outline: none;
  font-size: 12.5px;
}
.rename-input-mono {
  font-family: var(--font-mono);
}
.rename-input:focus-visible {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.rename-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}
.rename-primary,
.rename-secondary {
  height: 28px;
  padding: 0 10px;
  border-radius: var(--r-sm);
  cursor: pointer;
  font-size: 12px;
  font-weight: 750;
}
.rename-secondary {
  background: var(--raised);
  color: var(--text-dim);
  border: 1px solid var(--border);
}
.rename-primary {
  background: var(--accent-strong);
  color: #fff;
  border: 1px solid rgba(255,255,255,0.1);
}
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: var(--r-md);
  border: 1px solid var(--border-subtle);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.04), transparent),
    var(--raised);
  color: var(--text);
  cursor: pointer;
  line-height: 1;
  box-shadow: var(--inner-highlight);
}
.icon-btn:hover {
  background: var(--hover);
  border-color: var(--border-strong);
}
.icon-btn:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}
.icon-btn svg,
.btn svg {
  width: 14px;
  height: 14px;
  stroke: currentColor;
  stroke-width: 1.6;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.danger-icon {
  color: var(--danger);
}
.danger-icon:hover:not(:disabled) {
  border-color: rgba(240, 120, 120, 0.32);
  background: var(--danger-soft);
}
.actions {
  display: flex;
  gap: 6px;
  align-items: center;
  min-width: 0;
}
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 11px;
  height: 30px;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.04), transparent),
    var(--raised);
  color: var(--text);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-md);
  cursor: pointer;
  font-size: 12.5px;
  font-weight: 650;
  box-shadow: var(--inner-highlight), 0 1px 1px rgba(0,0,0,0.18);
  transition: background 120ms ease, border-color 120ms ease, color 120ms ease, transform 80ms ease;
}
.btn:hover:not(:disabled) {
  background: var(--hover);
  border-color: var(--border-strong);
}
.btn:active:not(:disabled) { transform: translateY(1px); }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-primary {
  background: linear-gradient(180deg, #72adff, var(--accent-strong));
  border-color: rgba(255,255,255,0.1);
  color: #fff;
  font-weight: 760;
  box-shadow: 0 1px 0 rgba(255,255,255,0.22) inset, 0 8px 20px rgba(77, 145, 247, 0.22);
}
.btn-primary:hover:not(:disabled) {
  background: linear-gradient(180deg, #84b9ff, #589bfb);
  border-color: transparent;
}
@media (max-width: 760px) {
  .toolbar {
    gap: 10px;
    padding: 0 10px;
  }
  .brand {
    flex: 1 1 auto;
    overflow: hidden;
  }
  .brand-name {
    max-width: 116px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pack-switcher {
    flex: 1 1 auto;
    margin-left: 0;
    padding-left: 8px;
  }
  .pack-select {
    width: 100%;
    min-width: 140px;
  }
  .rename-popover {
    left: 0;
    width: min(310px, calc(100vw - 20px));
  }
  .actions {
    flex: 1 1 auto;
    overflow-x: auto;
    padding-bottom: 2px;
    scrollbar-width: thin;
  }
  .btn {
    flex: 0 0 auto;
  }
}
</style>
