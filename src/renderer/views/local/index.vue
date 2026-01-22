<template>
  <div class="local">
    <el-splitter>
      <el-splitter-panel size="170" :collapsible="true" min="170" max="250">
          <Tsidebar></Tsidebar>
      </el-splitter-panel>
      <el-splitter-panel max="100%">
        <div class="main_content">
          <Theader></Theader>
          <Tcards></Tcards>
          <Tsetresources :folderURL="folderURL"></Tsetresources>
        </div>
      </el-splitter-panel>
      <el-splitter-panel size="200" :collapsible="true" min="150" max="200">
          <Tparticulars></Tparticulars>
      </el-splitter-panel>
    </el-splitter>
  </div>
</template>

<script setup>
import Theader from '@/views/local/components/header/index.vue';
import Tcards from '@/views/local/components/cards/index.vue';
import Tsetresources from '@/views/local/components/setresources/index.vue';
import Tsidebar from '@/views/local/components/sidebar/index.vue'
import Tparticulars from '@/views/local/components/particulars/index.vue'
import { onMounted, ref } from 'vue';
const folderURL = ref('');
onMounted(async () => {
  const url = await store.get('resourcespath')
  if (url != undefined && url != '')
    folderURL.value = url
});

</script>

<style lang="scss" scoped>
.local {
  position: relative;
  display: flex;
  width: calc(100% - 8px);
  height: 100%;

  .main_left {
    height: calc(100%);
  }

  .main_content {
    flex: 1;
    padding: 4px;
    height: calc(100% - 56px);
    display: flex;
    flex-direction: column;
  }

  .main_right {
    padding: 4px;
  }

}
</style>
