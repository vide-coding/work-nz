import { createApp } from 'vue'
import App from './App.vue'
import { i18n } from './locales'
import router from './router'
import 'katex/dist/katex.min.css'
import './style.css'

createApp(App).use(i18n).use(router).mount('#app')
