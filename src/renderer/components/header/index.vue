<template>
    <header>
        <div class="logo">
            <div class="icon">
                <img src="@/assets/images/logo.png" alt="">
            </div>
            <div class="title">IPIXEL</div>
        </div>
        <div class="btns">
            <div class="btn iconfont" @click="minimize" id="titlebar-minimize">
                &#xeb3d;
            </div>
            <div class="btn iconfont" v-if="ismax" @click="unmaximize" id="titlebar-maximize">
                &#xeaf8;
            </div>
            <div class="btn iconfont" v-else @click="maximize" id="titlebar-maximize">
                &#xeaf8;
            </div>
            <div class="btn iconfont" @click="close" id="titlebar-close">
                &#xeafc;
            </div>
        </div>
    </header>
</template>

<script setup>
import { ref } from 'vue'

const ismax = ref()
//监听最大化状态
window.onload = () => {
    controlbutton.getmax((event, str) => {
        ismax.value = str
    })
}
function minimize() {
    controlbutton.minimize();
}
function maximize() {
    controlbutton.maximize();
}
function unmaximize() {
    controlbutton.unmaximize();
}
function close() {
    controlbutton.close();
}
</script>

<style lang="scss" scoped>
header {
    -webkit-app-region: drag;
    min-height: 49px;
    max-height: 49px;
    height: 49px;
    user-select: none;
    display: flex;
    justify-content: space-between;
    position: relative;
    top: 0;
    left: 0;
    right: 0;
    border-bottom: 1px solid var(--el-border-color);

    .logo {
        display: flex;
        justify-content: center;
        align-items: center;

        .icon {
            display: flex;
            justify-content: center;
            align-items: center;
            width: 50px;
            height: 50px;

            img {
                width: 28px;
                height: 28px;
                image-rendering: pixelated;
            }
        }


        .title {
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: 'pixel-zh';
            font-weight: bold;
            font-size: 22px;
        }

    }

    .btns {
        display: flex;

        .btn {
            display: flex;
            justify-content: center;
            align-items: center;
            width: 50px;
            height: 50px;
            user-select: none;
            -webkit-user-select: none;
            -webkit-app-region: no-drag;
        }

        .btn:hover {
            background: var(--el-color-primary);
        }
    }

}
</style>