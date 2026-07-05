<script setup>
import { ref, computed, shallowRef, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import { useStore } from '../composables/useStore'
import ModelViewer from '../components/ModelViewer.vue'
import TagInput from '../components/TagInput.vue'

const { state, goHome, deleteModel } = useStore()

function base64ToUint8Array(base64) {
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

const isEdit = computed(() => state.view === 'edit' && state.editingModel)

const buffer = shallowRef(null)
const fileType = ref('')
const auxFiles = ref([])

const name = ref('')
const description = ref('')
const tags = ref([])
const dimensions = ref({ x: 0, y: 0, z: 0 })
const animationCount = ref(0)

const uploadData = ref(null)

const viewerRef = ref(null)
const loadingModel = ref(false)
const coverSaved = ref(false)
const coverPreview = ref('')
const saved = ref(false)
const saving = ref(false)
const errorMsg = ref('')
const exporting = ref(false)

const initialViewParams = computed(() => state.editingModel?.viewParams || null)

function showToast(msg, type = 'success') {
  ElMessage({ message: msg, type, duration: 2000 })
}

function formatSize(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

const fileInfo = computed(() => {
  if (isEdit.value) {
    const m = state.editingModel
    return {
      fileName: m.fileName,
      fileType: m.fileType,
      fileSize: m.fileSize,
      uploadTime: m.uploadTime
    }
  }
  return uploadData.value
    ? {
        fileName: uploadData.value.fileName,
        fileType: uploadData.value.fileType,
        fileSize: uploadData.value.fileSize,
        uploadTime: uploadData.value.uploadTime
      }
    : null
})

const modelId = computed(() => {
  return isEdit.value ? state.editingModel.id : uploadData.value?.id
})

const allFiles = computed(() => {
  if (isEdit.value) {
    return state.editingModel.files || []
  }
  return uploadData.value?.files || []
})

function roleLabel(role) {
  const m = {
    main: '主',
    mtl: '材质',
    texture: '贴图',
    animation: '动画',
    bin: 'BIN',
    aux: '辅'
  }
  return m[role] || '辅'
}

function roleTagType(role) {
  const m = {
    main: 'primary',
    mtl: 'warning',
    texture: 'success',
    animation: 'info',
    bin: '',
    aux: 'info'
  }
  return m[role] || 'info'
}

const canAddMTL = computed(() => fileType.value === 'obj')
const canAddTexture = computed(() => ['obj', 'gltf', 'json', 'fbx'].includes(fileType.value))
const canAddAnimation = computed(() => fileType.value === 'json')
const canAddBin = computed(() => fileType.value === 'gltf')

async function addAuxFile(role) {
  if (!modelId.value) return
  try {
    const added = await window.api.models.addAuxFile(String(modelId.value), role)
    if (!added || added.length === 0) return
    console.log('[Upload] 添加辅助文件:', added.length, '个')

    if (isEdit.value) {
      state.editingModel.files = [...(state.editingModel.files || []), ...added.map((f) => ({ name: f.name, role: f.role, size: f.size }))]
      state.editingModel.fileSize = (state.editingModel.fileSize || 0) + added.reduce((s, f) => s + f.size, 0)
    } else {
      uploadData.value.files = [...(uploadData.value.files || []), ...added.map((f) => ({ name: f.name, role: f.role, size: f.size }))]
      uploadData.value.fileSize = (uploadData.value.fileSize || 0) + added.reduce((s, f) => s + f.size, 0)
    }

    auxFiles.value = [...auxFiles.value, ...added]

    const newBuffer = new Uint8Array(buffer.value)
    buffer.value = null
    requestAnimationFrame(() => {
      buffer.value = newBuffer
    })

    showToast('已添加 ' + added.length + ' 个文件')
  } catch (e) {
    errorMsg.value = e.message || '添加失败'
    showToast(errorMsg.value, 'error')
    console.error('[Upload] 添加辅助文件失败:', e)
  }
}

async function removeAuxFile(fileName) {
  if (!modelId.value) return
  try {
    await window.api.models.removeAuxFile(String(modelId.value), fileName)
    console.log('[Upload] 删除辅助文件:', fileName)

    if (isEdit.value) {
      const removed = (state.editingModel.files || []).find((f) => f.name === fileName)
      state.editingModel.files = (state.editingModel.files || []).filter((f) => f.name !== fileName)
      if (removed) {
        state.editingModel.fileSize = Math.max(0, (state.editingModel.fileSize || 0) - (removed.size || 0))
      }
    } else {
      const removed = (uploadData.value.files || []).find((f) => f.name === fileName)
      uploadData.value.files = (uploadData.value.files || []).filter((f) => f.name !== fileName)
      if (removed) {
        uploadData.value.fileSize = Math.max(0, (uploadData.value.fileSize || 0) - (removed.size || 0))
      }
    }

    auxFiles.value = auxFiles.value.filter((f) => f.name !== fileName)

    const newBuffer = new Uint8Array(buffer.value)
    buffer.value = null
    requestAnimationFrame(() => {
      buffer.value = newBuffer
    })

    showToast('已删除')
  } catch (e) {
    errorMsg.value = e.message || '删除失败'
    showToast(errorMsg.value, 'error')
    console.error('[Upload] 删除辅助文件失败:', e)
  }
}

async function selectFile() {
  errorMsg.value = ''
  loadingModel.value = true
  try {
    const data = await window.api.models.upload()
    if (!data) {
      loadingModel.value = false
      return
    }

    // 重复检测：询问用户是否覆盖
    if (data.duplicate) {
      loadingModel.value = false
      const existingName = data.existingModel?.name || data.existingModel?.fileName || '未命名'
      try {
        await ElMessageBox.confirm(
          `发现重复模型「${existingName}」，是否覆盖？\n覆盖将删除旧模型及其封面、标签等信息。`,
          '发现重复模型',
          {
            confirmButtonText: '覆盖',
            cancelButtonText: '跳过',
            type: 'warning',
            distinguishCancelAndClose: true
          }
        )
      } catch (action) {
        // 用户选择跳过或关闭
        if (action === 'cancel') {
          showToast('已跳过重复模型')
        }
        return
      }
      // 用户确认覆盖
      loadingModel.value = true
      try {
        const overwritten = await window.api.models.overwrite(
          data.existingModel,
          data.pendingFile
        )
        applyUploadData(overwritten)
      } catch (e) {
        errorMsg.value = e.message || '覆盖失败'
        showToast(errorMsg.value, 'error')
        console.error('[Upload] 覆盖失败:', e)
      } finally {
        loadingModel.value = false
      }
      return
    }

    applyUploadData(data)
  } catch (e) {
    errorMsg.value = e.message || '上传失败'
    showToast(errorMsg.value, 'error')
    console.error('[Upload] 上传失败:', e)
  } finally {
    loadingModel.value = false
  }
}

/** 将上传/覆盖返回的数据应用到组件状态 */
function applyUploadData(data) {
  console.log('[Upload] 上传返回:', {
    id: data.id,
    fileName: data.fileName,
    fileType: data.fileType,
    fileSize: data.fileSize,
    dataBase64Length: data.dataBase64 ? data.dataBase64.length : 0,
    auxCount: (data.auxFiles || []).length
  })
  uploadData.value = data
  if (data.defaultName && !name.value) {
    name.value = data.defaultName
  }
  buffer.value = base64ToUint8Array(data.dataBase64)
  auxFiles.value = data.auxFiles || []
  console.log('[Upload] 转换后 buffer:', buffer.value ? buffer.value.length : 0, '字节')
  fileType.value = data.fileType
}

async function onModelLoaded(payload) {
  dimensions.value = payload.dimensions
  animationCount.value = payload.animationCount || 0
  if (!coverSaved.value) {
    requestAnimationFrame(() => {
      requestAnimationFrame(async () => {
        await saveCover()
      })
    })
  }
}

async function saveCover() {
  if (!viewerRef.value || !modelId.value) return
  const base64 = viewerRef.value.captureThumbnail()
  if (!base64) {
    console.warn('封面截图为空')
    return
  }
  coverPreview.value = base64
  await window.api.models.saveImage(String(modelId.value), 'cover', base64)
  coverSaved.value = true
  showToast('封面已更新')
}

function resetView() {
  viewerRef.value?.resetView()
}

async function handleSave() {
  if (!name.value.trim()) {
    errorMsg.value = '请填写模型名称'
    ElMessage.warning('请填写模型名称')
    return
  }
  saving.value = true
  errorMsg.value = ''
  try {
    const viewParams = viewerRef.value?.getViewParams() || null

    const saveData = {
      id: modelId.value,
      name: String(name.value.trim()),
      description: String(description.value.trim()),
      fileName: String(isEdit.value ? state.editingModel.fileName : uploadData.value.fileName),
      fileType: String(isEdit.value ? state.editingModel.fileType : uploadData.value.fileType),
      fileSize: Number(isEdit.value ? state.editingModel.fileSize : uploadData.value.fileSize),
      files: JSON.parse(JSON.stringify(isEdit.value ? (state.editingModel.files || []) : (uploadData.value.files || []))),
      dimensions: {
        x: Number(dimensions.value.x),
        y: Number(dimensions.value.y),
        z: Number(dimensions.value.z)
      },
      animationCount: Number(animationCount.value || 0),
      uploadTime: String(isEdit.value ? state.editingModel.uploadTime : uploadData.value.uploadTime),
      cover: coverSaved.value ? 'cover.png' : (isEdit.value ? state.editingModel.cover : null),
      viewParams: viewParams ? {
        cameraPosition: {
          x: Number(viewParams.cameraPosition.x),
          y: Number(viewParams.cameraPosition.y),
          z: Number(viewParams.cameraPosition.z)
        },
        cameraTarget: {
          x: Number(viewParams.cameraTarget.x),
          y: Number(viewParams.cameraTarget.y),
          z: Number(viewParams.cameraTarget.z)
        }
      } : null,
      tags: tags.value.map((t) => String(t))
    }

    if (isEdit.value) {
      await window.api.models.update(String(modelId.value), saveData)
    } else {
      await window.api.models.save(saveData)
    }
    saved.value = true
    showToast('保存成功')
    setTimeout(() => goHome(), 600)
  } catch (e) {
    errorMsg.value = e.message || '保存失败'
    showToast(errorMsg.value, 'error')
    console.error('保存失败:', e)
  } finally {
    saving.value = false
  }
}

async function handleBack() {
  if (!isEdit.value && uploadData.value && !saved.value) {
    try {
      await window.api.models.delete(String(uploadData.value.id))
    } catch (e) {
    }
  }
  goHome()
}

async function handleDelete() {
  try {
    await ElMessageBox.confirm(
      '删除后无法恢复，确定删除该模型吗？',
      '确认删除',
      {
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    )
  } catch {
    return
  }
  try {
    await deleteModel(String(modelId.value))
    showToast('已删除')
    setTimeout(() => goHome(), 400)
  } catch (e) {
    errorMsg.value = e.message || '删除失败'
    showToast(errorMsg.value, 'error')
    console.error('[Upload] 删除失败:', e)
  }
}

async function handleExport() {
  if (!modelId.value) return
  exporting.value = true
  errorMsg.value = ''
  try {
    const model = {
      id: String(modelId.value),
      name: String(name.value || state.editingModel?.name || uploadData.value?.fileName || 'model'),
      fileName: String(isEdit.value ? state.editingModel.fileName : uploadData.value?.fileName || '')
    }
    const res = await window.api.models.export(model)
    if (!res) {
      exporting.value = false
      return
    }
    showToast(`已导出 ${res.fileCount} 个文件到：${res.targetDir}`)
    console.log('[Upload] 导出完成:', res)
  } catch (e) {
    errorMsg.value = e.message || '导出失败'
    showToast(errorMsg.value, 'error')
    console.error('[Upload] 导出失败:', e)
  } finally {
    exporting.value = false
  }
}

onMounted(async () => {
  if (isEdit.value) {
    const m = state.editingModel
    name.value = m.name || ''
    description.value = m.description || ''
    tags.value = m.tags ? [...m.tags] : []
    dimensions.value = m.dimensions ? { ...m.dimensions } : { x: 0, y: 0, z: 0 }
    animationCount.value = Number(m.animationCount || 0)
    coverSaved.value = !!m.cover

    loadingModel.value = true
    try {
      const res = await window.api.models.loadFile({
        id: String(m.id),
        fileName: String(m.fileName),
        fileType: String(m.fileType),
        files: JSON.parse(JSON.stringify(m.files || []))
      })
      console.log('[Upload] 编辑模式加载文件:', res.dataBase64 ? res.dataBase64.length : 0, '字节, 辅助:', (res.auxFiles || []).length)
      buffer.value = base64ToUint8Array(res.dataBase64)
      auxFiles.value = res.auxFiles || []
      fileType.value = res.fileType

      if (m.cover) {
        const img = await window.api.models.readImage(String(m.id), true, false)
        coverPreview.value = img || ''
      }
    } catch (e) {
      errorMsg.value = e.message || '加载模型失败'
      showToast(errorMsg.value, 'error')
      console.error('[Upload] 编辑模式加载失败:', e)
    } finally {
      loadingModel.value = false
    }
  }
})
</script>

<template>
  <div class="upload">
    <header class="topbar">
      <el-button text @click="handleBack"><i class="iconfont icon-chevron-left"></i> 返回</el-button>
      <span class="title">{{ isEdit ? '编辑模型' : '上传模型' }}</span>
      <div class="topbar-actions">
        <el-button
          :disabled="!buffer || exporting"
          :loading="exporting"
          @click="handleExport"
          title="导出模型到指定位置"
        >
          <i class="iconfont icon-cloud-download"></i>
          {{ exporting ? '导出中...' : '导出模型' }}
        </el-button>
        <el-button
          v-if="isEdit"
          type="danger"
          plain
          @click="handleDelete"
        >
          <i class="iconfont icon-trash-alt"></i>
          删除模型
        </el-button>
        <el-button type="primary" :loading="saving" :disabled="!buffer" @click="handleSave">
          {{ saving ? '保存中...' : '保存' }}
        </el-button>
      </div>
    </header>

    <div class="body">
      <div class="viewer-panel">
        <div class="viewer-container">
          <ModelViewer
            v-if="buffer"
            ref="viewerRef"
            :buffer="buffer"
            :file-type="fileType"
            :view-params="initialViewParams"
            :aux-files="auxFiles"
            @loaded="onModelLoaded"
          />
          <div v-else-if="loadingModel" class="viewer-loading">
            <i class="iconfont icon-sync is-loading loading-icon"></i>
            <p>加载模型中...</p>
          </div>
          <div v-else class="viewer-empty" @click="selectFile">
            <el-empty description="点击选择 3D 模型文件">
              <p class="formats">支持 GLB / GLTF / OBJ / STL / JSON / FBX</p>
            </el-empty>
          </div>
        </div>
        <div class="viewer-tools" v-if="buffer">
          <el-button @click="saveCover"><i class="iconfont icon-image"></i> 保存封面</el-button>
          <el-button text @click="resetView"><i class="iconfont icon-scale"></i> 重置视角</el-button>
          <div class="status">
            <span :class="['dot', coverSaved ? 'on' : '']"></span> 封面已保存
          </div>
        </div>
        <p class="tip">拖拽旋转 · 滚轮缩放 · 右键平移，调整到满意视角后点击「保存封面」</p>
      </div>

      <div class="form-panel">
        <div v-if="loadingModel" class="form-loading">
          <i class="iconfont icon-cloud-upload is-loading loading-icon-sm"></i>
          <p>加载模型中...</p>
        </div>
        <div v-else-if="!isEdit && !buffer" class="form-empty">
          <el-button type="primary" size="large" :loading="loadingModel" @click="selectFile">
            {{ loadingModel ? '处理中...' : '选择模型文件' }}
          </el-button>
        </div>

        <template v-else>
          <el-form label-position="top" class="upload-form">
            <el-form-item label="模型名称" required>
              <el-input v-model="name" placeholder="请输入模型名称" />
            </el-form-item>

            <el-form-item label="简介">
              <el-input
                v-model="description"
                type="textarea"
                :rows="3"
                placeholder="描述模型用途、特点等"
              />
            </el-form-item>

            <el-form-item label="标签">
              <TagInput v-model="tags" :pool="state.tags" />
            </el-form-item>

            <el-form-item label="封面预览">
              <div class="cover-preview">
                <img v-if="coverPreview" :src="coverPreview" alt="封面" />
                <div v-else class="cover-placeholder">
                  <span>{{ coverSaved ? '加载中...' : '调整视角后点击「保存封面」' }}</span>
                </div>
              </div>
            </el-form-item>

            <el-form-item v-if="fileInfo">
              <el-descriptions :column="1" border size="small" class="info-block">
                <el-descriptions-item label="文件名">{{ fileInfo.fileName }}</el-descriptions-item>
                <el-descriptions-item label="格式">{{ (fileInfo.fileType || '').toUpperCase() }}</el-descriptions-item>
                <el-descriptions-item label="文件大小">{{ formatSize(fileInfo.fileSize) }}</el-descriptions-item>
                <el-descriptions-item label="尺寸 (W×H×D)">
                  {{ dimensions.x }} × {{ dimensions.y }} × {{ dimensions.z }}
                </el-descriptions-item>
                <el-descriptions-item label="上传时间">
                  {{ fileInfo.uploadTime?.slice(0, 19).replace('T', ' ') }}
                </el-descriptions-item>
              </el-descriptions>
            </el-form-item>

            <el-form-item v-if="fileInfo" class="files-section">
              <template #label>
                <span class="label-text">关联文件 ({{ allFiles.length }})</span>
              </template>
              <div class="aux-buttons">
                <el-button v-if="canAddMTL" size="small" @click="addAuxFile('mtl')">+ MTL 材质</el-button>
                <el-button v-if="canAddTexture" size="small" @click="addAuxFile('texture')">+ 贴图</el-button>
                <el-button v-if="canAddAnimation" size="small" @click="addAuxFile('animation')">+ 动画</el-button>
                <el-button v-if="canAddBin" size="small" @click="addAuxFile('bin')">+ .bin</el-button>
              </div>
              <ul class="file-list">
                <li v-for="f in allFiles" :key="f.name" class="file-item">
                  <el-tag :type="roleTagType(f.role)" size="small" class="file-role">
                    {{ roleLabel(f.role) }}
                  </el-tag>
                  <span class="file-name" :title="f.name">{{ f.name }}</span>
                  <span class="file-size">{{ formatSize(f.size) }}</span>
                  <el-button
                    v-if="f.role !== 'main'"
                    circle
                    size="small"
                    text
                    @click="removeAuxFile(f.name)"
                    title="删除"
                  >
                    <i class="iconfont icon-close"></i>
                  </el-button>
                </li>
              </ul>
            </el-form-item>
          </el-form>

          <el-alert
            v-if="errorMsg"
            :title="errorMsg"
            type="error"
            show-icon
            :closable="false"
            class="error-alert"
          />
        </template>
      </div>
    </div>

    <!-- 保存中全屏蒙版 -->
    <div v-if="saving" class="saving-mask">
      <div class="saving-content">
        <i class="iconfont icon-movie saving-spinner"></i>
        <p class="saving-text">保存中...</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.upload {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 24px;
  border-bottom: 1px solid var(--border-soft);
  flex-shrink: 0;
}
.title {
  font-size: 15px;
  font-weight: 600;
  flex: 1;
}
.topbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.body {
  flex: 1;
  display: flex;
  overflow: hidden;
}
.viewer-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
  min-width: 0;
}
.viewer-container {
  flex: 1;
  min-height: 0;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius);
  overflow: hidden;
}
.viewer-empty {
  width: 100%;
  height: 100%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.viewer-loading,
.form-loading {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: var(--text-3);
  font-size: 13px;
}
.form-loading {
  gap: 10px;
}
.loading-icon {
  font-size: 36px;
  animation: spin 1s linear infinite;
  color: var(--el-color-primary);
}
.loading-icon-sm {
  font-size: 24px;
  animation: spin 1s linear infinite;
  color: var(--el-color-primary);
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.formats {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 8px;
}
.viewer-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
}
.status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-3);
  margin-left: auto;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border);
}
.dot.on {
  background: var(--success);
}
.tip {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 8px;
}
.form-panel {
  width: 340px;
  flex-shrink: 0;
  padding: 20px;
  border-left: 1px solid var(--border-soft);
  overflow-y: auto;
}
.form-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
.upload-form {
  width: 100%;
}
.cover-preview {
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: var(--radius-sm);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cover-preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.cover-placeholder {
  color: var(--text-3);
  font-size: 12px;
  text-align: center;
  padding: 8px;
}
.info-block {
  width: 100%;
}
.files-section :deep(.el-form-item__content) {
  flex-direction: column;
  align-items: stretch;
}
.aux-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.file-list {
  max-height: 180px;
  overflow-y: auto;
  border-radius: var(--radius-sm);
  width: 100%;
}
.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  font-size: 12px;
  border-bottom: 1px solid var(--border-soft);
}
.file-item:last-child {
  border-bottom: none;
}
.file-role {
  flex-shrink: 0;
}
.file-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-size {
  flex-shrink: 0;
  color: var(--text-3);
  font-size: 11px;
}
.error-alert {
  margin-top: 8px;
}
.saving-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
}
.saving-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #fff;
}
.saving-spinner {
  font-size: 48px;
  animation: spin 1s linear infinite;
}
.saving-text {
  font-size: 16px;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
