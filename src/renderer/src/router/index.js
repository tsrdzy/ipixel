import { createRouter, createWebHashHistory } from 'vue-router'
import ModelLayout from '../views/ModelLayout.vue'

const routes = [
  {
    path: '/',
    redirect: '/model'
  },
  {
    path: '/model',
    name: 'model',
    component: ModelLayout,
    meta: { icon: '&#xe82a;', title: 'sidebar.model' }
  },
  {
    path: '/image',
    name: 'image',
    component: () => import('../views/ImageLayout.vue'),
    meta: { icon: '&#xeb24;', title: 'sidebar.image' }
  },
  {
    path: '/audio',
    name: 'audio',
    component: () => import('../views/AudioLayout.vue'),
    meta: { icon: '&#xeb48;', title: 'sidebar.audio' }
  },
  {
    path: '/font',
    name: 'font',
    component: () => import('../views/FontLayout.vue'),
    meta: { icon: '&#xe8b4;', title: 'sidebar.font' }
  },
  {
    path: '/tools',
    name: 'tools',
    component: () => import('../views/ToolView.vue'),
    meta: { icon: '&#xeb64;', title: 'sidebar.tools' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
