import React, { createContext, useContext, useEffect, useState } from 'react'
import {
    getCurrentUser,
    loginUser,
    logoutUser,
    registerUser,
    type UserProfile,
} from '../services/authApi'
import { queryClient } from '../shared/queryClient'

interface AuthContextType {
    user: UserProfile | null
    isAuthenticated: boolean
    loading: boolean
    login: (usernameOrEmail: string, password: string) => Promise<UserProfile>
    register: (payload: { username: string; email: string; password: string; display_name?: string }) => Promise<void>
    logout: () => Promise<void>
    refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<UserProfile | null>(null)
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
    const [loading, setLoading] = useState<boolean>(true)

    const refreshUser = async () => {
        try {
            const data = await getCurrentUser()
            if (data.authenticated && data.user) {
                setUser(data.user)
                setIsAuthenticated(true)
            } else {
                setUser(null)
                setIsAuthenticated(false)
            }
        } catch (error) {
            console.error('Error al verificar sesión activa:', error)
            setUser(null)
            setIsAuthenticated(false)
        } finally {
            setLoading(false)
        }
    }

    const invalidateUserScopedQueries = () => {
        queryClient.invalidateQueries({ queryKey: ['my-list'] })
        queryClient.invalidateQueries({ queryKey: ['user-agenda'] })
    }

    const clearUserScopedQueries = async () => {
        await Promise.all([
            queryClient.cancelQueries({ queryKey: ['my-list'] }),
            queryClient.cancelQueries({ queryKey: ['user-agenda'] }),
        ])
        queryClient.removeQueries({ queryKey: ['my-list'] })
        queryClient.removeQueries({ queryKey: ['user-agenda'] })
    }

    useEffect(() => {
        refreshUser()

        const handleAuthExpired = () => {
            setUser(null)
            setIsAuthenticated(false)
            void clearUserScopedQueries()
        }
        window.addEventListener('animigos-auth-expired', handleAuthExpired)
        return () => window.removeEventListener('animigos-auth-expired', handleAuthExpired)
    }, [])

    const handleLogin = async (usernameOrEmail: string, password: string): Promise<UserProfile> => {
        const res = await loginUser(usernameOrEmail, password)
        setUser(res.user)
        setIsAuthenticated(true)
        invalidateUserScopedQueries()
        return res.user
    }

    const handleRegister = async (payload: { username: string; email: string; password: string; display_name?: string }) => {
        const res = await registerUser(payload)
        setUser(res.user)
        setIsAuthenticated(true)
        invalidateUserScopedQueries()
    }

    const handleLogout = async () => {
        await queryClient.cancelQueries({ queryKey: ['my-list'] })
        await queryClient.cancelQueries({ queryKey: ['user-agenda'] })
        await logoutUser()
        setUser(null)
        setIsAuthenticated(false)
        queryClient.removeQueries({ queryKey: ['my-list'] })
        queryClient.removeQueries({ queryKey: ['user-agenda'] })
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated,
                loading,
                login: handleLogin,
                register: handleRegister,
                logout: handleLogout,
                refreshUser,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth(): AuthContextType {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth debe ser utilizado dentro de un AuthProvider')
    }
    return context
}
