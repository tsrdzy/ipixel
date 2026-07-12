import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

import pkg from '@root/package.json'

export const useSettingsStore = defineStore('settings', () => {
  const isDark = ref(true)
  const showThemeInTitlebar = ref(true)
  const showLanguageInTitlebar = ref(true)
  const deviceInfo = ref(null)
  const checkForUpdates = ref(true)

  async function loadDeviceInfo() {
    try {
      const info = await window.api.logs.getDeviceInfo()
      deviceInfo.value = info
      localStorage.setItem('imodel-deviceInfo', JSON.stringify(info))
    } catch (e) {
      console.error('加载设备信息失败:', e)
    }
  }

  function init() {
    const savedTheme = localStorage.getItem('imodel-theme')
    if (savedTheme === 'light') isDark.value = false
    else isDark.value = true

    const savedThemeTitlebar = localStorage.getItem('imodel-showThemeInTitlebar')
    if (savedThemeTitlebar !== null) showThemeInTitlebar.value = savedThemeTitlebar === 'true'

    const savedLangTitlebar = localStorage.getItem('imodel-showLanguageInTitlebar')
    if (savedLangTitlebar !== null) showLanguageInTitlebar.value = savedLangTitlebar === 'true'

    const savedDeviceInfo = localStorage.getItem('imodel-deviceInfo')
    if (savedDeviceInfo) {
      try {
        deviceInfo.value = JSON.parse(savedDeviceInfo)
      } catch {
        deviceInfo.value = null
      }
    }

    const savedCheckUpdates = localStorage.getItem('imodel-checkForUpdates')
    if (savedCheckUpdates !== null) checkForUpdates.value = savedCheckUpdates === 'true'

    applyTheme()
  }

  function applyTheme() {
    const root = document.documentElement
    if (isDark.value) root.classList.add('dark')
    else root.classList.remove('dark')
  }

  function toggleTheme() {
    isDark.value = !isDark.value
    localStorage.setItem('imodel-theme', isDark.value ? 'dark' : 'light')
    applyTheme()
  }

  function setShowThemeInTitlebar(val) {
    showThemeInTitlebar.value = val
    localStorage.setItem('imodel-showThemeInTitlebar', val ? 'true' : 'false')
  }

  function setShowLanguageInTitlebar(val) {
    showLanguageInTitlebar.value = val
    localStorage.setItem('imodel-showLanguageInTitlebar', val ? 'true' : 'false')
  }

  function setCheckForUpdates(val) {
    checkForUpdates.value = val
    localStorage.setItem('imodel-checkForUpdates', val ? 'true' : 'false')
  }

  async function checkUpdate() {
    if (!checkForUpdates.value) return null

    try {
      const response = await fetch('https://api.github.com/repos/tsrdzy/ipixel/releases/latest')
      if (!response.ok) return null

      const data = await response.json()
      const latestVersion = (data.tag_name || '1.0.0').replace(/^v/i, '')
      const currentVersion = pkg.version

      if (latestVersion !== currentVersion) {
        return {
          hasUpdate: true,
          latestVersion,
          currentVersion,
          releaseUrl: data.html_url
        }
      }
    } catch (e) {
      console.error('检查更新失败:', e)
    }

    return { hasUpdate: false }
  }

  return {
    isDark,
    showThemeInTitlebar,
    showLanguageInTitlebar,
    deviceInfo,
    checkForUpdates,
    init,
    toggleTheme,
    setShowThemeInTitlebar,
    setShowLanguageInTitlebar,
    setCheckForUpdates,
    loadDeviceInfo,
    checkUpdate
  }
})
