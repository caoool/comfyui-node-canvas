<template>
  <div class="toolbar">
    <span class="title">ComfyUI Node Builder</span>
    <div class="actions">
      <button @click="emit('add-node')" class="btn-primary">+ Add Node</button>
      <button @click="emit('export-zip')" class="btn">Export ZIP</button>
      <button @click="emit('hot-reload')" class="btn">Hot Reload</button>
      <button @click="emit('settings')" class="btn">⚙ Settings</button>
    </div>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  'add-node': []
  'export-zip': []
  'hot-reload': []
  'settings': []
}>()
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  height: 44px;
  background: var(--header);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.title {
  font-weight: 600;
  color: var(--text);
  font-size: 14px;
}
.actions { display: flex; gap: 8px; }
.btn {
  padding: 5px 12px;
  background: var(--node-body);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}
.btn:hover { background: var(--header); }
.btn-primary {
  padding: 5px 12px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}
.btn-primary:hover { opacity: 0.9; }
</style>
