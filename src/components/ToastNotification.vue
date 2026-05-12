<template>
  <div class="toast-container">
    <div
      v-for="toast in uiStore.toasts"
      :key="toast.id"
      class="toast"
      :class="`toast-${toast.type}`"
    >
      <div class="toast-title">{{ toast.title }}</div>
      <div v-if="toast.message" class="toast-message">{{ toast.message }}</div>
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
  bottom: 44px;
  right: 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 1000;
}
.toast {
  padding: 11px 14px;
  border-radius: var(--r-md);
  color: #fff;
  min-width: 260px;
  max-width: 440px;
  box-shadow: var(--shadow-md);
  border: 1px solid rgba(255, 255, 255, 0.08);
  animation: toast-in 180ms cubic-bezier(0.2, 0.9, 0.3, 1);
}
.toast-title {
  font-size: 13px;
  font-weight: 750;
}
.toast-message {
  margin-top: 4px;
  color: rgba(255,255,255,0.82);
  font-size: 12px;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.toast-success { background: linear-gradient(180deg, #2f9b5c 0%, #207145 100%); }
.toast-error   { background: linear-gradient(180deg, #c84d4d 0%, #9d3535 100%); }
.toast-info    { background: linear-gradient(180deg, #2e7be7 0%, #1f5cb7 100%); }
.toast-warning { background: linear-gradient(180deg, #b98231 0%, #885b22 100%); }
@keyframes toast-in {
  from { opacity: 0; transform: translateX(8px); }
  to   { opacity: 1; transform: translateX(0); }
}
@media (max-width: 760px) {
  .toast-container {
    right: 10px;
    bottom: 44px;
    max-width: calc(100vw - 20px);
  }
  .toast {
    min-width: 0;
    max-width: calc(100vw - 20px);
  }
}
</style>
