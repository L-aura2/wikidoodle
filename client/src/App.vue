<template>
  <div id="app">
    <div v-if="!isOnline" class="offline-banner">
      📡 Je bent offline...
    </div>
    <router-view />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

// Router is injected automatically by vue-router
const router = useRouter()
const isOnline = ref(navigator.onLine)
const setOnline = () => { isOnline.value = true }
const setOffline = () => { isOnline.value = false }
onMounted(() => {
  window.addEventListener('online', setOnline)
  window.addEventListener('offline', setOffline)
})

onUnmounted(() => {
  window.removeEventListener('online', setOnline)
  window.removeEventListener('offline', setOffline)
})
</script>

<style>
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background: #f5f5f5;
    color: #333;
}

#app {
    width: 100%;
    min-height: 100vh;
}

.view {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 20px;
}

h1 {
    font-size: 2.5em;
    margin-bottom: 20px;
    color: #2c3e50;
}

button {
    padding: 10px 20px;
    font-size: 1em;
    border: none;
    border-radius: 4px;
    background: #DC143C;
    color: white;
    cursor: pointer;
    transition: background 0.3s;
}

button:hover:not(:disabled) {
    background: #B22222;
}

button:disabled {
    background: #ccc;
    cursor: not-allowed;
}

p {
    margin: 10px 0;
    font-size: 1.1em;
}
.offline-banner {
  background: #e74c3c;
  color: white;
  text-align: center;
  padding: 10px;
  font-size: 1em;
  position: sticky;
  top: 0;
  z-index: 999;
}
</style>

