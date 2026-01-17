<template>
    <div class="tree">
        <el-tabs v-model="tab" class="tabs" type="card" tab-position="bottom">
            <el-tab-pane name="folder">
                <template #label>
                    <span class="iconfont">&#xeb1a;</span>
                </template>
                <Ttree type="folder"></Ttree>
            </el-tab-pane>
            <el-tab-pane name="tag">
                <template #label>
                    <span class="iconfont">&#xeb2a;</span>
                </template>
                <Ttree type="folder"></Ttree>
            </el-tab-pane>
        </el-tabs>
    </div>
</template>

<script setup>
import { ref } from 'vue'
import Ttree from '@/views/local/components/tree/components/tree.vue'
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


}
</style>