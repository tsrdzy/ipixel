<script setup>
import { computed } from 'vue'

const props = defineProps({
  model: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  isDragging: { type: Boolean, default: false }
})
const emit = defineEmits(['select', 'dblclick'])

function formatSize(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const dimText = computed(() => {
  const d = props.model.dimensions
  if (!d || (!d.x && !d.y && !d.z)) return '—'
  return `${d.x} × ${d.y} × ${d.z}`
})

function handleClick(e) {
  if (props.isDragging) {
    return
  }
  console.log('[ModelCard] handleClick triggered')
  console.log('[ModelCard] event:', {
    ctrlKey: e.ctrlKey,
    metaKey: e.metaKey,
    shiftKey: e.shiftKey,
    type: e.type,
    target: e.target.tagName
  })
  console.log('[ModelCard] model id:', props.model.id)
  console.log('[ModelCard] current selected:', props.selected)
  emit('select', props.model, e)
}

function handleDblClick(e) {
  e.preventDefault()
  emit('dblclick', props.model)
}
</script>

<template>
  <el-card class="card" :class="{ selected }" shadow="hover" @click="handleClick" @dblclick="handleDblClick">
    <div class="cover">
      <img v-if="model.coverBase64" :src="model.coverBase64" alt="cover" draggable="false" @mousedown.prevent />
      <div v-else class="cover-placeholder">
        <span>无预览图</span>
      </div>
      <span class="file-type-tag">
        <i class="iconfont icon-file"></i>
        {{ (model.fileType || '').toUpperCase() }}
      </span>
      <i v-if="model.animationCount && model.animationCount > 0"
         class="iconfont icon-movie anim-icon"
         :title="`${model.animationCount} 个动画`"></i>
    </div>
    <div class="info">
      <div class="title" :title="model.name">{{ model.name || '未命名模型' }}</div>
      <div class="tags" v-if="model.tags && model.tags.length">
        <el-tag
          v-for="t in model.tags.slice(0, 4)"
          :key="t"
          size="small"
        >
          {{ t }}
        </el-tag>
        <span v-if="model.tags.length > 4" class="more">+{{ model.tags.length - 4 }}</span>
      </div>
      <div class="meta">
        <span>{{ dimText }}</span>
        <span>{{ formatSize(model.fileSize) }}</span>
      </div>
      <div class="date">{{ formatDate(model.uploadTime) }}</div>
    </div>
  </el-card>
</template>

<style scoped>
.card {
  cursor: pointer;
  transition: transform 0.15s, border-color 0.2s;
  position: relative;
}
.card:hover {
  transform: translateY(-2px);
}
.card.selected {
  border-color: var(--el-color-primary);
}
.card.selected :deep(.el-card__body) {
  background: var(--el-color-primary-light-9);
}
.card :deep(.el-card__body) {
  padding: 0;
}
.cover {
  position: relative;
  aspect-ratio: 4 / 3;
  background: var(--bg-mute);
  display: flex;
  align-items: center;
  justify-content: center;
}
.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cover-placeholder {
  color: var(--text-3);
  font-size: 13px;
}
.file-type-tag {
  position: absolute;
  top: 8px;
  left: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: 11px;
  color: #fff;
  background: rgba(0, 0, 0, 0.55);
  border-radius: 4px;
  letter-spacing: 0.5px;
  backdrop-filter: blur(6px);
}
.file-type-tag .iconfont {
  font-size: 12px;
}
.anim-icon {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 18px;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}
.info {
  padding: 12px 14px;
}
.title {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 8px;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}
.more {
  font-size: 11px;
  color: var(--text-3);
  padding: 1px 4px;
}
.meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-2);
}
.date {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 4px;
}
</style>
