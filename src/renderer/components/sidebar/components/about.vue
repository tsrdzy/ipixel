<template>
    <div class="about">
        <div class="img">
            <img src="@/assets/images/logo.png" alt="">
        </div>
        <div class="title">
            IPIXEL
        </div>
        <div class="btns">
            <div class="btn iconfont">&#xe882;</div>
            <div class="btn iconfont">&#xe600;</div>
            <div class="btn iconfont">&#xea95;</div>
            <div class="btn iconfont">&#xe65a;</div>
            <div class="btn iconfont">&#xe62e;</div>
            <div class="btn iconfont">&#xe691;</div>
            <div class="btn iconfont">&#xe61e;</div>
        </div>
        <div class="btns2">
            <div class="btn">用户协议</div>
            <div class="btn">法律声明</div>
        </div>
        <el-text type="info">版权所有</el-text>
        <el-text type="info">
            Copyright 2026 © TsrCraft
        </el-text>
    </div>
</template>

<script setup>

</script>

<style lang="scss" scoped>
.about {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;

    .img {
        width: 32px;
        height: 32px;

        img {
            width: 100%;
            height: 100%;
            image-rendering: pixelated;
        }
    }

    .title {
        font-size: 20px;
        font-weight: bold;
    }

    .btns {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 32px;
        gap: 4px;
        margin: 10px 0;

        .btn {
            height: 32px;
            width: 32px;
            text-align: center;
            line-height: 32px;
            font-size: 20px;
            box-shadow: 0 0 1px 1px #77777777;
            border-radius: 4px;
        }
    }

    .btns2 {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 8px;

        .btn {
            text-decoration: underline;
        }
    }
}
</style>