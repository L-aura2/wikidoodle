import { ref, computed } from 'vue'

export function roundTimer() {
    const timeLeft = ref(0)
    let animFrameId = null

    const roundActive = computed(() => timeLeft.value > 0)

    const timerColor = computed(() => {
        if (timeLeft.value > 60) return '#2ecc71'
        if (timeLeft.value > 30) return '#f1c40f'
        return '#e74c3c'
    })

    const start = (startTime, duration) => {
        const tick = () => {
            const elapsed = Date.now() - startTime
            const remaining = Math.max(0, Math.ceil((duration - elapsed) / 1000))
            timeLeft.value = remaining
            if (remaining > 0) {
                animFrameId = requestAnimationFrame(tick)
            }
        }
        cancelAnimationFrame(animFrameId)
        animFrameId = requestAnimationFrame(tick)
    }

    const stop = () => {
        cancelAnimationFrame(animFrameId)
        animFrameId = null
        timeLeft.value = 0
    }

    return { timeLeft, roundActive, timerColor, start, stop }
}