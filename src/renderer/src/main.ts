import '@xterm/xterm/css/xterm.css'
import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import { disableNativeTitleTooltips } from './lib/disableNativeTitle'

disableNativeTitleTooltips()

createApp(App).mount('#app')
