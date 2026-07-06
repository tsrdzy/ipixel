<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useStore } from './composables/useStore'
import { ElMessageBox, ElMessage } from 'element-plus'

const { state, checkStatus } = useStore()
const { locale, t } = useI18n()
const route = useRoute()

// ===== 主题切换 =====
const isDark = ref(true)

function applyTheme(dark) {
  const root = document.documentElement
  if (dark) root.classList.add('dark')
  else root.classList.remove('dark')
  isDark.value = dark
  localStorage.setItem('imodel-theme', dark ? 'dark' : 'light')
}

function toggleTheme() {
  applyTheme(!isDark.value)
}

function initTheme() {
  const saved = localStorage.getItem('imodel-theme')
  if (saved === 'light') applyTheme(false)
  else applyTheme(true) // 默认暗色
}

// ===== 语言切换 =====
const languages = [
  { code: 'zh-CN', label: '中文' },
  { code: 'en-US', label: 'English' },
  { code: 'es-ES', label: 'Español' },
  { code: 'fr-FR', label: 'Français' },
  { code: 'de-DE', label: 'Deutsch' },
  { code: 'ja-JP', label: '日本語' },
  { code: 'ru-RU', label: 'Русский' }
]

function changeLanguage(lang) {
  locale.value = lang
  localStorage.setItem('imodel-language', lang)
}

function initLanguage() {
  const saved = localStorage.getItem('imodel-language')
  const validLanguages = languages.map(l => l.code)
  if (saved && validLanguages.includes(saved)) changeLanguage(saved)
  else changeLanguage('zh-CN')
}

// ===== 自定义标题栏 =====
const isMax = ref(false)
let removeMaxListener = null

function minimize() {
  window.api.windowControl.minimize()
}

function toggleMaximize() {
  window.api.windowControl.toggleMaximize()
}

function closeApp() {
  window.api.windowControl.close()
}

// ===== 更多菜单功能 =====
const GITHUB_REPO = 'https://github.com/tsrdzy/imodel'

function openGitHubUrl(path) {
  window.open(GITHUB_REPO + path, '_blank')
}

// ===== 侧边栏导航 =====
const sidebarItems = [
  { route: '/model', icon: '&#xe82a;', titleKey: 'sidebar.model' },
  { route: '/image', icon: '&#xeb24;', titleKey: 'sidebar.image' },
  { route: '/audio', icon: '&#xeb48;', titleKey: 'sidebar.audio' },
  { route: '/font', icon: '&#xe699;', titleKey: 'sidebar.font' },
  { route: '/tools', icon: '&#xeb64;', titleKey: 'sidebar.tools' }
]

async function showTutorial() {
  await ElMessageBox.alert(
    `<div style="text-align: left; padding: 10px;">
      <h4 style="margin: 0 0 12px 0;">${t('menu.tutorialTitle')}</h4>
      <p style="margin: 8px 0;">${t('menu.tutorial1')}</p>
      <p style="margin: 8px 0;">${t('menu.tutorial2')}</p>
      <p style="margin: 8px 0;">${t('menu.tutorial3')}</p>
      <p style="margin: 8px 0;">${t('menu.tutorial4')}</p>
      <p style="margin: 8px 0;">${t('menu.tutorial5')}</p>
    </div>`,
    t('menu.tutorial'),
    {
      dangerouslyUseHTMLString: true,
      confirmButtonText: t('common.close'),
      customClass: 'about-dialog'
    }
  )
}

async function showAbout() {
  await ElMessageBox.alert(
    `<div style="text-align: center; padding: 10px;">
      <div style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">IMODEL</div>
      <div style="font-size: 14px; color: var(--text-2); margin-bottom: 16px;">${t('menu.version')} 1.0.0</div>
      <div style="font-size: 13px; color: var(--text-3); line-height: 1.6;">
        <p>${t('menu.aboutDesc')}</p>
        <p style="margin-top: 12px;">${t('menu.license')}</p>
      </div>
      <div style="margin-top: 16px;">
        <a href="${GITHUB_REPO}" target="_blank" style="color: var(--primary); text-decoration: none;">${GITHUB_REPO}</a>
      </div>
    </div>`,
    t('menu.about'),
    {
      dangerouslyUseHTMLString: true,
      confirmButtonText: t('common.close'),
      customClass: 'about-dialog'
    }
  )
}

async function checkUpdate() {
  ElMessage.info(t('menu.checkingUpdate'))
  try {
    const response = await fetch('https://api.github.com/repos/tsrdzy/imodel/releases/latest')
    if (!response.ok) {
      throw new Error('Network error')
    }
    const data = await response.json()
    const latestVersion = data.tag_name || '1.0.0'
    if (latestVersion !== '1.0.0') {
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
  } catch {
    ElMessage.error(t('menu.checkUpdateFailed'))
  }
}

function handleMoreCommand(command) {
  switch (command) {
    case 'tutorial':
      showTutorial()
      break
    case 'feedback':
      openGitHubUrl('/issues')
      break
    case 'update':
      checkUpdate()
      break
    case 'about':
      showAbout()
      break
  }
}

onMounted(async () => {
  initTheme()
  initLanguage()
  checkStatus()

  // 初始化最大化状态
  try {
    isMax.value = await window.api.windowControl.isMaximized()
  } catch (e) {
    // ignore
  }

  // 监听最大化状态变化
  removeMaxListener = window.api.windowControl.onMaximizeChange((max) => {
    isMax.value = max
  })
})

onBeforeUnmount(() => {
  if (removeMaxListener) removeMaxListener()
})
</script>

<template>
  <div class="app-shell">
    <!-- 自定义标题栏 -->
    <header class="titlebar">
      <div class="titlebar-left">
        <div class="logo">
          <img src="./assets/icon.png" alt="iModel" />
        </div>
        <div class="title">{{ t('common.appTitle') }}</div>
      </div>

      <div class="titlebar-drag" />

      <div class="titlebar-right">
        <!-- 主题切换按钮 -->
        <el-button
          class="win-btn theme-btn"
          link
          @click="toggleTheme"
          :title="isDark ? t('common.theme.toggleLight') : t('common.theme.toggleDark')"
        >
          <i :class="['iconfont', isDark ? 'icon-sun' : 'icon-moon']"></i>
        </el-button>
        <!-- 语言切换下拉菜单 -->
        <el-dropdown @command="changeLanguage">
          <el-button class="win-btn lang-btn" link>
            <span style="font-family: 'iconfont'; font-size: 14px;">&#xeaae;</span>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="lang in languages" :key="lang.code" :command="lang.code">
                <span style="font-family: 'iconfont'; margin-right: 6px;">&#xeaae;</span>
                {{ lang.label }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button
          class="win-btn"
          link
          @click="minimize"
          title="最小化"
        >
          <i class="iconfont icon-minus"></i>
        </el-button>
        <el-button
          class="win-btn"
          link
          @click="toggleMaximize"
          :title="isMax ? '还原' : '最大化'"
        >
          <i class="iconfont icon-checkbox-on"></i>
        </el-button>
        <el-button
          class="win-btn close"
          link
          @click="closeApp"
          title="关闭"
        >
          <i class="iconfont icon-close"></i>
        </el-button>
      </div>
    </header>

    <!-- 内容区 -->
    <main class="app-content">
      <!-- 左侧边栏 -->
      <nav class="sidebar">
        <div class="sidebar-nav">
          <router-link
            v-for="item in sidebarItems"
            :key="item.route"
            :to="item.route"
            class="sidebar-item"
            :class="{ active: route.path === item.route }"
            :title="t(item.titleKey)"
          >
            <span class="iconfont sidebar-icon" v-html="item.icon"></span>
          </router-link>
        </div>
        <div class="sidebar-bottom">
          <el-dropdown trigger="click" @command="handleMoreCommand" placement="top-start">
            <button class="sidebar-item" :title="t('menu.more')">
              <span class="iconfont sidebar-icon">&#xeb3a;</span>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="tutorial">{{ t('menu.tutorial') }}</el-dropdown-item>
                <el-dropdown-item command="feedback">{{ t('menu.feedback') }}</el-dropdown-item>
                <el-dropdown-item command="update">{{ t('menu.checkUpdate') }}</el-dropdown-item>
                <el-dropdown-item command="about" divided>{{ t('menu.about') }}</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </nav>
      <!-- 路由内容 -->
      <div class="main-content">
        <router-view />
      </div>
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.titlebar {
  height: 36px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  background: var(--bg-soft);
  border-bottom: 1px solid var(--border-soft);
  user-select: none;
  padding-left: 12px;
}

.titlebar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.logo {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
.win-btn .iconfont {
  font-size: 14px;
}

.title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1.2px;
  color: var(--text-1);
}

/* 中间可拖拽区域（让窗口能拖动） */
.titlebar-drag {
  flex: 1;
  height: 100%;
  -webkit-app-region: drag;
}

.titlebar-right {
  display: flex;
  align-items: center;
  height: 100%;
  -webkit-app-region: no-drag;
}

.lang-btn {
  width: 46px;
  height: 36px;
  padding: 0 !important;
  color: var(--text-2) !important;
}
.lang-btn:hover {
  background: var(--bg-hover) !important;
  color: var(--text-1) !important;
}
.lang-btn :deep(.el-dropdown-menu__item.is-active) {
  background: transparent;
  color: var(--text-1);
}

.more-dropdown {
  -webkit-app-region: no-drag;
}
.more-btn {
  width: 36px;
  height: 30px;
  padding: 0 !important;
  color: var(--text-2) !important;
  margin-left: 4px;
}
.more-btn:hover {
  background: var(--bg-hover) !important;
  color: var(--text-1) !important;
}

.win-btn {
  width: 46px;
  height: 36px;
  padding: 0 !important;
  color: var(--text-2) !important;
}

.win-btn:hover {
  background: var(--bg-hover) !important;
  color: var(--text-1) !important;
}

.win-btn.close:hover {
  background: #e81123 !important;
  color: #fff !important;
}

.app-content {
  flex: 1;
  overflow: hidden;
  display: flex;
}

.sidebar {
  width: 44px;
  flex-shrink: 0;
  background: var(--bg-soft);
  border-right: 1px solid var(--border-soft);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  user-select: none;
}
.sidebar-nav {
  display: flex;
  flex-direction: column;
  padding-top: 4px;
}
.sidebar-bottom {
  display: flex;
  flex-direction: column;
  padding-bottom: 4px;
}
.sidebar-item {
  width: 44px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-3);
  text-decoration: none;
  border: none;
  background: transparent;
  transition: all 0.15s;
}
.sidebar-item:hover {
  background: var(--bg-hover);
  color: var(--text-1);
}
.sidebar-item.active {
  color: var(--primary);
  background: var(--bg-hover);
}
.sidebar-icon {
  font-size: 18px;
}

.main-content {
  flex: 1;
  overflow: hidden;
  display: flex;
}
</style>
