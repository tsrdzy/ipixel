<template>
    <div class="createdbbg" v-if="props.folderURL == undefined || props.folderURL == ''">
        123
        <el-card class="createdb">
            <template #header>
                创建资源库
            </template>
            <div class=cards>
                <div class="card">
                    <el-text>资源库名称</el-text>
                    <el-input v-model="resourcesname" placeholder="资源库文件夹名称">
                        <!-- <template #prepend>资源库名称</template> -->
                    </el-input>
                </div>
                <div class="card">
                    <el-text>
                        资源库图标
                    </el-text>
                    <!-- <el-input v-model="resourcesicon" placeholder="资源库显示的图标">
            </el-input> -->
                    <el-button style="width: 100%;">
                        <span class="icon iconfont">&#xeb1a;</span>
                    </el-button>
                </div>
                <div class="card">
                    <el-text>
                        资源库路径
                    </el-text>
                    <el-input v-model="resourcespath" placeholder="储存资源库的路径">
                        <!-- <template #prepend>资源库路径</template> -->
                        <template #suffix>
                            <span class="iconfont" @click="setfolder">...</span>
                        </template>
                    </el-input>
                </div>
                <div class="card">
                    <el-text>
                        储存方式
                    </el-text>
                    <el-radio-group v-model="storageMethod">
                        <el-radio value="copy" size="large">拷贝</el-radio>
                        <el-radio value="cut" size="large">剪切</el-radio>
                        <el-radio value="link" size="large">链接</el-radio>
                    </el-radio-group>
                </div>
                <div class="btns">
                    <el-button>取消</el-button>
                    <el-button type="primary" @click="createresources">创建</el-button>
                </div>
            </div>

        </el-card>
    </div>
</template>

<script setup>
import { ElNotification } from 'element-plus';
import { ref } from 'vue';
const resourcesname = ref('resources_1');
const resourcesicon = ref('');
const resourcespath = ref('');
const storageMethod = ref('copy');
const props = defineProps({
    folderURL: {
        type: String,
        required: true
    }
});
async function setfolder() {
    const _path = await file.openFileSelecter()
    // console.log(a.filePaths[0]);
    if (!_path) return
    resourcespath.value = _path.filePaths[0]
}
function createresources() {
    if(resourcesname.value == '') {
        ElNotification({
            title: '创建失败',
            message: "资源库名称不能为空",
            position: 'bottom-right',
            type: 'warning',
        })
        return
    }
    if (resourcespath.value == '') {
        ElNotification({
            title: '创建失败',
            message: "请选择资源库路径",
            position: 'bottom-right',
            type: 'warning',
        })
        return
    }
    store.set('resourcespath', resourcespath.value)
    store.set('resourcesname', resourcesname.value)
    store.set('storagemethod', storageMethod.value)
    store.set('resourcesicon', resourcesicon.value)
    db.createfolder()
}
</script>

<style lang="scss" scoped>
.createdbbg {
    // width: 100%;
    // height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    //模糊处理
    backdrop-filter: blur(2px);

    .createdb {
        width: 60%;
        height: 60%;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);

        .cards {
            display: flex;
            flex-direction: column;
            gap: 4px;
            height: 100%;

            .card {
                display: flex;

                .el-text {
                    min-width: 100px;
                    max-width: 100px;
                }

                .icon {
                    height: 32px;
                    line-height: 32px;
                    font-size: 20px;
                }
            }
        }

        .btns {
            display: flex;
            justify-content: flex-end;
            gap: 4px;
            flex: 1;

            .el-button {
                align-self: flex-end;
            }
        }
    }
}
</style>