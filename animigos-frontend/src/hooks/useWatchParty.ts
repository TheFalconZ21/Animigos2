/**
 * Custom Hook Reactivo para Watch Parties y Sincronización en Tiempo Real
 * Pilar 1.2 (Capa de Lógica / Hooks) y Pilar 3 (Coordinación en Tiempo Real) de AGENTS.md.
 * 
 * Implementa:
 * - Server-Authoritative Pattern para sincronización de reproducción y timestamp.
 * - Heartbeat (ping/pong) periódico para medición de latencia de red en tiempo real.
 * - Reconexión automática con exponential backoff y resincronización delta.
 * - Buffer de chat y reacciones animadas en vivo.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import type {
    RoomSummary,
    RoomPlaybackState,
    ChatMessage,
    FloatingReaction,
    ConnectionStatus,
} from '../services/watchPartyApi'

const DEFAULT_PLAYBACK: RoomPlaybackState = {
    is_playing: false,
    current_time: 0,
    last_sync_timestamp: 0,
    episode: 1,
    speed: 1.0,
    host_name: 'Anfitrión',
    total_duration: 1440,
}

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
    const [playback, setPlayback] = useState<RoomPlaybackState>(DEFAULT_PLAYBACK)
    const [displayTime, setDisplayTime] = useState<number>(0)
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
    const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([])

    const wsRef = useRef<WebSocket | null>(null)
    const reconnectAttemptsRef = useRef<number>(0)
    const reconnectTimeoutRef = useRef<number | null>(null)
    const pingIntervalRef = useRef<number | null>(null)
    const isMountedRef = useRef<boolean>(true)

    // Sincronizar displayTime cuando cambia el playback autoritativo
    useEffect(() => {
        setDisplayTime(playback.current_time)
    }, [playback.current_time, playback.is_playing])

    // Timer local de alta frecuencia para avanzar displayTime si is_playing es true
    useEffect(() => {
        if (!playback.is_playing) return

        const interval = setInterval(() => {
            setDisplayTime((prev) => {
                const now = Date.now() / 1000
                const elapsedSinceLastSync = (now - playback.last_sync_timestamp) * playback.speed
                const authoritativeTime = playback.current_time + Math.max(0, elapsedSinceLastSync)
                // Si la desviación local excede 1.5s, forzamos corrección suave hacia el servidor
                if (Math.abs(prev - authoritativeTime) > 1.5) {
                    return authoritativeTime
                }
                return prev + 0.25 * playback.speed
            })
        }, 250)

        return () => clearInterval(interval)
    }, [playback.is_playing, playback.current_time, playback.last_sync_timestamp, playback.speed])

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

        const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const wsHost = import.meta.env.VITE_WS_HOST || '127.0.0.1:8000'
        const url = `${wsProto}//${wsHost}/ws/rooms/${roomId}/?name=${encodeURIComponent(userName)}&token=${encodeURIComponent(userToken)}`

        setConnectionStatus((prev) => (prev === 'connected' ? 'reconnecting' : 'connecting'))

        const ws = new WebSocket(url)
        wsRef.current = ws

        ws.onopen = () => {
            if (!isMountedRef.current) return
            setConnectionStatus('connected')
            reconnectAttemptsRef.current = 0

            // Iniciar Heartbeat cada 15 segundos
            if (pingIntervalRef.current) clearInterval(pingIntervalRef.current)
            pingIntervalRef.current = window.setInterval(() => {
                sendJson({ action: 'ping', client_time: Date.now() })
            }, 15000)

            // Si es reconexión, pedir sincronización delta
            sendJson({ action: 'sync_request' })
        }

        ws.onmessage = (event) => {
            if (!isMountedRef.current) return
            try {
                const data = JSON.parse(event.data)
                const type = data.type

                if (type === 'pong') {
                    const clientTime = Number(data.client_time)
                    if (clientTime) {
                        const roundTrip = Date.now() - clientTime
                        setLatencyMs(roundTrip)
                    }
                } else if (type === 'room_init' || type === 'sync_response') {
                    if (data.room) setRoom(data.room)
                    if (data.playback) setPlayback(data.playback)
                } else if (type === 'playback_state') {
                    if (data.playback) setPlayback(data.playback)
                } else if (type === 'room_state_updated') {
                    if (data.room) setRoom(data.room)
                } else if (type === 'chat_message') {
                    const newMsg: ChatMessage = {
                        id: `chat-${Date.now()}-${Math.random()}`,
                        sender: data.sender || 'Anónimo',
                        text: data.text || '',
                        timestamp: data.timestamp || Date.now() / 1000,
                    }
                    setChatMessages((prev) => [...prev.slice(-49), newMsg])
                } else if (type === 'reaction') {
                    const newReaction: FloatingReaction = {
                        id: `reaction-${Date.now()}-${Math.random()}`,
                        sender: data.sender || 'Anónimo',
                        emoji: data.emoji || '❤️',
                        timestamp: Date.now(),
                        xPos: 15 + Math.random() * 70, // Posición horizontal aleatoria (15% a 85%)
                    }
                    setFloatingReactions((prev) => [...prev.slice(-15), newReaction])
                } else if (type === 'member_joined' || type === 'member_left') {
                    // Notificación en el feed del chat
                    const sysMsg: ChatMessage = {
                        id: `sys-${Date.now()}-${Math.random()}`,
                        sender: 'Sistema',
                        text: `${data.member_name} ${type === 'member_joined' ? 'se unió a la sala' : 'salió de la sala'}.`,
                        timestamp: data.timestamp || Date.now() / 1000,
                    }
                    setChatMessages((prev) => [...prev.slice(-49), sysMsg])
                }
            } catch (err) {
                console.error('Error al procesar mensaje de WebSocket:', err)
            }
        }

        ws.onclose = () => {
            if (!isMountedRef.current) return
            setConnectionStatus('disconnected')

            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current)
                pingIntervalRef.current = null
            }

            // Exponential Backoff: 1s, 2s, 4s, 8s, máx 10s
            const attempts = reconnectAttemptsRef.current
            const delay = Math.min(1000 * Math.pow(2, attempts), 10000)
            reconnectAttemptsRef.current += 1

            setConnectionStatus('reconnecting')
            reconnectTimeoutRef.current = window.setTimeout(() => {
                if (isMountedRef.current) {
                    connect()
                }
            }, delay)
        }

        ws.onerror = (err) => {
            console.warn('Alerta en conexión WebSocket de Watch Party:', err)
        }
    }, [enabled, roomId, userName, userToken, sendJson])

    useEffect(() => {
        isMountedRef.current = true
        connect()

        return () => {
            isMountedRef.current = false
            if (wsRef.current) {
                wsRef.current.close()
            }
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current)
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current)
            }
        }
    }, [connect])

    // Limpieza de reacciones flotantes tras 3 segundos
    useEffect(() => {
        if (floatingReactions.length === 0) return
        const timer = setTimeout(() => {
            setFloatingReactions((prev) => prev.filter((r) => Date.now() - r.timestamp < 3000))
        }, 1000)
        return () => clearTimeout(timer)
    }, [floatingReactions])

    // Métodos de control autoritativo de reproducción (Server-Authoritative)
    const play = useCallback((time?: number) => {
        sendJson({ action: 'request_play', time: time ?? displayTime })
    }, [sendJson, displayTime])

    const pause = useCallback((time?: number) => {
        sendJson({ action: 'request_pause', time: time ?? displayTime })
    }, [sendJson, displayTime])

    const seek = useCallback((targetTime: number) => {
        sendJson({ action: 'request_seek', time: Math.max(0, targetTime) })
    }, [sendJson])

    const changeEpisode = useCallback((episode: number) => {
        sendJson({ action: 'request_episode', episode: Math.max(1, episode) })
    }, [sendJson])

    const sendChat = useCallback((text: string) => {
        if (!text.trim()) return
        sendJson({ action: 'chat_message', text: text.trim() })
    }, [sendJson])

    const sendReaction = useCallback((emoji: string) => {
        sendJson({ action: 'reaction', emoji })
    }, [sendJson])

    const refreshRoom = useCallback(() => {
        sendJson({ action: 'room_refresh' })
    }, [sendJson])

    return {
        room,
        playback,
        displayTime,
        connectionStatus,
        latencyMs,
        chatMessages,
        floatingReactions,
        play,
        pause,
        seek,
        changeEpisode,
        sendChat,
        sendReaction,
        refreshRoom,
    }
}
