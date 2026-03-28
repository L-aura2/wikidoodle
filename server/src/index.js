import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { fetchWordsForCategory } from './sparql/wordFetcher.js'


const httpServer = createServer()
const wss = new WebSocketServer({ server: httpServer })

const gameState = {
    currentWord: null,
    currentDrawer: null,
    roundStartTime: null,
    currentTheme: null,
    wordPool: [],
    // roundDuration: 80000,
    // roundActive: false,
    scores: {}
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
    gameState.currentDrawer = null
    broadcastAll({
        type: 'round-ended',
        reason: `${username} (tekenaar) heeft de verbinding verloren`
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

                // Eerste speler die joint wordt automatisch tekenaar
                if (gameState.currentDrawer === null) {
                    gameState.currentDrawer = ws
                    ws.send(JSON.stringify({type: 'role', isDrawer: true}))
                } else {
                    // Anderen zijn raaders
                    ws.send(JSON.stringify({type: 'role', isDrawer: false}))
                }
                ws.send(JSON.stringify({type: 'scores-update', scores: gameState.scores}))

                // // Als ronde actief is, stuur ronde-info mee zodat timer synchroon loopt (Doel 8)
                // if (gameState.roundActive) {
                //     ws.send(JSON.stringify({
                //         type: 'round-started',
                //         wordLength: gameState.currentWord.length,
                //         startTime: gameState.roundStartTime,
                //         duration: gameState.roundDuration
                //     }))
                // }

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
                // if (!gameState.roundActive) return
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
                    // broadcastAll({ type: 'score-update', username: ws.username, points })
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
                // gameState.roundActive = false
                gameState.currentWord = null
                broadcastAll({type: 'round-ended', reason: 'Ronde beëindigd door tekenaar'})
                break
            }
            case 'set-theme': {
                try {
                    let words
                    if (msg.custom) {
                        const {validateCustomTheme} = await import('./sparql/wordFetcher.js')
                        words = await validateCustomTheme(msg.wikidataId)
                        if (words.length < 25) {
                            ws.send(JSON.stringify({
                                type: 'theme-rejected',
                                reason: `Te weinig woorden gevonden (${words.length}/25)`
                            }))
                            return
                        }
                    } else {
                        words = await fetchWordsForCategory(msg.theme)
                    }
                    gameState.currentTheme = msg.theme ?? msg.wikidataId
                    gameState.wordPool = words
                    broadcastAll({type: 'theme-set', theme: gameState.currentTheme})
                } catch (err) {
                    ws.send(JSON.stringify({type: 'theme-rejected', reason: 'Fout bij ophalen'}))
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
                const options = shuffled.slice(0, 3)
                ws.send(JSON.stringify({type: 'word-options', words: options}))
                break
            }
            case 'choose-word': {
                wss.clients.forEach(c => { c.hasGuessed = false })
                if (ws !== gameState.currentDrawer) return
                const word = msg.word?.trim()
                if (!word) return

                gameState.currentWord = word
                gameState.roundStartTime = Date.now()

                if (msg.custom) {
                    broadcastAll({
                        type: 'round-started',
                        wordLength: word.length,
                        hint: `Het woord begint met de letter "${word[0].toUpperCase()}"`
                    })
                } else {
                    broadcastAll({
                        type: 'round-started',
                        wordLength: word.length
                    })
                    gameState.hintTimeout = setTimeout(async () => {
                        if (!gameState.currentWord) return
                        const guessedAll = [...wss.clients].every(c => c.hasGuessed || c === gameState.currentDrawer)
                        if (!guessedAll) {
                            try {
                                const { fetchHintsForWord } = await import('./sparql/wordFetcher.js')
                                const hints = await fetchHintsForWord(gameState.currentWord)
                                if (hints.length > 0) {
                                    broadcastAll({ type: 'hint', text: hints[0] })
                                }
                            } catch (e) {
                                console.error('Hint ophalen mislukt:', e)
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



httpServer.listen(3000, () => console.log('Server running on http://localhost:3000'))
