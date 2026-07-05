<script setup>
import { ref, computed, shallowRef, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import { useStore } from '../composables/useStore'
import ModelCard from '../components/ModelCard.vue'
import ModelViewer from '../components/ModelViewer.vue'

const { state, goUpload, goEdit, switchLibrary, renameLibrary, batchUpload, loadAll } = useStore()

const keyword = ref('')
const sortBy = ref('uploadTime') // uploadTime | fileSize | name | dimension
const sortDir = ref('desc') // asc | desc
const selectedTags = ref([])
const selectedTypes = ref([]) // 选中的格式筛选

/** 添加标签到全局标签池 */
async function handleAddTag() {
  try {
    const { value } = await ElMessageBox.prompt('请输入标签名称', '添加标签', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputValidator: (v) => (v && v.trim() ? true : '标签名不能为空')
    })
    await window.api.tags.add(value.trim())
    await loadAll()
    ElMessage.success('标签已添加')
  } catch (e) {
    // 用户取消
  }
}

/** 资源库名字下拉菜单命令处理 */
async function handleLibCommand(cmd) {
  if (cmd === 'switch') {
    switchLibrary()
  } else if (cmd === 'rename') {
    try {
      const { value } = await ElMessageBox.prompt('请输入新的资源库名称', '重命名', {
        inputValue: state.library?.name || '',
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputValidator: (v) => (v && v.trim() ? true : '名称不能为空')
      })
      await renameLibrary(value.trim())
      ElMessage.success('已重命名')
    } catch (e) {
      // 用户取消
    }
  }
}

const allTagsInUse = computed(() => {
  const set = new Set()
  state.models.forEach((m) => m.tags && m.tags.forEach((t) => set.add(t)))
  return [...set].sort()
})

const allTypesInUse = computed(() => {
  const set = new Set()
  state.models.forEach((m) => {
    if (m.fileType) set.add(m.fileType.toLowerCase())
  })
  return [...set].sort()
})

const filteredModels = computed(() => {
  let list = state.models.slice()

  const q = keyword.value.trim().toLowerCase()
  if (q) {
    list = list.filter((m) => {
      return (
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.description && m.description.toLowerCase().includes(q)) ||
        (m.tags && m.tags.some((t) => t.toLowerCase().includes(q)))
      )
    })
  }

  if (selectedTags.value.length) {
    list = list.filter((m) =>
      selectedTags.value.some((t) => m.tags && m.tags.includes(t))
    )
  }

  if (selectedTypes.value.length) {
    list = list.filter((m) =>
      m.fileType && selectedTypes.value.includes(m.fileType.toLowerCase())
    )
  }

  const dir = sortDir.value === 'asc' ? 1 : -1
  list.sort((a, b) => {
    let av, bv
    switch (sortBy.value) {
      case 'fileSize':
        av = a.fileSize || 0
        bv = b.fileSize || 0
        break
      case 'name':
        av = (a.name || '').toLowerCase()
        bv = (b.name || '').toLowerCase()
        return av.localeCompare(bv) * dir
      case 'dimension':
        av = a.dimensions ? (a.dimensions.x || 0) * (a.dimensions.y || 0) * (a.dimensions.z || 0) : 0
        bv = b.dimensions ? (b.dimensions.x || 0) * (b.dimensions.y || 0) * (b.dimensions.z || 0) : 0
        break
      default:
        av = new Date(a.uploadTime || 0).getTime()
        bv = new Date(b.uploadTime || 0).getTime()
    }
    return (av - bv) * dir
  })

  return list
})

function toggleTag(tag) {
  const idx = selectedTags.value.indexOf(tag)
  if (idx === -1) selectedTags.value.push(tag)
  else selectedTags.value.splice(idx, 1)
}

function toggleType(type) {
  const idx = selectedTypes.value.indexOf(type)
  if (idx === -1) selectedTypes.value.push(type)
  else selectedTypes.value.splice(idx, 1)
}

/** 排序字段中文名 */
const sortLabelMap = {
  uploadTime: '上传时间',
  fileSize: '文件大小',
  name: '名称',
  dimension: '模型尺寸'
}
const sortLabel = computed(
  () => `${sortLabelMap[sortBy.value] || '排序'} ${sortDir.value === 'asc' ? '正序' : '降序'}`
)

/** 排序下拉菜单命令处理 */
function handleSortCommand(cmd) {
  if (cmd === 'asc' || cmd === 'desc') {
    sortDir.value = cmd
  } else {
    sortBy.value = cmd
  }
}

function handleUploadCommand(cmd) {
  if (cmd === 'batch') handleBatchUpload()
}

// ===== 批量上传 =====
const batchVisible = ref(false)
const batchProgress = ref(0)
const batchCurrent = ref(0)
const batchTotal = ref(0)
const batchFileName = ref('')
const batchStage = ref('idle') // idle | copying | rendering | done
const batchResult = ref(null)

// 隐藏 ModelViewer 用于生成封面
const batchViewerVisible = ref(false)
const batchRenderKey = ref(0)
const currentBatchBuffer = shallowRef(null)
const currentBatchType = ref('')
const batchViewerRef = ref(null)

let pendingResolve = null
let pendingReject = null
let renderTimeout = null

function base64ToUint8Array(base64) {
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function onBatchModelLoaded(payload) {
  if (!pendingResolve) return
  // 等 2 帧确保渲染完成
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      let cover = null
      try {
        cover = batchViewerRef.value?.captureThumbnail() || null
      } catch (e) {
        console.warn('封面截图失败:', e)
      }
      const result = {
        dimensions: payload.dimensions || { x: 0, y: 0, z: 0 },
        animationCount: payload.animationCount || 0,
        cover
      }
      const resolve = pendingResolve
      pendingResolve = null
      pendingReject = null
      if (renderTimeout) {
        clearTimeout(renderTimeout)
        renderTimeout = null
      }
      resolve(result)
    })
  })
}

function onBatchModelError(err) {
  console.warn('[BatchUpload] 模型加载失败:', err)
  if (!pendingReject) return
  const reject = pendingReject
  pendingResolve = null
  pendingReject = null
  if (renderTimeout) {
    clearTimeout(renderTimeout)
    renderTimeout = null
  }
  reject(err)
}

/** 用隐藏的 ModelViewer 加载模型生成封面 */
function renderModelForCover(base64, fileType) {
  return new Promise((resolve, reject) => {
    pendingResolve = resolve
    pendingReject = reject
    const buffer = base64ToUint8Array(base64)
    // 通过 key 变化强制重新挂载 ModelViewer
    batchRenderKey.value++
    currentBatchBuffer.value = buffer
    currentBatchType.value = fileType
    batchViewerVisible.value = true
    // 超时保护（30s）
    renderTimeout = setTimeout(() => {
      if (pendingReject) {
        pendingReject(new Error('模型渲染超时'))
        pendingResolve = null
        pendingReject = null
      }
    }, 30000)
  })
}

async function handleBatchUpload() {
  batchVisible.value = true
  batchStage.value = 'copying'
  batchProgress.value = 0
  batchCurrent.value = 0
  batchTotal.value = 0
  batchFileName.value = ''
  batchResult.value = null

  try {
    // 阶段 1：复制文件（占 0-40%）
    const res = await batchUpload((data) => {
      batchCurrent.value = data.current
      batchTotal.value = data.total
      batchFileName.value = data.fileName
      if (data.total > 0) {
        batchProgress.value = Math.round((data.current / data.total) * 40)
      }
    })

    if (!res) {
      // 用户取消选择
      batchVisible.value = false
      batchStage.value = 'idle'
      return
    }

    // 分类：正常项 / 重复项 / 跳过项 / 错误项
    const normalItems = res.items.filter((it) => !it.error && !it.duplicate && !it.skipped)
    const duplicateItems = res.items.filter((it) => it.duplicate)
    const skippedItems = res.items.filter((it) => it.skipped)
    const errorItems = res.items.filter((it) => it.error)

    // 询问用户是否覆盖重复项
    let overwriteDuplicates = false
    if (duplicateItems.length > 0) {
      batchStage.value = 'confirming'
      try {
        await ElMessageBox.confirm(
          `发现 ${duplicateItems.length} 个重复模型，是否覆盖已有模型？\n覆盖将删除旧模型及其封面、标签等信息。`,
          '发现重复模型',
          {
            confirmButtonText: '全部覆盖',
            cancelButtonText: '全部跳过',
            type: 'warning'
          }
        )
        overwriteDuplicates = true
      } catch (action) {
        overwriteDuplicates = false
      }
    }

    // 阶段 2：渲染封面 + 提交（占 40-100%）
    batchStage.value = 'rendering'
    // 待处理列表：正常项 + （若覆盖则重复项经 overwrite 后变为正常项）
    const processItems = [...normalItems]
    const results = []

    // 处理需要覆盖的重复项：调用 overwrite 得到新模型数据
    if (overwriteDuplicates) {
      for (const dup of duplicateItems) {
        try {
          const overwritten = await window.api.models.overwrite(
            dup.existingModel,
            dup.pendingFile
          )
          processItems.push(overwritten)
        } catch (e) {
          console.error('[BatchUpload] 覆盖失败:', dup.defaultName, e)
          results.push({ success: false, name: dup.defaultName, error: '覆盖失败：' + (e.message || '') })
        }
      }
    } else {
      // 不覆盖：将重复项记为跳过
      for (const dup of duplicateItems) {
        results.push({ success: false, name: dup.defaultName, error: '已跳过（重复）' })
      }
    }

    // 批内重复与错误项直接记入结果
    for (const sk of skippedItems) {
      results.push({ success: false, name: sk.defaultName, error: '已跳过（批次内重复）' })
    }
    for (const err of errorItems) {
      results.push({ success: false, name: err.defaultName, error: err.message })
    }

    const total = processItems.length
    for (let i = 0; i < total; i++) {
      const item = processItems[i]
      batchCurrent.value = i + 1
      batchTotal.value = total
      batchFileName.value = item.defaultName
      batchProgress.value = 40 + Math.round((i / total) * 60)

      let dimensions = { x: 0, y: 0, z: 0 }
      let animCount = 0
      let cover = null

      try {
        const rendered = await renderModelForCover(item.dataBase64, item.fileType)
        dimensions = rendered.dimensions
        animCount = rendered.animationCount || 0
        cover = rendered.cover
      } catch (e) {
        console.warn('[BatchUpload] 渲染失败，跳过封面:', item.defaultName, e)
      }

      // 关闭隐藏 viewer 节省资源（下一个模型会重新挂载）
      batchViewerVisible.value = false
      currentBatchBuffer.value = null

      try {
        // 保存封面
        let coverField = null
        if (cover) {
          await window.api.models.saveImage(String(item.id), 'cover', cover)
          coverField = 'cover.png'
        }

        // 提交模型到对应分片
        const meta = {
          id: item.id,
          name: item.defaultName,
          description: '',
          fileName: String(item.fileName),
          fileType: String(item.fileType),
          fileSize: Number(item.fileSize),
          files: JSON.parse(JSON.stringify(item.files)),
          dimensions: {
            x: Number(dimensions.x) || 0,
            y: Number(dimensions.y) || 0,
            z: Number(dimensions.z) || 0
          },
          animationCount: Number(animCount) || 0,
          uploadTime: String(item.uploadTime),
          cover: coverField,
          viewParams: null,
          tags: []
        }
        await window.api.models.save(meta)
        results.push({ success: true, name: item.defaultName, id: item.id, hasCover: !!cover })
      } catch (e) {
        console.error('[BatchUpload] 提交失败:', item.defaultName, e)
        results.push({ success: false, name: item.defaultName, error: e.message || '提交失败' })
      }
    }

    batchResult.value = {
      total: res.total,
      success: results.filter((r) => r.success).length,
      results
    }
    batchStage.value = 'done'
    batchProgress.value = 100
    batchViewerVisible.value = false

    // 刷新模型列表
    await loadAll()

    const succ = batchResult.value.success
    if (succ === batchResult.value.total) {
      ElMessage.success(`成功上传 ${succ} 个模型`)
    } else if (succ > 0) {
      ElMessage.warning(`完成：成功 ${succ} / 失败 ${batchResult.value.total - succ}`)
    } else {
      ElMessage.error('全部上传失败')
    }

    // 全部成功 → 1.5 秒后自动关闭
    if (succ > 0 && succ === batchResult.value.total) {
      setTimeout(() => {
        batchVisible.value = false
      }, 1500)
    }
  } catch (e) {
    ElMessage.error(e.message || '批量上传失败')
    batchVisible.value = false
    batchStage.value = 'idle'
    batchViewerVisible.value = false
  }
}

function closeBatchDialog() {
  if (batchStage.value === 'copying' || batchStage.value === 'rendering' || batchStage.value === 'confirming') return
  batchVisible.value = false
  batchStage.value = 'idle'
  batchViewerVisible.value = false
}
</script>

<template>
  <div class="home">
    <!-- 顶栏 -->
    <header class="topbar">
      <div class="topbar-left">
        <el-dropdown trigger="click" @command="handleLibCommand">
          <span class="lib-name iconfont">
            &#xeb1a; {{ state.library?.name || '模型库' }}
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="rename">重命名</el-dropdown-item>
              <el-dropdown-item command="switch" divided>切换资源库</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
      <div class="topbar-right">
        <el-input
          v-model="keyword"
          placeholder="搜索模型名称 / 简介 / 标签"
          clearable
          class="search-input"
        >
          <template #prefix>
            <i class="iconfont icon-search"></i>
          </template>
        </el-input>
        <el-dropdown trigger="click" popper-class="sort-popper" @command="handleSortCommand">
          <el-button>
            <i class="iconfont icon-sort"></i>
            {{ sortLabel }}<i class="iconfont icon-chevron-down el-icon--right"></i>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="asc" :class="{ 'is-active': sortDir === 'asc' }">正序</el-dropdown-item>
              <el-dropdown-item command="desc" :class="{ 'is-active': sortDir === 'desc' }">降序</el-dropdown-item>
              <el-dropdown-item divided command="uploadTime" :class="{ 'is-active': sortBy === 'uploadTime' }">上传时间</el-dropdown-item>
              <el-dropdown-item command="fileSize" :class="{ 'is-active': sortBy === 'fileSize' }">文件大小</el-dropdown-item>
              <el-dropdown-item command="name" :class="{ 'is-active': sortBy === 'name' }">名称</el-dropdown-item>
              <el-dropdown-item command="dimension" :class="{ 'is-active': sortBy === 'dimension' }">模型尺寸</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <!-- 上传模型按钮：点击直接单个上传，hover显示批量上传选项 -->
        <el-dropdown trigger="hover" @command="handleUploadCommand">
          <el-button type="primary" @click="goUpload()">
            <i class="iconfont icon-cloud-upload"></i>
            上传模型<i class="iconfont icon-chevron-down el-icon--right"></i>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="batch">批量上传（自动生成封面）</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>

    <!-- 标签筛选 -->
    <div class="tag-bar">
      <span class="tag-label">标签：</span>
      <el-check-tag
        v-for="t in allTagsInUse"
        :key="t"
        :checked="selectedTags.includes(t)"
        @change="toggleTag(t)"
      >
        {{ t }}
      </el-check-tag>
      <!-- <el-button size="small" plain @click="handleAddTag">+ 添加标签</el-button> -->
      <el-button 
      dashed
      type="info"
      size="small"
      @click="handleAddTag">添加</el-button>
      <el-button v-if="selectedTags.length" link size="small" @click="selectedTags = []">清除</el-button>
    </div>

    <!-- 格式筛选 -->
    <div class="tag-bar" v-if="allTypesInUse.length">
      <span class="tag-label">格式筛选：</span>
      <el-check-tag
        v-for="t in allTypesInUse"
        :key="t"
        :checked="selectedTypes.includes(t)"
        @change="toggleType(t)"
      >
        {{ t.toUpperCase() }}
      </el-check-tag>
      <el-button v-if="selectedTypes.length" link size="small" @click="selectedTypes = []">清除</el-button>
    </div>

    <!-- 模型网格 -->
    <main class="content">
      <div v-if="filteredModels.length" class="grid">
        <ModelCard
          v-for="m in filteredModels"
          :key="m.id"
          :model="m"
          @click="goEdit(m)"
        />
      </div>

      <el-empty v-else :description="state.models.length === 0 ? '还没有模型，点击「上传模型」添加第一个' : '没有匹配的模型'" />
    </main>

    <!-- 批量上传进度弹窗 -->
    <el-dialog
      v-model="batchVisible"
      :title="batchStage === 'done' ? '批量上传完成' : (batchStage === 'rendering' ? '正在生成封面' : batchStage === 'confirming' ? '正在确认重复项' : '正在复制文件')"
      width="480px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="batchStage === 'done'"
      @close="closeBatchDialog"
    >
      <div class="batch-body">
        <el-progress
          :percentage="batchProgress"
          :status="batchStage === 'done' ? 'success' : undefined"
          :stroke-width="10"
        />
        <div class="batch-info" v-if="batchStage !== 'done'">
          <div class="batch-status">
            <span v-if="batchStage === 'copying'">正在复制 {{ batchCurrent }} / {{ batchTotal }}</span>
            <span v-else-if="batchStage === 'confirming'">等待确认重复项...</span>
            <span v-else-if="batchStage === 'rendering'">正在生成封面 {{ batchCurrent }} / {{ batchTotal }}</span>
          </div>
          <div class="batch-file" v-if="batchFileName">
            当前文件：{{ batchFileName }}
          </div>
        </div>
        <div class="batch-info" v-else-if="batchResult">
          <div class="batch-status">
            共 {{ batchResult.total }} 个，成功 {{ batchResult.success }} 个
          </div>
          <ul v-if="batchResult.results && batchResult.results.length" class="batch-result">
            <li
              v-for="(r, i) in batchResult.results"
              :key="i"
              :class="['batch-item', r.success ? 'ok' : 'fail']"
            >
              <span class="batch-item-name">{{ r.name }}</span>
              <span class="batch-item-status">
                <span v-if="r.success && r.hasCover === false">成功（无封面）</span>
                <span v-else-if="r.success">成功</span>
                <span v-else>失败：{{ r.error || '' }}</span>
              </span>
            </li>
          </ul>
        </div>
      </div>
      <template #footer>
        <el-button
          v-if="batchStage === 'done'"
          type="primary"
          @click="closeBatchDialog"
        >
          完成
        </el-button>
        <el-button v-else disabled>处理中...</el-button>
      </template>
    </el-dialog>

    <!-- 隐藏的 ModelViewer 用于批量上传时生成封面 -->
    <div class="hidden-viewer" v-if="batchViewerVisible">
      <ModelViewer
        :key="batchRenderKey"
        ref="batchViewerRef"
        :buffer="currentBatchBuffer"
        :file-type="currentBatchType"
        @loaded="onBatchModelLoaded"
        @error="onBatchModelError"
      />
    </div>
  </div>
</template>

<style scoped>
.home {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  border-bottom: 1px solid var(--border-soft);
  flex-shrink: 0;
}
.topbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.lib-name {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  outline: none;
  border-radius: 4px;
  transition: background 0.2s;
}
.lib-name:hover {
  background: var(--el-fill-color-light);
}
.topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.search-input {
  width: 260px;
}
.search-input :deep(.el-input__prefix .iconfont) {
  font-size: 14px;
}
.tag-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 24px;
  border-bottom: 1px solid var(--border-soft);
  flex-shrink: 0;
}
.tag-label {
  font-size: 12px;
  color: var(--text-3);
  margin-right: 4px;
}
.content {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px 32px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

/* 批量上传弹窗 */
.batch-body {
  padding: 4px 0;
}
.batch-info {
  margin-top: 16px;
}
.batch-status {
  font-size: 13px;
  margin-bottom: 8px;
}
.batch-file {
  font-size: 12px;
  color: var(--text-3);
  word-break: break-all;
}
.batch-result {
  max-height: 240px;
  overflow-y: auto;
  margin-top: 8px;
}
.batch-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 12px;
  border-bottom: 1px solid var(--border-soft);
}
.batch-item:last-child {
  border-bottom: none;
}
.batch-item.ok .batch-item-status {
  color: var(--success);
}
.batch-item.fail .batch-item-status {
  color: var(--danger);
}
.batch-item-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 8px;
}
.batch-item-status {
  flex-shrink: 0;
}

/* 隐藏的 ModelViewer 容器：必须有真实尺寸供 WebGL 渲染，但移出可视区域 */
.hidden-viewer {
  position: fixed;
  left: -9999px;
  top: 0;
  width: 400px;
  height: 300px;
  pointer-events: none;
  z-index: -1;
  opacity: 0;
}
</style>

<style>
/* 排序下拉菜单选中项高亮（popper 渲染到 body，需用全局样式） */
.sort-popper .is-active {
  color: var(--el-color-primary);
  font-weight: 600;
}
</style>
