<script setup>
import { useStore } from '../composables/useStore'
import InitView from './InitView.vue'
import HomeView from './HomeView.vue'
import UploadView from './UploadView.vue'

const { state } = useStore()
</script>

<template>
  <InitView v-if="state.view === 'init'" />
  <HomeView v-else-if="state.view === 'home'" />
  <UploadView v-else-if="state.view === 'upload' || state.view === 'edit'" />
</template>
