<template>
    <div class="settings">
        <div class="left">
            <div class="button">
                <el-button>常规</el-button>
            </div>
            <div class="button">
                <el-button>资源库</el-button>
            </div>
            <div class="button">
                <el-button>音视频</el-button>
            </div>
            <div class="button">
                <el-button>快捷键</el-button>
            </div>
            <div class="button">
                <el-button>通知</el-button>
            </div>
        </div>
        <div class="right">
            <div class="title">
                <el-text size="large">常规</el-text>
            </div>
            <div class="card">
                <Ttheme></Ttheme>
            </div>
            <div class="card">
                <Tlanguage></Tlanguage>
            </div>

        </div>
    </div>
</template>

<script setup>
import Ttheme from './components/theme.vue'
import Tlanguage from './components/language.vue'
</script>

<style lang="scss" scoped>
.settings {
    display: flex;
    gap: 8px;

    .left {
        width: 20%;
        min-width: 20%;
        max-width: 20%;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;

        .button {
            width: 100%;
        }

        .el-button {
            width: 100%;
        }
    }

    .right {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;

    }
}
</style>