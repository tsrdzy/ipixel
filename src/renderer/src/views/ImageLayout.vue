<script setup>
import { computed, onMounted } from 'vue'
import { useStore } from '../composables/useStore'
import { useImageState } from '../composables/useImageState'
import ImageView from './ImageView.vue'
import ImageUploadView from './ImageUploadView.vue'

const { state: storeState } = useStore()
const { state: imageState, reset } = useImageState()

const showList = computed(() => {
  return storeState.initialized && imageState.view === 'list'
})
const showUpload = computed(() => {
  return storeState.initialized && imageState.view === 'upload'
})

onMounted(() => {
  reset()
})
</script>

<template>
  <ImageView v-if="showList" />
  <ImageUploadView v-else-if="showUpload" />
  <div v-else class="empty-layout">
    <p>请先打开资源库</p>
  </div>
</template>

<style scoped>
.empty-layout {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-3);
}
</style>
