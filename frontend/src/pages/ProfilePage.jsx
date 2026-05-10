import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProfilePage() {
  const { user, isNewUser, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await updateProfile({ name: name.trim() || null, email: email.trim() || null });
      navigate('/');
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-5 lg:p-8 max-w-lg mx-auto w-full">
      <h1 className="text-xl font-semibold text-[var(--geist-foreground)] tracking-[-0.025em] mb-1">
        {isNewUser ? 'Welcome — Complete Your Profile' : 'Your Profile'}
      </h1>
      <p className="text-xs text-[var(--accents-4)] mb-6">
        {isNewUser
          ? 'Your name and email are pre-filled from Google. You can edit them before continuing.'
          : 'Update your name and email. These are used in your generated resumes and cover letters.'}
      </p>

      <form onSubmit={handleSave} className="card p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-[var(--accents-5)] mb-1">Full Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-geist w-full"
            placeholder="Your full name"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--accents-5)] mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-geist w-full"
            placeholder="Your email"
            required
          />
        </div>

        {error && (
          <div className="rounded-lg p-3 text-xs" style={{ background: 'rgba(255,91,79,0.08)', color: '#ff5b4f' }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? 'Saving...' : isNewUser ? 'Save & Continue' : 'Save Changes'}
        </button>

        {!isNewUser && (
          <button
            type="button"
            onClick={() => navigate('/')}
            className="btn-ghost w-full text-xs"
          >
            Cancel
          </button>
        )}
      </form>
    </div>
  );
}
