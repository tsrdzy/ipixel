<template>
    <div class="p-30">
        <div style="width: 100%;display: flex;justify-content: space-between;">
            <el-card style="width: 48%;">
                <template #header>
                    上传图片
                </template>
                <el-upload :multiple="true" class="mb-12" accept="image/*" :auto-upload="false" list-type="picture-card"
                    :on-change="handleChanges" v-model:file-list="fileList">
                    <el-icon>
                        <Plus />
                    </el-icon>
                </el-upload>
            </el-card>
            <el-card v-loading="isloading" element-loading-text="生成中..." style="width: 48%;">
                <template #header>
                    像素图片
                </template>
                <div class="item-wrap mb-12">
                    <el-text style="min-width: 70px;">像素大小:</el-text>
                    <el-radio-group :disabled="!fileList.length" v-model="pixelSize" style="width: 100%">
                        <el-radio :value="8">8x8</el-radio>
                        <el-radio :value="16">16x16</el-radio>
                        <el-radio :value="32">32x32</el-radio>
                        <el-radio :value="64">64x64</el-radio>
                        <el-radio :value="128">128x128</el-radio>
                        <el-radio :value="256">256x256</el-radio>
                        <el-radio :value="512">512x512</el-radio>
                        <el-radio :value="1024">1024x1024</el-radio>
                    </el-radio-group>
                </div>
                <br>
                <el-button style="width: 100%;" @click="downloadAllCanvasImages">下载</el-button>
                <br>
                <br>
                <div class="item-wrap">
                    <canvas :key="i" v-for="fl, i in fileList" class="canvas" :ref="(el) => canvas[i] = el"></canvas>
                </div>
            </el-card>
        </div>
    </div>
</template>
<script setup>
import { ref, watch, onMounted } from "vue";
import { Plus } from '@element-plus/icons-vue'

import JSZip from 'jszip';
import FileSaver from 'file-saver';
const pixelSize = ref(32);
const rawFile = ref([]);
const canvas = ref([]);
const imgUrl = ref("");
const fileList = ref([]);
const isloading = ref(false)
//下载
const downloadAllCanvasImages = async () => {
    const zip = new JSZip();
    for (let i = 0; i < canvas.value.length; i++) {
        if (canvas.value[i]) {
            const canvasDataUrl = canvas.value[i].toDataURL('image/png');
            const fileName = `image_${i}.png`;
            zip.file(fileName, canvasDataUrl.split(',')[1], { base64: true });
        }
    }
    const content = await zip.generateAsync({ type: "blob" });
    FileSaver.saveAs(content, "canvas_images.zip");
};

// 重新绘制画布
const redrawCanvas = () => {
    let completedCount = 0;
    for (let i = 0; i < canvas.value.length; i++) {
        if (canvas.value[i]) {
            const ctx = canvas.value[i].getContext("2d", { willReadFrequently: true });
            ctx?.clearRect(0, 0, canvas.value[i].width, canvas.value[i].height);
            if (rawFile.value[i]) {
                // 传入回调函数，在图片处理完成后更新完成计数
                loadImage(rawFile.value[i], i, () => {
                    completedCount++;
                    if (completedCount === canvas.value.length) {
                        isloading.value = false;
                    }
                });
            }
        }
    }
};
const loadImage = (file, i, callback) => {
    const reader = new FileReader();
    // 读取文件内容，加载完成后触发
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            if (!canvas.value[i]) return;
            const ctx = canvas.value[i].getContext("2d");
            // canvas画布大小
            canvas.value[i].width = 1024;
            canvas.value[i].height = 1024;
            // 将图像绘制到指定的canvas上
            ctx.drawImage(img, 0, 0, canvas.value[i].width, canvas.value[i].height);
            // 对canvas内容进行像素化处理
            let topixelsize = 0;
            switch (pixelSize.value) {
                case 1024:
                    topixelsize = 1;
                    break;
                case 512:
                    topixelsize = 2;
                    break;
                case 256:
                    topixelsize = 4;
                    break;
                case 128:
                    topixelsize = 8;
                    break;
                case 64:
                    topixelsize = 16;
                    break;
                case 32:
                    topixelsize = 32;
                    break;
                case 16:
                    topixelsize = 64;
                    break;
                case 8:
                    topixelsize = 128;
                    break;
                default:
                    topixelsize = 8;
                    break;
            }
            pixelate(ctx, canvas.value[i].width, canvas.value[i].height, topixelsize);
            // 图片处理完成后调用回调函数
            callback && callback();
        };
        img.src = e.target?.result;
    };
    reader.onerror = (error) => {
        console.error('FileReader error:', error);
    };
    reader.readAsDataURL(file);
};
// 图像像素化
const pixelate = (
    ctx,
    width,
    height,
    pixelSize
) => {
    // 从画布捕获图像数据
    const imageData = ctx.getImageData(0, 0, width, height);
    // 包含像素数据（RGBA值）的Array
    const data = imageData.data;
    // 清除原始图像
    ctx.clearRect(0, 0, width, height);
    // 计算水平和垂直方向上的像素块数量
    const numBlocksX = Math.ceil(width / pixelSize);
    const numBlocksY = Math.ceil(height / pixelSize);
    for (let y = 0; y < numBlocksY; y++) {
        for (let x = 0; x < numBlocksX; x++) {
            // 计算当前像素块左上角像素的位置
            const startX = x * pixelSize;
            const startY = y * pixelSize;
            // 计算当前像素块的颜色
            const index = (startY * width + startX) * 4;
            const red = data[index];
            const green = data[index + 1];
            const blue = data[index + 2];
            const alpha = data[index + 3];
            // 使用该颜色填充像素块，包括alpha通道
            ctx.fillStyle = `rgba(${red},${green},${blue},${alpha / 255})`;
            // 计算当前像素块的大小
            const blockWidth = Math.min(pixelSize, width - startX);
            const blockHeight = Math.min(pixelSize, height - startY);
            ctx.fillRect(startX, startY, blockWidth, blockHeight);
        }
    }
};
// File转base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
}
// 图片替换
const handleChanges = async (file, fileList) => {
    rawFile.value = [];
    isloading.value = true;
    for (let list = 0; list < fileList.length; list++) {
        rawFile.value[list] = fileList[list].raw;
        loadImage(fileList[list].raw, list, () => {
            const completedCount = rawFile.value.filter(Boolean).length;
            if (completedCount === fileList.length) {
                isloading.value = false;
            }
        });
    }
    imgUrl.value = (await fileToBase64(file.raw));
};
// 监听像素大小的变化
watch(pixelSize, () => {
    isloading.value = true
    redrawCanvas();
});
</script>
<style scoped>
.item-wrap {
    display: flex;
    gap: 12px;
}

.image {
    width: 146px;
    height: 146px;
    border: 1px solid;
}

.canvas {
    width: 146px;
    height: 146px;
    border: 1px solid;
}
</style>