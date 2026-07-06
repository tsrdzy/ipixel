<script setup>
import { computed, onMounted } from 'vue'
import { useStore } from '../composables/useStore'
import { useAudioState } from '../composables/useAudioState'
import AudioView from './AudioView.vue'
import AudioUploadView from './AudioUploadView.vue'

const { state: storeState } = useStore()
const { state: audioState, reset } = useAudioState()

const showList = computed(() => {
  return storeState.initialized && audioState.view === 'list'
})
const showUpload = computed(() => {
  return storeState.initialized && audioState.view === 'upload'
})

onMounted(() => {
  reset()
})
</script>

<template>
  <AudioView v-if="showList" />
  <AudioUploadView v-else-if="showUpload" />
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
