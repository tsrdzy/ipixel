<template>

    <el-text size="small">主题</el-text>
    <div class="themes">
        <div class="theme light" @click="themeClick('light')"></div>
        <div class="theme dark" @click="themeClick('dark')"></div>
    </div>

</template>

<script setup>
import { useIpixelStore } from '@/pinia/ipixel';
const ipixelStore = useIpixelStore()
function themeClick(data) {
    ipixelStore.theme = data
}
</script>

<style lang="scss" scoped>
.themes {
    display: flex;
    gap: 4px;

    .theme {
        width: 24px;
        height: 24px;
        border: 1px solid var(--el-text-color-primary);
        border-radius: 5px;

        &:hover {
            border: 1px solid var(--el-color-primary);
        }
    }

    .dark {
        background-color: #252525;
    }

    .light {
        background-color: #fff;
    }
}
</style>