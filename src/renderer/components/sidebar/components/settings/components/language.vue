<template>
    <el-text size="small">语言</el-text>
    <div class="languages">
        <el-select size="small" v-model="value" placeholder="Select">
            <el-option v-for="item in options" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
    </div>

</template>

<script setup>

</script>

<style lang="scss" scoped>

</style>