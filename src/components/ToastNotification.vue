<template>
  <div class="toast-container">
    <div
      v-for="toast in uiStore.toasts"
      :key="toast.id"
      class="toast"
      :class="`toast-${toast.type}`"
    >
      {{ toast.message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useUiStore } from '../stores/ui'
const uiStore = useUiStore()
</script>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 40px;
  right: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 1000;
}
.toast {
  padding: 10px 16px;
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  min-width: 200px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
}
.toast-success { background: #2e7d32; }
.toast-error { background: #c62828; }
.toast-info { background: #1565c0; }
</style>
