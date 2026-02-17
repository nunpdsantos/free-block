import { useState, useRef, useEffect } from 'react';
import type { User } from 'firebase/auth';
import './AuthStrip.css';

type AuthStripProps = {
  user: User | null;
  displayName: string | null;
  loading: boolean;
  onSignIn: () => void;
  onUpdateDisplayName: (name: string) => Promise<void>;
};

export function AuthStrip({ user, displayName, loading, onSignIn, onUpdateDisplayName }: AuthStripProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (loading) {
    return <div className="auth-strip auth-strip--loading">Loading...</div>;
  }

  const isAnonymous = user?.isAnonymous ?? true;

  const handleStartEdit = () => {
    setDraft(displayName ?? '');
    setEditing(true);
  };

  const handleSave = async () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== displayName) {
      await onUpdateDisplayName(trimmed);
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') setEditing(false);
  };

  return (
    <div className="auth-strip">
      {editing ? (
        <div className="auth-strip__edit">
          <input
            ref={inputRef}
            className="auth-strip__input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            maxLength={20}
            placeholder="Enter name"
          />
        </div>
      ) : (
        <span className="auth-strip__name" onClick={handleStartEdit} title="Tap to edit name">
          {displayName ?? 'Anonymous'}
          <svg className="auth-strip__edit-icon" viewBox="0 0 24 24" width="14" height="14">
            <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
          </svg>
        </span>
      )}
      {isAnonymous && (
        <button className="auth-strip__btn" onClick={onSignIn}>
          <svg className="auth-strip__icon" viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Sign in with Google
        </button>
      )}
    </div>
  );
}
