<template>
  <aside>
    <nav class="top">
      <div
        class="iconfont btn"
        :class="router.currentRoute.value.path == '/local' ? 'active' : ''"
        @click="navigateTo('/local')"
      >
        &#xeb1a;
      </div>
      <div
        class="iconfont btn"
        :class="router.currentRoute.value.path == '/store' ? 'active' : ''"
        @click="navigateTo('/store')"
      >
        &#xeafd;
      </div>
      <div
        class="iconfont btn"
        :class="router.currentRoute.value.path == '/shop' ? 'active' : ''"
        @click="navigateTo('/shop')"
      >
        &#xeb5e;
      </div>
      <div
        class="iconfont btn"
        :class="router.currentRoute.value.path == '/tools' ? 'active' : ''"
        @click="navigateTo('/tools')"
      >
        &#xeb64;
      </div>
    </nav>
    <nav class="bottom">
      <div class="iconfont btn">&#xeb6f;</div>

      <el-dropdown popper-class="sidebar_dropdown" :show-arrow="false" size="small" trigger="click">
        <div class="iconfont btn">&#xeb3a;</div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="iscreateresources = true">创建资源库</el-dropdown-item>
            <el-dropdown-item @click="isopenresources = true">打开资源库</el-dropdown-item>
            <el-dropdown-item divided @click="issetting = true">设置</el-dropdown-item>
            <el-dropdown-item divided @click="ischeckupdates = true">检查更新</el-dropdown-item>
            <el-dropdown-item @click="isabout = true">关于ipixel</el-dropdown-item>
            <el-dropdown-item divided>退出</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </nav>
    <el-dialog
      draggable
      :close-on-click-modal="iscreateresources1"
      :close-on-press-escape="iscreateresources1"
      :show-close="iscreateresources1"
      v-model="iscreateresources"
      title="创建资源库"
      width="50%"
      align-center
    >
      <Tcreateresources @cancel="createresourcescancel"></Tcreateresources>
    </el-dialog>
    <el-dialog draggable v-model="isopenresources" title="打开资源库" width="30%" align-center>
      <Topenresources @cancel="openresourcescancel"></Topenresources>
    </el-dialog>
    <el-dialog draggable v-model="issetting" title="设置" width="50%" align-center>
      <Tsettings></Tsettings>
    </el-dialog>
    <el-dialog draggable v-model="ischeckupdates" title="检查更新" width="300" align-center>
      <Tcheckupdates></Tcheckupdates>
    </el-dialog>
    <el-dialog draggable v-model="isabout" title="关于ipixel" width="300" align-center>
      <Tabout></Tabout>
    </el-dialog>
  </aside>
</template>

<script setup>
import Tabout from '@/components/sidebar/components/about.vue'
import Tcheckupdates from '@/components/sidebar/components/checkupdates.vue'
import Tsettings from '@/components/sidebar/components/settings/index.vue'
import Tcreateresources from '@/components/sidebar/components/createresources/index.vue'
import Topenresources from '@/components/sidebar/components/openresources/index.vue'
import { useRouter } from 'vue-router'
import { onMounted, ref, watch } from 'vue'
import { useLocalStore } from '@/pinia/local'
import { fa } from 'element-plus/es/locale/index.mjs'
const localStore = useLocalStore()
const issetting = ref(false)
const iscreateresources = ref(true)
const isopenresources = ref(false)
const ischeckupdates = ref(false)
const isabout = ref(false)
const iscreateresources1 = ref(false)
const router = useRouter()
function navigateTo(route) {
  router.push(route)
}
function createresourcescancel(data) {
  iscreateresources.value = false
}
function openresourcescancel(data) {
  isopenresources.value = false
}
// function iscreateresources() {
//     localStore.isShowCreateResources = true
// }
// function isopenresources() {
//     localStore.isShowOpenResources = true
// }
onMounted(async () => {
  const dbfolder = await db.createfolder()
  if (dbfolder?.state == 'error') {
    iscreateresources.value = true
    iscreateresources1.value = false
  } else {
    iscreateresources.value = false
    iscreateresources1.value = true
    const lists = await store.get('resourcess')
    for (var i = 0; i < lists.length; i++) {
      if (lists[i].isSelect) {
        localStore.resourcesURL = lists[i].path + '\\' + lists[i].name
        return
      }
    }
    // localStore.resourcesURL = resourcespath.value
  }
})
watch(
  () => localStore.resourcesURL,
  async () => {
    const dbfolder = await db.createfolder()
    if (dbfolder?.state == 'error') {
      iscreateresources.value = true
      iscreateresources1.value = false
    } else {
      iscreateresources.value = false
      iscreateresources1.value = true
    }
  }
)
</script>

<style lang="scss" scoped>
aside {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 49px;
  max-width: 49px;
  width: 49px;
  position: relative;
  top: 0;
  bottom: 0;
  left: 0;
  border-right: 1px solid var(--el-border-color);
  padding: 4px 0;

  .top {
    flex: 1;
  }

  .top,
  .bottom {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;

    .btn {
      width: 28px;
      height: 28px;
      border-radius: 3px;
      border: 1px solid var(--el-border-color);
      display: flex;
      justify-content: center;
      align-items: center;
      user-select: none;
      -webkit-user-select: none;

      &:hover {
        background-color: #77777733;
      }
    }

    .active {
      border: 1px solid var(--el-color-primary);
      color: var(--el-color-primary);
    }
  }
}
</style>
