<template>
    <div class="cards" v-if="false">
        <!-- <TCard></TCard> -->
    </div>
    <div class="cards empty">
        <el-empty>
            <el-button type="primary">导入文件</el-button>
            <el-button type="primary">导入文件夹</el-button>
        </el-empty>
    </div>

</template>

<script setup>
import TCard from '@/views/local/components/cards/components/card.vue';
import { onMounted } from 'vue';
onMounted(async () => {
    // console.log(await db.resource.search({}, true))
})
</script>

<style lang="scss" scoped>
.cards {
    flex: 1;
}

.empty {
    display: flex;
    flex-direction: column;
    justify-content: center;
}
</style>