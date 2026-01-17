import { createApp } from "vue";
import App from "./App.vue";
import router from "@/router";
import pinia from "@/pinia";
import i18n from "@/i18n";
import ElementPlus from "element-plus";

import "@/assets/styles/index.scss";
import "element-plus/dist/index.css";
import "element-plus/theme-chalk/dark/css-vars.css";

const app = createApp(App);

app.use(router);
app.use(pinia);
app.use(i18n);
app.use(ElementPlus);
app.mount("#app");
