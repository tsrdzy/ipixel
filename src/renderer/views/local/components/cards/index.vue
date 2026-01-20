<template>

    <el-scrollbar height="100%" style="width: 100%;" v-if="lists.length != 0">
        <div class="cards">

            <TCard :key="list.id" :data="list" v-for="list in lists"></TCard>

        </div>
    </el-scrollbar>
    <div class="cards empty" v-else>
        <el-empty>
            <el-button type="primary" @click="importfile">导入文件</el-button>
            <el-button type="primary" @click="importfolder">导入文件夹</el-button>
        </el-empty>
    </div>
</template>

<script setup>
import TCard from '@/views/local/components/cards/components/card.vue';
import * as api from '@/apis/resourcesdb/index.js'
import { onMounted, ref } from 'vue';
import { getFilesFromHandles, getFolderFromHandles } from '@/utils/getlocalresourceslist.js'
import { useLocalStore } from '@/pinia/local'
const localStore = useLocalStore()
const lists = ref([])
onMounted(async () => {
    // console.log(await db.resource.search({}, true))
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
    console.log(files)
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

</script>

<style lang="scss" scoped>
.cards {
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