<template>
  <div class="tree">
    <div class="header" v-if="!isSearch">
      <div class="title" @click="titleClick">
        <el-text class="iconfont"></el-text>
        <el-text>{{ props.type == 'folder' ? '文件夹' : '标签' }}</el-text>
      </div>
      <div class="btns">
        <div class="btn iconfont" @click="isSearch = true">&#xeb59;</div>
        <div class="btn iconfont" @click="add">&#xeb19;</div>
      </div>
    </div>
    <div class="search" v-else>
      <el-input size="small" v-model="filterText" placeholder="搜索文件夹">
        <template #suffix>
          <div class="iconfont close" @click="closeSearch">&#xeafc;</div>
        </template>
      </el-input>
    </div>
    <div class="main">
      <el-scrollbar height="100%">
        <el-tree
          :empty-text="`当前${props.type == 'tag' ? '标签' : '文件夹'}列表为空`"
          node-key="id"
          :default-expanded-keys="expanded"
          ref="treeRef"
          class="tree_1"
          :data="data"
          :filter-node-method="filterNode"
          @node-click="treeClick"
          @node-expand="treeExpand"
          @node-collapse="treeCollapse"
        >
          <template #default="{ node }">
            <el-text class="iconfont" :style="'color:' + node.color + ';'">
              {{ props.type == 'folder' ? '&#xeb1a; ' : '&#xeb2a; ' }}</el-text
            >
            <el-text>{{ node.label }}</el-text>
          </template>
        </el-tree>
      </el-scrollbar>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import * as api from '@/apis/resourcesdb/index.js'
import { useLocalStore } from '@/pinia/local'
const localStore = useLocalStore()
const data = ref([])
const expanded = ref([])
const isSearch = ref(false)
const treeRef = ref()
const filterText = ref('')
const props = defineProps({
  type: {
    type: String,
    default: 'folder'
  }
})
onMounted(() => {
  getlist()
})
watch(
  () => localStore.resourcesURL,
  (newData) => {
    getlist()
  }
)
watch(
  () => filterText.value,
  (val) => {
    treeRef.value?.filter(val)
  }
)
//刷新列表
async function getlist() {
  if (props.type == 'folder') {
    const d = await api.DB_getfolderslist()
    data.value = d[0]
    expanded.value = d[1]
  } else if (props.type == 'tag') {
    const d = await api.DB_gettagslist()
    data.value = d[0]
    expanded.value = d[1]
  }
}
//添加文件夹
function add() {
  if (props.type == 'folder') {
    api.DB_createfolder(localStore.currentlySelectedFolderID)
    api.DB_updatefolder(localStore.currentlySelectedFolderID, { expanded: true })
  } else if (props.type == 'tag') {
    api.DB_createtag(localStore.currentlySelectedTagID)
    api.DB_updatetag(localStore.currentlySelectedTagID, { expanded: true })
  }
  getlist()
}
//节点被单击
function treeClick(Node) {
  if (props.type == 'folder') {
    localStore.currentlySelectedFolderID = Node.id
    localStore.currentlySelectedID = Node.id
    localStore.currentlySelectedType = 'folder'
    localStore.getWhere.folder_id = { key: 'folder_id', value: Node.id, operator: '=', type: 'AND' }
  } else if (props.type == 'tag') {
    localStore.currentlySelectedTagID = Node.id
    localStore.currentlySelectedID = Node.id
    localStore.currentlySelectedType = 'tag'
  }
}
//节点被展开
function treeExpand(Node) {
  if (props.type == 'folder') {
    api.DB_updatefolder(Node.id, { expanded: true })
  } else if (props.type == 'tag') {
    api.DB_updatetag(Node.id, { expanded: true })
  }
}
//节点被隐藏
function treeCollapse(Node) {
  if (props.type == 'folder') {
    api.DB_updatefolder(Node.id, { expanded: false })
  } else if (props.type == 'tag') {
    api.DB_updatetag(Node.id, { expanded: false })
  }
}
function titleClick() {
  if (props.type == 'folder') {
    localStore.currentlySelectedFolderID = 'ALL'
    localStore.currentlySelectedID = 'ALL'
    localStore.getWhere.folder_id = 'ALL'
    localStore.currentlySelectedType = 'folder'
  } else if (props.type == 'tag') {
  }
}
function closeSearch() {
  filterText.value = ''
  isSearch.value = false
}
const filterNode = (value, data) => {
  if (!value) return true
  return data.label.includes(value)
}
</script>

<style lang="scss" scoped>
.tree {
  height: 100%;
  display: flex;
  flex-direction: column;
  .search {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 4px;
    .close {
      border-radius: 50%;
      background-color: #77777744;
      height: 14px;
      width: 14px;
      font-size: 8px;
      line-height: 14px;
      text-align: center;
      &:hover {
        background-color: #77777766;
      }
    }
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 24px;
    padding: 4px;

    .title {
      height: 24px;
      line-height: 24px;
      padding: 0 4px;
      border-radius: 4px;

      &:hover {
        background-color: #77777722;
      }
    }

    .btns {
      display: flex;
      gap: 4px;

      .btn {
        width: 20px;
        height: 20px;
        line-height: 20px;
        border-radius: 3px;
        text-align: center;
        border: 1px solid #77777755;
      }
    }
  }

  .main {
    max-height: calc(100vh - 112px);
    flex: 1;

    .tree_1 {
      height: 100%;
    }
  }
}
</style>
