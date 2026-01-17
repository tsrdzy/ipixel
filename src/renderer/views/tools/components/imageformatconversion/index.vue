<template>
    <el-button class="button" v-on:click="startcompression">开始格式转换</el-button>
    <br>
    <br>
    <el-button class="button" v-on:click="saveimage">保存图片</el-button>
    <br>
    <div class="slider">
        <span class="demonstration">目标格式:</span>
        <el-radio-group v-model="radio">
            <el-radio value="JPEG" size="large">JPEG</el-radio>
            <el-radio value="PNG" size="large">PNG</el-radio>
            <el-radio value="WEBP" size="large">WEBP</el-radio>
            <el-radio value="GIF" size="large">GIF</el-radio>
            <el-radio value="BMP" size="large">BMP</el-radio>
            <el-radio value="TIFF" size="large">TIFF</el-radio>
            <el-radio value="RAW" size="large">RAW</el-radio>
        </el-radio-group>
    </div>
    <br>
    <div class="content">
        <div class="left">
            <div style="width: 100%;text-align: center;">原格式
                <hr>
            </div>
            <div class="cards" :key="fl" v-for="fl in fileList">
                <div class="card">
                    <div class="delete iconfont" v-on:click="deleteimg(fl)">&#xe600;</div>
                    <img :src="fl.base64" alt="">
                    <div class="name">{{ fl.name }}</div>
                </div>
                <div class="size">
                    {{
                        (fl.size < 1024 * 1024) ? (fl.size / 1024).toFixed(2) + 'KB' : ((fl.size < 1024 * 1024 * 1024)) ?
                            (fl.size / 1024 / 1024).toFixed(2) + 'MB' : ((fl.size < 1024 * 1024 * 1024 * 1024)) ? (fl.size /
                                1024 / 1024 / 1024).toFixed(2) + 'GB' : '-' }} </div>
                </div>
                <label for="upload">
                    <div class="card_1">
                        <div class="icon">+</div>
                        <input multiple v-on:change="getFile" style="display: none;" id="upload" type="file">
                    </div>
                </label>
            </div>
            <div class="right">
                <div style="width: 100%;text-align: center;">目标格式
                    <hr>
                </div>
                <div class="cards" :key="cf" v-for="cf in compressionfile">
                    <div class="card">
                        <img :src="cf.base64" alt="">
                        <div class="name">{{ cf.name }}</div>
                    </div>

                    <div class="size">
                        {{
                            (cf.size < 1024 * 1024) ? (cf.size / 1024).toFixed(2) + 'KB' : ((cf.size < 1024 * 1024 * 1024))
                                ? (cf.size / 1024 / 1024).toFixed(2) + 'MB' : ((cf.size < 1024 * 1024 * 1024 * 1024)) ?
                                    (cf.size / 1024 / 1024 / 1024).toFixed(2) + 'GB' : '-' }} </div>
                    </div>
                </div>
            </div>
</template>
<script setup>
import { ref } from 'vue'
import { saveAs } from 'file-saver'
import { ElNotification } from 'element-plus'
import JSZip from 'jszip'

const fileList = ref([])
const compressionfile = ref([])
const radio = ref('JPEG')

// 获取文件列表的函数，保持不变
function getFile(event) {
    const nowfileList = event.target.files
    for (let i = 0; i < nowfileList.length; i++) {
        var reader = new FileReader()
        reader.readAsDataURL(nowfileList[i])
        reader.onload = function () {
            fileList.value.push({
                name: nowfileList[i].name,
                size: nowfileList[i].size,
                base64: this.result
            })
        }
    }
}

// 删除图片的函数，保持不变
function deleteimg(fl) {
    const index = fileList.value.indexOf(fl)
    fileList.value.splice(index, 1)
}

async function startcompression() {
    compressionfile.value = []
    for (let i = 0; i < fileList.value.length; i++) {
        const base64Data = fileList.value[i].base64
        const blob = base64ToBlob(base64Data)
        let convertedBlob
        switch (radio.value) {
            case 'JPEG':
                convertedBlob = await convertToJPEG(blob)
                break
            case 'PNG':
                convertedBlob = await convertToPNG(blob)
                break
            case 'WEBP':
                convertedBlob = await convertToWEBP(blob)
                break
            case 'GIF':
                convertedBlob = await convertToGIF(blob)
                break
            case 'BMP':
                convertedBlob = await convertToBMP(blob)
                break
            case 'TIFF':
                convertedBlob = await convertToTIFF(blob)
                break
            case 'RAW':
                convertedBlob = await convertToRAW(blob)
                break
            default:
                // 如果格式不支持等情况，可以在这里添加提示逻辑，这里暂时默认转为JPEG
                convertedBlob = await convertToJPEG(blob)
        }
        const convertedBase64 = await blobToBase64(convertedBlob)
        const originalFileNameWithoutExtension = getFileNameWithoutExtension(fileList.value[i].name)
        const newFileName = `${originalFileNameWithoutExtension}.${getExtensionByFormat(radio.value)}`;
        compressionfile.value.push({
            name: newFileName,
            size: convertedBlob.size,
            base64: convertedBase64
        })
    }
}

// 将Blob对象转换为Base64字符串的函数，保持不变
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(blob)
    })
}

// 将Blob转换为JPEG格式的函数
function convertToJPEG(blob) {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.src = URL.createObjectURL(blob)
        img.onload = function () {
            const canvas = document.createElement('canvas')
            canvas.width = this.width
            canvas.height = this.height
            const ctx = canvas.getContext('2d')
            ctx.drawImage(this, 0, 0)
            canvas.toBlob((result) => {
                if (result) {
                    resolve(result)
                } else {
                    reject(new Error('转换JPEG格式失败'))
                }
            }, 'image/jpeg')
        }
        img.onerror = () => reject(new Error('加载图片失败'))
    })
}

// 将Blob转换为PNG格式的函数
function convertToPNG(blob) {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.src = URL.createObjectURL(blob)
        img.onload = function () {
            const canvas = document.createElement('canvas')
            canvas.width = this.width
            canvas.height = this.height
            const ctx = canvas.getContext('2d')
            ctx.drawImage(this, 0, 0)
            canvas.toBlob((result) => {
                if (result) {
                    resolve(result)
                } else {
                    reject(new Error('转换PNG格式失败'))
                }
            }, 'image/png')
        }
        img.onerror = () => reject(new Error('加载图片失败'))
    })
}

// 将Blob转换为WEBP格式的函数
function convertToWEBP(blob) {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.src = URL.createObjectURL(blob)
        img.onload = function () {
            const canvas = document.createElement('canvas')
            canvas.width = this.width
            canvas.height = this.height
            const ctx = canvas.getContext('2d')
            ctx.drawImage(this, 0, 0)
            canvas.toBlob((result) => {
                if (result) {
                    resolve(result)
                } else {
                    reject(new Error('转换WEBP格式失败'))
                }
            }, 'image/webp')
        }
        img.onerror = () => reject(new Error('加载图片失败'))
    })
}

// 将Blob转换为GIF格式的函数
function convertToGIF(blob) {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.src = URL.createObjectURL(blob)
        img.onload = function () {
            const canvas = document.createElement('canvas')
            canvas.width = this.width
            canvas.height = this.height
            const ctx = canvas.getContext('2d')
            ctx.drawImage(this, 0, 0)
            canvas.toBlob((result) => {
                if (result) {
                    resolve(result)
                } else {
                    reject(new Error('转换GIF格式失败'))
                }
            }, 'image/gif')
        }
        img.onerror = () => reject(new Error('加载图片失败'))
    })
}

// 将Blob转换为BMP格式的函数
function convertToBMP(blob) {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.src = URL.createObjectURL(blob)
        img.onload = function () {
            const canvas = document.createElement('canvas')
            canvas.width = this.width
            canvas.height = this.height
            const ctx = canvas.getContext('2d')
            ctx.drawImage(this, 0, 0)
            canvas.toBlob((result) => {
                if (result) {
                    resolve(result)
                } else {
                    reject(new Error('转换BMP格式失败'))
                }
            }, 'image/bmp')
        }
        img.onerror = () => reject(new Error('加载图片失败'))
    })
}

// 将Blob转换为TIFF格式的函数
function convertToTIFF(blob) {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.src = URL.createObjectURL(blob)
        img.onload = function () {
            const canvas = document.createElement('canvas')
            canvas.width = this.width
            canvas.height = this.height
            const ctx = canvas.getContext('2d')
            ctx.drawImage(this, 0, 0)
            canvas.toBlob((result) => {
                if (result) {
                    resolve(result)
                } else {
                    reject(new Error('转换TIFF格式失败'))
                }
            }, 'image/tiff')
        }
        img.onerror = () => reject(new Error('加载图片失败'))
    })
}

// 将Blob转换为RAW格式的函数
function convertToRAW(blob) {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.src = URL.createObjectURL(blob)
        img.onload = function () {
            const canvas = document.createElement('canvas')
            canvas.width = this.width
            canvas.height = this.height
            const ctx = canvas.getContext('2d')
            ctx.drawImage(this, 0, 0)
            canvas.toBlob((result) => {
                if (result) {
                    resolve(result)
                } else {
                    reject(new Error('转换RAW格式失败'))
                }
            }, 'image/raw')
        }
        img.onerror = () => reject(new Error('加载图片失败'))
    })
}

function saveimage() {
    if (compressionfile.value.length == 1) {
        saveAs(base64ToBlob(compressionfile.value[0].base64), compressionfile.value[0].name)
    } else if (compressionfile.value.length > 1) {
        const jszip = new JSZip()
        for (let i = 0; i < compressionfile.value.length; i++) {
            jszip.file(compressionfile.value[i].name, base64ToBlob(compressionfile.value[i].base64))
        }
        jszip.generateAsync({ type: "blob" }).then((content) => {
            saveAs(content, 'ToolBoxImages.zip')
        })
    } else {
        ElNotification.error({
            title: '错误',
            message: '请先压缩图片后再保存',
            position: 'bottom-right',
            showClose: false,
            duration: 2000
        })
    }
}

// 将Base64数据转换为Blob对象的函数（如果不存在，添加此函数）
function base64ToBlob(base64Data) {
    const parts = base64Data.split(';base64,')
    const contentType = parts[0].split(':')[1]
    const raw = window.atob(parts[1])
    const array = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i++) {
        array[i] = raw.charCodeAt(i)
    }
    return new Blob([array], { type: contentType })
}

// 获取文件名（不含后缀）的函数
function getFileNameWithoutExtension(fileName) {
    return fileName.substring(0, fileName.lastIndexOf('.'));
}

// 根据格式获取文件后缀名的函数
function getExtensionByFormat(format) {
    switch (format) {
        case 'JPEG':
            return 'jpg';
        case 'PNG':
            return 'png';
        case 'WEBP':
            return 'webp';
        case 'GIF':
            return 'gif';
        case 'BMP':
            return 'bmp';
        case 'TIFF':
            return 'tiff';
        case 'RAW':
            return 'raw';
        default:
            return 'jpg';
    }
}
</script>
<style lang=scss scoped>
.slider {
    width: 100%;
    display: flex;
    align-items: center;
    margin-top: 0;
    font-size: 14px;
    color: var(--el-text-color-secondary);
    line-height: 44px;
    flex: 1;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-bottom: 0;

    span {
        width: 100px;
    }
}

.button {
    width: 100%;
}

.content {
    width: 100%;
    display: flex;
    justify-content: space-between;

    .left,
    .right {
        display: flex;
        flex-wrap: wrap;
        width: 45%;
        box-shadow: 0 0 2px;
        padding: 10px;
    }

    .cards {
        position: relative;



        .card {
            width: 100px;
            height: 100px;
            border: 1px solid;
            border-radius: 5px;
            margin: 5px;
            position: relative;

            .delete {
                position: absolute;
                top: 5px;
                right: 5px;
                z-index: 1000;
                display: none;
                transition: all 0.3s;

                &:hover {
                    color: #77777799;
                }
            }

            &:hover {
                .delete {
                    transition: all 0.3s;
                    display: block;
                }
            }

            img {
                width: 100px;
                height: 100px;
                border-radius: 5px;
                object-fit: contain;
            }
        }

        .name {
            font-size: 12px;
            text-align: center;
            position: absolute;
            bottom: 0;
            width: 90px;
            left: calc(50% - 50px);
            background-color: #77777722;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
            padding: 0 5px;
        }

        .size {
            font-size: 12px;
            text-align: center;
            overflow: hidden;
            white-space: nowrap;
            color: #77777788;
        }
    }


    .card_1 {
        width: 100px;
        height: 100px;
        border: 1px solid;
        border-radius: 5px;
        margin: 5px;
        border: 1px dashed;

        .icon {
            width: 100px;
            height: 100px;
            text-align: center;
            line-height: 100px;
            font-size: 40px;
        }
    }
}
</style>
