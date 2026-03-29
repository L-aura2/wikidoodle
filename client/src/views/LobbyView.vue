<script setup>
import { useRouter } from 'vue-router'
import { username } from '../stores/username.js'
import { useSocketStore } from '../stores/socketStore'
import { onMounted, onUnmounted, ref } from 'vue'

const router = useRouter()
const socket = useSocketStore()
const webmentions = ref([])


const joinGame = () => {
  if (!username.value.trim()) return
  socket.connect()
  // Wacht tot verbinding open is, dan join sturen
  const tryJoin = () => {
    if (socket.isConnected) {
      socket.send({ type: 'join', username: username.value })
      router.push('/game')
    } else {
      setTimeout(tryJoin, 50)
    }
  }
  tryJoin()
}

const selectTheme = (id) => {
  selectedTheme.value = id
  customThemeInput.value = ''
  customThemeError.value = ''
  customThemeSuccess.value = ''
}

const validateCustomTheme = () => {
  if (!customThemeInput.value.trim()) return
  isValidating.value = true
  customThemeError.value = ''
  customThemeSuccess.value = ''

  socket.connect()
  const tryValidate = () => {
    if (socket.isConnected) {
      socket.send({
        type: 'set-theme',
        custom: true,
        wikidataId: customThemeInput.value.trim()
      })
    } else {
      setTimeout(tryValidate, 50)
    }
  }
  tryValidate()
}

onMounted(async () => {
  try {
    const isDev = window.location.hostname === 'localhost'
    const url = isDev
        ? '/webmentions'                                                          // no filter in dev
        : '/webmentions?target=' + encodeURIComponent(window.location.href)      // filter in prod
    const res = await fetch(url)
    webmentions.value = await res.json()
  } catch (e) {
    console.warn('Could not load webmentions', e)
  }
})

onUnmounted(() => {

})
</script>

<template>
  <div class="view">
    <h1>Wikidoodle</h1>
    <p id="status" class="status">
      <span v-if="socket.isConnected" class="connected">✅ Connected to server</span>
      <span v-else class="disconnected">❌ Disconnected</span>
    </p>

    <div class="join-form">
      <label for="username-input">Gebruikersnaam</label>
      <input
          id="username-input"
          v-model="username"
          type="text"
          placeholder="Jouw naam..."
          maxlength="20"
          @keyup.enter="joinGame"
      />
      <button
          class="join-btn"
          @click="joinGame"
          :disabled="!socket.isConnected || !username.trim()"
      >
        {{ socket.isConnected ? 'Join Game' : 'Waiting for connection...' }}
        <!-- {{ !selectedTheme ? 'Kies eerst een thema' : 'Join Game' }} -->
      </button>
    </div>
    <section v-if="webmentions.length" class="webmentions">
      <h2>Mentions</h2>
      <ul>
        <li v-for="mention in webmentions" :key="mention.source" class="mention">
          <a :href="mention.source" target="_blank" rel="noopener">
            {{ mention.author || mention.source }}
          </a>
          <span v-if="mention.title"> — {{ mention.title }}</span>
          <time :datetime="mention.receivedAt">
            {{ new Date(mention.receivedAt).toLocaleDateString() }}
          </time>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.status {
  font-weight: 500;
  margin: 20px 0;
}

.connected {
  color: #42b983;
}

.disconnected {
  color: #e74c3c;
}

.join-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 260px;
}

.join-form label {
  font-weight: 500;
  font-size: 14px;
}

.join-form input {
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
}

.join-form input:focus {
  border-color: #42b983;
}

.join-form button {
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  background: #42b983;
  color: white;
  font-size: 14px;
  cursor: pointer;
}

.join-form button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.join-form button:hover:not(:disabled) {
  background: #369870;
}

.webmentions {
  margin-top: 40px;
  width: 100%;
  max-width: 500px;
}

.webmentions h2 {
  font-size: 16px;
  color: #666;
  margin-bottom: 10px;
}

.mention {
  display: flex;
  gap: 8px;
  align-items: baseline;
  font-size: 13px;
  padding: 6px 0;
  border-bottom: 1px solid #eee;
}

.mention a {
  color: #42b983;
  text-decoration: none;
  font-weight: 500;
}

.mention time {
  margin-left: auto;
  color: #999;
  font-size: 11px;
}
</style>

