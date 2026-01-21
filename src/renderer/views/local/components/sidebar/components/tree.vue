<template>
    <div class="tree">
        <div class="header">
            <div>
                <el-text class="iconfont"></el-text>
                <el-text>{{ props.type == 'folder' ? '文件夹' : '标签' }}</el-text>
            </div>
            <div class="btns">
                <div class="btn iconfont">&#xeb59;</div>
                <div class="btn iconfont" @click="add">&#xeb19;</div>
            </div>
        </div>

        <div class="main">
            <el-scrollbar height="100%">
                <el-tree node-key="id" :default-expanded-keys="expanded" ref="treeRef" class="tree_1" :data="data"
                    @node-click="treeClick" @node-expand="treeExpand" @node-collapse="treeCollapse">
                    <template #default="{ node }">
                        <el-text class="iconfont" :style="'color:' + node.color + ';'">
                            {{ props.type == 'folder' ? '&#xeb1a; ' :
                                '&#xeb2a; '
                            }}</el-text>
                        <el-text>{{ node.label }}</el-text>
                    </template>
                </el-tree>
            </el-scrollbar>
        </div>

    </div>

</template>

<script setup>
import { onMounted, ref } from 'vue'
import * as api from '@/apis/resourcesdb/index.js'
import { useLocalStore } from '@/pinia/local'
const localStore = useLocalStore()
const data = ref([])
const expanded = ref([])
const props = defineProps({
    type: {
        type: String,
        default: 'folder'
    }
})
onMounted(() => {
    getlist()
})
//刷新列表
async function getlist() {
    if (props.type == 'folder') {
        const d = await api.DB_getfolderslist()
        data.value = d[0]
        expanded.value = d[1]
    } else if (props.type == 'tag') {
        const d = await api.DB_gettagslist()
        data.value = d[0]
        expanded.value = d[1]
    }
}
//添加文件夹
function add() {
    if (props.type == 'folder') {
        api.DB_createfolder(localStore.currentlySelectedFolderID)
        api.DB_updatefolder(localStore.currentlySelectedFolderID, { expanded: true })

    } else if (props.type == 'tag') {
        api.DB_createtag(localStore.currentlySelectedTagID)
        api.DB_updatetag(localStore.currentlySelectedTagID, { expanded: true })
    }
    getlist()
}
//节点被单击
function treeClick(Node) {
    if (props.type == 'folder') {
        localStore.currentlySelectedFolderID = Node.id
        localStore.currentlySelectedID = Node.id
        localStore.currentlySelectedType = 'folder'
    } else if (props.type == 'tag') {
        localStore.currentlySelectedTagID = Node.id
        localStore.currentlySelectedID = Node.id
        localStore.currentlySelectedType = 'tag'
    }
}
//节点被展开
function treeExpand(Node) {
    if (props.type == 'folder') {
        api.DB_updatefolder(Node.id, { expanded: true })
    } else if (props.type == 'tag') {
        api.DB_updatetag(Node.id, { expanded: true })
    }
}
//节点被隐藏
function treeCollapse(Node) {
    if (props.type == 'folder') {
        api.DB_updatefolder(Node.id, { expanded: false })
    } else if (props.type == 'tag') {
        api.DB_updatetag(Node.id, { expanded: false })
    }
}
</script>

<style lang="scss" scoped>
.tree {
    height: 100%;
    display: flex;
    flex-direction: column;

    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        height: 24px;
        padding: 4px;

        .btns {
            display: flex;
            gap: 4px;

            .btn {
                width: 20px;
                height: 20px;
                line-height: 20px;
                border-radius: 3px;
                text-align: center;
                border: 1px solid #77777755;

            }
        }
    }

    .main {
        max-height: calc(100vh - 112px);
        flex: 1;

        .tree_1 {
            height: 100%;
        }
    }

}
</style>