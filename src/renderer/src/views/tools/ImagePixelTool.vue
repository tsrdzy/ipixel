<script setup>import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElCard, ElButton, ElSlider } from 'element-plus';
import { saveAs } from 'file-saver';
const { t } = useI18n();
const file = ref(null);
const fileName = ref('');
const fileBase64 = ref('');
const pixelSize = ref(5);
const processedBase64 = ref('');
const isProcessing = ref(false);
const fileInputRef = ref(null);
const canvasRef = ref(null);
function clickGetImage() {
 fileInputRef.value?.click();
}
function deleteImage() {
 file.value = null;
 fileName.value = '';
 fileBase64.value = '';
 processedBase64.value = '';
}
function onFileChange(e) {
 const selectedFile = e.target.files?.[0];
 if (!selectedFile)
 return;
 try {
 file.value = selectedFile;
 fileName.value = selectedFile.name;
 const reader = new FileReader();
 reader.onload = (event) => {
 fileBase64.value = event.target.result;
 processedBase64.value = '';
 };
 reader.readAsDataURL(selectedFile);
 } catch (err) {
 console.error('选择图片失败:', err);
 ElMessage.error(t('common.failed'));
 } finally {
 e.target.value = '';
 }
}
function processPixel() {
 if (!fileBase64.value) {
 ElMessage.warning(t('tools.selectImage'));
 return;
 }
 isProcessing.value = true;
 try {
 const img = new Image();
 img.onload = () => {
 const pixelRatio = Math.max(0.05, (10 - pixelSize.value) / 10);
 const scaledWidth = Math.max(1, Math.floor(img.width * pixelRatio));
 const scaledHeight = Math.max(1, Math.floor(img.height * pixelRatio));
 const tempCanvas = document.createElement('canvas');
 const tempCtx = tempCanvas.getContext('2d');
 tempCanvas.width = scaledWidth;
 tempCanvas.height = scaledHeight;
 tempCtx.drawImage(img, 0, 0, scaledWidth, scaledHeight);
 const outputCanvas = document.createElement('canvas');
 const ctx = outputCanvas.getContext('2d');
 outputCanvas.width = img.width;
 outputCanvas.height = img.height;
 ctx.imageSmoothingEnabled = false;
 ctx.drawImage(tempCanvas, 0, 0, scaledWidth, scaledHeight, 0, 0, img.width, img.height);
 processedBase64.value = outputCanvas.toDataURL('image/png');
 isProcessing.value = false;
 };
 img.src = fileBase64.value;
 }
 catch (err) {
 console.error('像素化失败:', err);
 ElMessage.error(t('common.failed'));
 isProcessing.value = false;
 }
}
async function exportImage() {
 if (!processedBase64.value) {
 ElMessage.warning('暂无处理结果');
 return;
 }
 try {
 const response = await fetch(processedBase64.value);
 const blob = await response.blob();
 const baseName = fileName.value.replace(/\.[^.]+$/, '');
 const newName = `${baseName}_pixel.png`;
 saveAs(blob, newName);
 ElMessage.success(t('tools.exportSuccess'));
 }
 catch (e) {
 console.error('导出失败:', e);
 ElMessage.error(t('common.failed'));
 }
}
async function saveToResources() {
 if (!processedBase64.value) {
 ElMessage.warning('暂无处理结果');
 return;
 }
 try {
 const response = await fetch(processedBase64.value);
 const blob = await response.blob();
 const arrayBuffer = await blob.arrayBuffer();
 const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
 const baseName = fileName.value.replace(/\.[^.]+$/, '');
 const newName = `${baseName}_pixel.png`;
 await window.api.images.save({
 name: newName.replace('.png', ''),
 fileName: newName,
 fileType: 'png',
 fileSize: blob.size,
 width: 0,
 height: 0,
 tags: []
 }, base64);
 ElMessage.success(t('tools.exportResources'));
 }
 catch (e) {
 console.error('导入失败:', e);
 ElMessage.error(t('common.failed'));
 }
}
</script>

<template>
  <div class="image-pixel-tool">
    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
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
            <div v-if="!fileBase64" @click="clickGetImage" class="upload-placeholder">
              <span class="upload-icon">+</span>
              <span class="upload-text">{{ t('tools.clickSelect') }}</span>
            </div>
            <div v-else class="image-preview">
              <img :src="fileBase64" class="preview-image" />
              <div @click="deleteImage" class="delete-overlay">
                <span class="delete-icon iconfont">&#xeb6c;</span>
              </div>
            </div>
          </div>
        </ElCard>

        <ElCard class="options-card">
          <template #header>
            <span>{{ t('tools.pixelSettings') }}</span>
          </template>
          <div class="options-content">
            <div class="options-info">
              <div class="info-item">
                <ElText>{{ t('tools.fileName') }}</ElText>
                <span class="info-value">{{ fileName || '-' }}</span>
              </div>
            </div>
            <div class="pixel-control">
              <div class="control-label">
                <span>{{ t('tools.pixelLevel') }}</span>
                <span class="control-value">{{ pixelSize }}</span>
              </div>
              <ElSlider
                v-model="pixelSize"
                :min="1"
                :max="10"
                :step="1"
                :show-input="false"
                @change="processPixel"
              />
              <div class="control-tips">{{ t('tools.pixelTips') }}</div>
            </div>
            <div class="process-btn-container">
              <ElButton type="primary" style="width: 100%" :loading="isProcessing" @click="processPixel">
                {{ t('tools.process') }}
              </ElButton>
            </div>
          </div>
        </ElCard>
      </div>

      <ElCard class="result-card" v-if="processedBase64">
        <template #header>
          <div class="result-header">
            <span>{{ t('tools.processResult') }}</span>
            <div class="result-actions">
              <ElButton size="small" @click="exportImage">
                {{ t('tools.exportLocal') }}
              </ElButton>
              <ElButton size="small" type="primary" @click="saveToResources">
                {{ t('tools.exportResources') }}
              </ElButton>
            </div>
          </div>
        </template>
        <div class="result-preview">
          <img :src="processedBase64" class="result-image" />
        </div>
      </ElCard>
    </div>
  </div>
</template>

<style scoped>
.image-pixel-tool {
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

.image-preview {
  width: 100%;
  position: relative;
  border-radius: var(--radius);
  overflow: hidden;
}

.preview-image {
  width: 100%;
  max-height: 300px;
  display: block;
  object-fit: contain;
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

.image-preview:hover .delete-overlay {
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
  gap: 16px;
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

.pixel-control {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: var(--text-2);
}

.control-value {
  font-weight: 600;
  color: var(--primary);
}

.control-tips {
  font-size: 12px;
  color: var(--text-4);
}

.process-btn-container {
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

.result-preview {
  display: flex;
  justify-content: center;
  padding: 16px;
}

.result-image {
  max-width: 100%;
  max-height: 400px;
  border-radius: var(--radius-sm);
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