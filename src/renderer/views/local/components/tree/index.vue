<template>
    <div class="tree">
        <el-tabs v-model="tab" class="tabs" type="card" tab-position="bottom">
            <el-tab-pane name="folder">
                <template #label>
                    <span class="iconfont">&#xeb1a;</span>
                </template>
                <div class="header">
                    <el-text>文件夹</el-text>
                    <div class="btns">
                        <div class="btn iconfont">&#xeb59;</div>
                        <div class="btn iconfont">&#xeb19;</div>
                    </div>
                </div>
                <el-tree ref="treeRef" style="max-width: 600px" class="filter-tree" :data="data" :props="defaultProps"
                    default-expand-all :filter-node-method="filterNode" />
            </el-tab-pane>
            <el-tab-pane name="tag">
                <template #label>
                    <span class="iconfont">&#xeb2a;</span>
                </template>
                <el-tree ref="treeRef" style="max-width: 600px" class="filter-tree" :data="data" :props="defaultProps"
                    default-expand-all :filter-node-method="filterNode" />
            </el-tab-pane>
        </el-tabs>
    </div>
</template>

<script setup>
import { ref } from 'vue'
const tab = ref('folder')
</script>

<style lang="scss" scoped>
.tree {
    height: calc(100%);
    display: flex;
    flex-direction: column;

    .tabs {
        height: calc(100%);
    }

    .header {
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
}
</style>