<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../stores/settings'
import { ElMessage, ElMessageBox } from 'element-plus'

const { t, locale } = useI18n()
const settingsStore = useSettingsStore()

import pkg from '../../../../package.json'
const version = computed(() => pkg.version)

async function checkUpdate() {
  ElMessage.info(t('menu.checkingUpdate'))
  try {
    const response = await fetch('https://api.github.com/repos/tsrdzy/ipixel/releases/latest')
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    const data = await response.json()
    console.log('[Update] GitHub API response:', JSON.stringify(data, null, 2))
    
    const latestVersion = (data.tag_name || '1.0.0').replace(/^v/i, '')
    const currentVersion = version.value
    
    console.log('[Update] Current version:', currentVersion)
    console.log('[Update] Latest version:', latestVersion)
    console.log('[Update] Update URL:', data.html_url)
    
    if (latestVersion !== currentVersion) {
      try {
        await ElMessageBox.confirm(
          t('menu.newVersion', { version: latestVersion }),
          t('menu.updateAvailable'),
          {
            confirmButtonText: t('menu.download'),
            cancelButtonText: t('common.cancel'),
            type: 'success'
          }
        )
        window.open(data.html_url, '_blank')
      } catch {
        // 用户取消
      }
    } else {
      ElMessage.success(t('menu.latestVersion'))
    }
  } catch (e) {
    console.error('[Update] Check failed:', e.message)
    ElMessage.error(t('menu.checkUpdateFailed'))
  }
}

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
          <div class="version-info">
            <span class="version-label">Version</span>
            <span class="version-value">{{ version }}</span>
            <el-button type="primary" size="small" @click="checkUpdate">检查更新</el-button>
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
            <el-select v-model="currentTheme" style="width: 100%" @change="(val) => { settingsStore.isDark = val === 'dark'; settingsStore.applyTheme() }">
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
  flex-shrink: 0;
  width: 80px;
}

.version-info {
  display: flex;
  align-items: center;
  gap: 12px;
}
.version-label {
  font-size: 14px;
  color: var(--text-2);
}
.version-value {
  font-size: 14px;
  color: var(--text-1);
  font-weight: 600;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
</style>
