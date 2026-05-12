<template>
  <div class="notification-status-actions">
    <div v-if="notificationsOpen" class="notification-popover">
      <div class="notification-head">
        <span>Notifications</span>
        <button v-if="uiStore.diagnostics.length" @click="uiStore.clearDiagnostics()">Clear</button>
      </div>
      <div v-if="uiStore.diagnostics.length === 0" class="notification-empty">
        No notifications.
      </div>
      <div
        v-for="item in uiStore.diagnostics"
        :key="item.id"
        class="notification-item"
        :class="`notification-${item.level}`"
      >
        <div class="notification-title">
          <span>{{ item.level }}</span>
          <strong>{{ item.title }}</strong>
          <time>{{ formatTime(item.timestamp) }}</time>
        </div>
        <pre v-if="item.detail" class="notification-detail">{{ item.detail }}</pre>
      </div>
    </div>

    <div class="status-actions">
      <button
        class="status-btn notification-btn"
        :class="{ active: notificationsOpen }"
        aria-label="Notifications"
        @click="notificationsOpen = !notificationsOpen"
      >
        <span>Notifications</span>
        <span v-if="uiStore.diagnostics.length" class="count-badge">{{ uiStore.diagnostics.length }}</span>
      </button>
      <button class="status-btn settings-btn" aria-label="Settings" title="Settings" @click="emit('settings')">
        ⚙
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useUiStore } from '../stores/ui'

const emit = defineEmits<{
  settings: []
}>()

const uiStore = useUiStore()
const notificationsOpen = ref(false)

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
</script>

<style scoped>
.notification-status-actions {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex: 0 0 auto;
}
.status-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.status-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-sm);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.04), transparent),
    var(--raised);
  color: var(--text);
  cursor: pointer;
  font-size: 11.5px;
  font-weight: 700;
  box-shadow: var(--inner-highlight);
  transition: background 120ms ease, border-color 120ms ease, color 120ms ease, transform 80ms ease;
}
.status-btn:hover {
  background: var(--hover);
  border-color: var(--border-strong);
}
.status-btn:active {
  transform: translateY(1px);
}
.notification-btn {
  gap: 6px;
  padding: 0 9px;
}
.notification-btn.active {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: rgba(106, 166, 255, 0.3);
}
.settings-btn {
  width: 24px;
  padding: 0;
  font-size: 13px;
}
.count-badge {
  min-width: 15px;
  height: 15px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--warning);
  color: #1b1306;
  font-size: 9px;
  font-weight: 850;
}
.notification-popover {
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  z-index: 4200;
  width: min(520px, calc(100vw - 24px));
  max-height: min(540px, calc(100vh - 72px));
  overflow: auto;
  padding: 10px;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.04), transparent),
    var(--panel);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-lg);
}
.notification-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 4px 8px;
  color: var(--text-dim);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.notification-head button {
  height: 22px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: var(--raised);
  color: var(--text);
  cursor: pointer;
  font-size: 11px;
  font-weight: 700;
}
.notification-empty {
  padding: 24px 8px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}
.notification-item {
  border: 1px solid var(--border-subtle);
  border-left-width: 3px;
  border-radius: var(--r-sm);
  padding: 10px;
  margin-bottom: 8px;
  background: var(--field);
}
.notification-success { border-left-color: var(--success); }
.notification-error { border-left-color: var(--danger); }
.notification-warning { border-left-color: var(--warning); }
.notification-info { border-left-color: var(--accent); }
.notification-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text);
  font-size: 12px;
}
.notification-title span {
  color: var(--text-muted);
  text-transform: uppercase;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
}
.notification-title strong {
  min-width: 0;
  overflow-wrap: anywhere;
}
.notification-title time {
  margin-left: auto;
  flex: 0 0 auto;
  color: var(--text-muted);
  font-size: 11px;
}
.notification-detail {
  margin-top: 8px;
  white-space: pre-wrap;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-dim);
  line-height: 1.5;
  overflow-wrap: anywhere;
}
@media (max-width: 760px) {
  .notification-popover {
    right: -4px;
    width: calc(100vw - 20px);
    max-height: min(520px, calc(100vh - 72px));
  }
  .status-actions {
    max-width: calc(100vw - 20px);
  }
  .notification-btn {
    padding: 0 8px;
  }
}
</style>
