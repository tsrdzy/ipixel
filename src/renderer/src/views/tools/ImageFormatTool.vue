<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

const inputImages = ref([])
const outputImages = ref([])
const targetFormat = ref('png')
const isConverting = ref(false)

const formatOptions = [
  { value: 'png', label: 'PNG', desc: '无损压缩，支持透明' },
  { value: 'jpg', label: 'JPG', desc: '有损压缩，体积小' },
  { value: 'bmp', label: 'BMP', desc: '无压缩，体积大' },
  { value: 'gif', label: 'GIF', desc: '支持动画' },
  { value: 'tiff', label: 'TIFF', desc: '高精度，专业格式' }
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
        preview: ev.target.result,
        originalFormat: file.name.split('.').pop().toLowerCase()
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

async function convertFormat() {
  if (inputImages.value.length === 0) {
    ElMessage.warning('请先选择要转换的图片')
    return
  }

  if (!window.api || !window.api.tools) {
    ElMessage.error('API 未加载，请重启应用')
    return
  }

  isConverting.value = true
  outputImages.value = []

  for (const img of inputImages.value) {
    try {
      const buffer = await img.file.arrayBuffer()
      const result = await window.api.tools.convertImageFormat(buffer, targetFormat.value)

      const blob = new Blob([result.buffer], { type: result.mimeType })
      const reader = new FileReader()
      const dataUrl = await new Promise(resolve => {
        reader.onload = (e) => resolve(e.target.result)
        reader.readAsDataURL(blob)
      })

      outputImages.value.push({
        id: Date.now() + Math.random(),
        name: img.name.replace(/\.[^.]+$/, '.' + targetFormat.value),
        originalSize: img.size,
        convertedSize: blob.size,
        preview: dataUrl,
        blob,
        buffer: result.buffer,
        originalFormat: img.originalFormat,
        targetFormat: targetFormat.value
      })
    } catch (e) {
      console.error('格式转换失败:', e)
      ElMessage.error('转换图片失败: ' + e.message)
    }
  }

  isConverting.value = false
  ElMessage.success(`成功转换 ${outputImages.value.length} 张图片`)
}

async function exportToLocal() {
  if (outputImages.value.length === 0) {
    ElMessage.warning('没有可导出的图片')
    return
  }

  for (const img of outputImages.value) {
    const url = URL.createObjectURL(img.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = img.name
    a.click()
    URL.revokeObjectURL(url)
  }

  ElMessage.success('已导出到本地')
}

async function importToLibrary() {
  if (outputImages.value.length === 0) {
    ElMessage.warning('没有可导入的图片')
    return
  }

  let successCount = 0
  for (const img of outputImages.value) {
    try {
      const buffer = await img.blob.arrayBuffer()
      const result = await window.api.images.importBuffer(img.name, buffer)
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
</script>

<template>
  <div class="format-tool">
    <div class="format-header">
      <div class="format-settings">
        <label>目标格式:</label>
        <el-select v-model="targetFormat" style="width: 160px;" placeholder="选择格式">
          <el-option v-for="format in formatOptions" :key="format.value" :label="format.label" :value="format.value" :description="format.desc" />
        </el-select>
      </div>
      <el-button type="primary" @click="convertFormat" :loading="isConverting">
        开始转换
      </el-button>
    </div>

    <div class="format-body">
      <div class="format-panel">
        <div class="panel-header">
          <h3>原始图片</h3>
          <span class="size-info">共 {{ inputImages.length }} 张</span>
        </div>
        <div class="panel-content">
          <div v-if="inputImages.length === 0" class="drop-area" @click="$refs.fileInput.click()">
            <span class="iconfont" style="font-size: 48px;">&#xeb24;</span>
            <p>点击或拖拽上传图片</p>
            <p class="hint">支持 PNG、JPG、WebP、BMP 等格式</p>
            <input ref="fileInput" type="file" multiple accept="image/*" @change="handleFileSelect" style="display: none;" />
          </div>
          <div v-else class="image-list">
            <div v-for="(img, index) in inputImages" :key="img.id" class="image-item">
              <img :src="img.preview" :alt="img.name" class="image-preview" />
              <div class="image-info">
                <span class="image-name">{{ img.name }}</span>
                <div class="format-info">
                  <span>格式: {{ img.originalFormat.toUpperCase() }}</span>
                  <span>{{ formatSize(img.size) }}</span>
                </div>
              </div>
              <button class="remove-btn" @click="removeInputImage(index)">
                <span class="iconfont">&#xe782;</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="format-panel">
        <div class="panel-header">
          <h3>转换结果</h3>
          <span class="size-info">共 {{ outputImages.length }} 张</span>
        </div>
        <div class="panel-content">
          <div v-if="outputImages.length === 0" class="empty-result">
            <span class="iconfont" style="font-size: 48px;">&#xe616;</span>
            <p>转换后的图片将显示在这里</p>
          </div>
          <div v-else class="image-list">
            <div v-for="(img, index) in outputImages" :key="img.id" class="image-item">
              <img :src="img.preview" :alt="img.name" class="image-preview" />
              <div class="image-info">
                <span class="image-name">{{ img.name }}</span>
                <div class="format-info">
                  <span>{{ img.originalFormat.toUpperCase() }} → {{ img.targetFormat.toUpperCase() }}</span>
                  <span>{{ formatSize(img.originalSize) }} → {{ formatSize(img.convertedSize) }}</span>
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

    <div class="format-footer" v-if="outputImages.length > 0">
      <el-button @click="exportToLocal">导出到本地</el-button>
      <el-button type="primary" @click="importToLibrary">导入到图片资源库</el-button>
    </div>
  </div>
</template>

<style scoped>
.format-tool {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.format-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-soft);
}

.format-settings {
  display: flex;
  align-items: center;
  gap: 12px;
}

.format-settings label {
  font-size: 14px;
  color: var(--text-1);
}

.format-body {
  flex: 1;
  display: flex;
  gap: 16px;
  padding: 16px;
  overflow: hidden;
}

.format-panel {
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

.format-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.format-info span {
  font-size: 12px;
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

.format-footer {
  display: flex;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--border-soft);
  justify-content: flex-end;
}
</style>