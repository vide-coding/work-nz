import { createVaporApp } from "vue";
import App from "./App.vue";
import { i18n } from "./locales";
import "./style.css";

createVaporApp(App as any).use(i18n).mount("#app");
