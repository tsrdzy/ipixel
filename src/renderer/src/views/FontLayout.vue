<script setup>
import { computed, onMounted } from 'vue'
import { useStore } from '../composables/useStore'
import { useFontState } from '../composables/useFontState'
import FontView from './FontView.vue'
import FontUploadView from './FontUploadView.vue'

const { state: storeState } = useStore()
const { state: fontState, reset } = useFontState()

const showList = computed(() => {
  return storeState.initialized && fontState.view === 'list'
})
const showUpload = computed(() => {
  return storeState.initialized && fontState.view === 'upload'
})

onMounted(() => {
  reset()
})
</script>

<template>
  <FontView v-if="showList" />
  <FontUploadView v-else-if="showUpload" />
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
