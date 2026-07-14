<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElCard, ElInputNumber, ElButton, ElText } from 'element-plus'
import WaveSurfer from 'wavesurfer.js'
import { saveAs } from 'file-saver'

const { t } = useI18n()

const file = ref(null)
const fileName = ref('')
const fileBase64 = ref('')
const speed = ref(1)
const originalDuration = ref(0)
const newDuration = ref(0)
const isProcessing = ref(false)

const wavesurfer = ref(null)
const wavesurferRef = ref(null)
const fileInputRef = ref(null)

watch(speed, () => {
  if (originalDuration.value > 0) {
    newDuration.value = Math.round(originalDuration.value / speed.value * 10) / 10
  }
})

function clickGetAudio() {
  fileInputRef.value?.click()
}

function deleteAudio() {
  file.value = null
  fileName.value = ''
  fileBase64.value = ''
  originalDuration.value = 0
  newDuration.value = 0
  if (wavesurfer.value) {
    wavesurfer.value.destroy()
    wavesurfer.value = null
  }
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

async function onFileChange(e) {
  const selectedFile = e.target.files?.[0]
  if (!selectedFile) return

  try {
    file.value = selectedFile
    fileName.value = selectedFile.name

    const reader = new FileReader()
    reader.onload = async (event) => {
      fileBase64.value = event.target.result

      if (wavesurfer.value) {
        wavesurfer.value.destroy()
      }

      wavesurfer.value = WaveSurfer.create({
        container: wavesurferRef.value,
        waveColor: '#6366f1',
        progressColor: '#818cf8',
        cursorColor: '#818cf8',
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        height: 100
      })

      await wavesurfer.value.load(fileBase64.value)
      wavesurfer.value.on('ready', () => {
        originalDuration.value = wavesurfer.value.getDuration()
        newDuration.value = originalDuration.value
      })
    }
    reader.readAsDataURL(selectedFile)
  } catch (err) {
    console.error('选择音频失败:', err)
    ElMessage.error(t('common.failed'))
  } finally {
    e.target.value = ''
  }
}

async function processAudio() {
  if (!file.value || !fileBase64.value) {
    ElMessage.warning(t('tools.selectAudio'))
    return
  }

  if (speed.value === 1) {
    ElMessage.warning('速度未改变')
    return
  }

  isProcessing.value = true

  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const response = await fetch(fileBase64.value)
    const arrayBuffer = await response.arrayBuffer()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

    const source = audioContext.createBufferSource()
    source.buffer = audioBuffer
    source.playbackRate.value = speed.value

    const offlineCtx = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length / speed.value,
      audioBuffer.sampleRate
    )

    const offlineSource = offlineCtx.createBufferSource()
    offlineSource.buffer = audioBuffer
    offlineSource.playbackRate.value = speed.value
    offlineSource.connect(offlineCtx.destination)
    offlineSource.start(0)

    const renderedBuffer = await offlineCtx.startRendering()
    const wavBlob = audioBufferToWav(renderedBuffer)

    fileBase64.value = URL.createObjectURL(wavBlob)

    if (wavesurfer.value) {
      wavesurfer.value.destroy()
    }

    wavesurfer.value = WaveSurfer.create({
      container: wavesurferRef.value,
      waveColor: '#6366f1',
      progressColor: '#818cf8',
      cursorColor: '#818cf8',
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 100
    })

    await wavesurfer.value.load(fileBase64.value)
    wavesurfer.value.on('ready', () => {
      originalDuration.value = wavesurfer.value.getDuration()
      newDuration.value = originalDuration.value
    })

    audioContext.close()
    ElMessage.success(t('tools.processSuccess'))
  } catch (err) {
    console.error('处理失败:', err)
    ElMessage.error(t('common.failed'))
  } finally {
    isProcessing.value = false
  }
}

function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const format = 1
  const bitDepth = 16

  const result = new Uint8Array(44 + buffer.length * numChannels * bitDepth / 8)
  const view = new DataView(result.buffer)

  function writeString(str) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
    offset += str.length
  }

  function writeUint32(a) {
    view.setUint32(offset, a, true)
    offset += 4
  }

  function writeUint16(a) {
    view.setUint16(offset, a, true)
    offset += 2
  }

  let offset = 0

  writeString('RIFF')
  writeUint32(36 + buffer.length * numChannels * bitDepth / 8)
  writeString('WAVE')
  writeString('fmt ')
  writeUint32(16)
  writeUint16(format)
  writeUint16(numChannels)
  writeUint32(sampleRate)
  writeUint32(sampleRate * numChannels * bitDepth / 8)
  writeUint16(numChannels * bitDepth / 8)
  writeUint16(bitDepth)
  writeString('data')
  writeUint32(buffer.length * numChannels * bitDepth / 8)

  if (bitDepth === 16) {
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        let sample = buffer.getChannelData(channel)[i]
        sample = Math.max(-1, Math.min(1, sample))
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff
        view.setInt16(offset, sample, true)
        offset += 2
      }
    }
  }

  return new Blob([result], { type: 'audio/wav' })
}

async function exportAudio() {
  if (!fileBase64.value) {
    ElMessage.warning('暂无处理结果')
    return
  }

  try {
    const response = await fetch(fileBase64.value)
    const blob = await response.blob()
    const baseName = fileName.value.replace(/\.[^.]+$/, '')
    const newName = `${baseName}_speed_${speed.value}x.wav`
    saveAs(blob, newName)
    ElMessage.success(t('tools.exportSuccess'))
  } catch (e) {
    console.error('导出失败:', e)
    ElMessage.error(t('common.failed'))
  }
}

async function saveToResources() {
  if (!fileBase64.value) {
    ElMessage.warning('暂无处理结果')
    return
  }

  try {
    const response = await fetch(fileBase64.value)
    const blob = await response.blob()
    const arrayBuffer = await blob.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
    const baseName = fileName.value.replace(/\.[^.]+$/, '')
    const newName = `${baseName}_speed_${speed.value}x.wav`

    await window.api.audios.saveBuffer({
      name: newName.replace('.wav', ''),
      fileName: newName,
      base64
    })

    ElMessage.success(t('tools.exportResources'))
  } catch (e) {
    console.error('导入失败:', e)
    ElMessage.error(t('common.failed'))
  }
}
</script>

<template>
  <div class="audio-speed-tool">
    <input
      ref="fileInputRef"
      type="file"
      accept="audio/*"
      style="display: none"
      @change="onFileChange"
    />
    <div class="tool-body">
      <div class="split-section">
        <ElCard class="upload-card">
          <template #header>
            <span>{{ t('tools.selectAudio') }}</span>
          </template>
          <div class="upload-area">
            <div v-if="!fileBase64" @click="clickGetAudio" class="upload-placeholder">
              <span class="upload-icon">+</span>
              <span class="upload-text">{{ t('tools.clickSelect') }}</span>
            </div>
            <div v-else class="audio-preview">
              <div class="audio-info">
                <span class="audio-name">{{ fileName }}</span>
                <span class="audio-duration">{{ formatDuration(originalDuration) }}</span>
              </div>
              <div ref="wavesurferRef" class="wavesurfer-container"></div>
              <div @click="deleteAudio" class="delete-overlay">
                <span class="delete-icon iconfont">&#xeb6c;</span>
              </div>
            </div>
          </div>
        </ElCard>

        <ElCard class="options-card">
          <template #header>
            <span>{{ t('tools.speedAdjustment') }}</span>
          </template>
          <div class="options-content">
            <div class="options-grid">
              <div class="option-item">
                <ElText>{{ t('tools.playbackSpeed') }}</ElText>
                <ElInputNumber
                  controls-position="right"
                  style="width: 100%"
                  :min="0.1"
                  :max="5"
                  :step="0.1"
                  v-model="speed"
                >
                  <template #suffix><span>x</span></template>
                </ElInputNumber>
              </div>
              <div class="option-item">
                <ElText>{{ t('tools.originalDuration') }}</ElText>
                <div class="option-value">{{ formatDuration(originalDuration) }}</div>
              </div>
              <div class="option-item">
                <ElText>{{ t('tools.newDuration') }}</ElText>
                <div class="option-value">{{ formatDuration(newDuration) }}</div>
              </div>
            </div>
            <div class="speed-btn-container">
              <ElButton type="primary" style="width: 100%" :loading="isProcessing" @click="processAudio">
                {{ t('tools.process') }}
              </ElButton>
            </div>
          </div>
        </ElCard>
      </div>

      <ElCard class="result-card">
        <template #header>
          <div class="result-header">
            <span>{{ t('tools.processResult') }}</span>
            <div class="result-actions">
              <ElButton size="small" @click="exportAudio">
                {{ t('tools.exportLocal') }}
              </ElButton>
              <ElButton size="small" type="primary" @click="saveToResources">
                {{ t('tools.exportResources') }}
              </ElButton>
            </div>
          </div>
        </template>
        <div v-if="!fileBase64" class="result-empty">
          <span>{{ t('tools.noResult') }}</span>
        </div>
        <div v-else class="result-info">
          <div class="info-row">
            <span class="info-label">{{ t('tools.fileName') }}</span>
            <span class="info-value">{{ fileName }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">{{ t('tools.speed') }}</span>
            <span class="info-value">{{ speed }}x</span>
          </div>
          <div class="info-row">
            <span class="info-label">{{ t('tools.duration') }}</span>
            <span class="info-value">{{ formatDuration(newDuration) }}</span>
          </div>
        </div>
      </ElCard>
    </div>
  </div>
</template>

<style scoped>
.audio-speed-tool {
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
  min-width: 300px;
}

.options-card {
  width: 320px;
}

.upload-area {
  display: flex;
  justify-content: center;
}

.upload-placeholder {
  width: 100%;
  height: 150px;
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

.audio-preview {
  width: 100%;
  position: relative;
  border-radius: var(--radius);
  overflow: hidden;
}

.audio-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--bg-soft);
}

.audio-name {
  font-size: 13px;
  font-weight: 500;
}

.audio-duration {
  font-size: 12px;
  color: var(--text-3);
}

.wavesurfer-container {
  background: var(--bg);
}

.delete-overlay {
  display: none;
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  background: rgba(0, 0, 0, 0.5);
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 4px;
}

.audio-preview:hover .delete-overlay {
  display: flex;
}

.delete-icon {
  font-size: 16px;
  color: white;
}

.options-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 12px;
}

.options-grid {
  display: flex;
  flex-direction: column;
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

.option-value {
  font-size: 14px;
  color: var(--text-1);
  padding: 8px 12px;
  background: var(--bg-soft);
  border-radius: var(--radius-sm);
}

.speed-btn-container {
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

.result-empty {
  padding: 40px;
  text-align: center;
  color: var(--text-3);
  font-size: 14px;
}

.result-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--bg-soft);
  border-radius: var(--radius-sm);
}

.info-label {
  font-size: 13px;
  color: var(--text-2);
}

.info-value {
  font-size: 13px;
  font-weight: 500;
}

@media (max-width: 768px) {
  .split-section {
    flex-direction: column;
  }

  .upload-card,
  .options-card {
    width: 100%;
    max-width: 100%;
  }
}
</style>