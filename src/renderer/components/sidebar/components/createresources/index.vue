<template>
  <div class="cards">
    <div class="card">
      <el-text>资源库名称</el-text>
      <el-input v-model="resourcesname" placeholder="资源库文件夹名称">
        <!-- <template #prepend>资源库名称</template> -->
      </el-input>
    </div>
    <div class="card">
      <el-text> 资源库图标 </el-text>
      <!-- <el-input v-model="resourcesicon" placeholder="资源库显示的图标">
            </el-input> -->
      <el-button style="width: 100%">
        <span class="icon iconfont">&#xeb1a;</span>
      </el-button>
    </div>
    <div class="card">
      <el-text> 资源库路径 </el-text>
      <el-input v-model="resourcespath" placeholder="储存资源库的路径">
        <!-- <template #prepend>资源库路径</template> -->
        <template #suffix>
          <span class="iconfont" @click="setfolder">...</span>
        </template>
      </el-input>
    </div>
    <div class="card">
      <el-text> 储存方式 </el-text>
      <el-radio-group v-model="storageMethod">
        <el-radio value="copy" size="large">拷贝</el-radio>
        <el-radio value="cut" size="large">剪切</el-radio>
        <el-radio value="link" size="large">链接</el-radio>
      </el-radio-group>
    </div>
    <div class="btns">
      <el-button @click="cancel">取消</el-button>
      <el-button type="primary" @click="createresources">创建</el-button>
    </div>
  </div>
</template>

<script setup>
import { ElNotification } from 'element-plus'
import { ref, onMounted } from 'vue'
import { useLocalStore } from '@/pinia/local'
const localStore = useLocalStore()
const resourcesname = ref('resources')
const resourcesicon = ref('')
const resourcespath = ref('')
const storageMethod = ref('copy')
const emit = defineEmits(['cancel'])
onMounted(async () => {
  const data = await store.get('resourcess')
  let url = ''
  console.log(data)
  for (var i = 0; i < data.length; i++) {
    if (data[i].isSelect == true) {
      url = data[i].path + '\\' + data[i].name
    }
  }
  console.log(url)
  if (url != undefined && url != '') {
    localStore.resourcesURL = url
  }
})
function cancel() {
  localStore.isShowCreateResources = false
  emit('cancel', false)
}
async function setfolder() {
  const _path = await file.openFileSelecter()
  if (!_path) return
  resourcespath.value = _path.filePaths[0]
}
async function createresources() {
  if (resourcesname.value == '') {
    ElNotification({
      title: '创建失败',
      message: '资源库名称不能为空',
      position: 'bottom-right',
      type: 'warning'
    })
    return
  }
  if (resourcespath.value == '') {
    ElNotification({
      title: '创建失败',
      message: '请选择资源库路径',
      position: 'bottom-right',
      type: 'warning'
    })
    return
  }
  localStore.resourcesURL = resourcespath.value
  const data = {
    id: '',
    path: resourcespath.value,
    name: resourcesname.value,
    storagemethod: storageMethod.value,
    icon: resourcesicon.value,
    isSelect: true
  }
  let resourcess = await store.get('resourcess')
  if (resourcess == undefined || resourcess == '') {
    resourcess = []
  }
  for (var i = 0; i < resourcess.length; i++) {
    resourcess[i].isSelect = false
  }
  resourcess.push(data)
  await store.set('resourcess', resourcess)
  db.createfolder()
}
</script>

<style lang="scss" scoped>
.cards {
  display: flex;
  flex-direction: column;
  gap: 4px;
  height: 100%;

  .card {
    display: flex;

    .el-text {
      min-width: 100px;
      max-width: 100px;
    }

    .icon {
      height: 32px;
      line-height: 32px;
      font-size: 20px;
    }
  }
}

.btns {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  flex: 1;

  .el-button {
    align-self: flex-end;
  }
}
</style>
