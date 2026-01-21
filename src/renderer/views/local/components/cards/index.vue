<template>
    <div class="cards" :class="{ 'cards_drag': isDragOver }" @drop="treeHandleDrop" @dragover="treeHandleDragOver"
        @dragleave="treeHandleDragLeave">

        <el-scrollbar height="100%" style="width: 100%;" v-if="lists.length != 0">
            <div class="cards_1">
                <TCard :key="list.id" :data="list" v-for="list in lists"></TCard>
            </div>
        </el-scrollbar>
        <div class="cards_1 empty" v-else>
            <el-empty description="拖拽文件或文件夹到此处，或点击上传">
                <el-button type="primary" @click="importfile">导入文件</el-button>
                <el-button type="primary" @click="importfolder">导入文件夹</el-button>
            </el-empty>
        </div>

    </div>
</template>

<script setup>
import TCard from '@/views/local/components/cards/components/card.vue';
import * as api from '@/apis/resourcesdb/index.js'
import { onMounted, ref } from 'vue';
import { getFilesFromHandles, getFolderFromHandles, getFilesFromDrop } from '@/utils/getlocalresourceslist.js'
import { useLocalStore } from '@/pinia/local'
const localStore = useLocalStore()
const lists = ref([])
const isDragOver = ref(false)
onMounted(async () => {
    getresourceslist()

})
async function getresourceslist() {
    lists.value = await api.DB_getresourceslist()
}
function addresources(file) {
    let fid = localStore.currentlySelectedFolderID
    if (fid == undefined) {
        fid = null
    }
    return api.DB_createresources(fid, file)
}

async function importfile() {
    const files = await getFilesFromHandles()
    for (var i = 0; i < files.length; i++) {
        const result = await addresources(files[i])
        console.log(result)
        if (result.success == false) {
            console.log('添加失败')
        } else {
            console.log('添加完成添加了:' + result.changes + '张图片',)
            getresourceslist()
        }

    }

}
async function importfolder() {
    const files = await getFolderFromHandles()
    for (var i = 0; i < files.length; i++) {
        const result = await addresources(files[i])
        if (result.success == false) {
            console.log('添加失败')
        } else {
            console.log('添加完成添加了:' + result.changes + '张图片',)
            getresourceslist()
        }
    }
}
//拖拽进入
function treeHandleDragOver(event) {
    event.preventDefault()
    isDragOver.value = true
    event.dataTransfer.dropEffect = 'copy'
    console.log(1)
}
//拖拽离开
function treeHandleDragLeave(event) {
    event.preventDefault()
    console.log(2)
    // 只有当鼠标离开整个上传区域时才取消高亮
    if (!event.currentTarget.contains(event.relatedTarget)) {
        isDragOver.value = false
    }
}

// 处理拖拽放下
async function treeHandleDrop(event) {
    event.preventDefault()
    console.log(3)
    isDragOver.value = false

    try {
        const files = await getFilesFromDrop(event)
        for (var i = 0; i < files.length; i++) {
            const result = await addresources(files[i])
            if (result.success == false) {
                console.log('添加失败')
            } else {
                console.log('添加完成添加了:' + result.changes + '张图片',)
                getresourceslist()
            }
        }
        console.log(files)
    } catch (error) {
        console.error('拖拽上传失败:', error)
        console.log(error)
    }
}
</script>

<style lang="scss" scoped>
.cards {
    height: 100%;
}

.cards_drag {
    filter: blur(1px);
}

.cards_1 {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(auto-fill, 100px);
    gap: 8px;
    justify-content: space-between;
}

.empty {
    display: flex;
    flex-direction: column;
    justify-content: center;
}
</style>