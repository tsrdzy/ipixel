<template>
    <div class="particulars">
        <div class="resources" v-if="localStore.currentlySelectedType == 'resources'">
            <div class="content">
                <div class="title">名称:</div>
                <el-input class="value" v-model="name" size="small">
                    <template #suffix>{{ type }}</template>
                </el-input>
            </div>
            <div class="content">
                <div class="title">标签:</div>
                <div class="value">
                    <el-input-tag v-model="tags" size="small" placeholder="标签" aria-label="标签" />
                </div>
            </div>
            <div class="content">
                <div class="title">评分:</div>
                <div class="value">
                    <el-rate v-model="rating" :max=5 :allow-half="false" size="small" />
                </div>
            </div>
            <div class="content">
                <div class="title">类型:</div>
                <div class="value">{{ resourcesdata[0]?.format }}</div>
            </div>
            <div class="content">
                <div class="title">大小:</div>
                <div class="value">{{ (resourcesdata[0]?.size / 1024) < 1024 ? (resourcesdata[0]?.size /
                    1024).toFixed(2) + 'kb' : (resourcesdata[0]?.size / 1024).toFixed(2) + 'mb' }}</div>
                </div>
                <div class="content">
                    <div class="title">宽度:</div>
                    <div class="value">
                        {{ resourcesdata[0]?.width }}
                    </div>
                </div>
                <div class="content">
                    <div class="title">高度:</div>
                    <div class="value">{{ resourcesdata[0]?.height }}</div>
                </div>
                <div class="content">
                    <div class="title">导入时间:</div>
                    <div class="value">{{ totime(resourcesdata[0]?.created_at) }}</div>
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
import { ref, watch } from 'vue'
import { useLocalStore } from '@/pinia/local';
import * as api from '@/apis/resourcesdb/resources.js'
const localStore = useLocalStore()
const resourcescount = ref(0)
const resourcesdata = ref({})
const rating = ref(0)
const name = ref('')
const type = ref('')
const tags = ref([])
watch(() => localStore.currentlySelectedID, async (newData) => {
    if (localStore.currentlySelectedType == 'folder') {
        const data = await api.DB_getresourcescount('resources', 'folder_id', newData)
        resourcescount.value = data[0]['COUNT(*)']
    } else if (localStore.currentlySelectedType == 'tag') {
        const data = (await api.DB_getresourcescount('resource_tags', 'tag_id', newData))
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
        name.value = resourcesdata.value[0]?.name.substring(0, resourcesdata.value[0]?.name.lastIndexOf('.'))
        type.value = resourcesdata.value[0]?.name.substring(resourcesdata.value[0]?.name.lastIndexOf('.'))
        console.log(resourcesdata.value)
    }
})
const totime = (data) => {
    const date = new Date(data * 1000); // 时间戳需要毫秒数，所以乘以1000

    const Y = date.getFullYear();
    const M = String(date.getMonth() + 1).padStart(2, '0'); // 月份补零
    const D = String(date.getDate()).padStart(2, '0'); // 日期补零
    const h = String(date.getHours()).padStart(2, '0'); // 小时补零
    const m = String(date.getMinutes()).padStart(2, '0'); // 分钟补零
    const s = String(date.getSeconds()).padStart(2, '0'); // 秒补零

    return `${Y}-${M}-${D} ${h}:${m}:${s}`; // 使用模板字符串拼接
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