import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { fetchWordsForCategory, validateCustomTheme, fetchHintsForWord } from './sparql/wordFetcher.js'
import express from 'express'
import fetch from 'node-fetch'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'  // ← add this
import path from 'path'
import cors from 'cors'


const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MENTIONS_FILE = path.join(__dirname, 'data', 'webmentions.json')
const app = express()
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(cors({ origin: 'https://wikidoodle-frontend.onrender.com' }))
const httpServer = createServer(app)
const wss = new WebSocketServer({ server: httpServer })

const gameState = {
    currentWord: null,
    currentHint: null,
    currentDrawer: null,
    roundStartTime: null,
    roundDuration: 120000,
    currentTheme: null,
    wordPool: [],
    scores: {},
    drawerQueue: []
}

function broadcast(senderWs, message) {
    const data = JSON.stringify(message)
    wss.clients.forEach((client) => {
        if (client !== senderWs && client.readyState === 1) {
            client.send(data)
        }
    })
}

// Stuur naar iedereen inclusief afzender
function broadcastAll(message) {
    const data = JSON.stringify(message)
    wss.clients.forEach((client) => {
        if (client.readyState === 1) {
            client.send(data)
        }
    })
}

function broadcastScores() {
    broadcastAll({ type: 'scores-update', scores: gameState.scores })
}

function handleDrawerDisconnect(username) {
    // gameState.roundActive = false
    clearTimeout(gameState.hintTimeout)
    gameState.currentWord = null
    gameState.currentHint = null
    gameState.currentDrawer = null
    broadcastAll({
        type: 'round-ended',
        reason: `${username} (tekenaar) heeft de verbinding verloren`
    })
    broadcastAll({ type: 'drawer-left' })
    assignNextDrawer()
}
function assignNextDrawer() {
    // Verwijder disconnected clients uit de drawerQueue
    gameState.drawerQueue = gameState.drawerQueue.filter(ws => ws.readyState === 1)

    if (gameState.drawerQueue.length === 0) return

    const next = gameState.drawerQueue.shift()
    gameState.drawerQueue.push(next) // Zet de nieuwe tekenaar achteraan in de rij

    gameState.currentDrawer = next
    gameState.currentWord = null
    gameState.currentHint = null
    gameState.currentTheme = null
    gameState.wordPool = []

    // Vertel iedereen zijn nieuwe rol.
    wss.clients.forEach(client => {
        if (client.readyState === 1) {
            const isDrawer = client === next
            client.send(JSON.stringify({ type: 'role', isDrawer }))
        }
    })
}
wss.on('connection', (ws) => {
    console.log('Client connected')

    //disconnect detectie
    ws.isAlive = true
    ws.on('pong', () => { ws.isAlive = true })

    ws.on('message', async (raw) => {
        const msg = JSON.parse(raw)
        console.log('Received:', msg)

        switch (msg.type) {

            case 'hello':
                ws.send(JSON.stringify({
                    type: 'hello-ack',
                    text: 'hello from server'
                }))
                break
            case 'join':
                ws.username = msg.username
                gameState.scores[msg.username] = gameState.scores[msg.username] ?? 0
                gameState.drawerQueue.push(ws)

                // Eerste speler die joint wordt automatisch tekenaar
                if (gameState.currentDrawer === null) {
                    gameState.currentDrawer = ws
                    ws.send(JSON.stringify({type: 'role', isDrawer: true}))
                } else {
                    // Anderen zijn raaders
                    ws.send(JSON.stringify({type: 'role', isDrawer: false}))
                }
                ws.send(JSON.stringify({type: 'scores-update', scores: gameState.scores}))
                broadcastAll({type: 'player-joined', username: msg.username})
                broadcastScores()
                break

            case 'draw':
                // Controleer op server of de afzender de tekenaar is
                if (ws !== gameState.currentDrawer) return
                // if (!gameState.roundActive) return
                broadcast(ws, {type: 'draw', ...msg})
                break

            case 'clear':
                if (ws !== gameState.currentDrawer) return
                // if (!gameState.roundActive) return
                broadcast(ws, {type: 'clear'})
                break

            case 'chat-message': {
                const timestamp = new Date().toISOString()
                if (gameState.currentWord &&
                    msg.text.toLowerCase() === gameState.currentWord.toLowerCase()) {

                    const elapsed = (Date.now() - gameState.roundStartTime) / 1000
                    const points = Math.max(10, Math.round(100 - elapsed))

                    ws.send(JSON.stringify({type: 'correct-answer', points}))
                    gameState.scores[ws.username] = (gameState.scores[ws.username] ?? 0) + points
                    ws.hasGuessed = true
                    broadcast(ws, {type: 'player-guessed', username: ws.username})
                    broadcastScores()

                    //check of iedereen geraden heeft
                    const nonDrawers = [...wss.clients].filter(c => c !== gameState.currentDrawer)
                    const allGuessed = nonDrawers.length > 0 && nonDrawers.every(c => c.hasGuessed)
                    if (allGuessed) {
                        clearTimeout(gameState.hintTimeout)
                        clearTimeout(gameState.roundTimeout)
                        broadcastAll({ type: 'round-ended', reason: `Iedereen heeft het geraden! Het woord was: "${gameState.currentWord}"` })
                        gameState.currentWord = null
                        gameState.currentHint = null
                        assignNextDrawer()
                    }

                } else {
                    broadcast(ws, {type: 'chat-message', username: ws.username, text: msg.text, timestamp})
                }
                break

            }

            case 'start-round': {
                gameState.currentWord = msg.word
                gameState.currentDrawer = ws
                gameState.roundStartTime = Date.now()
                // gameState.roundActive = true

                broadcastAll({
                    type: 'round-started',
                    wordLength: msg.word.length,
                    // startTime: gameState.roundStartTime,
                    // duration: gameState.roundDuration
                })
                break
            }
            case 'end-round': {
                if (ws !== gameState.currentDrawer) return
                clearTimeout(gameState.hintTimeout)
                clearTimeout(gameState.roundTimeout)
                gameState.currentWord = null
                gameState.currentHint = null
                broadcastAll({type: 'round-ended', reason: 'Ronde beëindigd door tekenaar'})
                assignNextDrawer()
                break
            }
            case 'set-theme': {
                try {
                    let words
                    if (msg.custom) {
                        words = await validateCustomTheme(msg.wikidataId)
                        words = words.map(label => ({label, description: ''}))
                        console.log(`Custom theme ${msg.wikidataId} has ${words.length} words`)
                        if (words.length < 25) {
                            ws.send(JSON.stringify({
                                type: 'theme-rejected',
                                reason: `Te weinig woorden gevonden (${words.length}/25)`
                            }))
                            return
                        }
                    } else {
                        words = await fetchWordsForCategory(msg.theme)
                        console.log('Fetched words for theme', msg.theme, 'count:', words.length)
                    }
                    gameState.currentTheme = msg.theme ?? msg.wikidataId
                    gameState.wordPool = words
                    console.log('Word pool set with', gameState.wordPool.length, 'words')
                    broadcastAll({type: 'theme-set', theme: gameState.currentTheme})
                } catch (err) {
                    ws.send(JSON.stringify({type: 'theme-rejected', reason: 'Fout bij ophalen: ' + err}))
                }
                break
            }
            case 'request-words': {
                if (ws !== gameState.currentDrawer) return
                if (gameState.wordPool.length === 0) {
                    ws.send(JSON.stringify({type: 'words-error', message: 'Geen woorden beschikbaar'}))
                    return
                }
                // Kies 3 willekeurige woorden
                const shuffled = [...gameState.wordPool].sort(() => Math.random() - 0.5)
                const options = shuffled.slice(0, 3).map(w => w.label)
                ws.send(JSON.stringify({type: 'word-options', words: options}))
                break
            }
            case 'choose-word': {
                wss.clients.forEach(c => {
                    c.hasGuessed = false
                })
                if (ws !== gameState.currentDrawer) return
                const wordLabel = msg.word?.trim()
                if (!wordLabel) return

                let wordObj = null
                let isCustom = msg.custom
                if (isCustom) {
                    // For custom words, create a wordObj-like object
                    wordObj = { label: wordLabel, description: null }
                } else {
                    wordObj = gameState.wordPool.find(w => w.label === wordLabel)
                    if (!wordObj) return
                }

                gameState.currentWord = wordObj.label
                gameState.currentHint = wordObj.description
                gameState.roundStartTime = Date.now()

                const roundPayload = {
                    type: 'round-started',
                    wordLength: wordObj.label.length,
                    startTime: gameState.roundStartTime,
                    duration: gameState.roundDuration,
                    // ...(isCustom ? {hint: `Het woord begint met de letter "${wordLabel[0].toUpperCase()}"`} : {})
                }
                broadcastAll(roundPayload)

                // Auto-end achter 2 minutes
                clearTimeout(gameState.roundTimeout)
                gameState.roundTimeout = setTimeout(() => {
                    if (!gameState.currentWord) return
                    broadcastAll({type: 'round-ended', reason: `Tijd is om! Het woord was: "${gameState.currentWord}"`})
                    gameState.currentWord = null
                    gameState.currentHint = null
                    assignNextDrawer()
                }, gameState.roundDuration)

                // Hint achter 90s
                if (!isCustom) {
                    clearTimeout(gameState.hintTimeout)
                    gameState.hintTimeout = setTimeout(() => {
                        if (!gameState.currentWord) return
                        const guessedAll = [...wss.clients].every(c => c.hasGuessed || c === gameState.currentDrawer)
                        if (!guessedAll) {
                            if (gameState.currentHint) {
                                broadcastAll({type: 'hint', text: gameState.currentHint})
                            } else {
                                // Fallback to fetch
                                fetchHintsForWord(gameState.currentWord).then(hints => {
                                    if (hints.length > 0) broadcastAll({type: 'hint', text: hints[0]})
                                }).catch(e => console.error('Hint ophalen mislukt:', e))
                            }
                        }
                    }, 90000)
                }
                break
            }
        }
    })


    ws.on('close', () => {
        console.log('Client disconnected:', ws.username)
        delete gameState.scores[ws.username]

        if (gameState.currentDrawer === ws) {
            handleDrawerDisconnect(ws.username)
        }
        broadcastAll({ type: 'player-left', username: ws.username })
        broadcastScores()

        const heartbeat = setInterval(() => {
            wss.clients.forEach((ws) => {
                if (ws.isAlive === false) {
                    console.log('Terminating dead connection:', ws.username)
                    return ws.terminate()
                }
                ws.isAlive = false
                ws.ping()
            })
        }, 10000)

        wss.on('close', () => clearInterval(heartbeat))
    })
})

app.post('/webmention', async (req, res) => {
    const { source, target } = req.body

    // 1. Basic validation
    if (!source || !target) {
        return res.status(400).send('source and target are required')
    }

    let sourceUrl, targetUrl
    try {
        sourceUrl = new URL(source)
        targetUrl = new URL(target)
    } catch {
        return res.status(400).send('Invalid URLs')
    }

    // 2. Target must be on YOUR domain
    if (targetUrl.hostname !== 'wikidoodle-server.onrender.com') {  // Or your frontend domain if applicable
        return res.status(400).send('Target is not on this domain')
    }

    // 3. Fetch source and verify it actually links to target
    let sourceHtml
    try {
        const response = await fetch(source, {
            headers: { 'Accept': 'text/html' },
            timeout: 5000
        })
        if (!response.ok) return res.status(400).send('Could not fetch source')
        sourceHtml = await response.text()
    } catch {
        return res.status(400).send('Could not fetch source')
    }

    if (!sourceHtml.includes(target)) {
        return res.status(400).send('Source does not link to target')
    }

    // 4. Store it
    const mentions = await readMentions()
    const existing = mentions.findIndex(m => m.source === source && m.target === target)

    const mention = {
        source,
        target,
        receivedAt: new Date().toISOString(),
        // Optionally: parse author, title, snippet from sourceHtml here (see Step 4)
    }

    if (existing !== -1) {
        mentions[existing] = mention // update existing
    } else {
        mentions.push(mention)
    }

    await saveMentions(mentions)

    // 202 Accepted is the correct spec response (async processing implied)
    res.status(202).send('Webmention accepted')
})
app.get('/webmentions', async (req, res) => {
    const { target } = req.query
    let mentions = await readMentions()

    if (target) {
        mentions = mentions.filter(m => m.target === target)
    }

    res.json(mentions)
})
async function readMentions() {
    try {
        const data = await fs.readFile(MENTIONS_FILE, 'utf8')
        return JSON.parse(data)
    } catch {
        return [] // file doesn't exist yet
    }
}

async function saveMentions(mentions) {
    await fs.writeFile(MENTIONS_FILE, JSON.stringify(mentions, null, 2))
}

const PORT = process.env.PORT || 3000
httpServer.listen(PORT, () => console.log('Server listening on port ' + PORT))
