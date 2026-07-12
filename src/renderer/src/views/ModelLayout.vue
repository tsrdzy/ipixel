<script setup>
import { useStore } from '../composables/useStore'
import HomeView from './HomeView.vue'
import UploadView from './UploadView.vue'

const { state } = useStore()
</script>

<template>
  <HomeView v-if="state.view === 'home'" />
  <UploadView v-else-if="state.view === 'upload' || state.view === 'edit'" />
</template>
