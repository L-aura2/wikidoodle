<script setup>
import { useRouter } from 'vue-router'
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { Lijn } from '../game/Lijn.js'
import p5 from 'p5'
import { username } from '../stores/username.js'
import { useSocketStore } from '../stores/socketStore'
import { THEMES } from '../utils/themes.js'


const socket = useSocketStore()
const router = useRouter()

let p5Instance = null
const sketchContainer = ref(null)

const isDrawer = ref(false)
const selectedColor = ref('#000000')
const brushSize = ref(12)
const remoteLijnen = ref([])

const scores = ref({})

// const roundStartTime = ref(null)
// const roundDuration = ref(0)
// const timeLeft = ref(0)
// let timerInterval = null

// const roundActive = ref(false)

const wordLength = ref(0)

const roundEndReason = ref('')

const colors = [
  '#000000', '#FD79A8', '#E74C3C', '#3498DB',
  '#2ECC71', '#F1C40F', '#8B4513', '#FF8C42'
]

const messages = ref([])

const wordOptions = ref([])        // de 3 woorden die de tekenaar kan kiezen
const showWordChoice = ref(false)  // toon/verberg het keuze-scherm
const customWordInput = ref('')    // tekstveld eigen woord
const customWordError = ref('')    // foutmelding eigen woord
const isLoadingWords = ref(false)  // laad-indicator
const currentHint = ref('')        // hint na 90s of bij eigen woord
const chatInput = ref('')
const phase = ref('waiting')
const selectedTheme = ref(null)
const customThemeInput = ref('')
const customThemeError = ref('')
const customThemeSuccess = ref('')
const isValidatingTheme = ref(false)

const selectTheme = (id) => {
  selectedTheme.value = id
  customThemeInput.value = ''
  customThemeError.value = ''
  customThemeSuccess.value = ''
}

const confirmTheme = () => {
  if (!selectedTheme.value) return
  isValidatingTheme.value = true
  socket.send({ type: 'set-theme', theme: selectedTheme.value })
}

const validateCustomTheme = () => {
  if (!customThemeInput.value.trim()) return
  isValidatingTheme.value = true
  socket.send({
    type: 'set-theme',
    custom: true,
    wikidataId: customThemeInput.value.trim()
  })
}

// const startClientTimer = (startTime, duration) => {
//   roundStartTime.value = startTime
//   roundDuration.value = duration
//   roundActive.value = true
//   roundEndReason.value = ''

//   if (timerInterval) clearInterval(timerInterval)
//
//   timerInterval = setInterval(() => {
//     const elapsed = Date.now() - roundStartTime.value
//     const remaining = Math.max(0, Math.ceil((roundDuration.value - elapsed) / 1000))
//     timeLeft.value = remaining
//
//     if (remaining <= 0) {
//       clearInterval(timerInterval)
//       roundActive.value = false
//     }
//   }, 250) // 4x per seconde voor vloeiende weergave
// }

// const stopTimer = () => {
//   clearInterval(timerInterval)
//   timerInterval = null
//   roundActive.value = false
//   timeLeft.value = 0
// }

const wordHint = computed(() => {
  if (!wordLength.value) return ''
  return Array(wordLength.value).fill('_').join(' ')
})

const sendMessage = () => {
  if (!chatInput.value.trim()) return
  // if (!roundActive.value) return

  messages.value.push({
    username: username.value,
    text: chatInput.value,
    timestamp: new Date().toISOString()
  })

  socket.send({ type: 'chat-message', text: chatInput.value })
  chatInput.value = ''
}

let lijnen = []

const clearCanvas = () => {
  // if (!roundActive.value) return  // Doel 9
  lijnen = []
  remoteLijnen.value = []
  socket.send({ type: 'clear' })
}

const requestWords = () => {
  isLoadingWords.value = true
  socket.send({ type: 'request-words' })
}

const chooseWord = (word) => {
  socket.send({ type: 'choose-word', word, custom: false })
  showWordChoice.value = false
  wordOptions.value = []
}

const submitCustomWord = () => {
  const word = customWordInput.value.trim()
  if (!word) return
  if (word.length < 2) {
    customWordError.value = 'Woord moet minstens 2 letters hebben'
    return
  }
  socket.send({ type: 'choose-word', word, custom: true })
  showWordChoice.value = false
  customWordInput.value = ''
  customWordError.value = ''
}

const backToLobby = () => {
  // stopTimer()
  socket.disconnect()
  router.push('/lobby')
}

const sketch = (p) => {
  p.setup = function () {
    p.createCanvas(800, 600)
  }

  p.draw = function () {
    p.background(245, 240, 230)

    lijnen.forEach(lijn => {
      p.stroke(lijn.kleur)
      p.strokeWeight(lijn.dikte)
      p.line(lijn.x1, lijn.y1, lijn.x2, lijn.y2)
    })

    remoteLijnen.value.forEach(lijn => {
      p.stroke(lijn.kleur)
      p.strokeWeight(lijn.dikte)
      p.line(lijn.x1, lijn.y1, lijn.x2, lijn.y2)
    })

    if (isDrawer.value && p.mouseIsPressed &&
        p.mouseX > 0 && p.mouseX < p.width && p.mouseY > 0 && p.mouseY < p.height) {
      const lijn = new Lijn(
          p.mouseX, p.mouseY,
          p.pmouseX, p.pmouseY,
          selectedColor.value,
          brushSize.value
      )
      lijnen.push(lijn)
      socket.send({
        type: 'draw',
        x1: lijn.x1, y1: lijn.y1,
        x2: lijn.x2, y2: lijn.y2,
        kleur: lijn.kleur, dikte: lijn.dikte
      })
    }

    p.noFill()
    p.stroke(0)
    p.strokeWeight(2)
    p.rect(2, 2, p.width - 4, p.height - 4)
  }
}

// const handleReconnect = () => {
//   socket.send({ type: 'rejoin', username: username.value })
// }

onMounted(() => {
  socket.on('draw', (msg) => {
    remoteLijnen.value.push(new Lijn(msg.x1, msg.y1, msg.x2, msg.y2, msg.kleur, msg.dikte))
  })
  socket.on('clear', () => {
    remoteLijnen.value = []
    lijnen = []
  })
  socket.on('role', (msg) => {
    isDrawer.value = msg.isDrawer
    if (msg.isDrawer){
      phase.value = 'pick-theme'
    }
  })
  socket.on('chat-message', (msg) => {
    messages.value.push(msg)
  })
  socket.on('correct-answer', (msg) => {
    messages.value.push({ username: '🎉 Systeem', text: `Correct! Je krijgt ${msg.points} punten.`, timestamp: new Date().toISOString() })
  })
  socket.on('player-guessed', (msg) => {
    messages.value.push({ username: '🎉 Systeem', text: `${msg.username} heeft het geraden!`, timestamp: new Date().toISOString() })
  })

  socket.on('scores-update', (msg) => {
    scores.value = msg.scores
  })

  socket.on('word-options', (msg) => {
    wordOptions.value = msg.words
    showWordChoice.value = true
    isLoadingWords.value = false
  })

  socket.on('words-error', () => {
    isLoadingWords.value = false
  })

  socket.on('round-started', (msg) => {
    showWordChoice.value = false
    wordOptions.value = []
    currentHint.value = ''
    phase.value= 'drawing'
    if (msg.hint) {
      currentHint.value = msg.hint
      messages.value.push({
        username: '💡 Hint',
        text: msg.hint,
        timestamp: new Date().toISOString()
      })
    }
  })

  socket.on('round-ended', (msg) => {
    currentHint.value = ''
    roundEndReason.value = msg.reason || 'Ronde beëindigd'
    phase.value = 'waiting'
    messages.value.push({
      username: '~ Systeem ~',
      text: roundEndReason.value,
      timestamp: new Date().toISOString()
    })
  })

  socket.on('hint', (msg) => {
    currentHint.value = msg.text
    messages.value.push({
      username: '💡 Hint',
      text: msg.text,
      timestamp: new Date().toISOString()
    })
  })

  // socket.on('round-started', (msg) => {
  //   wordLength.value = msg.wordLength
  //   roundEndReason.value = ''
  //   startClientTimer(msg.startTime, msg.duration)
  //   messages.value.push({ username: '🎮 Systeem', text: `Nieuwe ronde! Woord heeft ${msg.wordLength} letters.`, timestamp: new Date().toISOString() })
  // })

  // socket.on('round-ended', (msg) => {
  //   stopTimer()
  //   wordLength.value = 0
  //   roundEndReason.value = msg.reason || 'Ronde beëindigd'
  //   messages.value.push({ username: '⏱️ Systeem', text: roundEndReason.value, timestamp: new Date().toISOString() })
  // })

  socket.on('player-left', (msg) => {
    messages.value.push({ username: '~ Systeem ~', text: `${msg.username} heeft de verbinding verloren.`, timestamp: new Date().toISOString() })
  })

  socket.on('player-joined', (msg) => {
    messages.value.push({ username: '~ Systeem ~', text: `${msg.username} is verbonden.`, timestamp: new Date().toISOString() })
  })
  socket.on('theme-set', (msg) => {
    selectedTheme.value = msg.theme
    isValidatingTheme.value = false
    if (isDrawer.value) {
      phase.value = 'pick-word'   // thema gekozen → naar woordkeuze
      requestWords()              // woorden automatisch ophalen
    }
  })

  socket.on('theme-rejected', (msg) => {
    customThemeError.value = `❌ ${msg.reason}`
    isValidatingTheme.value = false
  })

  // socket.on('socket:connected', handleReconnect)

  if (sketchContainer.value) {
    p5Instance = new p5(sketch, sketchContainer.value)
  }

})

onUnmounted(() => {
  // stopTimer()
  socket.off('draw')
  socket.off('clear')
  socket.off('role')
  socket.off('chat-message')
  socket.off('correct-answer')
  socket.off('player-guessed')
  socket.off('scores-update')
  socket.off('word-options')
  socket.off('words-error')
  socket.off('round-started')
  socket.off('round-ended')
  socket.off('hint')
  // socket.off('round-started')
  // socket.off('round-ended')
  socket.off('player-left')
  socket.off('player-joined')
  socket.off('theme-set')
  socket.off('theme-rejected')
  // socket.off('socket:connected')
  p5Instance.remove()
})
</script>

<<template>
  <div class="view">
    <h1>Game</h1>

    <div class="game-area">
      <!-- Thema kiezen — enkel voor tekenaar in fase pick-theme -->
      <div v-if="isDrawer && phase === 'pick-theme'" class="theme-choice">
        <h3>Kies een thema:</h3>
        <div class="theme-grid">
          <button
              v-for="theme in THEMES"
              :key="theme.id"
              class="theme-btn"
              :class="{ active: selectedTheme === theme.id }"
              @click="selectTheme(theme.id)"
          >
            {{ theme.label }}
          </button>
        </div>

        <div class="custom-theme">
          <label>Of voer een Wikidata ID in (bv. Q729)</label>
          <div class="custom-input-row">
            <input
                v-model="customThemeInput"
                type="text"
                placeholder="Q..."
                :disabled="isValidatingTheme"
            />
            <button @click="validateCustomTheme" :disabled="isValidatingTheme || !customThemeInput.trim()">
              {{ isValidatingTheme ? '⏳ Valideren...' : 'Valideer' }}
            </button>
          </div>
          <p v-if="customThemeError" class="error">{{ customThemeError }}</p>
        </div>

        <button
            class="confirm-btn"
            @click="confirmTheme"
            :disabled="!selectedTheme || isValidatingTheme"
        >
          {{ isValidatingTheme ? '⏳ Laden...' : 'Bevestig thema' }}
        </button>
      </div>

      <!-- Woord kiezen — enkel voor tekenaar in fase pick-word -->
      <div v-if="isDrawer && phase === 'pick-word'" class="word-choice">
        <div v-if="isLoadingWords" class="loading">⏳ Woorden ophalen...</div>
        <div v-else>
          <h3>Kies een woord om te tekenen:</h3>
          <div class="word-options">
            <button
                v-for="word in wordOptions"
                :key="word"
                class="word-option"
                @click="chooseWord(word)"
            >
              {{ word }}
            </button>
          </div>

          <div class="custom-word">
            <p>Of typ een eigen woord:</p>
            <div class="custom-word-row">
              <input
                  v-model="customWordInput"
                  type="text"
                  placeholder="Eigen woord..."
                  @keyup.enter="submitCustomWord"
              />
              <button @click="submitCustomWord">Bevestig</button>
            </div>
            <p v-if="customWordError" class="error">{{ customWordError }}</p>
          </div>
        </div>
      </div>

      <!-- Raaders zien een wachtmelding -->
      <div v-if="!isDrawer && phase === 'waiting'" class="waiting-msg">
        ⏳ Wacht op de tekenaar...
      </div>

      <div class="canvas-side">

        <div class="round-end-msg" v-if="roundEndReason">
          {{ roundEndReason }}
        </div>

        </div>

        <!-- Hint balk -->
        <div v-if="currentHint" class="hint-bar">
          💡 Hint: {{ currentHint }}
        </div>

        <div ref="sketchContainer" class="sketch-container"></div>

        <div v-if="isDrawer" class="toolbar">
          <div class="swatches">
            <button
                v-for="color in colors"
                :key="color"
                class="swatch"
                :style="{ backgroundColor: color }"
                :class="{ active: selectedColor === color }"
                @click="selectedColor = color"
            />
            <button
                class="swatch eraser"
                :class="{ active: selectedColor === '#F5F0E6' }"
                @click="selectedColor = '#F5F0E6'"
            >✖</button>
          </div>
          <div class="brush-control">
            <label>Dikte: {{ brushSize }}</label>
            <input type="range" min="2" max="40" v-model="brushSize" />
          </div>
          <button class="btn-clear" @click="clearCanvas">Clear</button>
        </div>

        <p v-else class="rader-melding">
          Jij bent aan het raden — je kan niet tekenen
        </p>

      </div>

      <div class="sidebar">
        <div class="scoreboard">
          <h3> Scores</h3>
          <ul>
            <li
                v-for="(score, player) in scores"
                :key="player"
                :class="{ 'me': player === username }"
            >
              <span class="player-name">{{ player }}</span>
              <span class="player-score">{{ score }}</span>
            </li>
          </ul>
        </div>

        <div class="chat">
          <div class="chat-messages">
            <div v-for="(msg, index) in messages" :key="index" class="chat-message">
              <span class="chat-username">{{ msg.username }}</span>
              <span class="chat-text">{{ msg.text }}</span>
              <span class="chat-time">{{ new Date(msg.timestamp).toLocaleTimeString() }}</span>
            </div>
          </div>
          <div class="chat-input">
            <input
                v-model="chatInput"
                type="text"
                placeholder="Typ je antwoord..."
                :disabled="isDrawer"
                @keyup.enter="sendMessage"
            />
            <button :disabled="isDrawer" @click="sendMessage">Stuur</button>
          </div>
        </div>


    </div>

    <button class="btn-lobby" @click="backToLobby">Back to Lobby</button>


  </div>
</template>



<style scoped>
.view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

h1 { margin-bottom: 4px; }

.game-area {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.canvas-side {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 280px;
}

.scoreboard {
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 10px 14px;
  background: #fff;
}

.scoreboard h3 {
  margin: 0 0 8px;
  font-size: 15px;
}

.scoreboard ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.scoreboard li {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  padding: 3px 0;
}

.scoreboard li.me {
  font-weight: bold;
  color: #2ecc71;
}

.player-score {
  font-weight: 600;
}

/* Chat */
.chat {
  display: flex;
  flex-direction: column;
  height: 480px;
  border: 1px solid #ccc;
  border-radius: 8px;
  overflow: hidden;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.chat-message {
  display: flex;
  flex-direction: column;
  font-size: 13px;
}

.chat-username { font-weight: 500; color: #333; }
.chat-text { color: #111; }
.chat-time { font-size: 11px; color: #999; }

.chat-input {
  display: flex;
  border-top: 1px solid #ccc;
}

.chat-input input {
  flex: 1;
  padding: 8px;
  border: none;
  outline: none;
  font-size: 14px;
}

.chat-input button {
  padding: 8px 12px;
  border: none;
  border-left: 1px solid #ccc;
  background: #fff;
  cursor: pointer;
}

.chat-input button:hover:not(:disabled) { background: #f0f0f0; }
.chat-input button:disabled,
.chat-input input:disabled { opacity: 0.5; cursor: not-allowed; }

/* Toolbar */
.toolbar {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.swatches { display: flex; gap: 8px; align-items: center; }

.swatch {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 3px solid transparent;
  cursor: pointer;
  padding: 0;
  transition: border-color 0.15s;
}

.swatch.active { border-color: white; outline: 2px solid #333; }

.eraser {
  background-color: #ddd;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.brush-control {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 14px;
}

.brush-control input { width: 120px; }

.btn-clear, .btn-lobby {
  padding: 6px 16px;
  cursor: pointer;
  border-radius: 6px;
  border: 1px solid #ccc;
  background: #fff;
  color: #000;
}

.btn-clear:hover, .btn-lobby:hover { background: #f0f0f0; }
.btn-lobby { align-self: flex-start; padding: 8px 20px; }

.rader-melding { color: #666; font-size: 14px; }

.word-request button {
  padding: 10px 20px;
  background: #42b983;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  cursor: pointer;
}

.word-request button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.word-choice {
  background: #f9f9f9;
  border: 1px solid #ddd;
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.word-choice h3 { margin: 0; font-size: 15px; }

.word-options {
  display: flex;
  gap: 10px;
}

.word-option {
  padding: 10px 18px;
  background: #fff;
  border: 2px solid #42b983;
  border-radius: 8px;
  font-size: 15px;
  cursor: pointer;
  color: #000;
  transition: background 0.15s;
}

.word-option:hover {
  background: #d4f5e9;
}

.custom-word { display: flex; flex-direction: column; gap: 6px; }
.custom-word p { margin: 0; font-size: 13px; color: #666; }

.custom-word-row { display: flex; gap: 8px; }

.custom-word-row input {
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 14px;
}

.custom-word-row button {
  padding: 8px 14px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.hint-bar {
  padding: 8px 14px;
  background: #fff9e6;
  border: 1px solid #f1c40f;
  border-radius: 8px;
  font-size: 14px;
  color: #856404;
}

.theme-choice {
  background: #f9f9f9;
  border: 1px solid #ddd;
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.theme-choice h3 { margin: 0; font-size: 15px; }

.theme-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.theme-btn {
  padding: 8px 14px;
  border: 2px solid #ccc;
  border-radius: 20px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  color: #000;
  transition: all 0.15s;
}

.theme-btn:hover { border-color: #42b983; }
.theme-btn.active {
  border-color: #42b983;
  background: #42b983;
  color: white;
}

.confirm-btn {
  padding: 10px 20px;
  background: #42b983;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  cursor: pointer;
  align-self: flex-start;
}

.confirm-btn:disabled { background: #ccc; cursor: not-allowed; }

.custom-theme { display: flex; flex-direction: column; gap: 6px; }
.custom-theme label { font-size: 13px; color: #666; }

.custom-input-row { display: flex; gap: 8px; }
.custom-input-row input {
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 14px;
  width: 160px;
}
.custom-input-row button {
  padding: 8px 14px;
  border-radius: 6px;
  border: none;
  background: #3498db;
  color: white;
  cursor: pointer;
}
.custom-input-row button:disabled { background: #ccc; cursor: not-allowed; }

.loading { color: #999; font-size: 14px; padding: 8px 0; }

.waiting-msg {
  color: #999;
  font-size: 14px;
  padding: 8px 0;
}

.error { color: #e74c3c; font-size: 13px; }
</style>