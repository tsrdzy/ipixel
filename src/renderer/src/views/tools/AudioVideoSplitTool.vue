<script setup>import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElCard, ElButton, ElText } from 'element-plus';
import WaveSurfer from 'wavesurfer.js';
import { saveAs } from 'file-saver';
const { t } = useI18n();
const file = ref(null);
const fileName = ref('');
const fileBase64 = ref('');
const audioExtracted = ref(false);
const audioBlob = ref(null);
const audioBase64 = ref('');
const isProcessing = ref(false);
const videoRef = ref(null);
const wavesurfer = ref(null);
const wavesurferRef = ref(null);
const fileInputRef = ref(null);
function clickGetVideo() {
 fileInputRef.value?.click();
}
function deleteVideo() {
 file.value = null;
 fileName.value = '';
 fileBase64.value = '';
 audioExtracted.value = false;
 audioBlob.value = null;
 audioBase64.value = '';
 if (videoRef.value) {
 videoRef.value.pause();
 videoRef.value.src = '';
 }
 if (wavesurfer.value) {
 wavesurfer.value.destroy();
 wavesurfer.value = null;
 }
}
async function onFileChange(e) {
 const selectedFile = e.target.files?.[0];
 if (!selectedFile)
 return;
 try {
 file.value = selectedFile;
 fileName.value = selectedFile.name;
 const reader = new FileReader();
 reader.onload = (event) => {
 fileBase64.value = event.target.result;
 audioExtracted.value = false;
 audioBlob.value = null;
 audioBase64.value = '';
 if (wavesurfer.value) {
 wavesurfer.value.destroy();
 wavesurfer.value = null;
 }
 };
 reader.readAsDataURL(selectedFile);
 } catch (err) {
 console.error('选择视频失败:', err);
 ElMessage.error(t('common.failed'));
 } finally {
 e.target.value = '';
 }
}
async function extractAudio() {
 if (!file.value || !fileBase64.value) {
 ElMessage.warning(t('tools.selectVideo'));
 return;
 }
 isProcessing.value = true;
 try {
 const video = document.createElement('video');
 video.src = fileBase64.value;
 await new Promise((resolve, reject) => {
 video.onloadedmetadata = resolve;
 video.onerror = reject;
 });
 video.volume = 1;
 const audioContext = new (window.AudioContext || window.webkitAudioContext)();
 const source = audioContext.createMediaElementSource(video);
 const destination = audioContext.createMediaStreamDestination();
 source.connect(destination);
 const recorder = new MediaRecorder(destination.stream, {
 mimeType: 'audio/webm'
 });
 const chunks = [];
 recorder.ondataavailable = (e) => {
 if (e.data.size > 0)
 chunks.push(e.data);
 };
 const recordingPromise = new Promise((resolve) => {
 recorder.onstop = () => {
 const webmBlob = new Blob(chunks, { type: 'audio/webm' });
 resolve(webmBlob);
 };
 });
 recorder.start();
 video.play();
 video.onended = () => {
 recorder.stop();
 };
 const webmBlob = await recordingPromise;
 const wavBlob = await webmToWav(webmBlob);
 audioBlob.value = wavBlob;
 audioBase64.value = URL.createObjectURL(wavBlob);
 if (wavesurfer.value) {
 wavesurfer.value.destroy();
 }
 wavesurfer.value = WaveSurfer.create({
 container: wavesurferRef.value,
 waveColor: '#6366f1',
 progressColor: '#818cf8',
 cursorColor: '#818cf8',
 barWidth: 2,
 barGap: 1,
 barRadius: 2,
 height: 80
 });
 await wavesurfer.value.load(audioBase64.value);
 audioExtracted.value = true;
 audioContext.close();
 ElMessage.success(t('tools.extractSuccess'));
 } catch (err) {
 console.error('分离失败:', err);
 ElMessage.error(t('common.failed'));
 } finally {
 isProcessing.value = false;
 }
}
async function webmToWav(webmBlob) {
 const audioContext = new (window.AudioContext || window.webkitAudioContext)();
 const arrayBuffer = await webmBlob.arrayBuffer();
 const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
 const wavBlob = audioBufferToWav(audioBuffer);
 audioContext.close();
 return wavBlob;
}
function audioBufferToWav(buffer) {
 const numChannels = buffer.numberOfChannels;
 const sampleRate = buffer.sampleRate;
 const format = 1;
 const bitDepth = 16;
 const result = new Uint8Array(44 + buffer.length * numChannels * bitDepth / 8);
 const view = new DataView(result.buffer);
 function writeString(str) {
 for (let i = 0; i < str.length; i++) {
 view.setUint8(offset + i, str.charCodeAt(i));
 }
 offset += str.length;
 }
 function writeUint32(a) {
 view.setUint32(offset, a, true);
 offset += 4;
 }
 function writeUint16(a) {
 view.setUint16(offset, a, true);
 offset += 2;
 }
 let offset = 0;
 writeString('RIFF');
 writeUint32(36 + buffer.length * numChannels * bitDepth / 8);
 writeString('WAVE');
 writeString('fmt ');
 writeUint32(16);
 writeUint16(format);
 writeUint16(numChannels);
 writeUint32(sampleRate);
 writeUint32(sampleRate * numChannels * bitDepth / 8);
 writeUint16(numChannels * bitDepth / 8);
 writeUint16(bitDepth);
 writeString('data');
 writeUint32(buffer.length * numChannels * bitDepth / 8);
 if (bitDepth === 16) {
 for (let i = 0; i < buffer.length; i++) {
 for (let channel = 0; channel < numChannels; channel++) {
 let sample = buffer.getChannelData(channel)[i];
 sample = Math.max(-1, Math.min(1, sample));
 sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
 view.setInt16(offset, sample, true);
 offset += 2;
 }
 }
 }
 return new Blob([result], { type: 'audio/wav' });
}
async function exportAudio() {
 if (!audioBlob.value) {
 ElMessage.warning('暂无分离结果');
 return;
 }
 try {
 const baseName = fileName.value.replace(/\.[^.]+$/, '');
 const newName = `${baseName}_audio.wav`;
 saveAs(audioBlob.value, newName);
 ElMessage.success(t('tools.exportSuccess'));
 } catch (e) {
 console.error('导出失败:', e);
 ElMessage.error(t('common.failed'));
 }
}
async function saveToResources() {
 if (!audioBlob.value) {
 ElMessage.warning('暂无分离结果');
 return;
 }
 try {
 const arrayBuffer = await audioBlob.value.arrayBuffer();
 const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
 const baseName = fileName.value.replace(/\.[^.]+$/, '');
 const newName = `${baseName}_audio.wav`;
 await window.api.audios.saveBuffer({
 name: newName.replace('.wav', ''),
 fileName: newName,
 base64
 });
 ElMessage.success(t('tools.exportResources'));
 } catch (e) {
 console.error('导入失败:', e);
 ElMessage.error(t('common.failed'));
 }
}
</script>

<template>
  <div class="audio-video-split-tool">
    <input
      ref="fileInputRef"
      type="file"
      accept="video/*"
      style="display: none"
      @change="onFileChange"
    />
    <div class="tool-body">
      <div class="split-section">
        <ElCard class="upload-card">
          <template #header>
            <span>{{ t('tools.selectVideo') }}</span>
          </template>
          <div class="upload-area">
            <div v-if="!fileBase64" @click="clickGetVideo" class="upload-placeholder">
              <span class="upload-icon">+</span>
              <span class="upload-text">{{ t('tools.clickSelect') }}</span>
            </div>
            <div v-else class="video-preview">
              <video ref="videoRef" :src="fileBase64" controls class="video-player" />
              <div @click="deleteVideo" class="delete-overlay">
                <span class="delete-icon iconfont">&#xeb6c;</span>
              </div>
            </div>
          </div>
        </ElCard>

        <ElCard class="options-card">
          <template #header>
            <span>{{ t('tools.audioVideoSplit') }}</span>
          </template>
          <div class="options-content">
            <div class="options-info">
              <div class="info-item">
                <ElText>{{ t('tools.fileName') }}</ElText>
                <span class="info-value">{{ fileName || '-' }}</span>
              </div>
            </div>
            <div class="split-btn-container">
              <ElButton type="primary" style="width: 100%" :loading="isProcessing" @click="extractAudio">
                {{ t('tools.extractAudio') }}
              </ElButton>
            </div>
          </div>
        </ElCard>
      </div>

      <ElCard class="result-card" v-if="audioExtracted">
        <template #header>
          <div class="result-header">
            <span>{{ t('tools.extractResult') }}</span>
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
        <div class="audio-wave-container">
          <div ref="wavesurferRef" class="wavesurfer-container"></div>
        </div>
      </ElCard>
    </div>
  </div>
</template>

<style scoped>
.audio-video-split-tool {
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
  width: 280px;
}

.upload-area {
  display: flex;
  justify-content: center;
}

.upload-placeholder {
  width: 100%;
  height: 200px;
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

.video-preview {
  width: 100%;
  position: relative;
  border-radius: var(--radius);
  overflow: hidden;
}

.video-player {
  width: 100%;
  max-height: 300px;
  display: block;
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

.video-preview:hover .delete-overlay {
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

.options-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--bg-soft);
  border-radius: var(--radius-sm);
}

.info-item .el-text {
  font-size: 13px;
  color: var(--text-2);
}

.info-value {
  font-size: 13px;
  font-weight: 500;
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

.audio-wave-container {
  background: var(--bg);
  border-radius: var(--radius-sm);
}

.wavesurfer-container {
  min-height: 80px;
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