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
                            <el-dropdown-item>Action 1</el-dropdown-item>
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
import { ref } from 'vue';
const searchInputValue = ref('');//搜索框绑定的值
const uncategorizedChecked = ref(false);//未分类标签选中状态
const tags = [];//标签列表
const cardSize = ref(0)
const emit = defineEmits(['change']);

const classifications = [
    { name: '颜色' },
    { name: '导入时间' },
    { name: '格式' },
    { name: '尺寸' },
    { name: '文件大小' },
    { name: '类型' },
    { name: '评分' }
];//分类列表

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
