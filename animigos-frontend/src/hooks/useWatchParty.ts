/**
 * Custom Hook Reactivo para Watch Parties y Conteo Grupal de Capítulos
 * Pilar 1.2 (Capa de Lógica / Hooks) y Pilar 3 (Coordinación Grupal en Tiempo Real) de AGENTS.md.
 * 
 * Implementa:
 * - Sincronización en tiempo real del progreso de cada miembro y la meta del grupo.
 * - Heartbeat (ping/pong) periódico para medición de latencia de red en tiempo real.
 * - Reconexión automática con exponential backoff y resincronización delta.
 * - Buffer de chat y reacciones animadas en vivo.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import type {
    RoomSummary,
    ChatMessage,
    FloatingReaction,
    ConnectionStatus,
} from '../services/watchPartyApi'
import {
    updateMyProgressApi,
    setGroupEpisodeApi,
    scheduleGroupSessionApi,
} from '../services/watchPartyApi'

interface UseWatchPartyOptions {
    roomId: string
    userName?: string
    userToken?: string
    enabled?: boolean
}

export function useWatchParty({
    roomId,
    userName = 'Invitado',
    userToken = '',
    enabled = true,
}: UseWatchPartyOptions) {
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')
    const [latencyMs, setLatencyMs] = useState<number | null>(null)
    const [room, setRoom] = useState<RoomSummary | null>(null)
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
    const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([])

    const wsRef = useRef<WebSocket | null>(null)
    const reconnectAttemptsRef = useRef<number>(0)
    const reconnectTimeoutRef = useRef<number | null>(null)
    const pingIntervalRef = useRef<number | null>(null)
    const isMountedRef = useRef<boolean>(true)

    // Función segura para enviar payloads JSON
    const sendJson = useCallback((payload: Record<string, any>) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(payload))
            return true
        }
        return false
    }, [])

    // Conexión principal con WebSocket
    const connect = useCallback(() => {
        if (!enabled || !roomId) return

        if (wsRef.current) {
            wsRef.current.close()
            wsRef.current = null
        }

        const wsHost = window.location.hostname || '127.0.0.1'
        const wsPort = 8000 // Daphne/Django ASGI port
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const params = new URLSearchParams({
            name: userName,
            token: userToken,
        })
        const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}/ws/rooms/${roomId}/?${params.toString()}`

        try {
            const socket = new WebSocket(wsUrl)
            wsRef.current = socket

            socket.onopen = () => {
                if (!isMountedRef.current) return
                setConnectionStatus('connected')
                reconnectAttemptsRef.current = 0

                // Iniciar Heartbeat cada 15 segundos
                if (pingIntervalRef.current) clearInterval(pingIntervalRef.current)
                pingIntervalRef.current = window.setInterval(() => {
                    if (socket.readyState === WebSocket.OPEN) {
                        socket.send(JSON.stringify({ action: 'ping', client_time: Date.now() }))
                    }
                }, 15000)
            }

            socket.onmessage = (event) => {
                if (!isMountedRef.current) return
                try {
                    const data = JSON.parse(event.data)

                    // 1. Inicialización
                    if (data.type === 'room_init') {
                        if (data.room) setRoom(data.room)
                        setChatMessages((prev) => [
                            ...prev,
                            {
                                id: `sys-init-${Date.now()}`,
                                sender: 'Sistema',
                                text: data.message || `Conectado a la sala en tiempo real.`,
                                timestamp: Date.now() / 1000,
                            },
                        ])
                    }

                    // 2. Respuesta de Sincronización Delta
                    if (data.type === 'sync_response' || data.type === 'room_state_updated') {
                        if (data.room) setRoom(data.room)
                    }

                    // 3. Progreso de un Miembro Actualizado
                    if (data.type === 'member_progress_updated') {
                        if (data.room) setRoom(data.room)
                    }

                    // 4. Meta Grupal Actualizada
                    if (data.type === 'group_target_updated') {
                        if (data.room) setRoom(data.room)
                    }

                    // 5. Sesión Agendada
                    if (data.type === 'session_scheduled') {
                        if (data.room) setRoom(data.room)
                    }

                    // 6. Miembro se unió / salió
                    if (data.type === 'member_joined') {
                        if (data.room) setRoom(data.room)
                        setChatMessages((prev) => [
                            ...prev,
                            {
                                id: `join-${Date.now()}`,
                                sender: 'Sistema',
                                text: `${data.member_name} se unió a la sala.`,
                                timestamp: data.timestamp || Date.now() / 1000,
                            },
                        ])
                    }

                    if (data.type === 'member_left') {
                        setChatMessages((prev) => [
                            ...prev,
                            {
                                id: `left-${Date.now()}`,
                                sender: 'Sistema',
                                text: `${data.member_name} salió de la sala.`,
                                timestamp: data.timestamp || Date.now() / 1000,
                            },
                        ])
                    }

                    // 7. Chat en Vivo
                    if (data.type === 'chat_message') {
                        setChatMessages((prev) => [
                            ...prev.slice(-100), // Buffer máximo de 100 mensajes
                            {
                                id: `chat-${Date.now()}-${Math.random()}`,
                                sender: data.sender || 'Invitado',
                                text: data.text || '',
                                timestamp: data.timestamp || Date.now() / 1000,
                            },
                        ])
                    }

                    // 8. Reacción Flotante en Pantalla
                    if (data.type === 'reaction') {
                        const newReaction: FloatingReaction = {
                            id: `react-${Date.now()}-${Math.random()}`,
                            sender: data.sender || 'Invitado',
                            emoji: data.emoji || '❤️',
                            timestamp: Date.now(),
                            xPos: Math.floor(Math.random() * 80) + 10,
                        }
                        setFloatingReactions((prev) => [...prev.slice(-15), newReaction])

                        // Remover después de 2.8s
                        setTimeout(() => {
                            if (!isMountedRef.current) return
                            setFloatingReactions((prev) => prev.filter((r) => r.id !== newReaction.id))
                        }, 2800)
                    }

                    // 9. Pong / Medición de Latencia
                    if (data.type === 'pong' && data.client_time) {
                        const rtt = Date.now() - data.client_time
                        setLatencyMs(rtt)
                    }

                    // 10. Rate Limit Warning
                    if (data.type === 'rate_limit_exceeded') {
                        setChatMessages((prev) => [
                            ...prev,
                            {
                                id: `warn-${Date.now()}`,
                                sender: 'Sistema',
                                text: `⚠️ ${data.message}`,
                                timestamp: Date.now() / 1000,
                            },
                        ])
                    }
                } catch (err) {
                    console.error('Error parseando mensaje WebSocket:', err)
                }
            }

            socket.onerror = () => {
                if (!isMountedRef.current) return
                setConnectionStatus('reconnecting')
            }

            socket.onclose = () => {
                if (!isMountedRef.current) return
                setConnectionStatus('reconnecting')
                if (pingIntervalRef.current) clearInterval(pingIntervalRef.current)

                // Reconexión con Exponential Backoff (1s, 2s, 4s, hasta máx 10s)
                const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000)
                reconnectAttemptsRef.current += 1

                reconnectTimeoutRef.current = window.setTimeout(() => {
                    if (isMountedRef.current) {
                        connect()
                    }
                }, delay)
            }
        } catch (e) {
            console.error('Error instanciando WebSocket:', e)
            setConnectionStatus('disconnected')
        }
    }, [roomId, userName, userToken, enabled])

    useEffect(() => {
        isMountedRef.current = true
        connect()

        return () => {
            isMountedRef.current = false
            if (pingIntervalRef.current) clearInterval(pingIntervalRef.current)
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
            if (wsRef.current) {
                wsRef.current.close()
                wsRef.current = null
            }
        }
    }, [connect])

    // ==============================================================
    // Despacho de Acciones de Coordinación Grupal
    // ==============================================================

    const updateMyProgress = useCallback(
        async (episodesWatched: number) => {
            const sent = sendJson({
                action: 'update_progress',
                episodes_watched: episodesWatched,
            })
            if (!sent && roomId) {
                // Fallback HTTP si el socket se encuentra desconectado
                try {
                    const updated = await updateMyProgressApi(roomId, {
                        guest_token: userToken,
                        guest_name: userName,
                        episodes_watched: episodesWatched,
                    })
                    setRoom(updated)
                } catch (e) {
                    console.error('Error actualizando progreso por HTTP:', e)
                }
            }
        },
        [sendJson, roomId, userToken, userName]
    )

    const setGroupTarget = useCallback(
        async (episode: number) => {
            const sent = sendJson({
                action: 'set_group_target',
                episode: episode,
            })
            if (!sent && roomId) {
                try {
                    const updated = await setGroupEpisodeApi(roomId, episode)
                    setRoom(updated)
                } catch (e) {
                    console.error('Error actualizando meta grupal por HTTP:', e)
                }
            }
        },
        [sendJson, roomId]
    )

    const scheduleSession = useCallback(
        async (nextSessionDate: string | null, sessionNotes: string) => {
            const sent = sendJson({
                action: 'schedule_session',
                next_session_date: nextSessionDate,
                session_notes: sessionNotes,
            })
            if (!sent && roomId) {
                try {
                    const updated = await scheduleGroupSessionApi(roomId, {
                        next_session_date: nextSessionDate,
                        session_notes: sessionNotes,
                    })
                    setRoom(updated)
                } catch (e) {
                    console.error('Error agendando sesión por HTTP:', e)
                }
            }
        },
        [sendJson, roomId]
    )

    const sendChat = useCallback(
        (text: string) => {
            if (!text.trim()) return
            sendJson({
                action: 'chat_message',
                text: text.trim(),
            })
        },
        [sendJson]
    )

    const sendReaction = useCallback(
        (emoji: string) => {
            sendJson({
                action: 'reaction',
                emoji,
            })
        },
        [sendJson]
    )

    const refreshRoom = useCallback(() => {
        sendJson({ action: 'sync_request' })
    }, [sendJson])

    return {
        connectionStatus,
        latencyMs,
        room,
        chatMessages,
        floatingReactions,
        updateMyProgress,
        setGroupTarget,
        scheduleSession,
        sendChat,
        sendReaction,
        refreshRoom,
    }
}
