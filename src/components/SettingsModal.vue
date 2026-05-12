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
            <span class="label">Pack Name</span>
            <input data-testid="settings-pack-name" v-model="localName" class="input" @change="saveName" placeholder="My Node Pack" />
          </label>
          <label class="field">
            <span class="label">ComfyUI Folder</span>
            <input data-testid="settings-pack-folder" v-model="localPackFolderName" class="input input-mono" @change="savePackFolderName" placeholder="ComfyUINodeBuilder" spellcheck="false" />
            <span class="hint">Deploy target: custom_nodes/{{ activePackFolderName }}. Renaming this deploys to a new folder; old deployed folders are not removed automatically.</span>
          </label>
          <label class="field">
            <span class="label">ComfyUI URL</span>
            <input v-model="localUrl" class="input input-mono" @change="saveUrl" placeholder="http://127.0.0.1:8188" spellcheck="false" />
          </label>
          <div class="setting-action">
            <button class="btn-secondary" @click="checkComfyuiConnection">Check ComfyUI</button>
            <span class="check-result" :class="connectionClass">{{ connectionText }}</span>
          </div>
          <label class="field">
            <span class="label">ComfyUI Install Path (for deploy/load)</span>
            <input data-testid="settings-install-path" v-model="localInstallPath" class="input input-mono" @change="saveInstallPath" placeholder="/home/user/ComfyUI or /mnt/c/ComfyUI" spellcheck="false" />
          </label>
          <div class="setting-action">
            <button class="btn-secondary" @click="checkInstallPath">Check Install Path</button>
            <span class="check-result" :class="installClass">{{ installText }}</span>
          </div>
          <div class="info">
            Deploy writes generated Python and builder.project.json to ComfyUI/custom_nodes/{{ activePackFolderName }}. Restart ComfyUI after deploy to load Python changes.
          </div>
          <section class="pack-import">
            <div class="section-row">
              <div>
                <div class="section-title">Builder Packs in ComfyUI</div>
                <p>Scan custom_nodes for packs created by this builder, then import one as a local workspace.</p>
              </div>
              <button
                data-testid="settings-scan-packs"
                class="btn-secondary"
                :disabled="scanState === 'scanning'"
                @click="scanManagedPacks"
              >
                {{ scanState === 'scanning' ? 'Scanning...' : 'Scan Packs' }}
              </button>
            </div>
            <div v-if="scanState === 'error'" class="scan-error">{{ scanError }}</div>
            <div v-else-if="scanState === 'done' && discoveredPacks.length === 0" class="scan-empty">
              No builder-owned packs found.
            </div>
            <div v-else-if="discoveredPacks.length > 0" class="pack-list">
              <div v-for="pack in discoveredPacks" :key="pack.packName" class="pack-row">
                <div class="pack-meta">
                  <strong>{{ pack.project.name || pack.packName }}</strong>
                  <span>{{ pack.packName }}</span>
                </div>
                <button
                  :data-testid="`settings-import-pack-${pack.packName}`"
                  class="btn-secondary"
                  @click="importDiscoveredPack(pack)"
                >
                  Import
                </button>
              </div>
            </div>
          </section>
          <section class="danger-zone">
            <div class="danger-title">Load Builder Pack</div>
            <p>
              This reads builder.project.json from the active pack folder and replaces the current builder project copy for that same pack. It can overwrite unsaved local builder changes for {{ activePackFolderName }}.
            </p>
            <label class="ack-row">
              <input data-testid="settings-load-pack-ack" type="checkbox" v-model="loadAcknowledged" />
              <span>I understand this replaces the current builder project.</span>
            </label>
            <button
              data-testid="settings-load-pack"
              class="btn-danger"
              :disabled="!loadAcknowledged"
              @click="requestLoadManagedPack"
            >
              Load Pack from ComfyUI
            </button>
          </section>
        </div>
        <div class="modal-footer">
          <button class="btn-primary" @click="close">Done</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useProjectStore } from '../stores/project'
import { checkConnection } from '../lib/comfyuiApi'
import { listManagedProjects, validateInstallPath, type ManagedProjectSummary } from '../lib/writeToFilesystem'
import { MANAGED_PACK_NAME } from '../lib/managedPack'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'load-managed-pack': []
  'import-managed-pack': [project: ManagedProjectSummary['project'], packName: string, metadataPath: string]
}>()

const projectStore = useProjectStore()

const localName = ref(projectStore.project.name)
const localPackFolderName = ref(projectStore.project.packFolderName || MANAGED_PACK_NAME)
const localUrl = ref(projectStore.project.comfyuiUrl)
const localInstallPath = ref(projectStore.project.comfyuiInstallPath)
const connectionState = ref<'idle' | 'checking' | 'ok' | 'error'>('idle')
const installState = ref<'idle' | 'checking' | 'ok' | 'error'>('idle')
const installDetail = ref('')
const loadAcknowledged = ref(false)
const scanState = ref<'idle' | 'scanning' | 'done' | 'error'>('idle')
const scanError = ref('')
const discoveredPacks = ref<ManagedProjectSummary[]>([])

const activePackFolderName = computed(() => projectStore.project.packFolderName || MANAGED_PACK_NAME)

const connectionText = computed(() => {
  if (connectionState.value === 'checking') return 'Checking...'
  if (connectionState.value === 'ok') return 'Connected'
  if (connectionState.value === 'error') return 'Not reachable'
  return 'Not checked'
})

const installText = computed(() => {
  if (installState.value === 'checking') return 'Checking...'
  if (installState.value === 'ok') return installDetail.value || 'custom_nodes found'
  if (installState.value === 'error') return installDetail.value || 'Invalid path'
  return 'Not checked'
})

const connectionClass = computed(() => `check-${connectionState.value}`)
const installClass = computed(() => `check-${installState.value}`)

watch(() => props.modelValue, (open) => {
  if (open) {
    localName.value = projectStore.project.name
    localPackFolderName.value = projectStore.project.packFolderName || MANAGED_PACK_NAME
    localUrl.value = projectStore.project.comfyuiUrl
    localInstallPath.value = projectStore.project.comfyuiInstallPath
    connectionState.value = 'idle'
    installState.value = 'idle'
    installDetail.value = ''
    loadAcknowledged.value = false
    scanState.value = 'idle'
    scanError.value = ''
    discoveredPacks.value = []
  }
})

function saveName() { projectStore.setProjectName(localName.value.trim()) }
function savePackFolderName() {
  projectStore.setPackFolderName(localPackFolderName.value.trim())
  localPackFolderName.value = projectStore.project.packFolderName || MANAGED_PACK_NAME
}
function saveUrl() { projectStore.setComfyuiUrl(localUrl.value.trim()) }
function saveInstallPath() { projectStore.setComfyuiInstallPath(localInstallPath.value.trim()) }

async function checkComfyuiConnection() {
  saveUrl()
  connectionState.value = 'checking'
  connectionState.value = await checkConnection(localUrl.value.trim()) ? 'ok' : 'error'
}

async function checkInstallPath() {
  saveInstallPath()
  installState.value = 'checking'
  installDetail.value = ''
  try {
    const result = await validateInstallPath(localInstallPath.value.trim())
    installState.value = 'ok'
    installDetail.value = result.customNodesPath
  } catch (err) {
    installState.value = 'error'
    installDetail.value = String(err)
  }
}

function requestLoadManagedPack() {
  if (!loadAcknowledged.value) return
  saveInstallPath()
  emit('load-managed-pack')
  close()
}

async function scanManagedPacks() {
  saveInstallPath()
  discoveredPacks.value = []
  scanError.value = ''
  if (!localInstallPath.value.trim()) {
    scanError.value = 'Set the ComfyUI install path before scanning.'
    scanState.value = 'error'
    return
  }
  scanState.value = 'scanning'
  try {
    const result = await listManagedProjects(localInstallPath.value.trim())
    discoveredPacks.value = result.packs
    scanState.value = 'done'
  } catch (err) {
    scanError.value = String(err)
    scanState.value = 'error'
  }
}

function importDiscoveredPack(pack: ManagedProjectSummary) {
  emit('import-managed-pack', pack.project, pack.packName, pack.path)
  close()
}

function close() { emit('update:modelValue', false) }
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: overlay-in 140ms ease-out;
}
.modal {
  background: var(--panel);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-lg);
  width: 480px;
  max-width: 92vw;
  box-shadow: var(--shadow-lg);
  animation: modal-in 180ms cubic-bezier(0.2, 0.9, 0.3, 1);
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  border-bottom: 1px solid var(--border);
}
.modal-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  letter-spacing: 0.01em;
}
.btn-close {
  width: 26px;
  height: 26px;
  background: none;
  border: 1px solid transparent;
  color: var(--text-dim);
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
  border-radius: var(--r-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 100ms ease, color 100ms ease;
}
.btn-close:hover { background: var(--hover); color: var(--text); }
.modal-body { padding: 18px; display: flex; flex-direction: column; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.label { font-size: 11px; color: var(--text-dim); font-weight: 500; }
.hint {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.45;
}
.input {
  background: var(--bg);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-md);
  padding: 8px 10px;
  color: var(--text);
  font-size: 13px;
  outline: none;
  width: 100%;
  transition: border-color 100ms ease, box-shadow 100ms ease;
}
.input::placeholder { color: var(--text-muted); }
.input-mono { font-family: var(--font-mono); font-size: 12.5px; }
.input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.info {
  font-size: 11px;
  color: var(--text-dim);
  line-height: 1.55;
  padding: 10px 12px;
  background: var(--bg);
  border-radius: var(--r-md);
  border: 1px solid var(--border);
}
.pack-import {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
}
.section-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.section-title {
  color: var(--text);
  font-size: 12px;
  font-weight: 780;
}
.pack-import p {
  margin-top: 4px;
  color: var(--text-dim);
  font-size: 11.5px;
  line-height: 1.45;
}
.scan-error,
.scan-empty {
  color: var(--text-dim);
  font-size: 12px;
  line-height: 1.45;
}
.scan-error {
  color: var(--danger);
}
.pack-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.pack-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px;
  background: var(--panel);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-sm);
}
.pack-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.pack-meta strong {
  color: var(--text);
  font-size: 12.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pack-meta span {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
}
.danger-zone {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 12px;
  border: 1px solid rgba(240, 120, 120, 0.36);
  border-radius: var(--r-md);
  background:
    linear-gradient(180deg, rgba(240, 120, 120, 0.08), rgba(240, 120, 120, 0.03)),
    var(--bg);
}
.danger-title {
  color: var(--danger);
  font-size: 11px;
  font-weight: 850;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}
.danger-zone p {
  color: var(--text-dim);
  font-size: 11.5px;
  line-height: 1.5;
}
.ack-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--text);
  font-size: 12px;
  line-height: 1.35;
}
.ack-row input {
  margin-top: 1px;
}
.setting-action {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: -8px;
}
.btn-secondary {
  padding: 6px 10px;
  background: var(--raised);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
}
.btn-secondary:hover {
  background: var(--hover);
  border-color: var(--border-strong);
}
.btn-danger {
  align-self: flex-start;
  padding: 7px 10px;
  background: var(--danger-soft);
  color: var(--danger);
  border: 1px solid rgba(240, 120, 120, 0.42);
  border-radius: var(--r-sm);
  cursor: pointer;
  font-size: 12px;
  font-weight: 760;
}
.btn-danger:hover:not(:disabled) {
  background: rgba(240, 120, 120, 0.18);
  border-color: rgba(240, 120, 120, 0.62);
}
.btn-danger:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
.check-result {
  min-width: 0;
  color: var(--text-muted);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.check-ok { color: var(--success); }
.check-error { color: var(--danger); }
.check-checking { color: var(--warning); }
.modal-footer {
  padding: 14px 18px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.btn-primary {
  padding: 7px 22px;
  background: var(--accent-strong);
  color: #fff;
  border: none;
  border-radius: var(--r-md);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: background 100ms ease;
  box-shadow: 0 1px 0 rgba(255,255,255,0.08) inset, 0 1px 2px rgba(0,0,0,0.3);
}
.btn-primary:hover { background: var(--accent); }
@keyframes overlay-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes modal-in {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
</style>
