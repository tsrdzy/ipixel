<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElDialog } from 'element-plus'
import ImageSplitTool from './tools/ImageSplitTool.vue'
import ImageMergeTool from './tools/ImageMergeTool.vue'

const { t } = useI18n()

const activeCategory = ref('image')
const dialogVisible = ref(false)
const selectedTool = ref(null)

const categories = [
  { key: 'image', label: t('tools.image') },
  { key: 'video', label: t('tools.video') },
  { key: 'audio', label: t('tools.audio') },
  { key: 'font', label: t('tools.font') },
  { key: 'model', label: t('tools.model') },
  { key: 'other', label: t('tools.other') }
]

const tools = {
  image: [
    { id: 'split', name: t('tools.imageSplit'), description: t('tools.imageSplitDesc') },
    { id: 'merge', name: t('tools.imageMerge'), description: t('tools.imageMergeDesc') }
  ],
  video: [],
  audio: [],
  font: [],
  model: [],
  other: []
}

function selectTool(tool) {
  selectedTool.value = tool
  dialogVisible.value = true
}

function closeDialog() {
  dialogVisible.value = false
}
</script>

<template>
  <div class="tool-view">
    <div class="tool-header">
      <h2>{{ t('sidebar.tools') }}</h2>
      <div class="category-tabs">
        <button
          v-for="cat in categories"
          :key="cat.key"
          class="category-tab"
          :class="{ active: activeCategory === cat.key }"
          @click="activeCategory = cat.key"
        >
          {{ cat.label }}
          <span v-if="tools[cat.key]?.length" class="category-count">{{ tools[cat.key].length }}</span>
        </button>
      </div>
    </div>

    <div class="tool-body">
      <div v-if="tools[activeCategory]?.length > 0" class="tool-grid">
        <div
          v-for="tool in tools[activeCategory]"
          :key="tool.id"
          class="tool-card"
          @click="selectTool(tool)"
        >
          <div class="tool-info">
            <h3 class="tool-name">{{ tool.name }}</h3>
            <p class="tool-desc">{{ tool.description }}</p>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        <p>{{ t('tools.noTools') }}</p>
      </div>
    </div>

    <ElDialog
      v-model="dialogVisible"
      :title="selectedTool?.name"
      width="900px"
      top="5vh"
      destroy-on-close
    >
      <ImageSplitTool v-if="selectedTool?.id === 'split'" />
      <ImageMergeTool v-if="selectedTool?.id === 'merge'" />
    </ElDialog>
  </div>
</template>

<style scoped>
.tool-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.tool-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-soft);
  background: var(--bg-soft);
}

.tool-header h2 {
  font-size: 20px;
  margin: 0 0 12px 0;
  font-weight: 600;
}

.category-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.category-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.category-tab:hover {
  border-color: var(--border);
  background: var(--bg-hover);
}

.category-tab.active {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}

.category-count {
  font-size: 12px;
  background: var(--border);
  color: var(--text-2);
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
}

.category-tab.active .category-count {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.tool-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.tool-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--bg-soft);
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.tool-card:hover {
  background: var(--bg-hover);
  border-color: var(--border);
}

.tool-info {
  flex: 1;
  min-width: 0;
}

.tool-name {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 4px 0;
}

.tool-info .tool-desc {
  font-size: 13px;
  color: var(--text-3);
  margin: 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  color: var(--text-3);
}

.empty-state p {
  font-size: 16px;
  margin: 0;
}
</style>
