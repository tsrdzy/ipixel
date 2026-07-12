<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../stores/settings'
import { ElMessage, ElMessageBox } from 'element-plus'

const { t, locale } = useI18n()
const settingsStore = useSettingsStore()

import pkg from '../../../../package.json'
const version = computed(() => pkg.version)
const latestVersion = ref('')
const hasUpdate = ref(false)
const releaseUrl = ref('')

async function checkUpdate() {
  try {
    const response = await fetch('https://api.github.com/repos/tsrdzy/ipixel/releases/latest')
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    const data = await response.json()
    
    latestVersion.value = (data.tag_name || '1.0.0').replace(/^v/i, '')
    hasUpdate.value = latestVersion.value !== version.value
    releaseUrl.value = data.html_url || ''
  } catch (e) {
    console.error('检查更新失败:', e)
  }
}

function openReleaseUrl() {
  if (releaseUrl.value) {
    window.open(releaseUrl.value, '_blank')
  }
}

checkUpdate()

const themes = [
  { value: 'dark', label: t('settings.dark') },
  { value: 'light', label: t('settings.light') }
]

const skins = [
  { value: '#F56C6C', label: '红', name: 'red' },
  { value: '#E6A23C', label: '橙', name: 'orange' },
  { value: '#E6E600', label: '黄', name: 'yellow' },
  { value: '#67C23A', label: '绿', name: 'green' },
  { value: '#409EFF', label: '蓝', name: 'blue' },
  { value: '#9B59B6', label: '紫', name: 'purple' },
  { value: '#909399', label: '灰', name: 'gray' }
]

const languages = [
  { code: 'zh-CN', label: '中文' },
  { code: 'en-US', label: 'English' },
  { code: 'es-ES', label: 'Español' },
  { code: 'fr-FR', label: 'Français' },
  { code: 'de-DE', label: 'Deutsch' },
  { code: 'ja-JP', label: '日本語' },
  { code: 'ru-RU', label: 'Русский' }
]

const currentTheme = computed({
  get() { return settingsStore.isDark ? 'dark' : 'light' },
  set(val) {
    settingsStore.isDark = val === 'dark'
    localStorage.setItem('imodel-theme', val)
    settingsStore.applyTheme()
  }
})

function changeLanguage(lang) {
  locale.value = lang
  localStorage.setItem('imodel-language', lang)
}
</script>

<template>
  <div class="settings-container h-100">
    <div class="settings-header">
      <h2>{{ t('menu.settings') }}</h2>
    </div>
    <div class="settings-content">
      <el-card>
        <template #header>
          <span>{{ t('settings.general') }}</span>
        </template>
        <div class="settings-section">
          <div class="setting-item">
            <span class="setting-label">{{ t('settings.version') }}</span>
            <div class="version-info">
              <span class="setting-value">v{{ version }}</span>
              <span v-if="hasUpdate" class="update-badge update-badge-warning" @click="openReleaseUrl">{{ t('menu.newVersionAvailable', { version: latestVersion }) }}</span>
              <span v-else-if="latestVersion" class="update-badge update-badge-success">{{ t('menu.latestVersion') }}</span>
            </div>
          </div>
          <div class="setting-item">
            <span class="setting-label">{{ t('menu.checkUpdate') }}</span>
            <el-switch v-model="settingsStore.checkForUpdates" @change="(val) => settingsStore.setCheckForUpdates(val)" />
          </div>
        </div>
      </el-card>

      <el-card>
        <template #header>
          <div class="card-header">
            <span>{{ t('settings.appearance') }}</span>
            <el-checkbox
              v-model="settingsStore.showThemeInTitlebar"
              @change="(val) => settingsStore.setShowThemeInTitlebar(val)"
              size="small"
            >
              {{ t('settings.showInTitlebar') }}
            </el-checkbox>
          </div>
        </template>
        <div class="settings-section">
          <div class="setting-item">
            <span class="setting-label">{{ t('settings.theme') }}</span>
            <el-select v-model="currentTheme" style="width: 100%">
              <el-option v-for="theme in themes" :key="theme.value" :label="theme.label" :value="theme.value" />
            </el-select>
          </div>
          <div class="setting-item setting-item-left">
            <span class="setting-label">{{ t('settings.skin') }}</span>
            <div class="skin-picker">
              <div
                v-for="skinItem in skins"
                :key="skinItem.value"
                class="skin-item"
                :class="{ active: settingsStore.skin === skinItem.value }"
                :style="{ '--skin-color': skinItem.value }"
                @click="settingsStore.setSkin(skinItem.value)"
                :title="skinItem.label"
              >
                <div class="skin-color"></div>
                <span class="skin-label">{{ skinItem.label }}</span>
              </div>
            </div>
          </div>
        </div>
      </el-card>

      <el-card>
        <template #header>
          <div class="card-header">
            <span>{{ t('settings.language') }}</span>
            <el-checkbox
              v-model="settingsStore.showLanguageInTitlebar"
              @change="(val) => settingsStore.setShowLanguageInTitlebar(val)"
              size="small"
            >
              {{ t('settings.showInTitlebar') }}
            </el-checkbox>
          </div>
        </template>
        <div class="settings-section">
          <div class="setting-item">
            <span class="setting-label">{{ t('settings.language') }}</span>
            <el-select v-model="locale" style="width: 100%" @change="changeLanguage">
              <el-option v-for="lang in languages" :key="lang.code" :label="lang.label" :value="lang.code" />
            </el-select>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.settings-container {
  padding: 24px;
  width: 100%;
  height: 100%;
  overflow: auto;
}

.settings-header {
  margin-bottom: 24px;
}

.settings-header h2 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-1);
  margin: 0;
}

.settings-content {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-section {
  padding: 16px 0;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-soft);
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-label {
  font-size: 14px;
  color: var(--text-1);
  flex-shrink: 0;
  width: 80px;
}

.setting-value {
  font-size: 14px;
  color: var(--text-2);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.support-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 0;
}

.support-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 215, 0, 0.1);
  border-radius: 12px;
}

.support-info {
  flex: 1;
}

.support-title {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}

.support-desc {
  display: block;
  font-size: 12px;
  color: var(--text-3);
  margin-top: 4px;
}

.version-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.update-badge {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
}

.update-badge-success {
  color: #67c23a;
  background: rgba(103, 194, 58, 0.1);
}

.update-badge-warning {
  color: #f56c6c;
  background: rgba(245, 108, 108, 0.1);
  cursor: pointer;
  text-decoration: underline;
}

.update-badge-warning:hover {
  text-decoration: underline;
}

.skin-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: flex-start;
}

.setting-item-left {
  justify-content: flex-start;
  gap: 16px;
}

.skin-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.skin-item:hover {
  background: var(--bg-hover);
  border-color: rgba(0, 0, 0, 0.1);
}

.skin-item.active {
  border-color: var(--primary);
  background: var(--primary-soft);
}

.skin-color {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background-color: var(--skin-color);
  border: 2px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.skin-label {
  font-size: 12px;
  color: var(--text-3);
}

</style>
