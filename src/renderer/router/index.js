import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      redirect: "/local",
    },
    {
      path: "/local",
      name: "Local",
      component: () => import("@/views/local/index.vue"),
    },
    {
      path: "/store",
      name: "Store",
      component: () => import("@/views/store/index.vue"),
    },
    {
      path: "/tools",
      name: "Tools",
      component: () => import("@/views/tools/index.vue"),
    },
  ],
});

export default router;
