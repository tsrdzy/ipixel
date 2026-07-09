<script setup>
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ElTable,
  ElTableColumn,
  ElButton,
  ElSelect,
  ElOption,
  ElPagination,
  ElMessageBox,
  ElMessage,
  ElTag
} from 'element-plus'

const { t } = useI18n()

const logs = ref([])
const total = ref(0)
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(50)
const filterType = ref('')
const filterModule = ref('')
const filterStatus = ref('')

const operationTypes = {
  'create': '创建',
  'open': '打开',
  'close': '关闭',
  'delete': '删除',
  'rename': '重命名',
  'upload': '上传',
  'upload_failed': '上传失败',
  'batch_upload': '批量上传',
  'export': '导出',
  'tool_use': '工具使用',
  'tool_failed': '工具失败',
  'error': '错误'
}

const modules = {
  'library': '资源库',
  'models': '模型',
  'images': '图片',
  'audios': '音频',
  'fonts': '字体',
  'tools': '工具'
}

const statusMap = {
  'success': '成功',
  'failed': '失败',
  'partial': '部分成功'
}

const statusColors = {
  'success': 'success',
  'failed': 'danger',
  'partial': 'warning'
}

async function loadLogs() {
  loading.value = true
  try {
    const result = await window.api.logs.query({
      limit: pageSize.value,
      offset: (currentPage.value - 1) * pageSize.value,
      type: filterType.value || undefined,
      module: filterModule.value || undefined,
      status: filterStatus.value || undefined
    })
    logs.value = result.logs
    total.value = result.count
  } catch (e) {
    ElMessage.error('加载日志失败')
  } finally {
    loading.value = false
  }
}

async function exportLogs() {
  try {
    const allLogs = await window.api.logs.export()
    const content = JSON.stringify(allLogs, null, 2)
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `operation_logs_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('日志导出成功')
  } catch (e) {
    ElMessage.error('导出日志失败')
  }
}

async function clearLogs() {
  try {
    await ElMessageBox.confirm('确定要清空所有操作日志吗？此操作不可恢复。', '确认清空', {
      type: 'warning'
    })
    await window.api.logs.clear()
    ElMessage.success('日志已清空')
    currentPage.value = 1
    loadLogs()
  } catch {
    // 用户取消
  }
}

function formatTime(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function formatDetail(detail) {
  if (!detail) return ''
  if (typeof detail === 'string') return detail
  return JSON.stringify(detail, null, 2)
}

watch([filterType, filterModule, filterStatus], () => {
  currentPage.value = 1
  loadLogs()
})

onMounted(loadLogs)
</script>

<template>
  <div class="logs-container h-100">
    <div class="logs-header">
      <h2>{{ t('menu.operationLogs') || '操作日志' }}</h2>
    </div>
    <div class="logs-content">
      <div class="logs-filter">
        <ElSelect
          v-model="filterType"
          placeholder="操作类型"
          clearable
          style="width: 140px; margin-right: 12px;"
        >
          <ElOption v-for="(label, value) in operationTypes" :key="value" :label="label" :value="value" />
        </ElSelect>
        <ElSelect
          v-model="filterModule"
          placeholder="模块"
          clearable
          style="width: 120px; margin-right: 12px;"
        >
          <ElOption v-for="(label, value) in modules" :key="value" :label="label" :value="value" />
        </ElSelect>
        <ElSelect
          v-model="filterStatus"
          placeholder="状态"
          clearable
          style="width: 100px; margin-right: auto;"
        >
          <ElOption v-for="(label, value) in statusMap" :key="value" :label="label" :value="value" />
        </ElSelect>
        <ElButton type="primary" @click="exportLogs" style="margin-right: 8px;">导出日志</ElButton>
        <ElButton type="danger" @click="clearLogs">清空日志</ElButton>
      </div>

      <ElTable
        :data="logs"
        :loading="loading"
        border
        stripe
        style="width: 100%; margin-top: 16px;"
        max-height="calc(100vh - 200px)"
      >
        <ElTableColumn prop="id" label="ID" width="80" />
        <ElTableColumn prop="timestamp" label="时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.timestamp) }}
          </template>
        </ElTableColumn>
        <ElTableColumn prop="operation_type" label="操作类型" width="120">
          <template #default="{ row }">
            {{ operationTypes[row.operation_type] || row.operation_type }}
          </template>
        </ElTableColumn>
        <ElTableColumn prop="module" label="模块" width="80">
          <template #default="{ row }">
            {{ modules[row.module] || row.module }}
          </template>
        </ElTableColumn>
        <ElTableColumn prop="detail" label="详情" min-width="300">
          <template #default="{ row }">
            <pre class="detail-pre">{{ formatDetail(row.detail) }}</pre>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="status" label="状态" width="80">
          <template #default="{ row }">
            <ElTag :type="statusColors[row.status]">{{ statusMap[row.status] || row.status }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="error_message" label="错误信息" min-width="200" />
      </ElTable>

      <div class="logs-pagination" style="margin-top: 16px; text-align: right;">
        <ElPagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[20, 50, 100, 200]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadLogs"
          @current-change="loadLogs"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.logs-container {
  padding: 24px;
  width: 100%;
  height: 100%;
  overflow: auto;
}

.logs-header {
  margin-bottom: 24px;
}

.logs-header h2 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-1);
  margin: 0;
}

.logs-content {
  width: 100%;
}

.logs-filter {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-pre {
  font-family: monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  padding: 4px;
  background: var(--bg-soft);
  border-radius: 4px;
  max-height: 100px;
  overflow-y: auto;
}
</style>