import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, ShieldCheck, LogIn } from 'lucide-react';
import { Modal } from '../common/Modal';
import { useAuth } from '../../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { signIn } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setPassword('');
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Escribe tu usuario y tu contraseña.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    const result = await signIn(username, password);

    if (result.error) {
      setError(result.error);
      setIsSubmitting(false);
      return;
    }

    // La cookie ya está puesta: se cierra el modal y CourseContext sincroniza.
    setIsSubmitting(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Iniciar sesión"
      subtitle="Accede a tus cursos guardados en tu servidor"
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="auth-username" className="block text-xs font-semibold text-fg">
            Usuario
          </label>
          <input
            id="auth-username"
            type="text"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="tu-usuario"
            className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-fg outline-none transition-colors placeholder:text-fg-muted focus:border-fg"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="auth-password" className="block text-xs font-semibold text-fg">
            Contraseña
          </label>
          <input
            id="auth-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-fg outline-none transition-colors placeholder:text-fg-muted focus:border-fg"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-btn px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-btn-hover disabled:opacity-60 active:scale-[0.99]"
        >
          {isSubmitting ? (
            <Loader2 className="h-5 w-5 animate-spin text-sky-300" />
          ) : (
            <LogIn className="h-4 w-4 text-sky-300" />
          )}
          {isSubmitting ? 'Entrando...' : 'Entrar'}
        </button>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <p className="text-center text-[11px] leading-relaxed text-fg-muted">
          La cuenta se crea una sola vez en el servidor con{' '}
          <code className="rounded bg-surface-2 px-1 py-0.5 text-[10px]">node server/create-user.js</code>.
        </p>

        <div className="flex items-center justify-between gap-2 border-t border-line pt-2">
          <span className="flex items-center gap-1 text-[11px] text-fg-muted">
            <ShieldCheck className="h-3 w-3 text-emerald-600" />
            Sesión cifrada en tu propio servidor
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-fg-soft transition-colors hover:bg-line hover:text-fg"
          >
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
};
