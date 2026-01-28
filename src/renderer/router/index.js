import { createRouter, createWebHistory } from 'vue-router'

import local from '@/views/local/index.vue'
import store from '@/views/store/index.vue'
import tools from '@/views/tools/index.vue'
import shop from '@/views/shop/index.vue'
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/local'
    },
    {
      path: '/local',
      name: 'Local',
      component: local
    },

    {
      path: '/store',
      name: 'Store',
      component: store
    },
    {
      path: '/shop',
      name: 'shop',
      component: shop
    },
    {
      path: '/tools',
      name: 'Tools',
      component: tools
    }
  ]
})

export default router
