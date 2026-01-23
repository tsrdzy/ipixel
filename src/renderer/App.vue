<template>
  <Theader></Theader>
  <main>
    <Tsidebar></Tsidebar>
    <router-view></router-view>
  </main>

</template>

<script setup>
import Theader from '@/components/header/index.vue';
import Tsidebar from '@/components/sidebar/index.vue';
import { useIpixelStore } from '@/pinia/ipixel';
import { onMounted, watch } from 'vue';
const ipixelStore = useIpixelStore()
onMounted(() => {
  inittheme()
})
async function inittheme() {
  const theme = await store.get('theme')
  if (theme == undefined || theme == '') {
    ipixelStore.theme = 'dark'
    document.documentElement.classList = []
    document.documentElement.classList.add('cark')
  } else {
    document.documentElement.classList = []
    document.documentElement.classList.add(theme)
  }
}
watch(() => ipixelStore.theme, (newData) => {
  store.set('theme', newData)
  document.documentElement.classList = []
  document.documentElement.classList.add(newData)
})
</script>



<style lang="scss">
#app {
  position: relative;
  display: flex;
  flex-direction: column;
}

main {
  position: relative;
  display: flex;
  flex: 1;
  height: calc(100% - 50px);
}
</style>
