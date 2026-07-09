import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  const isDark = ref(true)
  const showThemeInTitlebar = ref(true)
  const showLanguageInTitlebar = ref(true)
  const deviceInfo = ref(null)

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

  return {
    isDark,
    showThemeInTitlebar,
    showLanguageInTitlebar,
    deviceInfo,
    init,
    toggleTheme,
    setShowThemeInTitlebar,
    setShowLanguageInTitlebar,
    loadDeviceInfo
  }
})
