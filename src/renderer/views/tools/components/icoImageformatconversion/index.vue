<template>
    <div class="cards">
        <label for="upfile">
            <input style="display: none;" id="upfile" type="file" @change="handleFileChange">
            <div class="card">
                <div v-if="
                    selectedFile == undefined ||
                    selectedFile == '' ||
                    selectedFile == null" class="addbutton">+</div>
                <img v-else ref="previewImg">


            </div>
        </label>

    </div>
    <div>
        <div>
            <el-radio-group v-model="radio">
                <el-radio value="16" size="large">16×16</el-radio>
                <el-radio value="32" size="large">32×32</el-radio>
                <el-radio value="64" size="large">64×64</el-radio>
                <el-radio value="128" size="large">128×128</el-radio>
                <el-radio value="256" size="large">256×256</el-radio>
                <el-radio value="512" size="large">512×512</el-radio>
                <el-radio value="1024" size="large">1024×1024</el-radio>
            </el-radio-group>
        </div>
        <br>
        <div>
            <el-button style="width: 100%;" @click="generateIco">生成ICO图标</el-button>
        </div>
        <br>
        <br>
    </div>


</template>

<script setup>
import { ref } from 'vue'
import FileSaver from 'file-saver'
import { ElNotification } from 'element-plus'


const radio = ref('16')
let selectedFile = ref(null)
const previewImg = ref({
    src: ""
})

function handleFileChange(e) {
    const files = e.target.files
    if (files && files.length > 0) { // 判断是否选择了文件
        selectedFile.value = files[0]
        const reader = new FileReader()
        reader.readAsDataURL(selectedFile.value)
        reader.onload = function () {
            previewImg.value.src = this.result
        }
    } else {
        previewImg.value.src = ''
        selectedFile.value = null
    }
}

async function generateIco() {
    if (!selectedFile.value) {
        ElNotification.error({
            title: '错误',
            message: '请先选择一张图片',
            position: 'bottom-right',
            showClose: false,
            duration: 2000
        })
        return
    }
    const img = new Image()
    const reader = new FileReader()
    reader.readAsDataURL(selectedFile.value)
    await new Promise((resolve) => {
        reader.onload = function () {
            img.src = this.result
            img.onload = resolve
        }
    })
    const targetSize = parseInt(radio.value)
    const canvas = document.createElement('canvas')
    canvas.width = targetSize
    canvas.height = targetSize
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, targetSize, targetSize)
    canvas.toBlob((blob) => {
        if (blob) {
            FileSaver.saveAs(blob, 'output.ico')
            console.log('ICO图标已生成并保存')
        }
    }, 'image/x-icon')
}
</script>

<style lang='scss' scoped>
.cards {
    margin: 0 auto;
    width: 300px;

    .card {
        width: 300px;
        height: 300px;


        img {
            width: 300px;
            height: 300px;
            border: 1px solid;
        }

        .addbutton {
            width: 300px;
            height: 300px;
            text-align: center;
            line-height: 300px;
            font-size: 40px;
            border: 1px dashed;
            transition: all 0.2s;
            &:hover{
                color: #77777799;
                transition: all 0.2s;
            }
        }
    }
}
</style>