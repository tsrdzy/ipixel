<template>
  <div class="tools">
    <el-scrollbar height="100%">
      <div class="cards">
        <el-card :key="tooltypes.value" v-for="tooltypes in tools" class="tooltypes">
          <template #header>
            <div class="header">
              <div class="title">{{ tooltypes.label }}</div>
            </div>
          </template>
          <div class="tooltype">
            <div :key="tool.name" v-for="tool in tooltypes.children" class="tool"
              @click="dialogTableVisible = true; newtool = tool">
              <div class="left iconfont" v-html="tool.icon"></div>
              <div class="right">
                <div class="title">{{ tool.name }}</div>
                <div class="content">{{ tool.content }}</div>
              </div>
            </div>
          </div>

        </el-card>
      </div>

    </el-scrollbar>
    <el-dialog :close-on-click-modal="false" draggable v-model="dialogTableVisible" width="80%">
      <template #header>
        {{ newtool.name }}
      </template>
      <template v-if="newtool.component == 'imagetopixel'">
        <Timagetopixel></Timagetopixel>
      </template>
      <template v-else-if="newtool.component == 'imageformatconversion'">
        <Timageformatconversion></Timageformatconversion>
      </template>
      <template v-else-if="newtool.component == 'icoImageformatconversion'">
        <TicoImageformatconversion></TicoImageformatconversion>
      </template>
      <template v-else-if="newtool.component == 'imagecompression'">
        <Timagecompression></Timagecompression>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import Timagetopixel from '@/views/tools/components/imagetopixel/index.vue';
import Timageformatconversion from '@/views/tools/components/imageformatconversion/index.vue';
import TicoImageformatconversion from '@/views/tools/components/icoImageformatconversion/index.vue';
import Timagecompression from '@/views/tools/components/imagecompression/index.vue';
const dialogTableVisible = ref(false);
const newtool = ref('');
const tools = ref([
  {
    label: '图片工具',
    value: 'images',
    icon: '&#xeb24;',
    children: [
      {
        name: '图片转像素图',
        icon: '&#xeb24;',
        content: '快速把图片转换为像素图',
        component: 'imagetopixel'
      },
      {
        name: '图片格式转换',
        icon: '&#xeb24;',
        content: '支持多种图片格式互转',
        component: 'imageformatconversion'
      },
      {
        name: 'ICO图标转换',
        icon: '&#xeb24;',
        content: 'ICO图标快速生成',
        component: 'icoImageformatconversion'
      },
      {
        name: '图片压缩',
        icon: '&#xeb24;',
        content: '无损压缩图片',
        component: 'imagecompression'
      },
    ]
  },
  {
    label: '音频工具',
    value: 'images',
    icon: '&#xeb24;',
    children: []
  },
  {
    label: '视频工具',
    value: 'images',
    icon: '&#xeb24;',
    children: []
  },
  {
    label: '模型工具',
    value: 'images',
    icon: '&#xeb24;',
    children: []
  }
])

</script>

<style lang="scss" scoped>
.tools {
  width: calc(100%);
  height: calc(100% - 16px);
  padding: 8px;
  gap: 8px;

  .cards {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .tooltypes {
      width: calc(100% - 8px);
      height: auto;

      .header {
        display: flex;
        align-items: center;
        font-size: 22px;
        font-weight: bold;
        height: 40px;
        line-height: 40px;

        // .icon {

        //   border-radius: 5px;
        //   width: 40px;
        //   height: 40px;
        //   line-height: 40px;
        //   text-align: center;
        //   font-size: 42px;
        // }

        .title {}
      }

      .tooltype {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;

        .tool {
          min-width: 200px;
          max-width: 200px;
          border-radius: 5px;
          box-shadow: 0 2px 12px 0 rgba(0, 0, 0, .1);
          padding: 10px;
          gap: 10px;
          font-size: 14px;
          height: 60px;
          display: flex;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;

          .left {
            font-size: 50px;
            width: 60px;
            height: 60px;
            line-height: 60px;
            text-align: center;
          }

          .right {
            .title {
              font-weight: bold;
              font-size: 16px;
              height: 30px;
              line-height: 30px;
            }

            .content {
              height: 30px;
              line-height: 30px;
              max-width: 140px;
              color: #777;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
          }
        }
      }

    }
  }


}
</style>
