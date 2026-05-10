import { useAuth } from '../context/AuthContext';

export default function WelcomeBanner() {
  const { user } = useAuth();
  const displayName = user?.name || user?.email?.split('@')[0] || 'there';

  return (
    <div className="card p-6">
      <h1 className="text-lg font-semibold text-[var(--geist-foreground)] tracking-[-0.02em] mb-2">
        Welcome back, {displayName}
      </h1>
      <p className="text-sm text-[var(--accents-4)]">
        Upload a resume, paste a job description, and let AI adapt your application.
      </p>
    </div>
  );
}
