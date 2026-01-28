<template>
    <div class="checkupdates">
        <div>
            <el-text>当前版本: v{{ version }}</el-text>
        </div>
        <div class="card">
            <el-text>最新版本: v1.0.0</el-text>
            <el-button size="small">检查更新</el-button>
        </div>
        <div class="btns">
            <el-button style="width: 100%;" disabled>更新</el-button>
        </div>
    </div>
</template>

<script setup>
import Tpackage from '@/../../package.json'
import { ref } from 'vue'
const version = ref(Tpackage.version)
</script>

<style lang="scss" scoped>
.checkupdates {
    display: flex;
    flex-direction: column;
    gap: 4px;
    .card {
        display: flex;
        justify-content: space-between;
    }

    .btns {
        display: flex;
        justify-content: end;
    }
}
</style>