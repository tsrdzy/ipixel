<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../stores/settings'

const { t, locale } = useI18n()
const settingsStore = useSettingsStore()

import pkg from '../../../../package.json'
const version = computed(() => pkg.version)

const themes = [
  { value: 'dark', label: t('settings.dark') },
  { value: 'light', label: t('settings.light') }
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
          <el-descriptions :column="1" border>
            <el-descriptions-item label="Version">{{ version }}</el-descriptions-item>
          </el-descriptions>
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
            <el-select v-model="currentTheme" style="width: 180px" @change="(val) => { settingsStore.isDark = val === 'dark'; settingsStore.applyTheme() }">
              <el-option v-for="theme in themes" :key="theme.value" :label="theme.label" :value="theme.value" />
            </el-select>
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
          <el-select v-model="locale" style="width: 100%" @change="changeLanguage">
            <el-option v-for="lang in languages" :key="lang.code" :label="lang.label" :value="lang.code" />
          </el-select>
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
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
</style>
