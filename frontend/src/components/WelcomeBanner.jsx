import { useAuth } from '../context/AuthContext';

export default function WelcomeBanner() {
  const { user } = useAuth();

  // Use the full name if available; otherwise fall back to the email prefix
  const displayName = user?.name || user?.email?.split('@')[0] || 'there';

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-sm font-bold text-blue-600 dark:text-blue-400">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Welcome back, {displayName}
        </h1>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 ml-11">
        Upload a resume, paste a job description, and let AI adapt your application.
      </p>
    </div>
  );
}