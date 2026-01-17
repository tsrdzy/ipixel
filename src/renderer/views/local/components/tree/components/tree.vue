<template>
    <div class="tree">
        <el-text>文件夹</el-text>
        <div class="btns">
            <div class="btn iconfont">&#xeb59;</div>
            <div class="btn iconfont">&#xeb19;</div>
        </div>
    </div>
    <el-tree ref="treeRef" style="max-width: 600px" class="filter-tree" :data="data" />
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { DB_getfolderslist } from '@/apis/resourcesdb/index.js'
const data = ref([])
const props = defineProps({
    type: {
        type: String,
        default: 'folder'
    }
})
onMounted(async () => {
    if (props.type == 'folder') {
        data.value = await DB_getfolderslist()
    } else if (props.type == 'tags') {
        data.value = await DB_gettagslist()
    }
})
</script>

<style lang="scss" scoped>
.tree {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 24px;
    padding: 4px;

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
</style>