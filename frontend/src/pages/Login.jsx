import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GoogleLogin } from '@react-oauth/google';

export default function Login() {
  const { user, isNewUser, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate(isNewUser ? '/profile' : '/');
    }
  }, [user, isNewUser, navigate]);

  if (user) return null;

  const handleSuccess = (credentialResponse) => {
    loginWithGoogle(credentialResponse).catch(() => alert('Login failed'));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--accents-1)] dark:bg-[#0a0a0a] px-4">
      <div className="w-full max-w-sm">
        <div className="card p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--geist-foreground)] text-[var(--geist-background)] font-bold text-lg">
              J
            </div>
          </div>
          <h2 className="text-lg font-semibold text-[var(--geist-foreground)] tracking-[-0.02em] mb-1">
            Sign in to JobSort
          </h2>
          <p className="text-sm text-[var(--accents-4)] mb-6">
            Use your Google account to continue
          </p>
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
        <p className="text-center text-xs text-[var(--accents-3)] mt-4">
          By signing in, you agree to our Terms of Service.
        </p>
      </div>
    </div>
  );
}
