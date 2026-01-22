<template>
    <div class="card" @click="clickCard" :class="localStore.currentlySelectedID == props.data.id ? 'active' : ''">
        <div class="resources" v-if="file.type == 'image'">
            <img :src="file.base64" alt="无数据">
        </div>
        <div class="resources" v-else-if="file.type == 'ase'">
            <img :src="file.base64" alt="无数据">
        </div>
        <div class="resources other" v-else>
            <div class="img">
                <span class="iconfont">&#xeb13;</span>
                {{ props.data.format }}
            </div>
        </div>
        <div class="tag" size="small">
            {{ props.data.format.substring(1).toUpperCase() }}
        </div>
    </div>
</template>

<script setup>
import { watch, ref, onMounted } from 'vue'
import bufferToBase64 from '@/utils/bufferToBase64.js'
import { useLocalStore } from '@/pinia/local'
const localStore = useLocalStore()
const types = ref({
    '.png': { type: 'image', value: 'image/png' },
    '.jpg': { type: 'image', value: 'image/jpeg' },
    '.jpeg': { type: 'image', value: 'image/jpeg' },
    '.gif': { type: 'image', value: 'image/gif' },
    '.svg': { type: 'image', value: 'image/svg+xml' },
    '.webp': { type: 'image', value: 'image/webp' },
    '.txt': { type: 'txt', value: 'text/plain' },
    '.html': { type: 'txt', value: 'text/html' },
    '.css': { type: 'txt', value: 'text/css' },
    '.js': { type: 'txt', value: 'application/javascript' },
    '.json': { type: 'txt', value: 'application/json' },
    '.pdf': { type: 'pdf', value: 'application/pdf' }
})
const imageTypeArray = ref(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'])
const aseTypeArray = ref(['.ase', '.aseprite'])
const file = ref({
    type: '',
    base64: ''
})
const props = defineProps(
    {
        data: {
            type: Object,
        }
    }
)
onMounted(() => {
    getbufferdata()
})
watch(() => props.data, (newdate) => {
    getbufferdata()
})
async function getbufferdata() {
    const data = await db.readFile(props.data.hash)
    const extension = data.fileInfo.extension
    if (data.success) {
        const buffer = data.data
        if (imageTypeArray.value.includes(props.data.format)) {
            file.value.base64 = await bufferToBase64(buffer, types.value[extension]?.value)
            file.value.type = 'image'
        } else if (aseTypeArray.value.includes(props.data.format)) {
            const asedata = await utils.asetopng(buffer)
            file.value.base64 = await bufferToBase64(asedata.pngData, '.png')
            file.value.type = 'ase'
        }



    }

}
function clickCard() {
    localStore.currentlySelectedID = props.data.id
    localStore.currentlySelectedType = 'resources'



}
</script>

<style lang="scss" scoped>
.card {
    width: 96px;
    height: 96px;
    position: relative;
    border: 2px solid #00000000;
    border-radius: 2px;

    &:hover {
        border: 2px solid var(--el-color-primary);
    }

    .resources {
        width: 100%;
        height: 100%;

        img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            image-rendering: pixelated;
        }
    }

    .other {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        color: #777;

        .img {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;

            span {
                font-size: 30px;
            }
        }
    }

    .tag {
        position: absolute;
        top: 0;
        left: 0;
        background-color: var(--el-bg-color-page);
        font-size: 10px;
        border-radius: 2px;
        padding: 0 2px;
        color: var(--el-text-color-primary);
        margin: 2px;
    }

}

.active {
    border: 2px solid var(--el-color-primary);

    .resources {
        display: flex;
        justify-content: center;
        align-items: center;

        img {
            width: 98%;
            height: 98%;

        }
    }

}
</style>