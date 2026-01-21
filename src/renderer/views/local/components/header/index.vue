<template>
    <div class="header">
        <div class="search">
            <el-input class="search_input" v-model="searchInputValue" size="small" placeholder="搜索资源" clearable />
        </div>
        <div class="setings">
            <div class="classification">
                <el-dropdown :show-arrow="false" size="small" :key="classification.name"
                    v-for="classification in classifications">
                    <span class="el-dropdown-link ">
                        {{ classification.name }}<span class="iconfont">&#xeaf9;</span>
                    </span>
                    <template #dropdown>
                        <el-dropdown-menu>
                            <el-dropdown-item>全部</el-dropdown-item>
                            <el-dropdown-item :key="option" v-for="option in classification.data">{{
                                option.option == '' ? '其他' : option.option
                                }}</el-dropdown-item>
                        </el-dropdown-menu>
                    </template>
                </el-dropdown>
            </div>
            <div class="btns ">
                <el-popover :show-arrow="false" placement="bottom" :width="200" trigger="hover">
                    <template #reference>
                        <div class="btn iconfont">&#xeb56;</div>
                    </template>
                    <el-slider v-model="cardSize" :step="10" show-stops />
                </el-popover>

                <el-dropdown :show-arrow="false" size="small">
                    <div class="btn iconfont">&#xeb14;</div>
                    <template #dropdown>
                        <el-dropdown-menu>
                            <el-dropdown-item>Action 1</el-dropdown-item>
                        </el-dropdown-menu>
                    </template>
                </el-dropdown>

                <el-dropdown :show-arrow="false" size="small">
                    <div class="btn iconfont">&#xeb5f;</div>
                    <template #dropdown>
                        <el-dropdown-menu>
                            <el-dropdown-item>Action 1</el-dropdown-item>
                        </el-dropdown-menu>
                    </template>
                </el-dropdown>

                <el-dropdown :show-arrow="false" size="small">
                    <div class="btn iconfont">&#xeb1f;</div>
                    <template #dropdown>
                        <el-dropdown-menu>
                            <el-dropdown-item>Action 1</el-dropdown-item>
                        </el-dropdown-menu>
                    </template>
                </el-dropdown>
            </div>
        </div>

    </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import * as api from '@/apis/resourcesdb/index.js'
const searchInputValue = ref('');//搜索框绑定的值
const cardSize = ref(0)
const emit = defineEmits(['change']);
const getdatas = ref()
const classifications = ref([
    {
        name: '导入时间', value: '', data: [
            { option: '今天', },
            { option: '昨天', },
            { option: '三天', },
            { option: '七天', },
            { option: '一个月', },
            { option: '三个月', },
            { option: '半年', },
            { option: '一年', },
        ]
    },
    { name: '格式', value: '', data: [] },
    { name: '尺寸', value: '', data: [] },
    { name: '文件大小', value: '', data: [] },
    // { name: '类型', value: '', data: [] },
    { name: '评分', value: '', data: [] }
]);//分类列表
const currentSelectedList = ref([

])
onMounted(async () => {
    getlists()
})
async function getlists() {
    getdatas.value = await api.DB_getheaderlist()
    classifications.value[1].data = getdatas.value.format
    // classifications.value[4].data = getdatas.value.type
    // console.log(classifications.value)
}
</script>

<style lang="scss" scoped>
.header {
    display: flex;
    flex-direction: column;
    gap: 4px;

    .search {
        height: 24px;
        align-items: center;

        .search_input {
            width: 100%;
        }
    }

    .tags {
        display: flex;
        gap: 4px;
        height: 24px;
        align-items: center;
    }

    .setings {
        display: flex;
        justify-content: space-between;
        align-items: center;
        height: 24px;

        .classification {
            display: flex;
            gap: 4px;

            .el-dropdown-link {
                cursor: pointer;
                user-select: none;
                margin-right: 10px;
            }
        }

        .btns {
            display: flex;
            gap: 4px;
            align-items: center;

            .btn {
                width: 20px;
                height: 20px;
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
        }
    }

}
</style>
