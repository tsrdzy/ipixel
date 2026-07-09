<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

const inputImages = ref([])
const outputIcons = ref([])
const isConverting = ref(false)

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

function removeOutputIcon(index) {
  outputIcons.value.splice(index, 1)
}

async function convertToIco() {
  if (inputImages.value.length === 0) {
    ElMessage.warning('请先选择要转换的图片')
    return
  }

  if (!window.api || !window.api.tools) {
    ElMessage.error('API 未加载，请重启应用')
    return
  }

  isConverting.value = true
  outputIcons.value = []

  for (const img of inputImages.value) {
    try {
      const arrayBuffer = await img.file.arrayBuffer()
      const icoBuffer = await window.api.tools.convertToIco(arrayBuffer)
      
      const icoBlob = new Blob([icoBuffer], { type: 'image/x-icon' })
      const reader = new FileReader()
      const dataUrl = await new Promise(resolve => {
        reader.onload = (e) => resolve(e.target.result)
        reader.readAsDataURL(icoBlob)
      })

      outputIcons.value.push({
        id: Date.now() + Math.random(),
        name: img.name.replace(/\.[^.]+$/, '.ico'),
        originalSize: img.size,
        icoSize: icoBlob.size,
        preview: dataUrl,
        blob: icoBlob,
        buffer: icoBuffer
      })
    } catch (e) {
      console.error('转换失败:', e)
      ElMessage.error('转换图片失败: ' + e.message)
    }
  }

  isConverting.value = false
  ElMessage.success(`成功转换 ${outputIcons.value.length} 张图片`)
}

async function exportToLocal() {
  if (outputIcons.value.length === 0) {
    ElMessage.warning('没有可导出的ICO图标')
    return
  }

  for (const icon of outputIcons.value) {
    const url = URL.createObjectURL(icon.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = icon.name
    a.click()
    URL.revokeObjectURL(url)
  }

  ElMessage.success('已导出到本地')
}

async function importToLibrary() {
  if (outputIcons.value.length === 0) {
    ElMessage.warning('没有可导入的ICO图标')
    return
  }

  let successCount = 0
  for (const icon of outputIcons.value) {
    try {
      const buffer = await icon.blob.arrayBuffer()
      const result = await window.api.images.importBuffer(icon.name, buffer)
      if (!result.duplicate) {
        successCount++
      }
    } catch (e) {
      console.error('导入失败:', e)
    }
  }

  if (successCount > 0) {
    ElMessage.success(`成功导入 ${successCount} 个图标到资源库`)
  } else {
    ElMessage.error('导入失败')
  }
}
</script>

<template>
  <div class="ico-tool">
    <div class="ico-header">
      <div class="tool-info">
        <h3>ICO 图标生成器</h3>
        <p>将图片转换为 ICO 格式，支持导入和导出</p>
      </div>
      <el-button type="primary" @click="convertToIco" :loading="isConverting">
        开始转换
      </el-button>
    </div>

    <div class="ico-body">
      <div class="ico-panel">
        <div class="panel-header">
          <h3>原始图片</h3>
          <span class="size-info">共 {{ inputImages.length }} 张</span>
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

      <div class="ico-panel">
        <div class="panel-header">
          <h3>ICO 图标</h3>
          <span class="size-info">共 {{ outputIcons.length }} 个</span>
        </div>
        <div class="panel-content">
          <div v-if="outputIcons.length === 0" class="empty-result">
            <span class="iconfont" style="font-size: 48px;">&#xe616;</span>
            <p>转换后的 ICO 将显示在这里</p>
          </div>
          <div v-else class="image-list">
            <div v-for="(icon, index) in outputIcons" :key="icon.id" class="image-item">
              <img :src="icon.preview" :alt="icon.name" class="image-preview" />
              <div class="image-info">
                <span class="image-name">{{ icon.name }}</span>
                <div class="conversion-info">
                  <span>原图: {{ formatSize(icon.originalSize) }}</span>
                  <span>ICO: {{ formatSize(icon.icoSize) }}</span>
                </div>
              </div>
              <button class="remove-btn" @click="removeOutputIcon(index)">
                <span class="iconfont">&#xe782;</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="ico-footer" v-if="outputIcons.length > 0">
      <el-button @click="exportToLocal">导出到本地</el-button>
      <el-button type="primary" @click="importToLibrary">导入到图片资源库</el-button>
    </div>
  </div>
</template>

<style scoped>
.ico-tool {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.ico-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-soft);
}

.tool-info h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 4px 0;
  color: var(--text-1);
}

.tool-info p {
  font-size: 13px;
  color: var(--text-3);
  margin: 0;
}

.ico-body {
  flex: 1;
  display: flex;
  gap: 16px;
  padding: 16px;
  overflow: hidden;
}

.ico-panel {
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

.conversion-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.conversion-info span {
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

.ico-footer {
  display: flex;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--border-soft);
  justify-content: flex-end;
}
</style>