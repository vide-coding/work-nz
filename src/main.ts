// import { createApp } from "vue";
import { createVaporApp } from "vue";
// import { createVaporApp } from "@vue/runtime-vapor";

import App from "./App.vue";
import "./style.css";

// Use createVaporApp for true Vapor mode root
// Cast App to any to avoid TS conflict between DefineComponent (VDOM) and VaporComponent
createVaporApp(App as any).mount("#app");
