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
                <el-text size="small">主题</el-text>
                <div class="themes">
                    <div class="theme light"></div>
                    <div class="theme dark"></div>
                </div>
            </div>
            <div class="card">
                <el-text size="small">语言</el-text>
                <div class="languages">
                    <el-select size="small" v-model="value" placeholder="Select">
                        <el-option v-for="item in options" :key="item.value" :label="item.label" :value="item.value" />
                    </el-select>
                </div>
            </div>

        </div>
    </div>
</template>

<script setup>

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
    }
}
</style>