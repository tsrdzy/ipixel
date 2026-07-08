<template>
  <div class="splitspritesheet">
    <div class="splitspritesheet1">
      <el-card>
        <template #header>
          <div>选择</div>
        </template>
        <div class="cards cards_1">
          <div v-if="filebase64 == ''" @click="clickgetimages()" class="uploadbutton">+</div>
          <div class="img" v-else>
            <img ref="img" :src="filebase64" alt="" />
            <div v-if="props.currentPicture == ''" @click="deleteimg" class="delete iconfont">
              &#xeb6c;
            </div>
            <div
              v-if="operation == 'noauto'"
              ref="dividers"
              class="dividers"
              :style="{
                gridTemplateColumns: `repeat(${dividernumber()?.width},${img_width / width_ratio}px)`,
                gridTemplateRows: `repeat(${dividernumber()?.height},${img_height / height_ratio}px`,
                columnGap: `${img_lrm / width_ratio}px`,
                rowGap: `${img_tbm / height_ratio}px`,
                width: `${scale_width}px`,
                height: `${scale_height}px`
              }"
            >
              <div
                :key="'divider_' + i"
                v-for="i of dividernumber()?.height * dividernumber()?.width"
                class="divider"
                :style="{
                  width: img_width / width_ratio + 'px',
                  height: img_height / height_ratio + 'px',
                  margin: img_margin / width_ratio + 'px'
                }"
              ></div>
            </div>
          </div>
        </div>
      </el-card>
      <el-card>
        <template #header>
          <div>操作</div>
        </template>
        <div
          style="
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            height: 100%;
          "
        >
          <el-tabs v-model="operation">
            <el-tab-pane label="手动分割" name="noauto">
              <div class="cards cards_2">
                <div class="card">
                  <el-text>单图宽度:</el-text
                  ><el-input-number
                    controls-position="right"
                    style="width: 100%"
                    :min="8"
                    v-model="img_width"
                  >
                    <template #suffix>
                      <span>px</span>
                    </template>
                  </el-input-number>
                </div>
                <div class="card">
                  <el-text>单图高度:</el-text
                  ><el-input-number
                    controls-position="right"
                    style="width: 100%"
                    :min="8"
                    v-model="img_height"
                  >
                    <template #suffix>
                      <span>px</span>
                    </template></el-input-number
                  >
                </div>
                <div class="card">
                  <el-text>外边距:</el-text
                  ><el-input-number
                    controls-position="right"
                    style="width: 100%"
                    v-model="img_margin"
                  >
                    <template #suffix>
                      <span>px</span>
                    </template></el-input-number
                  >
                </div>
                <div class="card">
                  <el-text>图左右间距:</el-text
                  ><el-input-number controls-position="right" style="width: 100%" v-model="img_lrm">
                    <template #suffix>
                      <span>px</span>
                    </template></el-input-number
                  >
                </div>
                <div class="card">
                  <el-text>图上下间距:</el-text
                  ><el-input-number controls-position="right" style="width: 100%" v-model="img_tbm">
                    <template #suffix>
                      <span>px</span>
                    </template></el-input-number
                  >
                </div>
                <div class="card">
                  <el-text>背景颜色:</el-text> <el-color-picker v-model="bgcolor" />
                </div>
              </div>
            </el-tab-pane>
            <el-tab-pane label="自动分割" name="auto">
              <div class="cards cards_2">
                <div class="card">
                  <el-text>背景颜色:</el-text>
                  <el-color-picker v-model="bgcolor" />
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
          <div>
            <el-button style="width: 100%" @click="startsprite">分割</el-button>
          </div>
        </div>
      </el-card>
    </div>
    <el-card class="result">
      <template #header>
        <div style="display: flex; justify-content: space-between">
          <el-text>分割结果</el-text>
          <div>
            <el-button size="small" @click="savelocal">导出到本地</el-button>
            <el-button size="small" @click="saveresources">导出到本地资源库</el-button>
          </div>
        </div>
      </template>
      <div class="cards">
        <div class="card" :key="i" v-for="i in spriteresultbase64">
          <img :src="i" alt="" />
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import {
  getFilesFromHandles,
  getFolderFromHandles,
  getFilesFromDrop
} from '@/utils/getlocalresourceslist.js'
import fileToBase64 from '@/utils/fileToBase64.js'
import getImageDimensions from '@/utils/getImageDimensions.js'
import splitSprite from '@/utils/splitSprite.js'
import FileSaver from 'file-saver'
import JSZip from 'jszip'
import { ref, watch } from 'vue'
import { useLocalStore } from '@/pinia/local'
import * as api from '@/apis/resourcesdb/index.js'

const localStore = useLocalStore()
const filename = ref('') //图片名字
const filebase64 = ref('')
const original_width = ref(0) //原图宽度
const original_height = ref(0) //原图高度
const scale_width = ref(0) //缩放宽度
const scale_height = ref(0) //缩放高度
const img_width = ref(64) //单图宽度
const img_height = ref(64) //单图高度
const img_margin = ref(0) //边距
const img_lrm = ref(0) //左右间距
const img_tbm = ref(0) //上下间距

const operation = ref('auto')
const bgcolor = ref()
const spriteresult = ref([])
const spriteresultbase64 = ref([])

const width_ratio = ref(0) //宽度比例
const height_ratio = ref(0) //高度比例
const dividers = ref() //ref
const img = ref() //ref

const props = defineProps({
  currentPicture: {
    type: String,
    default: ''
  },
  parentID: {
    type: Number,
    default: undefined
  }
})
watch(
  () => props.currentPicture,
  (newData) => {
    original_width.value = 0
    original_height.value = 0
    scale_width.value = 0
    scale_height.value = 0
    img_width.value = 64
    img_height.value = 64
    img_margin.value = 0
    img_lrm.value = 0
    img_tbm.value = 0
    operation.value = 'auto'
    clickgetimages(newData)
  }
)
const dividernumber = () => {
  // 1. 计算容器内部的实际可用宽度和高度（减去总外边距）
  const availableWidth = original_width.value - img_margin.value * 2
  const availableHeight = original_height.value - img_margin.value * 2

  // 2. 计算最多可容纳的列数（宽度方向）
  // 公式：(可用宽度 + 一个列间距) / (单个图片宽度 + 一个列间距)
  const columnCount = Math.floor(
    (availableWidth + img_lrm.value) / (img_width.value + img_lrm.value)
  )

  // 3. 计算最多可容纳的行数（高度方向）
  // 公式：(可用高度 + 一个行间距) / (单个图片高度 + 一个行间距)
  const rowCount = Math.floor(
    (availableHeight + img_tbm.value) / (img_height.value + img_tbm.value)
  )

  // 4. 返回结果，确保至少为1列和1行
  return {
    width: Math.max(columnCount, 1),
    height: Math.max(rowCount, 1)
  }
}
function deleteimg() {
  filebase64.value = ''
}
async function clickgetimages(file1) {
  console.log(file1)
  let wh = ''
  if (file1 == undefined) {
    const file = await getFilesFromHandles(false, ['image'])
    filename.value = file[0].name
    filebase64.value = await fileToBase64(file)
    wh = await getImageDimensions(filebase64.value[0])
  } else {
    filebase64.value = file1
    wh = await getImageDimensions(filebase64.value)
  }

  original_width.value = wh.width
  original_height.value = wh.height
  if (wh?.width >= wh?.height) {
    img.value.style.width = '300px'
    img.value.style.height = 'auto'
  } else {
    img.value.style.width = 'auto'
    img.value.style.height = '300px'
  }
  scale_width.value = img.value.clientWidth
  scale_height.value = img.value.clientHeight

  width_ratio.value = wh.width / img.value.clientWidth
  height_ratio.value = wh.height / img.value.clientHeight
}
function startsprite() {
  if (operation.value == 'auto') {
    splitSprite(filebase64.value, true, { bgcolor: bgcolor.value }, filename.value)
      .then((files) => {
        spriteresult.value = files
        console.log(spriteresult.value)
      })
      .catch((error) => console.error('分割失败:', error))
  } else {
    const manualOptions = {
      width: img_width.value, // 单图宽度
      height: img_height.value, // 单图高度
      margin: img_margin.value, // 外边距
      paddingX: img_lrm.value, // 左右间距
      paddingY: img_tbm.value, // 上下间距
      bgcolor: bgcolor.value
    }
    splitSprite(filebase64.value, false, manualOptions, filename.value)
      .then((files) => {
        spriteresult.value = files
        console.log(spriteresult.value)
      })
      .catch((error) => console.error('分割失败:', error))
  }
}
watch(
  () => spriteresult.value,
  async (nelData) => {
    spriteresultbase64.value = []
    for (let i = 0; i < spriteresult.value.length; i++) {
      spriteresultbase64.value.push(await fileToBase64(spriteresult.value[i]))
    }
  },
  {
    deep: true
  }
)
async function savelocal() {
  // FileSaver.saveAs()
  const zip = new JSZip()
  for (let i = 0; i < spriteresult.value.length; i++) {
    zip.file(
      spriteresult.value[i].name,
      spriteresultbase64.value[i].replace(/^data:image\/(png|jpg|jpeg|gif|webp|bmp);base64,/, ''),
      { base64: true }
    )
  }
  zip.generateAsync({ type: 'blob' }).then((content) => {
    FileSaver.saveAs(content, 'images.zip')
  })
}
async function saveresources() {
  const files = spriteresult.value
  for (var i = 0; i < files.length; i++) {
    const result = await addresources(files[i])
    if (result.success == false) {
      console.log('添加失败')
    } else {
      console.log('添加完成添加了:' + result.changes + '张图片')
    }
  }
}
function addresources(file) {
  let fid = localStore.currentlySelectedFolderID
  if (fid == undefined) {
    fid = null
  }
  console.log('ID:', props.parentID)
  if (props.currentPicture != undefined && props.parentID != undefined) {
    return api.DB_createresources(fid, file, props.parentID)
  } else {
    return api.DB_createresources(fid, file)
  }
}
</script>

<style lang="scss" scoped>
.splitspritesheet {
  display: flex;
  flex-direction: column;
  gap: 8px;
  .splitspritesheet1 {
    display: flex;
    justify-content: space-between;
    .el-card {
      width: 45%;
    }
    .cards_1 {
      display: flex;
      justify-content: center;
    }
    .cards {
      width: 100%;
      .card {
        display: flex;
        margin: 2px 0;
        .el-text {
          min-width: 110px;
        }
      }
      .uploadbutton {
        width: 300px;
        text-align: center;
        aspect-ratio: 1/1;
        line-height: 300px;
        border: 1px dashed #777777;
        border-radius: 5px;
        font-size: 30px;
        &:hover {
          border: 1px dashed var(--el-color-primary);
          color: var(--el-color-primary);
        }
      }
      .img {
        width: 300px;
        height: 300px;
        position: relative;
        img {
          width: 100%;
          height: 100%;
          position: absolute;
          image-rendering: pixelated;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }
        .dividers {
          display: grid;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          .divider {
            box-shadow: 0 0 1px var(--el-color-primary);
            z-index: 999;
          }
        }
        .delete {
          display: none;
          position: absolute;
          top: 0;
          left: 0;
          background-color: #77777722;
          width: 100%;
          height: 100%;
          text-align: center;
          line-height: 300px;
          font-size: 40px;
          backdrop-filter: blur(3px);
        }
        &:hover {
          .delete {
            display: block;
          }
        }
      }
    }
  }
  .result {
    .cards {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      .card {
        box-shadow: 0 0 1px;
        width: 50px;
        height: 50px;
        img {
          width: 100%;
          height: 100%;
          // background-size: contain;
          object-fit: contain;
          image-rendering: pixelated;
        }
      }
    }
  }
}
</style>
