<script setup>
import { ref, watch, nextTick, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElCard, ElTabs, ElTabPane, ElInputNumber, ElColorPicker, ElButton, ElText } from 'element-plus'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

const { t } = useI18n()

const filename = ref('')
const filebase64 = ref('')
const originalWidth = ref(0)
const originalHeight = ref(0)
const scaleWidth = ref(0)
const scaleHeight = ref(0)
const imgWidth = ref(64)
const imgHeight = ref(64)
const imgMargin = ref(0)
const imgLRM = ref(0)
const imgTBM = ref(0)
const operation = ref('auto')
const bgColor = ref('#ffffff')
const spriteResult = ref([])
const spriteResultBase64 = ref([])

const widthRatio = ref(0)
const heightRatio = ref(0)
const imgRef = ref(null)
const dividersRef = ref(null)

function dividerNumber() {
  const availableWidth = originalWidth.value - imgMargin.value * 2
  const availableHeight = originalHeight.value - imgMargin.value * 2

  const columnCount = Math.floor(
    (availableWidth + imgLRM.value) / (imgWidth.value + imgLRM.value)
  )

  const rowCount = Math.floor(
    (availableHeight + imgTBM.value) / (imgHeight.value + imgTBM.value)
  )

  return {
    width: Math.max(columnCount, 1),
    height: Math.max(rowCount, 1)
  }
}

function deleteImg() {
  filebase64.value = ''
  filename.value = ''
  spriteResult.value = []
  spriteResultBase64.value = []
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

const fileInputRef = ref(null)

function clickGetImages() {
  fileInputRef.value?.click()
}

async function onFileChange(e) {
  const file = e.target.files?.[0]
  if (!file) return

  try {
    filename.value = file.name
    filebase64.value = await fileToBase64(file)

    const wh = await getImageDimensions(filebase64.value)
    originalWidth.value = wh.width
    originalHeight.value = wh.height

    await nextTick()
    if (imgRef.value) {
      if (wh.width >= wh.height) {
        imgRef.value.style.width = '300px'
        imgRef.value.style.height = 'auto'
      } else {
        imgRef.value.style.width = 'auto'
        imgRef.value.style.height = '300px'
      }
      // 等待图片渲染后获取实际显示尺寸
      await nextTick()
      scaleWidth.value = imgRef.value.clientWidth
      scaleHeight.value = imgRef.value.clientHeight
      widthRatio.value = wh.width / imgRef.value.clientWidth
      heightRatio.value = wh.height / imgRef.value.clientHeight
    }
  } catch (err) {
    console.error('选择图片失败:', err)
    ElMessage.error(t('common.failed'))
  } finally {
    e.target.value = ''
  }
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 0, g: 0, b: 0 }
}

function colorDistance(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)
}

function floodFill(startX, startY, data, visited, width, height) {
  const stack = [[startX, startY]]
  let minX = startX, minY = startY, maxX = startX, maxY = startY

  while (stack.length > 0) {
    const [x, y] = stack.pop()
    const index = y * width + x

    if (x < 0 || x >= width || y < 0 || y >= height || visited[index]) continue
    if (data[index * 4 + 3] === 0) continue

    visited[index] = true
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)

    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
  }

  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

function autoDetectSprites(ctx, width, height, bgColor) {
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data

  if (bgColor && bgColor !== 'transparent') {
    const targetRGB = hexToRgb(bgColor)
    const tolerance = 10
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2]
      if (colorDistance(r, g, b, targetRGB.r, targetRGB.g, targetRGB.b) < tolerance) {
        data[i + 3] = 0
      }
    }
    // 将修改后的数据写回 canvas
    ctx.putImageData(imageData, 0, 0)
  }

  const visited = new Array(width * height).fill(false)
  const sprites = []
  const minSize = 2

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x
      const alpha = data[index * 4 + 3]
      if (!visited[index] && alpha > 0) {
        const region = floodFill(x, y, data, visited, width, height)
        if (region.width >= minSize && region.height >= minSize) {
          sprites.push(region)
        }
      }
    }
  }

  sprites.sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y
    return a.x - b.x
  })

  return sprites
}

function filterUselessRects(spriteRects, ctx, bgColor, tolerance = 10) {
  const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
  const data = imageData.data
  const width = ctx.canvas.width
  const targetRGB = bgColor && bgColor !== 'transparent' ? hexToRgb(bgColor) : null

  return spriteRects.filter((rect) => {
    const totalPixels = rect.width * rect.height

    if (rect.width <= 2 || rect.height <= 2 || totalPixels <= 4) return false

    let transparentCount = 0
    let bgColorCount = 0
    let blackCount = 0
    let whiteCount = 0

    for (let y = rect.y; y < rect.y + rect.height; y++) {
      for (let x = rect.x; x < rect.x + rect.width; x++) {
        const index = (y * width + x) * 4
        const a = data[index + 3]
        const r = data[index]
        const g = data[index + 1]
        const b = data[index + 2]

        if (a === 0) {
          transparentCount++
          continue
        }

        if (targetRGB) {
          if (colorDistance(r, g, b, targetRGB.r, targetRGB.g, targetRGB.b) <= tolerance) {
            bgColorCount++
            continue
          }
        }

        if (r < 10 && g < 10 && b < 10) {
          blackCount++
        } else if (r > 245 && g > 245 && b > 245) {
          whiteCount++
        }
      }
    }

    if (transparentCount === totalPixels) return false
    if (bgColorCount === totalPixels) return false
    if (blackCount === totalPixels) return false
    if (whiteCount === totalPixels) return false

    const usefulPixels = totalPixels - transparentCount - bgColorCount
    if (usefulPixels === 0) return false

    if (transparentCount / totalPixels > 0.98) return false
    if (bgColorCount / totalPixels > 0.98) return false

    return true
  })
}

function splitSpriteAuto(base64, bgColorVal) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = async () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      const bgColor = bgColorVal || 'transparent'
      let spriteRects = autoDetectSprites(ctx, canvas.width, canvas.height, bgColor)
      spriteRects = filterUselessRects(spriteRects, ctx, bgColor)

      const baseName = filename.value.replace(/\.[^.]+$/, '')
      const results = []
      for (let i = 0; i < spriteRects.length; i++) {
        const rect = spriteRects[i]
        const cropCanvas = document.createElement('canvas')
        cropCanvas.width = rect.width
        cropCanvas.height = rect.height
        const cropCtx = cropCanvas.getContext('2d')
        cropCtx.drawImage(canvas, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height)
        const blob = await new Promise((r) => cropCanvas.toBlob(r, 'image/png'))
        results.push({ name: `${baseName}_${i + 1}.png`, blob })
      }

      resolve(results)
    }
    img.src = base64
  })
}

function removeBgColor(ctx, width, height, bgColorVal) {
  if (!bgColorVal || bgColorVal === 'transparent') return
  const targetRGB = hexToRgb(bgColorVal)
  const tolerance = 10
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    if (colorDistance(r, g, b, targetRGB.r, targetRGB.g, targetRGB.b) <= tolerance) {
      data[i + 3] = 0
    }
  }
  ctx.putImageData(imageData, 0, 0)
}

function isSpriteEmpty(spriteCanvas) {
  const ctx = spriteCanvas.getContext('2d')
  const imageData = ctx.getImageData(0, 0, spriteCanvas.width, spriteCanvas.height)
  const data = imageData.data
  const totalPixels = spriteCanvas.width * spriteCanvas.height

  let transparentCount = 0
  let blackCount = 0
  let whiteCount = 0

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    if (a === 0) {
      transparentCount++
      continue
    }

    if (r < 10 && g < 10 && b < 10) {
      blackCount++
    } else if (r > 245 && g > 245 && b > 245) {
      whiteCount++
    }
  }

  if (transparentCount === totalPixels) return true
  if (blackCount === totalPixels) return true
  if (whiteCount === totalPixels) return true
  if (transparentCount / totalPixels > 0.98) return true

  return false
}

function splitSpriteManual(base64, options) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = async () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      if (options.bgcolor && options.bgcolor !== 'transparent') {
        removeBgColor(ctx, canvas.width, canvas.height, options.bgcolor)
      }

      const { width, height, margin, paddingX, paddingY } = options
      const availableWidth = img.width - margin * 2
      const availableHeight = img.height - margin * 2
      const cols = Math.floor((availableWidth + paddingX) / (width + paddingX))
      const rows = Math.floor((availableHeight + paddingY) / (height + paddingY))

      const results = []
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const spriteCanvas = document.createElement('canvas')
          spriteCanvas.width = width
          spriteCanvas.height = height
          const spriteCtx = spriteCanvas.getContext('2d')

          const sx = margin + col * (width + paddingX)
          const sy = margin + row * (height + paddingY)

          spriteCtx.drawImage(
            canvas,
            sx,
            sy,
            Math.min(width, img.width - sx),
            Math.min(height, img.height - sy),
            0,
            0,
            width,
            height
          )

          if (isSpriteEmpty(spriteCanvas)) continue

          const blob = await new Promise((r) => spriteCanvas.toBlob(r, 'image/png'))
          const name = `${filename.value.replace(/\.[^.]+$/, '')}_${row}_${col}.png`
          results.push({ name, blob })
        }
      }

      resolve(results)
    }
    img.src = base64
  })
}

async function startSprite() {
  if (!filebase64.value) {
    ElMessage.warning('请先选择图片')
    return
  }

  try {
    if (operation.value === 'auto') {
      const files = await splitSpriteAuto(filebase64.value, bgColor.value)
      spriteResult.value = files
    } else {
      const manualOptions = {
        width: imgWidth.value,
        height: imgHeight.value,
        margin: imgMargin.value,
        paddingX: imgLRM.value,
        paddingY: imgTBM.value,
        bgcolor: bgColor.value
      }
      const files = await splitSpriteManual(filebase64.value, manualOptions)
      spriteResult.value = files
    }
  } catch (error) {
    console.error('分割失败:', error)
    ElMessage.error('分割失败')
  }
}

function deleteResultItem(index) {
  spriteResult.value.splice(index, 1)
  spriteResultBase64.value.splice(index, 1)
}

watch(
  () => spriteResult.value,
  async (newData) => {
    spriteResultBase64.value = []
    for (let i = 0; i < newData.length; i++) {
      const reader = new FileReader()
      const base64 = await new Promise((resolve) => {
        reader.onload = (e) => resolve(e.target.result)
        reader.readAsDataURL(newData[i].blob)
      })
      spriteResultBase64.value.push(base64)
    }
  },
  { deep: true }
)

async function saveLocal() {
  if (spriteResult.value.length === 0) {
    ElMessage.warning('暂无分割结果')
    return
  }

  try {
    const zip = new JSZip()
    for (let i = 0; i < spriteResult.value.length; i++) {
      const item = spriteResult.value[i]
      const name = item.name.endsWith('.png') ? item.name : item.name + '.png'
      zip.file(name, item.blob)
    }
    const content = await zip.generateAsync({ type: 'blob' })
    saveAs(content, 'images.zip')
    ElMessage.success('导出成功')
  } catch (e) {
    console.error('导出失败:', e)
    ElMessage.error('导出失败')
  }
}

async function saveResources() {
  if (spriteResult.value.length === 0) {
    ElMessage.warning('暂无分割结果')
    return
  }

  try {
    for (let i = 0; i < spriteResult.value.length; i++) {
      const file = spriteResult.value[i]
      const arrayBuffer = await file.blob.arrayBuffer()
      const base64 = btoa(
        String.fromCharCode(...new Uint8Array(arrayBuffer))
      )
      const name = file.name.endsWith('.png') ? file.name : file.name + '.png'
      await window.api.images.saveSplitResult({
        name,
        base64
      })
    }
    ElMessage.success('导入到资源库成功')
  } catch (e) {
    console.error('导入失败:', e)
    ElMessage.error('导入失败')
  }
}
const isPixelArt = computed(() => originalWidth.value < 512 || originalHeight.value < 512)
</script>

<template>
  <div class="image-split-tool">
    <input
      ref="fileInputRef"
      type="file"
      accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/bmp"
      style="display: none"
      @change="onFileChange"
    />
    <div class="tool-body">
      <div class="split-section">
        <ElCard class="upload-card">
          <template #header>
            <span>{{ t('tools.selectImage') }}</span>
          </template>
          <div class="upload-area">
            <div v-if="!filebase64" @click="clickGetImages" class="upload-placeholder">
              <span class="upload-icon">+</span>
              <span class="upload-text">{{ t('tools.clickSelect') }}</span>
            </div>
            <div v-else class="image-preview">
              <img ref="imgRef" :src="filebase64" alt="" :class="{ 'pixelated': isPixelArt }" />
              <div @click="deleteImg" class="delete-overlay">
                <span class="delete-icon iconfont">&#xeb6c;</span>
              </div>
              <div
                v-if="operation === 'noauto' && filebase64"
                ref="dividersRef"
                class="dividers"
                :style="{
                  gridTemplateColumns: `repeat(${dividerNumber()?.width},${imgWidth / widthRatio}px)`,
                  gridTemplateRows: `repeat(${dividerNumber()?.height},${imgHeight / heightRatio}px)`,
                  columnGap: `${imgLRM / widthRatio}px`,
                  rowGap: `${imgTBM / heightRatio}px`,
                  width: `${scaleWidth}px`,
                  height: `${scaleHeight}px`
                }"
              >
                <div
                  :key="'divider_' + i"
                  v-for="i of dividerNumber()?.height * dividerNumber()?.width"
                  class="divider"
                  :style="{
                    width: imgWidth / widthRatio + 'px',
                    height: imgHeight / heightRatio + 'px',
                    margin: imgMargin / widthRatio + 'px'
                  }"
                ></div>
              </div>
            </div>
          </div>
        </ElCard>

        <ElCard class="options-card">
          <template #header>
            <span>{{ t('tools.operation') }}</span>
          </template>
          <div class="options-content">
            <ElTabs v-model="operation">
              <ElTabPane :label="t('tools.manualSplit')" name="noauto">
                <div class="options-grid">
                  <div class="option-item">
                    <ElText>{{ t('tools.singleWidth') }}</ElText>
                    <ElInputNumber
                      controls-position="right"
                      style="width: 100%"
                      :min="8"
                      v-model="imgWidth"
                    >
                      <template #suffix><span>px</span></template>
                    </ElInputNumber>
                  </div>
                  <div class="option-item">
                    <ElText>{{ t('tools.singleHeight') }}</ElText>
                    <ElInputNumber
                      controls-position="right"
                      style="width: 100%"
                      :min="8"
                      v-model="imgHeight"
                    >
                      <template #suffix><span>px</span></template>
                    </ElInputNumber>
                  </div>
                  <div class="option-item">
                    <ElText>{{ t('tools.margin') }}</ElText>
                    <ElInputNumber
                      controls-position="right"
                      style="width: 100%"
                      v-model="imgMargin"
                    >
                      <template #suffix><span>px</span></template>
                    </ElInputNumber>
                  </div>
                  <div class="option-item">
                    <ElText>{{ t('tools.horizontalGap') }}</ElText>
                    <ElInputNumber
                      controls-position="right"
                      style="width: 100%"
                      v-model="imgLRM"
                    >
                      <template #suffix><span>px</span></template>
                    </ElInputNumber>
                  </div>
                  <div class="option-item">
                    <ElText>{{ t('tools.verticalGap') }}</ElText>
                    <ElInputNumber
                      controls-position="right"
                      style="width: 100%"
                      v-model="imgTBM"
                    >
                      <template #suffix><span>px</span></template>
                    </ElInputNumber>
                  </div>
                  <div class="option-item">
                    <ElText>{{ t('tools.bgColor') }}</ElText>
                    <ElColorPicker v-model="bgColor" />
                  </div>
                </div>
              </ElTabPane>
              <ElTabPane :label="t('tools.autoSplit')" name="auto">
                <div class="options-grid">
                  <div class="option-item">
                    <ElText>{{ t('tools.bgColor') }}</ElText>
                    <ElColorPicker v-model="bgColor" />
                  </div>
                </div>
              </ElTabPane>
            </ElTabs>
            <div class="split-btn-container">
              <ElButton type="primary" style="width: 100%" @click="startSprite">
                {{ t('tools.split') }}
              </ElButton>
            </div>
          </div>
        </ElCard>
      </div>

      <ElCard class="result-card">
        <template #header>
          <div class="result-header">
            <span>{{ t('tools.splitResult') }} ({{ spriteResult.length }})</span>
            <div class="result-actions">
              <ElButton size="small" @click="saveLocal">
                {{ t('tools.exportLocal') }}
              </ElButton>
              <ElButton size="small" type="primary" @click="saveResources">
                {{ t('tools.exportResources') }}
              </ElButton>
            </div>
          </div>
        </template>
        <div class="result-grid">
          <div v-for="(item, index) in spriteResult" :key="index" class="result-item">
            <div class="result-img-wrapper">
              <img :src="spriteResultBase64[index]" :alt="item.name" />
              <div class="result-delete-overlay" @click.stop="deleteResultItem(index)">
                <i class="iconfont">&#xeb6c;</i>
              </div>
            </div>
            <input
              v-model="item.name"
              class="result-name-input"
              @click.stop
            />
          </div>
          <div v-if="spriteResult.length === 0" class="result-empty">
            <span>{{ t('tools.noResult') }}</span>
          </div>
        </div>
      </ElCard>
    </div>
  </div>
</template>

<style scoped>
.image-split-tool {
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

.image-preview {
  width: 300px;
  height: 300px;
  position: relative;
  border-radius: var(--radius);
  overflow: hidden;
}

.image-preview img {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  max-width: 100%;
  max-height: 100%;
}
.image-preview img.pixelated {
  image-rendering: pixelated;
}

.delete-overlay {
  display: none;
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 100;
}

.image-preview:hover .delete-overlay {
  display: flex;
}

.delete-icon {
  font-size: 32px;
  color: white;
}

.dividers {
  display: grid;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.divider {
  box-shadow: 0 0 1px var(--primary);
  z-index: 10;
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

.option-item .el-text {
  font-size: 13px;
  color: var(--text-2);
}

.split-btn-container {
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

.result-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.result-item {
  width: 90px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--bg-soft);
}

.result-img-wrapper {
  position: relative;
  height: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.result-item img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
  display: block;
}

.result-delete-overlay {
  display: none;
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.result-delete-overlay .iconfont {
  font-size: 20px;
  color: white;
}

.result-img-wrapper:hover .result-delete-overlay {
  display: flex;
}

.result-name-input {
  width: 100%;
  border: none;
  border-top: 1px solid var(--border-soft);
  background: transparent;
  font-size: 12px;
  color: var(--text-1);
  outline: none;
  padding: 4px 6px;
  border-radius: 0;
  transition: background 0.15s;
}

.result-name-input:hover {
  background: var(--bg-hover);
}

.result-name-input:focus {
  background: var(--bg);
  box-shadow: inset 0 0 0 1px var(--primary);
}

.result-empty {
  width: 100%;
  padding: 40px;
  text-align: center;
  color: var(--text-3);
  font-size: 14px;
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
