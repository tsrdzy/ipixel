<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useStore } from './composables/useStore'
import { useSettingsStore } from './stores/settings'
import { ElMessageBox, ElMessage, ElConfigProvider } from 'element-plus'
import pkg from '../../../package.json'

import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import en from 'element-plus/dist/locale/en.mjs'
import es from 'element-plus/dist/locale/es.mjs'
import fr from 'element-plus/dist/locale/fr.mjs'
import de from 'element-plus/dist/locale/de.mjs'
import ja from 'element-plus/dist/locale/ja.mjs'
import ru from 'element-plus/dist/locale/ru.mjs'

const elementPlusLocales = {
  'zh-CN': zhCn,
  'en-US': en,
  'es-ES': es,
  'fr-FR': fr,
  'de-DE': de,
  'ja-JP': ja,
  'ru-RU': ru
}

const { state, checkStatus } = useStore()
const settingsStore = useSettingsStore()
const { locale, t } = useI18n()
const route = useRoute()

const elLocale = computed(() => {
  return elementPlusLocales[locale.value] || zhCn
})

const isDark = computed(() => settingsStore.isDark)

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
const GITHUB_REPO = 'https://github.com/tsrdzy/ipixel'

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
      <div style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">iPixel</div>
      <div style="font-size: 14px; color: var(--text-2); margin-bottom: 16px;">${t('menu.version')} ${pkg.version}</div>
      <div style="font-size: 13px; color: var(--text-3); line-height: 1.6;">
        <p>一个简洁高效的素材资源管理工具，支持3D模型、图片、音频、字体等多种格式的本地化管理。</p>
        <p style="margin-top: 12px;">${t('menu.license')}</p>
      </div>
      <div style="margin-top: 20px; display: flex; justify-content: center; gap: 24px;">
        <a href="https://qm.qq.com/q/WqXZDSTHoW" target="_blank" style="color: var(--text-2); text-decoration: none; font-size: 24px;" title="QQ群">
          <span style="font-family: 'iconfont';">&#xe882;</span>
        </a>
        <a href="https://space.bilibili.com/364755642?spm_id_from=333.1007.0.0" target="_blank" style="color: var(--text-2); text-decoration: none; font-size: 24px;" title="B站">
          <span style="font-family: 'iconfont';">&#xea95;</span>
        </a>
        <a href="${GITHUB_REPO}" target="_blank" style="color: var(--text-2); text-decoration: none; font-size: 24px;" title="GitHub">
          <span style="font-family: 'iconfont';">&#xe691;</span>
        </a>
        <a href="mailto:420792287@qq.com" target="_blank" style="color: var(--text-2); text-decoration: none; font-size: 24px;" title="邮件反馈">
          <span style="font-family: 'iconfont';">&#xe62e;</span>
        </a>
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



function handleMoreCommand(command) {
  switch (command) {
    case 'tutorial':
      showTutorial()
      break
    case 'feedback':
      openGitHubUrl('/issues')
      break
    case 'settings':
      window.location.hash = '#/settings'
      break
    case 'about':
      showAbout()
      break
    case 'logs':
      window.location.hash = '#/logs'
      break
  }
}

onMounted(async () => {
  settingsStore.init()
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
  <ElConfigProvider :locale="elLocale">
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
        <div
          v-if="settingsStore.showThemeInTitlebar"
          class="title-btn theme-btn"
          @click="settingsStore.toggleTheme"
          :title="isDark ? t('common.theme.toggleLight') : t('common.theme.toggleDark')"
        >
          <i :class="['iconfont', isDark ? 'icon-sun' : 'icon-moon']"></i>
        </div>
        <el-dropdown v-if="settingsStore.showLanguageInTitlebar" @command="changeLanguage">
          <div class="title-btn lang-btn">
            <span style="font-family: 'iconfont'; font-size: 14px;">&#xeaae;</span>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="lang in languages" :key="lang.code" :command="lang.code">
                <span style="font-family: 'iconfont'; margin-right: 6px;">&#xeaae;</span>
                {{ lang.label }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <div class="title-btn" @click="minimize" title="最小化">
          <i class="iconfont icon-minus"></i>
        </div>
        <div class="title-btn" @click="toggleMaximize" :title="isMax ? '还原' : '最大化'">
          <i class="iconfont icon-checkbox-on"></i>
        </div>
        <div class="title-btn close" @click="closeApp" title="关闭">
          <i class="iconfont icon-close"></i>
        </div>
      </div>
    </header>

    <!-- 内容区 -->
    <main class="app-content">
      <!-- 左侧边栏：仅在资源库已设置时显示 -->
      <transition name="sidebar">
        <nav class="sidebar" v-if="state.initialized">
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
                  <el-dropdown-item command="settings">{{ t('menu.settings') }}</el-dropdown-item>
                  <el-dropdown-item command="logs" divided>操作日志</el-dropdown-item>
                  <el-dropdown-item command="about">{{ t('menu.about') }}</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </nav>
      </transition>
      <!-- 路由内容 -->
      <div class="main-content">
        <router-view />
      </div>
    </main>
  </div>
  </ElConfigProvider>
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
  gap: 0;
}

.title-btn {
  width: 46px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-2);
  transition: all 0.15s;
}

.title-btn:hover {
  background: var(--bg-hover);
  color: var(--text-1);
}

.title-btn.close:hover {
  background: #e81123;
  color: #fff;
}

.title-btn .iconfont {
  font-size: 14px;
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
  height: 100%;
  overflow: hidden;
  display: flex;
}

.sidebar-enter-active,
.sidebar-leave-active {
  transition: all 0.25s ease;
}

.sidebar-enter-from,
.sidebar-leave-to {
  width: 0;
  opacity: 0;
  overflow: hidden;
}
</style>
