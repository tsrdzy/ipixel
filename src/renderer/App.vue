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
