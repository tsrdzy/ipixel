<template>
    <el-button class="button" v-on:click="startcompression">压缩图片</el-button>
    <br>
    <br>
    <el-button class="button" v-on:click="saveimage">保存图片</el-button>
    <br>
    <div class="slider">
        <span class="demonstration">压缩比例</span>
        <el-slider :min="0.01" :max="1" :step="0.01" v-model="size" />
    </div>
    <br>
    <div class="content">
        <div class="left">
            <div style="width: 100%;text-align: center;">压缩前
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
                                1024 / 1024 / 1024).toFixed(2) + 'GB' : '-' }}</div>
                </div>

                <label for="upload">
                    <div class="card_1">
                        <div class="icon">+</div><input multiple v-on:change="getFile" style="display: none;"
                            id="upload" type="file">
                    </div>
                </label>

            </div>
            <div class="right">
                <div style="width: 100%;text-align: center;">压缩后
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
                                    (cf.size / 1024 / 1024 / 1024).toFixed(2) + 'GB' : '-' }}</div>
                    </div>
                </div>
            </div>

</template>
<script setup>
import { ref } from 'vue'
import { saveAs } from 'file-saver';
import { ElNotification } from 'element-plus';

import JSZip from 'jszip';
const fileList = ref([])
const compressionfile = ref([])
const size = ref(0.6)
import Compressor from 'compressorjs';

function base64ToBlob(base64Data) {
    let parts = base64Data.split(';base64,');
    let contentType = parts[0].split(':')[1];
    let binaryData = window.atob(parts[1]);
    let arrayBuffer = new ArrayBuffer(binaryData.length);
    let uint8Array = new Uint8Array(arrayBuffer);
    for (let i = 0; i < binaryData.length; i++) {
        uint8Array[i] = binaryData.charCodeAt(i);
    }
    return new Blob([uint8Array], { type: contentType });
}
function getFile(event) {
    const nowfileList = event.target.files;
    for (let i = 0; i < nowfileList.length; i++) {
        var reader = new FileReader();
        reader.readAsDataURL(nowfileList[i]);
        reader.onload = function () {
            fileList.value.push(
                {
                    name: nowfileList[i].name,
                    size: nowfileList[i].size,
                    base64: this.result
                }
            )
        }

    }
}
function deleteimg(fl) {
    const index = fileList.value.indexOf(fl);
    fileList.value.splice(index, 1);
}
async function startcompression() {
    compressionfile.value = []

    for (let i = 0; i < fileList.value.length; i++) {
        const blob = base64ToBlob(fileList.value[i].base64);
        new Compressor(blob, {
            quality: size.value,
            success(result) {
                const reader = new FileReader();
                reader.onloadend = function () {
                    const base64Data = this.result;
                    compressionfile.value.push({
                        name: fileList.value[i].name,
                        size: result.size,
                        base64: base64Data
                    });
                };
                reader.readAsDataURL(result);
            },
        });
    }

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
