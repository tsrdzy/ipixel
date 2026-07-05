<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessageBox, ElMessage } from 'element-plus'

import { useStore } from '../composables/useStore'
import iconPng from '../assets/icon.png'

const { t } = useI18n()
const {
  state,
  createLibrary,
  openLibrary,
  browseAndOpenLibrary,
  removeLibrary,
  checkStatus
} = useStore()

const folderPath = ref('')
const libraryName = ref(t('init.title'))
const error = ref('')
const busy = ref(false)
const activeTab = ref('create') // create | open

// 历史资源库列表，按最近打开时间倒序
const sortedLibraries = computed(() => {
  return [...state.libraries].sort((a, b) => {
    return new Date(b.lastOpenedAt || 0) - new Date(a.lastOpenedAt || 0)
  })
})

async function selectFolder() {
  error.value = ''
  const p = await window.api.library.selectFolder()
  if (p) {
    folderPath.value = p
    // 若文件夹名可推断，且名称未改，自动填充名称
    if (libraryName.value === '我的模型库' || !libraryName.value) {
      const base = p.split(/[\\/]/).pop()
      if (base) libraryName.value = base
    }
  }
}

async function handleCreate() {
  error.value = ''
  if (!folderPath.value) {
    error.value = t('init.openDesc')
    ElMessage.warning(t('init.openDesc'))
    return
  }
  if (!libraryName.value.trim()) {
    error.value = t('init.libraryName')
    ElMessage.warning(t('init.libraryName'))
    return
  }
  busy.value = true
  try {
    await createLibrary(folderPath.value, libraryName.value.trim())
    ElMessage.success(t('init.create') + t('common.ok'))
  } catch (e) {
    error.value = e.message || t('init.creating') + t('common.failed')
    ElMessage.error(error.value)
  } finally {
    busy.value = false
  }
}

async function handleOpenExisting(folderPath) {
  error.value = ''
  busy.value = true
  try {
    await openLibrary(folderPath)
  } catch (e) {
    error.value = e.message || '打开失败，该文件夹可能不是有效资源库'
    ElMessage.error(error.value)
  } finally {
    busy.value = false
  }
}

async function handleBrowseOpen() {
  error.value = ''
  busy.value = true
  try {
    await browseAndOpenLibrary()
  } catch (e) {
    error.value = e.message || '打开失败，所选文件夹不是有效资源库'
    ElMessage.error(error.value)
  } finally {
    busy.value = false
  }
}

async function handleRemove(path) {
  try {
    await ElMessageBox.confirm(
      t('init.confirmDelete'),
      t('init.deleteLibrary'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
  } catch {
    return
  }
  try {
    await removeLibrary(path)
    ElMessage.success(t('common.ok'))
  } catch (e) {
    ElMessage.error(e.message || t('common.failed'))
  }
}

function formatDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  } catch {
    return ''
  }
}
</script>

<template>
  <div class="init">
    <el-card class="init-card" shadow="never">
      <div class="logo">
        <img :src="iconPng" alt="iModel" />
      </div>
      <h1>iModel</h1>
      <p class="subtitle">{{ t('init.title') }}</p>

      <!-- 选项卡切换 -->
      <div class="tabs-wrapper">
        <el-tabs v-model="activeTab" class="init-tabs" @tab-change="error = ''">
          <!-- 创建新资源库 -->
          <el-tab-pane :label="t('init.create')" name="create">
            <div class="tab-content">
              <el-form label-position="top" class="create-form">
                <el-form-item :label="t('init.libraryName')">
                  <el-input v-model="libraryName" :placeholder="t('init.libraryName')" />
                </el-form-item>

                <el-form-item :label="t('init.libraryPath')">
                  <el-input :model-value="folderPath" :placeholder="t('init.openDesc')" readonly>
                    <template #append>
                      <el-button @click="selectFolder"><i class="iconfont icon-folder"></i> {{ t('init.browse') }}</el-button>
                    </template>
                  </el-input>
                  <div class="hint">{{ t('init.createDesc') }}</div>
                </el-form-item>

                <el-button type="primary" class="btn-block" :loading="busy" @click="handleCreate">
                  <i class="iconfont icon-plus"></i> {{ t('init.create') }}
                </el-button>
              </el-form>
            </div>
          </el-tab-pane>

          <!-- 打开已有资源库 -->
          <el-tab-pane :label="t('init.open')" name="open">
            <div class="tab-content">
              <div class="open-header">
                <el-button link @click="handleBrowseOpen" :disabled="busy">
                  <i class="iconfont icon-folder-plus"></i> {{ t('init.browse') }}{{ t('init.open') }}
                </el-button>
              </div>

              <el-empty v-if="sortedLibraries.length === 0" :description="t('init.empty')">
                <div class="hint">{{ t('init.createDesc') }}</div>
              </el-empty>

              <ul v-else class="lib-list">
                <li
                  v-for="lib in sortedLibraries"
                  :key="lib.path"
                  class="lib-item"
                  :class="{ active: lib.path === state.libraryPath }"
                >
                  <div class="lib-info" @click="handleOpenExisting(lib.path)">
                    <div class="lib-name">
                      <i class="iconfont icon-folder lib-icon"></i>
                      <span>{{ lib.name }}</span>
                    </div>
                    <div class="lib-path" :title="lib.path">{{ lib.path }}</div>
                    <div class="lib-meta">
                      <span v-if="lib.lastOpenedAt">最近打开: {{ formatDate(lib.lastOpenedAt) }}</span>
                    </div>
                  </div>
                  <div class="lib-actions">
                    <el-button
                      circle
                      size="small"
                      :title="t('init.open')"
                      :disabled="busy"
                      @click.stop="handleOpenExisting(lib.path)"
                    >
                      <i class="iconfont icon-chevron-right"></i>
                    </el-button>
                    <el-button
                      circle
                      size="small"
                      type="danger"
                      :title="t('init.deleteLibrary')"
                      @click.stop="handleRemove(lib.path)"
                    >
                      <i class="iconfont icon-trash-alt"></i>
                    </el-button>
                  </div>
                </li>
              </ul>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>

      <el-alert
        v-if="error"
        :title="error"
        type="error"
        show-icon
        :closable="false"
        class="error-alert"
      />
    </el-card>
  </div>
</template>

<style scoped>
.init {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow: auto;
}
.init-card {
  width: 600px;
  max-width: 100%;
}
.logo {
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
}
.logo img {
  width: 48px;
  height: 48px;
  object-fit: contain;
}
h1 {
  text-align: center;
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 4px;
}
.subtitle {
  text-align: center;
  color: var(--text-2);
  font-size: 13px;
  margin-bottom: 24px;
}
.tabs-wrapper {
  width: 100%;
}
.init-tabs :deep(.el-tabs__header) {
  margin-bottom: 0;
}
.init-tabs :deep(.el-tabs__content) {
  padding: 0;
}
.tab-content {
  padding: 20px;
  border: 1px solid var(--border-soft);
  border-top: none;
  border-radius: 0 0 var(--radius) var(--radius);
  min-height: 300px;
}
.create-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.hint {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 6px;
  line-height: 1.5;
}
.btn-block {
  width: 100%;
  margin-top: 8px;
}
.open-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}
.lib-list {
  max-height: 320px;
  overflow-y: auto;
}
.lib-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  margin-bottom: 4px;
  border: 1px solid transparent;
  transition: all 0.2s;
}
.lib-item:last-child {
  margin-bottom: 0;
}
.lib-item:hover {
  background: var(--bg-hover);
  border-color: var(--border-soft);
}
.lib-item.active {
  background: var(--primary-soft);
  border-color: var(--primary);
}
.lib-info {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}
.lib-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
}
.lib-icon {
  color: var(--primary);
  flex-shrink: 0;
}
.lib-path {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lib-meta {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 2px;
}
.lib-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
.error-alert {
  margin-top: 16px;
}
</style>
