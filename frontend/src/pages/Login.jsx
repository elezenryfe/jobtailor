import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GoogleLogin } from '@react-oauth/google';

export default function Login() {
  const { user, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  if (user) return null;

  const handleSuccess = (credentialResponse) => {
    loginWithGoogle(credentialResponse)
      .then(() => navigate('/'))
      .catch(() => alert('Login failed'));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-lg">J</div>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Sign in to JobSort</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Use your Google account to continue</p>
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleSuccess}
              onError={() => alert('Google Sign-In error')}
              size="large"
              text="signin_with"
              shape="pill"
              scope="profile email"
            />
          </div>
        </div>
        <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-4">
          By signing in, you agree to our Terms of Service.
        </p>
      </div>
    </div>
  );
}