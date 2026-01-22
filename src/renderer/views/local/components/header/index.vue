<template>
    <div class="header">
        <div class="search">
            <el-input @input="search()" class="search_input" v-model="searchInputValue" size="small" placeholder="搜索资源"
                clearable />
        </div>
        <div class="setings">
            <div class="classification">

                <!-- 导入时间 -->
                <el-dropdown @command="handle_created_at" :show-arrow="false" size="small">
                    <span class="el-dropdown-link ">
                        {{ created_at_lists.name }}<span class="iconfont">&#xeaf9;</span>
                    </span>
                    <template #dropdown>
                        <el-dropdown-menu>
                            <el-dropdown-item command="ALL">全部</el-dropdown-item>
                            <el-dropdown-item :command="option.value" :key="option"
                                v-for="option in created_at_lists.data">{{
                                    option.option }}</el-dropdown-item>
                        </el-dropdown-menu>
                    </template>
                </el-dropdown>
                <!-- 格式 -->
                <el-dropdown @command="handle_format" :show-arrow="false" size="small">
                    <span class="el-dropdown-link ">
                        {{ format_lists.name }}<span class="iconfont">&#xeaf9;</span>
                    </span>
                    <template #dropdown>
                        <el-dropdown-menu>
                            <el-dropdown-item command="ALL">全部</el-dropdown-item>
                            <el-dropdown-item :command="option.value" :key="option"
                                v-for="option in format_lists.data">{{
                                    option.option }}</el-dropdown-item>
                        </el-dropdown-menu>
                    </template>
                </el-dropdown>
                <!-- 尺寸 -->
                <el-dropdown @command="handle_width" :show-arrow="false" size="small">
                    <span class="el-dropdown-link ">
                        {{ width_lists.name }}<span class="iconfont">&#xeaf9;</span>
                    </span>
                    <template #dropdown>
                        <el-dropdown-menu>
                            <el-dropdown-item command="ALL">全部</el-dropdown-item>
                            <el-dropdown-item :command="option.value" :key="option"
                                v-for="option in width_lists.data">{{
                                    option.option }}</el-dropdown-item>
                        </el-dropdown-menu>
                    </template>
                </el-dropdown>
                <!-- 大小 -->
                <el-dropdown @command="handle_size" :show-arrow="false" size="small">
                    <span class="el-dropdown-link ">
                        {{ size_lists.name }}<span class="iconfont">&#xeaf9;</span>
                    </span>
                    <template #dropdown>
                        <el-dropdown-menu>
                            <el-dropdown-item command="ALL">全部</el-dropdown-item>
                            <el-dropdown-item :command="option.value" :key="option" v-for="option in size_lists.data">{{
                                option.option }}</el-dropdown-item>
                        </el-dropdown-menu>
                    </template>
                </el-dropdown>
                <!-- 格式 -->
                <el-dropdown @command="handle_rating" :show-arrow="false" size="small">
                    <span class="el-dropdown-link ">
                        {{ rating_lists.name }}<span class="iconfont">&#xeaf9;</span>
                    </span>
                    <template #dropdown>
                        <el-dropdown-menu>
                            <el-dropdown-item command="ALL">全部</el-dropdown-item>
                            <el-dropdown-item :command="option.value" :key="option"
                                v-for="option in rating_lists.data">{{
                                    option.option }}</el-dropdown-item>
                        </el-dropdown-menu>
                    </template>
                </el-dropdown>
            </div>
            <div class="btns ">
                <el-popover :show-arrow="false" placement="bottom" :width="200" trigger="hover">
                    <template #reference>
                        <div class="btn iconfont">&#xeb56;</div>
                    </template>
                    <el-slider v-model="cardSize" :step="10" show-stops />
                </el-popover>

                <el-dropdown :show-arrow="false" size="small">
                    <div class="btn iconfont">&#xeb14;</div>
                    <template #dropdown>
                        <el-dropdown-menu>
                            <el-dropdown-item>Action 1</el-dropdown-item>
                        </el-dropdown-menu>
                    </template>
                </el-dropdown>

                <el-dropdown :show-arrow="false" size="small">
                    <div class="btn iconfont">&#xeb5f;</div>
                    <template #dropdown>
                        <el-dropdown-menu>
                            <el-dropdown-item>Action 1</el-dropdown-item>
                        </el-dropdown-menu>
                    </template>
                </el-dropdown>

                <el-dropdown :show-arrow="false" size="small">
                    <div class="btn iconfont">&#xeb1f;</div>
                    <template #dropdown>
                        <el-dropdown-menu>
                            <el-dropdown-item>Action 1</el-dropdown-item>
                        </el-dropdown-menu>
                    </template>
                </el-dropdown>
            </div>
        </div>

    </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import * as api from '@/apis/resourcesdb/index.js'
import { useLocalStore } from '@/pinia/local';
const localStore = useLocalStore()
const searchInputValue = ref('');//搜索框绑定的值
const cardSize = ref(0)
const getdatas = ref()

const created_at_lists = ref({
    name: '导入时间',
    value: '',
    isOptions: false,
    data: [
        {
            option: '今天', value: [
                { key: 'created_at', value: getTimeRangeTimestamps('today').minTimestamp.toString(), operator: '>=', type: 'AND' },
                { key: 'created_at', value: getTimeRangeTimestamps('today').maxTimestamp.toString(), operator: '<', type: 'AND' }
            ]
        },
        {
            option: '昨天', value: [
                { key: 'created_at', value: getTimeRangeTimestamps('yesterday').minTimestamp.toString(), operator: '>=', type: 'AND' },
                { key: 'created_at', value: getTimeRangeTimestamps('yesterday').maxTimestamp.toString(), operator: '<', type: 'AND' }
            ]
        },
        {
            option: '三天内', value: [
                { key: 'created_at', value: getTimeRangeTimestamps('threedays').minTimestamp.toString(), operator: '>=', type: 'AND' },
                { key: 'created_at', value: getTimeRangeTimestamps('threedays').maxTimestamp.toString(), operator: '<', type: 'AND' }
            ]
        },
        {
            option: '七天内', value: [
                { key: 'created_at', value: getTimeRangeTimestamps('sevenDays').minTimestamp.toString(), operator: '>=', type: 'AND' },
                { key: 'created_at', value: getTimeRangeTimestamps('sevenDays').maxTimestamp.toString(), operator: '<', type: 'AND' }
            ]
        },
        {
            option: '一个月内', value: [
                { key: 'created_at', value: getTimeRangeTimestamps('oneMonth').minTimestamp.toString(), operator: '>=', type: 'AND' },
                { key: 'created_at', value: getTimeRangeTimestamps('oneMonth').maxTimestamp.toString(), operator: '<', type: 'AND' }
            ]
        },
        {
            option: '三个月内', value: [
                { key: 'created_at', value: getTimeRangeTimestamps('threeMonths').minTimestamp.toString(), operator: '>=', type: 'AND' },
                { key: 'created_at', value: getTimeRangeTimestamps('threeMonths').maxTimestamp.toString(), operator: '<', type: 'AND' }
            ]
        },
        {
            option: '半年内', value: [
                { key: 'created_at', value: getTimeRangeTimestamps('halfYear').minTimestamp.toString(), operator: '>=', type: 'AND' },
                { key: 'created_at', value: getTimeRangeTimestamps('halfYear').maxTimestamp.toString(), operator: '<', type: 'AND' }
            ]
        },
        {
            option: '一年内', value: [
                { key: 'created_at', value: getTimeRangeTimestamps('oneYear').minTimestamp.toString(), operator: '>=', type: 'AND' },
                { key: 'created_at', value: getTimeRangeTimestamps('oneYear').maxTimestamp.toString(), operator: '<', type: 'AND' }
            ]
        },
        {
            option: '一年外', value: [
                { key: 'created_at', value: getTimeRangeTimestamps('oneYear').maxTimestamp.toString(), operator: '>=', type: 'AND' }
            ]
        },

    ]
},)
const format_lists = ref({ name: '格式', value: '', isOptions: true, data: [] })
const width_lists = ref({
    name: '尺寸', value: '', isOptions: true, data: [
        {
            option: '4px      (<=4px)',
            isSelect: false,
            value: { key: 'width', value: 4, operator: '<=', type: 'AND' }
        },
        {
            option: '16px     (5px-16x)',
            value: { key: 'width', value: 16, operator: '<=', type: 'AND' }
        },
        { option: '32px     (17px-32x)', value: [{ key: 'width', value: 32, operator: '<=', type: 'AND' }] },
        { option: '64px     (33px-64x)', value: [{ key: 'width', value: 64, operator: '<=', type: 'AND' }] },
        { option: '128px    (65px-128x)', value: [{ key: 'width', value: 128, operator: '<=', type: 'AND' }] },
        { option: '256px    (129px-256x)', value: [{ key: 'width', value: 256, operator: '<=', type: 'AND' }] },
        { option: '512px    (257px-512x)', value: [{ key: 'width', value: 512, operator: '<=', type: 'AND' }] },
        { option: '1024px   (513px-1024x)', value: [{ key: 'width', value: 1024, operator: '<=', type: 'AND' }] },
        { option: '∞        (>1025px)', value: [{ key: 'width', value: 1024, operator: '>', type: 'AND' }] }
    ]
})
const size_lists = ref({
    name: '文件大小', value: '', isOptions: true, data: [
        {
            option: '<1kb',
            value: { key: 'size', value: 1024, operator: '<=', type: 'AND' }
        },
        {
            option: '1kb-4kb',
            value: [
                { key: 'size', value: 4096, operator: '<=', type: 'AND' },
                { key: 'size', value: 1024, operator: '>', type: 'AND' }
            ]
        },
        {
            option: '4kb-8kb',
            value: [
                { key: 'size', value: 4096, operator: '>', type: 'AND' },
                { key: 'size', value: 8192, operator: '<=', type: 'AND' }
            ]
        },
        {
            option: '8kb-16kb',
            value: [
                { key: 'size', value: 8192, operator: '>', type: 'AND' },
                { key: 'size', value: 16384, operator: '<=', type: 'AND' }
            ]
        },
        {
            option: '16kb-32kb',
            value: [
                { key: 'size', value: 16384, operator: '>', type: 'AND' },
                { key: 'size', value: 32768, operator: '<=', type: 'AND' }
            ]
        },
        {
            option: '32kb-64kb',
            value: [
                { key: 'size', value: 32768, operator: '>', type: 'AND' },
                { key: 'size', value: 65536, operator: '<=', type: 'AND' }
            ]
        },
        {
            option: '64kb-128kb',
            value: [
                { key: 'size', value: 65536, operator: '>', type: 'AND' },
                { key: 'size', value: 131072, operator: '<=', type: 'AND' }
            ]
        },
        {
            option: '128kb-256kb',
            value: [
                { key: 'size', value: 131072, operator: '>', type: 'AND' },
                { key: 'size', value: 262144, operator: '<=', type: 'AND' }
            ]
        },
        {
            option: '256kb-512kb',
            value: [
                { key: 'size', value: 262144, operator: '>', type: 'AND' },
                { key: 'size', value: 524288, operator: '<=', type: 'AND' }
            ]
        },
        {
            option: '512kb-1mb',
            value: [
                { key: 'size', value: 524288, operator: '>', type: 'AND' },
                { key: 'size', value: 1048576, operator: '<=', type: 'AND' }
            ]
        },
        {
            option: '>1mb',
            value: [
                { key: 'size', value: 1048576, operator: '>', type: 'AND' }
            ]
        },
    ]
})
const rating_lists = ref({
    name: '评分', value: '', isOptions: true, data: [
        {
            option: '1',
            value: [
                { key: 'rating', value: 1, operator: '=', type: 'AND' }
            ]
        },
        {
            option: '2',
            value: [
                { key: 'rating', value: 2, operator: '=', type: 'AND' }
            ]
        },
        {
            option: '3',
            value: [
                { key: 'rating', value: 3, operator: '=', type: 'AND' }
            ]
        },
        {
            option: '4',
            value: [
                { key: 'rating', value: 4, operator: '=', type: 'AND' }
            ]
        },
        {
            option: '5',
            value: [
                { key: 'rating', value: 5, operator: '=', type: 'AND' }
            ]
        },
    ]
}
);//分类列表


function handle_created_at(command) {
    localStore.getWhere.created_at = command
}
function handle_format(command) {
    localStore.getWhere.format = command
}
function handle_width(command) {
    localStore.getWhere.width = command
}
function handle_size(command) {
    localStore.getWhere.size = command
}
function handle_rating(command) {
    localStore.getWhere.rating = command
}

onMounted(async () => {
    getlists()
})
async function getlists() {
    getdatas.value = await api.DB_getheaderlist()
    format_lists.value.data = getdatas.value
    console.log(format_lists.value)
}

/**
 * 根据时间范围关键字获取最小和最大时间戳（到秒）
 * @param {string} rangeKey - 时间范围关键字
 * @returns {Object} 包含minTimestamp和maxTimestamp的对象
 */
function getTimeRangeTimestamps(rangeKey) {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    switch (rangeKey.toLowerCase()) {
        case 'today':
            // 今天：从当天0点到23点59分59秒
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            break;

        case 'yesterday':
            // 昨天：从昨天0点到23点59分59秒
            startDate.setDate(now.getDate() - 1);
            startDate.setHours(0, 0, 0, 0);
            endDate.setDate(now.getDate() - 1);
            endDate.setHours(23, 59, 59, 999);
            break;

        case 'threedays':
            // 三天：从三天前0点到今天23点59分59秒
            startDate.setDate(now.getDate() - 2);
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            break;

        case 'sevendays':
            // 七天：从七天前0点到今天23点59分59秒
            startDate.setDate(now.getDate() - 6);
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            break;

        case 'onemonth':
            // 一个月：从一个月前0点到今天23点59分59秒
            startDate.setMonth(now.getMonth() - 1);
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            break;

        case 'threemonths':
            // 三个月：从三个月前0点到今天23点59分59秒
            startDate.setMonth(now.getMonth() - 3);
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            break;

        case 'halfyear':
            // 半年：从半年前0点到今天23点59分59秒
            startDate.setMonth(now.getMonth() - 6);
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            break;

        case 'oneyear':
            // 一年：从一年前0点到今天23点59分59秒
            startDate.setFullYear(now.getFullYear() - 1);
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            break;

        default:
            throw new Error('不支持的时间范围关键字');
    }

    // 返回时间戳（秒级）
    return {
        minTimestamp: Math.floor(startDate.getTime() / 1000),
        maxTimestamp: Math.floor(endDate.getTime() / 1000)
    };
}

function search() {
    // localStore.getWhere.search = searchInputValue.value
    let data = []
    if (searchInputValue.value != '') {
        for (var i = 0; i < searchInputValue.value.length; i++) {
            data.push({ key: 'name', value: searchInputValue.value[i]+'', operator: 'LIKE', type: 'OR' })
        }
    }
    localStore.getWhere.search = data
}
</script>

<style lang="scss" scoped>
.header {
    display: flex;
    flex-direction: column;
    gap: 4px;

    .search {
        height: 24px;
        align-items: center;

        .search_input {
            width: 100%;
        }
    }

    .tags {
        display: flex;
        gap: 4px;
        height: 24px;
        align-items: center;
    }

    .setings {
        display: flex;
        justify-content: space-between;
        align-items: center;
        height: 24px;

        .classification {
            display: flex;
            gap: 4px;

            .el-dropdown-link {
                cursor: pointer;
                user-select: none;
                margin-right: 10px;
            }
        }

        .btns {
            display: flex;
            gap: 4px;
            align-items: center;

            .btn {
                width: 20px;
                height: 20px;
                border-radius: 3px;
                border: 1px solid var(--el-border-color);
                display: flex;
                justify-content: center;
                align-items: center;
                user-select: none;
                -webkit-user-select: none;

                &:hover {
                    background-color: #77777733;
                }
            }
        }
    }

}
</style>
