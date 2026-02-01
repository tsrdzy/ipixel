<template>
  <div class="particulars">
    <div class="resources" v-if="localStore.currentlySelectedType == 'resources'">
      <div class="content">
        <div class="title">名称:</div>
        <el-input
          @keydown.enter="nameBlur"
          @blur="nameBlur"
          class="value"
          v-model="name"
          size="small"
        >
          <template #suffix>{{ type }}</template>
        </el-input>
      </div>
      <div class="content">
        <div class="title">标签:</div>
        <div class="value">
          <!-- <el-input-tag v-model="tags" size="small" placeholder="标签" aria-label="标签" /> -->
          <el-select
            @change="settag"
            v-model="tags"
            multiple
            filterable
            allow-create
            default-first-option
            :reserve-keyword="false"
            placeholder="标签"
            size="small"
          >
            <el-option
              v-for="item in tagoptions"
              :key="item?.id"
              :label="item?.label"
              :value="item?.id"
            />
          </el-select>
        </div>
      </div>
      <div class="content">
        <div class="title">评分:</div>
        <div class="value">
          <el-rate @change="setRating" v-model="rating" :max="5" :allow-half="false" size="small" />
        </div>
      </div>
      <div class="content">
        <div class="title">类型:</div>
        <el-input size="small" disabled v-model="data.format" class="value"></el-input>
      </div>
      <div class="content">
        <div class="title">大小:</div>
        <el-input size="small" disabled v-model="size" class="value"></el-input>
      </div>
      <div class="content">
        <div class="title">宽度:</div>
        <el-input size="small" v-model="data.width" disabled class="value"> </el-input>
      </div>
      <div class="content">
        <div class="title">高度:</div>
        <el-input size="small" disabled v-model="data.height" class="value"></el-input>
      </div>
      <div class="content">
        <div class="title">导入时间:</div>
        <el-input size="small" disabled v-model="created_at" class="value"></el-input>
      </div>
      <div class="content">
        <el-button size="small" :disabled="!(resourcesdata[0]?.format == '.png')"
          >分割精灵图</el-button
        >
      </div>
      <div class="content">
        <el-button size="small" :disabled="!(resourcesdata[0]?.format == '.png')"
          >创建动画</el-button
        >
      </div>
    </div>
    <div class="folder" v-else-if="localStore.currentlySelectedType == 'folder'">
      <div class="logo iconfont">&#xeb1a;</div>
      <div class="title">文件夹</div>
      <div class="content">
        <el-text>资源数量:{{ resourcescount }}</el-text>
      </div>
      <div class="content">
        <el-text>创建时间:</el-text>
      </div>
      <div class="content">
        <el-text>颜色:</el-text>
      </div>
    </div>

    <div class="folder" v-else-if="localStore.currentlySelectedType == 'tag'">
      <div class="logo iconfont">&#xeb2a;</div>
      <div class="title">标签</div>
      <div class="content">
        <el-text>资源数量:{{ resourcescount }}</el-text>
      </div>
      <div class="content">
        <el-text>创建时间:</el-text>
      </div>
      <div class="content">
        <el-text>颜色:</el-text>
      </div>
    </div>
    <div class="empty" v-else>
      <el-empty description="未选择" />
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { useLocalStore } from '@/pinia/local'
import * as api from '@/apis/resourcesdb/resources.js'
import * as apitag from '@/apis/resourcesdb/tag.js'
const localStore = useLocalStore()
const resourcescount = ref(0)
const resourcesdata = ref({})
const rating = ref(0)
const name = ref('')
const type = ref('')
const size = ref('')
const created_at = ref('')
const data = ref({})
const tags = ref([])
const tagoptions = ref([])
onMounted(async () => {
  tagoptions.value = (await apitag.DB_gettagslist())[0]
  console.log(tagoptions.value)
})
watch(
  () => localStore.currentlySelectedID,
  async (newData) => {
    if (localStore.currentlySelectedType == 'folder') {
      const data = await api.DB_getresourcescount('resources', 'folder_id', newData)
      resourcescount.value = data[0]['COUNT(*)']
    } else if (localStore.currentlySelectedType == 'tag') {
      const data = await api.DB_getresourcescount('resource_tags', 'tag_id', newData)
      resourcescount.value = data[0]['COUNT(*)']
    } else if (localStore.currentlySelectedType == 'resources') {
      resourcesdata.value = await api.DB_getresourceslist([
        {
          key: 'id',
          value: newData,
          operator: '='
        }
      ])
      rating.value = resourcesdata.value[0]?.rating
      name.value = resourcesdata.value[0]?.name.substring(
        0,
        resourcesdata.value[0]?.name.lastIndexOf('.')
      )
      type.value = resourcesdata.value[0]?.name.substring(
        resourcesdata.value[0]?.name.lastIndexOf('.')
      )
      size.value =
        resourcesdata.value[0]?.size / 1024 < 1024
          ? (resourcesdata.value[0]?.size / 1024).toFixed(2) + 'kb'
          : (resourcesdata.value[0]?.size / 1024).toFixed(2) + 'mb'
      created_at.value = totime(resourcesdata.value[0]?.created_at)
      data.value = resourcesdata.value[0]
    }
  }
)
const totime = (date1) => {
  const date = new Date(date1 * 1000) // 时间戳需要毫秒数，所以乘以1000

  const Y = date.getFullYear()
  const M = String(date.getMonth() + 1).padStart(2, '0') // 月份补零
  const D = String(date.getDate()).padStart(2, '0') // 日期补零
  const h = String(date.getHours()).padStart(2, '0') // 小时补零
  const m = String(date.getMinutes()).padStart(2, '0') // 分钟补零
  const s = String(date.getSeconds()).padStart(2, '0') // 秒补零

  return `${Y}-${M}-${D} ${h}:${m}:${s}` // 使用模板字符串拼接
}
async function nameBlur() {
  await api.DB_setresources(data.value.id, { name: name.value + data.value.format })
}
async function setRating(ra) {
  await api.DB_setresources(data.value.id, { rating: ra })
}
async function settag() {
  console.log(tags.value)
}
</script>

<style lang="scss" scoped>
.particulars {
  padding: 5px;

  .folder {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;

    .logo {
      font-size: 40px;
    }

    .content {
      width: 100%;
    }
  }

  .resources {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .content {
      display: flex;
      flex-direction: column;

      .title {
        font-size: 13px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: var(--el-text-color-regular);
      }

      .value {
        font-size: 12px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 1;
      }
    }
  }
}
</style>
