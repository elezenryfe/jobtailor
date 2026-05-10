import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../services/api'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isNewUser, setIsNewUser] = useState(false)

  // Check existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`
      api.get('/api/auth/me')
        .then(res => setUser(res.data))
        .catch(() => {
          localStorage.removeItem('token')
          setUser(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const loginWithGoogle = useCallback(async (credentialResponse) => {
    try {
      const res = await api.post('/api/auth/google', {
        credential: credentialResponse.credential
      })
      const token = res.data.access_token
      localStorage.setItem('token', token)
      api.defaults.headers.common.Authorization = `Bearer ${token}`
      const userRes = await api.get('/api/auth/me')
      setUser(userRes.data)
      setIsNewUser(!!res.data.is_new_user)
    } catch (err) {
      console.error('Google login failed', err)
      throw err
    }
  }, [])

  const updateProfile = useCallback(async (profileData) => {
    const res = await api.patch('/api/auth/profile', profileData)
    setUser(res.data)
    setIsNewUser(false)
  }, [])

  const logout = () => {
    localStorage.removeItem('token')
    delete api.defaults.headers.common.Authorization
    setUser(null)
    setIsNewUser(false)
  }

  return (
    <AuthContext.Provider value={{ user, loading, isNewUser, loginWithGoogle, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)