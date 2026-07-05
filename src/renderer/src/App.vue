<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useStore } from './composables/useStore'
import InitView from './views/InitView.vue'
import HomeView from './views/HomeView.vue'
import UploadView from './views/UploadView.vue'

const { state, checkStatus } = useStore()
const { locale, t } = useI18n()

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
      <InitView v-if="state.view === 'init'" />
      <HomeView v-else-if="state.view === 'home'" />
      <UploadView v-else-if="state.view === 'upload' || state.view === 'edit'" />
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
</style>
