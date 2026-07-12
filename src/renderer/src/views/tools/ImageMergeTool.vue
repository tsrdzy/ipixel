<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElCard, ElInputNumber, ElColorPicker, ElButton, ElText, ElSelect, ElOption } from 'element-plus'
import { saveAs } from 'file-saver'

const { t } = useI18n()

const images = ref([])
const mergeMode = ref('horizontal')
const margin = ref(0)
const rowGap = ref(0)
const colGap = ref(0)
const bgColor = ref('#ffffff')
const gridCols = ref(2)
const outputWidth = ref(0)
const outputHeight = ref(0)

const mergeResult = ref('')

const fileInputRef = ref(null)

function clickGetImages() {
  fileInputRef.value?.click()
}

function onFileChange(event) {
  const files = Array.from(event.target.files)
  if (files.length === 0) return

  Promise.all(files.map(file => fileToBase64(file))).then(base64s => {
    base64s.forEach((base64, index) => {
      const img = new Image()
      img.onload = () => {
        images.value.push({
          id: Date.now() + index,
          base64,
          width: img.width,
          height: img.height,
          name: files[index].name
        })
      }
      img.src = base64
    })
    computeOutputSize()
  })

  event.target.value = ''
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

function removeImage(index) {
  images.value.splice(index, 1)
  computeOutputSize()
}

function moveImage(fromIndex, toIndex) {
  const item = images.value.splice(fromIndex, 1)[0]
  images.value.splice(toIndex, 0, item)
}

function computeOutputSize() {
  if (images.value.length === 0) {
    outputWidth.value = 0
    outputHeight.value = 0
    return
  }

  if (mergeMode.value === 'horizontal') {
    const totalWidth = images.value.reduce((sum, img) => sum + img.width, 0) + (images.value.length - 1) * colGap.value + margin.value * 2
    const maxHeight = Math.max(...images.value.map(img => img.height)) + margin.value * 2
    outputWidth.value = Math.round(totalWidth)
    outputHeight.value = Math.round(maxHeight)
  } else if (mergeMode.value === 'vertical') {
    const maxWidth = Math.max(...images.value.map(img => img.width)) + margin.value * 2
    const totalHeight = images.value.reduce((sum, img) => sum + img.height, 0) + (images.value.length - 1) * rowGap.value + margin.value * 2
    outputWidth.value = Math.round(maxWidth)
    outputHeight.value = Math.round(totalHeight)
  } else if (mergeMode.value === 'grid') {
    const cols = Math.min(gridCols.value, images.value.length)
    const rows = Math.ceil(images.value.length / cols)

    const colWidths = []
    for (let i = 0; i < cols; i++) {
      const colImages = []
      for (let j = 0; j < rows; j++) {
        const index = j * cols + i
        if (index < images.value.length) {
          colImages.push(images.value[index])
        }
      }
      colWidths.push(Math.max(...colImages.map(img => img.width)))
    }

    const rowHeights = []
    for (let i = 0; i < rows; i++) {
      const rowImages = images.value.slice(i * cols, (i + 1) * cols)
      rowHeights.push(Math.max(...rowImages.map(img => img.height)))
    }

    const totalWidth = colWidths.reduce((sum, w) => sum + w, 0) + (cols - 1) * colGap.value + margin.value * 2
    const totalHeight = rowHeights.reduce((sum, h) => sum + h, 0) + (rows - 1) * rowGap.value + margin.value * 2
    outputWidth.value = Math.round(totalWidth)
    outputHeight.value = Math.round(totalHeight)
  }
}

watch([mergeMode, margin, rowGap, colGap, gridCols], computeOutputSize)

function mergeImages() {
  if (images.value.length === 0) {
    ElMessage.warning(t('tools.noImages'))
    return
  }

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  computeOutputSize()
  canvas.width = outputWidth.value
  canvas.height = outputHeight.value

  ctx.fillStyle = bgColor.value
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  let x = margin.value
  let y = margin.value

  if (mergeMode.value === 'horizontal') {
    images.value.forEach((img, index) => {
      const imageObj = new Image()
      imageObj.src = img.base64
      ctx.drawImage(imageObj, x, y, img.width, img.height)
      x += img.width + colGap.value
    })
  } else if (mergeMode.value === 'vertical') {
    images.value.forEach((img, index) => {
      const imageObj = new Image()
      imageObj.src = img.base64
      ctx.drawImage(imageObj, x, y, img.width, img.height)
      y += img.height + rowGap.value
    })
  } else if (mergeMode.value === 'grid') {
    const cols = Math.min(gridCols.value, images.value.length)
    const rows = Math.ceil(images.value.length / cols)

    const colWidths = []
    for (let i = 0; i < cols; i++) {
      const colImages = []
      for (let j = 0; j < rows; j++) {
        const index = j * cols + i
        if (index < images.value.length) {
          colImages.push(images.value[index])
        }
      }
      colWidths.push(Math.max(...colImages.map(img => img.width)))
    }

    const rowHeights = []
    for (let i = 0; i < rows; i++) {
      const rowImages = images.value.slice(i * cols, (i + 1) * cols)
      rowHeights.push(Math.max(...rowImages.map(img => img.height)))
    }

    images.value.forEach((img, index) => {
      const col = index % cols
      const row = Math.floor(index / cols)

      const colX = margin.value + colWidths.slice(0, col).reduce((sum, w) => sum + w + colGap.value, 0)
      const rowY = margin.value + rowHeights.slice(0, row).reduce((sum, h) => sum + h + rowGap.value, 0)

      const imageObj = new Image()
      imageObj.src = img.base64
      ctx.drawImage(imageObj, colX, rowY, img.width, img.height)
    })
  }

  mergeResult.value = canvas.toDataURL('image/png')
}

function downloadResult() {
  if (!mergeResult.value) {
    ElMessage.warning(t('tools.noResult'))
    return
  }
  saveAs(mergeResult.value, `merged_${Date.now()}.png`)
}

function clearAll() {
  images.value = []
  mergeResult.value = ''
  outputWidth.value = 0
  outputHeight.value = 0
}

let draggedIndex = null

function onDragStart(index) {
  draggedIndex = index
}

function onDragOver(e, index) {
  e.preventDefault()
}

function onDrop(targetIndex) {
  if (draggedIndex !== null && draggedIndex !== targetIndex) {
    moveImage(draggedIndex, targetIndex)
  }
  draggedIndex = null
}

function onDragEnd() {
  draggedIndex = null
}
</script>

<template>
  <div class="tool-container">
    <input
      type="file"
      accept="image/*"
      multiple
      ref="fileInputRef"
      style="display: none"
      @change="onFileChange"
    />
    <div class="tool-body">
      <div class="main-content">
        <div class="left-panel">
          <ElCard class="upload-card">
            <template #header>
              <span>{{ t('tools.selectImages') }}</span>
            </template>
            <div class="upload-area">
              <div v-if="images.length === 0" @click="clickGetImages" class="upload-placeholder">
                <span class="upload-icon">+</span>
                <span class="upload-text">{{ t('tools.clickSelect') }}</span>
              </div>
              <div v-else class="images-list">
                <div
                  v-for="(img, index) in images"
                  :key="img.id"
                  class="image-item"
                  :class="{ dragging: draggedIndex === index }"
                  draggable="true"
                  @dragstart="onDragStart(index)"
                  @dragover="onDragOver($event, index)"
                  @drop="onDrop(index)"
                  @dragend="onDragEnd"
                >
                  <span class="image-number">{{ index + 1 }}</span>
                  <img :src="img.base64" :alt="img.name" />
                  <span @click.stop="removeImage(index)" class="remove-icon iconfont">&#xeb6c;</span>
                </div>
                <div @click="clickGetImages" class="add-more">
                  <span class="add-icon">+</span>
                </div>
              </div>
            </div>
            <div class="images-info">
              <span>{{ t('tools.imageCount') }}: {{ images.length }}</span>
              <span>{{ t('tools.outputSize') }}: {{ outputWidth }}×{{ outputHeight }}</span>
            </div>
          </ElCard>
        </div>

        <div class="right-panel">
          <ElCard class="options-card">
            <template #header>
              <span>{{ t('tools.operation') }}</span>
            </template>
            <div class="options-content">
              <div class="options-grid">
                <div class="option-item">
                  <ElText>{{ t('tools.mergeMode') }}</ElText>
                  <ElSelect v-model="mergeMode" style="width: 100%">
                    <ElOption :label="t('tools.horizontal')" value="horizontal" />
                    <ElOption :label="t('tools.vertical')" value="vertical" />
                    <ElOption :label="t('tools.grid')" value="grid" />
                  </ElSelect>
                </div>

                <div v-if="mergeMode === 'grid'" class="option-item">
                  <ElText>{{ t('tools.gridCols') }}</ElText>
                  <ElInputNumber
                    controls-position="right"
                    style="width: 100%"
                    :min="1"
                    :max="10"
                    v-model="gridCols"
                  >
                    <template #suffix><span>{{ t('tools.cols') }}</span></template>
                  </ElInputNumber>
                </div>

                <div class="option-item">
                  <ElText>{{ t('tools.margin') }}</ElText>
                  <ElInputNumber
                    controls-position="right"
                    style="width: 100%"
                    :min="0"
                    :max="200"
                    v-model="margin"
                  >
                    <template #suffix><span>px</span></template>
                  </ElInputNumber>
                </div>

                <div class="option-item">
                  <ElText>{{ t('tools.rowGap') }}</ElText>
                  <ElInputNumber
                    controls-position="right"
                    style="width: 100%"
                    :min="0"
                    :max="200"
                    v-model="rowGap"
                  >
                    <template #suffix><span>px</span></template>
                  </ElInputNumber>
                </div>

                <div class="option-item">
                  <ElText>{{ t('tools.colGap') }}</ElText>
                  <ElInputNumber
                    controls-position="right"
                    style="width: 100%"
                    :min="0"
                    :max="200"
                    v-model="colGap"
                  >
                    <template #suffix><span>px</span></template>
                  </ElInputNumber>
                </div>

                <div class="option-item">
                  <ElText>{{ t('tools.bgColor') }}</ElText>
                  <ElColorPicker v-model="bgColor" :show-alpha="false" />
                </div>
              </div>
            </div>
          </ElCard>

          <div class="action-buttons">
            <ElButton type="primary" @click="mergeImages">{{ t('tools.merge') }}</ElButton>
            <ElButton @click="clearAll">{{ t('tools.clear') }}</ElButton>
          </div>
        </div>
      </div>

      <div class="bottom-panel">
        <ElCard class="result-card">
          <template #header>
            <span>{{ t('tools.mergeResult') }}</span>
            <ElButton text @click="downloadResult" :disabled="!mergeResult" style="margin-left: auto;">{{ t('tools.download') }}</ElButton>
          </template>
          <div class="result-area">
            <div v-if="!mergeResult" class="result-placeholder">
              <span>{{ t('tools.noResult') }}</span>
            </div>
            <div v-else class="result-preview">
              <img :src="mergeResult" alt="合并结果" />
            </div>
          </div>
        </ElCard>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tool-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.tool-body {
  flex: 1;
  overflow: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.main-content {
  display: flex;
  gap: 20px;
  flex: 1;
  min-height: 0;
}

.left-panel {
  flex: 1;
  min-width: 300px;
}

.right-panel {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.upload-card, .options-card, .result-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.upload-area {
  flex: 1;
  min-height: 200px;
  overflow-y: auto;
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px dashed #d9d9d9;
  border-radius: 8px;
  padding: 40px;
  cursor: pointer;
  transition: border-color 0.3s;
  height: 100%;
}

.upload-placeholder:hover {
  border-color: var(--primary);
}

.upload-icon {
  font-size: 48px;
  color: #909399;
  margin-bottom: 16px;
}

.upload-text {
  font-size: 14px;
  color: #909399;
}

.images-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.image-item {
  position: relative;
  width: 120px;
  height: 120px;
  border: 1px solid #d9d9d9;
  border-radius: 2px;
  overflow: hidden;
  cursor: move;
  transition: all 0.3s;
}

.image-item:hover {
  border-color: var(--primary);
}

.image-item.dragging {
  opacity: 0.5;
  transform: scale(0.95);
}

.image-item img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  background-image:
    linear-gradient(45deg, #d9d9d9 25%, transparent 25%),
    linear-gradient(-45deg, #d9d9d9 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #d9d9d9 75%),
    linear-gradient(-45deg, transparent 75%, #d9d9d9 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
  background-color: white;
}

.image-number {
  position: absolute;
  top: 2px;
  left: 4px;
  font-size: 11px;
  color: rgba(0, 0, 0, 0.5);
  font-weight: 600;
  background: rgba(255, 255, 255, 0.8);
  padding: 1px 4px;
  border-radius: 2px;
  pointer-events: none;
}

.remove-icon {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  background: rgba(245, 108, 108, 0.9);
  color: white;
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
}

.image-item:hover .remove-icon {
  opacity: 1;
}

.add-more {
  width: 120px;
  height: 120px;
  border: 2px dashed #d9d9d9;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.3s;
}

.add-more:hover {
  border-color: var(--primary);
}

.add-icon {
  font-size: 32px;
  color: #909399;
}

.images-info {
  display: flex;
  gap: 20px;
  margin-top: 16px;
  font-size: 14px;
  color: #606266;
}

.options-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.options-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.option-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-item .el-text {
  font-size: 14px;
  color: #606266;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.action-buttons .el-button {
  width: 100%;
  margin-left: 0 !important;
}

.bottom-panel {
  min-height: 100px;
}

.result-area {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 8px 0;
  overflow: hidden;
}

.result-placeholder {
  font-size: 14px;
  color: #909399;
}

.result-preview {
  display: inline-block;
  max-width: 100%;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 8px;
  background-image:
    linear-gradient(45deg, #d9d9d9 25%, transparent 25%),
    linear-gradient(-45deg, #d9d9d9 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #d9d9d9 75%),
    linear-gradient(-45deg, transparent 75%, #d9d9d9 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
  background-color: white;
}

.result-preview img {
  display: block;
  max-width: 100%;
  height: auto;
}
</style>