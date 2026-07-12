<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElCard, ElButton, ElInputNumber, ElEmpty } from 'element-plus'
import GIF from 'gif.js'
import gifWorkerUrl from 'gif.js/dist/gif.worker.js?url'
import { saveAs } from 'file-saver'

const { t } = useI18n()

const images = ref([])
const gifWidth = ref(0)
const gifHeight = ref(0)
const frameInterval = ref(100)
const quality = ref(10)
const generatedGif = ref('')
const isGenerating = ref(false)
const currentFrameIndex = ref(-1)
const draggingIndex = ref(-1)

const fileInputRef = ref(null)

const hasImages = computed(() => images.value.length > 0)
const hasResult = computed(() => generatedGif.value)

function clickGetImages() {
  fileInputRef.value?.click()
}

function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      resolve(e.target.result)
    }
    reader.readAsDataURL(file)
  })
}

function getImageDimensions(base64) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.width, height: img.height })
      URL.revokeObjectURL(base64)
    }
    img.src = base64
  })
}

async function onFileChange(e) {
  const files = e.target.files
  if (!files || files.length === 0) return

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const base64 = await fileToBase64(file)
      const dims = await getImageDimensions(base64)
      images.value.push({
        id: Date.now() + i,
        name: file.name,
        src: base64,
        width: dims.width,
        height: dims.height
      })
    }

    if (images.value.length > 0 && gifWidth.value === 0) {
      gifWidth.value = images.value[0].width
      gifHeight.value = images.value[0].height
    }
  } catch (err) {
    console.error('选择图片失败:', err)
    ElMessage.error(t('common.failed'))
  } finally {
    e.target.value = ''
  }
}

function removeImage(index) {
  images.value.splice(index, 1)
  if (images.value.length === 0) {
    generatedGif.value = ''
    gifWidth.value = 0
    gifHeight.value = 0
  }
}

function moveImage(fromIndex, toIndex) {
  const item = images.value.splice(fromIndex, 1)[0]
  images.value.splice(toIndex, 0, item)
}

function handleDragStart(index) {
  draggingIndex.value = index
}

function handleDragOver(e, index) {
  e.preventDefault()
  if (draggingIndex.value === -1 || draggingIndex.value === index) return
  moveImage(draggingIndex.value, index)
  draggingIndex.value = index
}

function handleDragEnd() {
  draggingIndex.value = -1
}

async function generateGif() {
  if (!hasImages.value) {
    ElMessage.warning(t('tools.noImages'))
    return
  }
  if (gifWidth.value < 50 || gifHeight.value < 50) {
    ElMessage.warning('尺寸过小，请设置至少50px')
    return
  }

  isGenerating.value = true
  generatedGif.value = ''

  try {
    const gif = new GIF({
      workers: 2,
      quality: quality.value,
      workerScript: gifWorkerUrl,
      width: gifWidth.value,
      height: gifHeight.value
    })

    for (const img of images.value) {
      const image = await loadImage(img.src)
      const canvas = document.createElement('canvas')
      canvas.width = gifWidth.value
      canvas.height = gifHeight.value
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, gifWidth.value, gifHeight.value)

      const scale = Math.min(gifWidth.value / img.width, gifHeight.value / img.height)
      const x = (gifWidth.value - img.width * scale) / 2
      const y = (gifHeight.value - img.height * scale) / 2
      ctx.drawImage(image, x, y, img.width * scale, img.height * scale)

      gif.addFrame(canvas, { delay: frameInterval.value, copy: true })
    }

    gif.on('finished', (blob) => {
      generatedGif.value = URL.createObjectURL(blob)
      isGenerating.value = false
      ElMessage.success('GIF生成成功')
    })

    gif.render()
  } catch (e) {
    console.error('生成GIF失败:', e)
    ElMessage.error('生成GIF失败')
    isGenerating.value = false
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function downloadGif() {
  if (!generatedGif.value) return
  const link = document.createElement('a')
  link.href = generatedGif.value
  link.download = `gif_${Date.now()}.gif`
  link.click()
  ElMessage.success(t('common.download') + t('common.ok'))
}

async function saveToLibrary() {
  if (!generatedGif.value) return

  try {
    const response = await fetch(generatedGif.value)
    const blob = await response.blob()
    const arrayBuffer = await blob.arrayBuffer()
    const base64 = btoa(
      String.fromCharCode(...new Uint8Array(arrayBuffer))
    )

    await window.api.images.saveSplitResult({
      name: `gif_${Date.now()}.gif`,
      base64
    })
    ElMessage.success(t('tools.exportResources'))
  } catch (e) {
    console.error('保存到资源库失败:', e)
    ElMessage.error('保存到资源库失败')
  }
}

function clearAll() {
  images.value = []
  generatedGif.value = ''
  gifWidth.value = 0
  gifHeight.value = 0
}
</script>

<template>
  <div class="gif-generator-tool">
    <input
      ref="fileInputRef"
      type="file"
      accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/bmp"
      multiple
      style="display: none"
      @change="onFileChange"
    />
    <div class="tool-body">
      <div class="split-section">
        <ElCard class="upload-card">
          <template #header>
            <span>{{ t('tools.selectImages') }}</span>
            <span class="image-count">({{ images.length }})</span>
          </template>
          <div class="upload-area">
            <div v-if="!hasImages" @click="clickGetImages" class="upload-placeholder">
              <span class="upload-icon">+</span>
              <span class="upload-text">{{ t('tools.clickSelect') }}</span>
            </div>
            <div v-else class="image-list">
              <div
                v-for="(img, index) in images"
                :key="img.id"
                class="image-item"
                :class="{ 'is-dragging': draggingIndex === index }"
                draggable="true"
                @dragstart="handleDragStart(index)"
                @dragover="(e) => handleDragOver(e, index)"
                @dragend="handleDragEnd"
                @click="currentFrameIndex = index"
              >
                <img :src="img.src" :alt="img.name" class="image-thumb" />
                <span class="frame-number">{{ index + 1 }}</span>
                <div class="image-delete" @click.stop="removeImage(index)">
                  <i class="iconfont">&#xeb6c;</i>
                </div>
                <div v-if="currentFrameIndex === index" class="current-frame-indicator"></div>
              </div>
            </div>
          </div>
          <div v-if="hasImages" class="upload-actions">
            <ElButton size="small" @click="clickGetImages">+ {{ t('common.add') }}{{ t('common.files') }}</ElButton>
            <ElButton size="small" type="danger" @click="clearAll">{{ t('tools.clear') }}</ElButton>
          </div>
        </ElCard>

        <ElCard class="options-card">
          <template #header>
            <span>{{ t('tools.gifSettings') }}</span>
          </template>
          <div class="options-content">
            <div class="options-grid">
              <div class="option-item">
                <span class="option-label">{{ t('tools.width') }}</span>
                <ElInputNumber
                  controls-position="right"
                  style="width: 100%"
                  v-model="gifWidth"
                  :min="50"
                  :max="2000"
                  :step="10"
                >
                  <template #suffix><span>px</span></template>
                </ElInputNumber>
              </div>
              <div class="option-item">
                <span class="option-label">{{ t('tools.height') }}</span>
                <ElInputNumber
                  controls-position="right"
                  style="width: 100%"
                  v-model="gifHeight"
                  :min="50"
                  :max="2000"
                  :step="10"
                >
                  <template #suffix><span>px</span></template>
                </ElInputNumber>
              </div>
              <div class="option-item">
                <span class="option-label">{{ t('tools.frameInterval') }}</span>
                <ElInputNumber
                  controls-position="right"
                  style="width: 100%"
                  v-model="frameInterval"
                  :min="10"
                  :max="1000"
                  :step="10"
                >
                  <template #suffix><span>ms</span></template>
                </ElInputNumber>
              </div>
              <div class="option-item">
                <span class="option-label">{{ t('tools.quality') }}</span>
                <ElInputNumber
                  controls-position="right"
                  style="width: 100%"
                  v-model="quality"
                  :min="1"
                  :max="20"
                  :step="1"
                >
                  <template #suffix><span></span></template>
                </ElInputNumber>
              </div>
            </div>
            <div class="generate-btn-container">
              <ElButton type="primary" style="width: 100%" :loading="isGenerating" @click="generateGif">
                {{ isGenerating ? t('common.processing') : t('tools.generate') }}
              </ElButton>
            </div>
          </div>
        </ElCard>
      </div>

      <ElCard class="result-card">
        <template #header>
          <div class="result-header">
            <span>{{ t('tools.gifPreview') }}</span>
            <div class="result-actions" v-if="hasResult">
              <ElButton size="small" @click="downloadGif">
                {{ t('tools.exportLocal') }}
              </ElButton>
              <ElButton size="small" type="primary" @click="saveToLibrary">
                {{ t('tools.exportResources') }}
              </ElButton>
            </div>
          </div>
        </template>
        <div class="result-content">
          <div v-if="hasResult" class="gif-preview-container">
            <img :src="generatedGif" class="gif-preview" alt="Generated GIF" />
          </div>
          <div v-else class="result-empty">
            <ElEmpty :description="t('tools.noResult')" />
          </div>
        </div>
      </ElCard>
    </div>
  </div>
</template>

<style scoped>
.gif-generator-tool {
  display: flex;
  flex-direction: column;
  max-height: 75vh;
  background: var(--bg);
}

.tool-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.split-section {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.upload-card {
  flex: 1;
  max-width: 400px;
}

.options-card {
  flex: 1;
  min-width: 300px;
}

.upload-area {
  display: flex;
  justify-content: center;
}

.upload-placeholder {
  width: 300px;
  height: 300px;
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.upload-placeholder:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.upload-icon {
  font-size: 48px;
  margin-bottom: 8px;
}

.upload-text {
  font-size: 14px;
  color: var(--text-3);
}

.image-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
  width: 100%;
}

.image-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  background: var(--bg-soft);
  border-radius: var(--radius-sm);
  cursor: move;
  border: 2px solid transparent;
  position: relative;
  transition: all 0.2s;
}

.image-item:hover {
  background: var(--bg-hover);
  border-color: var(--border);
}

.image-item.is-dragging {
  opacity: 0.5;
  border-color: var(--primary);
}

.image-item:last-child {
  margin-bottom: 0;
}

.image-thumb {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: var(--radius-sm);
}

.frame-number {
  font-size: 12px;
  color: var(--text-3);
  font-weight: 600;
  background: var(--border);
  padding: 4px 8px;
  border-radius: 4px;
}

.image-delete {
  margin-left: auto;
  padding: 4px;
  opacity: 0;
  transition: opacity 0.2s;
  cursor: pointer;
  color: var(--danger);
}

.image-item:hover .image-delete {
  opacity: 1;
}

.current-frame-indicator {
  position: absolute;
  top: 4px;
  left: 4px;
  width: 8px;
  height: 8px;
  background: var(--primary);
  border-radius: 50%;
}

.upload-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  justify-content: flex-end;
}

.options-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 12px;
}

.options-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.option-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.option-label {
  font-size: 13px;
  color: var(--text-2);
}

.generate-btn-container {
  margin-top: auto;
}

.result-card {
  width: 100%;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.result-actions {
  display: flex;
  gap: 8px;
}

.result-content {
  display: flex;
  justify-content: center;
  padding: 20px;
}

.gif-preview-container {
  background: var(--bg-soft);
  border-radius: var(--radius);
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gif-preview {
  max-width: 100%;
  max-height: 400px;
  border-radius: var(--radius-sm);
}

.result-empty {
  width: 100%;
}

.image-count {
  font-size: 12px;
  color: var(--text-3);
}

@media (max-width: 768px) {
  .split-section {
    flex-direction: column;
  }

  .upload-card,
  .options-card {
    max-width: 100%;
  }

  .options-grid {
    grid-template-columns: 1fr;
  }
}
</style>