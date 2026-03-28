import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router/router'

console.log('Wikidoodle client starting...')

const app = createApp(App)

// Use Pinia for state management
app.use(createPinia())

// Use Vue Router
app.use(router)

// Mount to DOM
app.mount('#app')

console.log('Wikidoodle client mounted')
