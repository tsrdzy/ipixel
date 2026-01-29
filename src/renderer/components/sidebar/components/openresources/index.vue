<template>
  <div>
    <el-text class="title">资源库列表</el-text>
    <div class="cards">
      <div
        :class="localStore?.resourcesURL == list?.path + '\\' + list?.name ? 'active' : ''"
        class="card"
        :style="
          currentlyselected?.path + '\\' + currentlyselected?.name == list?.path + '\\' + list?.name
            ? 'border:2px solid var(--el-color-primary)'
            : 'border:2px solid #777777'
        "
        :key="list"
        v-for="list in lists"
        @click="currentlyselected = list"
      >
        {{ list.name }}
      </div>
      <div style="display: flex">
        <div class="card card_add"><span class="iconfont">&#xeb4e;</span> 导入资源库</div>
        <div @click="opencreate" class="card card_add">
          <span class="iconfont">&#xeb4e;</span> 创建资源库
        </div>
      </div>
    </div>
    <div class="btns">
      <el-button class="btn" @click="setresources">确定</el-button>
    </div>
  </div>
</template>

<script setup>
import { ElNotification } from 'element-plus'
import { ref, onMounted } from 'vue'
import { useLocalStore } from '@/pinia/local'
const localStore = useLocalStore()
const lists = ref([])
const currentlyselected = ref()
const emit = defineEmits(['cancel', 'opencreate'])
onMounted(async () => {
  lists.value = await store.get('resourcess')
  for (var i = 0; i < lists.value.length; i++) {
    if (lists.value[i].isSelect) {
      currentlyselected.value = lists.value[i]
      return
    }
  }
})
async function setresources() {
  for (let i = 0; i < lists.value.length; i++) {
    if (
      currentlyselected.value.path + '\\' + currentlyselected.value.name ==
      lists.value[i].path + '\\' + lists.value[i].name
    ) {
      lists.value[i].isSelect = true
    } else {
      lists.value[i].isSelect = false
    }
  }
  const a = await store.set('resourcess', JSON.parse(JSON.stringify(lists.value)))
  if (!a) {
    localStore.resourcesURL = currentlyselected.value.path + '\\' + currentlyselected.value.name
  }
  emit('cancel', false)
}
function opencreate() {
  emit('cancel', false)
  emit('opencreate', true)
}
</script>

<style lang="scss" scoped>
.cards {
  border: 1px solid;
  border-radius: 3px;
  // padding: 4px;
  min-height: 200px;
  max-height: 300px;

  .card {
    border: 1px solid;
    padding: 4px;
    margin: 4px;
    border-radius: 3px;

    &:hover {
      background-color: #77777744;
    }
  }

  .card_add {
    border: 1px dashed;
  }

  .active {
    background-color: #77777722;
  }
}
.btns {
  display: flex;
  justify-content: right;
  margin: 4px 0;
}
</style>
