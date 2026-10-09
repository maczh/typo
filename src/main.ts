import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import i18n from './i18n'
import { registerToast } from './composables/useTauri'
import { showToast } from './utils/toast'

import './styles/variables.css'
import './styles/app.css'
// Crepe base theme: common structure + Nord (light) color variables.
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/nord.css'
// Mermaid diagram blocks (source-hide + diagram preview).
import './styles/mermaid.css'
// Typora-parity refinements (source markers, tables, code blocks). Must load
// after the Crepe theme so its rules take precedence by source order.
import './styles/typora.css'

const app = createApp(App)

// Route Tauri-bridge errors through the global toast.
registerToast((msg, type = 'error') => showToast(msg, type))

app.use(createPinia())
app.use(i18n)
app.mount('#app')
