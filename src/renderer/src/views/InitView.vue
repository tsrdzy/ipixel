<script setup>
import { ref, computed } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'

import { useStore } from '../composables/useStore'

const {
  state,
  createLibrary,
  openLibrary,
  browseAndOpenLibrary,
  removeLibrary,
  checkStatus
} = useStore()

const folderPath = ref('')
const libraryName = ref('我的模型库')
const error = ref('')
const busy = ref(false)

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
    error.value = '请先选择一个空文件夹'
    ElMessage.warning('请先选择一个空文件夹')
    return
  }
  if (!libraryName.value.trim()) {
    error.value = '请填写资源库名称'
    ElMessage.warning('请填写资源库名称')
    return
  }
  busy.value = true
  try {
    await createLibrary(folderPath.value, libraryName.value.trim())
    ElMessage.success('资源库已创建')
  } catch (e) {
    error.value = e.message || '创建失败'
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
      '仅从列表移除记录，不会删除磁盘上的文件。',
      '确定从列表中移除该资源库吗？',
      {
        confirmButtonText: '确定移除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
  } catch {
    return
  }
  try {
    await removeLibrary(path)
    ElMessage.success('已从列表移除')
  } catch (e) {
    ElMessage.error(e.message || '移除失败')
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
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 2 2 7v10l10 5 10-5V7L12 2Z" />
          <path d="M2 7l10 5 10-5M12 22V12" />
        </svg>
      </div>
      <h1>iModel 模型库</h1>
      <p class="subtitle">本地 3D 模型资源管理工具</p>

      <div class="layout">
        <!-- 左侧：创建新库 -->
        <div class="panel">
          <div class="panel-title">创建新资源库</div>

          <el-form label-position="top" class="create-form">
            <el-form-item label="资源库名称">
              <el-input v-model="libraryName" placeholder="为你的模型库命名" />
            </el-form-item>

            <el-form-item label="文件夹位置">
              <el-input :model-value="folderPath" placeholder="选择一个空文件夹" readonly>
                <template #append>
                  <el-button @click="selectFolder"><i class="iconfont icon-folder"></i> 浏览</el-button>
                </template>
              </el-input>
              <div class="hint">所选文件夹必须为空，否则无法创建</div>
            </el-form-item>

            <el-button type="primary" class="btn-block" :loading="busy" @click="handleCreate">
              创建资源库
            </el-button>
          </el-form>
        </div>

        <!-- 右侧：已有库列表 -->
        <div class="panel">
          <div class="panel-title">
            <span>已有资源库</span>
            <el-button link size="small" @click="handleBrowseOpen" :disabled="busy">
              <i class="iconfont icon-folder-plus"></i> 浏览打开
            </el-button>
          </div>

          <el-empty v-if="sortedLibraries.length === 0" description="暂无资源库记录">
            <div class="hint">创建一个新库，或点击"浏览打开"选择已有库文件夹</div>
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
                  title="打开"
                  :disabled="busy"
                  @click.stop="handleOpenExisting(lib.path)"
                >
                  <i class="iconfont icon-chevron-right"></i>
                </el-button>
                <el-button
                  circle
                  size="small"
                  type="danger"
                  title="从列表移除"
                  @click.stop="handleRemove(lib.path)"
                >
                  <i class="iconfont icon-trash-alt"></i>
                </el-button>
              </div>
            </li>
          </ul>
        </div>
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
  width: 880px;
  max-width: 100%;
}
.logo {
  color: var(--primary);
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
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
.layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}
.panel {
  display: flex;
  flex-direction: column;
}
.panel-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.create-form {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.hint {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 6px;
  line-height: 1.5;
}
.btn-block {
  width: 100%;
  margin-top: auto;
}

.lib-list {
  flex: 1;
  overflow-y: auto;
  max-height: 320px;
}
.lib-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius);
  border: 1px solid transparent;
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

@media (max-width: 760px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
