<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../stores/settings'
import { ElMessage, ElMessageBox } from 'element-plus'

const { t } = useI18n()
const settingsStore = useSettingsStore()

const shortcutItems = [
  { key: 'selectAll', label: 'menu.shortcutSelectAll' },
  { key: 'delete', label: 'menu.shortcutDelete' },
  { key: 'export', label: 'menu.shortcutExport' },
  { key: 'arrowUp', label: 'menu.shortcutArrowUp' },
  { key: 'arrowDown', label: 'menu.shortcutArrowDown' },
  { key: 'arrowLeft', label: 'menu.shortcutArrowLeft' },
  { key: 'arrowRight', label: 'menu.shortcutArrowRight' }
]

const editingShortcut = ref(null)
const listeningKey = ref(false)

function startEditShortcut(key) {
  editingShortcut.value = key
  listeningKey.value = true
}

function onGlobalKeyDown(e) {
  if (!listeningKey.value || !editingShortcut.value) return

  e.preventDefault()
  e.stopPropagation()

  const key = e.key
  const ctrl = e.ctrlKey || e.metaKey

  if (key === 'Escape') {
    editingShortcut.value = null
    listeningKey.value = false
    return
  }

  if (key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') return

  settingsStore.setShortcuts(editingShortcut.value, { key, ctrl })
  editingShortcut.value = null
  listeningKey.value = false
  ElMessage.success(t('common.success'))
}

watch(listeningKey, (val) => {
  if (val) {
    document.addEventListener('keydown', onGlobalKeyDown, true)
  } else {
    document.removeEventListener('keydown', onGlobalKeyDown, true)
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', onGlobalKeyDown, true)
})

function resetAllShortcuts() {
  ElMessageBox.confirm(
    t('settings.resetShortcutsConfirm'),
    t('common.confirm'),
    {
      confirmButtonText: t('common.ok'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    }
  ).then(() => {
    settingsStore.resetShortcuts()
    ElMessage.success(t('common.success'))
  }).catch(() => {
    // cancelled
  })
}

function getShortcutDisplay(shortcut) {
  const s = settingsStore.shortcuts[shortcut]
  if (!s) return '-'
  const parts = []
  if (s.ctrl) parts.push('Ctrl')
  parts.push(s.key)
  return parts.join(' + ')
}
</script>

<template>
  <div class="shortcuts-container">
    <div class="shortcuts-header">
      <h2>{{ t('menu.shortcuts') }}</h2>
      <el-button size="small" @click="resetAllShortcuts">
        {{ t('common.reset') }}
      </el-button>
    </div>
    <div class="shortcuts-content">
      <el-card>
        <div class="shortcuts-list">
          <div
            v-for="item in shortcutItems"
            :key="item.key"
            class="shortcut-item"
          >
            <span class="shortcut-label">{{ t(item.label) }}</span>
            <div
              class="shortcut-input"
              :class="{ 'listening': editingShortcut === item.key }"
              @click="startEditShortcut(item.key)"
            >
              <span v-if="editingShortcut !== item.key">{{ getShortcutDisplay(item.key) }}</span>
              <span v-else>{{ t('settings.pressKey') }}</span>
            </div>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.shortcuts-container {
  padding: 24px;
  width: 100%;
  height: 100%;
  overflow: auto;
}

.shortcuts-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.shortcuts-header h2 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-1);
  margin: 0;
}

.shortcuts-content {
  width: 100%;
  max-width: 600px;
}

.shortcuts-list {
  display: flex;
  flex-direction: column;
}

.shortcut-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
  border-bottom: 1px solid var(--border-soft);
}

.shortcut-item:last-child {
  border-bottom: none;
}

.shortcut-label {
  font-size: 14px;
  color: var(--text-1);
}

.shortcut-input {
  padding: 6px 16px;
  background: var(--bg-soft);
  border: 1px solid var(--border-soft);
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-2);
  cursor: pointer;
  transition: all 0.2s;
  min-width: 140px;
  text-align: center;
}

.shortcut-input:hover {
  border-color: var(--primary);
}

.shortcut-input.listening {
  border-color: var(--primary);
  background: var(--primary-soft);
  color: var(--primary);
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
</style>
