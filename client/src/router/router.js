import { createRouter, createWebHistory } from 'vue-router'
import LobbyView from '../views/LobbyView.vue'
import GameView from '../views/GameView.vue'

const routes = [
    {
        path: '/',
        redirect: '/lobby'
    },
    {
        path: '/lobby',
        name: 'Lobby',
        component: LobbyView
    },
    {
        path: '/game',
        name: 'Game',
        component: GameView
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

export default router

