<template>
    <div class="sidebar">
        <div class="content">
            <div v-if="tab == 'folder'" class="tab">
                <Ttree type="folder"></Ttree>
            </div>
            <div v-else-if="tab == 'tag'" class="tab">
                <Ttree type="tag"></Ttree>
            </div>
        </div>

        <div class="select">
            <div class="btn iconfont" :class="tab == 'folder' ? 'active' : ''" @click="settab('folder')">&#xeb1a;</div>
            <div class="btn iconfont" :class="tab == 'tag' ? 'active' : ''" @click="settab('tag')">&#xeb2a;</div>
        </div>

    </div>
</template>

<script setup>
import { ref } from 'vue'
import Ttree from '@/views/local/components/sidebar/components/tree.vue'
const tab = ref('folder')
function settab(data) {
    tab.value = data

}
</script>

<style lang="scss" scoped>
.sidebar {
    height: 100%;
    display: flex;
    flex-direction: column;

    .content {
        flex: 1;
        height: 100%;

        .tab {
            height: calc(100%);
        }
    }

    .select {
        height: 29px;
        display: flex;
        border-top: 1px solid #777;

        .btn {
            height: 28px;
            line-height: 28px;
            width: 30px;
            border: 1px solid #77777799;
            text-align: center;
            border-radius: 2px;
            border-top-right-radius: 0;
            border-top-left-radius: 0;
            border-top: 0;
            color: #777777;

            &:hover {
                color: var(--el-color-primary);
            }
        }

        .active {
            color: var(--el-color-primary);
            border: 1px solid #77777755;
            border-top: 0;
        }
    }



}
</style>