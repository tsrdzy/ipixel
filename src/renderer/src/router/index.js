import { createRouter, createWebHashHistory } from 'vue-router'
import ModelLayout from '../views/ModelLayout.vue'
import LibrarySelectView from '../views/LibrarySelectView.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    meta: { requiresAuth: false }
  },
  {
    path: '/select-library',
    name: 'select-library',
    component: LibrarySelectView,
    meta: { requiresAuth: false }
  },
  {
    path: '/model',
    name: 'model',
    component: ModelLayout,
    meta: { icon: '&#xe82a;', title: 'sidebar.model', requiresAuth: true }
  },
  {
    path: '/image',
    name: 'image',
    component: () => import('../views/ImageLayout.vue'),
    meta: { icon: '&#xeb24;', title: 'sidebar.image', requiresAuth: true }
  },
  {
    path: '/audio',
    name: 'audio',
    component: () => import('../views/AudioLayout.vue'),
    meta: { icon: '&#xeb48;', title: 'sidebar.audio', requiresAuth: true }
  },
  {
    path: '/font',
    name: 'font',
    component: () => import('../views/FontLayout.vue'),
    meta: { icon: '&#xe8b4;', title: 'sidebar.font', requiresAuth: true }
  },
  {
    path: '/tools',
    name: 'tools',
    component: () => import('../views/ToolView.vue'),
    meta: { icon: '&#xeb64;', title: 'sidebar.tools', requiresAuth: true }
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/SettingsView.vue'),
    meta: { icon: '&#xe704;', title: 'menu.settings', requiresAuth: true }
  },
  {
    path: '/shortcuts',
    name: 'shortcuts',
    component: () => import('../views/ShortcutsView.vue'),
    meta: { icon: '&#xe617;', title: 'menu.shortcuts', requiresAuth: true }
  },
  {
    path: '/logs',
    name: 'logs',
    component: () => import('../views/LogsView.vue'),
    meta: { icon: '&#xe60a;', title: 'menu.operationLogs', requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach(async (to, from) => {
  const { useStore } = await import('../composables/useStore')
  const { state, checkStatus } = useStore()

  if (!state.libraries.length || state.view === 'init') {
    try {
      await checkStatus()
    } catch (e) {
      console.error('checkStatus failed:', e)
    }
  }

  if (!state.initialized && to.meta.requiresAuth) {
    return '/select-library'
  }

  if (to.path === '/') {
    return state.initialized ? '/model' : '/select-library'
  }
})

export default router
