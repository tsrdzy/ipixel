<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'

const inputImages = ref([])
const outputImages = ref([])
const compressionLevel = ref(80)
const isCompressing = ref(false)

const compressionOptions = [
  { value: 100, label: '无损 (100%)' },
  { value: 90, label: '高质量 (90%)' },
  { value: 80, label: '标准 (80%)' },
  { value: 70, label: '中质量 (70%)' },
  { value: 60, label: '低质量 (60%)' },
  { value: 50, label: '压缩 (50%)' }
]

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

function handleFileSelect(e) {
  const files = e.target.files
  if (!files || files.length === 0) return

  Array.from(files).forEach(file => {
    const reader = new FileReader()
    reader.onload = (ev) => {
      inputImages.value.push({
        id: Date.now() + Math.random(),
        file,
        name: file.name,
        size: file.size,
        originalSize: file.size,
        preview: ev.target.result
      })
    }
    reader.readAsDataURL(file)
  })

  e.target.value = ''
}

function removeInputImage(index) {
  inputImages.value.splice(index, 1)
}

function removeOutputImage(index) {
  outputImages.value.splice(index, 1)
}

async function compressImages() {
  if (inputImages.value.length === 0) {
    ElMessage.warning('请先选择要压缩的图片')
    return
  }

  isCompressing.value = true
  outputImages.value = []

  for (const img of inputImages.value) {
    try {
      const compressed = await compressImage(img.file, compressionLevel.value)
      outputImages.value.push({
        id: Date.now() + Math.random(),
        name: 'compressed_' + img.name,
        originalSize: img.size,
        compressedSize: compressed.size,
        preview: compressed.dataUrl,
        blob: compressed.blob,
        compressionRatio: ((1 - compressed.size / img.size) * 100).toFixed(1)
      })
    } catch (e) {
      console.error('压缩失败:', e)
      ElMessage.error('压缩图片失败: ' + e.message)
    }
  }

  isCompressing.value = false
  ElMessage.success(`成功压缩 ${outputImages.value.length} 张图片`)
}

async function compressImage(file, quality) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      canvas.toBlob((blob) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          resolve({
            blob,
            size: blob.size,
            dataUrl: e.target.result
          })
        }
        reader.readAsDataURL(blob)
      }, 'image/jpeg', quality / 100)
    }
    img.src = URL.createObjectURL(file)
  })
}

async function exportToLocal() {
  if (outputImages.value.length === 0) {
    ElMessage.warning('没有可导出的压缩图片')
    return
  }

  for (const img of outputImages.value) {
    const url = URL.createObjectURL(img.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = img.name.replace(/\.[^.]+$/, '_compressed.jpg')
    a.click()
    URL.revokeObjectURL(url)
  }

  ElMessage.success('已导出到本地')
}

async function importToLibrary() {
  if (outputImages.value.length === 0) {
    ElMessage.warning('没有可导入的压缩图片')
    return
  }

  let successCount = 0
  for (const img of outputImages.value) {
    try {
      const buffer = await img.blob.arrayBuffer()
      const result = await window.api.images.importBuffer(img.name.replace(/\.[^.]+$/, '.jpg'), buffer)
      if (!result.duplicate) {
        successCount++
      }
    } catch (e) {
      console.error('导入失败:', e)
    }
  }

  if (successCount > 0) {
    ElMessage.success(`成功导入 ${successCount} 张图片到资源库`)
  } else {
    ElMessage.error('导入失败')
  }
}

const totalOriginalSize = computed(() => {
  return inputImages.value.reduce((sum, img) => sum + img.size, 0)
})

const totalCompressedSize = computed(() => {
  return outputImages.value.reduce((sum, img) => sum + img.compressedSize, 0)
})
</script>

<template>
  <div class="compress-tool">
    <div class="compress-header">
      <div class="compression-settings">
        <label>压缩质量:</label>
        <el-select v-model="compressionLevel" style="width: 160px;" placeholder="选择压缩质量">
          <el-option v-for="opt in compressionOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
      </div>
      <el-button type="primary" @click="compressImages" :loading="isCompressing">
        开始压缩
      </el-button>
    </div>
    <div class="compress-tip">
      <span class="iconfont" style="margin-right: 4px;">&#xe63d;</span>
      提示：如果图片原始尺寸过小（小于10KB），压缩后可能会因格式转换等原因导致文件体积变大
    </div>

    <div class="compress-body">
      <div class="compress-panel">
        <div class="panel-header">
          <h3>原始图片</h3>
          <span class="size-info">共 {{ inputImages.length }} 张，总大小 {{ formatSize(totalOriginalSize) }}</span>
        </div>
        <div class="panel-content">
          <div v-if="inputImages.length === 0" class="drop-area" @click="$refs.fileInput.click()">
            <span class="iconfont" style="font-size: 48px;">&#xeb24;</span>
            <p>点击或拖拽上传图片</p>
            <p class="hint">支持 PNG、JPG、WebP 等格式</p>
            <input ref="fileInput" type="file" multiple accept="image/*" @change="handleFileSelect" style="display: none;" />
          </div>
          <div v-else class="image-list">
            <div v-for="(img, index) in inputImages" :key="img.id" class="image-item">
              <img :src="img.preview" :alt="img.name" class="image-preview" />
              <div class="image-info">
                <span class="image-name">{{ img.name }}</span>
                <span class="image-size">{{ formatSize(img.size) }}</span>
              </div>
              <button class="remove-btn" @click="removeInputImage(index)">
                <span class="iconfont">&#xe782;</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="compress-panel">
        <div class="panel-header">
          <h3>压缩结果</h3>
          <span class="size-info">共 {{ outputImages.length }} 张，总大小 {{ formatSize(totalCompressedSize) }}</span>
        </div>
        <div class="panel-content">
          <div v-if="outputImages.length === 0" class="empty-result">
            <span class="iconfont" style="font-size: 48px;">&#xe616;</span>
            <p>压缩后的图片将显示在这里</p>
          </div>
          <div v-else class="image-list">
            <div v-for="(img, index) in outputImages" :key="img.id" class="image-item">
              <img :src="img.preview" :alt="img.name" class="image-preview" />
              <div class="image-info">
                <span class="image-name">{{ img.name }}</span>
                <div class="compression-info">
                  <span>{{ formatSize(img.originalSize) }} → {{ formatSize(img.compressedSize) }}</span>
                  <span class="ratio" :class="img.compressionRatio > 50 ? 'high' : 'low'">-{{ img.compressionRatio }}%</span>
                </div>
              </div>
              <button class="remove-btn" @click="removeOutputImage(index)">
                <span class="iconfont">&#xe782;</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="compress-footer" v-if="outputImages.length > 0">
      <el-button @click="exportToLocal">导出到本地</el-button>
      <el-button type="primary" @click="importToLibrary">导入到图片资源库</el-button>
    </div>
  </div>
</template>

<style scoped>
.compress-tool {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.compress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-soft);
}

.compression-settings {
  display: flex;
  align-items: center;
  gap: 12px;
}

.compression-settings label {
  font-size: 14px;
  color: var(--text-1);
}

.compress-tip {
  display: flex;
  align-items: center;
  padding: 8px 24px;
  background: var(--bg-mute);
  border-bottom: 1px solid var(--border-soft);
  font-size: 12px;
  color: var(--text-3);
}

.compress-body {
  flex: 1;
  display: flex;
  gap: 16px;
  padding: 16px;
  overflow: hidden;
}

.compress-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-soft);
  border-radius: var(--radius);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-soft);
}

.panel-header h3 {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  color: var(--text-1);
}

.size-info {
  font-size: 12px;
  color: var(--text-3);
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.drop-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  border: 2px dashed var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  color: var(--text-3);
  transition: all 0.2s;
}

.drop-area:hover {
  border-color: var(--primary);
  background: var(--bg-hover);
}

.drop-area p {
  margin: 8px 0 0 0;
  font-size: 14px;
}

.drop-area .hint {
  font-size: 12px;
  color: var(--text-4);
}

.image-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.image-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg);
  border-radius: var(--radius-sm);
  position: relative;
}

.image-preview {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: var(--radius-xs);
}

.image-info {
  flex: 1;
  min-width: 0;
}

.image-name {
  display: block;
  font-size: 13px;
  color: var(--text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.image-size {
  font-size: 12px;
  color: var(--text-3);
}

.compression-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.compression-info span {
  font-size: 12px;
  color: var(--text-3);
}

.compression-info .ratio {
  font-weight: 600;
}

.compression-info .ratio.high {
  color: #67c23a;
}

.compression-info .ratio.low {
  color: var(--text-3);
}

.remove-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--text-4);
  border-radius: var(--radius-xs);
  transition: all 0.15s;
}

.remove-btn:hover {
  background: var(--bg-mute);
  color: var(--text-2);
}

.empty-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--text-4);
}

.empty-result p {
  margin: 8px 0 0 0;
  font-size: 13px;
}

.compress-footer {
  display: flex;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--border-soft);
  justify-content: flex-end;
}
</style>