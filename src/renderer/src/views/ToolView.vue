<script setup>
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>

<template>
  <div class="placeholder-view">
    <span class="iconfont placeholder-icon">&#xeb64;</span>
    <p>{{ t('sidebar.tools') }}</p>
    <p class="placeholder-tip">{{ t('sidebar.comingSoon') }}</p>
  </div>
</template>

<style scoped>
.placeholder-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-3);
}
.placeholder-icon {
  font-size: 64px;
  margin-bottom: 8px;
}
.placeholder-view p {
  font-size: 18px;
  margin: 0;
}
.placeholder-tip {
  font-size: 14px !important;
}
</style>
