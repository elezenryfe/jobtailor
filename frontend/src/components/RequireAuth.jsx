import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--accents-1)] dark:bg-[#0a0a0a]">
        <p className="text-sm text-[var(--accents-4)]">Loading...</p>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return children
}
