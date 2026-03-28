import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useSocketStore = defineStore('socket', () => {
    const isConnected = ref(false)
    const ws = ref(null)
    const listeners = ref({})

    // Initialize WebSocket
    const connect = () => {
        if (ws.value && ws.value.readyState === WebSocket.OPEN) {
            return
        }

        ws.value = new WebSocket(`ws://localhost:3000`)

        ws.value.onopen = () => {
            isConnected.value = true
            console.log('WebSocket connected')
            emit('socket:connected', {})
        }

        ws.value.onclose = () => {
            isConnected.value = false
            console.log('WebSocket disconnected')
            emit('socket:disconnected', {})
            // Attempt reconnect after 3 seconds
            setTimeout(() => {
                console.log('Attempting reconnect...')
                connect()
            }, 3000)
        }

        ws.value.onopen = () => {
            isConnected.value = true
            console.log('WebSocket connected')
            _internalEmit('socket:connected', {})
        }

        ws.value.onerror = (error) => {
            console.error('WebSocket error:', error)
        }

        ws.value.onmessage = (e) => {
            const msg = JSON.parse(e.data)
            console.log('Received:', msg)
            _internalEmit(msg.type, msg)
        }
    }

    const emit = (type, data = {}) => {
        if (ws.value && ws.value.readyState === WebSocket.OPEN) {
            ws.value.send(JSON.stringify({ type, ...data }))
        } else {
            console.warn('WebSocket not connected, message not sent:', type)
        }
    }

    const on = (type, callback) => {
        if (!listeners.value[type]) {
            listeners.value[type] = []
        }
        listeners.value[type].push(callback)

        // Return unsubscribe function
        return () => off(type, callback)
    }

    const off = (type, callback) => {
        if (!listeners.value[type]) return
        listeners.value[type] = listeners.value[type].filter(cb => cb !== callback)
    }

    const once = (type, callback) => {
        const unsubscribe = on(type, (data) => {
            callback(data)
            unsubscribe()
        })
        return unsubscribe
    }

    // Internal: trigger listeners
    const _internalEmit = (type, data) => {
        const callbacks = listeners.value[type] || []
        callbacks.forEach(cb => cb(data))
    }

    // Override emit to also trigger listeners
    const originalEmit = emit
    const emitWithListeners = (type, data = {}) => {
        originalEmit(type, data)
        _internalEmit(type, data)
    }

    function send(message) {
        if (ws.value && ws.value.readyState === WebSocket.OPEN) {
            ws.value.send(JSON.stringify(message))
        }
    }

    function disconnect() {
        ws.value?.close()
    }


    // Reconnect on initialization
    connect()

    return {
        isConnected,
        ws,
        connect,
        emit: emitWithListeners,
        on,
        off,
        once,
        _internalEmit,
        send,
        disconnect
    }
})

